/**
 * Sync Facebook ads and ad-level insights into `ads` and `ad_insights`.
 */

import { db } from "@dashboard/db";
import { ads, adInsights } from "@dashboard/db/schema";
import { eq } from "drizzle-orm";
import type { FacebookGraphClient } from "./client.js";

export interface SyncAdsResult {
  adCount: number;
  insightRows: number;
}

/**
 * Fetch all ads for `adAccountId` from FB, upsert thumbnailUrl into `ads`,
 * then fetch ad-level insights and upsert into `ad_insights`.
 *
 * Ads are matched by their FB externalId stored in `ads.name` if the
 * row has a matching name, or skipped if no local row can be correlated.
 * Only ads that already exist locally (inserted via CSV import) are updated.
 */
export async function syncAds(
  client: FacebookGraphClient,
  adAccountId: string,
  projectId: string,
  datePreset = "today",
): Promise<SyncAdsResult> {
  const fbAds = await client.getAds(adAccountId);

  let adCount = 0;
  let insightRows = 0;

  // Load all ads for this project
  const projectAds = await db.query.ads.findMany({
    where: eq(ads.projectId, projectId),
  });

  const adByName = new Map(projectAds.map((a) => [a.name, a]));

  for (const fbAd of fbAds) {
    const localAd = adByName.get(fbAd.name);
    if (!localAd) {
      // Ad not yet imported via CSV — skip thumbnail update but still try insights
      // if we can find by any means (not possible without local row)
      continue;
    }

    const thumbnailUrl = fbAd.creative?.thumbnail_url ?? null;

    if (thumbnailUrl && thumbnailUrl !== localAd.thumbnailUrl) {
      await db
        .update(ads)
        .set({ thumbnailUrl })
        .where(eq(ads.id, localAd.id));
    }

    adCount += 1;

    // Fetch and upsert ad-level insights
    let fbInsights;
    try {
      fbInsights = await client.getAdInsights(fbAd.id, datePreset);
    } catch (err) {
      console.warn(
        `[sync-ads] Could not fetch insights for ad ${fbAd.id}:`,
        err instanceof Error ? err.message : err,
      );
      continue;
    }

    for (const insight of fbInsights) {
      const leads = extractLeadCount(insight.actions);
      const spend = parseFloat(insight.spend ?? "0");
      const cpl = leads > 0 && spend > 0 ? spend / leads : 0;

      await db
        .insert(adInsights)
        .values({
          adId: localAd.id,
          date: insight.date_start,
          spend: spend.toFixed(2),
          impressions: parseInt(insight.impressions ?? "0", 10),
          clicks: parseInt(insight.clicks ?? "0", 10),
          leads,
          ctr: parseFloat(insight.ctr ?? "0").toFixed(4),
          cpm: parseFloat(insight.cpm ?? "0").toFixed(2),
          cpl: cpl.toFixed(2),
          fetchedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [adInsights.adId, adInsights.date],
          set: {
            spend: spend.toFixed(2),
            impressions: parseInt(insight.impressions ?? "0", 10),
            clicks: parseInt(insight.clicks ?? "0", 10),
            leads,
            ctr: parseFloat(insight.ctr ?? "0").toFixed(4),
            cpm: parseFloat(insight.cpm ?? "0").toFixed(2),
            cpl: cpl.toFixed(2),
            fetchedAt: new Date(),
          },
        });

      insightRows += 1;
    }
  }

  return { adCount, insightRows };
}

function extractLeadCount(
  actions: Array<{ action_type: string; value: string }> | undefined,
): number {
  if (!actions) return 0;
  const leadAction = actions.find((a) => a.action_type === "lead");
  return leadAction ? parseInt(leadAction.value, 10) : 0;
}
