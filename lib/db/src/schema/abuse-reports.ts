import { pgTable, text, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const abuseTypeEnum = pgEnum("abuse_type", [
  "spam", "phishing", "malware", "ddos", "copyright", "harassment", "other",
]);

export const abuseStatusEnum = pgEnum("abuse_status", [
  "pending", "analyzing", "warning_sent", "suspended", "resolved", "dismissed",
]);

export const abuseReportsTable = pgTable("abuse_reports", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  reportNumber: text("report_number").notNull().unique(),

  reporterEmail: text("reporter_email").notNull(),
  reporterName: text("reporter_name"),
  reporterOrg: text("reporter_org"),

  abuseType: abuseTypeEnum("abuse_type").notNull().default("spam"),
  targetDomain: text("target_domain"),
  targetIp: text("target_ip"),
  evidenceLogs: text("evidence_logs").notNull(),

  serviceId: text("service_id"),
  clientId: text("client_id"),

  status: abuseStatusEnum("status").notNull().default("pending"),
  isValid: boolean("is_valid").default(null),
  analysisNotes: text("analysis_notes"),

  warningEmailSentAt: timestamp("warning_email_sent_at"),
  warningDeadline: timestamp("warning_deadline"),
  suspendedAt: timestamp("suspended_at"),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: text("resolved_by"),
  resolvedNote: text("resolved_note"),
  dismissedAt: timestamp("dismissed_at"),
  dismissedBy: text("dismissed_by"),
  dismissReason: text("dismiss_reason"),

  ticketId: text("ticket_id"),
  autoSuspended: boolean("auto_suspended").default(false),
  notifiedClientAt: timestamp("notified_client_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const abuseActionsTable = pgTable("abuse_actions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  reportId: text("report_id").notNull(),
  actionType: text("action_type").notNull(),
  actionNote: text("action_note"),
  performedBy: text("performed_by").notNull(),
  performedByEmail: text("performed_by_email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAbuseReportSchema = createInsertSchema(abuseReportsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAbuseReport = z.infer<typeof insertAbuseReportSchema>;
export type AbuseReport = typeof abuseReportsTable.$inferSelect;
export type AbuseAction = typeof abuseActionsTable.$inferSelect;
