import { Router } from "express";
import { db } from "@workspace/db";
import {
  securityLogsTable, blockedIpsTable,
  ipWhitelistTable, migrationWhitelistTable,
} from "@workspace/db/schema";
import { authenticate, requireAdmin } from "../lib/auth.js";
import { desc, eq, gt, sql } from "drizzle-orm";
import {
  getSecurityConfig, setSecuritySetting, verifyCaptcha, getClientIp,
  isIpInMigrationWhitelist,
  type SecurityConfig,
} from "../lib/security.js";

const router = Router();

// ── GET /api/admin/security/settings ─────────────────────────────────────────
router.get("/admin/security/settings", authenticate, requireAdmin, async (_req, res) => {
  try {
    const config = await getSecurityConfig();
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

// ── GET /api/security/captcha-config — public ─────────────────────────────────
router.get("/security/captcha-config", async (_req, res) => {
  try {
    const config = await getSecurityConfig();
    res.json({ provider: config.provider, siteKey: config.siteKey, enabledPages: config.enabledPages });
  } catch {
    res.json({ provider: "turnstile", siteKey: "", enabledPages: {} });
  }
});

// ── POST /api/security/verify-captcha ─────────────────────────────────────────
router.post("/security/verify-captcha", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, error: "No token" });
    const config = await getSecurityConfig();
    if (!config.secretKey) return res.json({ success: true });
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

// ══════════════════════════════════════════════════════════════════════════════
// IP WHITELIST — Bypass auto-block for trusted client IPs
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/admin/security/ip-whitelist
router.get("/admin/security/ip-whitelist", authenticate, requireAdmin, async (_req, res) => {
  try {
    const list = await db.select().from(ipWhitelistTable)
      .orderBy(desc(ipWhitelistTable.createdAt));
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/security/ip-whitelist
router.post("/admin/security/ip-whitelist", authenticate, requireAdmin, async (req, res) => {
  try {
    const { ipAddress, label } = req.body as { ipAddress: string; label?: string };
    if (!ipAddress) return res.status(400).json({ error: "ipAddress is required" });
    const adminEmail = (req as any).user?.email ?? "admin";
    await db.insert(ipWhitelistTable)
      .values({ ipAddress: ipAddress.trim(), label: label?.trim() ?? null, addedBy: adminEmail })
      .onConflictDoUpdate({
        target: ipWhitelistTable.ipAddress,
        set: { label: label?.trim() ?? null, addedBy: adminEmail },
      });
    // Also remove from blocked_ips if present
    await db.delete(blockedIpsTable).where(eq(blockedIpsTable.ipAddress, ipAddress.trim())).catch(() => {});
    res.json({ success: true, message: `${ipAddress} added to whitelist and unblocked` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/security/ip-whitelist/:ip
router.delete("/admin/security/ip-whitelist/:ip", authenticate, requireAdmin, async (req, res) => {
  try {
    await db.delete(ipWhitelistTable).where(eq(ipWhitelistTable.ipAddress, req.params.ip));
    res.json({ success: true, message: `${req.params.ip} removed from whitelist` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// MIGRATION WHITELIST — Full API/DB access for migration server IPs
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/admin/security/migration-whitelist
router.get("/admin/security/migration-whitelist", authenticate, requireAdmin, async (_req, res) => {
  try {
    const list = await db.select().from(migrationWhitelistTable)
      .orderBy(desc(migrationWhitelistTable.createdAt));
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/security/migration-whitelist
router.post("/admin/security/migration-whitelist", authenticate, requireAdmin, async (req, res) => {
  try {
    const { ipAddress, label } = req.body as { ipAddress: string; label?: string };
    if (!ipAddress) return res.status(400).json({ error: "ipAddress is required" });
    const adminEmail = (req as any).user?.email ?? "admin";
    await db.insert(migrationWhitelistTable)
      .values({ ipAddress: ipAddress.trim(), label: label?.trim() ?? null, addedBy: adminEmail })
      .onConflictDoUpdate({
        target: migrationWhitelistTable.ipAddress,
        set: { label: label?.trim() ?? null, addedBy: adminEmail },
      });
    res.json({ success: true, message: `${ipAddress} added to migration whitelist` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/security/migration-whitelist/:ip
router.delete("/admin/security/migration-whitelist/:ip", authenticate, requireAdmin, async (req, res) => {
  try {
    await db.delete(migrationWhitelistTable).where(eq(migrationWhitelistTable.ipAddress, req.params.ip));
    res.json({ success: true, message: `${req.params.ip} removed from migration whitelist` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// MIGRATION EXPORT API — Full data export, restricted to migration whitelist IPs
// ══════════════════════════════════════════════════════════════════════════════

router.get("/admin/migrate/export", authenticate, requireAdmin, async (req, res) => {
  try {
    const ip = getClientIp(req);
    const allowed = await isIpInMigrationWhitelist(ip);
    if (!allowed) {
      return res.status(403).json({
        error: "Access denied. Your IP is not in the Migration Whitelist.",
        yourIp: ip,
        hint: "Add your server IP to Admin → Security → Firewall → Migration Whitelist first.",
      });
    }

    // Full export of all tables
    const [
      users, hosting, domains, orders, invoices, tickets,
      settings, paymentMethods, currencies, domainExtensions,
      domainTransfers, credits, affiliates, promoCodes,
      servers, knowledgeBase,
    ] = await Promise.all([
      db.execute(sql`SELECT * FROM users`),
      db.execute(sql`SELECT * FROM hosting_services`),
      db.execute(sql`SELECT * FROM domains`),
      db.execute(sql`SELECT * FROM orders`),
      db.execute(sql`SELECT * FROM invoices`),
      db.execute(sql`SELECT * FROM tickets`),
      db.execute(sql`SELECT * FROM settings`),
      db.execute(sql`SELECT * FROM payment_methods`),
      db.execute(sql`SELECT * FROM currencies`),
      db.execute(sql`SELECT * FROM domain_extensions`),
      db.execute(sql`SELECT * FROM domain_transfers`),
      db.execute(sql`SELECT * FROM credits`),
      db.execute(sql`SELECT * FROM affiliates`),
      db.execute(sql`SELECT * FROM promo_codes`),
      db.execute(sql`SELECT * FROM servers`),
      db.execute(sql`SELECT * FROM kb_articles`),
    ]);

    res.json({
      exportedAt: new Date().toISOString(),
      exportedBy: (req as any).user?.email ?? "admin",
      sourceIp: ip,
      tables: {
        users, hosting, domains, orders, invoices, tickets,
        settings, paymentMethods, currencies, domainExtensions,
        domainTransfers, credits, affiliates, promoCodes,
        servers, knowledgeBase,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
