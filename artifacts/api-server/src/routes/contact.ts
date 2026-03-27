import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";

const router = Router();

// ─── POST /api/contact — public contact form submission ────────────────────────
router.post("/contact", async (req: Request, res: Response) => {
  const { name, email, subject, message } = req.body ?? {};

  if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
    res.status(400).json({ error: "All fields are required." });
    return;
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Invalid email address." });
    return;
  }

  try {
    // Load SMTP settings from DB
    const [smtpRow] = await db.select().from(settingsTable)
      .where(eq(settingsTable.key, "smtp")).limit(1);

    const smtp = smtpRow ? JSON.parse(smtpRow.value ?? "{}") : {};
    const adminEmail = smtp.fromEmail || smtp.username || "admin@noehost.com";

    if (smtp.host && smtp.username && smtp.password) {
      const transporter = nodemailer.createTransport({
        host:   smtp.host,
        port:   Number(smtp.port ?? 587),
        secure: String(smtp.port) === "465",
        auth: { user: smtp.username, pass: smtp.password },
        tls: { rejectUnauthorized: false },
      });

      await transporter.sendMail({
        from:    `"${smtp.fromName ?? "Noehost"}" <${smtp.fromEmail ?? smtp.username}>`,
        to:      adminEmail,
        replyTo: `"${name}" <${email}>`,
        subject: `[Contact Form] ${subject}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <h2 style="color:#701AFE;margin-bottom:16px">New Contact Form Submission</h2>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 0;font-weight:bold;color:#374151;width:100px">Name:</td><td style="padding:8px 0;color:#6b7280">${name}</td></tr>
              <tr><td style="padding:8px 0;font-weight:bold;color:#374151">Email:</td><td style="padding:8px 0;color:#6b7280"><a href="mailto:${email}">${email}</a></td></tr>
              <tr><td style="padding:8px 0;font-weight:bold;color:#374151">Subject:</td><td style="padding:8px 0;color:#6b7280">${subject}</td></tr>
            </table>
            <div style="margin-top:16px;padding:16px;background:#f9fafb;border-radius:8px;border-left:3px solid #701AFE">
              <p style="margin:0;white-space:pre-wrap;color:#374151">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
            </div>
            <p style="margin-top:16px;font-size:12px;color:#9ca3af">
              Submitted via noehost.com contact form. Reply directly to this email to respond to the visitor.
            </p>
          </div>
        `,
      });

      console.log(`[CONTACT] Form submitted by ${name} <${email}> — "${subject}"`);
      res.json({ success: true });
    } else {
      // SMTP not configured — log it and return success anyway (form still "works")
      console.log(`[CONTACT] No SMTP configured. Form from: ${name} <${email}> | Subject: "${subject}" | Msg: ${message.substring(0, 100)}`);
      res.json({ success: true });
    }
  } catch (err: any) {
    console.error("[CONTACT] Failed to process form:", err.message);
    res.status(500).json({ error: "Failed to send message. Please email us directly at support@noehost.com" });
  }
});

export default router;
