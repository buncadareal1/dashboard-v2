"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyShort, formatNumber, formatPercent } from "@/lib/utils/format";
import type { CampaignAnalysisRow } from "@/lib/queries/campaign-analysis";
import { CampaignActionInlineEdit } from "./CampaignActionInlineEdit";

interface CampaignAnalysisTableProps {
  rows: CampaignAnalysisRow[];
  canEdit: boolean;
}

type StatusFilter = "on" | "off" | "all";
type SortKey = "cplF1" | "spend" | "leadF1" | "rateCrm";
type SortDir = "asc" | "desc";

const EFFICIENCY_LABELS: Record<CampaignAnalysisRow["efficiencyRating"], string> = {
  winner: "⭐ WINNER",
  good: "✅ Tốt",
  average: "📊 TB",
  high: "⚠️ Cao",
  test: "🆕 Test",
};

const EFFICIENCY_CLASS: Record<CampaignAnalysisRow["efficiencyRating"], string> = {
  winner: "bg-yellow-50 text-yellow-800 border-yellow-200",
  good: "bg-green-50 text-green-700 border-green-200",
  average: "bg-blue-50 text-blue-700 border-blue-200",
  high: "bg-red-50 text-red-700 border-red-200",
  test: "bg-slate-50 text-slate-600 border-slate-200",
};

const CONTENT_LABELS: Record<NonNullable<CampaignAnalysisRow["contentRating"]>, string> = {
  good: "✅ Tốt",
  average: "📊 TB",
  poor: "⚠️ Kém",
};

const CONTENT_CLASS: Record<NonNullable<CampaignAnalysisRow["contentRating"]>, string> = {
  good: "bg-green-50 text-green-700 border-green-200",
  average: "bg-blue-50 text-blue-700 border-blue-200",
  poor: "bg-orange-50 text-orange-700 border-orange-200",
};

const TYPE_CLASS: Record<CampaignAnalysisRow["campaignType"], string> = {
  LF: "bg-violet-100 text-violet-700",
  MESS: "bg-sky-100 text-sky-700",
  OTHER: "bg-zinc-100 text-zinc-600",
};

function sortRows(
  rows: CampaignAnalysisRow[],
  key: SortKey,
  dir: SortDir,
): CampaignAnalysisRow[] {
  return [...rows].sort((a, b) => {
    let av: number;
    let bv: number;

    switch (key) {
      case "cplF1":
        // nulls last
        av = a.cplF1 ?? Infinity;
        bv = b.cplF1 ?? Infinity;
        break;
      case "spend":
        av = a.spend ?? 0;
        bv = b.spend ?? 0;
        break;
      case "leadF1":
        av = a.leadF1;
        bv = b.leadF1;
        break;
      case "rateCrm":
        av = a.rateCrm ?? 0;
        bv = b.rateCrm ?? 0;
        break;
    }

    return dir === "asc" ? av - bv : bv - av;
  });
}

