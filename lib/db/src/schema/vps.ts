import { pgTable, text, timestamp, numeric, integer, boolean } from "drizzle-orm/pg-core";

export const vpsPlansTable = pgTable("vps_plans", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  quarterlyPrice: numeric("quarterly_price", { precision: 10, scale: 2 }),
  semiannualPrice: numeric("semiannual_price", { precision: 10, scale: 2 }),
  yearlyPrice: numeric("yearly_price", { precision: 10, scale: 2 }),
  biennialPrice: numeric("biennial_price", { precision: 10, scale: 2 }),
  cpuCores: integer("cpu_cores").notNull().default(1),
  ramGb: integer("ram_gb").notNull().default(1),
  storageGb: integer("storage_gb").notNull().default(20),
  bandwidthTb: numeric("bandwidth_tb", { precision: 5, scale: 2 }).default("1"),
  virtualization: text("virtualization").default("KVM"),
  features: text("features").array().default([]),
  osTemplateIds: text("os_template_ids").array().default([]),
  locationIds: text("location_ids").array().default([]),
  saveAmount: numeric("save_amount", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const vpsOsTemplatesTable = pgTable("vps_os_templates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  version: text("version").notNull(),
  iconUrl: text("icon_url"),
  imageId: text("image_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const vpsLocationsTable = pgTable("vps_locations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  countryName: text("country_name").notNull(),
  countryCode: text("country_code").notNull(),
  flagIcon: text("flag_icon"),
  city: text("city"),
  datacenter: text("datacenter"),
  networkSpeed: text("network_speed").default("1 Gbps"),
  latencyMs: integer("latency_ms").default(10),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type VpsPlan      = typeof vpsPlansTable.$inferSelect;
export type VpsOsTemplate = typeof vpsOsTemplatesTable.$inferSelect;
export type VpsLocation  = typeof vpsLocationsTable.$inferSelect;
