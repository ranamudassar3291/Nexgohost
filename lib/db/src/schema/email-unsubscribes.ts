import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const emailUnsubscribesTable = pgTable("email_unsubscribes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  userId: text("user_id"),
  token: text("token").notNull().unique().$defaultFn(() => crypto.randomUUID()),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEmailUnsubscribeSchema = createInsertSchema(emailUnsubscribesTable).omit({ id: true, createdAt: true });
export type InsertEmailUnsubscribe = z.infer<typeof insertEmailUnsubscribeSchema>;
export type EmailUnsubscribe = typeof emailUnsubscribesTable.$inferSelect;
