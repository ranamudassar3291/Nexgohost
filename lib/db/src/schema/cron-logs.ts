import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cronStatusEnum = pgEnum("cron_status", ["success", "failed", "skipped"]);

export const cronLogsTable = pgTable("cron_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  task: text("task").notNull(),
  status: cronStatusEnum("status").notNull().default("success"),
  message: text("message"),
  executedAt: timestamp("executed_at").defaultNow().notNull(),
});

export const insertCronLogSchema = createInsertSchema(cronLogsTable).omit({ id: true });
export type InsertCronLog = z.infer<typeof insertCronLogSchema>;
export type CronLog = typeof cronLogsTable.$inferSelect;
