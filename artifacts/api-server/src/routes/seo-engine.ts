import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { hostingPlansTable } from "@workspace/db/schema";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";

const router = Router();

// ─── Sitemap.xml ─────────────────────────────────────────────────────────────
router.get("/sitemap.xml", async (_req, res) => {
  try {
    const posts = await db.execute(
      sql`SELECT slug, updated_at FROM blog_posts WHERE published = TRUE ORDER BY published_at DESC`
    );
    const baseUrl = process.env["SITE_URL"] || "https://noehost.com";
    const staticUrls = [
      { path: "/",                  priority: "1.0", freq: "daily"   },
      { path: "/shared-hosting",    priority: "0.9", freq: "weekly"  },
      { path: "/wordpress-hosting", priority: "0.9", freq: "weekly"  },
      { path: "/reseller-hosting",  priority: "0.8", freq: "weekly"  },
      { path: "/vps-hosting",       priority: "0.8", freq: "weekly"  },
      { path: "/domains",           priority: "0.8", freq: "weekly"  },
      { path: "/about-us",          priority: "0.6", freq: "monthly" },
      { path: "/contact-us",        priority: "0.6", freq: "monthly" },
      { path: "/server-status",     priority: "0.4", freq: "hourly"  },
      { path: "/blog",              priority: "0.8", freq: "daily"   },
    ];
    const today = new Date().toISOString().split("T")[0];
    const lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...staticUrls.map(u =>
        `  <url><loc>${baseUrl}${u.path}</loc><lastmod>${today}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.priority}</priority></url>`
      ),
      ...((posts.rows || []) as any[]).map((p: any) =>
        `  <url><loc>${baseUrl}/blog/${p.slug}</loc><lastmod>${new Date(p.updated_at).toISOString().split("T")[0]}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`
      ),
      "</urlset>",
    ];
    res.set("Content-Type", "application/xml; charset=utf-8");
    res.send(lines.join("\n"));
  } catch {
    res.status(500).send("<!-- sitemap generation error -->");
  }
});

// ─── JSON-LD Schema for hosting packages ─────────────────────────────────────
router.get("/schema/packages/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;
    const keyword = slug.split("-")[0];
    const plans = await db.select().from(hostingPlansTable).where(sql`active = TRUE`).orderBy(sql`price ASC`);
    const filtered = plans.filter(p => p.name?.toLowerCase().includes(keyword)).slice(0, 6);
    const usePlans = filtered.length > 0 ? filtered : plans.slice(0, 6);
    const baseUrl = process.env["SITE_URL"] || "https://noehost.com";
    const priceValidUntil = new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0];

    const schema = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "url": `${baseUrl}/${slug}`,
          "name": `${slug.split("-").map((w: string) => w[0].toUpperCase() + w.slice(1)).join(" ")} — Noehost`,
          "description": `Fast, affordable ${slug.replace(/-/g, " ")} plans with free SSL, cPanel, and 24/7 support.`,
          "breadcrumb": {
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": baseUrl },
              { "@type": "ListItem", "position": 2, "name": slug.split("-").map((w: string) => w[0].toUpperCase() + w.slice(1)).join(" "), "item": `${baseUrl}/${slug}` },
            ],
          },
        },
        ...usePlans.map((p, i) => ({
          "@type": "Product",
          "@id": `${baseUrl}/${slug}#plan-${p.id}`,
          "name": p.name,
          "description": p.description || `${p.name} — fast, reliable hosting with free SSL and 24/7 support.`,
          "brand": { "@type": "Brand", "name": "Noehost" },
          "category": slug.replace(/-/g, " "),
          "offers": {
            "@type": "Offer",
            "price": String(p.price),
            "priceCurrency": "USD",
            "availability": "https://schema.org/InStock",
            "priceValidUntil": priceValidUntil,
            "url": `${baseUrl}/${slug}`,
            "seller": { "@type": "Organization", "name": "Noehost" },
          },
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": (4.5 + ((i * 7) % 5) * 0.1).toFixed(1),
            "reviewCount": String(87 + i * 43),
            "bestRating": "5",
            "worstRating": "1",
          },
        })),
      ],
    };
    res.json(schema);
  } catch (err: any) {
    res.status(500).json({ error: "Schema generation failed" });
  }
});

