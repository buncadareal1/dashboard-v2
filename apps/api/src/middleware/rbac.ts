import { eq, and, inArray } from "drizzle-orm";
import { db } from "@dashboard/db";
import { projectUsers, type UserRole } from "@dashboard/db/schema";

/**
 * Lấy danh sách projectId user có quyền XEM.
 * Admin → null (no scope filter).
 */
export async function getAccessibleProjectIds(
  userId: string,
  role: UserRole,
): Promise<string[] | null> {
  if (role === "admin") return null;

  const rows = await db
    .select({ projectId: projectUsers.projectId })
    .from(projectUsers)
    .where(
      and(
        eq(projectUsers.userId, userId),
        eq(projectUsers.canView, true),
      ),
    );
  return rows.map((r) => r.projectId);
}

/**
 * Lấy projectId user có quyền SỬA — admin có hết.
 */
export async function getEditableProjectIds(
  userId: string,
  role: UserRole,
): Promise<string[] | null> {
  if (role === "admin") return null;

  const rows = await db
    .select({ projectId: projectUsers.projectId })
    .from(projectUsers)
    .where(
      and(
        eq(projectUsers.userId, userId),
        eq(projectUsers.canEdit, true),
      ),
    );
  return rows.map((r) => r.projectId);
}

/**
 * Throw nếu user không có quyền edit project.
 */
export async function assertCanEditProject(
  userId: string,
  role: UserRole,
  projectId: string,
): Promise<void> {
  if (role === "admin") return;

  const row = await db.query.projectUsers.findFirst({
    where: and(
      eq(projectUsers.userId, userId),
      eq(projectUsers.projectId, projectId),
      eq(projectUsers.canEdit, true),
    ),
  });
  if (!row) {
    throw new Error("FORBIDDEN: Cannot edit this project");
  }
}

/**
 * Scope requested projectIds về intersection với accessible.
 */
export function scopeProjectIds(
  requested: string[] | undefined,
  accessible: string[] | null,
): string[] | null {
  if (accessible === null) return requested ?? null;
  if (!requested || requested.length === 0) return accessible;
  const set = new Set(accessible);
  return requested.filter((id) => set.has(id));
}

export { inArray };
