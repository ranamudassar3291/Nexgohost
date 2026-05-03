import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { sitePagesTable } from "@workspace/db/schema";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";

const router = Router();

const DEFAULT_SECTIONS_JSON = JSON.stringify({
  hero: {
    badge: "Welcome",
    title: "Page Title",
    titleHighlight: "",
    description: "Add your page description here.",
    btnText: "Get Started",
    btnUrl: "/register",
  },
  text: {
    heading: "About This Page",
    content: "Edit this content from the Admin Panel → Page Manager.",
  },
  faq: [],
});

async function ensureTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS site_pages (
        id SERIAL PRIMARY KEY,
        page_slug VARCHAR(120) NOT NULL UNIQUE,
        page_title VARCHAR(200) NOT NULL,
        meta_description TEXT,
        keywords TEXT,
        sections_json TEXT NOT NULL DEFAULT '{}',
        is_visible BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const seeds = [
      ["home",               "Home"],
      ["about",              "About"],
      ["contact",            "Contact"],
      ["pricing",            "Pricing"],
      ["terms",              "Terms & Conditions"],
      ["privacy",            "Privacy Policy"],
      ["shared-hosting",     "Shared Hosting"],
      ["wordpress-hosting",  "WordPress Hosting"],
      ["reseller-hosting",   "Reseller Hosting"],
      ["vps-hosting",        "VPS Hosting"],
      ["domains",            "Domains"],
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

// ── Public: get a single page ──────────────────────────────────────────────────
router.get("/pages/:pageSlug", async (req, res) => {
  try {
    const row = await db
      .select()
      .from(sitePagesTable)
      .where(eq(sitePagesTable.pageSlug, req.params.pageSlug))
      .limit(1);
    if (!row[0]) return res.status(404).json({ error: "Not found" });
    return res.json(row[0]);
  } catch (err) {
    console.error("[pages] GET /pages/:slug error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: list all pages ─────────────────────────────────────────────────────
router.get("/admin/pages", authenticate, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const rows = await db.select().from(sitePagesTable);
    return res.json({ pages: rows });
  } catch (err) {
    console.error("[pages] GET /admin/pages error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: get single page ────────────────────────────────────────────────────
router.get("/admin/pages/:pageSlug", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const row = await db
      .select()
      .from(sitePagesTable)
      .where(eq(sitePagesTable.pageSlug, req.params.pageSlug))
      .limit(1);
    if (!row[0]) return res.status(404).json({ error: "Not found" });
    return res.json(row[0]);
  } catch (err) {
    console.error("[pages] GET /admin/pages/:slug error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: create new page ────────────────────────────────────────────────────
router.post("/admin/pages", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { pageTitle, pageSlug } = req.body as { pageTitle: string; pageSlug: string };
    if (!pageTitle || !pageSlug) {
      return res.status(400).json({ error: "pageTitle and pageSlug are required" });
    }
    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(pageSlug)) {
      return res.status(400).json({ error: "Slug must contain only lowercase letters, numbers, and hyphens" });
    }
    const [created] = await db
      .insert(sitePagesTable)
      .values({
        pageTitle,
        pageSlug,
        metaDescription: "",
        keywords: "",
        sectionsJson: DEFAULT_SECTIONS_JSON,
        isVisible: true,
      })
      .returning();
    return res.json(created);
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(409).json({ error: "A page with this slug already exists" });
    }
    console.error("[pages] POST /admin/pages error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: update page ────────────────────────────────────────────────────────
router.put("/admin/pages/:pageSlug", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { pageTitle, metaDescription, keywords, sectionsJson, isVisible } = req.body as any;
    const updateData: any = {};
    if (pageTitle !== undefined)      updateData.pageTitle = pageTitle;
    if (metaDescription !== undefined) updateData.metaDescription = metaDescription;
    if (keywords !== undefined)        updateData.keywords = keywords;
    if (sectionsJson !== undefined)    updateData.sectionsJson = sectionsJson;
    if (isVisible !== undefined)       updateData.isVisible = isVisible;

    const [updated] = await db
      .update(sitePagesTable)
      .set(updateData)
      .where(eq(sitePagesTable.pageSlug, req.params.pageSlug))
      .returning();

    if (!updated) return res.status(404).json({ error: "Page not found" });
    return res.json(updated);
  } catch (err) {
    console.error("[pages] PUT /admin/pages/:slug error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: delete page ────────────────────────────────────────────────────────
router.delete("/admin/pages/:pageSlug", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const protectedSlugs = new Set([
      "home", "about", "contact", "pricing", "terms", "privacy",
      "shared-hosting", "wordpress-hosting", "reseller-hosting", "vps-hosting", "domains",
    ]);
    if (protectedSlugs.has(req.params.pageSlug)) {
      return res.status(403).json({ error: "Cannot delete built-in pages" });
    }
    const [deleted] = await db
      .delete(sitePagesTable)
      .where(eq(sitePagesTable.pageSlug, req.params.pageSlug))
      .returning();
    if (!deleted) return res.status(404).json({ error: "Page not found" });
    return res.json({ success: true });
  } catch (err) {
    console.error("[pages] DELETE /admin/pages/:slug error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
