import { Hono } from "hono";
import {
  eq,
  and,
  sql,
  desc,
  isNull,
  like,
  or,
  inArray,
} from "drizzle-orm";
import { db } from "@dashboard/db";
import {
  projects,
  projectUsers,
  projectFanpages,
  fanpages,
  leads,
  stages,
  projectCosts,
  users,
  campaigns,
  ads,
  adsets,
  csvUploads,
} from "@dashboard/db/schema";
import { getAccessibleProjectIds } from "../middleware/rbac.js";
import type { AuthUser } from "../middleware/auth.js";

type Env = { Variables: { user: AuthUser } };
const app = new Hono<Env>();

/**
 * GET /api/projects — list projects (scoped by RBAC)
 * Query: ?status=running&search=keyword
 */
app.get("/", async (c) => {
  const user = c.get("user");
  const status = c.req.query("status") as "running" | "warning" | "paused" | undefined;
  const search = c.req.query("search")?.slice(0, 200);

  const accessibleIds = await getAccessibleProjectIds(user.id, user.role);

  const whereConditions = [isNull(projects.deletedAt)];
  if (status) whereConditions.push(eq(projects.status, status));
  if (search) {
    whereConditions.push(
      or(
        like(projects.name, `%${search}%`),
        like(projects.location, `%${search}%`),
      )!,
    );
  }
  if (accessibleIds !== null) {
    if (accessibleIds.length === 0) return c.json({ data: [] });
    whereConditions.push(inArray(projects.id, accessibleIds));
  }

  const projectRows = await db
    .select()
    .from(projects)
    .where(and(...whereConditions))
    .orderBy(desc(projects.createdAt));

  if (projectRows.length === 0) return c.json({ data: [] });

  const projectIds = projectRows.map((p) => p.id);

  const [leadStats, costRows, managerRows, fpRows] = await Promise.all([
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

    db
      .select({
        projectId: projectCosts.projectId,
        totalCost: sql<number>`coalesce(sum(${projectCosts.amount}), 0)::float`,
      })
      .from(projectCosts)
      .where(inArray(projectCosts.projectId, projectIds))
      .groupBy(projectCosts.projectId),

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

    db
      .select({
        projectId: projectFanpages.projectId,
        name: fanpages.name,
      })
      .from(projectFanpages)
      .innerJoin(fanpages, eq(projectFanpages.fanpageId, fanpages.id))
      .where(inArray(projectFanpages.projectId, projectIds)),
  ]);

  const managerMap = new Map<string, { id: string; name: string | null; email: string }>();
  for (const r of managerRows) {
    const existing = managerMap.get(r.projectId);
    if (!existing || r.canEdit) {
      managerMap.set(r.projectId, { id: r.userId, name: r.name, email: r.email });
    }
  }

  const statsMap = new Map(leadStats.map((r) => [r.projectId, r]));
  const costMap = new Map(costRows.map((r) => [r.projectId, r.totalCost]));
  const fpMap = new Map<string, string[]>();
  for (const r of fpRows) {
    const arr = fpMap.get(r.projectId) ?? [];
    arr.push(r.name);
    fpMap.set(r.projectId, arr);
  }

  const data = projectRows.map((p) => {
    const stats = statsMap.get(p.id) ?? { totalLead: 0, leadF1: 0, booking: 0 };
    const totalCost = costMap.get(p.id) ?? (p.budget ? parseFloat(p.budget) : 0);
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
      conversionRate: stats.totalLead > 0 ? stats.leadF1 / stats.totalLead : 0,
      booking: stats.booking,
      manager: managerMap.get(p.id) ?? null,
      fanpages: fpMap.get(p.id) ?? [],
    };
  });

  return c.json({ data });
});

/**
 * GET /api/projects/overview — dashboard overview stats
 */
