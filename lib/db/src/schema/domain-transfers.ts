import { pgTable, text, timestamp, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const transferStatusEnum = pgEnum("transfer_status", ["pending", "validating", "approved", "rejected", "completed", "cancelled"]);

export const domainTransfersTable = pgTable("domain_transfers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull(),
  domainName: text("domain_name").notNull(),
  epp: text("epp").notNull(),
  status: transferStatusEnum("status").notNull().default("pending"),
  validationMessage: text("validation_message"),
  adminNotes: text("admin_notes"),
  price: numeric("price", { precision: 10, scale: 2 }),
  invoiceId: text("invoice_id"),
  orderId: text("order_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDomainTransferSchema = createInsertSchema(domainTransfersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDomainTransfer = z.infer<typeof insertDomainTransferSchema>;
export type DomainTransfer = typeof domainTransfersTable.$inferSelect;
