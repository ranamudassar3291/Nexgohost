import { pgTable, text, timestamp, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const fraudStatusEnum = pgEnum("fraud_status", ["flagged", "approved", "rejected"]);

export const fraudLogsTable = pgTable("fraud_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text("order_id").notNull(),
  clientId: text("client_id").notNull(),
  ipAddress: text("ip_address"),
  email: text("email"),
  riskScore: numeric("risk_score", { precision: 5, scale: 2 }).notNull().default("0"),
  reasons: text("reasons").array().default([]),
  status: fraudStatusEnum("status").notNull().default("flagged"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
});

export const insertFraudLogSchema = createInsertSchema(fraudLogsTable).omit({ id: true });
export type InsertFraudLog = z.infer<typeof insertFraudLogSchema>;
export type FraudLog = typeof fraudLogsTable.$inferSelect;
