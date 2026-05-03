import { pgTable, serial, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const sitePagesTable = pgTable(
  "site_pages",
  {
    id: serial("id").primaryKey(),
    pageSlug: varchar("page_slug", { length: 120 }).notNull().unique(),
    pageTitle: varchar("page_title", { length: 200 }).notNull(),
    metaDescription: text("meta_description"),
    keywords: text("keywords"),
    sectionsJson: text("sections_json").notNull(),
    isVisible: boolean("is_visible").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
);
