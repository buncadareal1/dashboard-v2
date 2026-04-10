import {
  pgTable,
  uuid,
  text,
  pgEnum,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { projects } from "./projects";

/**
 * Normalized name expression for case/whitespace-insensitive uniqueness:
 * LOWER(TRIM(REGEXP_REPLACE(name, '\s+', ' ', 'g')))
 */
const normalizedNameExpr = (col: string) =>
  sql.raw(
    `lower(trim(regexp_replace(${col}, '\\s+', ' ', 'g')))`,
  );

export const campaignStatusEnum = pgEnum("campaign_status_label", [
  "on",
  "off",
]);

/**
 * Campaign denormalized từ CSV Facebook (cột "Campaign").
 * status_label là LABEL tĩnh, KHÔNG gọi API Facebook bật/tắt thật.
 */
export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    externalId: text("external_id"),
    name: text("name").notNull(),
    statusLabel: campaignStatusEnum("status_label").notNull().default("on"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("campaigns_project_name_norm_uk").on(
      t.projectId,
      normalizedNameExpr("name"),
    ),
  ],
);

export const adsets = pgTable(
  "adsets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  (t) => [
    uniqueIndex("adsets_campaign_name_norm_uk").on(
      t.campaignId,
      normalizedNameExpr("name"),
    ),
  ],
);

export const ads = pgTable(
  "ads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adsetId: uuid("adset_id")
      .notNull()
      .references(() => adsets.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    formName: text("form_name"),
    thumbnailUrl: text("thumbnail_url"),
  },
  (t) => [
    uniqueIndex("ads_adset_name_norm_uk").on(
      t.adsetId,
      normalizedNameExpr("name"),
    ),
  ],
);

export type Campaign = typeof campaigns.$inferSelect;
export type Adset = typeof adsets.$inferSelect;
export type Ad = typeof ads.$inferSelect;
