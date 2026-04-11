import Link from "next/link";
import { Inbox } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { formatDateTimeVN, formatNumber } from "@/lib/utils/format";
import { stageBadgeVariant } from "@/lib/utils/stage-badge";
import type { LeadDetailRow } from "@/lib/queries/report";

/**
 * Generate page numbers with dots: [1, 2, ..., 5, 6, 7, ..., 16, 17]
 */
function getPageNumbers(
  current: number,
  total: number,
): Array<number | "..."> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: Array<number | "..."> = [];

  // Always show first page
  pages.push(1);

  if (current > 3) pages.push("...");

  // Window around current
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) pages.push("...");

  // Always show last page
  pages.push(total);

  return pages;
}

interface LeadDetailTableProps {
  rows: LeadDetailRow[];
  total: number;
  currentPage: number;
  pageSize: number;
  /** Current search params to preserve when paginating */
  searchParams?: Record<string, string | undefined>;
}

export function LeadDetailTable({
  rows,
  total,
  currentPage,
  pageSize,
  searchParams = {},
}: LeadDetailTableProps) {
  const totalPages = Math.ceil(total / pageSize);

  /** Build page URL preserving current filters */
  function pageUrl(page: number): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v && k !== "page") sp.set(k, v);
    }
    sp.set("page", String(page));
    return `/report?${sp.toString()}`;
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Inbox />}
        title="Chưa có lead nào"
        description="Chưa có lead nào khớp với bộ lọc hiện tại."
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Tổng: <span className="font-medium text-foreground">{formatNumber(total)}</span> bản ghi
      </p>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cập nhật</TableHead>
              <TableHead>Created Time</TableHead>
              <TableHead>Full Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Tình trạng</TableHead>
              <TableHead>Dự án</TableHead>
              <TableHead>Fanpage</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Adset</TableHead>
              <TableHead>Ad</TableHead>
              <TableHead>Form Name</TableHead>
              <TableHead>Lead ID</TableHead>
              <TableHead>Nguồn</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-xs font-medium text-foreground">
                  {formatDateTimeVN((r as Record<string, unknown>).updatedAt as Date | string | null)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDateTimeVN(r.fbCreatedAt)}
                </TableCell>
                <TableCell className="font-medium">{r.fullName}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.email ?? "—"}
                </TableCell>
                <TableCell>
                  {r.stageLabel ? (
                    <Badge variant={stageBadgeVariant(r.stageLabel)}>
                      {r.stageLabel}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="max-w-[140px] truncate">
                  {r.projectName}
                </TableCell>
                <TableCell className="max-w-[140px] truncate">
                  {r.fanpageName ?? "—"}
                </TableCell>
                <TableCell className="max-w-[180px] truncate text-xs">
                  {r.campaignName ?? "—"}
                </TableCell>
                <TableCell className="max-w-[120px] truncate text-xs">
                  {r.adsetName ?? "—"}
                </TableCell>
                <TableCell className="max-w-[120px] truncate text-xs">
                  {r.adName ?? "—"}
                </TableCell>
                <TableCell className="max-w-[120px] truncate text-xs">
                  {r.formName ?? "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.fbLeadId ?? "—"}
                </TableCell>
                <TableCell className="text-xs">{r.sourceName ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-3">
          <p className="text-sm text-muted-foreground">
            Trang {currentPage} / {totalPages}
          </p>
          <div className="flex items-center gap-1">
            {/* Prev */}
            {currentPage > 1 ? (
              <Link
                href={pageUrl(currentPage - 1)}
                className="rounded-md border px-2.5 py-1 text-sm hover:bg-muted"
              >
                ‹
              </Link>
            ) : (
              <span className="rounded-md border px-2.5 py-1 text-sm text-muted-foreground/40">
                ‹
              </span>
            )}

            {/* Page numbers */}
            {getPageNumbers(currentPage, totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`dots-${i}`} className="px-1 text-sm text-muted-foreground">
                  ···
                </span>
              ) : (
                <Link
                  key={p}
                  href={pageUrl(p)}
                  className={cn(
                    "min-w-[32px] rounded-md px-2.5 py-1 text-center text-sm transition-colors",
                    p === currentPage
                      ? "bg-primary text-primary-foreground"
                      : "border hover:bg-muted",
                  )}
                >
                  {p}
                </Link>
              ),
            )}

            {/* Next */}
            {currentPage < totalPages ? (
              <Link
                href={pageUrl(currentPage + 1)}
                className="rounded-md border px-2.5 py-1 text-sm hover:bg-muted"
              >
                ›
              </Link>
            ) : (
              <span className="rounded-md border px-2.5 py-1 text-sm text-muted-foreground/40">
                ›
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
