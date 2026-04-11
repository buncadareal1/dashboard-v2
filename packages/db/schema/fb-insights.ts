import {
  pgTable,
  uuid,
  text,
  date,
  numeric,
  integer,
  timestamp,
  pgEnum,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { campaigns } from "./ads";
import { ads } from "./ads";
import { users } from "./auth";

// --- Campaign Insights (polled from FB API every 15-30 min) ---

export const campaignInsights = pgTable(
  "campaign_insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    spend: numeric("spend", { precision: 18, scale: 2 }).notNull().default("0"),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    leads: integer("leads").notNull().default(0),
    ctr: numeric("ctr", { precision: 8, scale: 4 }).notNull().default("0"),
    cpm: numeric("cpm", { precision: 18, scale: 2 }).notNull().default("0"),
    frequency: numeric("frequency", { precision: 8, scale: 4 }).notNull().default("0"),
    cpl: numeric("cpl", { precision: 18, scale: 2 }).notNull().default("0"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("campaign_insights_campaign_date_uk").on(t.campaignId, t.date),
    index("campaign_insights_campaign_idx").on(t.campaignId),
  ],
);

// --- Ad-level Insights ---

export const adInsights = pgTable(
  "ad_insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adId: uuid("ad_id")
      .notNull()
      .references(() => ads.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    spend: numeric("spend", { precision: 18, scale: 2 }).notNull().default("0"),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    leads: integer("leads").notNull().default(0),
    ctr: numeric("ctr", { precision: 8, scale: 4 }).notNull().default("0"),
    cpm: numeric("cpm", { precision: 18, scale: 2 }).notNull().default("0"),
    cpl: numeric("cpl", { precision: 18, scale: 2 }).notNull().default("0"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("ad_insights_ad_date_uk").on(t.adId, t.date),
    index("ad_insights_ad_idx").on(t.adId),
  ],
);

// --- Campaign Action Plan (manual columns from Excel layout) ---

export const campaignActionPriorityEnum = pgEnum("campaign_action_priority", [
  "urgent",
  "today",
  "week",
  "none",
]);

export const campaignActions = pgTable(
  "campaign_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    priority: campaignActionPriorityEnum("priority").notNull().default("none"),
    plan: text("plan"),
    contentNote: text("content_note"),
    todayAction: text("today_action"),
    actionDetail: text("action_detail"),
    assignee: text("assignee"),
    deadline: date("deadline"),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("campaign_actions_campaign_uk").on(t.campaignId),
  ],
);

// --- Types ---

export type CampaignInsight = typeof campaignInsights.$inferSelect;
export type AdInsight = typeof adInsights.$inferSelect;
export type CampaignAction = typeof campaignActions.$inferSelect;
