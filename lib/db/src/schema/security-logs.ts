import { pgTable, text, timestamp, integer, pgEnum, boolean } from "drizzle-orm/pg-core";

export const securityEventEnum = pgEnum("security_event", [
  "login_failed",
  "login_blocked",
  "captcha_failed",
  "ip_blocked",
  "bot_blocked",
  "brute_force",
  "suspicious_scan",
]);

export const securityLogsTable = pgTable("security_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  event: securityEventEnum("event").notNull(),
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent"),
  email: text("email"),
  path: text("path"),
  details: text("details"),
  country: text("country"),
  blocked: boolean("blocked").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const blockedIpsTable = pgTable("blocked_ips", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  ipAddress: text("ip_address").notNull().unique(),
  reason: text("reason").notNull(),
  failedAttempts: integer("failed_attempts").default(0),
  blockedUntil: timestamp("blocked_until").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SecurityLog = typeof securityLogsTable.$inferSelect;
export type BlockedIp = typeof blockedIpsTable.$inferSelect;
