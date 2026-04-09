import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  formatNumber,
  formatCurrencyShort,
  formatPercent,
} from "@/lib/utils/format";
import type { ProjectCardData } from "@/lib/queries/projects";

interface ProjectCardProps {
  project: ProjectCardData;
}

export function ProjectCard({ project: p }: ProjectCardProps) {
  return (
    <Link href={`/projects/${p.slug}`} className="block">
      <Card className="cursor-pointer p-5 transition-shadow hover:shadow-md">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold">{p.name}</h3>
            {p.location && (
              <p className="text-sm text-muted-foreground">{p.location}</p>
            )}
          </div>
          <StatusBadge status={p.status} />
        </div>

        {/* Top row metrics */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          <Metric label="Ngân sách" value={formatCurrencyShort(p.budget)} />
          <Metric label="Tổng Lead" value={formatNumber(p.totalLead)} />
          <Metric label="CPL" value={formatCurrencyShort(p.cpl)} />
        </div>

        {/* Bottom row metrics */}
        <div className="mt-3 grid grid-cols-3 gap-4">
          <Metric
            label="Lead F1"
            value={formatNumber(p.leadF1)}
            highlight="text-red-600"
          />
          <Metric label="Conversion" value={formatPercent(p.conversionRate)} />
          <Metric label="Booking" value={formatNumber(p.booking)} />
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between border-t pt-3">
          {p.manager ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">
                  {p.manager.name?.[0]?.toUpperCase() ?? "U"}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">
                {p.manager.name ?? p.manager.email}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Chưa gán</span>
          )}
          <div className="flex flex-wrap gap-1">
            {p.fanpages.slice(0, 3).map((fp) => (
              <Badge key={fp} variant="secondary" className="text-xs">
                {fp}
              </Badge>
            ))}
          </div>
        </div>
      </Card>
    </Link>
  );
}

interface MetricProps {
  label: string;
  value: string;
  highlight?: string;
}

function Metric({ label, value, highlight }: MetricProps) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-base font-semibold ${highlight ?? ""}`}>{value}</p>
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
  return <Badge className={v.className}>{v.label}</Badge>;
}
