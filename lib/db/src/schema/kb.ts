import { pgTable, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const kbCategoriesTable = pgTable("kb_categories", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  icon: text("icon").default("BookOpen"),
  sortOrder: integer("sort_order").default(0),
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const kbArticlesTable = pgTable("kb_articles", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  categoryId: text("category_id").notNull().references(() => kbCategoriesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull().default(""),
  excerpt: text("excerpt"),
  isFeatured: boolean("is_featured").notNull().default(false),
  isPublished: boolean("is_published").notNull().default(true),
  views: integer("views").notNull().default(0),
  helpfulYes: integer("helpful_yes").notNull().default(0),
  helpfulNo: integer("helpful_no").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type KbCategory = typeof kbCategoriesTable.$inferSelect;
export type KbArticle = typeof kbArticlesTable.$inferSelect;
