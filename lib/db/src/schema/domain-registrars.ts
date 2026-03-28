import { pgTable, text, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const registrarTypeEnum = pgEnum("registrar_type", [
  "namecheap",
  "logicboxes",
  "resellerclub",
  "enom",
  "opensrs",
  "spaceship",
  "custom",
  "none",
]);

export const domainRegistrarsTable = pgTable("domain_registrars", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  type: registrarTypeEnum("type").notNull().default("none"),
  description: text("description"),
  config: text("config").notNull().default("{}"),
  isActive: boolean("is_active").notNull().default(false),
  isDefault: boolean("is_default").notNull().default(false),
  lastTestedAt: timestamp("last_tested_at"),
  lastTestResult: text("last_test_result"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDomainRegistrarSchema = createInsertSchema(domainRegistrarsTable)
  .omit({ id: true, createdAt: true, updatedAt: true });

export type InsertDomainRegistrar = z.infer<typeof insertDomainRegistrarSchema>;
export type DomainRegistrar = typeof domainRegistrarsTable.$inferSelect;
