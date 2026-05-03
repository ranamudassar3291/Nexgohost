import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { emitActivity } from "../lib/activity.js";

const router = Router();

// ─── Feature catalogue (source of truth) ─────────────────────────────────────
export const FEATURE_CATALOGUE = [
  { key: "ai_insights",        label: "AI Insights",           description: "AI-powered site health recommendations and growth upsell tips", category: "AI" },
  { key: "ai_ticket_suggest",  label: "AI Ticket Suggestions", description: "Knowledge base suggestions powered by AI while typing a ticket", category: "AI" },
  { key: "seo_toolkit",        label: "SEO Toolkit",           description: "On-page SEO scanner, keyword score, and improvement suggestions", category: "Tools" },
  { key: "team_access",        label: "Team Access",           description: "Multi-user team members with role-based access control", category: "Tools" },
  { key: "ip_unblocker",       label: "IP Unblocker",          description: "One-click self-service IP unblock from the client dashboard", category: "Security" },
  { key: "growth_suite",       label: "Growth Suite",          description: "Upsell recommendation banners, resource usage charts, upgrade CTAs", category: "Growth" },
  { key: "health_meter",       label: "Health Meter",          description: "Real-time CPU, RAM, disk, uptime monitoring on the client dashboard", category: "Monitoring" },
  { key: "security_dashboard", label: "Security Dashboard",    description: "Firewall rules, IP whitelist management, unblock logs, CAPTCHA config", category: "Security" },
] as const;

// ─── Config defaults (seeded on first load) ───────────────────────────────────
const CONFIG_DEFAULTS: Record<string, string> = {
  "health.cpu_warning":      "65",
  "health.cpu_critical":     "85",
  "health.ram_warning":      "70",
  "health.ram_critical":     "85",
  "health.disk_warning":     "75",
  "health.disk_critical":    "90",
  "health.speed_warning":    "75",
  "upsell.banner_disk":      "Your disk is nearing capacity — upgrading to NVMe storage gives you 3× more space and 30% faster page loads.",
  "upsell.banner_cpu":       "CPU usage is high — a VPS upgrade gives you dedicated cores and eliminates slowdowns during traffic spikes.",
  "upsell.banner_ram":       "RAM usage is elevated — consider upgrading your plan so your site never runs out of memory during peak hours.",
  "upsell.banner_speed":     "Your speed score is low — switching to an NVMe SSD plan can boost loading by up to 30% and improve your SEO ranking.",
  "upsell.banner_default":   "Your site is growing steadily! Upgrading to NVMe SSD storage now gives you 30% faster loads and room to scale.",
};

async function seedConfigDefaults() {
  for (const [key, value] of Object.entries(CONFIG_DEFAULTS)) {
    await db.execute(sql`
      INSERT INTO admin_config (key, value, updated_at)
      VALUES (${key}, ${value}, NOW())
      ON CONFLICT (key) DO NOTHING
    `).catch(() => {});
  }
}

// ─── GET /admin/command-center/features ──────────────────────────────────────
router.get("/admin/command-center/features", authenticate, requireAdmin, async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT feature_key, user_id, enabled, updated_by, updated_at
      FROM feature_flags
      ORDER BY feature_key, user_id NULLS FIRST
    `);
    res.json({ catalogue: FEATURE_CATALOGUE, flags: rows.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /admin/command-center/features ──────────────────────────────────────
// body: { feature_key, user_id (null = global), enabled }
router.put("/admin/command-center/features", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { feature_key, user_id, enabled } = req.body as {
      feature_key: string;
      user_id?: string | null;
      enabled: boolean;
    };
    const adminId = req.user!.userId;
    const adminEmail = req.user!.email ?? "admin";

    if (user_id) {
      await db.execute(sql`DELETE FROM feature_flags WHERE feature_key = ${feature_key} AND user_id = ${user_id}`);
      await db.execute(sql`
        INSERT INTO feature_flags (feature_key, user_id, enabled, updated_by, updated_at)
        VALUES (${feature_key}, ${user_id}, ${enabled}, ${adminId}, NOW())
      `);
    } else {
      await db.execute(sql`DELETE FROM feature_flags WHERE feature_key = ${feature_key} AND user_id IS NULL`);
      await db.execute(sql`
        INSERT INTO feature_flags (feature_key, user_id, enabled, updated_by, updated_at)
        VALUES (${feature_key}, NULL, ${enabled}, ${adminId}, NOW())
      `);
    }

    await emitActivity({
      userId: adminId,
      userEmail: adminEmail,
      userName: "Admin",
      action: `${enabled ? "Enabled" : "Disabled"} feature "${feature_key}"${user_id ? ` for client ${user_id}` : " globally"}`,
      meta: { type: "feature_toggle", feature_key, user_id, enabled },
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /admin/command-center/config ────────────────────────────────────────
router.get("/admin/command-center/config", authenticate, requireAdmin, async (_req, res) => {
  try {
    await seedConfigDefaults();
    const rows = await db.execute(sql`SELECT key, value, updated_by, updated_at FROM admin_config ORDER BY key`);
    res.json({ config: rows.rows, defaults: CONFIG_DEFAULTS });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /admin/command-center/config/:key ───────────────────────────────────
router.put("/admin/command-center/config/:key", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const key = req.params.key;
    const { value } = req.body as { value: string };
    const adminId = req.user!.userId;

    await db.execute(sql`
      INSERT INTO admin_config (key, value, updated_by, updated_at)
      VALUES (${key}, ${value}, ${adminId}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_by = ${adminId}, updated_at = NOW()
    `);

    res.json({ success: true, key, value });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /admin/command-center/config-bulk ───────────────────────────────────
router.put("/admin/command-center/config-bulk", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { updates } = req.body as { updates: Record<string, string> };
    const adminId = req.user!.userId;

    for (const [key, value] of Object.entries(updates)) {
      await db.execute(sql`
        INSERT INTO admin_config (key, value, updated_by, updated_at)
        VALUES (${key}, ${value}, ${adminId}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_by = ${adminId}, updated_at = NOW()
      `);
    }

    await emitActivity({
      userId: adminId,
      userEmail: req.user!.email ?? "admin",
      userName: "Admin",
      action: `Updated ${Object.keys(updates).length} configuration value(s)`,
      meta: { type: "config_update", keys: Object.keys(updates) },
    });

    res.json({ success: true, updated: Object.keys(updates).length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /admin/command-center/activity ──────────────────────────────────────
router.get("/admin/command-center/activity", authenticate, requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? "60")), 200);
    const rows = await db.execute(sql`
      SELECT id, user_id, user_email, user_name, action, meta, created_at
      FROM activity_stream
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);
    res.json({ events: rows.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /my/features — client checks which features are enabled for them ─────
router.get("/my/features", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Per-user overrides take precedence over global defaults
    const rows = await db.execute(sql`
      SELECT DISTINCT ON (feature_key) feature_key, enabled
      FROM feature_flags
      WHERE user_id IS NULL OR user_id = ${userId}
      ORDER BY feature_key, (user_id IS NOT NULL) DESC
    `);

    const featureMap: Record<string, boolean> = {};
    for (const row of rows.rows as any[]) {
      featureMap[row.feature_key] = row.enabled;
    }

    res.json({ features: featureMap });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
