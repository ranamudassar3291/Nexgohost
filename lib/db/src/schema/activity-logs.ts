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
  "order_placed",
  "domain_registered",
  "domain_transferred",
  "domain_renewed",
  "invoice_paid",
  "ticket_opened",
  "account_registered",
  "password_reset_requested",
  "support_ticket_created",
]);

export const activityLogsTable = pgTable("activity_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  userEmail: text("user_email"),
  action: activityTypeEnum("action").notNull(),
  description: text("description"),
  ip: text("ip"),
  userAgent: text("user_agent"),
  status: activityStatusEnum("status").notNull().default("success"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLogsTable.$inferSelect;
