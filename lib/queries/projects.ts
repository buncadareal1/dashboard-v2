import { eq, and, sql, desc, isNull, like, or, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  projects,
  projectUsers,
  projectFanpages,
  fanpages,
  leads,
  stages,
  dailyAggregates,
  projectCosts,
} from "@/db/schema";
import { getAccessibleProjectIds } from "@/lib/auth/guards";
import type { UserRole } from "@/db/schema";

/**
 * Card data cho 1 project trong list view + dashboard overview.
 */
export type ProjectCardData = {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  status: "running" | "warning" | "paused";
  budget: number;
  totalLead: number;
  cpl: number; // budget / totalLead
  leadF1: number;
  conversionRate: number; // leadF1 / totalLead
  booking: number;
  manager: { id: string; name: string | null; email: string } | null;
  fanpages: string[]; // tên fanpages
};

/**
 * Lấy list dự án scope theo user (admin = all, digital = can_view).
 * Join với daily_aggregates để metric nhanh.
 */
export async function getProjectsForUser(params: {
  userId: string;
  role: UserRole;
  status?: "running" | "warning" | "paused";
  search?: string;
}): Promise<ProjectCardData[]> {
  const accessibleIds = await getAccessibleProjectIds(params.userId, params.role);

  // Build where clause
  const whereConditions = [isNull(projects.deletedAt)];
  if (params.status) whereConditions.push(eq(projects.status, params.status));
  if (params.search) {
    whereConditions.push(
      or(
        like(projects.name, `%${params.search}%`),
        like(projects.location, `%${params.search}%`),
      )!,
    );
  }
  if (accessibleIds !== null) {
    if (accessibleIds.length === 0) return [];
    whereConditions.push(inArray(projects.id, accessibleIds));
  }

  const projectRows = await db
    .select()
    .from(projects)
    .where(and(...whereConditions))
    .orderBy(desc(projects.createdAt));

  if (projectRows.length === 0) return [];

  const projectIds = projectRows.map((p: { id: string }) => p.id);

  // Aggregate metrics: tổng lead, F1, booking per project
  // Dùng leads trực tiếp vì daily_aggregates có thể stale
  const leadStats = await db
    .select({
      projectId: leads.projectId,
      totalLead: sql<number>`count(*)::int`,
      leadF1: sql<number>`count(*) filter (where ${stages.code} = 'F1')::int`,
      booking: sql<number>`count(*) filter (where ${stages.code} = 'BOOKING')::int`,
    })
    .from(leads)
    .leftJoin(stages, eq(leads.currentStageId, stages.id))
    .where(inArray(leads.projectId, projectIds))
    .groupBy(leads.projectId);

  // Costs: sum amount per project
  const costRows = await db
    .select({
      projectId: projectCosts.projectId,
      totalCost: sql<number>`coalesce(sum(${projectCosts.amount}), 0)::float`,
    })
    .from(projectCosts)
    .where(inArray(projectCosts.projectId, projectIds))
    .groupBy(projectCosts.projectId);

  // Fanpages per project
  const fpRows = await db
    .select({
      projectId: projectFanpages.projectId,
      name: fanpages.name,
    })
    .from(projectFanpages)
    .innerJoin(fanpages, eq(projectFanpages.fanpageId, fanpages.id))
    .where(inArray(projectFanpages.projectId, projectIds));

  // Maps for O(1) lookup
  const statsMap = new Map(
    leadStats.map(
      (r: {
        projectId: string;
        totalLead: number;
        leadF1: number;
        booking: number;
      }) => [r.projectId, r],
    ),
  );
  const costMap = new Map(
    costRows.map((r: { projectId: string; totalCost: number }) => [
      r.projectId,
      r.totalCost,
    ]),
  );
  const fpMap = new Map<string, string[]>();
  for (const r of fpRows as Array<{ projectId: string; name: string }>) {
    const arr = fpMap.get(r.projectId) ?? [];
    arr.push(r.name);
    fpMap.set(r.projectId, arr);
  }

  return projectRows.map(
    (p: {
      id: string;
      slug: string;
      name: string;
      location: string | null;
      status: "running" | "warning" | "paused";
      budget: string | null;
    }) => {
      const stats = (statsMap.get(p.id) as
        | { totalLead: number; leadF1: number; booking: number }
        | undefined) ?? { totalLead: 0, leadF1: 0, booking: 0 };
      const totalCost =
        (costMap.get(p.id) as number | undefined) ??
        (p.budget ? parseFloat(p.budget) : 0);
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        location: p.location,
        status: p.status,
        budget: totalCost,
        totalLead: stats.totalLead,
        cpl: stats.totalLead > 0 ? totalCost / stats.totalLead : 0,
        leadF1: stats.leadF1,
        conversionRate:
          stats.totalLead > 0 ? stats.leadF1 / stats.totalLead : 0,
        booking: stats.booking,
        manager: null, // TODO: join project_users primary digital
        fanpages: fpMap.get(p.id) ?? [],
      };
    },
  );
}

/**
 * Stat cards cho Dashboard Overview.
 */
export type DashboardOverviewStats = {
  totalProjects: number;
  totalCost: number;
  totalLead: number;
  totalF1: number;
  totalBooking: number;
};

export async function getDashboardOverviewStats(params: {
  userId: string;
  role: UserRole;
}): Promise<DashboardOverviewStats> {
  const accessibleIds = await getAccessibleProjectIds(params.userId, params.role);

  const whereProject =
    accessibleIds === null
      ? isNull(projects.deletedAt)
      : accessibleIds.length === 0
        ? sql`false`
        : and(
            isNull(projects.deletedAt),
            inArray(projects.id, accessibleIds),
            eq(projects.status, "running"),
          );

  const projectCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projects)
    .where(whereProject);

  // Lead stats — chỉ count lead trong các project user xem được
  const whereLead =
    accessibleIds === null
      ? sql`true`
      : accessibleIds.length === 0
        ? sql`false`
        : inArray(leads.projectId, accessibleIds);

  const leadStats = await db
    .select({
      totalLead: sql<number>`count(*)::int`,
      totalF1: sql<number>`count(*) filter (where ${stages.code} = 'F1')::int`,
      totalBooking: sql<number>`count(*) filter (where ${stages.code} = 'BOOKING')::int`,
    })
    .from(leads)
    .leftJoin(stages, eq(leads.currentStageId, stages.id))
    .where(whereLead);

  const whereCost =
    accessibleIds === null
      ? sql`true`
      : accessibleIds.length === 0
        ? sql`false`
        : inArray(projectCosts.projectId, accessibleIds);

  const costStats = await db
    .select({
      totalCost: sql<number>`coalesce(sum(${projectCosts.amount}), 0)::float`,
    })
    .from(projectCosts)
    .where(whereCost);

  const stats = leadStats[0] as {
    totalLead: number;
    totalF1: number;
    totalBooking: number;
  };

  return {
    totalProjects: (projectCount[0] as { count: number }).count,
    totalCost: (costStats[0] as { totalCost: number }).totalCost,
    totalLead: stats.totalLead,
    totalF1: stats.totalF1,
    totalBooking: stats.totalBooking,
  };
}

// Suppress unused for now
void dailyAggregates;
void projectUsers;
