import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart2, ArrowLeft } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { getCampaignAnalysisData } from "@/lib/queries/campaign-analysis";
import { getReportFilterOptions } from "@/lib/queries/report-filters";
import { getProjectsForUser } from "@/lib/queries/projects";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CampaignAnalysisTable } from "./_components/CampaignAnalysisTable";
import { DateRangeFilter } from "./_components/DateRangeFilter";
import { ProjectFilter } from "../../_components/ProjectFilter";
import { ProjectSelector } from "../../_components/ProjectSelector";
import { formatDateVN } from "@/lib/utils/format";

interface PageProps {
  searchParams: Promise<{
    project?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    period?: string;
  }>;
}

function periodToDates(period: string): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  switch (period) {
    case "7d": {
      const from = new Date(now.getTime() - 7 * 86400000);
      return { dateFrom: from.toISOString().slice(0, 10), dateTo: to };
    }
    case "30d": {
      const from = new Date(now.getTime() - 30 * 86400000);
      return { dateFrom: from.toISOString().slice(0, 10), dateTo: to };
    }
    case "90d": {
      const from = new Date(now.getTime() - 90 * 86400000);
      return { dateFrom: from.toISOString().slice(0, 10), dateTo: to };
    }
    case "thisMonth": {
      const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      return { dateFrom: from, dateTo: to };
    }
    case "lastMonth": {
      const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return { dateFrom: last.toISOString().slice(0, 10), dateTo: lastEnd.toISOString().slice(0, 10) };
    }
    default:
      return { dateFrom: "", dateTo: "" };
  }
}

export default async function CampaignAnalysisPage({ searchParams }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "gdda") redirect("/report");

  const params = await searchParams;
  const projectId = params.project;

  // No project selected — show project selection screen
  if (!projectId) {
    const projects = await getProjectsForUser({ userId: user.id, role: user.role });
    return (
      <ProjectSelector
        projects={projects}
        basePath="/report/campaigns"
        title="Phân tích Active Campaigns"
        description="Chọn dự án để xem báo cáo chiến dịch realtime"
      />
    );
  }

  let dateFrom = params.dateFrom;
  let dateTo = params.dateTo;
  if (params.period && !dateFrom) {
    const resolved = periodToDates(params.period);
    dateFrom = resolved.dateFrom;
    dateTo = resolved.dateTo;
  }

  const [rows, filterOptions] = await Promise.all([
    getCampaignAnalysisData({
      userId: user.id,
      role: user.role,
      projectId,
      statusFilter: "all",
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    getReportFilterOptions({ userId: user.id, role: user.role, projectId }),
  ]);

  const canEdit = user.role === "admin" || user.role === "digital";
  const projectName = rows.length > 0 ? rows[0].projectName : null;
  const now = formatDateVN(new Date());

  const activeRows = rows.filter((r) => r.statusLabel === "on");
  const totalSpend = activeRows.reduce((acc, r) => acc + (r.spend ?? 0), 0);
  const totalF1 = activeRows.reduce((acc, r) => acc + r.leadF1, 0);
  const winnerCount = activeRows.filter((r) => r.efficiencyRating === "winner").length;
  const goodCount = activeRows.filter((r) => r.efficiencyRating === "good").length;

  const dateLabel = dateFrom && dateTo
    ? `${dateFrom} → ${dateTo}`
    : dateFrom ? `Từ ${dateFrom}` : "Toàn thời gian";

  return (
    <div className="space-y-6">
      <div>
        {/* Back link */}
        <Link
          href="/report/campaigns"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Chọn dự án khác
        </Link>

        <div className="flex items-center gap-2">
          <BarChart2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">
            Phân tích Active Campaigns
            {projectName && <span className="ml-2 text-muted-foreground">— {projectName}</span>}
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Báo cáo chiến dịch realtime · Cập nhật: {now} · {dateLabel}
        </p>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-4">
        <ProjectFilter projects={filterOptions.projects} />
        <DateRangeFilter
          currentPeriod={params.period}
          currentDateFrom={dateFrom}
          currentDateTo={dateTo}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Tổng chiến dịch" value={String(rows.length)} />
        <StatCard label="Winner + Tốt" value={String(winnerCount + goodCount)} valueClass="text-green-700" />
        <StatCard label="Tổng F1 (CRM)" value={String(totalF1)} valueClass="text-emerald-700" />
        <StatCard label="Tổng chi tiêu" value={totalSpend > 0 ? formatSpend(totalSpend) : "—"} valueClass="text-blue-700" />
      </div>

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base">Bảng phân tích chi tiết</CardTitle>
          <CardDescription>
            Click vào tiêu đề cột để sắp xếp · Click &quot;Sửa&quot; để cập nhật kế hoạch hành động
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {rows.length === 0 ? <EmptyState /> : <CampaignAnalysisTable rows={rows} canEdit={canEdit} />}
        </CardContent>
      </Card>
    </div>
  );
}

function formatSpend(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(".", ",")} tỷ đ`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")}M đ`;
  return `${Math.round(n).toLocaleString("vi-VN")} đ`;
}

function StatCard({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={["mt-1 text-2xl font-semibold tabular-nums", valueClass ?? ""].join(" ")}>{value}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <BarChart2 className="mb-3 h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm font-medium text-muted-foreground">Chưa có chiến dịch nào</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Upload CSV Facebook hoặc chờ kết nối Facebook API để đồng bộ dữ liệu.
      </p>
    </div>
  );
}
