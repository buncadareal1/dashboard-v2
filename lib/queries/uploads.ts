import { isApiMode, apiFetch } from "@/lib/api/client";

export type UploadHistoryRow = {
  id: string;
  type: "facebook" | "bitrix" | "cost";
  filename: string;
  status: "pending" | "processing" | "done" | "failed";
  rowCount: number;
  parsedCount: number;
  errorCount: number;
  createdAt: Date | string;
  finishedAt: Date | string | null;
};

export async function getUploadHistory(
  projectIdOrSlug: string,
  limit = 10,
): Promise<UploadHistoryRow[]> {
  if (!isApiMode()) {
    const { getUploadHistory: dbFn } = await import("./db/uploads");
    return dbFn(projectIdOrSlug, limit);
  }
  return apiFetch<UploadHistoryRow[]>(
    `/api/projects/${projectIdOrSlug}/uploads?limit=${limit}`,
  );
}
