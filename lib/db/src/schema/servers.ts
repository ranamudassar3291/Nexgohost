import { pgTable, text, timestamp, pgEnum, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const serverTypeEnum = pgEnum("server_type", ["cpanel", "directadmin", "plesk", "none"]);
export const serverStatusEnum = pgEnum("server_status", ["active", "inactive", "maintenance"]);

export const serversTable = pgTable("servers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  hostname: text("hostname").notNull(),
  ipAddress: text("ip_address"),
  type: serverTypeEnum("type").notNull().default("cpanel"),
  apiUsername: text("api_username"),
  apiToken: text("api_token"),
  apiPort: integer("api_port").default(2087),
  ns1: text("ns1"),
  ns2: text("ns2"),
  maxAccounts: integer("max_accounts").default(500),
  status: serverStatusEnum("status").notNull().default("active"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertServerSchema = createInsertSchema(serversTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertServer = z.infer<typeof insertServerSchema>;
export type Server = typeof serversTable.$inferSelect;
