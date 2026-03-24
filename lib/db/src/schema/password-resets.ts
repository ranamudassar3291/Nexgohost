import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const passwordResetsTable = pgTable("password_resets", {
  token:     text("token").primaryKey(),
  userId:    text("user_id").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt:    timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
