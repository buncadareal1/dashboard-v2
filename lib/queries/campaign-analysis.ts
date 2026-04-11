import { isApiMode, apiFetch } from "@/lib/api/client";
import type { CampaignAnalysisRow, GetCampaignAnalysisParams } from "./db/campaign-analysis";

export type { CampaignAnalysisRow, GetCampaignAnalysisParams };

/**
 * Dual-mode query: DB-direct (dev) or Hono API (prod).
 * Phase 2: when Hono API is running, calls GET /api/campaigns/analysis.
 */
export async function getCampaignAnalysisData(
  params: GetCampaignAnalysisParams,
): Promise<CampaignAnalysisRow[]> {
  if (!isApiMode()) {
    const { getCampaignAnalysisData: dbFn } = await import("./db/campaign-analysis");
    return dbFn(params);
  }

  const query = new URLSearchParams();
  if (params.projectId) query.set("projectId", params.projectId);
  if (params.statusFilter) query.set("status", params.statusFilter);
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);

  return apiFetch<CampaignAnalysisRow[]>(`/api/campaigns/analysis?${query.toString()}`);
}
