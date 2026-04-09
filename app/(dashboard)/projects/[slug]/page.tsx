import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, DollarSign, Users, TrendingDown, Target } from "lucide-react";
import { eq, and } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { assertCanViewProject } from "@/lib/auth/guards";
import { db } from "@/db";
import { projectUsers } from "@/db/schema";
import {
  getProjectDetailBySlug,
  getCampaignStats,
  getAdCreativeStats,
} from "@/lib/queries/project-detail";
import { getUploadHistory } from "@/lib/queries/uploads";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CampaignSection } from "./_components/CampaignSection";
import { AdCreativeSection } from "./_components/AdCreativeSection";
import { UploadCsvSection } from "./_components/UploadCsvSection";
import { ProjectHeaderActions } from "./_components/ProjectHeaderActions";
import {
  formatNumber,
  formatCurrencyShort,
  formatPercent,
} from "@/lib/utils/format";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "gdda") redirect("/report");

  const { slug } = await params;
  const project = await getProjectDetailBySlug(slug);
  if (!project) notFound();

  await assertCanViewProject(user.id, user.role, project.id);

  // Check edit permission cho upload section
  let canEdit = user.role === "admin";
  if (!canEdit) {
    const pu = await db.query.projectUsers.findFirst({
      where: and(
        eq(projectUsers.userId, user.id),
        eq(projectUsers.projectId, project.id),
      ),
    });
    canEdit = pu?.canEdit ?? false;
  }

  const [campaignStats, adStats, uploadHistory] = await Promise.all([
    getCampaignStats(project.id),
    getAdCreativeStats(project.id),
    getUploadHistory(project.id, 10),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{project.name}</h1>
              <StatusBadge status={project.status} />
            </div>
            {project.location && (
              <p className="mt-1 text-sm text-muted-foreground">
                {project.location}
              </p>
            )}
          </div>
          {canEdit && (
            <ProjectHeaderActions slug={project.slug} current={project.status} />
          )}
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Tổng ngân sách"
          value={formatCurrencyShort(project.budget)}
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Tổng Lead"
          value={formatNumber(project.totalLead)}
        />
        <StatCard
          icon={<TrendingDown className="h-5 w-5" />}
          label="CPL"
          value={formatCurrencyShort(project.cpl)}
        />
        <StatCard
          icon={<Target className="h-5 w-5" />}
          label="F1 Rate"
          value={formatPercent(project.f1Rate)}
        />
      </div>

      {/* Campaign Section */}
      <CampaignSection campaigns={campaignStats} />

      {/* Ad Creative Section */}
      <AdCreativeSection ads={adStats} totalBudget={project.budget} />

      {/* Upload CSV Section */}
      <UploadCsvSection
        projectId={project.id}
        history={uploadHistory}
        canEdit={canEdit}
      />
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
    running: { label: "Đang hoạt động", className: "bg-green-100 text-green-700" },
    warning: { label: "Cảnh báo", className: "bg-orange-100 text-orange-700" },
    paused: { label: "Tạm dừng", className: "bg-zinc-100 text-zinc-700" },
  };
  const v = variants[status];
  return <Badge className={v.className}>{v.label}</Badge>;
}
