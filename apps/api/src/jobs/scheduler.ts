import { nightlyQueue, fbSyncQueue } from "./queue.js";

/**
 * Setup repeatable jobs (BullMQ cron thay Inngest).
 * Gọi 1 lần khi server start.
 */
export async function setupScheduledJobs(): Promise<void> {
  // Nightly snapshot — 00:00 VN (17:00 UTC)
  await nightlyQueue.upsertJobScheduler(
    "nightly-snapshot",
    { pattern: "0 17 * * *" }, // 00:00 Asia/Ho_Chi_Minh = 17:00 UTC
    { name: "snapshot" },
  );

  // Nightly archive — 01:00 VN (18:00 UTC)
  await nightlyQueue.upsertJobScheduler(
    "nightly-archive",
    { pattern: "0 18 * * *" },
    { name: "archive" },
  );

  // Rebuild aggregates — 02:00 VN (19:00 UTC)
  await nightlyQueue.upsertJobScheduler(
    "nightly-rebuild",
    { pattern: "0 19 * * *" },
    { name: "rebuild-aggregates" },
  );

  // Facebook insights sync — mỗi 30 phút (Phase 2, chỉ chạy khi có token)
  if (process.env.FB_SYSTEM_USER_TOKEN) {
    const adAccountId = process.env.FB_AD_ACCOUNT_ID;
    if (adAccountId) {
      await fbSyncQueue.upsertJobScheduler(
        "fb-sync-insights",
        { pattern: "*/30 * * * *" },
        { name: "sync-insights", data: { adAccountId } },
      );
      console.log(`[scheduler] FB sync scheduled every 30m for ${adAccountId}`);
    }
  }

  console.log("[scheduler] Repeatable jobs configured");
}
