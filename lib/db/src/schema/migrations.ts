import { pgTable, text, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const migrationStatusEnum = pgEnum("migration_status_enum", ["pending", "in_progress", "completed", "failed"]);

export const migrationsTable = pgTable("migrations_requests", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull(),
  domain: text("domain").notNull(),
  oldHostingProvider: text("old_hosting_provider"),
  oldCpanelHost: text("old_cpanel_host").notNull(),
  oldCpanelUsername: text("old_cpanel_username").notNull(),
  oldCpanelPassword: text("old_cpanel_password").notNull(),
  status: migrationStatusEnum("status").notNull().default("pending"),
  progress: integer("progress").default(0),
  notes: text("notes"),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertMigrationSchema = createInsertSchema(migrationsTable).omit({ id: true, requestedAt: true });
export type InsertMigration = z.infer<typeof insertMigrationSchema>;
export type Migration = typeof migrationsTable.$inferSelect;
