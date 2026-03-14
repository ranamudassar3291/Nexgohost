import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";
import { authenticate, requireAdmin } from "../lib/auth.js";
import { eq } from "drizzle-orm";

const router = Router();

const SMTP_KEYS = ["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_from"];

// GET /api/admin/settings — return SMTP config (password masked)
router.get("/admin/settings", authenticate, requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(settingsTable);
    const map: Record<string, string | null> = {};
    for (const r of rows) map[r.key] = r.value;
    res.json({
      smtp_host: map["smtp_host"] ?? "",
      smtp_port: map["smtp_port"] ?? "587",
      smtp_user: map["smtp_user"] ?? "",
      smtp_pass: map["smtp_pass"] ? "••••••••" : "",
      smtp_from: map["smtp_from"] ?? "",
      smtp_configured: !!(map["smtp_host"] && map["smtp_user"]),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load settings" });
  }
});

// PUT /api/admin/settings — upsert SMTP config
router.put("/admin/settings", authenticate, requireAdmin, async (req, res) => {
  try {
    const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from } = req.body;
    const pairs: { key: string; value: string }[] = [];

    if (smtp_host !== undefined) pairs.push({ key: "smtp_host", value: smtp_host });
    if (smtp_port !== undefined) pairs.push({ key: "smtp_port", value: String(smtp_port) });
    if (smtp_user !== undefined) pairs.push({ key: "smtp_user", value: smtp_user });
    // Only overwrite password if a real value was provided (not the masked placeholder)
    if (smtp_pass !== undefined && smtp_pass !== "••••••••" && smtp_pass !== "") {
      pairs.push({ key: "smtp_pass", value: smtp_pass });
    }
    if (smtp_from !== undefined) pairs.push({ key: "smtp_from", value: smtp_from });

    for (const pair of pairs) {
      await db
        .insert(settingsTable)
        .values({ key: pair.key, value: pair.value })
        .onConflictDoUpdate({ target: settingsTable.key, set: { value: pair.value, updatedAt: new Date() } });
      // Also apply to process.env immediately so next email send picks it up
      const envKey = pair.key.toUpperCase().replace("_", "_");
      process.env[pair.key === "smtp_host" ? "SMTP_HOST"
        : pair.key === "smtp_port" ? "SMTP_PORT"
        : pair.key === "smtp_user" ? "SMTP_USER"
        : pair.key === "smtp_pass" ? "SMTP_PASS"
        : "SMTP_FROM"] = pair.value;
    }

    res.json({ success: true, message: "SMTP settings saved" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save settings" });
  }
});

// POST /api/admin/settings/smtp/test — send a test email
router.post("/admin/settings/smtp/test", authenticate, requireAdmin, async (req, res) => {
  try {
    const { sendEmail } = await import("../lib/email.js");
    const adminEmail = (req as any).user?.email || "admin@nexgohost.com";
    const result = await sendEmail({
      to: adminEmail,
      subject: "Nexgohost — SMTP Test Email",
      html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#0f0a1f;color:#fff;border-radius:12px">
        <h2 style="color:#a855f7">SMTP Test Successful</h2>
        <p style="color:#ccc">Your SMTP configuration is working correctly.</p>
        <p style="color:#999;font-size:13px">Sent at ${new Date().toISOString()} · Nexgohost</p>
      </div>`,
    });
    if (result.sent) {
      res.json({ success: true, message: `Test email sent to ${adminEmail}` });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