export function CampaignAnalysisTable({ rows, canEdit }: CampaignAnalysisTableProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("on");
  const [sortKey, setSortKey] = useState<SortKey>("cplF1");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filtered = rows.filter((r) => {
    if (statusFilter === "all") return true;
    return r.statusLabel === statusFilter;
  });

  const sorted = sortRows(filtered, sortKey, sortDir);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortIndicator = (key: SortKey) => {
    if (key !== sortKey) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Hiển thị:</span>
        {(["on", "off", "all"] as StatusFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={[
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              statusFilter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            ].join(" ")}
          >
            {f === "on" ? "Đang chạy" : f === "off" ? "Tạm dừng" : "Tất cả"}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {sorted.length} chiến dịch
        </span>
      </div>

      {/* Color legend */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-4 py-2 text-xs">
        <span className="font-medium text-muted-foreground">Hiệu quả (CPL):</span>
        <span className="text-yellow-700">⭐ WINNER &lt;150K</span>
        <span className="text-green-700">✅ Tốt 150-300K</span>
        <span className="text-blue-700">📊 TB 300-500K</span>
        <span className="text-red-700">⚠️ Cao &gt;500K</span>
        <span className="text-slate-600">🆕 Test &lt;5 lead</span>
      </div>

      {/* Main table */}
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            {/* Column group headers */}
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-[60px] border-r text-center text-xs" colSpan={2}>
                Chiến dịch
              </TableHead>
              <TableHead className="border-r text-center text-xs text-blue-600" colSpan={5}>
                META API (từ Facebook)
              </TableHead>
              <TableHead className="border-r text-center text-xs text-emerald-600" colSpan={4}>
                CRM (từ CSV Bitrix)
              </TableHead>
              <TableHead className="text-center text-xs text-violet-600" colSpan={2}>
                HIỆU QUẢ
              </TableHead>
            </TableRow>
            {/* Column names */}
            <TableRow className="border-b bg-muted/20 hover:bg-muted/20">
              <TableHead className="w-[40px] text-center text-xs">#</TableHead>
              <TableHead className="min-w-[180px] border-r text-xs">Chiến dịch</TableHead>
              <TableHead className="text-right text-xs">
                <button onClick={() => handleSort("spend")} className="hover:text-foreground">
                  Chi tiêu{sortIndicator("spend")}
                </button>
              </TableHead>
              <TableHead className="text-right text-xs">Lead</TableHead>
              <TableHead className="text-right text-xs">CPL</TableHead>
              <TableHead className="text-right text-xs">CTR%</TableHead>
              <TableHead className="border-r text-right text-xs">Freq</TableHead>
              <TableHead className="text-right text-xs">Lead</TableHead>
              <TableHead className="text-right text-xs">
                <button onClick={() => handleSort("leadF1")} className="hover:text-foreground">
                  F1{sortIndicator("leadF1")}
                </button>
              </TableHead>
              <TableHead className="text-right text-xs">
                <button onClick={() => handleSort("rateCrm")} className="hover:text-foreground">
                  Rate F1%{sortIndicator("rateCrm")}
                </button>
              </TableHead>
              <TableHead className="border-r text-right text-xs">
                <button onClick={() => handleSort("cplF1")} className="hover:text-foreground">
                  CPL/F1{sortIndicator("cplF1")}
                </button>
              </TableHead>
              <TableHead className="text-center text-xs">HQ</TableHead>
              <TableHead className="text-center text-xs">CL</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="py-10 text-center text-sm text-muted-foreground">
                  Không có chiến dịch nào.
                  {statusFilter !== "all" && (
                    <button
                      onClick={() => setStatusFilter("all")}
                      className="ml-2 text-primary underline-offset-2 hover:underline"
                    >
                      Xem tất cả
                    </button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((row, idx) => (
                <CampaignRow key={row.campaignId} row={row} canEdit={canEdit} index={idx + 1} />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CampaignRow({
  row,
  canEdit,
  index,
}: {
  row: CampaignAnalysisRow;
  canEdit: boolean;
  index: number;
}) {
  return (
    <>
      {/* Data row */}
      <TableRow className="border-b">
        {/* # */}
        <TableCell className="text-center text-xs text-muted-foreground tabular-nums">
          {index}
        </TableCell>

        {/* Tên chiến dịch + trạng thái */}
        <TableCell className="border-r font-medium min-w-[250px]">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm whitespace-normal break-words">{row.campaignName}</span>
              <Badge
                className={
                  row.statusLabel === "on"
                    ? "bg-emerald-100 text-emerald-700 shrink-0"
                    : "bg-zinc-100 text-zinc-600 shrink-0"
                }
              >
                {row.statusLabel === "on" ? "ON" : "OFF"}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">{row.projectName}</span>
          </div>
        </TableCell>

        {/* Chi tiêu (FB) */}
        <TableCell className="text-right tabular-nums text-sm">
          {row.spend != null && row.spend > 0 ? formatCurrencyShort(row.spend) : "—"}
        </TableCell>

        {/* Lead (FB) */}
        <TableCell className="text-right tabular-nums text-sm">
          {row.leads != null && row.leads > 0 ? formatNumber(row.leads) : "—"}
        </TableCell>

        {/* CPL = spend / FB leads */}
        <TableCell className="text-right tabular-nums text-sm">
          {row.cplFb != null ? formatCurrencyShort(row.cplFb) : "—"}
        </TableCell>

        {/* CTR% */}
        <TableCell className="text-right tabular-nums text-sm">
          {row.ctr != null ? `${row.ctr.toFixed(2)}%` : "—"}
        </TableCell>

        {/* Freq */}
        <TableCell className="border-r text-right tabular-nums text-sm">
          {row.frequency != null ? row.frequency.toFixed(2) : "—"}
        </TableCell>

        {/* Lead (CRM) */}
        <TableCell className="text-right tabular-nums text-sm">
          {row.totalLeadCrm > 0 ? formatNumber(row.totalLeadCrm) : "—"}
        </TableCell>

        {/* F1 (CRM) */}
        <TableCell className="text-right tabular-nums text-sm font-medium">
          {row.leadF1 > 0 ? formatNumber(row.leadF1) : "—"}
        </TableCell>

        {/* Rate F1% = F1 / CRM leads */}
        <TableCell className="text-right tabular-nums text-sm">
          {row.rateCrm != null ? formatPercent(row.rateCrm) : "—"}
        </TableCell>

        {/* CPL/F1 = spend / F1 */}
        <TableCell className="border-r text-right tabular-nums text-sm font-semibold">
          {row.cplF1 != null ? formatCurrencyShort(row.cplF1) : "—"}
        </TableCell>

        {/* Hiệu quả */}
        <TableCell className="text-center">
          <span
            className={[
              "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
              EFFICIENCY_CLASS[row.efficiencyRating],
            ].join(" ")}
          >
            {EFFICIENCY_LABELS[row.efficiencyRating]}
          </span>
        </TableCell>

        {/* Chất lượng Content */}
        <TableCell className="text-center">
          {row.contentRating != null ? (
            <span
              className={[
                "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                CONTENT_CLASS[row.contentRating],
              ].join(" ")}
            >
              {CONTENT_LABELS[row.contentRating]}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
      </TableRow>

      {/* Action plan row */}
      <TableRow className="border-b bg-muted/10 hover:bg-muted/10">
        <TableCell colSpan={14} className="py-2 pl-4 pr-2">
          <CampaignActionInlineEdit
            campaignId={row.campaignId}
            campaignName={row.campaignName}
            initialData={{
              priority: row.priority,
              plan: row.plan,
              contentNote: row.contentNote,
              todayAction: row.todayAction,
              actionDetail: row.actionDetail,
              assignee: row.assignee,
              deadline: row.deadline,
            }}
            canEdit={canEdit}
          />
        </TableCell>
      </TableRow>
    </>
  );
}
