import { eq, and, sql, isNull, desc } from "drizzle-orm";
import { db } from "@/db";
import { projects, leads, stages, campaigns, ads, projectCosts, campaignInsights } from "@/db/schema";

/**
 * Get project full details + stat cards (Ngân sách, Tổng Lead, CPL, F1 Rate).
 */
export type ProjectDetail = {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  status: "running" | "warning" | "paused";
  budget: number;
  totalLead: number;
  cpl: number;
  leadF1: number;
  f1Rate: number;
  booking: number;
};

export async function getProjectDetailBySlug(
  slug: string,
): Promise<ProjectDetail | null> {
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.slug, slug), isNull(projects.deletedAt)),
  });
  if (!project) return null;

  const stats = await db
    .select({
      totalLead: sql<number>`count(*)::int`,
      leadF1: sql<number>`count(*) filter (where ${stages.code} = 'F1')::int`,
      booking: sql<number>`count(*) filter (where ${stages.code} = 'BOOKING')::int`,
    })
    .from(leads)
    .leftJoin(stages, eq(leads.currentStageId, stages.id))
    .where(eq(leads.projectId, project.id));

  const s = stats[0] as { totalLead: number; leadF1: number; booking: number };

  const [costRows, fbSpendRows] = await Promise.all([
    db
      .select({ totalCost: sql<number>`coalesce(sum(${projectCosts.amount}), 0)::float` })
      .from(projectCosts)
      .where(eq(projectCosts.projectId, project.id)),
    db
      .select({ totalFbSpend: sql<number>`coalesce(sum(${campaignInsights.spend}::numeric), 0)::float` })
      .from(campaignInsights)
      .innerJoin(campaigns, eq(campaignInsights.campaignId, campaigns.id))
      .where(eq(campaigns.projectId, project.id)),
  ]);
  const csvCost = (costRows[0] as { totalCost: number } | undefined)?.totalCost ?? 0;
  const fbSpend = (fbSpendRows[0] as { totalFbSpend: number } | undefined)?.totalFbSpend ?? 0;
  const budget = fbSpend > 0 ? fbSpend : csvCost > 0 ? csvCost : (project.budget ? parseFloat(project.budget) : 0);

  return {
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
  };
}

/**
 * Campaign stats — group leads theo campaign trong project.
 */
export type CampaignStat = {
  campaignId: string;
  name: string;
  statusLabel: "on" | "off";
  totalLead: number;
  leadF1: number;
  leadDangCham: number;
  qualifyRate: number;
};

export async function getCampaignStats(
  projectId: string,
): Promise<CampaignStat[]> {
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
    .where(eq(campaigns.projectId, projectId))
    .groupBy(campaigns.id, campaigns.name, campaigns.statusLabel)
    .orderBy(desc(sql`count(${leads.id})`));

  return rows.map(
    (r: {
      campaignId: string;
      name: string;
      statusLabel: "on" | "off";
      totalLead: number;
      leadF1: number;
      leadDangCham: number;
    }) => ({
      ...r,
      qualifyRate: r.totalLead > 0 ? r.leadF1 / r.totalLead : 0,
    }),
  );
}

/**
 * Ad creative stats — rank ads theo F1.
 */
export type AdCreativeStat = {
  name: string;
  formName: string | null;
  totalLead: number;
  leadF1: number;
  booking: number;
  instanceCount: number;
  score: number;
  scoreLabel: "Xuất sắc" | "Tốt" | "Khá" | "Cần cải thiện";
};

function calcScoreLabel(score: number): AdCreativeStat["scoreLabel"] {
  if (score >= 90) return "Xuất sắc";
  if (score >= 75) return "Tốt";
  if (score >= 60) return "Khá";
  return "Cần cải thiện";
}

export async function getAdCreativeStats(
  projectId: string,
  sortBy: "f1" | "booking" | "lead" = "f1",
): Promise<AdCreativeStat[]> {
  // Group by ad NAME (không phải ads.id) để gộp cùng creative chạy ở nhiều adset/campaign
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
    .where(eq(ads.projectId, projectId))
    .groupBy(ads.name);

  const result = rows.map(
    (r: {
      name: string;
      formName: string | null;
      totalLead: number;
      leadF1: number;
      booking: number;
      instanceCount: number;
    }) => {
      // Score = (F1*3 + Booking*10) / Lead, normalized to 0-100
      const score =
        r.totalLead > 0
          ? Math.min(100, Math.round(((r.leadF1 * 3 + r.booking * 10) / r.totalLead) * 25))
          : 0;
      return { ...r, score, scoreLabel: calcScoreLabel(score) } as AdCreativeStat;
    },
  );

  // Sort
  return result.sort((a: AdCreativeStat, b: AdCreativeStat) => {
    if (sortBy === "f1") return b.leadF1 - a.leadF1;
    if (sortBy === "booking") return b.booking - a.booking;
    return b.totalLead - a.totalLead;
  });
}
