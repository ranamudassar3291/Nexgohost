import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const waEventEnum = pgEnum("wa_event_type", [
  "new_order",
  "new_ticket",
  "payment_proof",
  "test",
  "other",
  "refund_request",
  "invoice_paid",
  "client_notification",
  "admin_command",
  "suspension_warning",
]);

export const whatsappLogsTable = pgTable("whatsapp_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  eventType: waEventEnum("event_type").notNull().default("other"),
  message: text("message").notNull(),
  status: text("status").notNull().default("sent"),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

export type WhatsappLog = typeof whatsappLogsTable.$inferSelect;
