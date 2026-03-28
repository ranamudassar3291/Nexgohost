import { pgTable, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const domainActivationLogsTable = pgTable("domain_activation_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text("order_id").notNull(),
  domainId: text("domain_id"),
  clientId: text("client_id").notNull(),
  domainFqdn: text("domain_fqdn").notNull(),
  registrarId: text("registrar_id"),
  registrarName: text("registrar_name").notNull().default("manual"),
  registrarType: text("registrar_type").notNull().default("none"),
  costUsd: numeric("cost_usd", { precision: 10, scale: 4 }),
  costPkr: numeric("cost_pkr", { precision: 10, scale: 2 }),
  clientPaidPkr: numeric("client_paid_pkr", { precision: 10, scale: 2 }),
  profitPkr: numeric("profit_pkr", { precision: 10, scale: 2 }),
  usdToPkr: numeric("usd_to_pkr", { precision: 10, scale: 4 }),
  apiSuccess: text("api_success").default("true"),
  apiError: text("api_error"),
  notes: text("notes"),
  activatedAt: timestamp("activated_at").defaultNow().notNull(),
});

export const insertDomainActivationLogSchema = createInsertSchema(domainActivationLogsTable)
  .omit({ id: true, activatedAt: true });
export type InsertDomainActivationLog = z.infer<typeof insertDomainActivationLogSchema>;
export type DomainActivationLog = typeof domainActivationLogsTable.$inferSelect;
