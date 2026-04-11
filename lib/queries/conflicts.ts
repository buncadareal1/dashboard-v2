import { isApiMode, apiFetch } from "@/lib/api/client";

export type ConflictRow = {
  id: string;
  reason: string;
  candidates: unknown;
  csvUploadId: string;
  csvFilename: string;
  csvType: "facebook" | "bitrix";
  projectName: string;
  createdAt: Date | string;
};

export async function getUnresolvedConflicts(
  projectId?: string,
): Promise<ConflictRow[]> {
  if (!isApiMode()) {
    const { getUnresolvedConflicts: dbFn } = await import("./db/conflicts");
    return dbFn(projectId);
  }
  const qs = projectId ? `?projectId=${projectId}` : "";
  return apiFetch<ConflictRow[]>(`/api/conflicts${qs}`);
}