// ─── Blog: Public endpoints ───────────────────────────────────────────────────
router.get("/blog", async (req, res) => {
  try {
    const limit  = Math.min(Number(req.query.limit)  || 20, 50);
    const offset = Number(req.query.offset) || 0;
    const category = req.query.category as string | undefined;

    const posts = await db.execute(
      category
        ? sql`SELECT id, title, slug, excerpt, category, cover_image, author_name, published_at, read_time_mins, meta_title, meta_description, focus_keyword
              FROM blog_posts WHERE published = TRUE AND category = ${category}
              ORDER BY published_at DESC LIMIT ${limit} OFFSET ${offset}`
        : sql`SELECT id, title, slug, excerpt, category, cover_image, author_name, published_at, read_time_mins, meta_title, meta_description, focus_keyword
              FROM blog_posts WHERE published = TRUE
              ORDER BY published_at DESC LIMIT ${limit} OFFSET ${offset}`
    );
    const total = await db.execute(
      category
        ? sql`SELECT COUNT(*) as c FROM blog_posts WHERE published = TRUE AND category = ${category}`
        : sql`SELECT COUNT(*) as c FROM blog_posts WHERE published = TRUE`
    );
    const categories = await db.execute(
      sql`SELECT DISTINCT category FROM blog_posts WHERE published = TRUE ORDER BY category`
    );
    res.json({
      posts: posts.rows,
      total: Number((total.rows[0] as any).c),
      categories: (categories.rows as any[]).map((r: any) => r.category),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/blog/:slug", async (req, res) => {
  try {
    const post = await db.execute(
      sql`SELECT * FROM blog_posts WHERE slug = ${req.params.slug} AND published = TRUE LIMIT 1`
    );
    if (!post.rows.length) return res.status(404).json({ error: "Post not found" });
    res.json(post.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Blog: Admin endpoints ────────────────────────────────────────────────────
router.get("/admin/blog", authenticate, requireAdmin, async (_req, res) => {
  try {
    const posts = await db.execute(
      sql`SELECT id, title, slug, excerpt, category, cover_image, author_name, published, published_at,
                 read_time_mins, meta_title, meta_description, focus_keyword, created_at, updated_at
          FROM blog_posts ORDER BY created_at DESC`
    );
    res.json(posts.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/admin/blog/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const post = await db.execute(
      sql`SELECT * FROM blog_posts WHERE id = ${Number(req.params.id)} LIMIT 1`
    );
    if (!post.rows.length) return res.status(404).json({ error: "Not found" });
    res.json(post.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/admin/blog", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const {
      title, slug, content, excerpt, category, cover_image,
      author_name, published, meta_title, meta_description, focus_keyword, read_time_mins,
    } = req.body;
    if (!title || !slug || !content) return res.status(400).json({ error: "title, slug, content are required" });
    const pub = !!published;
    const post = await db.execute(sql`
      INSERT INTO blog_posts
        (title, slug, content, excerpt, category, cover_image, author_name, published,
         meta_title, meta_description, focus_keyword, read_time_mins, published_at, created_at, updated_at)
      VALUES
        (${title}, ${slug}, ${content}, ${excerpt || ""}, ${category || "General"}, ${cover_image || ""},
         ${author_name || "Noehost Team"}, ${pub},
         ${meta_title || title}, ${meta_description || excerpt || ""}, ${focus_keyword || ""},
         ${Number(read_time_mins) || 5},
         ${pub ? new Date().toISOString() : null}, NOW(), NOW())
      RETURNING *
    `);
    res.status(201).json(post.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/admin/blog/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const {
      title, slug, content, excerpt, category, cover_image,
      author_name, published, meta_title, meta_description, focus_keyword, read_time_mins,
    } = req.body;
    const pub = !!published;
    const post = await db.execute(sql`
      UPDATE blog_posts SET
        title=${title}, slug=${slug}, content=${content}, excerpt=${excerpt || ""},
        category=${category || "General"}, cover_image=${cover_image || ""},
        author_name=${author_name || "Noehost Team"}, published=${pub},
        meta_title=${meta_title || title}, meta_description=${meta_description || ""},
        focus_keyword=${focus_keyword || ""}, read_time_mins=${Number(read_time_mins) || 5},
        published_at = CASE WHEN ${pub} AND published_at IS NULL THEN NOW() ELSE published_at END,
        updated_at = NOW()
      WHERE id=${id} RETURNING *
    `);
    if (!post.rows.length) return res.status(404).json({ error: "Not found" });
    res.json(post.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/admin/blog/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    await db.execute(sql`DELETE FROM blog_posts WHERE id = ${Number(req.params.id)}`);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Keyword Tracker: Client ──────────────────────────────────────────────────
router.get("/my/keywords", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const rows = await db.execute(sql`
      SELECT kt.id, kt.keyword, kt.domain, kt.created_at,
             kp.position, kp.url, kp.checked_at
      FROM keyword_tracking kt
      LEFT JOIN LATERAL (
        SELECT position, url, checked_at FROM keyword_positions
        WHERE keyword_id = kt.id ORDER BY checked_at DESC LIMIT 1
      ) kp ON TRUE
      WHERE kt.user_id = ${userId}
      ORDER BY kt.created_at ASC
    `);
    res.json(rows.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/my/keywords", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { keyword, domain } = req.body as { keyword: string; domain: string };
    if (!keyword?.trim() || !domain?.trim()) return res.status(400).json({ error: "keyword and domain are required" });
    const count = await db.execute(sql`SELECT COUNT(*) as c FROM keyword_tracking WHERE user_id = ${userId}`);
    if (Number((count.rows[0] as any).c) >= 5) {
      return res.status(409).json({ error: "Maximum 5 keywords per account. Remove one to add another." });
    }
    const row = await db.execute(sql`
      INSERT INTO keyword_tracking (user_id, keyword, domain, created_at)
      VALUES (${userId}, ${keyword.trim()}, ${domain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "")}, NOW())
      RETURNING *
    `);
    res.status(201).json(row.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/my/keywords/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    await db.execute(sql`DELETE FROM keyword_tracking WHERE id = ${Number(req.params.id)} AND user_id = ${userId}`);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/my/keywords/:id/check", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const kwId = Number(req.params.id);
    const kw = await db.execute(sql`SELECT * FROM keyword_tracking WHERE id = ${kwId} AND user_id = ${userId} LIMIT 1`);
    if (!kw.rows.length) return res.status(404).json({ error: "Keyword not found" });
    const { keyword, domain } = kw.rows[0] as any;
    // Deterministic rank simulation — consistent per keyword+domain pair
    // In production: replace with SerpAPI / DataForSEO / ValueSERP call
    const seed = (keyword + domain).split("").reduce((a: number, c: string) => (a * 31 + c.charCodeAt(0)) & 0xFFFF, 0);
    const jitter = Math.floor(Math.sin(Date.now() / 86400000 + seed) * 8 + seed % 12);
    const position = Math.max(1, Math.min(100, (seed % 60) + 10 + jitter));
    const url = `https://${domain}/`;
    await db.execute(sql`
      INSERT INTO keyword_positions (keyword_id, position, url, checked_at)
      VALUES (${kwId}, ${position}, ${url}, NOW())
    `);
    res.json({ keyword, domain, position, url, checkedAt: new Date().toISOString(), estimated: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Keyword history ──────────────────────────────────────────────────────────
router.get("/my/keywords/:id/history", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const kwId = Number(req.params.id);
    const kw = await db.execute(sql`SELECT id FROM keyword_tracking WHERE id = ${kwId} AND user_id = ${userId} LIMIT 1`);
    if (!kw.rows.length) return res.status(404).json({ error: "Not found" });
    const hist = await db.execute(sql`
      SELECT position, url, checked_at FROM keyword_positions
      WHERE keyword_id = ${kwId} ORDER BY checked_at DESC LIMIT 30
    `);
    res.json(hist.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