app.get("/overview", async (c) => {
  const user = c.get("user");
  const accessibleIds = await getAccessibleProjectIds(user.id, user.role);

  const whereProject =
    accessibleIds === null
      ? isNull(projects.deletedAt)
      : accessibleIds.length === 0
        ? sql`false`
        : and(isNull(projects.deletedAt), inArray(projects.id, accessibleIds));

  const whereLead =
    accessibleIds === null
      ? sql`true`
      : accessibleIds.length === 0
        ? sql`false`
        : inArray(leads.projectId, accessibleIds);

  const whereCost =
    accessibleIds === null
      ? sql`true`
      : accessibleIds.length === 0
        ? sql`false`
        : inArray(projectCosts.projectId, accessibleIds);

  const [projectCount, leadStats, costStats] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(projects).where(whereProject),
    db
      .select({
        totalLead: sql<number>`count(*)::int`,
        totalF1: sql<number>`count(*) filter (where ${stages.code} = 'F1')::int`,
        totalBooking: sql<number>`count(*) filter (where ${stages.code} = 'BOOKING')::int`,
      })
      .from(leads)
      .leftJoin(stages, eq(leads.currentStageId, stages.id))
      .where(whereLead),
    db
      .select({ totalCost: sql<number>`coalesce(sum(${projectCosts.amount}), 0)::float` })
      .from(projectCosts)
      .where(whereCost),
  ]);

  return c.json({
    data: {
      totalProjects: projectCount[0]!.count,
      totalCost: costStats[0]!.totalCost,
      totalLead: leadStats[0]!.totalLead,
      totalF1: leadStats[0]!.totalF1,
      totalBooking: leadStats[0]!.totalBooking,
    },
  });
});

/**
 * RBAC check for slug-based routes — verify user can access the project.
 */
async function assertSlugAccess(
  user: AuthUser,
  projectId: string,
): Promise<boolean> {
  const accessibleIds = await getAccessibleProjectIds(user.id, user.role);
  return accessibleIds === null || accessibleIds.includes(projectId);
}

/**
 * GET /api/projects/:slug — project detail + stats
 */
app.get("/:slug", async (c) => {
  const user = c.get("user");
  const slug = c.req.param("slug");

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.slug, slug), isNull(projects.deletedAt)),
  });
  if (!project) return c.json({ error: "Not found" }, 404);
  if (!(await assertSlugAccess(user, project.id))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const [stats, costRows] = await Promise.all([
    db
      .select({
        totalLead: sql<number>`count(*)::int`,
        leadF1: sql<number>`count(*) filter (where ${stages.code} = 'F1')::int`,
        booking: sql<number>`count(*) filter (where ${stages.code} = 'BOOKING')::int`,
      })
      .from(leads)
      .leftJoin(stages, eq(leads.currentStageId, stages.id))
      .where(eq(leads.projectId, project.id)),
    db
      .select({ totalCost: sql<number>`coalesce(sum(${projectCosts.amount}), 0)::float` })
      .from(projectCosts)
      .where(eq(projectCosts.projectId, project.id)),
  ]);

  const s = stats[0]!;
  const summedCost = costRows[0]?.totalCost ?? 0;
  const budget = summedCost > 0 ? summedCost : project.budget ? parseFloat(project.budget) : 0;

  return c.json({
    data: {
      id: project.id,
      slug: project.slug,
      name: project.name,
      location: project.location,
      status: project.status,
      budget,
      totalLead: s.totalLead,
      cpl: s.totalLead > 0 ? budget / s.totalLead : 0,
      leadF1: s.leadF1,
      f1Rate: s.totalLead > 0 ? s.leadF1 / s.totalLead : 0,
      booking: s.booking,
    },
  });
});

/**
 * GET /api/projects/:slug/campaigns — campaign stats
 */
