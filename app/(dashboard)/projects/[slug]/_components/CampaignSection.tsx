"use client";

import { useState, useMemo } from "react";
import { Megaphone, Search } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CampaignStatusToggle } from "./CampaignStatusToggle";
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

type StatusFilter = "all" | "on" | "off";
const PAGE_SIZE = 10;

export function CampaignSection({ campaigns }: CampaignSectionProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Filter
  const filtered = useMemo(() => {
    let result = campaigns;
    if (statusFilter !== "all") {
      result = result.filter((c) => c.statusLabel === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(q));
    }
    return result;
  }, [campaigns, statusFilter, search]);

  // Stats from filtered
  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, c) => ({
          lead: acc.lead + c.totalLead,
          f1: acc.f1 + c.leadF1,
          dangCham: acc.dangCham + c.leadDangCham,
        }),
        { lead: 0, f1: 0, dangCham: 0 },
      ),
    [filtered],
  );

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when filter changes
  const updateStatusFilter = (f: StatusFilter) => {
    setStatusFilter(f);
    setPage(1);
  };
  const updateSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  // Counts for filter buttons
  const counts = {
    all: campaigns.length,
    on: campaigns.filter((c) => c.statusLabel === "on").length,
    off: campaigns.filter((c) => c.statusLabel === "off").length,
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Chiến dịch</h2>
            <p className="text-sm text-muted-foreground">
              {filtered.length} chiến dịch · F1: {formatNumber(totals.f1)} · Lead: {formatNumber(totals.lead)}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* Status toggle */}
          {(["all", "on", "off"] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => updateStatusFilter(f)}
              className={[
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              ].join(" ")}
            >
              {f === "all" ? `Tất cả (${counts.all})` : f === "on" ? `Đang chạy (${counts.on})` : `Tạm dừng (${counts.off})`}
            </button>
          ))}

          {/* Search */}
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Tìm campaign..."
              value={search}
              onChange={(e) => updateSearch(e.target.value)}
              className="h-8 rounded-md border bg-background pl-8 pr-3 text-xs outline-none transition-colors focus:ring-1 focus:ring-primary w-48"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {campaigns.length === 0 ? (
          <EmptyState
            icon={<Megaphone />}
            title="Chưa có chiến dịch nào"
            description="Upload CSV Facebook Ads để bắt đầu xem dữ liệu campaign."
          />
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Không có chiến dịch nào khớp bộ lọc.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px] text-center">#</TableHead>
                  <TableHead>CAMPAIGN</TableHead>
                  <TableHead className="text-right">F1</TableHead>
                  <TableHead className="text-right">ĐANG CHĂM</TableHead>
                  <TableHead className="text-right">TỔNG LEAD</TableHead>
                  <TableHead className="text-right">TỈ LỆ</TableHead>
                  <TableHead>TRẠNG THÁI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((c, idx) => (
                  <TableRow key={c.campaignId}>
                    <TableCell className="text-center text-xs text-muted-foreground tabular-nums">
                      {(page - 1) * PAGE_SIZE + idx + 1}
                    </TableCell>
                    <TableCell className="font-medium">
                      <span
                        className={`mr-2 inline-block h-2 w-2 rounded-full ${
                          c.statusLabel === "on" ? "bg-emerald-500" : "bg-zinc-300"
                        }`}
                      />
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
                      <CampaignStatusToggle
                        campaignId={c.campaignId}
                        statusLabel={c.statusLabel}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between border-t pt-3">
                <p className="text-xs text-muted-foreground">
                  Trang {page} / {totalPages}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-30"
                  >
                    ‹
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let p: number;
                    if (totalPages <= 5) p = i + 1;
                    else if (page <= 3) p = i + 1;
                    else if (page >= totalPages - 2) p = totalPages - 4 + i;
                    else p = page - 2 + i;
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={[
                          "min-w-[28px] rounded-md px-2 py-1 text-xs",
                          p === page
                            ? "bg-primary text-primary-foreground"
                            : "border hover:bg-muted",
                        ].join(" ")}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-30"
                  >
                    ›
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
