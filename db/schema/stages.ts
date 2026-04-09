import {
  pgTable,
  uuid,
  text,
  pgEnum,
  integer,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

export const stageCategoryEnum = pgEnum("stage_category", [
  "new",
  "nurturing",
  "converted",
  "dead",
]);

/**
 * 16 stage chuẩn hoá. Code = enum-style key dùng trong logic.
 * label_vi = hiển thị UI. category = group cho aggregation.
 */
export const stages = pgTable("stages", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  labelVi: text("label_vi").notNull(),
  category: stageCategoryEnum("category").notNull(),
  color: text("color").notNull().default("#94a3b8"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

/**
 * Mapping runtime: raw string từ Bitrix CSV → stage_id.
 * Admin có thể thêm alias mới qua UI mà không cần deploy.
 * stageId = null nghĩa là pending — chưa được map, cần admin xử lý.
 */
export const stageAliases = pgTable("stage_aliases", {
  id: uuid("id").primaryKey().defaultRandom(),
  raw: text("raw").notNull().unique(),
  stageId: uuid("stage_id").references(() => stages.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

/**
 * Nhân viên chăm lead trong Bitrix (responsible).
 * KHÔNG liên kết với users (Auth) — đây là entity riêng từ Bitrix CRM.
 */
export const employees = pgTable("employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: text("full_name").notNull(),
  fullNameNormalized: text("full_name_normalized").notNull().unique(),
  bitrixTeam: text("bitrix_team"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export type Stage = typeof stages.$inferSelect;
export type StageAlias = typeof stageAliases.$inferSelect;
export type Employee = typeof employees.$inferSelect;
