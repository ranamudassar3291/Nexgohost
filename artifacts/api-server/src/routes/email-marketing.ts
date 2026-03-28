import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable, emailLogsTable, emailCampaignsTable,
  emailUnsubscribesTable, cartSessionsTable, promoCodesTable,
} from "@workspace/db/schema";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { eq, desc, and, ilike, or, inArray } from "drizzle-orm";
import { sendEmail } from "../lib/email.js";
import { getAppUrl } from "../lib/app-url.js";

const router = Router();

// ─── HTML layout helper (inline, not imported to avoid circular deps) ─────────
function layoutEmail(content: string, unsubscribeUrl?: string): string {
  const footer = unsubscribeUrl
    ? `<tr><td style="text-align:center;padding:12px 40px;font-size:12px;color:#999">
        <a href="${unsubscribeUrl}" style="color:#999;text-decoration:underline">Unsubscribe</a>
      </td></tr>`
    : "";
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f2;padding:36px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e5e5e5">
<tr><td style="background:#ffffff;padding:28px 40px 16px;text-align:center;border-bottom:3px solid #701AFE">
  <span style="font-size:26px;font-weight:800;color:#701AFE;letter-spacing:-0.5px">Noehost</span>
</td></tr>
<tr><td style="padding:32px 40px 28px;color:#333;font-size:15px;line-height:1.75">
  ${content}
</td></tr>
${footer}
<tr><td style="background:#f8f8f8;border-top:1px solid #e5e5e5;padding:16px 40px;text-align:center;font-size:12px;color:#999">
  &copy; ${new Date().getFullYear()} Noehost. All rights reserved.
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

// ─── Replace personalization tags in HTML ────────────────────────────────────
function personalizeHtml(html: string, vars: Record<string, string>): string {
  let out = html;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, v).replaceAll(`{{${k}}}`, v);
  }
  return out;
}

// ─── Public: Unsubscribe handler ─────────────────────────────────────────────
router.get("/unsubscribe", async (req, res) => {
  const token = req.query.token as string;
  if (!token) return res.status(400).send("<h2>Invalid unsubscribe link.</h2>");

  try {
    const [row] = await db.select().from(emailUnsubscribesTable).where(eq(emailUnsubscribesTable.token, token));
    if (row) {
      return res.send(`<html><body style="font-family:sans-serif;text-align:center;padding:60px">
        <h2 style="color:#701AFE">Already Unsubscribed</h2>
        <p>You are already unsubscribed from our marketing emails.</p>
      </body></html>`);
    }

    // Find user by token — stored in email_unsubscribes
    // The token IS the row key — just insert to record if not found above
    await db.insert(emailUnsubscribesTable).values({ token, email: token }).onConflictDoNothing();

    return res.send(`<html><body style="font-family:sans-serif;text-align:center;padding:60px">
      <h2 style="color:#701AFE">Unsubscribed Successfully</h2>
      <p>You've been removed from our marketing list. You will no longer receive promotional emails.</p>
      <p><a href="${getAppUrl()}" style="color:#701AFE">Return to Noehost</a></p>
    </body></html>`);
  } catch {
    return res.status(500).send("<h2>Something went wrong. Please try again.</h2>");
  }
});

