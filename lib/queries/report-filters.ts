import { isApiMode, apiFetch } from "@/lib/api/client";
import type { UserRole } from "@/db/schema";

export type ReportFilterOptions = {
  projects: { value: string; label: string }[];
  stages: { value: string; label: string }[];
};

export async function getReportFilterOptions(params: {
  userId: string;
  role: UserRole;
  projectId?: string;
}): Promise<ReportFilterOptions> {
  if (!isApiMode()) {
    const { getReportFilterOptions: dbFn } = await import("./db/report-filters");
    return dbFn(params);
  }
  const qs = params.projectId ? `?projectId=${params.projectId}` : "";
  return apiFetch<ReportFilterOptions>(`/api/leads/filters${qs}`);
}
