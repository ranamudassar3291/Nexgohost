import { pgTable, text, timestamp, numeric } from "drizzle-orm/pg-core";

export const guestCartItemsTable = pgTable("guest_cart_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  guestSessionToken: text("guest_session_token").notNull(),
  planId: text("plan_id").notNull(),
  planName: text("plan_name").notNull(),
  itemType: text("item_type").default("hosting"),
  billingCycle: text("billing_cycle").default("monthly").notNull(),
  monthlyPrice: numeric("monthly_price", { precision: 10, scale: 2 }).default("0").notNull(),
  quarterlyPrice: numeric("quarterly_price", { precision: 10, scale: 2 }),
  semiannualPrice: numeric("semiannual_price", { precision: 10, scale: 2 }),
  yearlyPrice: numeric("yearly_price", { precision: 10, scale: 2 }),
  renewalPrice: numeric("renewal_price", { precision: 10, scale: 2 }),
  renewalEnabled: text("renewal_enabled").default("false"),
  domainName: text("domain_name"),
  tld: text("tld"),
  addedAt: timestamp("added_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type GuestCartItemRow = typeof guestCartItemsTable.$inferSelect;
