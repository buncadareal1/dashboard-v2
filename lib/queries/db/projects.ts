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
  users,
  campaigns,
  campaignInsights,
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

  // 4 queries SONG SONG — thay vì serial (tiết kiệm ~200-400ms)
  const [leadStats, costRows, fbSpendRows, managerRows, fpRows] = await Promise.all([
    // Lead stats
    db
      .select({
        projectId: leads.projectId,
        totalLead: sql<number>`count(*)::int`,
        leadF1: sql<number>`count(*) filter (where ${stages.code} = 'F1')::int`,
        booking: sql<number>`count(*) filter (where ${stages.code} = 'BOOKING')::int`,
      })
      .from(leads)
      .leftJoin(stages, eq(leads.currentStageId, stages.id))
      .where(inArray(leads.projectId, projectIds))
      .groupBy(leads.projectId),

    // Costs from CSV uploads
    db
      .select({
        projectId: projectCosts.projectId,
        totalCost: sql<number>`coalesce(sum(${projectCosts.amount}), 0)::float`,
      })
      .from(projectCosts)
      .where(inArray(projectCosts.projectId, projectIds))
      .groupBy(projectCosts.projectId),

    // Costs from FB Insights (campaign_insights.spend per project)
    db
      .select({
        projectId: campaigns.projectId,
        totalFbSpend: sql<number>`coalesce(sum(${campaignInsights.spend}::numeric), 0)::float`,
      })
      .from(campaignInsights)
      .innerJoin(campaigns, eq(campaignInsights.campaignId, campaigns.id))
      .where(inArray(campaigns.projectId, projectIds))
      .groupBy(campaigns.projectId),

    // Managers
    db
      .select({
        projectId: projectUsers.projectId,
        userId: users.id,
        name: users.name,
        email: users.email,
        canEdit: projectUsers.canEdit,
      })
      .from(projectUsers)
      .innerJoin(users, eq(projectUsers.userId, users.id))
      .where(
        and(
          inArray(projectUsers.projectId, projectIds),
          eq(projectUsers.roleInProject, "digital"),
        ),
      ),

    // Fanpages
    db
      .select({
        projectId: projectFanpages.projectId,
        name: fanpages.name,
      })
      .from(projectFanpages)
      .innerJoin(fanpages, eq(projectFanpages.fanpageId, fanpages.id))
      .where(inArray(projectFanpages.projectId, projectIds)),
  ]);

  const managerMap = new Map<
    string,
    { id: string; name: string | null; email: string }
  >();
  for (const r of managerRows as Array<{
    projectId: string;
    userId: string;
    name: string | null;
    email: string;
    canEdit: boolean;
  }>) {
    const existing = managerMap.get(r.projectId);
    if (!existing || r.canEdit) {
      managerMap.set(r.projectId, {
        id: r.userId,
        name: r.name,
        email: r.email,
      });
    }
  }

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
  // FB spend takes priority over CSV costs when available
  const fbSpendMap = new Map(
    fbSpendRows.map((r: { projectId: string; totalFbSpend: number }) => [
      r.projectId,
      r.totalFbSpend,
    ]),
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
      // Priority: FB Insights spend > CSV project_costs > project.budget
      const fbSpend = (fbSpendMap.get(p.id) as number | undefined) ?? 0;
      const csvCost = (costMap.get(p.id) as number | undefined) ?? 0;
      const totalCost = fbSpend > 0 ? fbSpend : csvCost > 0 ? csvCost : (p.budget ? parseFloat(p.budget) : 0);
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
        manager: managerMap.get(p.id) ?? null,
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

  // FB Insights spend — sum from campaign_insights via campaigns
  const whereFbCampaigns =
    accessibleIds === null
      ? sql`true`
      : accessibleIds.length === 0
        ? sql`false`
        : inArray(campaigns.projectId, accessibleIds);

  const fbSpendStats = await db
    .select({
      totalFbSpend: sql<number>`coalesce(sum(${campaignInsights.spend}::numeric), 0)::float`,
    })
    .from(campaignInsights)
    .innerJoin(campaigns, eq(campaignInsights.campaignId, campaigns.id))
    .where(whereFbCampaigns);

  const stats = leadStats[0] as {
    totalLead: number;
    totalF1: number;
    totalBooking: number;
  };

  const csvCost = (costStats[0] as { totalCost: number }).totalCost;
  const fbSpend = (fbSpendStats[0] as { totalFbSpend: number }).totalFbSpend;

  return {
    totalProjects: (projectCount[0] as { count: number }).count,
    totalCost: fbSpend > 0 ? fbSpend : csvCost,
    totalLead: stats.totalLead,
    totalF1: stats.totalF1,
    totalBooking: stats.totalBooking,
  };
}

// Suppress unused for now
void dailyAggregates;
