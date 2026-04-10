import { sql, inArray, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, leads, stages } from "@/db/schema";
import { getAccessibleProjectIds } from "@/lib/auth/guards";
import type { UserRole } from "@/db/schema";

/**
 * Load filter options cho Report Data — scoped theo RBAC.
 * - projects: list dự án user có quyền xem
 * - stages: chỉ stage ĐANG CÓ LEAD trong DB (không list stage trống)
 */
export async function getReportFilterOptions(params: {
  userId: string;
  role: UserRole;
}) {
  const accessible = await getAccessibleProjectIds(params.userId, params.role);

  // Projects
  const projectRows =
    accessible === null
      ? await db
          .select({ id: projects.id, name: projects.name })
          .from(projects)
          .where(sql`${projects.deletedAt} IS NULL`)
          .orderBy(projects.name)
      : accessible.length === 0
        ? []
        : await db
            .select({ id: projects.id, name: projects.name })
            .from(projects)
            .where(inArray(projects.id, accessible))
            .orderBy(projects.name);

  // Stages — chỉ lấy stage hiện có lead (DISTINCT join từ bảng leads)
  const scopeLeads =
    accessible === null
      ? sql`true`
      : accessible.length === 0
        ? sql`false`
        : inArray(leads.projectId, accessible);

  const stageRows = await db
    .select({
      code: stages.code,
      label: stages.labelVi,
      count: sql<number>`count(*)::int`,
    })
    .from(leads)
    .innerJoin(stages, eq(leads.currentStageId, stages.id))
    .where(scopeLeads)
    .groupBy(stages.code, stages.labelVi, stages.displayOrder)
    .orderBy(stages.displayOrder);

  return {
    projects: projectRows.map((r) => ({ value: r.id, label: r.name })),
    stages: stageRows.map(
      (r: { code: string; label: string; count: number }) => ({
        value: r.code,
        label: `${r.label} (${r.count})`,
      }),
    ),
  };
}
