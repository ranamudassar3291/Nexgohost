import { pgTable, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cartItemsTable = pgTable("cart_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  planId: text("plan_id").notNull(),
  planName: text("plan_name").notNull(),
  billingCycle: text("billing_cycle").default("monthly").notNull(),
  monthlyPrice: numeric("monthly_price", { precision: 10, scale: 2 }).default("0").notNull(),
  quarterlyPrice: numeric("quarterly_price", { precision: 10, scale: 2 }),
  semiannualPrice: numeric("semiannual_price", { precision: 10, scale: 2 }),
  yearlyPrice: numeric("yearly_price", { precision: 10, scale: 2 }),
  renewalPrice: numeric("renewal_price", { precision: 10, scale: 2 }),
  renewalEnabled: text("renewal_enabled").default("false"),
  addedAt: timestamp("added_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCartItemSchema = createInsertSchema(cartItemsTable).omit({ id: true, addedAt: true, updatedAt: true });
export type InsertCartItem = z.infer<typeof insertCartItemSchema>;
export type CartItemRow = typeof cartItemsTable.$inferSelect;
