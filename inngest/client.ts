import { Inngest } from "inngest";

/**
 * Event taxonomy — Phase 1 + hook sẵn cho Phase 2 webhook.
 *
 * Event flow:
 *   csv/uploaded → process-csv-upload (parse, match, upsert)
 *     → lead/ingested (chung cho CSV + future webhook)
 *       → aggregate/rebuild (rebuild daily_aggregates cho project+date affected)
 *
 * Phase 2 thêm:
 *   webhook/facebook.lead.created → cùng lead/ingested
 *   webhook/bitrix.stage.changed → cùng lead/ingested
 *
 * Inngest v4 đã đổi pattern type-safe events — sẽ setup ở Phase 2 khi viết
 * webhook handlers thực. Phase 1 dùng untyped client cho seed/scaffold.
 */
export const inngest = new Inngest({
  id: "dashboard-v2",
});
