import { pgTable, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const kbCategoriesTable = pgTable("kb_categories", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  nameUr: text("name_ur"),
  nameAr: text("name_ar"),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  descriptionUr: text("description_ur"),
  descriptionAr: text("description_ar"),
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
  titleUr: text("title_ur"),
  titleAr: text("title_ar"),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull().default(""),
  excerpt: text("excerpt"),
  excerptUr: text("excerpt_ur"),
  excerptAr: text("excerpt_ar"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  isFeatured: boolean("is_featured").notNull().default(false),
  isPublished: boolean("is_published").notNull().default(true),
  views: integer("views").notNull().default(0),
  helpfulYes: integer("helpful_yes").notNull().default(0),
  helpfulNo: integer("helpful_no").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const kbDeflectionsTable = pgTable("kb_deflections", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull(),
  articleId: text("article_id").notNull(),
  articleTitle: text("article_title").notNull(),
  articleSlug: text("article_slug").notNull(),
  ticketSubject: text("ticket_subject").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type KbCategory = typeof kbCategoriesTable.$inferSelect;
export type KbArticle = typeof kbArticlesTable.$inferSelect;
export type KbDeflection = typeof kbDeflectionsTable.$inferSelect;
