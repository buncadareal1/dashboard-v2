"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LeadDetailTable } from "./LeadDetailTable";
import { formatNumber, formatPercent } from "@/lib/utils/format";
import type {
  SummaryByDateRow,
  ByEmployeeRow,
  ByFanpageRow,
  LeadDetailRow,
} from "@/lib/queries/report";

interface GddaReportTabsProps {
  summaryByDate: SummaryByDateRow[];
  byEmployee: ByEmployeeRow[];
  byFanpage: ByFanpageRow[];
  leadDetail: { rows: LeadDetailRow[]; total: number };
  currentPage: number;
}

/**
 * 4 sub-tabs Excel format dành cho GDDA — tái tạo format báo cáo Excel mẫu.
 */
export function GddaReportTabs({
  summaryByDate,
  byEmployee,
  byFanpage,
  leadDetail,
  currentPage,
}: GddaReportTabsProps) {
  return (
    <Tabs defaultValue="summary">
      <TabsList>
        <TabsTrigger value="summary">Tóm Tắt</TabsTrigger>
        <TabsTrigger value="employee">Theo Nhân Viên</TabsTrigger>
        <TabsTrigger value="fanpage">Theo Nguồn Fanpage</TabsTrigger>
        <TabsTrigger value="detail">Chi Tiết Leads</TabsTrigger>
      </TabsList>

      {/* TAB 1 — Tóm tắt theo ngày */}
      <TabsContent value="summary">
        <Card>
          <CardContent className="overflow-x-auto pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày</TableHead>
                  <TableHead className="text-right">Tổng Leads</TableHead>
                  <TableHead className="text-right">F1</TableHead>
                  <TableHead className="text-right">Đang Chăm</TableHead>
                  <TableHead className="text-right">Không Bắt Máy</TableHead>
                  <TableHead className="text-right">Thuê Bao</TableHead>
                  <TableHead className="text-right">Chào DA Khác</TableHead>
                  <TableHead className="text-right">Môi Giới</TableHead>
                  <TableHead className="text-right">Khác</TableHead>
                  <TableHead className="text-right">F1 Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryByDate.map((r) => (
                  <TableRow key={r.date}>
                    <TableCell>{r.date}</TableCell>
                    <TableCell className="text-right">{r.totalLead}</TableCell>
                    <TableCell className="text-right">{r.f1}</TableCell>
                    <TableCell className="text-right">{r.dangCham}</TableCell>
                    <TableCell className="text-right">
                      {r.khongBatMay}
                    </TableCell>
                    <TableCell className="text-right">{r.thueBao}</TableCell>
                    <TableCell className="text-right">{r.chaoDaKhac}</TableCell>
                    <TableCell className="text-right">{r.moiGioi}</TableCell>
                    <TableCell className="text-right">{r.khac}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPercent(r.f1Rate, 0)}
                    </TableCell>
                  </TableRow>
                ))}
                {summaryByDate.length > 0 && (
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>TỔNG</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(
                        summaryByDate.reduce((s, r) => s + r.totalLead, 0),
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(summaryByDate.reduce((s, r) => s + r.f1, 0))}
                    </TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell />
                    <TableCell />
                    <TableCell />
                    <TableCell />
                    <TableCell className="text-right">
                      {formatPercent(
                        summaryByDate.reduce((s, r) => s + r.f1, 0) /
                          Math.max(
                            1,
                            summaryByDate.reduce((s, r) => s + r.totalLead, 0),
                          ),
                        1,
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* TAB 2 — Theo nhân viên */}
      <TabsContent value="employee">
        <Card>
          <CardContent className="overflow-x-auto pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nhân Viên</TableHead>
                  <TableHead className="text-right">Tổng Leads</TableHead>
                  <TableHead className="text-right">F1</TableHead>
                  <TableHead className="text-right">Đang Chăm (2h)</TableHead>
                  <TableHead className="text-right">Thuê Bao KLL</TableHead>
                  <TableHead className="text-right">Không Bắt Máy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byEmployee.map((r) => (
                  <TableRow key={r.employeeName}>
                    <TableCell className="font-medium">
                      {r.employeeName}
                    </TableCell>
                    <TableCell className="text-right">{r.totalLead}</TableCell>
                    <TableCell className="text-right">{r.f1}</TableCell>
                    <TableCell className="text-right">{r.dangCham}</TableCell>
                    <TableCell className="text-right">{r.thueBao}</TableCell>
                    <TableCell className="text-right">
                      {r.khongBatMay}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* TAB 3 — Theo nguồn fanpage */}
      <TabsContent value="fanpage">
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nguồn / Fanpage</TableHead>
                  <TableHead className="text-right">Số Leads</TableHead>
                  <TableHead className="text-right">Tỷ lệ %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byFanpage.map((r) => (
                  <TableRow key={r.fanpageName}>
                    <TableCell className="font-medium">
                      {r.fanpageName}
                    </TableCell>
                    <TableCell className="text-right">{r.totalLead}</TableCell>
                    <TableCell className="text-right">
                      {formatPercent(r.percentage, 1)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* TAB 4 — Chi tiết leads */}
      <TabsContent value="detail">
        <Card>
          <CardContent className="pt-6">
            <LeadDetailTable
              rows={leadDetail.rows}
              total={leadDetail.total}
              currentPage={currentPage}
              pageSize={50}
            />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
