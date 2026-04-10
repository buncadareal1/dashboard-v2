import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { csvUploads } from "@/db/schema";

export type UploadHistoryRow = {
  id: string;
  type: "facebook" | "bitrix" | "cost";
  filename: string;
  status: "pending" | "processing" | "done" | "failed";
  rowCount: number;
  parsedCount: number;
  errorCount: number;
  createdAt: Date;
  finishedAt: Date | null;
};

export async function getUploadHistory(
  projectId: string,
  limit = 10,
): Promise<UploadHistoryRow[]> {
  const rows = await db
    .select({
      id: csvUploads.id,
      type: csvUploads.type,
      filename: csvUploads.filename,
      status: csvUploads.status,
      rowCount: csvUploads.rowCount,
      parsedCount: csvUploads.parsedCount,
      errorCount: csvUploads.errorCount,
      createdAt: csvUploads.createdAt,
      finishedAt: csvUploads.finishedAt,
    })
    .from(csvUploads)
    .where(eq(csvUploads.projectId, projectId))
    .orderBy(desc(csvUploads.createdAt))
    .limit(limit);
  return rows as UploadHistoryRow[];
}
