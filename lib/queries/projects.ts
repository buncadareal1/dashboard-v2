import { isApiMode, apiFetch } from "@/lib/api/client";
import type { UserRole } from "@/db/schema";

export type ProjectCardData = {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  status: "running" | "warning" | "paused";
  budget: number;
  totalLead: number;
  cpl: number;
  leadF1: number;
  conversionRate: number;
  booking: number;
  manager: { id: string; name: string | null; email: string } | null;
  fanpages: string[];
};

export type DashboardOverviewStats = {
  totalProjects: number;
  totalCost: number;
  totalLead: number;
  totalF1: number;
  totalBooking: number;
};

export async function getProjectsForUser(params: {
  userId: string;
  role: UserRole;
  status?: "running" | "warning" | "paused";
  search?: string;
}): Promise<ProjectCardData[]> {
  if (!isApiMode()) {
    const { getProjectsForUser: dbFn } = await import("./db/projects");
    return dbFn(params);
  }
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.search) sp.set("search", params.search);
  const qs = sp.toString();
  return apiFetch<ProjectCardData[]>(`/api/projects${qs ? `?${qs}` : ""}`);
}

export async function getDashboardOverviewStats(params: {
  userId: string;
  role: UserRole;
}): Promise<DashboardOverviewStats> {
  if (!isApiMode()) {
    const { getDashboardOverviewStats: dbFn } = await import("./db/projects");
    return dbFn(params);
  }
  return apiFetch<DashboardOverviewStats>("/api/projects/overview");
}
