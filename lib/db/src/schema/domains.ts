import { pgTable, text, timestamp, numeric, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const domainStatusEnum = pgEnum("domain_status", ["active", "expired", "pending", "transferred", "suspended", "cancelled"]);

export const domainsTable = pgTable("domains", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull(),
  name: text("name").notNull(),
  tld: text("tld").notNull(),
  registrar: text("registrar").default(""),
  registrationDate: timestamp("registration_date").defaultNow(),
  expiryDate: timestamp("expiry_date"),
  nextDueDate: timestamp("next_due_date"),
  status: domainStatusEnum("status").notNull().default("pending"),
  autoRenew: boolean("auto_renew").default(true),
  nameservers: text("nameservers").array().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const domainPricingTable = pgTable("domain_pricing", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tld: text("tld").notNull().unique(),
  registrationPrice: numeric("registration_price", { precision: 10, scale: 2 }).notNull(),
  renewalPrice: numeric("renewal_price", { precision: 10, scale: 2 }).notNull(),
  transferPrice: numeric("transfer_price", { precision: 10, scale: 2 }).default("10.00"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDomainSchema = createInsertSchema(domainsTable).omit({ id: true, createdAt: true });
export type InsertDomain = z.infer<typeof insertDomainSchema>;
export type Domain = typeof domainsTable.$inferSelect;

export const insertDomainPricingSchema = createInsertSchema(domainPricingTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDomainPricing = z.infer<typeof insertDomainPricingSchema>;
export type DomainPricing = typeof domainPricingTable.$inferSelect;
