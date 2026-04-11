import {
  pgTable,
  uuid,
  text,
  numeric,
  pgEnum,
  timestamp,
  boolean,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

export const projectStatusEnum = pgEnum("project_status", [
  "running",
  "warning",
  "paused",
]);

export const projectRoleEnum = pgEnum("project_role", ["digital", "gdda"]);

export const adPlatformEnum = pgEnum("ad_platform", ["facebook", "google"]);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    location: text("location"),
    budget: numeric("budget", { precision: 18, scale: 2 }),
    fbAdAccountId: text("fb_ad_account_id"),
    googleAdsId: text("google_ads_id"),
    fbAppId: text("fb_app_id"),
    fbAppSecret: text("fb_app_secret"),
    fbAccessToken: text("fb_access_token"),
    status: projectStatusEnum("status").notNull().default("running"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("projects_status_idx").on(t.status)],
);

/**
 * BẢNG RBAC LÕI: gán user vào dự án với quyền view/edit riêng biệt.
 * - canView: thấy được dự án trong list, mở detail, xem report
 * - canEdit: sửa metadata, upload CSV, gán campaign
 * - roleInProject: digital | gdda — quyết định UX (GDDA thấy 4 sub-tabs Excel)
 */
export const projectUsers = pgTable(
  "project_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    canView: boolean("can_view").notNull().default(true),
    canEdit: boolean("can_edit").notNull().default(false),
    roleInProject: projectRoleEnum("role_in_project").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("project_users_project_user_uk").on(t.projectId, t.userId),
    index("project_users_user_idx").on(t.userId),
  ],
);

export const fanpages = pgTable("fanpages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  externalId: text("external_id").unique(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const sources = pgTable("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const projectFanpages = pgTable(
  "project_fanpages",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    fanpageId: uuid("fanpage_id")
      .notNull()
      .references(() => fanpages.id, { onDelete: "cascade" }),
  },
  (t) => [unique("project_fanpages_uk").on(t.projectId, t.fanpageId)],
);

export const projectAdAccounts = pgTable("project_ad_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  adAccountExternalId: text("ad_account_external_id").notNull(),
  platform: adPlatformEnum("platform").notNull(),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectUser = typeof projectUsers.$inferSelect;
export type Fanpage = typeof fanpages.$inferSelect;
export type Source = typeof sources.$inferSelect;
