import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  pgEnum,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

export const notificationTypeEnum = pgEnum("notification_type", [
  "new_user_pending",
  "csv_upload_done",
  "csv_upload_failed",
]);

/**
 * In-app notifications cho admin.
 * Mỗi notification gắn với 1 user (recipient).
 * metadata chứa context tuỳ type (userId mới, uploadId, etc.)
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    read: boolean("read").notNull().default(false),
    emailSent: boolean("email_sent").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("notifications_recipient_idx").on(t.recipientId, t.read),
    index("notifications_created_at_idx").on(t.createdAt),
  ],
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];
