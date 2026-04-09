import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { csvUploads } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";
import { assertCanEditProject } from "@/lib/auth/guards";
import { inngest } from "@/inngest/client";

/**
 * POST /api/upload/csv
 * multipart: { file, projectId, type }
 *
 * Validate quyền + size + header signature → ghi csv_uploads → enqueue Inngest.
 * Trả uploadId để FE poll status qua /api/uploads/[id].
 */

const QuerySchema = z.object({
  projectId: z.string().uuid(),
  type: z.enum(["facebook", "bitrix"]),
});

const MAX_SIZE = 4 * 1024 * 1024; // 4MB Vercel limit

export async function POST(req: Request) {
  const user = await requireSession();

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

  // Enqueue Inngest
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
