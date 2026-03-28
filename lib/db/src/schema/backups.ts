import { pgTable, text, timestamp, numeric, integer } from "drizzle-orm/pg-core";

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

export const driveBackupLogsTable = pgTable("drive_backup_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  status: text("status").notNull().default("pending"),
  triggeredBy: text("triggered_by").notNull().default("cron"),
  dbFileId: text("db_file_id"),
  dbFileName: text("db_file_name"),
  filesFileId: text("files_file_id"),
  filesFileName: text("files_file_name"),
  dbSizeKb: integer("db_size_kb"),
  filesSizeKb: integer("files_size_kb"),
  driveUsedMb: integer("drive_used_mb"),
  driveTotalMb: integer("drive_total_mb"),
  driveDbFolderId: text("drive_db_folder_id"),
  driveFilesFolderId: text("drive_files_folder_id"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export type DriveBackupLog = typeof driveBackupLogsTable.$inferSelect;
