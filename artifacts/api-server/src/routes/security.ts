import { Router } from "express";
import { db } from "@workspace/db";
import { securityLogsTable, blockedIpsTable } from "@workspace/db/schema";
import { authenticate, requireAdmin } from "../lib/auth.js";
import { desc, eq, gt, sql } from "drizzle-orm";
import {
  getSecurityConfig, setSecuritySetting, verifyCaptcha, getClientIp,
  type SecurityConfig,
} from "../lib/security.js";

const router = Router();

// ── GET /api/admin/security/settings ─────────────────────────────────────────
router.get("/admin/security/settings", authenticate, requireAdmin, async (_req, res) => {
  try {
    const config = await getSecurityConfig();
    // Never expose secret key to frontend
    res.json({ ...config, secretKey: config.secretKey ? "••••••••••••" : "" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/admin/security/settings ─────────────────────────────────────────
router.put("/admin/security/settings", authenticate, requireAdmin, async (req, res) => {
  try {
    const body = req.body as Partial<SecurityConfig>;
    if (body.provider) await setSecuritySetting("security.captcha.provider", body.provider);
    if (body.siteKey !== undefined) await setSecuritySetting("security.captcha.site_key", body.siteKey);
    // Only update secret key if a real value is provided (not the masked placeholder)
    if (body.secretKey && !body.secretKey.startsWith("•")) {
      await setSecuritySetting("security.captcha.secret_key", body.secretKey);
    }
    if (body.enabledPages) {
      await setSecuritySetting("security.captcha.enabled_pages", JSON.stringify(body.enabledPages));
    }
    res.json({ success: true, message: "Security settings saved" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/security/logs ──────────────────────────────────────────────
router.get("/admin/security/logs", authenticate, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string || "100");
    const logs = await db.select().from(securityLogsTable)
      .orderBy(desc(securityLogsTable.createdAt))
      .limit(limit);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/security/blocked-ips ──────────────────────────────────────
router.get("/admin/security/blocked-ips", authenticate, requireAdmin, async (_req, res) => {
  try {
    const now = new Date();
    const ips = await db.select().from(blockedIpsTable)
      .where(gt(blockedIpsTable.blockedUntil, now))
      .orderBy(desc(blockedIpsTable.createdAt));
    res.json(ips);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/admin/security/blocked-ips/:ip ────────────────────────────────
router.delete("/admin/security/blocked-ips/:ip", authenticate, requireAdmin, async (req, res) => {
  try {
    await db.delete(blockedIpsTable).where(eq(blockedIpsTable.ipAddress, req.params.ip));
    res.json({ success: true, message: `IP ${req.params.ip} unblocked` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/admin/security/logs ───────────────────────────────────────────
router.delete("/admin/security/logs", authenticate, requireAdmin, async (_req, res) => {
  try {
    await db.delete(securityLogsTable).where(sql`created_at < NOW() - INTERVAL '7 days'`);
    res.json({ success: true, message: "Cleared security logs older than 7 days" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/security/captcha-config — public: send only site key + enabled pages ──
router.get("/security/captcha-config", async (_req, res) => {
  try {
    const config = await getSecurityConfig();
    res.json({
      provider: config.provider,
      siteKey: config.siteKey,
      enabledPages: config.enabledPages,
    });
  } catch {
    res.json({ provider: "turnstile", siteKey: "", enabledPages: {} });
  }
});

// ── POST /api/security/verify-captcha — used by frontend for pre-check ────────
router.post("/security/verify-captcha", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, error: "No token" });
    const config = await getSecurityConfig();
    if (!config.secretKey) return res.json({ success: true }); // not configured = pass
    const ok = await verifyCaptcha(token, config.secretKey, config.provider);
    res.json({ success: ok });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/admin/security/stats ─────────────────────────────────────────────
router.get("/admin/security/stats", authenticate, requireAdmin, async (_req, res) => {
  try {
    const [totalLogs] = await db.execute(sql`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN event = 'login_failed' THEN 1 ELSE 0 END) AS failed_logins,
        SUM(CASE WHEN event = 'brute_force' THEN 1 ELSE 0 END) AS brute_force,
        SUM(CASE WHEN event = 'bot_blocked' THEN 1 ELSE 0 END) AS bots_blocked,
        SUM(CASE WHEN event = 'suspicious_scan' THEN 1 ELSE 0 END) AS scans_blocked
      FROM security_logs
      WHERE created_at > NOW() - INTERVAL '30 days'
    `) as any[];

    const now = new Date();
    const [activeBlocks] = await db.execute(sql`
      SELECT COUNT(*) AS count FROM blocked_ips WHERE blocked_until > NOW()
    `) as any[];

    res.json({
      totalEvents: Number(totalLogs?.total ?? 0),
      failedLogins: Number(totalLogs?.failed_logins ?? 0),
      bruteForce: Number(totalLogs?.brute_force ?? 0),
      botsBlocked: Number(totalLogs?.bots_blocked ?? 0),
      scansBlocked: Number(totalLogs?.scans_blocked ?? 0),
      activeBlocks: Number(activeBlocks?.count ?? 0),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
