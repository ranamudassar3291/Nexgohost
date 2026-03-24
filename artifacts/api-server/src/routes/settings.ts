import { Router } from "express";
import nodemailer from "nodemailer";
import { db } from "@workspace/db";
import { settingsTable, emailLogsTable } from "@workspace/db/schema";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { desc } from "drizzle-orm";

const router = Router();

// GET /api/settings/wallet — public endpoint: wallet deposit limits
router.get("/settings/wallet", async (_req, res) => {
  try {
    const rows = await db.select().from(settingsTable);
    const map: Record<string, string | null> = {};
    for (const r of rows) map[r.key] = r.value;
    res.json({
      wallet_min_deposit: Number(map["wallet_min_deposit"] ?? "270"),
      wallet_max_deposit: Number(map["wallet_max_deposit"] ?? "100000"),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load wallet settings" });
  }
});

// GET /api/admin/settings — return all email config (password masked)
router.get("/admin/settings", authenticate, requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(settingsTable);
    const map: Record<string, string | null> = {};
    for (const r of rows) map[r.key] = r.value;
    res.json({
      mailer_type:     map["mailer_type"]     ?? "smtp",
      smtp_host:       map["smtp_host"]        ?? "",
      smtp_port:       map["smtp_port"]        ?? "587",
      smtp_user:       map["smtp_user"]        ?? "",
      smtp_pass:       map["smtp_pass"]        ? "••••••••" : "",
      smtp_from:       map["smtp_from"]        ?? "",
      smtp_from_name:  map["smtp_from_name"]   ?? "",
      smtp_encryption: map["smtp_encryption"]  ?? "tls",
      smtp_configured: !!(map["smtp_host"] && map["smtp_user"]),
      google_client_id:       map["google_client_id"]       ?? "",
      google_client_secret:   map["google_client_secret"]   ? "••••••••" : "",
      google_allowed_domains: map["google_allowed_domains"]  ?? "",
      google_configured:      !!(map["google_client_id"] && map["google_client_secret"]),
      email_verification_enabled: map["email_verification_enabled"] === undefined ? true : map["email_verification_enabled"] === "true",
      wallet_min_deposit: Number(map["wallet_min_deposit"] ?? "270"),
      wallet_max_deposit: Number(map["wallet_max_deposit"] ?? "100000"),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load settings" });
  }
});

// PUT /api/admin/settings — upsert email config
router.put("/admin/settings", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const {
      mailer_type, smtp_host, smtp_port, smtp_user, smtp_pass,
      smtp_from, smtp_from_name, smtp_encryption,
      google_client_id, google_client_secret, google_allowed_domains,
      email_verification_enabled,
      wallet_min_deposit, wallet_max_deposit,
    } = req.body;

    const pairs: { key: string; value: string }[] = [];
    if (mailer_type !== undefined)     pairs.push({ key: "mailer_type",     value: mailer_type });
    if (smtp_host !== undefined)       pairs.push({ key: "smtp_host",       value: smtp_host });
    if (smtp_port !== undefined)       pairs.push({ key: "smtp_port",       value: String(smtp_port) });
    if (smtp_user !== undefined)       pairs.push({ key: "smtp_user",       value: smtp_user });
    if (smtp_from !== undefined)       pairs.push({ key: "smtp_from",       value: smtp_from });
    if (smtp_from_name !== undefined)  pairs.push({ key: "smtp_from_name",  value: smtp_from_name });
    if (smtp_encryption !== undefined) pairs.push({ key: "smtp_encryption", value: smtp_encryption });
    if (smtp_pass !== undefined && smtp_pass !== "••••••••" && smtp_pass !== "") {
      pairs.push({ key: "smtp_pass", value: smtp_pass });
    }
    if (google_client_id !== undefined) pairs.push({ key: "google_client_id", value: google_client_id });
    if (google_client_secret !== undefined && google_client_secret !== "••••••••" && google_client_secret !== "") {
      pairs.push({ key: "google_client_secret", value: google_client_secret });
    }
    if (google_allowed_domains !== undefined) pairs.push({ key: "google_allowed_domains", value: google_allowed_domains });
    if (email_verification_enabled !== undefined) pairs.push({ key: "email_verification_enabled", value: String(email_verification_enabled) });
    if (wallet_min_deposit !== undefined) pairs.push({ key: "wallet_min_deposit", value: String(Number(wallet_min_deposit)) });
    if (wallet_max_deposit !== undefined) pairs.push({ key: "wallet_max_deposit", value: String(Number(wallet_max_deposit)) });

    for (const pair of pairs) {
      await db
        .insert(settingsTable)
        .values({ key: pair.key, value: pair.value })
        .onConflictDoUpdate({ target: settingsTable.key, set: { value: pair.value, updatedAt: new Date() } });
    }

    const { clearSmtpCache } = await import("../lib/email.js");
    clearSmtpCache();

    res.json({ success: true, message: "Email settings saved" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save settings" });
  }
});

// POST /api/admin/settings/smtp/verify — test SMTP connection (no email sent)
router.post("/admin/settings/smtp/verify", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const rows = await db.select().from(settingsTable);
    const map: Record<string, string> = {};
    for (const r of rows) if (r.key && r.value) map[r.key] = r.value;

    const host       = req.body.smtp_host       || map["smtp_host"]       || "";
    const port       = Number(req.body.smtp_port || map["smtp_port"]       || 587);
    const user       = req.body.smtp_user       || map["smtp_user"]       || "";
    const pass       = (req.body.smtp_pass && req.body.smtp_pass !== "••••••••")
                       ? req.body.smtp_pass
                       : (map["smtp_pass"] || "");
    const encryption = req.body.smtp_encryption || map["smtp_encryption"] || "tls";

    if (!host || !user) {
      res.status(400).json({ success: false, message: "SMTP host and username are required" });
      return;
    }

    const transportOpts: any = {
      host, port,
      auth: { user, pass },
      connectionTimeout: 10_000,
      greetingTimeout:   10_000,
    };
    if (encryption === "ssl")      { transportOpts.secure = true; }
    else if (encryption === "tls") { transportOpts.secure = false; transportOpts.requireTLS = true; }
    else                           { transportOpts.secure = false; }

    const transporter = nodemailer.createTransport(transportOpts);
    await transporter.verify();

    res.json({ success: true, message: `SMTP connected successfully to ${host}:${port}` });
  } catch (err: any) {
    const msg = err.message || String(err);
    res.status(400).json({ success: false, message: `SMTP connection failed: ${msg}` });
  }
});

