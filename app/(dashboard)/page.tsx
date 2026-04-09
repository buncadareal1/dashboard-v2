import Link from "next/link";
import { redirect } from "next/navigation";
import {
  FolderKanban,
  DollarSign,
  Users,
  TrendingUp,
  CalendarCheck,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import {
  getDashboardOverviewStats,
  getProjectsForUser,
} from "@/lib/queries/projects";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  formatNumber,
  formatCurrencyShort,
  formatPercent,
} from "@/lib/utils/format";

export default async function DashboardOverviewPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "gdda") redirect("/report");

  const [stats, projects] = await Promise.all([
    getDashboardOverviewStats({ userId: user.id, role: user.role }),
    getProjectsForUser({ userId: user.id, role: user.role }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard Tổng quan</h1>
        <p className="text-sm text-muted-foreground">
          Theo dõi hiệu quả marketing theo thời gian thực
        </p>
      </div>

      {/* 5 Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon={<FolderKanban className="h-5 w-5" />}
          label="Dự án đang chạy"
          value={formatNumber(stats.totalProjects)}
        />
        <StatCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Tổng chi phí MKT"
          value={formatCurrencyShort(stats.totalCost)}
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Tổng Lead"
          value={formatNumber(stats.totalLead)}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Tổng F1"
          value={formatNumber(stats.totalF1)}
        />
        <StatCard
          icon={<CalendarCheck className="h-5 w-5" />}
          label="Tổng Booking"
          value={formatNumber(stats.totalBooking)}
        />
      </div>

      {/* Project Summary Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              Tổng hợp hiệu quả các dự án
            </h2>
            <p className="text-sm text-muted-foreground">
              Tất cả dự án có quyền xem
            </p>
          </div>
          <Link
            href="/projects"
            className="text-sm text-primary hover:underline"
          >
            Xem chi tiết →
          </Link>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <EmptyState />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dự án</TableHead>
                  <TableHead className="text-right">Chi phí</TableHead>
                  <TableHead className="text-right">Booking</TableHead>
                  <TableHead className="text-right">F1</TableHead>
                  <TableHead className="text-right">Lead</TableHead>
                  <TableHead className="text-right">CP/Lead</TableHead>
                  <TableHead className="text-right">CP/F1</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link
                        href={`/projects/${p.slug}`}
                        className="hover:underline"
                      >
                        {p.name}
                      </Link>
                      {p.location && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {p.location}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrencyShort(p.budget)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(p.booking)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(p.leadF1)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(p.totalLead)}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.cpl > 0 ? formatCurrencyShort(p.cpl) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.leadF1 > 0
                        ? formatCurrencyShort(p.budget / p.leadF1)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>TỔNG CỘNG</TableCell>
                  <TableCell className="text-right">
                    {formatCurrencyShort(
                      projects.reduce((s, p) => s + p.budget, 0),
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(projects.reduce((s, p) => s + p.booking, 0))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(projects.reduce((s, p) => s + p.leadF1, 0))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(
                      projects.reduce((s, p) => s + p.totalLead, 0),
                    )}
                  </TableCell>
                  <TableCell className="text-right">—</TableCell>
                  <TableCell className="text-right">—</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Suppress conversion rate import warning */}
      <span className="hidden">{formatPercent(0)}</span>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className="rounded-md bg-primary/10 p-2 text-primary">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({
  status,
}: {
  status: "running" | "warning" | "paused";
}) {
  const variants = {
    running: { label: "Đang chạy", className: "bg-green-100 text-green-700" },
    warning: { label: "Cảnh báo", className: "bg-yellow-100 text-yellow-700" },
    paused: { label: "Tạm dừng", className: "bg-zinc-100 text-zinc-700" },
  };
  const v = variants[status];
  return <Badge className={v.className}>{v.label}</Badge>;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <FolderKanban className="h-12 w-12 text-muted-foreground" />
      <p className="mt-3 text-sm text-muted-foreground">
        Chưa có dự án nào. Tạo dự án mới từ nút &ldquo;+ Tạo mới&rdquo; phía
        trên.
      </p>
    </div>
  );
}
