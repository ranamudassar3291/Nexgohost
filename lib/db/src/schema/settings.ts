import { pgTable, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const settingsTable = pgTable("settings", {
  key:       varchar("key", { length: 100 }).primaryKey(),
  value:     text("value"),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
});
