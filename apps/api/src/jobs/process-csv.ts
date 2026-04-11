import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "@dashboard/db";
import { csvUploads } from "@dashboard/db/schema";
import { workerRedis } from "./queue.js";
import { parseFacebookCsv } from "../services/csv/parser-facebook.js";
import { parseBitrixCsv } from "../services/csv/parser-bitrix.js";
import { parseCostCsv } from "../services/csv/parser-cost.js";
import {
  ingestFacebookRows,
  ingestBitrixRows,
  ingestCostRows,
} from "../services/csv/upsert-service.js";
import { rebuildAllAggregatesForProject } from "../services/aggregates/builder.js";

type CsvJobData = {
  uploadId: string;
  projectId: string;
  type: "facebook" | "bitrix" | "cost";
  fileContent: string;
};

export const csvWorker = new Worker<CsvJobData>(
  "csv-processing",
  async (job) => {
    const { uploadId, projectId, type, fileContent } = job.data;
    console.log(`[csv-worker] Processing ${type} upload ${uploadId} for project ${projectId}`);

    await db
      .update(csvUploads)
      .set({ status: "processing" })
      .where(eq(csvUploads.id, uploadId));

    try {
      let summary: {
        inserted: number;
        updated: number;
        conflicts: number;
        pendingAliases: number;
      };

      if (type === "facebook") {
        const result = parseFacebookCsv(fileContent);
        if (result.kind !== "ok") {
          throw new Error(
            `Parse FB fail: ${result.kind}${result.kind === "invalid-header" ? " missing=" + result.missing.join(",") : ""}`,
          );
        }
        summary = await ingestFacebookRows(
          result.rows.map((r) => ({ ...r, source: "csv_facebook" as const })),
          { projectId, csvUploadId: uploadId },
        );
      } else if (type === "bitrix") {
        const result = parseBitrixCsv(fileContent);
        if (result.kind !== "ok") {
          throw new Error(
            `Parse Bitrix fail: ${result.kind}${result.kind === "invalid-header" ? " missing=" + result.missing.join(",") : ""}`,
          );
        }
        summary = await ingestBitrixRows(
          result.rows.map((r) => ({ ...r, source: "csv_bitrix" as const })),
          { projectId, csvUploadId: uploadId },
        );
      } else {
        const result = parseCostCsv(fileContent);
        if (result.kind !== "ok") {
          throw new Error(
            `Parse Cost fail: ${result.kind}${result.kind === "invalid-header" ? " missing=" + result.missing.join(",") : ""}`,
          );
        }
        summary = await ingestCostRows(result.rows, {
          projectId,
          csvUploadId: uploadId,
        });
      }

      // Skip aggregate rebuild for cost-only uploads (no lead data changed)
      if (type !== "cost") {
        await rebuildAllAggregatesForProject(projectId);
      }

      await db
        .update(csvUploads)
        .set({
          status: "done",
          parsedCount: summary.inserted + summary.updated,
          errorCount: summary.conflicts,
          finishedAt: new Date(),
          errorLog: summary,
        })
        .where(eq(csvUploads.id, uploadId));

      console.log(`[csv-worker] Done: ${uploadId}`, summary);
    } catch (err) {
      console.error(`[csv-worker] Failed: ${uploadId}`, err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      await db
        .update(csvUploads)
        .set({
          status: "failed",
          errorLog: { error: msg },
          finishedAt: new Date(),
        })
        .where(eq(csvUploads.id, uploadId));
      throw err;
    }
  },
  {
    connection: workerRedis,
    concurrency: 2,
  },
);

csvWorker.on("failed", (job, err) => {
  console.error(`[csv-worker] Job ${job?.id} failed after ${job?.attemptsMade} attempts:`, err.message);
});
