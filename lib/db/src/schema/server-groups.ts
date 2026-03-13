import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const serverGroupsTable = pgTable("server_groups", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertServerGroupSchema = createInsertSchema(serverGroupsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertServerGroup = z.infer<typeof insertServerGroupSchema>;
export type ServerGroup = typeof serverGroupsTable.$inferSelect;
