import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const emailLogsTable = pgTable("email_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull(),
  email: text("email").notNull(),
  emailType: text("email_type").notNull(),
  subject: text("subject"),
  referenceId: text("reference_id"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

export const insertEmailLogSchema = createInsertSchema(emailLogsTable).omit({ id: true });
export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>;
export type EmailLog = typeof emailLogsTable.$inferSelect;
