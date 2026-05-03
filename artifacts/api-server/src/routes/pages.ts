import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { sitePagesTable } from "@workspace/db/schema";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";

const router = Router();

async function ensureTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS site_pages (
        id SERIAL PRIMARY KEY,
        page_slug VARCHAR(120) NOT NULL UNIQUE,
        page_title VARCHAR(200) NOT NULL,
        meta_description TEXT,
        keywords TEXT,
        sections_json TEXT NOT NULL,
        is_visible BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const seeds = [
      ["home", "Home"],
      ["about", "About"],
      ["pricing", "Pricing"],
      ["terms", "Terms"],
      ["privacy", "Privacy"],
      ["contact", "Contact"],
      ["shared-hosting", "Shared Hosting"],
      ["wordpress-hosting", "WordPress Hosting"],
      ["reseller-hosting", "Reseller Hosting"],
      ["vps-hosting", "VPS Hosting"],
      ["domains", "Domains"],
    ] as const;
    for (const [slug, title] of seeds) {
      await db.execute(sql`
        INSERT INTO site_pages (page_slug, page_title, meta_description, keywords, sections_json, is_visible)
        VALUES (${slug}, ${title}, '', '', '{}'::text, TRUE)
        ON CONFLICT (page_slug) DO NOTHING
      `);
    }
  } catch (err) {
    console.error("[pages] ensureTable error:", err);
  }
}
ensureTable();

router.get("/pages/:pageSlug", async (req, res) => {
  const row = await db.select().from(sitePagesTable).where(eq(sitePagesTable.pageSlug, req.params.pageSlug)).limit(1);
  if (!row[0]) return res.status(404).json({ error: "Not found" });
  return res.json(row[0]);
});

router.get("/admin/pages", authenticate, requireAdmin, async (_req: AuthRequest, res) => {
  const rows = await db.select().from(sitePagesTable);
  return res.json({ pages: rows });
});

router.get("/admin/pages/:pageSlug", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  const row = await db.select().from(sitePagesTable).where(eq(sitePagesTable.pageSlug, req.params.pageSlug)).limit(1);
  if (!row[0]) return res.status(404).json({ error: "Not found" });
  return res.json(row[0]);
});

router.post("/admin/pages", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  const { pageTitle, pageSlug } = req.body as { pageTitle: string; pageSlug: string };
  if (!pageTitle || !pageSlug) return res.status(400).json({ error: "pageTitle and pageSlug are required" });
  const [created] = await db.insert(sitePagesTable).values({
    pageTitle,
    pageSlug,
    metaDescription: "",
    keywords: "",
    sectionsJson: "{}",
    isVisible: true,
  }).returning();
  return res.json(created);
});

router.put("/admin/pages/:pageSlug", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  const { pageTitle, metaDescription, keywords, sectionsJson, isVisible } = req.body as any;
  const [updated] = await db.update(sitePagesTable)
    .set({ pageTitle, metaDescription, keywords, sectionsJson, isVisible, createdAt: new Date() })
    .where(eq(sitePagesTable.pageSlug, req.params.pageSlug))
    .returning();
  return res.json(updated);
});

export default router;
