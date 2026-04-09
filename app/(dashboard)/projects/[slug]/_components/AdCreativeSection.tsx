import { ImageIcon, Trophy } from "lucide-react";
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
import {
  formatNumber,
  formatCurrencyShort,
} from "@/lib/utils/format";
import type { AdCreativeStat } from "@/lib/queries/project-detail";

interface AdCreativeSectionProps {
  ads: AdCreativeStat[];
  totalBudget: number;
}

export function AdCreativeSection({ ads, totalBudget }: AdCreativeSectionProps) {
  const totals = ads.reduce(
    (acc, a) => ({
      f1: acc.f1 + a.leadF1,
      booking: acc.booking + a.booking,
      lead: acc.lead + a.totalLead,
    }),
    { f1: 0, booking: 0, lead: 0 },
  );
  const topAd = [...ads].sort((a, b) => b.leadF1 - a.leadF1)[0];

  return (
    <Card>
      <CardHeader>
        <div>
          <h2 className="text-lg font-semibold">Mẫu quảng cáo hiệu quả</h2>
          <p className="text-sm text-muted-foreground">
            Phân tích và xếp hạng các mẫu quảng cáo theo F1 và Booking
          </p>
        </div>

        {/* Stat bar */}
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatItem label="Tổng F1" value={formatNumber(totals.f1)} />
          <StatItem label="Tổng Booking" value={formatNumber(totals.booking)} />
          <StatItem label="Tổng Lead" value={formatNumber(totals.lead)} />
          <StatItem label="Tổng chi tiêu" value={formatCurrencyShort(totalBudget)} />
        </div>

        {/* Top ad highlight */}
        {topAd && totals.f1 > 0 && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <Trophy className="h-5 w-5 text-emerald-600" />
            <div className="flex-1">
              <p className="text-xs font-medium text-emerald-700">
                🏆 Mẫu quảng cáo hiệu quả nhất
              </p>
              <p className="text-sm">
                <span className="font-semibold">{topAd.name}</span>
                <span className="ml-2 text-muted-foreground">
                  · {topAd.leadF1} F1 · {topAd.booking} Booking · {topAd.totalLead} leads
                </span>
              </p>
            </div>
            <Badge className="bg-emerald-100 text-emerald-700">
              {topAd.score} · {topAd.scoreLabel}
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {ads.length === 0 ? (
          <EmptyState
            icon={<ImageIcon />}
            title="Chưa có mẫu quảng cáo nào"
            description="Upload CSV Facebook Ads để bắt đầu phân tích hiệu quả ad."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead className="w-16"></TableHead>
                <TableHead>TÊN MẪU QUẢNG CÁO</TableHead>
                <TableHead className="text-right">F1</TableHead>
                <TableHead className="text-right">BOOKING</TableHead>
                <TableHead className="text-right">LEAD</TableHead>
                <TableHead className="text-right">CTR</TableHead>
                <TableHead className="text-right">CPL</TableHead>
                <TableHead>SCORE</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ads.map((a, i) => (
                <TableRow key={a.adId}>
                  <TableCell className="font-medium">{i + 1}</TableCell>
                  <TableCell>
                    <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="truncate font-medium">{a.name}</p>
                    {a.formName && (
                      <p className="truncate text-xs text-muted-foreground">
                        {a.formName}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-red-600">
                    {a.leadF1}
                  </TableCell>
                  <TableCell className="text-right">{a.booking}</TableCell>
                  <TableCell className="text-right">{a.totalLead}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    —
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    —
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        a.score >= 90
                          ? "bg-emerald-100 text-emerald-700"
                          : a.score >= 75
                            ? "bg-blue-100 text-blue-700"
                            : a.score >= 60
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-zinc-100 text-zinc-700"
                      }
                    >
                      {a.score} · {a.scoreLabel}
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

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
