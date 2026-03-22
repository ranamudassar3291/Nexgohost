import { pgTable, text, timestamp, numeric, pgEnum, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const affiliateStatusEnum = pgEnum("affiliate_status", ["active", "suspended", "pending"]);
export const commissionTypeEnum = pgEnum("commission_type", ["fixed", "percentage"]);
export const commissionStatusEnum = pgEnum("commission_status", ["pending", "approved", "paid", "rejected"]);
export const referralStatusEnum = pgEnum("referral_status", ["registered", "converted", "invalid"]);

export const affiliatesTable = pgTable("affiliates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique(),
  referralCode: text("referral_code").notNull().unique(),
  status: affiliateStatusEnum("status").notNull().default("active"),
  commissionType: commissionTypeEnum("commission_type").notNull().default("percentage"),
  commissionValue: numeric("commission_value", { precision: 10, scale: 2 }).notNull().default("10"),
  totalEarnings: numeric("total_earnings", { precision: 10, scale: 2 }).notNull().default("0"),
  pendingEarnings: numeric("pending_earnings", { precision: 10, scale: 2 }).notNull().default("0"),
  paidEarnings: numeric("paid_earnings", { precision: 10, scale: 2 }).notNull().default("0"),
  totalClicks: integer("total_clicks").notNull().default(0),
  totalSignups: integer("total_signups").notNull().default(0),
  totalConversions: integer("total_conversions").notNull().default(0),
  paypalEmail: text("paypal_email"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const affiliateReferralsTable = pgTable("affiliate_referrals", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  affiliateId: text("affiliate_id").notNull(),
  referredUserId: text("referred_user_id").notNull(),
  status: referralStatusEnum("status").notNull().default("registered"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const affiliateCommissionsTable = pgTable("affiliate_commissions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  affiliateId: text("affiliate_id").notNull(),
  referredUserId: text("referred_user_id"),
  orderId: text("order_id"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: commissionStatusEnum("status").notNull().default("pending"),
  description: text("description"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const affiliateClicksTable = pgTable("affiliate_clicks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  affiliateId: text("affiliate_id").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAffiliateSchema = createInsertSchema(affiliatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAffiliate = z.infer<typeof insertAffiliateSchema>;
export type Affiliate = typeof affiliatesTable.$inferSelect;
