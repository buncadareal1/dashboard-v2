/**
 * Shared types for API responses — used by both query wrappers and client components.
 * Extracted to avoid client components pulling in server-only code.
 */

// --- Projects ---

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

// --- Project Detail ---

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

// --- Report ---

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
  fbCreatedAt: string | null; // ISO string from API (was Date from DB)
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

// --- Uploads ---

export type UploadHistoryRow = {
  id: string;
  type: "facebook" | "bitrix" | "cost";
  filename: string;
  status: "pending" | "processing" | "done" | "failed";
  rowCount: number;
  parsedCount: number;
  errorCount: number;
  createdAt: string; // ISO string
  finishedAt: string | null;
};

// --- Conflicts ---

export type ConflictRow = {
  id: string;
  reason: string;
  candidates: unknown;
  csvUploadId: string;
  csvFilename: string;
  csvType: "facebook" | "bitrix";
  projectName: string;
  createdAt: string; // ISO string
};

// --- Filters ---

export type FilterOption = {
  value: string;
  label: string;
};

export type ReportFilterOptions = {
  projects: FilterOption[];
  stages: FilterOption[];
};
