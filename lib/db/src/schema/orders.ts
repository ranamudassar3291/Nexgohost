import { pgTable, text, timestamp, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const orderTypeEnum = pgEnum("order_type", ["hosting", "domain", "upgrade", "renewal"]);
export const orderStatusEnum = pgEnum("order_status", ["pending", "approved", "cancelled", "completed", "suspended", "fraud", "terminated"]);

export const ordersTable = pgTable("orders", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull(),
  type: orderTypeEnum("type").notNull(),
  itemId: text("item_id"),
  itemName: text("item_name").notNull(),
  domain: text("domain"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  billingCycle: text("billing_cycle").default("monthly"),
  dueDate: timestamp("due_date"),
  moduleType: text("module_type").default("none"),
  modulePlanId: text("module_plan_id"),
  modulePlanName: text("module_plan_name"),
  moduleServerId: text("module_server_id"),
  paymentStatus: text("payment_status").default("unpaid"),
  invoiceId: text("invoice_id"),
  status: orderStatusEnum("status").notNull().default("pending"),
  notes: text("notes"),
  whmcsId: text("whmcs_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
