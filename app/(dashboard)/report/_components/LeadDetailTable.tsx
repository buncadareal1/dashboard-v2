import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils/format";
import type { LeadDetailRow } from "@/lib/queries/report";

interface LeadDetailTableProps {
  rows: LeadDetailRow[];
  total: number;
  currentPage: number;
  pageSize: number;
}

export function LeadDetailTable({
  rows,
  total,
  currentPage,
  pageSize,
}: LeadDetailTableProps) {
  const totalPages = Math.ceil(total / pageSize);

  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Chưa có lead nào.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Tổng: <span className="font-medium text-foreground">{total}</span> bản ghi
      </p>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
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
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDateTime(r.fbCreatedAt)}
                </TableCell>
                <TableCell className="font-medium">{r.fullName}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.email ?? "—"}
                </TableCell>
                <TableCell>
                  {r.stageLabel ? (
                    <Badge
                      style={{
                        backgroundColor: `${r.stageColor ?? "#94a3b8"}20`,
                        color: r.stageColor ?? "#475569",
                      }}
                    >
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
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link
                href={`/report?page=${currentPage - 1}`}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              >
                ← Trước
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={`/report?page=${currentPage + 1}`}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Sau →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
