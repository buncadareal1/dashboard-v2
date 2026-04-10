import { redirect } from "next/navigation";
import { Users, TrendingUp, Phone, CalendarCheck, Trophy } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import {
  getReportStatCards,
  getLeadDetail,
  getSummaryByDate,
  getByEmployee,
  getByFanpage,
} from "@/lib/queries/report";
import { getReportFilterOptions } from "@/lib/queries/report-filters";
import { Card, CardContent } from "@/components/ui/card";
import { LeadDetailTable } from "./_components/LeadDetailTable";
import { GddaReportTabs } from "./_components/GddaReportTabs";
import { ReportFilters } from "./_components/ReportFilters";
import { formatNumber } from "@/lib/utils/format";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    project?: string;
    stage?: string;
    period?: string;
  }>;
}

export default async function ReportDataPage({ searchParams }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);

  const isAdminOrDigital = user.role === "admin" || user.role === "digital";
  const projectIds = params.project ? [params.project] : undefined;

  const [stats, leadDetail, filterOptions, summaryByDate, byEmployee, byFanpage] =
    await Promise.all([
      getReportStatCards({
        userId: user.id,
        role: user.role,
        projectIds,
      }),
      getLeadDetail({
        userId: user.id,
        role: user.role,
        projectIds,
        stageCode: params.stage,
        page,
        pageSize: 50,
      }),
      isAdminOrDigital
        ? getReportFilterOptions({ userId: user.id, role: user.role })
        : Promise.resolve({ projects: [], stages: [] }),
      user.role === "gdda"
        ? getSummaryByDate({ userId: user.id, role: user.role })
        : Promise.resolve([]),
      user.role === "gdda"
        ? getByEmployee({ userId: user.id, role: user.role })
        : Promise.resolve([]),
      user.role === "gdda"
        ? getByFanpage({ userId: user.id, role: user.role })
        : Promise.resolve([]),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Report Data — CRM</h1>
        <p className="text-sm text-muted-foreground">
          Quản lý toàn bộ data lead từ các kênh quảng cáo
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Tổng lead"
          value={formatNumber(stats.totalLead)}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="F1"
          value={formatNumber(stats.f1)}
          color="text-red-600"
        />
        <StatCard
          icon={<Phone className="h-5 w-5" />}
          label="Đang chăm"
          value={formatNumber(stats.dangCham)}
          color="text-orange-600"
        />
        <StatCard
          icon={<CalendarCheck className="h-5 w-5" />}
          label="Booking"
          value={formatNumber(stats.booking)}
          color="text-emerald-600"
        />
        <StatCard
          icon={<Trophy className="h-5 w-5" />}
          label="Deal"
          value={formatNumber(stats.deal)}
          color="text-green-700"
        />
      </div>

      {/* Filter bar — chỉ admin/digital */}
      {isAdminOrDigital && (
        <ReportFilters
          projects={filterOptions.projects}
          stages={filterOptions.stages}
        />
      )}

      {/* Split view theo role */}
      {user.role === "gdda" ? (
        <GddaReportTabs
          summaryByDate={summaryByDate}
          byEmployee={byEmployee}
          byFanpage={byFanpage}
          leadDetail={leadDetail}
          currentPage={page}
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <LeadDetailTable
              rows={leadDetail.rows}
              total={leadDetail.total}
              currentPage={page}
              pageSize={50}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-md bg-primary/10 p-2 text-primary">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-xl font-semibold ${color ?? ""}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
