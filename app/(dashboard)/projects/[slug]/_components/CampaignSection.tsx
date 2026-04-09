import { Megaphone } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber, formatPercent } from "@/lib/utils/format";
import type { CampaignStat } from "@/lib/queries/project-detail";

interface CampaignSectionProps {
  campaigns: CampaignStat[];
}

export function CampaignSection({ campaigns }: CampaignSectionProps) {
  const totals = campaigns.reduce(
    (acc, c) => ({
      lead: acc.lead + c.totalLead,
      f1: acc.f1 + c.leadF1,
      dangCham: acc.dangCham + c.leadDangCham,
    }),
    { lead: 0, f1: 0, dangCham: 0 },
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Chiến dịch đang hoạt động</h2>
            <p className="text-sm text-muted-foreground">
              Dữ liệu được đồng bộ từ CSV Facebook (Phase 1)
            </p>
          </div>
        </div>

        {/* Stat bar */}
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatItem label="Chi tiêu" value="—" hint="Phase 2" />
          <StatItem label="Hiển thị" value="—" hint="Phase 2" />
          <StatItem label="Tổng F1" value={formatNumber(totals.f1)} />
          <StatItem label="Tổng Lead" value={formatNumber(totals.lead)} />
        </div>
      </CardHeader>
      <CardContent>
        {campaigns.length === 0 ? (
          <EmptyState
            icon={<Megaphone />}
            title="Chưa có chiến dịch nào"
            description="Upload CSV Facebook Ads để bắt đầu xem dữ liệu campaign."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CAMPAIGN</TableHead>
                <TableHead className="text-right">F1</TableHead>
                <TableHead className="text-right">ĐANG CHĂM</TableHead>
                <TableHead className="text-right">TỔNG LEAD</TableHead>
                <TableHead className="text-right">TỈ LỆ</TableHead>
                <TableHead>TRẠNG THÁI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.campaignId}>
                  <TableCell className="max-w-md truncate font-medium">
                    <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />
                    {c.name}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(c.leadF1)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(c.leadDangCham)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(c.totalLead)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPercent(c.qualifyRate, 0)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={c.statusLabel === "on" ? "default" : "secondary"}
                      className={
                        c.statusLabel === "on"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-zinc-100 text-zinc-600"
                      }
                    >
                      {c.statusLabel.toUpperCase()}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function StatItem({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
