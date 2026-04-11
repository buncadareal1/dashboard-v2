import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  campaigns,
  campaignInsights,
  campaignActions,
  leads,
  stages,
  projects,
  projectUsers,
} from "@/db/schema";

export type CampaignAnalysisRow = {
  campaignId: string;
  campaignName: string;
  projectId: string;
  projectName: string;
  statusLabel: "on" | "off";
  // Campaign type — inferred from name prefix until FB API available
  campaignType: "LF" | "MESS" | "OTHER";
  // META API fields (from campaign_insights lifetime aggregate)
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  leads: number | null;
  ctr: number | null;
  cpm: number | null;
  frequency: number | null;
  cplFb: number | null;
  // Computed from spend
  cplComputed: number | null;
  // CRM data from leads table
  totalLeadCrm: number;
  leadF1: number;
  rateCrm: number | null;
  cplF1: number | null;
  // Auto-rated
  efficiencyRating: "winner" | "good" | "average" | "high" | "test";
  contentRating: "good" | "average" | "poor" | null;
  // Action plan (manual)
  actionId: string | null;
  priority: "urgent" | "today" | "week" | "none";
  plan: string | null;
  contentNote: string | null;
  todayAction: string | null;
  actionDetail: string | null;
  assignee: string | null;
  deadline: string | null;
};

export type GetCampaignAnalysisParams = {
  userId: string;
  role: "admin" | "digital" | "gdda";
  projectId?: string;
  statusFilter?: "on" | "off" | "all";
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
};

/**
 * Infer campaign type from name prefix.
 * LF = Lead Form (e.g. "LF_LINH_3"), MESS = Messages.
 * Phase 2 will replace this with FB API objective field.
 */
function inferCampaignType(name: string): "LF" | "MESS" | "OTHER" {
  const upper = name.toUpperCase();
  if (upper.startsWith("LF") || upper.startsWith("LEAD")) return "LF";
  if (upper.startsWith("MESS") || upper.startsWith("MSG")) return "MESS";
  return "OTHER";
}

/**
 * Compute efficiency rating based on CPL (spend / FB leads).
 * Thresholds cho dự án BĐS Smartland.
 */
function computeEfficiencyRating(
  cplFb: number | null,
  fbLeads: number,
): CampaignAnalysisRow["efficiencyRating"] {
  if (fbLeads < 5) return "test";
  if (cplFb === null) return "test";
  if (cplFb < 150_000) return "winner";
  if (cplFb < 300_000) return "good";
  if (cplFb < 500_000) return "average";
  return "high";
}

/**
 * Compute content quality rating based on CTR thresholds.
 */
function computeContentRating(
  ctr: number | null,
): CampaignAnalysisRow["contentRating"] {
  if (ctr === null) return null;
  if (ctr > 1.5) return "good";
  if (ctr >= 0.8) return "average";
  return "poor";
}

