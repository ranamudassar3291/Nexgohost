import { pgTable, text, timestamp, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const extensionStatusEnum = pgEnum("extension_status", ["active", "inactive"]);

export const domainExtensionsTable = pgTable("domain_extensions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  extension: text("extension").notNull().unique(),
  registerPrice: numeric("register_price", { precision: 10, scale: 2 }).notNull(),
  renewalPrice: numeric("renewal_price", { precision: 10, scale: 2 }).notNull(),
  transferPrice: numeric("transfer_price", { precision: 10, scale: 2 }).notNull(),
  status: extensionStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDomainExtensionSchema = createInsertSchema(domainExtensionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDomainExtension = z.infer<typeof insertDomainExtensionSchema>;
export type DomainExtension = typeof domainExtensionsTable.$inferSelect;
