import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin, authenticate } from "../lib/auth.js";
import { randomUUID } from "crypto";

const router = Router();

// ─── Flash Sales ─────────────────────────────────────────────────────────────

// Public: list active flash sales
router.get("/flash-sales", async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT * FROM flash_sales
      WHERE is_active = true AND (ends_at IS NULL OR ends_at > NOW())
      ORDER BY created_at DESC
    `);
    res.json({ flashSales: rows.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Public: get single flash sale by slug
router.get("/flash-sales/:slug", async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT * FROM flash_sales WHERE slug = ${req.params.slug} LIMIT 1
    `);
    if (!rows.rows.length) return res.status(404).json({ error: "Flash sale not found" });
    res.json({ flashSale: rows.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: list all flash sales
router.get("/admin/flash-sales", requireAdmin, async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT * FROM flash_sales ORDER BY created_at DESC
    `);
    res.json({ flashSales: rows.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: create flash sale
router.post("/admin/flash-sales", requireAdmin, async (req, res) => {
  try {
    const {
      title, slug, headline, subheadline, badge_text,
      cta_text, cta_url, original_price, sale_price, currency,
      ends_at, bg_color, accent_color, is_active,
    } = req.body;
    if (!title || !slug) return res.status(400).json({ error: "title and slug are required" });
    const id = randomUUID();
    await db.execute(sql`
      INSERT INTO flash_sales (
        id, title, slug, headline, subheadline, badge_text,
        cta_text, cta_url, original_price, sale_price, currency,
        ends_at, bg_color, accent_color, is_active
      ) VALUES (
        ${id}, ${title}, ${slug}, ${headline || title}, ${subheadline || ""},
        ${badge_text || "Flash Sale"}, ${cta_text || "Grab the Deal"},
        ${cta_url || ""}, ${original_price || null}, ${sale_price || null},
        ${currency || "USD"}, ${ends_at || null}, ${bg_color || "#0F172A"},
        ${accent_color || "#6366F1"}, ${is_active !== false}
      )
    `);
    const row = await db.execute(sql`SELECT * FROM flash_sales WHERE id = ${id}`);
    res.status(201).json({ flashSale: row.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: update flash sale
router.put("/admin/flash-sales/:id", requireAdmin, async (req, res) => {
  try {
    const {
      title, slug, headline, subheadline, badge_text,
      cta_text, cta_url, original_price, sale_price, currency,
      ends_at, bg_color, accent_color, is_active,
    } = req.body;
    await db.execute(sql`
      UPDATE flash_sales SET
        title = COALESCE(${title}, title),
        slug = COALESCE(${slug}, slug),
        headline = COALESCE(${headline}, headline),
        subheadline = COALESCE(${subheadline}, subheadline),
        badge_text = COALESCE(${badge_text}, badge_text),
        cta_text = COALESCE(${cta_text}, cta_text),
        cta_url = COALESCE(${cta_url}, cta_url),
        original_price = ${original_price ?? null},
        sale_price = ${sale_price ?? null},
        currency = COALESCE(${currency}, currency),
        ends_at = ${ends_at ?? null},
        bg_color = COALESCE(${bg_color}, bg_color),
        accent_color = COALESCE(${accent_color}, accent_color),
        is_active = COALESCE(${is_active}, is_active),
        updated_at = NOW()
      WHERE id = ${req.params.id}
    `);
    const row = await db.execute(sql`SELECT * FROM flash_sales WHERE id = ${req.params.id}`);
    res.json({ flashSale: row.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: delete flash sale
router.delete("/admin/flash-sales/:id", requireAdmin, async (req, res) => {
  try {
    await db.execute(sql`DELETE FROM flash_sales WHERE id = ${req.params.id}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Cart Recovery ────────────────────────────────────────────────────────────

// Public: log an exit-intent trigger (anyone reaching checkout)
router.post("/cart-recovery/log", async (req, res) => {
  try {
    const { user_id, email, plan_name, plan_id, cart_value, discount_code } = req.body;
    const id = randomUUID();
    await db.execute(sql`
      INSERT INTO cart_recovery_logs (id, user_id, email, plan_name, plan_id, cart_value, discount_code, status)
      VALUES (${id}, ${user_id || null}, ${email || null}, ${plan_name || null}, ${plan_id || null},
              ${cart_value || null}, ${discount_code || null}, 'triggered')
    `);
    res.status(201).json({ id, success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Public: mark a recovery as converted (user came back and bought)
router.post("/cart-recovery/convert", authenticate, async (req, res) => {
  try {
    const { recovery_id } = req.body;
    await db.execute(sql`
      UPDATE cart_recovery_logs SET status = 'converted', converted_at = NOW()
      WHERE id = ${recovery_id}
    `);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: view all cart recovery logs
router.get("/admin/cart-recovery", requireAdmin, async (req, res) => {
  try {
    const { status, limit = "50", offset = "0" } = req.query as any;
    const rows = await db.execute(sql`
      SELECT * FROM cart_recovery_logs
      WHERE (${status || null} IS NULL OR status = ${status || null})
      ORDER BY created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `);
    const total = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM cart_recovery_logs
      WHERE (${status || null} IS NULL OR status = ${status || null})
    `);
    res.json({ logs: rows.rows, total: Number((total.rows[0] as any).cnt) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: cart recovery stats
router.get("/admin/cart-recovery/stats", requireAdmin, async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'triggered') AS triggered,
        COUNT(*) FILTER (WHERE status = 'converted') AS converted,
        COUNT(*) FILTER (WHERE status = 'dismissed') AS dismissed,
        ROUND(
          COUNT(*) FILTER (WHERE status = 'converted')::numeric /
          NULLIF(COUNT(*), 0) * 100, 1
        ) AS conversion_rate,
        COALESCE(SUM(cart_value) FILTER (WHERE status = 'converted'), 0) AS recovered_revenue
      FROM cart_recovery_logs
    `);
    res.json(rows.rows[0] || {});
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Social Proof Feed ────────────────────────────────────────────────────────

// Public: get recent purchase events for social proof toasts
router.get("/social-proof/feed", async (req, res) => {
  try {
    // Pull from real orders if available, supplement with seeded events
    const realOrders = await db.execute(sql`
      SELECT
        o.id,
        COALESCE(p.name, o.service_name, 'Shared Hosting') AS plan_name,
        CASE
          WHEN c.city IS NOT NULL AND c.city <> '' THEN c.city
          ELSE NULL
        END AS city,
        o.created_at
      FROM orders o
      LEFT JOIN packages p ON p.id = o.package_id
      LEFT JOIN clients c ON c.id = o.client_id
      WHERE o.created_at > NOW() - INTERVAL '7 days'
      ORDER BY o.created_at DESC
      LIMIT 20
    `).catch(() => ({ rows: [] }));

    const events = (realOrders.rows as any[]).map(r => ({
      id: r.id,
      plan_name: r.plan_name,
      city: r.city || pickCity(),
      created_at: r.created_at,
      real: true,
    }));

    // Always pad up to 15 with seeded events
    const SEEDED_EVENTS = buildSeededEvents();
    while (events.length < 15) {
      events.push(SEEDED_EVENTS[events.length % SEEDED_EVENTS.length]);
    }

    res.json({ events: events.slice(0, 15) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PK_CITIES = ["Karachi","Lahore","Islamabad","Rawalpindi","Faisalabad","Multan","Peshawar","Quetta","Hyderabad","Sialkot","Gujranwala","Abbottabad"];
const PLANS = ["Premium Shared Hosting","Business Hosting","Starter Plan","WordPress Pro","Reseller Starter","VPS Cloud 2","Node.js Hosting","cPanel Business"];
function pickCity() { return PK_CITIES[Math.floor(Math.random() * PK_CITIES.length)]; }
function pickPlan() { return PLANS[Math.floor(Math.random() * PLANS.length)]; }
function buildSeededEvents() {
  return PK_CITIES.flatMap((city, i) => ([
    { id: `seed-${i}-a`, plan_name: PLANS[i % PLANS.length], city, created_at: new Date(Date.now() - i * 3_600_000).toISOString(), real: false },
    { id: `seed-${i}-b`, plan_name: pickPlan(), city: PK_CITIES[(i + 3) % PK_CITIES.length], created_at: new Date(Date.now() - (i + 0.5) * 3_600_000).toISOString(), real: false },
  ]));
}

export default router;
