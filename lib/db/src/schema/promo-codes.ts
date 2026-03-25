import { pgTable, text, timestamp, integer, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const promoCodesTable = pgTable("promo_codes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text("code").notNull().unique(),
  description: text("description"),
  discountType: text("discount_type").default("percent").notNull(),
  discountPercent: integer("discount_percent").default(0).notNull(),
  fixedAmount: numeric("fixed_amount", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").default(true).notNull(),
  usageLimit: integer("usage_limit"),
  usedCount: integer("used_count").default(0).notNull(),
  expiresAt: timestamp("expires_at"),
  applicableTo: text("applicable_to").default("all").notNull(),
  applicableGroupId: text("applicable_group_id"),
  applicableDomainTld: text("applicable_domain_tld"),
  applicablePlanId: text("applicable_plan_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPromoCodeSchema = createInsertSchema(promoCodesTable).omit({ id: true, usedCount: true, createdAt: true });
export type InsertPromoCode = z.infer<typeof insertPromoCodeSchema>;
export type PromoCode = typeof promoCodesTable.$inferSelect;
