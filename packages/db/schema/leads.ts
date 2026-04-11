import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  pgEnum,
  date,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { projects, fanpages, sources } from "./projects";
import { stages, employees } from "./stages";
import { campaigns, adsets, ads } from "./ads";

export const leadEventSourceEnum = pgEnum("lead_event_source", [
  "csv_facebook",
  "csv_bitrix",
  "manual",
  "webhook_facebook",
  "webhook_bitrix",
]);

/**
 * Bảng leads — current state, 1 row / 1 lead.
 * - full_name_normalized & phone_normalized dùng cho matcher (NFD fold + bỏ dấu).
 * - fb_lead_id để sẵn cho Phase 2 (webhook Facebook Lead Ads). Phase 1 có thể null.
 * - form_answers JSONB lưu custom form fields động (mỗi form Facebook khác nhau).
 * - needs_review = true khi matcher không tự quyết được.
 */
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    fanpageId: uuid("fanpage_id").references(() => fanpages.id, {
      onDelete: "set null",
    }),
    sourceId: uuid("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
    fullName: text("full_name").notNull(),
    fullNameNormalized: text("full_name_normalized").notNull(),
    phone: text("phone"),
    phoneNormalized: text("phone_normalized"),
    email: text("email"),
    fbLeadId: text("fb_lead_id").unique(),
    formName: text("form_name"),
    formAnswers: jsonb("form_answers"),
    currentStageId: uuid("current_stage_id").references(() => stages.id, {
      onDelete: "set null",
    }),
    currentEmployeeId: uuid("current_employee_id").references(
      () => employees.id,
      { onDelete: "set null" },
    ),
    campaignId: uuid("campaign_id").references(() => campaigns.id, {
      onDelete: "set null",
    }),
    adsetId: uuid("adset_id").references(() => adsets.id, {
      onDelete: "set null",
    }),
    adId: uuid("ad_id").references(() => ads.id, { onDelete: "set null" }),
    fbCreatedAt: timestamp("fb_created_at", {
      withTimezone: true,
      mode: "date",
    }),
    bitrixUpdatedAt: timestamp("bitrix_updated_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastComment: text("last_comment"),
    needsReview: boolean("needs_review").notNull().default(false),
    reviewReason: text("review_reason"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Chủ lực Report Data: filter project + date range, sort newest first
    index("leads_project_created_idx").on(t.projectId, t.fbCreatedAt),
    index("leads_project_stage_idx").on(t.projectId, t.currentStageId),
    // Matcher: lookup theo (project, name, phone)
    index("leads_match_idx").on(
      t.projectId,
      t.fullNameNormalized,
      t.phoneNormalized,
    ),
  ],
);

/**
 * Daily snapshot — copy current state mỗi đêm cho từng lead có activity hôm đó.
 * Rolling 90 ngày, sau đó archive sang monthly_aggregates.
 */
export const leadSnapshots = pgTable(
  "lead_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    snapshotDate: date("snapshot_date").notNull(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    stageId: uuid("stage_id").references(() => stages.id),
    employeeId: uuid("employee_id").references(() => employees.id),
    fanpageId: uuid("fanpage_id").references(() => fanpages.id),
    raw: jsonb("raw"),
  },
  (t) => [
    unique("lead_snapshots_date_lead_uk").on(t.snapshotDate, t.leadId),
    index("lead_snapshots_date_project_idx").on(t.snapshotDate, t.projectId),
  ],
);

/**
 * Delta history — chỉ ghi khi stage đổi.
 * Lightweight hơn snapshot full, dùng để vẽ funnel + activity timeline.
 */
export const leadStageEvents = pgTable(
  "lead_stage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    fromStageId: uuid("from_stage_id").references(() => stages.id),
    toStageId: uuid("to_stage_id").references(() => stages.id),
    employeeId: uuid("employee_id").references(() => employees.id),
    source: leadEventSourceEnum("source").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("lead_stage_events_lead_changed_idx").on(t.leadId, t.changedAt),
    index("lead_stage_events_project_changed_idx").on(
      t.projectId,
      t.changedAt,
    ),
  ],
);

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type LeadSnapshot = typeof leadSnapshots.$inferSelect;
export type LeadStageEvent = typeof leadStageEvents.$inferSelect;
