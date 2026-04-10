import { eq } from "drizzle-orm";
import { inngest } from "../client";
import { db } from "@/db";
import { csvUploads } from "@/db/schema";
import { parseFacebookCsv } from "@/lib/csv/parser-facebook";
import { parseBitrixCsv } from "@/lib/csv/parser-bitrix";
import { parseCostCsv } from "@/lib/csv/parser-cost";
import {
  ingestFacebookRows,
  ingestBitrixRows,
  ingestCostRows,
} from "@/lib/csv/upsert-service";
import { rebuildDailyAggregatesForDates } from "@/lib/aggregates/builder";

/**
 * Inngest function: xử lý upload CSV durable.
 *
 * Triggered bởi event `csv/uploaded` từ /api/upload/csv.
 *
 * Steps:
 * 1. Mark upload status=processing
 * 2. Parse CSV (FB hoặc Bitrix)
 * 3. Ingest qua upsert service (match + upsert + stage events)
 * 4. Rebuild daily_aggregates cho các ngày bị ảnh hưởng
 * 5. Update upload status=done
 *
 * Mỗi step retry độc lập nếu fail. Concurrency key theo projectId
 * để tránh race condition khi 2 upload cùng project chạy song song.
 */
export const processCsvUpload = inngest.createFunction(
  {
    id: "process-csv-upload",
    retries: 3,
    concurrency: {
      // Tuần tự hoá per-project để tránh upsert race
      key: "event.data.projectId",
      limit: 1,
    },
    triggers: [{ event: "csv/uploaded" }],
  },
  async ({ event, step }) => {
    const { uploadId, projectId, type, fileContent } = (
      event as { data: Record<string, unknown> }
    ).data as {
      uploadId: string;
      projectId: string;
      type: "facebook" | "bitrix" | "cost";
      fileContent: string;
    };

    await step.run("mark-processing", async () => {
      await db
        .update(csvUploads)
        .set({ status: "processing" })
        .where(eq(csvUploads.id, uploadId));
    });

    const parsed = await step.run("parse", async () => {
      if (type === "facebook") {
        const result = parseFacebookCsv(fileContent);
        if (result.kind !== "ok") {
          throw new Error(`FB parse failed: ${result.kind}`);
        }
        return { kind: "facebook" as const, rows: result.rows };
      } else if (type === "bitrix") {
        const result = parseBitrixCsv(fileContent);
        if (result.kind !== "ok") {
          throw new Error(`Bitrix parse failed: ${result.kind}`);
        }
        return { kind: "bitrix" as const, rows: result.rows };
      } else {
        const result = parseCostCsv(fileContent);
        if (result.kind !== "ok") {
          throw new Error(`Cost parse failed: ${result.kind}`);
        }
        return { kind: "cost" as const, rows: result.rows };
      }
    });

    const summary = await step.run("ingest", async () => {
      // Inngest serialize step output → Date trở thành string. Revive lại.
      const reviveDate = (v: unknown): Date | null =>
        v == null ? null : new Date(v as string);

      if (parsed.kind === "facebook") {
        return ingestFacebookRows(
          parsed.rows.map((r) => ({
            ...r,
            source: "csv_facebook" as const,
            fbCreatedAt: reviveDate(r.fbCreatedAt),
          })),
          { projectId, csvUploadId: uploadId },
        );
      } else if (parsed.kind === "bitrix") {
        return ingestBitrixRows(
          parsed.rows.map((r) => ({
            ...r,
            source: "csv_bitrix" as const,
            bitrixUpdatedAt: reviveDate(r.bitrixUpdatedAt),
          })),
          { projectId, csvUploadId: uploadId },
        );
      } else {
        return ingestCostRows(parsed.rows, {
          projectId,
          csvUploadId: uploadId,
        });
      }
    });

    await step.run("rebuild-aggregates", async () => {
      // Phạm vi đơn giản: rebuild hôm nay. Phase nâng cao có thể detect
      // các ngày unique trong rows.
      const today = new Date();
      await rebuildDailyAggregatesForDates(projectId, [today]);
    });

    await step.run("mark-done", async () => {
      await db
        .update(csvUploads)
        .set({
          status: "done",
          parsedCount:
            summary.inserted + summary.updated,
          errorCount: summary.conflicts,
          finishedAt: new Date(),
          errorLog: {
            inserted: summary.inserted,
            updated: summary.updated,
            conflicts: summary.conflicts,
            pendingAliases: summary.pendingAliases,
          },
        })
        .where(eq(csvUploads.id, uploadId));
    });

    return summary;
  },
);