app.get("/:slug/campaigns", async (c) => {
  const user = c.get("user");
  const slug = c.req.param("slug");
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.slug, slug), isNull(projects.deletedAt)),
  });
  if (!project) return c.json({ error: "Not found" }, 404);
  if (!(await assertSlugAccess(user, project.id))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const rows = await db
    .select({
      campaignId: campaigns.id,
      name: campaigns.name,
      statusLabel: campaigns.statusLabel,
      totalLead: sql<number>`count(${leads.id})::int`,
      leadF1: sql<number>`count(${leads.id}) filter (where ${stages.code} = 'F1')::int`,
      leadDangCham: sql<number>`count(${leads.id}) filter (where ${stages.code} = 'DANG_CHAM')::int`,
    })
    .from(campaigns)
    .leftJoin(leads, eq(leads.campaignId, campaigns.id))
    .leftJoin(stages, eq(leads.currentStageId, stages.id))
    .where(eq(campaigns.projectId, project.id))
    .groupBy(campaigns.id, campaigns.name, campaigns.statusLabel)
    .orderBy(desc(sql`count(${leads.id})`));

  const data = rows.map((r) => ({
    ...r,
    qualifyRate: r.totalLead > 0 ? r.leadF1 / r.totalLead : 0,
  }));

  return c.json({ data });
});

/**
 * GET /api/projects/:slug/ads — ad creative stats
 */
app.get("/:slug/ads", async (c) => {
  const user = c.get("user");
  const slug = c.req.param("slug");
  const sortParam = c.req.query("sort") ?? "f1";
  const sortBy = (["f1", "booking", "lead"].includes(sortParam) ? sortParam : "f1") as "f1" | "booking" | "lead";

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.slug, slug), isNull(projects.deletedAt)),
  });
  if (!project) return c.json({ error: "Not found" }, 404);
  if (!(await assertSlugAccess(user, project.id))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const rows = await db
    .select({
      name: ads.name,
      formName: sql<string | null>`min(${ads.formName})`,
      totalLead: sql<number>`count(${leads.id})::int`,
      leadF1: sql<number>`count(${leads.id}) filter (where ${stages.code} = 'F1')::int`,
      booking: sql<number>`count(${leads.id}) filter (where ${stages.code} = 'BOOKING')::int`,
      instanceCount: sql<number>`count(DISTINCT ${ads.id})::int`,
    })
    .from(ads)
    .leftJoin(leads, eq(leads.adId, ads.id))
    .leftJoin(stages, eq(leads.currentStageId, stages.id))
    .where(eq(ads.projectId, project.id))
    .groupBy(ads.name);

  const data = rows
    .map((r) => {
      const score = r.totalLead > 0
        ? Math.min(100, Math.round(((r.leadF1 * 3 + r.booking * 10) / r.totalLead) * 25))
        : 0;
      const scoreLabel =
        score >= 90 ? "Xuất sắc" : score >= 75 ? "Tốt" : score >= 60 ? "Khá" : "Cần cải thiện";
      return { ...r, score, scoreLabel };
    })
    .sort((a, b) => {
      if (sortBy === "f1") return b.leadF1 - a.leadF1;
      if (sortBy === "booking") return b.booking - a.booking;
      return b.totalLead - a.totalLead;
    });

  return c.json({ data });
});

/**
 * GET /api/projects/:slug/uploads — upload history for a project
 * Query: ?limit=10
 */
app.get("/:slug/uploads", async (c) => {
  const user = c.get("user");
  const slug = c.req.param("slug");
  const limitParam = c.req.query("limit");
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 100) : 10;

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.slug, slug), isNull(projects.deletedAt)),
  });
  if (!project) return c.json({ error: "Not found" }, 404);
  if (!(await assertSlugAccess(user, project.id))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const rows = await db
    .select({
      id: csvUploads.id,
      type: csvUploads.type,
      filename: csvUploads.filename,
      status: csvUploads.status,
      rowCount: csvUploads.rowCount,
      parsedCount: csvUploads.parsedCount,
      errorCount: csvUploads.errorCount,
      createdAt: csvUploads.createdAt,
      finishedAt: csvUploads.finishedAt,
    })
    .from(csvUploads)
    .where(eq(csvUploads.projectId, project.id))
    .orderBy(desc(csvUploads.createdAt))
    .limit(limit);

  return c.json({ data: rows });
});

export default app;
