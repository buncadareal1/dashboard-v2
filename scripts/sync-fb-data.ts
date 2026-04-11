/**
 * One-time script: sync ALL Facebook campaigns + insights + ads into DB.
 * Run: npx dotenv -e .env.local -- npx tsx scripts/sync-fb-data.ts
 */

// We need to get project ID for linking campaigns
import { db } from "../db";
import { projects, campaigns, ads, adsets } from "../db/schema";
import { campaignInsights, adInsights } from "../db/schema";
import { eq, sql, and, isNull } from "drizzle-orm";

const TOKEN = process.env.FB_SYSTEM_USER_TOKEN!;
const AD_ACCOUNT = process.env.FB_AD_ACCOUNT_ID!;
const BASE = "https://graph.facebook.com/v21.0";

if (!TOKEN || !AD_ACCOUNT) {
  console.error("Missing FB_SYSTEM_USER_TOKEN or FB_AD_ACCOUNT_ID in env");
  process.exit(1);
}

async function fbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("access_token", TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(`FB API: ${body.error?.message ?? res.status}`);
  }
  return body as T;
}

async function fbFetchAll<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  let all: T[] = [];
  const first = await fbFetch<{ data: T[]; paging?: { next?: string } }>(path, { ...params, limit: "100" });
  all = all.concat(first.data);
  let next = first.paging?.next;
  while (next) {
    const res = await fetch(next);
    const body = await res.json();
    all = all.concat(body.data || []);
    next = body.paging?.next;
  }
  return all;
}

async function main() {
  // Find the project to link campaigns to
  const projectRows = await db.select().from(projects).where(isNull(projects.deletedAt));
  if (projectRows.length === 0) {
    console.error("No projects found in DB");
    process.exit(1);
  }
  // Use first project (or find by ad account)
  const project = projectRows[0];
  console.log(`Using project: ${project.name} (${project.id})`);

  // --- Step 1: Sync Campaigns ---
  console.log("\n=== Syncing Campaigns ===");
  const fbCampaigns = await fbFetchAll<{
    id: string; name: string; status: string; effective_status: string; objective: string;
  }>(`/${AD_ACCOUNT}/campaigns`, { fields: "id,name,status,effective_status,objective" });
  console.log(`FB campaigns: ${fbCampaigns.length}`);

  let campaignCreated = 0, campaignUpdated = 0;
  for (const fc of fbCampaigns) {
    const statusLabel = fc.effective_status === "ACTIVE" ? "on" as const : "off" as const;
    // Try to find existing by externalId or name
    let existing = await db.query.campaigns.findFirst({
      where: eq(campaigns.externalId, fc.id),
    });
    if (!existing) {
      // Try name match
      existing = await db.query.campaigns.findFirst({
        where: and(
          eq(campaigns.projectId, project.id),
          sql`lower(trim(regexp_replace(${campaigns.name}, '\\s+', ' ', 'g'))) = lower(trim(regexp_replace(${fc.name}, '\\s+', ' ', 'g')))`,
        ),
      });
    }
    if (existing) {
      await db.update(campaigns).set({
        externalId: fc.id,
        statusLabel,
      }).where(eq(campaigns.id, existing.id));
      campaignUpdated++;
    } else {
      await db.insert(campaigns).values({
        projectId: project.id,
        externalId: fc.id,
        name: fc.name,
        statusLabel,
      }).onConflictDoNothing();
      campaignCreated++;
    }
  }
  console.log(`Campaigns: ${campaignCreated} created, ${campaignUpdated} updated`);

  // --- Step 2: Sync Campaign Insights ---
  console.log("\n=== Syncing Campaign Insights ===");
  const allDbCampaigns = await db.select({ id: campaigns.id, externalId: campaigns.externalId })
    .from(campaigns).where(eq(campaigns.projectId, project.id));
  const campaignsWithExtId = allDbCampaigns.filter(c => c.externalId);
  console.log(`Campaigns with externalId: ${campaignsWithExtId.length}`);

  let insightRows = 0, insightErrors = 0;
  for (const camp of campaignsWithExtId) {
    try {
      const insights = await fbFetch<{ data: Array<{
        spend: string; impressions: string; clicks: string; ctr: string; cpm: string;
        frequency: string; actions?: Array<{ action_type: string; value: string }>;
        date_start: string; date_stop: string;
      }> }>(`/${camp.externalId}/insights`, {
        fields: "spend,impressions,clicks,ctr,cpm,frequency,actions",
        date_preset: "maximum",
      });

      for (const ins of insights.data) {
        const leads = ins.actions?.find(a => a.action_type === "lead");
        const leadCount = leads ? parseInt(leads.value, 10) : 0;
        const spend = parseFloat(ins.spend || "0");
        const cpl = leadCount > 0 ? spend / leadCount : 0;

        await db.insert(campaignInsights).values({
          campaignId: camp.id,
          date: ins.date_start,
          spend: spend.toFixed(2),
          impressions: parseInt(ins.impressions || "0", 10),
          clicks: parseInt(ins.clicks || "0", 10),
          leads: leadCount,
          ctr: parseFloat(ins.ctr || "0").toFixed(4),
          cpm: parseFloat(ins.cpm || "0").toFixed(2),
          frequency: parseFloat(ins.frequency || "0").toFixed(4),
          cpl: cpl.toFixed(2),
          fetchedAt: new Date(),
        }).onConflictDoUpdate({
          target: [campaignInsights.campaignId, campaignInsights.date],
          set: {
            spend: spend.toFixed(2),
            impressions: parseInt(ins.impressions || "0", 10),
            clicks: parseInt(ins.clicks || "0", 10),
            leads: leadCount,
            ctr: parseFloat(ins.ctr || "0").toFixed(4),
            cpm: parseFloat(ins.cpm || "0").toFixed(2),
            frequency: parseFloat(ins.frequency || "0").toFixed(4),
            cpl: cpl.toFixed(2),
            fetchedAt: new Date(),
          },
        });
        insightRows++;
      }
    } catch (err) {
      insightErrors++;
      // Skip silently — some campaigns may not have insights
    }
  }
  console.log(`Insights: ${insightRows} rows synced, ${insightErrors} campaigns skipped`);

  // --- Step 3: Sync Ads (thumbnails) ---
  console.log("\n=== Syncing Ad Thumbnails ===");
  const fbAds = await fbFetchAll<{
    id: string; name: string; creative?: { thumbnail_url?: string };
  }>(`/${AD_ACCOUNT}/ads`, { fields: "id,name,creative{thumbnail_url}" });
  console.log(`FB ads: ${fbAds.length}`);

  let adUpdated = 0;
  for (const fa of fbAds) {
    if (!fa.creative?.thumbnail_url) continue;
    // Try to match by name in DB
    const dbAd = await db.query.ads.findFirst({
      where: and(
        eq(ads.projectId, project.id),
        sql`lower(trim(${ads.name})) = lower(trim(${fa.name}))`,
      ),
    });
    if (dbAd) {
      await db.update(ads).set({ thumbnailUrl: fa.creative.thumbnail_url })
        .where(eq(ads.id, dbAd.id));
      adUpdated++;
    }
  }
  console.log(`Ads thumbnails updated: ${adUpdated}`);

  // --- Summary ---
  const totalInsights = await db.select({ count: sql<number>`count(*)::int` })
    .from(campaignInsights);
  console.log(`\n=== DONE ===`);
  console.log(`DB campaign_insights rows: ${(totalInsights[0] as { count: number }).count}`);

  process.exit(0);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
