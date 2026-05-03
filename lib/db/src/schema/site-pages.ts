import { pgTable, varchar, text, boolean, timestamp, primaryKey } from "drizzle-orm/pg-core";

export const sitePagesTable = pgTable(
  "site_pages",
  {
    pageId:      varchar("page_id",      { length: 50  }).notNull(),
    sectionName: varchar("section_name", { length: 100 }).notNull(),
    contentJson: text("content_json"),
    isVisible:   boolean("is_visible").default(true).notNull(),
    lastUpdated: timestamp("last_updated").defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [primaryKey({ columns: [table.pageId, table.sectionName] })],
);
