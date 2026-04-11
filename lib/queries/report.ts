import { isApiMode, apiFetch, apiFetchPaginated } from "@/lib/api/client";
import type { UserRole } from "@/db/schema";

export type ReportStatCards = {
  totalLead: number;
  f1: number;
  dangCham: number;
  booking: number;
  deal: number;
};

export type LeadDetailRow = {
  id: string;
  fullName: string;
  email: string | null;
  stageLabel: string | null;
  stageColor: string | null;
  projectName: string;
  fanpageName: string | null;
  campaignName: string | null;
  adsetName: string | null;
  adName: string | null;
  formName: string | null;
  fbLeadId: string | null;
  sourceName: string | null;
  fbCreatedAt: Date | string | null;
};

export type SummaryByDateRow = {
  date: string;
  totalLead: number;
  f1: number;
  dangCham: number;
  khongBatMay: number;
  thueBao: number;
  chaoDaKhac: number;
  moiGioi: number;
  khac: number;
  f1Rate: number;
};

export type ByEmployeeRow = {
  employeeName: string;
  totalLead: number;
  f1: number;
  dangCham: number;
  thueBao: number;
  khongBatMay: number;
};

export type ByFanpageRow = {
  fanpageName: string;
  totalLead: number;
  percentage: number;
};

function buildLeadQs(params: { projectIds?: string[]; stageCode?: string; period?: string }): string {
  const sp = new URLSearchParams();
  if (params.projectIds?.length) sp.set("projectIds", params.projectIds.join(","));
  if (params.stageCode) sp.set("stageCode", params.stageCode);
  if (params.period) sp.set("period", params.period);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export async function getReportStatCards(params: {
  userId: string; role: UserRole; projectIds?: string[]; stageCode?: string; period?: string;
}): Promise<ReportStatCards> {
  if (!isApiMode()) {
    const { getReportStatCards: dbFn } = await import("./db/report");
    return dbFn(params);
  }
  return apiFetch<ReportStatCards>(`/api/leads/stats${buildLeadQs(params)}`);
}

export async function getLeadDetail(params: {
  userId: string; role: UserRole; projectIds?: string[]; stageCode?: string; period?: string;
  page?: number; pageSize?: number;
}): Promise<{ rows: LeadDetailRow[]; total: number }> {
  if (!isApiMode()) {
    const { getLeadDetail: dbFn } = await import("./db/report");
    return dbFn(params);
  }
  const sp = new URLSearchParams();
  if (params.projectIds?.length) sp.set("projectIds", params.projectIds.join(","));
  if (params.stageCode) sp.set("stageCode", params.stageCode);
  if (params.period) sp.set("period", params.period);
  if (params.page) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));
  const qs = sp.toString();
  return apiFetchPaginated<LeadDetailRow>(`/api/leads${qs ? `?${qs}` : ""}`);
}

export async function getSummaryByDate(params: {
  userId: string; role: UserRole; projectIds?: string[];
}): Promise<SummaryByDateRow[]> {
  if (!isApiMode()) {
    const { getSummaryByDate: dbFn } = await import("./db/report");
    return dbFn(params);
  }
  const sp = new URLSearchParams();
  if (params.projectIds?.length) sp.set("projectIds", params.projectIds.join(","));
  const qs = sp.toString();
  return apiFetch<SummaryByDateRow[]>(`/api/leads/by-date${qs ? `?${qs}` : ""}`);
}

export async function getByEmployee(params: {
  userId: string; role: UserRole; projectIds?: string[];
}): Promise<ByEmployeeRow[]> {
  if (!isApiMode()) {
    const { getByEmployee: dbFn } = await import("./db/report");
    return dbFn(params);
  }
  const sp = new URLSearchParams();
  if (params.projectIds?.length) sp.set("projectIds", params.projectIds.join(","));
  const qs = sp.toString();
  return apiFetch<ByEmployeeRow[]>(`/api/leads/by-employee${qs ? `?${qs}` : ""}`);
}

export async function getByFanpage(params: {
  userId: string; role: UserRole; projectIds?: string[];
}): Promise<ByFanpageRow[]> {
  if (!isApiMode()) {
    const { getByFanpage: dbFn } = await import("./db/report");
    return dbFn(params);
  }
  const sp = new URLSearchParams();
  if (params.projectIds?.length) sp.set("projectIds", params.projectIds.join(","));
  const qs = sp.toString();
  return apiFetch<ByFanpageRow[]>(`/api/leads/by-fanpage${qs ? `?${qs}` : ""}`);
}