export async function getCampaignAnalysisData(
  params: GetCampaignAnalysisParams,
): Promise<CampaignAnalysisRow[]> {
  const { userId, role, projectId, statusFilter = "on", dateFrom, dateTo } = params;

  // Determine accessible project scope
  let accessibleProjectIds: string[] | null = null;
  if (role !== "admin") {
    const rows = await db
      .select({ projectId: projectUsers.projectId })
      .from(projectUsers)
      .where(
        and(
          eq(projectUsers.userId, userId),
          eq(projectUsers.canView, true),
        ),
      );
    accessibleProjectIds = rows.map((r: { projectId: string }) => r.projectId);
  }

  // Build campaign WHERE conditions
  const campaignConditions = [isNull(projects.deletedAt)];

  if (projectId) {
    campaignConditions.push(eq(campaigns.projectId, projectId));
    // RBAC: non-admin must still have access to this project
    if (accessibleProjectIds !== null && !accessibleProjectIds.includes(projectId)) {
      return [];
    }
  } else if (accessibleProjectIds !== null) {
    if (accessibleProjectIds.length === 0) return [];
    campaignConditions.push(inArray(campaigns.projectId, accessibleProjectIds));
  }

  if (statusFilter !== "all") {
    campaignConditions.push(eq(campaigns.statusLabel, statusFilter));
  }

  // Aggregated insights per campaign (filtered by date range if specified)
  const insightDateConds = [];
  if (dateFrom) insightDateConds.push(sql`${campaignInsights.date} >= ${dateFrom}`);
  if (dateTo) insightDateConds.push(sql`${campaignInsights.date} <= ${dateTo}`);
  const insightDateWhere = insightDateConds.length > 0 ? and(...insightDateConds) : undefined;

  const insightsSub = db
    .select({
      campaignId: campaignInsights.campaignId,
      spend: sql<number>`coalesce(sum(${campaignInsights.spend}::numeric), 0)`.as("spend"),
      impressions: sql<number>`coalesce(sum(${campaignInsights.impressions}), 0)`.as("impressions"),
      clicks: sql<number>`coalesce(sum(${campaignInsights.clicks}), 0)`.as("clicks"),
      leads: sql<number>`coalesce(sum(${campaignInsights.leads}), 0)`.as("leads"),
      ctr: sql<number>`case when sum(${campaignInsights.impressions}) > 0 then (sum(${campaignInsights.clicks})::numeric / sum(${campaignInsights.impressions})) * 100 else null end`.as("ctr"),
      cpm: sql<number>`case when sum(${campaignInsights.impressions}) > 0 then (sum(${campaignInsights.spend}::numeric) / sum(${campaignInsights.impressions})) * 1000 else null end`.as("cpm"),
      frequency: sql<number>`coalesce(avg(${campaignInsights.frequency}::numeric), null)`.as("frequency"),
    })
    .from(campaignInsights)
    .where(insightDateWhere)
    .groupBy(campaignInsights.campaignId)
    .as("ci");

  // CRM lead counts per campaign (filtered by date range if specified)
  const leadDateConds = [];
  if (dateFrom) leadDateConds.push(sql`${leads.fbCreatedAt} >= ${dateFrom}::date`);
  if (dateTo) leadDateConds.push(sql`${leads.fbCreatedAt} <= (${dateTo}::date + interval '1 day')`);
  const leadDateWhere = leadDateConds.length > 0 ? and(...leadDateConds) : undefined;

  const leadsSub = db
    .select({
      campaignId: leads.campaignId,
      totalLeadCrm: sql<number>`count(*)::int`.as("total_lead_crm"),
      leadF1: sql<number>`count(*) filter (where ${stages.code} = 'F1')::int`.as("lead_f1"),
    })
    .from(leads)
    .leftJoin(stages, eq(leads.currentStageId, stages.id))
    .where(leadDateWhere)
    .groupBy(leads.campaignId)
    .as("lc");

  const rows = await db
    .select({
      campaignId: campaigns.id,
      campaignName: campaigns.name,
      projectId: projects.id,
      projectName: projects.name,
      statusLabel: campaigns.statusLabel,
      // Insights
      spend: insightsSub.spend,
      impressions: insightsSub.impressions,
      clicks: insightsSub.clicks,
      fbLeads: insightsSub.leads,
      ctr: insightsSub.ctr,
      cpm: insightsSub.cpm,
      frequency: insightsSub.frequency,
      // CRM
      totalLeadCrm: sql<number>`coalesce(${leadsSub.totalLeadCrm}, 0)`,
      leadF1: sql<number>`coalesce(${leadsSub.leadF1}, 0)`,
      // Action plan
      actionId: campaignActions.id,
      priority: campaignActions.priority,
      plan: campaignActions.plan,
      contentNote: campaignActions.contentNote,
      todayAction: campaignActions.todayAction,
      actionDetail: campaignActions.actionDetail,
      assignee: campaignActions.assignee,
      deadline: campaignActions.deadline,
    })
    .from(campaigns)
    .innerJoin(projects, eq(campaigns.projectId, projects.id))
    .leftJoin(insightsSub, eq(campaigns.id, insightsSub.campaignId))
    .leftJoin(leadsSub, eq(campaigns.id, leadsSub.campaignId))
    .leftJoin(campaignActions, eq(campaigns.id, campaignActions.campaignId))
    .where(and(...campaignConditions))
    .orderBy(campaigns.name);

  const mapped = rows.map((r) => {
    const spend = r.spend != null ? Number(r.spend) : null;
    const ctr = r.ctr != null ? Number(r.ctr) : null;
    const cpm = r.cpm != null ? Number(r.cpm) : null;
    const frequency = r.frequency != null ? Number(r.frequency) : null;
    const fbLeads = r.fbLeads != null ? Number(r.fbLeads) : null;
    const totalLeadCrm = Number(r.totalLeadCrm ?? 0);
    const leadF1 = Number(r.leadF1 ?? 0);

    // CPL computed from FB leads (if available) else from CRM leads
    const effectiveLeads = fbLeads && fbLeads > 0 ? fbLeads : totalLeadCrm;
    const cplFb = spend != null && fbLeads != null && fbLeads > 0
      ? spend / fbLeads
      : null;
    const cplComputed = spend != null && effectiveLeads > 0
      ? spend / effectiveLeads
      : null;

    const rateCrm = totalLeadCrm > 0 ? leadF1 / totalLeadCrm : null;
    const cplF1 = spend != null && leadF1 > 0 ? spend / leadF1 : null;

    return {
      campaignId: r.campaignId,
      campaignName: r.campaignName,
      projectId: r.projectId,
      projectName: r.projectName,
      statusLabel: r.statusLabel,
      campaignType: inferCampaignType(r.campaignName),
      spend,
      impressions: r.impressions != null ? Number(r.impressions) : null,
      clicks: r.clicks != null ? Number(r.clicks) : null,
      leads: fbLeads,
      ctr,
      cpm,
      frequency,
      cplFb,
      cplComputed,
      totalLeadCrm,
      leadF1,
      rateCrm,
      cplF1,
      efficiencyRating: computeEfficiencyRating(cplFb, fbLeads && fbLeads > 0 ? fbLeads : 0),
      contentRating: computeContentRating(ctr),
      actionId: r.actionId ?? null,
      priority: r.priority ?? "none",
      plan: r.plan ?? null,
      contentNote: r.contentNote ?? null,
      todayAction: r.todayAction ?? null,
      actionDetail: r.actionDetail ?? null,
      assignee: r.assignee ?? null,
      deadline: r.deadline ?? null,
    };
  });

  // When date filter is active, hide campaigns with no activity in the range
  if (dateFrom || dateTo) {
    return mapped.filter(
      (r) => (r.spend != null && r.spend > 0) || r.totalLeadCrm > 0,
    );
  }

  return mapped;
}
