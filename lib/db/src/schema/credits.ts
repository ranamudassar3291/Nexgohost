import { pgTable, text, timestamp, numeric, pgEnum } from "drizzle-orm/pg-core";

export const creditTxTypeEnum = pgEnum("credit_tx_type", [
  "affiliate_payout",
  "invoice_payment",
  "admin_add",
  "admin_deduct",
  "refund",
]);

export const creditTransactionsTable = pgTable("credit_transactions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  type: creditTxTypeEnum("type").notNull(),
  description: text("description"),
  invoiceId: text("invoice_id"),
  withdrawalId: text("withdrawal_id"),
  performedBy: text("performed_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CreditTransaction = typeof creditTransactionsTable.$inferSelect;
