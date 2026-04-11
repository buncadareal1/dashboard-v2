import { sql, inArray, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { projects, leads, stages } from "@/db/schema";
import { getAccessibleProjectIds } from "@/lib/auth/guards";
import type { UserRole } from "@/db/schema";

/**
 * Load filter options cho Report Data — scoped theo RBAC + selected project.
 */
export async function getReportFilterOptions(params: {
  userId: string;
  role: UserRole;
  projectId?: string;
}) {
  const accessible = await getAccessibleProjectIds(params.userId, params.role);

  // Projects list (always show all accessible)
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

  // Stage counts — scoped by selected project (if any)
  const leadConditions = [];

  if (params.projectId) {
    // Specific project selected — count only leads in this project
    leadConditions.push(eq(leads.projectId, params.projectId));
  } else if (accessible !== null) {
    if (accessible.length === 0) {
      return {
        projects: projectRows.map((r) => ({ value: r.id, label: r.name })),
        stages: [],
      };
    }
    leadConditions.push(inArray(leads.projectId, accessible));
  }

  const scopeWhere = leadConditions.length > 0 ? and(...leadConditions) : undefined;

  const stageRows = await db
    .select({
      code: stages.code,
      label: stages.labelVi,
      count: sql<number>`count(*)::int`,
    })
    .from(leads)
    .innerJoin(stages, eq(leads.currentStageId, stages.id))
    .where(scopeWhere)
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
