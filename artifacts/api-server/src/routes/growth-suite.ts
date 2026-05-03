import { Router } from "express";
import { db } from "@workspace/db";
import { invoicesTable, hostingServicesTable } from "@workspace/db/schema";
import { authenticate, type AuthRequest } from "../lib/auth.js";
import { eq, and, sql, desc, sum } from "drizzle-orm";

const router = Router();

// ── HTML fetch helpers ────────────────────────────────────────────────────────
function normaliseUrl(domain: string): string {
  const d = domain.trim().replace(/\/+$/, "");
  return d.startsWith("http") ? d : `https://${d}`;
}

function extractMeta(html: string, attr: string, name: string): string {
  const re = new RegExp(`<meta[^>]+${attr}=["']${name}["'][^>]+content=["']([^"']+)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${name}["']`, "i");
  return (html.match(re) || html.match(re2))?.[1]?.trim() ?? "";
}

async function fetchWithTimeout(url: string, ms = 9000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { signal: ctrl.signal, redirect: "follow" }); }
  finally { clearTimeout(t); }
}

async function probeUrl(url: string): Promise<boolean> {
  try {
    const r = await fetchWithTimeout(url, 7000);
    return r.status < 400;
  } catch { return false; }
}

// ── POST /api/my/growth/seo-scan ──────────────────────────────────────────────
router.post("/my/growth/seo-scan", authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const { domain } = req.body as { domain: string };
  if (!domain) return res.status(400).json({ error: "domain is required" });

  const base = normaliseUrl(domain);
  let html = "";
  let fetchOk = true;
  try {
    const resp = await fetchWithTimeout(base);
    html = await resp.text();
  } catch {
    fetchOk = false;
  }

  // Parse SEO signals
  const titleMatch   = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title        = titleMatch?.[1]?.trim() ?? "";
  const metaDesc     = extractMeta(html, "name", "description");
  const ogTitle      = extractMeta(html, "property", "og:title");
  const ogDesc       = extractMeta(html, "property", "og:description");
  const ogImage      = extractMeta(html, "property", "og:image");
  const twitterCard  = extractMeta(html, "name", "twitter:card");
  const twitterImage = extractMeta(html, "name", "twitter:image");
  const canonMatch   = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
                    ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  const canonical    = canonMatch?.[1]?.trim() ?? "";
  const h1Count      = (html.match(/<h1[\s>]/gi) ?? []).length;
  const sitemapOk    = fetchOk ? await probeUrl(`${base}/sitemap.xml`) : false;
  const robotsOk     = fetchOk ? await probeUrl(`${base}/robots.txt`)  : false;
  const httpsOk      = base.startsWith("https://");
  const viewportOk   = /name=["']viewport["']/i.test(html);

  // Score (100pts max)
  let score = 0;
  if (title)     score += 15;
  if (metaDesc)  score += 15;
  if (ogTitle)   score += 10;
  if (ogImage)   score += 10;
  if (sitemapOk) score += 20;
  if (robotsOk)  score += 10;
  if (canonical) score += 10;
  if (httpsOk)   score += 5;
  if (viewportOk)score += 5;

  // Upsert: one scan per (user, domain) — replace on re-scan
  try {
    await db.execute(sql`
      INSERT INTO seo_scans
        (user_id, domain, title, meta_description, og_title, og_description, og_image,
         twitter_card, twitter_image, sitemap_ok, robots_ok, canonical, h1_count,
         https_ok, viewport_ok, score, fetch_ok, scanned_at)
      VALUES
        (${userId}, ${domain.trim()}, ${title}, ${metaDesc}, ${ogTitle}, ${ogDesc}, ${ogImage},
         ${twitterCard}, ${twitterImage}, ${sitemapOk}, ${robotsOk}, ${canonical}, ${h1Count},
         ${httpsOk}, ${viewportOk}, ${score}, ${fetchOk}, NOW())
      ON CONFLICT (user_id, domain)
      DO UPDATE SET
        title = EXCLUDED.title, meta_description = EXCLUDED.meta_description,
        og_title = EXCLUDED.og_title, og_description = EXCLUDED.og_description,
        og_image = EXCLUDED.og_image, twitter_card = EXCLUDED.twitter_card,
        twitter_image = EXCLUDED.twitter_image, sitemap_ok = EXCLUDED.sitemap_ok,
        robots_ok = EXCLUDED.robots_ok, canonical = EXCLUDED.canonical,
        h1_count = EXCLUDED.h1_count, https_ok = EXCLUDED.https_ok,
        viewport_ok = EXCLUDED.viewport_ok, score = EXCLUDED.score,
        fetch_ok = EXCLUDED.fetch_ok, scanned_at = NOW()
    `);
  } catch (err: any) {
    console.error("[growth] upsert seo_scans:", err.message);
  }

  res.json({
    domain: domain.trim(), fetchOk, title, metaDesc, ogTitle, ogDesc, ogImage,
    twitterCard, twitterImage, canonical, h1Count, sitemapOk, robotsOk,
    httpsOk, viewportOk, score, scannedAt: new Date().toISOString(),
  });
});

