import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  pgEnum,
  date,
  numeric,
  boolean,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { projects, fanpages } from "./projects";
import { stages, employees } from "./stages";
import { campaigns } from "./ads";
import { leads } from "./leads";

export const csvUploadTypeEnum = pgEnum("csv_upload_type", [
  "facebook",
  "bitrix",
]);

export const csvUploadStatusEnum = pgEnum("csv_upload_status", [
  "pending",
  "processing",
  "done",
  "failed",
]);

export const projectCostSourceEnum = pgEnum("project_cost_source", [
  "manual",
  "fb_api",
]);

/**
 * Audit log mọi lần upload CSV — admin xem để debug, biết file nào fail tại sao.
 */
export const csvUploads = pgTable("csv_uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  uploadedBy: uuid("uploaded_by")
    .notNull()
    .references(() => users.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  type: csvUploadTypeEnum("type").notNull(),
  filename: text("filename").notNull(),
  rowCount: integer("row_count").notNull().default(0),
  parsedCount: integer("parsed_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  status: csvUploadStatusEnum("status").notNull().default("pending"),
  errorLog: jsonb("error_log"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true, mode: "date" }),
});

/**
 * Lead trùng tên cần admin/digital resolve thủ công.
 * Matcher tự động không merge khi có conflict — flag để không mất dữ liệu.
 */
export const matchConflicts = pgTable("match_conflicts", {
  id: uuid("id").primaryKey().defaultRandom(),
  csvUploadId: uuid("csv_upload_id")
    .notNull()
    .references(() => csvUploads.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id").references(() => leads.id, {
    onDelete: "set null",
  }),
  candidates: jsonb("candidates").notNull(),
  reason: text("reason").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  resolvedBy: uuid("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

/**
 * Pre-computed aggregates cho Report Data + Dashboard Overview.
 * Rebuild sau mỗi upload CSV (Inngest event aggregate/rebuild) hoặc nightly.
 * Composite unique đảm bảo idempotent rebuild.
 */
export const dailyAggregates = pgTable(
  "daily_aggregates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    snapshotDate: date("snapshot_date").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    stageId: uuid("stage_id").references(() => stages.id),
    employeeId: uuid("employee_id").references(() => employees.id),
    fanpageId: uuid("fanpage_id").references(() => fanpages.id),
    campaignId: uuid("campaign_id").references(() => campaigns.id),
    leadCount: integer("lead_count").notNull().default(0),
    computedAt: timestamp("computed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("daily_aggregates_uk").on(
      t.snapshotDate,
      t.projectId,
      t.stageId,
      t.employeeId,
      t.fanpageId,
      t.campaignId,
    ),
    index("daily_aggregates_project_date_idx").on(t.projectId, t.snapshotDate),
  ],
);

/**
 * Archive sau 90 ngày — rollup snapshot cũ thành month-level để tiết kiệm DB quota.
 */
export const monthlyAggregates = pgTable(
  "monthly_aggregates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    yearMonth: date("year_month").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    stageId: uuid("stage_id").references(() => stages.id),
    employeeId: uuid("employee_id").references(() => employees.id),
    leadCount: integer("lead_count").notNull().default(0),
  },
  (t) => [
    unique("monthly_aggregates_uk").on(
      t.yearMonth,
      t.projectId,
      t.stageId,
      t.employeeId,
    ),
  ],
);

/**
 * Chi phí marketing nhập tay (Phase 1) hoặc fetch từ FB Insights API (Phase 2).
 */
export const projectCosts = pgTable(
  "project_costs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    periodDate: date("period_date").notNull(),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    source: projectCostSourceEnum("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("project_costs_uk").on(t.projectId, t.periodDate, t.source),
  ],
);

export type CsvUpload = typeof csvUploads.$inferSelect;
export type MatchConflict = typeof matchConflicts.$inferSelect;
export type DailyAggregate = typeof dailyAggregates.$inferSelect;
export type ProjectCost = typeof projectCosts.$inferSelect;
