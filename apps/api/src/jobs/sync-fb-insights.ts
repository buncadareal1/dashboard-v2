import { Worker } from "bullmq";
import { workerRedis } from "./queue.js";
import { FacebookGraphClient } from "../services/fb/client.js";
import { syncCampaigns } from "../services/fb/sync-campaigns.js";
import { syncCampaignInsights } from "../services/fb/sync-insights.js";
import { syncAds } from "../services/fb/sync-ads.js";

/**
 * Phase 2: Facebook Insights sync worker.
 * BullMQ repeatable job chạy mỗi 15-30 phút.
 *
 * Flow:
 * 1. GET /act_{id}/campaigns → upsert campaigns
 * 2. GET /{campaign_id}/insights → upsert campaign_insights
 * 3. GET /act_{id}/ads → upsert ads + ad_insights
 */

type FbSyncJobData = {
  adAccountId: string;
  projectId: string;
};

export const fbSyncWorker = new Worker<FbSyncJobData>(
  "fb-sync",
  async (job) => {
    const { adAccountId, projectId } = job.data;

    const fbToken = process.env.FB_SYSTEM_USER_TOKEN;
    if (!fbToken) {
      throw new Error("FB_SYSTEM_USER_TOKEN not configured");
    }

    console.log(`[fb-sync] Starting sync for account ${adAccountId}, project ${projectId}`);

    const client = new FacebookGraphClient(fbToken);

    const [campaignResult, insightResult, adResult] = await Promise.all([
      syncCampaigns(client, adAccountId, projectId),
      syncCampaignInsights(client, adAccountId),
      syncAds(client, adAccountId, projectId),
    ]);

    console.log(
      `[fb-sync] Done — campaigns: ${JSON.stringify(campaignResult)}, ` +
        `insights: ${JSON.stringify(insightResult)}, ads: ${JSON.stringify(adResult)}`,
    );
  },
  {
    connection: workerRedis,
    concurrency: 1, // Respect FB rate limits
  },
);
