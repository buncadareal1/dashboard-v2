import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { csvUploads } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";
import { assertCanEditProject } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/utils/rate-limit";
import { inngest } from "@/inngest/client";
import { parseFacebookCsv } from "@/lib/csv/parser-facebook";
import { parseBitrixCsv } from "@/lib/csv/parser-bitrix";
import { parseCostCsv } from "@/lib/csv/parser-cost";
import {
  ingestFacebookRows,
  ingestBitrixRows,
  ingestCostRows,
} from "@/lib/csv/upsert-service";
import { rebuildAllAggregatesForProject } from "@/lib/aggregates/builder";
import { notifyCsvUpload } from "@/lib/services/notifications";
import { projects } from "@/db/schema";

/**
 * POST /api/upload/csv
 * multipart: { file, projectId, type }
 *
 * Validate quyền + size + header signature → ghi csv_uploads → enqueue Inngest.
 * Trả uploadId để FE poll status qua /api/uploads/[id].
 */

const QuerySchema = z.object({
  projectId: z.string().uuid(),
  type: z.enum(["facebook", "bitrix", "cost"]),
});

const MAX_SIZE = 4 * 1024 * 1024; // 4MB Vercel limit

export async function POST(req: Request) {
  const user = await requireSession();

  const { ok, remaining } = rateLimit(`upload:${user.id}`, 10, 3600000);
  if (!ok) {
    return NextResponse.json(
      { error: "Bạn đã gửi quá nhiều tin nhắn. Vui lòng thử lại sau." },
      { status: 429 },
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const projectId = formData.get("projectId");
  const type = formData.get("type");

  // Validate inputs
  const parsed = QuerySchema.safeParse({ projectId, type });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: `File quá lớn (max ${MAX_SIZE / 1024 / 1024}MB)` },
      { status: 413 },
    );
  }

  // RBAC
  await assertCanEditProject(user.id, user.role, parsed.data.projectId);

  // Read file content
  const content = await file.text();

  // Header signature check (light — full check trong Inngest)
  const firstLine = content.split("\n", 1)[0]?.trim();
  if (parsed.data.type === "facebook" && !firstLine?.includes("Lead ID")) {
    return NextResponse.json(
      { error: "File không phải định dạng Facebook (thiếu cột Lead ID)" },
      { status: 400 },
    );
  }
  if (
    parsed.data.type === "bitrix" &&
    !firstLine?.toLowerCase().includes("stage")
  ) {
    return NextResponse.json(
      { error: "File không phải định dạng Bitrix (thiếu cột Stage)" },
      { status: 400 },
    );
  }
  if (
    parsed.data.type === "cost" &&
    !firstLine?.toUpperCase().includes("CHI TIÊU")
  ) {
    return NextResponse.json(
      { error: "File không phải định dạng Chi phí (thiếu cột CHI TIÊU)" },
      { status: 400 },
    );
  }

  // Insert audit row
  const [upload] = await db
    .insert(csvUploads)
    .values({
      uploadedBy: user.id,
      projectId: parsed.data.projectId,
      type: parsed.data.type,
      filename: file.name,
      status: "pending",
    })
    .returning({ id: csvUploads.id });

  // Strategy: nếu có Inngest key → enqueue async (production).
  // Nếu không (dev) → process inline synchronously.
  const hasInngest = !!process.env.INNGEST_EVENT_KEY;

  if (hasInngest) {
    await inngest.send({
      name: "csv/uploaded",
      data: {
        uploadId: upload.id,
        projectId: parsed.data.projectId,
        type: parsed.data.type,
        fileContent: content,
      },
    });
    return NextResponse.json({ uploadId: upload.id, status: "pending" });
  }

  // Inline processing (dev mode) — block route until done
  try {
    await db
      .update(csvUploads)
      .set({ status: "processing" })
      .where(eq(csvUploads.id, upload.id));

    let summary: {
      inserted: number;
      updated: number;
      conflicts: number;
      pendingAliases: number;
    };

    if (parsed.data.type === "facebook") {
      const result = parseFacebookCsv(content);
      if (result.kind !== "ok") throw new Error(`Parse FB fail: ${result.kind}`);
      summary = await ingestFacebookRows(
        result.rows.map((r) => ({ ...r, source: "csv_facebook" as const })),
        { projectId: parsed.data.projectId, csvUploadId: upload.id },
      );
    } else if (parsed.data.type === "bitrix") {
      const result = parseBitrixCsv(content);
      if (result.kind !== "ok")
        throw new Error(`Parse Bitrix fail: ${result.kind}`);
      summary = await ingestBitrixRows(
        result.rows.map((r) => ({ ...r, source: "csv_bitrix" as const })),
        { projectId: parsed.data.projectId, csvUploadId: upload.id },
      );
    } else {
      // cost
      const result = parseCostCsv(content);
      if (result.kind !== "ok")
        throw new Error(
          `Parse Cost fail: ${result.kind}${result.kind === "invalid-header" ? " missing=" + result.missing.join(",") : ""}`,
        );
      summary = await ingestCostRows(result.rows, {
        projectId: parsed.data.projectId,
        csvUploadId: upload.id,
      });
    }

    await rebuildAllAggregatesForProject(parsed.data.projectId);

    await db
      .update(csvUploads)
      .set({
        status: "done",
        parsedCount: summary.inserted + summary.updated,
        errorCount: summary.conflicts,
        finishedAt: new Date(),
        errorLog: summary,
      })
      .where(eq(csvUploads.id, upload.id));

    // Notify admins about successful upload (fire-and-forget)
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, parsed.data.projectId),
      columns: { name: true },
    });
    notifyCsvUpload({
      uploaderName: user.name ?? user.email ?? "Unknown",
      uploaderEmail: user.email ?? "",
      filename: file.name,
      projectName: project?.name ?? "Unknown",
      projectId: parsed.data.projectId,
      uploadId: upload.id,
      rowCount: summary.inserted + summary.updated,
      status: "done",
    }).catch(() => {/* non-blocking */});

    return NextResponse.json({
      uploadId: upload.id,
      status: "done",
      summary,
    });
  } catch (err) {
    console.error("[upload-csv]", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    await db
      .update(csvUploads)
      .set({
        status: "failed",
        errorLog: { error: msg },
        finishedAt: new Date(),
      })
      .where(eq(csvUploads.id, upload.id));
    return NextResponse.json(
      { error: "Upload thất bại. Vui lòng thử lại.", uploadId: upload.id },
      { status: 500 },
    );
  }
}