// ─── Client: Track checkout session (cart abandonment) ───────────────────────
router.post("/client/cart-session", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { packageId, packageName, domainName, billingCycle } = req.body;

    // Upsert: if session exists for this user+package in last 24h that's not completed, update it
    const existing = await db.select().from(cartSessionsTable)
      .where(and(
        eq(cartSessionsTable.userId, userId),
        eq(cartSessionsTable.completed, false),
        eq(cartSessionsTable.reminderSent, false),
      ))
      .orderBy(desc(cartSessionsTable.createdAt))
      .limit(1);

    if (existing.length > 0) {
      await db.update(cartSessionsTable)
        .set({ packageId, packageName, domainName, billingCycle, abandonedAt: new Date() })
        .where(eq(cartSessionsTable.id, existing[0].id));
      return res.json({ ok: true, id: existing[0].id });
    }

    const [inserted] = await db.insert(cartSessionsTable).values({
      userId, packageId, packageName, domainName, billingCycle,
    }).returning();

    return res.json({ ok: true, id: inserted.id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Client: Mark cart session as completed ───────────────────────────────────
router.patch("/client/cart-session/:id/complete", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    await db.update(cartSessionsTable)
      .set({ completed: true, completedAt: new Date() })
      .where(and(eq(cartSessionsTable.id, req.params.id), eq(cartSessionsTable.userId, userId)));
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Admin: List all clients (for recipient selection) ────────────────────────
router.get("/admin/email-marketing/clients", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const search = req.query.search as string | undefined;
    let query = db.select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
    }).from(usersTable).where(eq(usersTable.role, "client"));

    const rows = await query.orderBy(usersTable.firstName).limit(500);

    const filtered = search
      ? rows.filter(r =>
          r.email.toLowerCase().includes(search.toLowerCase()) ||
          `${r.firstName} ${r.lastName}`.toLowerCase().includes(search.toLowerCase())
        )
      : rows;

    return res.json(filtered);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Admin: Get email logs ────────────────────────────────────────────────────
router.get("/admin/email-marketing/logs", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string || "1");
    const limit = parseInt(req.query.limit as string || "50");
    const offset = (page - 1) * limit;
    const emailType = req.query.emailType as string | undefined;

    let rows;
    if (emailType && emailType !== "all") {
      rows = await db.select().from(emailLogsTable)
        .where(eq(emailLogsTable.emailType, emailType))
        .orderBy(desc(emailLogsTable.sentAt))
        .limit(limit).offset(offset);
    } else {
      rows = await db.select().from(emailLogsTable)
        .orderBy(desc(emailLogsTable.sentAt))
        .limit(limit).offset(offset);
    }

    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Admin: List campaigns ────────────────────────────────────────────────────
router.get("/admin/email-marketing/campaigns", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const rows = await db.select().from(emailCampaignsTable)
      .orderBy(desc(emailCampaignsTable.createdAt))
      .limit(100);
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Admin: List cart abandonments ───────────────────────────────────────────
router.get("/admin/email-marketing/abandonments", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const sessions = await db.select({
      id: cartSessionsTable.id,
      userId: cartSessionsTable.userId,
      packageName: cartSessionsTable.packageName,
      domainName: cartSessionsTable.domainName,
      billingCycle: cartSessionsTable.billingCycle,
      completed: cartSessionsTable.completed,
      reminderSent: cartSessionsTable.reminderSent,
      promoCode: cartSessionsTable.promoCode,
      abandonedAt: cartSessionsTable.abandonedAt,
      reminderSentAt: cartSessionsTable.reminderSentAt,
      userEmail: usersTable.email,
      userName: usersTable.firstName,
    }).from(cartSessionsTable)
      .leftJoin(usersTable, eq(cartSessionsTable.userId, usersTable.id))
      .orderBy(desc(cartSessionsTable.abandonedAt))
      .limit(100);

    return res.json(sessions);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Admin: Preview template ──────────────────────────────────────────────────
router.post("/admin/email-marketing/preview", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { subject, htmlBody, recipientId } = req.body;

    let vars: Record<string, string> = {
      client_name: "John Doe",
      domain_name: "example.com",
      company_name: "Noehost",
      unsubscribe_url: `${getAppUrl()}/unsubscribe?token=preview-token`,
    };

    if (recipientId) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, recipientId));
      if (user) {
        vars.client_name = `${user.firstName} ${user.lastName}`.trim() || user.email;
      }
    }

    const html = personalizeHtml(layoutEmail(htmlBody, vars.unsubscribe_url), vars);
    return res.json({ subject, html });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Admin: Send campaign ─────────────────────────────────────────────────────
router.post("/admin/email-marketing/send", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, subject, htmlBody, recipientType, recipientIds } = req.body as {
      name: string;
      subject: string;
      htmlBody: string;
      recipientType: "all" | "selected";
      recipientIds?: string[];
    };

    if (!subject || !htmlBody) {
      return res.status(400).json({ error: "Subject and HTML body are required" });
    }

    // Fetch recipients
    let recipients: { id: string; email: string; firstName: string; lastName: string }[];
    if (recipientType === "all") {
      recipients = await db.select({
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
      }).from(usersTable)
        .where(and(eq(usersTable.role, "client"), eq(usersTable.status, "active")));
    } else {
      if (!recipientIds || recipientIds.length === 0) {
        return res.status(400).json({ error: "No recipients selected" });
      }
      recipients = await db.select({
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
      }).from(usersTable)
        .where(inArray(usersTable.id, recipientIds));
    }

    // Fetch unsubscribed emails to skip them
    const unsubRows = await db.select({ email: emailUnsubscribesTable.email }).from(emailUnsubscribesTable);
    const unsubEmails = new Set(unsubRows.map(r => r.email.toLowerCase()));

    // Create campaign record
    const [campaign] = await db.insert(emailCampaignsTable).values({
      name: name || subject,
      subject,
      htmlBody,
      recipientType,
      recipientIds: recipientIds || [],
      status: "sending",
      createdBy: req.user!.id,
    }).returning();

    // Send in background — return campaign ID immediately
    res.json({ ok: true, campaignId: campaign.id, totalRecipients: recipients.length });

    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      if (unsubEmails.has(recipient.email.toLowerCase())) continue;

      const clientName = `${recipient.firstName} ${recipient.lastName}`.trim() || recipient.email;
      const unsubToken = `${recipient.id}-unsub`;
      const unsubUrl = `${getAppUrl()}/unsubscribe?token=${unsubToken}`;

      const vars: Record<string, string> = {
        client_name: clientName,
        company_name: "Noehost",
        unsubscribe_url: unsubUrl,
      };

      // Pre-assign a logId so we can inject tracking pixel before sending
      const preLogId = crypto.randomUUID();
      const openPixelUrl = `${getAppUrl()}/api/t/open/${preLogId}`;
      const bodyWithTracking = htmlBody + `<img src="${openPixelUrl}" width="1" height="1" alt="" style="display:none" />`;

      const personalizedHtml = personalizeHtml(layoutEmail(bodyWithTracking, unsubUrl), vars);
      const personalizedSubject = personalizeHtml(subject, vars);

      const result = await sendEmail({
        to: recipient.email,
        subject: personalizedSubject,
        html: personalizedHtml,
        emailType: "campaign",
        clientId: recipient.id,
        referenceId: campaign.id,
        logId: preLogId,
      });

      if (result.sent) sent++; else failed++;

      // Store unsubscribe token
      await db.insert(emailUnsubscribesTable)
        .values({ email: unsubToken, userId: recipient.id, token: unsubToken })
        .onConflictDoNothing();
    }

    // Update campaign status
    await db.update(emailCampaignsTable)
      .set({ sentCount: sent, failedCount: failed, status: "sent", sentAt: new Date() })
      .where(eq(emailCampaignsTable.id, campaign.id));

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Tracking pixel — mark email as opened (public, no auth) ─────────────────
// Tiny 1×1 transparent GIF served when an email client renders the email.
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

router.get("/t/open/:logId", async (req, res) => {
  const { logId } = req.params;
  // Update log status to "opened" (non-blocking, best effort)
  db.update(emailLogsTable)
    .set({ status: "opened" })
    .where(and(eq(emailLogsTable.id, logId), eq(emailLogsTable.status, "success")))
    .catch(() => {});

  res.set({
    "Content-Type": "image/gif",
    "Content-Length": String(TRANSPARENT_GIF.length),
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  });
  return res.send(TRANSPARENT_GIF);
});

// ─── Click tracking redirect (public, no auth) ────────────────────────────────
// Wraps any outgoing link so we can mark the email as clicked before redirecting.
router.get("/t/click/:logId", async (req, res) => {
  const { logId } = req.params;
  const { url } = req.query;

  // Mark as clicked (best effort)
  db.update(emailLogsTable)
    .set({ status: "clicked" })
    .where(eq(emailLogsTable.id, logId))
    .catch(() => {});

  const target = typeof url === "string" && url ? url : getAppUrl();
  return res.redirect(302, target);
});

export default router;
