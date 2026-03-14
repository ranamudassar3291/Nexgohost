import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const adminLogsTable = pgTable("admin_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id"),
  email: text("email"),
  action: text("action").notNull(),
  method: text("method").notNull().default("password"),
  status: text("status").notNull().default("success"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AdminLog = typeof adminLogsTable.$inferSelect;
