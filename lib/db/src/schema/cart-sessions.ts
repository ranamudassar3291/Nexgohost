import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cartSessionsTable = pgTable("cart_sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  packageId: text("package_id"),
  packageName: text("package_name"),
  domainName: text("domain_name"),
  billingCycle: text("billing_cycle").default("monthly"),
  completed: boolean("completed").default(false).notNull(),
  reminderSent: boolean("reminder_sent").default(false).notNull(),
  promoCode: text("promo_code"),
  abandonedAt: timestamp("abandoned_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  reminderSentAt: timestamp("reminder_sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCartSessionSchema = createInsertSchema(cartSessionsTable).omit({ id: true, createdAt: true });
export type InsertCartSession = z.infer<typeof insertCartSessionSchema>;
export type CartSession = typeof cartSessionsTable.$inferSelect;
