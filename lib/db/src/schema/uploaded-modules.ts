import { pgTable, text, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const moduleTypeEnum = pgEnum("module_type", ["server", "gateway", "registrar"]);
export const moduleStatusEnum = pgEnum("module_status", ["active", "inactive", "error"]);

export const uploadedModulesTable = pgTable("uploaded_modules", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  type: moduleTypeEnum("type").notNull().default("gateway"),
  version: text("version").default("1.0.0"),
  description: text("description"),
  configFields: text("config_fields").notNull().default("[]"),
  config: text("config").notNull().default("{}"),
  hooks: text("hooks").notNull().default("[]"),
  folderPath: text("folder_path"),
  status: moduleStatusEnum("status").notNull().default("inactive"),
  isActive: boolean("is_active").notNull().default(false),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUploadedModuleSchema = createInsertSchema(uploadedModulesTable)
  .omit({ id: true, uploadedAt: true, updatedAt: true });

export type InsertUploadedModule = z.infer<typeof insertUploadedModuleSchema>;
export type UploadedModule = typeof uploadedModulesTable.$inferSelect;
