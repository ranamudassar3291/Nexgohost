import { pgTable, text, timestamp, numeric } from "drizzle-orm/pg-core";

export const hostingBackupsTable = pgTable("hosting_backups", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  serviceId: text("service_id").notNull(),
  clientId: text("client_id").notNull(),
  domain: text("domain").notNull(),
  filePath: text("file_path"),
  sqlPath: text("sql_path"),
  sizeMb: numeric("size_mb", { precision: 10, scale: 2 }),
  status: text("status").default("pending").notNull(),
  errorMessage: text("error_message"),
  type: text("type").default("manual").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export type HostingBackup = typeof hostingBackupsTable.$inferSelect;
