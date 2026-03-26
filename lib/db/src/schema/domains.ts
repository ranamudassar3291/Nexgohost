import { pgTable, text, timestamp, numeric, boolean, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const domainStatusEnum = pgEnum("domain_status", ["active", "expired", "pending", "transferred", "suspended", "cancelled", "pending_transfer"]);

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
  lockStatus: text("lock_status").default("locked"),
  autoRenew: boolean("auto_renew").default(true),
  nameservers: text("nameservers").array().default([]),
  moduleServerId: text("module_server_id"),
  transferId: text("transfer_id"),
  isFreeDomain: boolean("is_free_domain").default(false),
  eppCode: text("epp_code"),
  lastLockChange: timestamp("last_lock_change"),
  lockOverrideByAdmin: boolean("lock_override_by_admin").default(false),
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

export const dnsRecordsTable = pgTable("dns_records", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  serviceId: text("service_id").notNull(),
  domain: text("domain").notNull(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  value: text("value").notNull(),
  ttl: integer("ttl").default(3600),
  priority: integer("priority"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDomainSchema = createInsertSchema(domainsTable).omit({ id: true, createdAt: true });
export type InsertDomain = z.infer<typeof insertDomainSchema>;
export type Domain = typeof domainsTable.$inferSelect;

export const insertDomainPricingSchema = createInsertSchema(domainPricingTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDomainPricing = z.infer<typeof insertDomainPricingSchema>;
export type DomainPricing = typeof domainPricingTable.$inferSelect;

export const insertDnsRecordSchema = createInsertSchema(dnsRecordsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDnsRecord = z.infer<typeof insertDnsRecordSchema>;
export type DnsRecord = typeof dnsRecordsTable.$inferSelect;
