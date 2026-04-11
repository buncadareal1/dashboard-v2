import { isApiMode, apiFetch } from "@/lib/api/client";

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

export type CampaignStat = {
  campaignId: string;
  name: string;
  statusLabel: "on" | "off";
  totalLead: number;
  leadF1: number;
  leadDangCham: number;
  qualifyRate: number;
};

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

export async function getProjectDetailBySlug(
  slug: string,
): Promise<ProjectDetail | null> {
  if (!isApiMode()) {
    const { getProjectDetailBySlug: dbFn } = await import("./db/project-detail");
    return dbFn(slug);
  }
  try {
    return await apiFetch<ProjectDetail>(`/api/projects/${slug}`);
  } catch {
    return null;
  }
}

export async function getCampaignStats(
  slugOrProjectId: string,
): Promise<CampaignStat[]> {
  if (!isApiMode()) {
    const { getCampaignStats: dbFn } = await import("./db/project-detail");
    return dbFn(slugOrProjectId);
  }
  return apiFetch<CampaignStat[]>(`/api/projects/${slugOrProjectId}/campaigns`);
}

export async function getAdCreativeStats(
  slugOrProjectId: string,
  sortBy: "f1" | "booking" | "lead" = "f1",
): Promise<AdCreativeStat[]> {
  if (!isApiMode()) {
    const { getAdCreativeStats: dbFn } = await import("./db/project-detail");
    return dbFn(slugOrProjectId, sortBy);
  }
  return apiFetch<AdCreativeStat[]>(`/api/projects/${slugOrProjectId}/ads?sort=${sortBy}`);
}
