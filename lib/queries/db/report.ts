import { eq, and, sql, desc, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
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
} from "@/db/schema";
import { getAccessibleProjectIds } from "@/lib/auth/guards";
import type { UserRole } from "@/db/schema";

/** Convert period filter value to a cutoff Date, or null for "all". */
function periodToCutoff(period: string): Date | null {
  const now = new Date();
  switch (period) {
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

/**
 * Report Data stat cards (cùng dùng cho admin/digital và GDDA).
 */
export type ReportStatCards = {
  totalLead: number;
  f1: number;
  dangCham: number;
  booking: number;
  deal: number;
};

export async function getReportStatCards(params: {
  userId: string;
  role: UserRole;
  projectIds?: string[];
  stageCode?: string;
  period?: string;
}): Promise<ReportStatCards> {
  const accessible = await getAccessibleProjectIds(params.userId, params.role);

  // Scope: admin can see all but still respect explicit projectIds filter
  let scopeIds: string[] | null;
  if (accessible === null) {
    // Admin — use explicit projectIds if provided, otherwise null (all)
    scopeIds = params.projectIds?.length ? params.projectIds : null;
  } else if (accessible.length === 0) {
    return { totalLead: 0, f1: 0, dangCham: 0, booking: 0, deal: 0 };
  } else if (params.projectIds && params.projectIds.length > 0) {
    const set = new Set(accessible);
    scopeIds = params.projectIds.filter((id) => set.has(id));
    if (scopeIds.length === 0) {
      return { totalLead: 0, f1: 0, dangCham: 0, booking: 0, deal: 0 };
    }
  } else {
    scopeIds = accessible;
  }

  const conditions = [];
  if (scopeIds) conditions.push(inArray(leads.projectId, scopeIds));
  if (params.stageCode) conditions.push(eq(stages.code, params.stageCode));
  if (params.period) {
    const cutoff = periodToCutoff(params.period);
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

  return result[0] as ReportStatCards;
}

/**
 * Lead detail row cho bảng admin/digital view.
 */
export type LeadDetailRow = {
  id: string;
  fullName: string;
  email: string | null;
  stageLabel: string | null;
  stageColor: string | null;
  projectName: string;
  fanpageName: string | null;
  campaignName: string | null;
  adsetName: string | null;
  adName: string | null;
  formName: string | null;
  fbLeadId: string | null;
  sourceName: string | null;
  fbCreatedAt: Date | null;
};

export async function getLeadDetail(params: {
  userId: string;
  role: UserRole;
  projectIds?: string[];
  stageCode?: string;
  period?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: LeadDetailRow[]; total: number }> {
  const accessible = await getAccessibleProjectIds(params.userId, params.role);
  const scope =
    accessible === null
      ? (params.projectIds?.length ? params.projectIds : null) // admin: respect explicit filter
      : params.projectIds && params.projectIds.length > 0
        ? params.projectIds.filter((id) => new Set(accessible).has(id))
        : accessible;

  if (scope !== null && scope.length === 0) return { rows: [], total: 0 };

  const conditions = [];
  if (scope) conditions.push(inArray(leads.projectId, scope));
  if (params.stageCode) conditions.push(eq(stages.code, params.stageCode));
  if (params.period) {
    const cutoff = periodToCutoff(params.period);
    if (cutoff) conditions.push(sql`${leads.fbCreatedAt} >= ${cutoff}`);
  }
  const where = conditions.length > 0 ? and(...conditions) : sql`true`;
  const pageSize = params.pageSize ?? 50;
  const offset = ((params.page ?? 1) - 1) * pageSize;

  // Rows + count SONG SONG (tiết kiệm ~80-150ms)
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

  return {
    rows: rows as LeadDetailRow[],
    total: (totalResult[0] as { count: number }).count,
  };
}

/**
 * Tóm tắt theo ngày (GDDA sub-tab).
 */
export type SummaryByDateRow = {
  date: string;
  totalLead: number;
  f1: number;
  dangCham: number;
  khongBatMay: number;
  thueBao: number;
  chaoDaKhac: number;
  moiGioi: number;
  khac: number;
  f1Rate: number;
};

export async function getSummaryByDate(params: {
  userId: string;
  role: UserRole;
  projectIds?: string[];
}): Promise<SummaryByDateRow[]> {
  const accessible = await getAccessibleProjectIds(params.userId, params.role);
  const scope =
    accessible === null
      ? (params.projectIds?.length ? params.projectIds : null)
      : params.projectIds && params.projectIds.length > 0
        ? params.projectIds.filter((id) => new Set(accessible).has(id))
        : accessible;
  if (scope !== null && scope.length === 0) return [];

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

  return rows.map(
    (r: Omit<SummaryByDateRow, "f1Rate">) => ({
      ...r,
      f1Rate: r.totalLead > 0 ? r.f1 / r.totalLead : 0,
    }),
  );
}

/**
 * Theo nhân viên (GDDA sub-tab).
 */
export type ByEmployeeRow = {
  employeeName: string;
  totalLead: number;
  f1: number;
  dangCham: number;
  thueBao: number;
  khongBatMay: number;
};

export async function getByEmployee(params: {
  userId: string;
  role: UserRole;
  projectIds?: string[];
}): Promise<ByEmployeeRow[]> {
  const accessible = await getAccessibleProjectIds(params.userId, params.role);
  const scope =
    accessible === null
      ? (params.projectIds?.length ? params.projectIds : null)
      : params.projectIds && params.projectIds.length > 0
        ? params.projectIds.filter((id) => new Set(accessible).has(id))
        : accessible;
  if (scope !== null && scope.length === 0) return [];

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

  return rows as ByEmployeeRow[];
}

/**
 * Theo nguồn / fanpage (GDDA sub-tab).
 */
export type ByFanpageRow = {
  fanpageName: string;
  totalLead: number;
  percentage: number;
};

export async function getByFanpage(params: {
  userId: string;
  role: UserRole;
  projectIds?: string[];
}): Promise<ByFanpageRow[]> {
  const accessible = await getAccessibleProjectIds(params.userId, params.role);
  const scope =
    accessible === null
      ? (params.projectIds?.length ? params.projectIds : null)
      : params.projectIds && params.projectIds.length > 0
        ? params.projectIds.filter((id) => new Set(accessible).has(id))
        : accessible;
  if (scope !== null && scope.length === 0) return [];

  // Group leads theo campaign name (proxy cho fanpage vì FB CSV không có fanpage)
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

  const total = rows.reduce(
    (s: number, r: { totalLead: number }) => s + r.totalLead,
    0,
  );
  return rows.map(
    (r: { fanpageName: string | null; totalLead: number }) => ({
      fanpageName: r.fanpageName ?? "(không xác định)",
      totalLead: r.totalLead,
      percentage: total > 0 ? r.totalLead / total : 0,
    }),
  );
}

void isNull;
