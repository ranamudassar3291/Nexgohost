import { pgTable, text, timestamp, numeric, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const invoiceStatusEnum = pgEnum("invoice_status", ["unpaid", "payment_pending", "paid", "cancelled", "overdue", "refunded", "collections"]);
export const paymentMethodEnum = pgEnum("payment_method", ["stripe", "paypal", "jazzcash", "easypaisa", "bank_transfer", "crypto", "manual", "safepay"]);
export const transactionStatusEnum = pgEnum("transaction_status", ["success", "failed", "pending", "refunded"]);

export const invoicesTable = pgTable("invoices", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  invoiceNumber: text("invoice_number").notNull().unique(),
  clientId: text("client_id").notNull(),
  orderId: text("order_id"),
  serviceId: text("service_id"),
  invoiceType: text("invoice_type").default("hosting"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  tax: numeric("tax", { precision: 10, scale: 2 }).default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  status: invoiceStatusEnum("status").notNull().default("unpaid"),
  dueDate: timestamp("due_date").notNull(),
  paidDate: timestamp("paid_date"),
  items: jsonb("items").notNull().default([]),
  paymentRef: text("payment_ref"),
  paymentGatewayId: text("payment_gateway_id"),
  paymentNotes: text("payment_notes"),
  // Multi-currency support: stores the client's display currency at the time of invoice creation
  currencyCode: text("currency_code").default("PKR"),
  currencySymbol: text("currency_symbol").default("Rs."),
  currencyRate: numeric("currency_rate", { precision: 12, scale: 6 }).default("1"),
  // Safety anchor: base PKR amount is always preserved here regardless of display currency
  baseCurrencyAmount: numeric("base_currency_amount", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const transactionsTable = pgTable("transactions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull(),
  invoiceId: text("invoice_id"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  method: paymentMethodEnum("method").notNull(),
  status: transactionStatusEnum("status").notNull().default("pending"),
  transactionRef: text("transaction_ref"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
