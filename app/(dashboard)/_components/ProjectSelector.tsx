import Link from "next/link";
import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber, formatCurrencyShort } from "@/lib/utils/format";
import type { ProjectCardData } from "@/lib/queries/projects";

interface ProjectSelectorProps {
  projects: ProjectCardData[];
  basePath: string;
  title: string;
  description?: string;
}

export function ProjectSelector({
  projects,
  basePath,
  title,
  description,
}: ProjectSelectorProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Building2 className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            Chưa có dự án nào
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Liên hệ quản trị viên để được thêm vào dự án.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <ProjectSelectorCard
              key={project.id}
              project={project}
              basePath={basePath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ProjectSelectorCardProps {
  project: ProjectCardData;
  basePath: string;
}

function ProjectSelectorCard({ project: p, basePath }: ProjectSelectorCardProps) {
  return (
    <Link href={`${basePath}?project=${p.id}`} className="block">
      <Card className="cursor-pointer border transition-shadow hover:shadow-md">
        <CardContent className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold">{p.name}</h3>
              {p.location && (
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {p.location}
                </p>
              )}
            </div>
            <StatusBadge status={p.status} />
          </div>

          {/* Stats row */}
          <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-4">
            <SelectorMetric
              label="Tổng Lead"
              value={formatNumber(p.totalLead)}
            />
            <SelectorMetric
              label="Lead F1"
              value={formatNumber(p.leadF1)}
              highlight="text-red-600"
            />
            <SelectorMetric
              label="Ngân sách"
              value={formatCurrencyShort(p.budget)}
              highlight="text-blue-700"
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

interface SelectorMetricProps {
  label: string;
  value: string;
  highlight?: string;
}

function SelectorMetric({ label, value, highlight }: SelectorMetricProps) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={["text-sm font-semibold", highlight ?? ""].join(" ")}>
        {value}
      </p>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: "running" | "warning" | "paused";
}) {
  const variants = {
    running: { label: "Đang chạy", className: "bg-green-100 text-green-700" },
    warning: { label: "Cảnh báo", className: "bg-orange-100 text-orange-700" },
    paused: { label: "Tạm dừng", className: "bg-zinc-100 text-zinc-700" },
  };
  const v = variants[status];
  return (
    <Badge className={["shrink-0", v.className].join(" ")}>{v.label}</Badge>
  );
}
