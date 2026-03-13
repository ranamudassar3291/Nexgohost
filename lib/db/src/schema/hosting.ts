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
  billingCycle: billingCycleEnum("billing_cycle").notNull().default("monthly"),
  groupId: text("group_id"),
  module: text("module").default("none"),
  diskSpace: text("disk_space").notNull(),
  bandwidth: text("bandwidth").notNull(),
  emailAccounts: integer("email_accounts").default(10),
  databases: integer("databases").default(5),
  subdomains: integer("subdomains").default(10),
  ftpAccounts: integer("ftp_accounts").default(5),
  isActive: boolean("is_active").default(true),
  features: text("features").array().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const hostingServicesTable = pgTable("hosting_services", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull(),
  planId: text("plan_id").notNull(),
  planName: text("plan_name").notNull(),
  domain: text("domain"),
  username: text("username"),
  serverIp: text("server_ip").default("192.168.1.1"),
  status: hostingStatusEnum("status").notNull().default("pending"),
  startDate: timestamp("start_date").defaultNow(),
  expiryDate: timestamp("expiry_date"),
  diskUsed: text("disk_used").default("0 MB"),
  bandwidthUsed: text("bandwidth_used").default("0 GB"),
  cpanelUrl: text("cpanel_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertHostingPlanSchema = createInsertSchema(hostingPlansTable).omit({ id: true, createdAt: true });
export type InsertHostingPlan = z.infer<typeof insertHostingPlanSchema>;
export type HostingPlan = typeof hostingPlansTable.$inferSelect;

export const insertHostingServiceSchema = createInsertSchema(hostingServicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHostingService = z.infer<typeof insertHostingServiceSchema>;
export type HostingService = typeof hostingServicesTable.$inferSelect;
