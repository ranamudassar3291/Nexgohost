import { pgTable, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const serverNodesTable = pgTable("server_nodes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  type: text("type").notNull().default("hosting"),
  host: text("host").notNull(),
  port: integer("port").notNull().default(80),
  checkType: text("check_type").notNull().default("http"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ServerNode = typeof serverNodesTable.$inferSelect;
