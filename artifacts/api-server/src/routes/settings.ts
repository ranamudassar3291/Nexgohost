import { Router } from "express";
import nodemailer from "nodemailer";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { db } from "@workspace/db";
import { settingsTable, emailLogsTable } from "@workspace/db/schema";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { desc, eq } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const BRANDING_DIR = path.join(__dirname, "../../../nexgohost/public/uploads/branding");
fs.mkdirSync(BRANDING_DIR, { recursive: true });

const brandingStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, BRANDING_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    const name = file.fieldname === "favicon" ? `favicon${ext}` : `logo${ext}`;
    cb(null, name);
  },
});

const brandingUpload = multer({
  storage: brandingStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/svg+xml", "image/webp", "image/x-icon", "image/vnd.microsoft.icon"];
    cb(null, allowed.includes(file.mimetype));
  },
});

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
      connectionTimeout: 15_000,
      greetingTimeout:   15_000,
      tls: { rejectUnauthorized: false },
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

// GET /api/test-mail?to=you@gmail.com — quick smoke test (admin JWT or system key)
router.get("/test-mail", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { clearSmtpCache, sendEmail } = await import("../lib/email.js");
    clearSmtpCache();

    const to = (req.query.to as string) || req.user?.email || "";
    if (!to) {
      res.status(400).json({ success: false, message: "Provide ?to=your@email.com in the query string" });
      return;
    }

    console.log(`[TEST-MAIL] Sending test email to ${to}…`);
    const result = await sendEmail({
      to,
      subject: "✅ Noehost SMTP Test — Connection Working",
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:40px 16px;background:#f3f0ff;font-family:Inter,Arial,sans-serif">
  <div style="max-width:480px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(103,58,183,.12);border:1px solid #ede9fe">
    <div style="background:linear-gradient(135deg,#673ab7 0%,#9c27b0 100%);padding:32px;text-align:center">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:900;letter-spacing:-0.5px">Noehost</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,.75);font-size:13px">SMTP Connection Test</p>
    </div>
    <div style="padding:32px">
      <p style="font-size:16px;font-weight:700;color:#1a1a2e;margin:0 0 12px">✅ Your SMTP is working!</p>
      <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 20px">
        This test email confirms that your SMTP configuration is correct and emails will be delivered to your clients successfully.
      </p>
      <div style="background:#f3f0ff;border-radius:10px;padding:16px;font-size:12px;color:#673ab7;font-family:monospace">
        Sent: ${new Date().toUTCString()}<br/>
        To: ${to}
      </div>
    </div>
    <div style="background:#f9f7ff;padding:16px 32px;text-align:center;border-top:1px solid #ede9fe">
      <p style="margin:0;font-size:12px;color:#9ca3af">© ${new Date().getFullYear()} Noehost · All rights reserved</p>
    </div>
  </div>
</body></html>`,
      emailType: "test",
    });

    if (result.sent) {
      console.log(`[TEST-MAIL] ✅ Success — delivered to ${to}`);
      res.json({ success: true, message: `Test email delivered to ${to}` });
    } else {
      console.error(`[TEST-MAIL] ❌ Failed: ${result.message}`);
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (err: any) {
    console.error("[TEST-MAIL] Exception:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/branding/upload — upload logo or favicon (admin only)
router.post(
  "/admin/branding/upload",
  authenticate, requireAdmin,
  brandingUpload.fields([{ name: "logo", maxCount: 1 }, { name: "favicon", maxCount: 1 }]),
  async (req: AuthRequest, res) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const saved: string[] = [];

      if (files?.["logo"]?.[0]) {
        const f = files["logo"][0];
        const urlPath = `/uploads/branding/${f.filename}`;
        await db.insert(settingsTable).values({ key: "branding_logo", value: urlPath })
          .onConflictDoUpdate({ target: settingsTable.key, set: { value: urlPath, updatedAt: new Date() } });
        saved.push("logo");
      }

      if (files?.["favicon"]?.[0]) {
        const f = files["favicon"][0];
        const urlPath = `/uploads/branding/${f.filename}`;
        await db.insert(settingsTable).values({ key: "branding_favicon", value: urlPath })
          .onConflictDoUpdate({ target: settingsTable.key, set: { value: urlPath, updatedAt: new Date() } });
        saved.push("favicon");
      }

      if (saved.length === 0) {
        res.status(400).json({ error: "No valid file uploaded (logo or favicon field required)" });
        return;
      }

      const { clearBrandingCache } = await import("../lib/email.js");
      clearBrandingCache();
      res.json({ success: true, saved });
    } catch (err: any) {
      console.error("[BRANDING] Upload error:", err);
      res.status(500).json({ error: err.message || "Upload failed" });
    }
  }
);

// DELETE /api/admin/branding/:type — remove logo or favicon (admin only)
router.delete("/admin/branding/:type", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  const { type } = req.params;
  if (type !== "logo" && type !== "favicon") {
    res.status(400).json({ error: "Type must be 'logo' or 'favicon'" });
    return;
  }
  try {
    const key = type === "logo" ? "branding_logo" : "branding_favicon";
    const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
    if (row?.value) {
      const filePath = path.join(BRANDING_DIR, path.basename(row.value));
      try { fs.unlinkSync(filePath); } catch { /* file may already be gone */ }
    }
    await db.delete(settingsTable).where(eq(settingsTable.key, key));
    const { clearBrandingCache } = await import("../lib/email.js");
    clearBrandingCache();
    res.json({ success: true });
  } catch (err: any) {
    console.error("[BRANDING] Remove error:", err);
    res.status(500).json({ error: err.message || "Remove failed" });
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

// ─── Extended Branding Settings ──────────────────────────────────────────────

const EXTENDED_BRANDING_KEYS = [
  "site_name", "site_tagline",
  "brand_primary_color", "brand_website", "brand_whatsapp",
  "brand_address", "brand_support_email",
  "brand_social_twitter", "brand_social_facebook", "brand_social_linkedin",
  "invoice_footer_text", "email_footer_text",
];

// GET /api/admin/branding/settings
router.get("/admin/branding/settings", authenticate, requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(settingsTable);
    const map: Record<string, string> = {};
    for (const r of rows) if (r.key) map[r.key] = r.value ?? "";
    res.json({
      site_name:            map["site_name"]            ?? "Noehost",
      site_tagline:         map["site_tagline"]          ?? "Professional Hosting Solutions",
      brand_primary_color:  map["brand_primary_color"]   ?? "#701AFE",
      brand_website:        map["brand_website"]          ?? "",
      brand_whatsapp:       map["brand_whatsapp"]         ?? "",
      brand_address:        map["brand_address"]          ?? "",
      brand_support_email:  map["brand_support_email"]    ?? "",
      brand_social_twitter: map["brand_social_twitter"]   ?? "",
      brand_social_facebook:map["brand_social_facebook"]  ?? "",
      brand_social_linkedin:map["brand_social_linkedin"]  ?? "",
      invoice_footer_text:  map["invoice_footer_text"]    ?? "",
      email_footer_text:    map["email_footer_text"]      ?? "",
      logoUrl:     map["branding_logo"]    ? `/uploads/branding/${path.basename(map["branding_logo"])}` : null,
      faviconUrl:  map["branding_favicon"] ? `/uploads/branding/${path.basename(map["branding_favicon"])}` : null,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// PUT /api/admin/branding/settings
router.put("/admin/branding/settings", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const updates = req.body as Record<string, string>;
    for (const key of EXTENDED_BRANDING_KEYS) {
      if (updates[key] !== undefined) {
        await db.insert(settingsTable).values({ key, value: String(updates[key]) })
          .onConflictDoUpdate({ target: settingsTable.key, set: { value: String(updates[key]), updatedAt: new Date() } });
      }
    }
    const { clearBrandingCache } = await import("../lib/email.js");
    clearBrandingCache();
    res.json({ success: true, message: "Branding settings saved" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
