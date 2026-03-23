import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const activityStatusEnum = pgEnum("activity_status", ["success", "failed"]);

export const activityTypeEnum = pgEnum("activity_type", [
  "login_success",
  "login_failed",
  "login_2fa",
  "password_change",
  "2fa_enabled",
  "2fa_disabled",
  "logout",
  "profile_update",
]);

export const activityLogsTable = pgTable("activity_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  action: activityTypeEnum("action").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  status: activityStatusEnum("status").notNull().default("success"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLogsTable.$inferSelect;
