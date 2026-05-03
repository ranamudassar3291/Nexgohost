import { pgTable, text, timestamp, boolean, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const abuseTypeEnum = pgEnum("abuse_type", [
  "spam", "phishing", "malware", "ddos", "copyright", "harassment", "dmca", "child_safety", "other",
]);

export const abuseStatusEnum = pgEnum("abuse_status", [
  "pending", "analyzing", "warning_sent", "suspended", "critical_lockdown", "resolved", "dismissed",
]);

export const abuseClassificationEnum = pgEnum("abuse_classification", [
  "low", "medium", "high", "critical",
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

  threatScore: integer("threat_score").default(0),
  classification: abuseClassificationEnum("classification").default("low"),
  sourceCredibility: text("source_credibility"),

  isDmca: boolean("is_dmca").default(false),
  dmcaDeadlineAt: timestamp("dmca_deadline_at"),
  counterNoticeAt: timestamp("counter_notice_at"),
  counterNoticeText: text("counter_notice_text"),

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

export const abuseReputationTable = pgTable("abuse_reputation", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull().unique(),
  clientEmail: text("client_email"),
  totalReports: integer("total_reports").default(0),
  validReports: integer("valid_reports").default(0),
  threatScoreSum: integer("threat_score_sum").default(0),
  avgThreatScore: integer("avg_threat_score").default(0),
  maxThreatScore: integer("max_threat_score").default(0),
  lastReportAt: timestamp("last_report_at"),
  isPermanentlyBanned: boolean("is_permanently_banned").default(false),
  banReason: text("ban_reason"),
  bannedAt: timestamp("banned_at"),
  bannedBy: text("banned_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const abuseEvidenceTable = pgTable("abuse_evidence", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  reportId: text("report_id").notNull(),
  fileName: text("file_name"),
  fileUrl: text("file_url"),
  mimeType: text("mime_type"),
  description: text("description"),
  uploadedBy: text("uploaded_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAbuseReportSchema = createInsertSchema(abuseReportsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAbuseReport = z.infer<typeof insertAbuseReportSchema>;
export type AbuseReport = typeof abuseReportsTable.$inferSelect;
export type AbuseAction = typeof abuseActionsTable.$inferSelect;
export type AbuseReputation = typeof abuseReputationTable.$inferSelect;
export type AbuseEvidence = typeof abuseEvidenceTable.$inferSelect;
