import { Hono } from "hono";
import { eq, and, sql, desc, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@dashboard/db";
import {
  leads,
  stages,
  projects,
  fanpages,
  sources,
  campaigns,
  adsets,
  ads,
  employees,
} from "@dashboard/db/schema";
import { getAccessibleProjectIds, scopeProjectIds } from "../middleware/rbac.js";
import type { AuthUser } from "../middleware/auth.js";

type Env = { Variables: { user: AuthUser } };
const app = new Hono<Env>();

const VALID_PERIODS = new Set(["7d", "30d", "90d"]);

const QueryParamsSchema = z.object({
  projectIds: z.string().optional(),
  stageCode: z.string().max(50).regex(/^[A-Z0-9_]+$/).optional(),
  period: z.enum(["7d", "30d", "90d"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

function periodToCutoff(period: string): Date | null {
  const now = Date.now();
  switch (period) {
    case "7d": return new Date(now - 7 * 86400000);
    case "30d": return new Date(now - 30 * 86400000);
    case "90d": return new Date(now - 90 * 86400000);
    default: return null;
  }
}

/**
 * GET /api/leads/stats — report stat cards
 * Query: ?projectIds=id1,id2&stageCode=F1&period=30d
 */
app.get("/stats", async (c) => {
  const user = c.get("user");
  const raw = QueryParamsSchema.safeParse(c.req.query());
  if (!raw.success) return c.json({ error: "Invalid query params" }, 400);
  const projectIdsParam = raw.data.projectIds?.split(",").filter(Boolean);
  const stageCode = raw.data.stageCode;
  const period = raw.data.period;

  const accessible = await getAccessibleProjectIds(user.id, user.role);
  const scope = scopeProjectIds(projectIdsParam, accessible);

  if (scope !== null && scope.length === 0) {
    return c.json({ data: { totalLead: 0, f1: 0, dangCham: 0, booking: 0, deal: 0 } });
  }

  const conditions = [];
  if (scope) conditions.push(inArray(leads.projectId, scope));
  if (stageCode) conditions.push(eq(stages.code, stageCode));
  if (period) {
    const cutoff = periodToCutoff(period);
    if (cutoff) conditions.push(sql`${leads.fbCreatedAt} >= ${cutoff}`);
  }
  const where = conditions.length > 0 ? and(...conditions) : sql`true`;

  const result = await db
    .select({
      totalLead: sql<number>`count(*)::int`,
      f1: sql<number>`count(*) filter (where ${stages.code} = 'F1')::int`,
      dangCham: sql<number>`count(*) filter (where ${stages.code} = 'DANG_CHAM')::int`,
      booking: sql<number>`count(*) filter (where ${stages.code} = 'BOOKING')::int`,
      deal: sql<number>`count(*) filter (where ${stages.code} = 'DA_MUA')::int`,
    })
    .from(leads)
    .leftJoin(stages, eq(leads.currentStageId, stages.id))
    .where(where);

  return c.json({ data: result[0] });
});

/**
 * GET /api/leads — paginated lead detail
 * Query: ?projectIds=&stageCode=&period=&page=1&pageSize=50
 */
app.get("/", async (c) => {
  const user = c.get("user");
  const raw = QueryParamsSchema.safeParse(c.req.query());
  if (!raw.success) return c.json({ error: "Invalid query params" }, 400);
  const projectIdsParam = raw.data.projectIds?.split(",").filter(Boolean);
  const stageCode = raw.data.stageCode;
  const period = raw.data.period;
  const page = raw.data.page ?? 1;
  const pageSize = raw.data.pageSize ?? 50;

  const accessible = await getAccessibleProjectIds(user.id, user.role);
  const scope = scopeProjectIds(projectIdsParam, accessible);
  if (scope !== null && scope.length === 0) {
    return c.json({ data: { rows: [], total: 0 } });
  }

  const conditions = [];
  if (scope) conditions.push(inArray(leads.projectId, scope));
  if (stageCode) conditions.push(eq(stages.code, stageCode));
  if (period) {
    const cutoff = periodToCutoff(period);
    if (cutoff) conditions.push(sql`${leads.fbCreatedAt} >= ${cutoff}`);
  }
  const where = conditions.length > 0 ? and(...conditions) : sql`true`;
  const offset = (page - 1) * pageSize;

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: leads.id,
        fullName: leads.fullName,
        email: leads.email,
        stageLabel: stages.labelVi,
        stageColor: stages.color,
        projectName: projects.name,
        fanpageName: fanpages.name,
        campaignName: campaigns.name,
        adsetName: adsets.name,
        adName: ads.name,
        formName: leads.formName,
        fbLeadId: leads.fbLeadId,
        sourceName: sources.name,
        fbCreatedAt: leads.fbCreatedAt,
        updatedAt: leads.updatedAt,
      })
      .from(leads)
      .leftJoin(stages, eq(leads.currentStageId, stages.id))
      .innerJoin(projects, eq(leads.projectId, projects.id))
      .leftJoin(fanpages, eq(leads.fanpageId, fanpages.id))
      .leftJoin(sources, eq(leads.sourceId, sources.id))
      .leftJoin(campaigns, eq(leads.campaignId, campaigns.id))
      .leftJoin(adsets, eq(leads.adsetId, adsets.id))
      .leftJoin(ads, eq(leads.adId, ads.id))
      .where(where)
      .orderBy(desc(leads.updatedAt), desc(leads.fbCreatedAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .leftJoin(stages, eq(leads.currentStageId, stages.id))
      .where(where),
  ]);

  return c.json({
    data: { rows, total: totalResult[0]!.count },
    meta: { page, pageSize, total: totalResult[0]!.count },
  });
});

/**
 * GET /api/leads/by-date — summary by date (GDDA sub-tab)
 */
app.get("/by-date", async (c) => {
  const user = c.get("user");
  const projectIdsParam = c.req.query("projectIds")?.split(",").filter(Boolean);

  const accessible = await getAccessibleProjectIds(user.id, user.role);
  const scope = scopeProjectIds(projectIdsParam, accessible);
  if (scope !== null && scope.length === 0) return c.json({ data: [] });

  const where = and(
    scope ? inArray(leads.projectId, scope) : sql`true`,
    sql`${leads.fbCreatedAt} IS NOT NULL`,
  );

  const rows = await db
    .select({
      date: sql<string>`to_char(${leads.fbCreatedAt} at time zone 'Asia/Ho_Chi_Minh', 'DD/MM')`,
      totalLead: sql<number>`count(*)::int`,
      f1: sql<number>`count(*) filter (where ${stages.code} = 'F1')::int`,
      dangCham: sql<number>`count(*) filter (where ${stages.code} = 'DANG_CHAM')::int`,
      khongBatMay: sql<number>`count(*) filter (where ${stages.code} = 'KHONG_BAT_MAY')::int`,
      thueBao: sql<number>`count(*) filter (where ${stages.code} = 'THUE_BAO_KLL')::int`,
      chaoDaKhac: sql<number>`count(*) filter (where ${stages.code} = 'CHAO_DA_KHAC')::int`,
      moiGioi: sql<number>`count(*) filter (where ${stages.code} = 'MOI_GIOI')::int`,
      khac: sql<number>`count(*) filter (where ${stages.code} NOT IN ('F1','DANG_CHAM','KHONG_BAT_MAY','THUE_BAO_KLL','CHAO_DA_KHAC','MOI_GIOI') OR ${stages.code} IS NULL)::int`,
    })
    .from(leads)
    .leftJoin(stages, eq(leads.currentStageId, stages.id))
    .where(where)
    .groupBy(sql`to_char(${leads.fbCreatedAt} at time zone 'Asia/Ho_Chi_Minh', 'DD/MM')`)
    .orderBy(sql`to_char(${leads.fbCreatedAt} at time zone 'Asia/Ho_Chi_Minh', 'DD/MM')`);

  const data = rows.map((r) => ({
    ...r,
    f1Rate: r.totalLead > 0 ? r.f1 / r.totalLead : 0,
  }));

  return c.json({ data });
});

/**
 * GET /api/leads/by-employee — group by employee (GDDA sub-tab)
 */
app.get("/by-employee", async (c) => {
  const user = c.get("user");
  const projectIdsParam = c.req.query("projectIds")?.split(",").filter(Boolean);

  const accessible = await getAccessibleProjectIds(user.id, user.role);
  const scope = scopeProjectIds(projectIdsParam, accessible);
  if (scope !== null && scope.length === 0) return c.json({ data: [] });

  const where = and(
    scope ? inArray(leads.projectId, scope) : sql`true`,
    sql`${leads.currentEmployeeId} IS NOT NULL`,
  );

  const rows = await db
    .select({
      employeeName: employees.fullName,
      totalLead: sql<number>`count(*)::int`,
      f1: sql<number>`count(*) filter (where ${stages.code} = 'F1')::int`,
      dangCham: sql<number>`count(*) filter (where ${stages.code} = 'DANG_CHAM')::int`,
      thueBao: sql<number>`count(*) filter (where ${stages.code} = 'THUE_BAO_KLL')::int`,
      khongBatMay: sql<number>`count(*) filter (where ${stages.code} = 'KHONG_BAT_MAY')::int`,
    })
    .from(leads)
    .innerJoin(employees, eq(leads.currentEmployeeId, employees.id))
    .leftJoin(stages, eq(leads.currentStageId, stages.id))
    .where(where)
    .groupBy(employees.id, employees.fullName)
    .orderBy(desc(sql`count(*)`));

  return c.json({ data: rows });
});

/**
 * GET /api/leads/by-fanpage — group leads by campaign name (proxy for fanpage)
 * Query: ?projectIds=id1,id2
 */
app.get("/by-fanpage", async (c) => {
  const user = c.get("user");
  const projectIdsParam = c.req.query("projectIds")?.split(",").filter(Boolean);

  const accessible = await getAccessibleProjectIds(user.id, user.role);
  const scope = scopeProjectIds(projectIdsParam, accessible);
  if (scope !== null && scope.length === 0) return c.json({ data: [] });

  const where = scope ? inArray(leads.projectId, scope) : sql`true`;

  const rows = await db
    .select({
      fanpageName: campaigns.name,
      totalLead: sql<number>`count(*)::int`,
    })
    .from(leads)
    .leftJoin(campaigns, eq(leads.campaignId, campaigns.id))
    .where(where)
    .groupBy(campaigns.id, campaigns.name)
    .orderBy(desc(sql`count(*)`));

  const total = rows.reduce((s, r) => s + r.totalLead, 0);
  const data = rows.map((r) => ({
    fanpageName: r.fanpageName ?? "(không xác định)",
    totalLead: r.totalLead,
    percentage: total > 0 ? r.totalLead / total : 0,
  }));

  return c.json({ data });
});

/**
 * GET /api/leads/filters — filter options (projects + stages with counts), scoped by RBAC
 */
app.get("/filters", async (c) => {
  const user = c.get("user");
  const accessible = await getAccessibleProjectIds(user.id, user.role);

  const projectRows =
    accessible === null
      ? await db
          .select({ id: projects.id, name: projects.name })
          .from(projects)
          .where(isNull(projects.deletedAt))
          .orderBy(projects.name)
      : accessible.length === 0
        ? []
        : await db
            .select({ id: projects.id, name: projects.name })
            .from(projects)
            .where(inArray(projects.id, accessible))
            .orderBy(projects.name);

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

  return c.json({
    data: {
      projects: projectRows.map((r) => ({ value: r.id, label: r.name })),
      stages: stageRows.map((r) => ({ value: r.code, label: `${r.label} (${r.count})` })),
    },
  });
});

export default app;
