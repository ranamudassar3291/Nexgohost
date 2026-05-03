import { Router } from "express";
import { db } from "@workspace/db";
import {
  securityLogsTable, blockedIpsTable,
  ipWhitelistTable, migrationWhitelistTable,
  hostingServicesTable, invoicesTable, usersTable, activityLogsTable,
} from "@workspace/db/schema";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { emitActivity } from "../lib/activity.js";
import { and, desc, eq, gt, gte, sql } from "drizzle-orm";
import {
  getSecurityConfig, setSecuritySetting, verifyCaptcha, getClientIp,
  isIpInMigrationWhitelist,
  type SecurityConfig,
} from "../lib/security.js";

const router = Router();

// ══════════════════════════════════════════════════════════════════════════════
// CLIENT — Security & Performance Analytics
// ══════════════════════════════════════════════════════════════════════════════

// ── GET /api/my/security/health-score ─────────────────────────────────────────
router.get("/my/security/health-score", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const clientIp = getClientIp(req);

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const services = await db.select().from(hostingServicesTable).where(eq(hostingServicesTable.userId, userId));
    const unpaidInvoices = await db.select().from(invoicesTable)
      .where(and(eq(invoicesTable.clientId, userId), eq(invoicesTable.status, "unpaid")));
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentFailed = await db.select().from(activityLogsTable)
      .where(and(
        eq(activityLogsTable.userId, userId),
        eq(activityLogsTable.status, "failed"),
        gte(activityLogsTable.createdAt, sevenDaysAgo),
      ));

    const activeServices = services.filter(s => s.status === "active");
    const sslActive = activeServices.some(s => s.sslStatus === "installed" || s.sslStatus === "active");
    const allAutoRenew = activeServices.length === 0 || activeServices.every(s => s.autoRenew !== false);
    const noUnpaid = unpaidInvoices.length === 0;
    const twoFA = user?.twoFactorEnabled ?? false;
    const noFailedLogins = recentFailed.length === 0;

    const breakdown = [
      { key: "2fa",        label: "Two-Factor Authentication", passed: twoFA,          points: twoFA ? 25 : 0,          maxPoints: 25, description: twoFA ? "Account protected with 2FA" : "Enable 2FA to secure your account" },
      { key: "ssl",        label: "SSL Certificate Active",    passed: sslActive,      points: sslActive ? 20 : 0,      maxPoints: 20, description: sslActive ? "HTTPS enabled on your site" : "No active SSL certificate found" },
      { key: "invoices",   label: "No Unpaid Invoices",        passed: noUnpaid,       points: noUnpaid ? 25 : 0,       maxPoints: 25, description: noUnpaid ? "All invoices are settled" : `${unpaidInvoices.length} unpaid invoice(s) pending` },
      { key: "autorenew",  label: "Auto-Renew Enabled",        passed: allAutoRenew,   points: allAutoRenew ? 15 : 0,   maxPoints: 15, description: allAutoRenew ? "Services will auto-renew" : "Some services have auto-renew off" },
      { key: "logins",     label: "No Recent Failed Logins",   passed: noFailedLogins, points: noFailedLogins ? 15 : 0, maxPoints: 15, description: noFailedLogins ? "No suspicious login attempts" : `${recentFailed.length} failed login(s) in 7 days` },
    ];

    const score = breakdown.reduce((sum, b) => sum + b.points, 0);

    const [blockedRow] = await db.select().from(blockedIpsTable)
      .where(and(eq(blockedIpsTable.ipAddress, clientIp), gt(blockedIpsTable.blockedUntil, new Date())))
      .limit(1);

    res.json({ score, breakdown, detectedIp: clientIp, isBlocked: !!blockedRow });
  } catch (err: any) {
    console.error("[health-score]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/my/security/visitor-stats ────────────────────────────────────────
router.get("/my/security/visitor-stats", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    // Deterministic seeded random from userId for consistent numbers per account
    const seed = userId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const rng = (s: number) => {
      let x = Math.sin(s + seed) * 10000;
      return x - Math.floor(x);
    };

    const days: { date: string; visitors: number; pageViews: number }[] = [];
    const now = new Date();
    let totalVisitors = 0;
    let totalPageViews = 0;
    let peakVisitors = 0;
    let peakDate = "";

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dow = d.getDay(); // 0=Sun, 6=Sat
      const weekendFactor = (dow === 0 || dow === 6) ? 0.65 : 1;
      const base = 80 + Math.floor(rng(i * 3 + 1) * 220);
      const visitors = Math.round(base * weekendFactor);
      const pageViews = Math.round(visitors * (2.2 + rng(i * 3 + 2) * 1.8));
      days.push({ date: dateStr, visitors, pageViews });
      totalVisitors += visitors;
      totalPageViews += pageViews;
      if (visitors > peakVisitors) { peakVisitors = visitors; peakDate = dateStr; }
    }

    res.json({
      days,
      summary: {
        totalVisitors,
        totalPageViews,
        avgDailyVisitors: Math.round(totalVisitors / 30),
        peakVisitors,
        peakDate,
        bounceRate: Math.round(38 + rng(999) * 22),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/my/security/unblock-ip ──────────────────────────────────────────
router.post("/my/security/unblock-ip", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const clientIp = getClientIp(req);

    await db.delete(blockedIpsTable).where(eq(blockedIpsTable.ipAddress, clientIp)).catch(() => {});

    const adminEmail = req.user!.email ?? `user-${userId}`;
    await db.insert(ipWhitelistTable)
      .values({ ipAddress: clientIp, label: `Self-unblock by ${adminEmail}`, addedBy: adminEmail })
      .onConflictDoUpdate({
        target: ipWhitelistTable.ipAddress,
        set: { label: `Self-unblock by ${adminEmail}`, addedBy: adminEmail },
      });

    // Audit log — full record in ip_unblock_logs for technical team
    await db.execute(sql`
      INSERT INTO ip_unblock_logs (id, user_id, ip_address, label, status, created_at)
      VALUES (
        ${`ulg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`},
        ${userId},
        ${clientIp},
        ${'Self-requested unblock via client dashboard'},
        ${'success'},
        NOW()
      )
    `).catch(() => {});

    // Emit to Command Center activity stream
    const [userData] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1).catch(() => [null]);
    emitActivity({
      userId,
      userEmail: userData?.email ?? req.user!.email ?? "",
      userName: userData ? `${userData.firstName} ${userData.lastName}`.trim() : "",
      action: `Used IP Unblocker — unblocked ${clientIp}`,
      meta: { type: "ip_unblock", ip: clientIp },
    });

    res.json({ success: true, ip: clientIp, message: `IP ${clientIp} has been unblocked and whitelisted.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/my/security/unblock-logs ─────────────────────────────────────────
router.get("/my/security/unblock-logs", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const rows = await db.execute(sql`
      SELECT id, ip_address, label, status, created_at
      FROM ip_unblock_logs
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 20
    `);
    res.json(rows.rows ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

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

// ── POST /admin/ip-unblocker/whitelist ────────────────────────────────────────
// Proxy-calls an external API endpoint to whitelist one or more IPs.
// Accepts: { endpoint, apiKey, ips: string[] }
// Returns: { results: { ip, success, message }[] }
router.post("/admin/ip-unblocker/whitelist", authenticate, requireAdmin, async (req, res) => {
  try {
    const { endpoint, apiKey, ips } = req.body;
    if (!endpoint || !apiKey || !Array.isArray(ips) || ips.length === 0) {
      res.status(400).json({ error: "endpoint, apiKey, and ips[] are required" });
      return;
    }

    const ipv4Re = /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)(\/\d{1,2})?$/;
    const results: { ip: string; success: boolean; message: string }[] = [];

    for (const rawIp of ips as string[]) {
      const ip = rawIp.trim();
      if (!ip) continue;
      if (!ipv4Re.test(ip)) {
        results.push({ ip, success: false, message: "Invalid IP format" });
        continue;
      }
      try {
        const r = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "X-Api-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ip }),
          signal: AbortSignal.timeout(15_000),
        });
        const text = await r.text().catch(() => "");
        let message = r.ok ? "Whitelisted successfully" : `HTTP ${r.status}`;
        try {
          const json = text ? JSON.parse(text) : null;
          if (json?.message) message = json.message;
          else if (json?.error) message = json.error;
        } catch { if (text) message = text.slice(0, 150); }
        results.push({ ip, success: r.ok, message });
      } catch (e: any) {
        results.push({ ip, success: false, message: e.message ?? "Request failed" });
      }
    }

    res.json({ results });
  } catch (err: any) {
    console.error("[IP Unblocker]", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
