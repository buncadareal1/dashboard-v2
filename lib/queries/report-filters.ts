import { sql, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { projects, leads, stages, sources } from "@/db/schema";
import { getAccessibleProjectIds } from "@/lib/auth/guards";
import type { UserRole } from "@/db/schema";

/**
 * Load filter options cho Report Data — scoped theo RBAC.
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

  // Distinct fanpage names from leads (campaign name as proxy)
  const fanpageScope =
    accessible === null ? sql`true` : accessible.length === 0 ? sql`false` : inArray(leads.projectId, accessible);

  const fanpageRows = await db
    .selectDistinct({ name: sql<string>`coalesce(${leads.formName}, 'Không xác định')` })
    .from(leads)
    .where(fanpageScope)
    .orderBy(sql`1`)
    .limit(50);

  // Sources
  const sourceRows = await db
    .select({ id: sources.id, name: sources.name })
    .from(sources)
    .orderBy(sources.name);

  // Stages
  const stageRows = await db
    .select({ code: stages.code, label: stages.labelVi })
    .from(stages)
    .orderBy(stages.displayOrder);

  return {
    projects: projectRows.map((r) => ({ value: r.id, label: r.name })),
    fanpages: fanpageRows
      .map((r) => ({ value: r.name, label: r.name }))
      .filter((r) => r.value !== "Không xác định"),
    sources: sourceRows.map((r) => ({ value: r.id, label: r.name })),
    stages: stageRows.map((r) => ({ value: r.code, label: r.label })),
  };
}
