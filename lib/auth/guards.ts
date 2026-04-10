import { cache } from "react";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { projectUsers, type UserRole } from "@/db/schema";
import { requireSession, type SessionUser } from "./session";

/**
 * RBAC guards — gate cho mọi query/action server-side.
 *
 * NGUYÊN TẮC VÀNG: projectId mà FE gửi lên KHÔNG ĐƯỢC TIN.
 * Mọi query Report/Project bắt buộc intersect với getAccessibleProjectIds(user).
 */

export class ForbiddenError extends Error {
  constructor(message = "FORBIDDEN") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Check role — throw nếu không khớp.
 */
export async function assertRole(
  roles: UserRole[],
): Promise<SessionUser> {
  const user = await requireSession();
  if (!roles.includes(user.role)) {
    throw new ForbiddenError(`Required role: ${roles.join(",")}`);
  }
  return user;
}

/**
 * Lấy danh sách projectId user có quyền XEM (can_view).
 * Admin → tất cả (return null = no scope filter).
 * Digital/GDDA → chỉ project có project_users.can_view = true.
 *
 * @returns null nếu admin (không scope), [] nếu không có project, hoặc list projectId
 */
/**
 * React cache() deduplicate trong cùng 1 render tree (1 request).
 * Nhiều query functions gọi getAccessibleProjectIds → chỉ hit DB 1 lần.
 */
export const getAccessibleProjectIds = cache(
  async (userId: string, role: UserRole): Promise<string[] | null> => {
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
    return rows.map((r: { projectId: string }) => r.projectId);
  },
);

/**
 * Lấy projectId user có quyền SỬA (can_edit) — admin có hết.
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
  return rows.map((r: { projectId: string }) => r.projectId);
}

/**
 * Bảo vệ route detail dự án — throw 403 nếu không có quyền xem.
 */
export async function assertCanViewProject(
  userId: string,
  role: UserRole,
  projectId: string,
): Promise<void> {
  if (role === "admin") return;

  const row = await db.query.projectUsers.findFirst({
    where: and(
      eq(projectUsers.userId, userId),
      eq(projectUsers.projectId, projectId),
      eq(projectUsers.canView, true),
    ),
  });
  if (!row) throw new ForbiddenError("Cannot view this project");
}

/**
 * Bảo vệ action sửa dự án / upload CSV — throw 403 nếu không có can_edit.
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
  if (!row) throw new ForbiddenError("Cannot edit this project");
}

/**
 * Helper: scope một list projectId user FE gửi xuống về intersection với accessible.
 * Nếu user là admin → return original. Nếu rỗng → return [].
 */
export function scopeProjectIds(
  requested: string[] | undefined,
  accessible: string[] | null,
): string[] | null {
  if (accessible === null) return requested ?? null; // admin
  if (!requested || requested.length === 0) return accessible;
  const set = new Set(accessible);
  return requested.filter((id) => set.has(id));
}

// Re-export for convenience
export { inArray };
