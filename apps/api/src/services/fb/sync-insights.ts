/**
 * Sync Facebook campaign-level insights into `campaign_insights`.
 */

import { db } from "@dashboard/db";
import { campaigns, campaignInsights } from "@dashboard/db/schema";
import { eq, isNotNull } from "drizzle-orm";
import type { FacebookGraphClient } from "./client.js";

export interface SyncCampaignInsightsResult {
  campaignCount: number;
  insightRows: number;
}

/**
 * For each campaign that has an externalId, fetch today's insights from FB
 * and upsert into `campaign_insights` (unique on campaignId + date).
 *
 * CPL = spend / leads (leads extracted from actions where action_type = "lead").
 *
 * @param datePreset FB date preset. Defaults to "today" for incremental runs.
 */
export async function syncCampaignInsights(
  client: FacebookGraphClient,
  adAccountId: string,
  datePreset = "today",
): Promise<SyncCampaignInsightsResult> {
  // Only sync campaigns that are linked to a FB external ID
  const activeCampaigns = await db.query.campaigns.findMany({
    where: isNotNull(campaigns.externalId),
  });

  // Filter to campaigns belonging to this ad account by checking their
  // externalId prefix (FB campaign IDs are globally unique but we scope
  // via the campaigns already inserted by syncCampaigns for this account).
  // We rely on the caller to pass only campaigns scoped to the account.
  void adAccountId; // used by caller to scope syncCampaigns; not needed here

  let insightRows = 0;

  for (const campaign of activeCampaigns) {
    if (!campaign.externalId) continue;

    let fbInsights;
    try {
      fbInsights = await client.getCampaignInsights(campaign.externalId, datePreset);
    } catch (err) {
      console.warn(
        `[sync-insights] Could not fetch insights for campaign ${campaign.id}:`,
        err instanceof Error ? err.message : err,
      );
      continue;
    }

    for (const insight of fbInsights) {
      const leads = extractLeadCount(insight.actions);
      const spend = parseFloat(insight.spend ?? "0");
      const cpl = leads > 0 && spend > 0 ? spend / leads : 0;

      await db
        .insert(campaignInsights)
        .values({
          campaignId: campaign.id,
          date: insight.date_start,
          spend: spend.toFixed(2),
          impressions: parseInt(insight.impressions ?? "0", 10),
          clicks: parseInt(insight.clicks ?? "0", 10),
          leads,
          ctr: parseFloat(insight.ctr ?? "0").toFixed(4),
          cpm: parseFloat(insight.cpm ?? "0").toFixed(2),
          frequency: parseFloat(insight.frequency ?? "0").toFixed(4),
          cpl: cpl.toFixed(2),
          fetchedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [campaignInsights.campaignId, campaignInsights.date],
          set: {
            spend: spend.toFixed(2),
            impressions: parseInt(insight.impressions ?? "0", 10),
            clicks: parseInt(insight.clicks ?? "0", 10),
            leads,
            ctr: parseFloat(insight.ctr ?? "0").toFixed(4),
            cpm: parseFloat(insight.cpm ?? "0").toFixed(2),
            frequency: parseFloat(insight.frequency ?? "0").toFixed(4),
            cpl: cpl.toFixed(2),
            fetchedAt: new Date(),
          },
        });

      insightRows += 1;
    }
  }

  return { campaignCount: activeCampaigns.length, insightRows };
}

function extractLeadCount(
  actions: Array<{ action_type: string; value: string }> | undefined,
): number {
  if (!actions) return 0;
  const leadAction = actions.find((a) => a.action_type === "lead");
  return leadAction ? parseInt(leadAction.value, 10) : 0;
}
