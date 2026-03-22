import { pgTable, text, timestamp, numeric, integer, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const billingCycleEnum = pgEnum("billing_cycle", ["monthly", "yearly"]);
export const hostingStatusEnum = pgEnum("hosting_status", ["active", "suspended", "terminated", "pending"]);

export const hostingPlansTable = pgTable("hosting_plans", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  yearlyPrice: numeric("yearly_price", { precision: 10, scale: 2 }),
  quarterlyPrice: numeric("quarterly_price", { precision: 10, scale: 2 }),
  semiannualPrice: numeric("semiannual_price", { precision: 10, scale: 2 }),
  billingCycle: billingCycleEnum("billing_cycle").notNull().default("monthly"),
  groupId: text("group_id"),
  module: text("module").default("none"),
  moduleServerId: text("module_server_id"),
  moduleServerGroupId: text("module_server_group_id"),
  modulePlanId: text("module_plan_id"),
  modulePlanName: text("module_plan_name"),
  diskSpace: text("disk_space").notNull(),
  bandwidth: text("bandwidth").notNull(),
  emailAccounts: integer("email_accounts").default(10),
  databases: integer("databases").default(5),
  subdomains: integer("subdomains").default(10),
  ftpAccounts: integer("ftp_accounts").default(5),
  isActive: boolean("is_active").default(true),
  features: text("features").array().default([]),
  renewalEnabled: boolean("renewal_enabled").default(true),
  renewalPrice: numeric("renewal_price", { precision: 10, scale: 2 }),
  freeDomainEnabled: boolean("free_domain_enabled").default(false),
  freeDomainTlds: text("free_domain_tlds").array().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const hostingServicesTable = pgTable("hosting_services", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull(),
  planId: text("plan_id").notNull(),
  planName: text("plan_name").notNull(),
  domain: text("domain"),
  username: text("username"),
  password: text("password"),
  serverId: text("server_id"),
  serverIp: text("server_ip").default("192.168.1.1"),
  status: hostingStatusEnum("status").notNull().default("pending"),
  billingCycle: text("billing_cycle").default("monthly"),
  nextDueDate: timestamp("next_due_date"),
  sslStatus: text("ssl_status").default("not_installed"),
  startDate: timestamp("start_date").defaultNow(),
  expiryDate: timestamp("expiry_date"),
  diskUsed: text("disk_used").default("0 MB"),
  bandwidthUsed: text("bandwidth_used").default("0 GB"),
  cpanelUrl: text("cpanel_url"),
  webmailUrl: text("webmail_url"),
  cancelRequested: boolean("cancel_requested").default(false),
  cancelReason: text("cancel_reason"),
  cancelRequestedAt: timestamp("cancel_requested_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertHostingPlanSchema = createInsertSchema(hostingPlansTable).omit({ id: true, createdAt: true });
export type InsertHostingPlan = z.infer<typeof insertHostingPlanSchema>;
export type HostingPlan = typeof hostingPlansTable.$inferSelect;

export const insertHostingServiceSchema = createInsertSchema(hostingServicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHostingService = z.infer<typeof insertHostingServiceSchema>;
export type HostingService = typeof hostingServicesTable.$inferSelect;