// POST /api/admin/settings/smtp/test — send a test email (accepts custom recipient)
router.post("/admin/settings/smtp/test", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { clearSmtpCache, sendEmail } = await import("../lib/email.js");
    clearSmtpCache();

    const to = req.body.to || (req as any).user?.email || "admin@noehost.com";
    const result = await sendEmail({
      to,
      subject: "Test Email from Billing System",
      html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;background:#0f0a1f;color:#e2e0f0;border-radius:16px">
        <h2 style="color:#a855f7;margin:0 0 12px">Test Email — Noehost</h2>
        <p style="color:#b0a0d0;margin:0 0 16px">Hello,</p>
        <p style="color:#b0a0d0;margin:0 0 16px">This is a test email to verify your SMTP configuration.</p>
        <p style="color:#b0a0d0;margin:0 0 16px">If you received this email, your email system is working correctly.</p>
        <hr style="border:none;border-top:1px solid #2d1f5a;margin:20px 0" />
        <p style="color:#6b5a8a;font-size:13px;margin:0">Sent at ${new Date().toUTCString()} · Noehost Billing System</p>
      </div>`,
      emailType: "test",
    });
    if (result.sent) {
      res.json({ success: true, message: `Test email sent to ${to}` });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/email-logs — paginated email send history
router.get("/admin/email-logs", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const limit  = Math.min(Number(req.query.limit  || 50), 200);
    const offset = Number(req.query.offset || 0);
    const logs = await db.select().from(emailLogsTable)
      .orderBy(desc(emailLogsTable.sentAt))
      .limit(limit)
      .offset(offset);
    res.json(logs.map(l => ({
      id:           l.id,
      recipient:    l.email,
      emailType:    l.emailType,
      subject:      l.subject ?? "",
      status:       l.status,
      errorMessage: l.errorMessage ?? null,
      sentAt:       l.sentAt.toISOString(),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load email logs" });
  }
});

export default router;
