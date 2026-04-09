import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { matchConflicts, csvUploads, projects } from "@/db/schema";

export type ConflictRow = {
  id: string;
  reason: string;
  candidates: unknown;
  csvUploadId: string;
  csvFilename: string;
  csvType: "facebook" | "bitrix";
  projectName: string;
  createdAt: Date;
};

export async function getUnresolvedConflicts(
  projectId?: string,
): Promise<ConflictRow[]> {
  const where = projectId
    ? and(
        eq(matchConflicts.resolved, false),
        eq(csvUploads.projectId, projectId),
      )
    : eq(matchConflicts.resolved, false);

  const rows = await db
    .select({
      id: matchConflicts.id,
      reason: matchConflicts.reason,
      candidates: matchConflicts.candidates,
      csvUploadId: matchConflicts.csvUploadId,
      csvFilename: csvUploads.filename,
      csvType: csvUploads.type,
      projectName: projects.name,
      createdAt: matchConflicts.createdAt,
    })
    .from(matchConflicts)
    .innerJoin(csvUploads, eq(matchConflicts.csvUploadId, csvUploads.id))
    .innerJoin(projects, eq(csvUploads.projectId, projects.id))
    .where(where)
    .orderBy(desc(matchConflicts.createdAt))
    .limit(50);

  return rows as ConflictRow[];
}
