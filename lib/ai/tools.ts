import { tool } from "ai";
import { z } from "zod";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  leads,
  stages,
  campaigns,
  employees,
  projects,
  projectCosts,
} from "@/db/schema";

/**
 * AI tools cho dashboard analyst — mỗi tool có RBAC guard qua accessibleProjectIds.
 *
 * accessibleProjectIds = null → admin (query all)
 * accessibleProjectIds = string[] → scope query WHERE project_id IN (...)
 */
export function createDashboardTools(accessibleProjectIds: string[] | null) {
  const scopeLeads = accessibleProjectIds
    ? inArray(leads.projectId, accessibleProjectIds)
    : sql`true`;
  const scopeProjects = accessibleProjectIds
    ? inArray(projects.id, accessibleProjectIds)
    : sql`true`;

  return {
    getProjectOverview: tool({
      description:
        "Lấy tổng quan tất cả dự án: tên, lead count, F1, booking, CPL. Dùng khi user hỏi về hiệu quả tổng thể.",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await db
          .select({
            projectName: projects.name,
            projectId: projects.id,
            status: projects.status,
            totalLead: sql<number>`count(${leads.id})::int`,
            f1: sql<number>`count(${leads.id}) filter (where ${stages.code} = 'F1')::int`,
            booking: sql<number>`count(${leads.id}) filter (where ${stages.code} = 'BOOKING')::int`,
          })
          .from(projects)
          .leftJoin(leads, eq(leads.projectId, projects.id))
          .leftJoin(stages, eq(leads.currentStageId, stages.id))
          .where(scopeProjects)
          .groupBy(projects.id, projects.name, projects.status)
          .orderBy(desc(sql`count(${leads.id})`));
        return rows;
      },
    }),

    getCampaignAnalysis: tool({
      description:
        "Phân tích chi tiết campaigns của 1 dự án: tên campaign, F1, đang chăm, tổng lead, tỉ lệ qualify. Dùng khi user hỏi về campaign nào hiệu quả/kém.",
      inputSchema: z.object({
        projectName: z
          .string()
          .describe("Tên dự án (hoặc 1 phần tên để tìm)"),
      }),
      execute: async ({ projectName }) => {
        const project = await db.query.projects.findFirst({
          where: and(
            sql`${projects.name} ILIKE ${"%" + projectName + "%"}`,
            scopeProjects,
          ),
        });
        if (!project) return { error: "Không tìm thấy dự án" };

        const rows = await db
          .select({
            campaignName: campaigns.name,
            statusLabel: campaigns.statusLabel,
            totalLead: sql<number>`count(${leads.id})::int`,
            f1: sql<number>`count(${leads.id}) filter (where ${stages.code} = 'F1')::int`,
            dangCham: sql<number>`count(${leads.id}) filter (where ${stages.code} = 'DANG_CHAM')::int`,
            booking: sql<number>`count(${leads.id}) filter (where ${stages.code} = 'BOOKING')::int`,
          })
          .from(campaigns)
          .leftJoin(leads, eq(leads.campaignId, campaigns.id))
          .leftJoin(stages, eq(leads.currentStageId, stages.id))
          .where(eq(campaigns.projectId, project.id))
          .groupBy(campaigns.id, campaigns.name, campaigns.statusLabel)
          .orderBy(desc(sql`count(${leads.id})`))
          .limit(20);

        return {
          project: project.name,
          campaigns: rows.map((r) => ({
            ...r,
            qualifyRate:
              r.totalLead > 0
                ? `${Math.round((r.f1 / r.totalLead) * 100)}%`
                : "0%",
          })),
        };
      },
    }),

    getLeadBreakdownByStage: tool({
      description:
        "Phân tích lead theo stage (trạng thái) của 1 dự án. Trả về count mỗi stage. Dùng khi user hỏi về tỉ lệ chuyển đổi, funnel, hoặc phân bố lead.",
      inputSchema: z.object({
        projectName: z.string().describe("Tên dự án"),
      }),
      execute: async ({ projectName }) => {
        const project = await db.query.projects.findFirst({
          where: and(
            sql`${projects.name} ILIKE ${"%" + projectName + "%"}`,
            scopeProjects,
          ),
        });
        if (!project) return { error: "Không tìm thấy dự án" };

        const rows = await db
          .select({
            stageCode: stages.code,
            stageLabel: stages.labelVi,
            category: stages.category,
            count: sql<number>`count(*)::int`,
          })
          .from(leads)
          .leftJoin(stages, eq(leads.currentStageId, stages.id))
          .where(eq(leads.projectId, project.id))
          .groupBy(stages.code, stages.labelVi, stages.category)
          .orderBy(desc(sql`count(*)`));

        const total = rows.reduce(
          (s: number, r: { count: number }) => s + r.count,
          0,
        );
        return {
          project: project.name,
          totalLead: total,
          stages: rows.map((r) => ({
            ...r,
            percentage:
              total > 0
                ? `${Math.round((r.count / total) * 100)}%`
                : "0%",
          })),
        };
      },
    }),

    getEmployeePerformance: tool({
      description:
        "Xem hiệu quả nhân viên sale: tổng lead, F1, đang chăm của mỗi nhân viên trong 1 dự án. Dùng khi user hỏi nhân viên nào làm tốt/kém.",
      inputSchema: z.object({
        projectName: z.string().describe("Tên dự án"),
      }),
      execute: async ({ projectName }) => {
        const project = await db.query.projects.findFirst({
          where: and(
            sql`${projects.name} ILIKE ${"%" + projectName + "%"}`,
            scopeProjects,
          ),
        });
        if (!project) return { error: "Không tìm thấy dự án" };

        const rows = await db
          .select({
            employeeName: employees.fullName,
            totalLead: sql<number>`count(*)::int`,
            f1: sql<number>`count(*) filter (where ${stages.code} = 'F1')::int`,
            dangCham: sql<number>`count(*) filter (where ${stages.code} = 'DANG_CHAM')::int`,
            booking: sql<number>`count(*) filter (where ${stages.code} = 'BOOKING')::int`,
          })
          .from(leads)
          .innerJoin(employees, eq(leads.currentEmployeeId, employees.id))
          .leftJoin(stages, eq(leads.currentStageId, stages.id))
          .where(eq(leads.projectId, project.id))
          .groupBy(employees.id, employees.fullName)
          .orderBy(desc(sql`count(*)`))
          .limit(30);

        return { project: project.name, employees: rows };
      },
    }),

    getCostAnalysis: tool({
      description:
        "Phân tích chi phí marketing của dự án: tổng chi phí, CPL, CP/F1. Dùng khi user hỏi về ngân sách, ROI, chi phí.",
      inputSchema: z.object({
        projectName: z.string().describe("Tên dự án"),
      }),
      execute: async ({ projectName }) => {
        const project = await db.query.projects.findFirst({
          where: and(
            sql`${projects.name} ILIKE ${"%" + projectName + "%"}`,
            scopeProjects,
          ),
        });
        if (!project) return { error: "Không tìm thấy dự án" };

        const costResult = await db
          .select({
            totalCost: sql<number>`coalesce(sum(${projectCosts.amount}), 0)::float`,
          })
          .from(projectCosts)
          .where(eq(projectCosts.projectId, project.id));

        const leadResult = await db
          .select({
            totalLead: sql<number>`count(*)::int`,
            f1: sql<number>`count(*) filter (where ${stages.code} = 'F1')::int`,
            booking: sql<number>`count(*) filter (where ${stages.code} = 'BOOKING')::int`,
          })
          .from(leads)
          .leftJoin(stages, eq(leads.currentStageId, stages.id))
          .where(eq(leads.projectId, project.id));

        const cost = (costResult[0] as { totalCost: number }).totalCost;
        const l = leadResult[0] as {
          totalLead: number;
          f1: number;
          booking: number;
        };
        const budget = cost > 0 ? cost : project.budget ? parseFloat(project.budget) : 0;

        return {
          project: project.name,
          totalCost: budget,
          totalLead: l.totalLead,
          f1: l.f1,
          booking: l.booking,
          cpl: l.totalLead > 0 ? Math.round(budget / l.totalLead) : 0,
          cpf1: l.f1 > 0 ? Math.round(budget / l.f1) : 0,
          cpBooking: l.booking > 0 ? Math.round(budget / l.booking) : 0,
        };
      },
    }),
  };
}