// ── GET /api/my/growth/seo-results ───────────────────────────────────────────
router.get("/my/growth/seo-results", authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  try {
    const rows = await db.execute(sql`
      SELECT domain, title, meta_description, og_title, og_description, og_image,
             twitter_card, twitter_image, sitemap_ok, robots_ok, canonical, h1_count,
             https_ok, viewport_ok, score, fetch_ok, scanned_at
      FROM seo_scans WHERE user_id = ${userId}
      ORDER BY scanned_at DESC
    `);
    res.json({ scans: rows.rows });
  } catch (err: any) {
    console.error("[growth] GET seo-results:", err.message);
    res.status(500).json({ error: "Failed to load scan results" });
  }
});

// ── GET /api/my/growth/domains ─────────────────────────────── user's domains
router.get("/my/growth/domains", authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  try {
    const services = await db.select({
      id: hostingServicesTable.id,
      domain: hostingServicesTable.domain,
      planName: hostingServicesTable.planName,
      status: hostingServicesTable.status,
    }).from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.clientId, userId), eq(hostingServicesTable.status, "active")));
    res.json({ domains: services.filter(s => !!s.domain) });
  } catch (err: any) {
    console.error("[growth] GET domains:", err.message);
    res.status(500).json({ error: "Failed to load domains" });
  }
});

// ── GET /api/my/growth/ad-credits ─────────────────────────────────────────────
router.get("/my/growth/ad-credits", authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  try {
    // Sum all paid invoices in base currency (PKR) divided by typical rate for USD comparison
    const result = await db.execute(sql`
      SELECT
        COALESCE(SUM(CAST(total AS NUMERIC)), 0) AS total_spent_base,
        COUNT(*) FILTER (WHERE status = 'paid') AS paid_count,
        COUNT(*) AS total_invoices
      FROM invoices
      WHERE client_id = ${userId} AND status = 'paid'
    `);
    const row = result.rows[0] as any;
    const totalBase = parseFloat(row?.total_spent_base ?? "0");

    // Use base currency amount (PKR). Tiers in PKR: 15000 (~$50), 45000 (~$150), 150000 (~$500)
    const tiers = [
      { threshold: 150_000, credit: "$500", badge: "platinum", label: "Platinum Partner", color: "#7C3AED", bg: "#EDE9FE", desc: "You qualify for up to $500 in Google Ads Credits — contact support to claim." },
      { threshold:  45_000, credit: "$150", badge: "gold",     label: "Gold Member",      color: "#D97706", bg: "#FFFBEB", desc: "You qualify for $150 in Google Ads Credits — contact support to claim." },
      { threshold:  15_000, credit: "$75",  badge: "silver",   label: "Silver Member",    color: "#6B7280", bg: "#F3F4F6", desc: "You qualify for $75 in Google Ads Credits — contact support to claim." },
    ];
    const eligible = tiers.find(t => totalBase >= t.threshold) ?? null;

    // Next tier progress
    const nextTier = eligible
      ? tiers[tiers.indexOf(eligible) - 1] ?? null
      : tiers[tiers.length - 1];
    const progress = nextTier
      ? Math.min(100, Math.round((totalBase / nextTier.threshold) * 100))
      : 100;

    res.json({
      totalSpentBase: totalBase,
      paidInvoiceCount: parseInt(row?.paid_count ?? "0"),
      eligible,
      nextTier,
      progress,
    });
  } catch (err: any) {
    console.error("[growth] GET ad-credits:", err.message);
    res.status(500).json({ error: "Failed to load ad credits" });
  }
});

export default router;
