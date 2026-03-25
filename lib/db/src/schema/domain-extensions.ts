import { pgTable, text, timestamp, numeric, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const extensionStatusEnum = pgEnum("extension_status", ["active", "inactive"]);

export const domainExtensionsTable = pgTable("domain_extensions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  extension: text("extension").notNull().unique(),
  registerPrice: numeric("register_price", { precision: 10, scale: 2 }).notNull(),
  register2YearPrice: numeric("register_2_year_price", { precision: 10, scale: 2 }),
  register3YearPrice: numeric("register_3_year_price", { precision: 10, scale: 2 }),
  renewalPrice: numeric("renewal_price", { precision: 10, scale: 2 }).notNull(),
  renew2YearPrice: numeric("renew_2_year_price", { precision: 10, scale: 2 }),
  renew3YearPrice: numeric("renew_3_year_price", { precision: 10, scale: 2 }),
  transferPrice: numeric("transfer_price", { precision: 10, scale: 2 }).notNull(),
  privacyEnabled: boolean("privacy_enabled").notNull().default(true),
  isFreeWithHosting: boolean("is_free_with_hosting").notNull().default(false),
  transferAllowed: boolean("transfer_allowed").notNull().default(true),
  status: extensionStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDomainExtensionSchema = createInsertSchema(domainExtensionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDomainExtension = z.infer<typeof insertDomainExtensionSchema>;
export type DomainExtension = typeof domainExtensionsTable.$inferSelect;
