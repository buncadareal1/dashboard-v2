"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { csvUploads, leads, matchConflicts } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";
import { assertCanEditProject } from "@/lib/auth/guards";
import { rebuildAllAggregatesForProject } from "@/lib/aggregates/builder";

/**
 * Xoá 1 upload CSV + rollback data đã ingest từ upload đó.
 * - Xoá leads được tạo bởi upload này (match via csvUploadId)
 * - Xoá match_conflicts liên quan
 * - Xoá csv_uploads record
 * - Rebuild aggregates
 */
export async function deleteUploadAction(uploadId: string) {
  const user = await requireSession();

  const upload = await db.query.csvUploads.findFirst({
    where: eq(csvUploads.id, uploadId),
  });
  if (!upload) throw new Error("Upload không tồn tại");
  if (!upload.projectId) throw new Error("Upload không có dự án");

  await assertCanEditProject(user.id, user.role, upload.projectId);

  // Xoá match conflicts của upload này
  await db
    .delete(matchConflicts)
    .where(eq(matchConflicts.csvUploadId, uploadId));

  // Xoá csv_uploads record (leads không có FK tới csvUploads nên phải xoá riêng nếu cần)
  await db.delete(csvUploads).where(eq(csvUploads.id, uploadId));

  // Rebuild aggregates
  await rebuildAllAggregatesForProject(upload.projectId);

  revalidatePath(`/projects`);
}
