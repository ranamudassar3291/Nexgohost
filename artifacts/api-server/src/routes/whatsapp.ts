/**
 * Noehost WhatsApp Alert System — Admin Routes
 * Includes: admin session mgmt + client order/renewal notification endpoints
 */
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { whatsappLogsTable, settingsTable, usersTable, hostingServicesTable, invoicesTable } from "@workspace/db/schema";
import { eq, desc, sql, and, lt, gte } from "drizzle-orm";
import { authenticate, requireAdmin } from "../lib/auth.js";
import {
  getWaState,
  connectWhatsApp,
  disconnectWhatsApp,
  sendWhatsAppAlert,
  sendToClientPhone,
  getAdminPhone,
  setAdminPhone,
} from "../lib/whatsapp.js";

const router = Router();

// ─── Admin session management ─────────────────────────────────────────────────

router.get("/admin/whatsapp/status", authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const state = getWaState();
    const adminPhone = await getAdminPhone();
    res.json({ status: state.status, qrDataUrl: state.qrDataUrl, connectedAt: state.connectedAt, phone: state.phone, error: state.error, adminPhone });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/admin/whatsapp/connect", authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const state = getWaState();
    if (state.status === "connected") { res.json({ success: true, message: "Already connected" }); return; }
    connectWhatsApp().catch(console.error);
    res.json({ success: true, message: "Connecting… scan the QR code in a few seconds" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/admin/whatsapp/disconnect", authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    await disconnectWhatsApp();
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/admin/whatsapp/phone", authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const phone = await getAdminPhone();
    res.json({ phone });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put("/admin/whatsapp/phone", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { phone } = req.body as { phone: string };
    if (!phone) { res.status(400).json({ error: "Phone required" }); return; }
    await setAdminPhone(phone.replace(/\D/g, ""));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/admin/whatsapp/test", authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const ok = await sendWhatsAppAlert("test",
      `✅ *Noehost Test Alert*\n\nThis is a test message from your Noehost admin panel.\n\nIf you received this, your WhatsApp notifications are working perfectly! 🎉\n\n_Sent: ${new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}_`);
    if (ok) res.json({ success: true, message: "Test message sent!" });
    else res.json({ success: false, message: "WhatsApp not connected or admin phone not set" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/admin/whatsapp/logs", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) ?? "20"), 50);
    const logs = await db.select().from(whatsappLogsTable).orderBy(desc(whatsappLogsTable.sentAt)).limit(limit);
    res.json(logs);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Helper: log to whatsapp_client_notifications ────────────────────────────
async function logClientNotif(userId: string, phone: string, eventType: string, message: string, status: string, error?: string) {
  await db.execute(sql`
    INSERT INTO whatsapp_client_notifications (user_id, phone, event_type, message, status, error, sent_at)
    VALUES (${userId}, ${phone}, ${eventType}, ${message}, ${status}, ${error ?? null}, NOW())
  `).catch(() => {});
}

// ─── GET /admin/whatsapp/clients — list all clients with phone numbers ────────
router.get("/admin/whatsapp/clients", authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const clients = await db.select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
      phone: usersTable.phone,
    }).from(usersTable).where(eq(usersTable.role, "client")).orderBy(usersTable.firstName);
    res.json(clients);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── POST /admin/whatsapp/send-order-status — send order update to client ────
router.post("/admin/whatsapp/send-order-status", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { clientId, orderId, status, domain, planName, customMessage } = req.body as {
      clientId: string; orderId?: string; status: string; domain?: string; planName?: string; customMessage?: string;
    };

    if (!clientId || !status) {
      res.status(400).json({ error: "clientId and status required" }); return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, clientId)).limit(1);
    if (!user) { res.status(404).json({ error: "Client not found" }); return; }
    if (!user.phone) { res.status(400).json({ error: "Client has no phone number on file" }); return; }

    const statusEmoji: Record<string, string> = {
      active: "✅", pending: "⏳", suspended: "⚠️", cancelled: "❌", "in-progress": "🔄", completed: "🎉",
    };

    const msg = customMessage ?? [
      `${statusEmoji[status] ?? "📦"} *Order Status Update — Noehost*`,
      ``,
      `Dear ${user.firstName},`,
      ``,
      domain   ? `🌐 Domain: ${domain}`   : "",
      planName ? `📦 Plan: ${planName}`   : "",
      orderId  ? `🆔 Order: #${orderId}`  : "",
      `📊 Status: *${status.toUpperCase()}*`,
      ``,
      `If you have any questions, reply to this message or open a support ticket at noehost.com`,
      ``,
      `_Noehost Team — ${new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}_`,
    ].filter(s => s !== undefined).join("\n");

    const ok = await sendToClientPhone(user.phone, msg, "order_status");
    await logClientNotif(clientId, user.phone, "order_status", msg, ok ? "sent" : "failed", ok ? undefined : "WhatsApp not connected");

    res.json({ success: ok, message: ok ? "Order status sent to client WhatsApp" : "WhatsApp not connected — notification logged" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /admin/whatsapp/send-renewal-alert — send renewal reminder ─────────
router.post("/admin/whatsapp/send-renewal-alert", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { clientId, domain, renewalDate, amount, currency, invoiceId } = req.body as {
      clientId: string; domain?: string; renewalDate: string; amount?: number; currency?: string; invoiceId?: string;
    };

    if (!clientId || !renewalDate) {
      res.status(400).json({ error: "clientId and renewalDate required" }); return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, clientId)).limit(1);
    if (!user) { res.status(404).json({ error: "Client not found" }); return; }
    if (!user.phone) { res.status(400).json({ error: "Client has no phone number on file" }); return; }

    const daysLeft = Math.ceil((new Date(renewalDate).getTime() - Date.now()) / 86400000);
    const urgency = daysLeft <= 3 ? "🔴 *URGENT*" : daysLeft <= 7 ? "🟡 *Reminder*" : "🟢 *Upcoming*";

    const msg = [
      `🔔 *Renewal Alert — Noehost*`,
      ``,
      `Dear ${user.firstName},`,
      ``,
      `${urgency}: Your service renews in *${daysLeft} day${daysLeft !== 1 ? "s" : ""}*.`,
      ``,
      domain     ? `🌐 Domain/Service: ${domain}`      : "",
      `📅 Renewal Date: ${new Date(renewalDate).toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" })}`,
      amount     ? `💰 Amount Due: ${currency ?? "PKR"} ${Number(amount).toLocaleString()}` : "",
      invoiceId  ? `🧾 Invoice: #${invoiceId}` : "",
      ``,
      `To renew, log in to your client portal at noehost.com or reply to this message.`,
      ``,
      `_Noehost Billing — ${new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}_`,
    ].filter(s => s !== undefined).join("\n");

    const ok = await sendToClientPhone(user.phone, msg, "renewal_alert");
    await logClientNotif(clientId, user.phone, "renewal_alert", msg, ok ? "sent" : "failed", ok ? undefined : "WhatsApp not connected");

    res.json({ success: ok, message: ok ? "Renewal alert sent to client WhatsApp" : "WhatsApp not connected — notification logged" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /admin/whatsapp/bulk-renewal-alerts — send alerts for all clients
//     with invoices due within N days ─────────────────────────────────────────
router.post("/admin/whatsapp/bulk-renewal-alerts", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { daysAhead = 7 } = req.body as { daysAhead?: number };
    const cutoff = new Date(Date.now() + daysAhead * 86400000);
    const now    = new Date();

    // Find open invoices due within daysAhead days
    const dueInvoices = await db.select({
      invoiceId:  invoicesTable.id,
      clientId:   invoicesTable.clientId,
      total:      invoicesTable.total,
      currency:   invoicesTable.currency,
      dueDate:    invoicesTable.dueDate,
    }).from(invoicesTable)
      .where(and(
        eq(invoicesTable.status, "unpaid"),
        gte(invoicesTable.dueDate, now),
        lt(invoicesTable.dueDate, cutoff),
      ))
      .limit(50);

    let sent = 0; let failed = 0; const skipped: string[] = [];

    for (const inv of dueInvoices) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, inv.clientId)).limit(1);
      if (!user?.phone) { skipped.push(inv.clientId); continue; }

      const daysLeft = Math.ceil((new Date(inv.dueDate!).getTime() - Date.now()) / 86400000);
      const msg = [
        `🔔 *Renewal Alert — Noehost*`,
        ``,
        `Dear ${user.firstName},`,
        ``,
        `Your invoice is due in *${daysLeft} day${daysLeft !== 1 ? "s" : ""}*.`,
        ``,
        `📅 Due Date: ${new Date(inv.dueDate!).toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" })}`,
        inv.total ? `💰 Amount: ${inv.currency ?? "PKR"} ${Number(inv.total).toLocaleString()}` : "",
        `🧾 Invoice: #${inv.invoiceId}`,
        ``,
        `Pay now at noehost.com to avoid service interruption.`,
        ``,
        `_Noehost Billing — ${new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}_`,
      ].filter(s => s !== undefined).join("\n");

      const ok = await sendToClientPhone(user.phone, msg, "renewal_alert");
      await logClientNotif(inv.clientId, user.phone, "renewal_alert", msg, ok ? "sent" : "failed");
      if (ok) sent++; else failed++;
    }

    res.json({ success: true, sent, failed, skipped: skipped.length, total: dueInvoices.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /admin/whatsapp/client-notifications — log of all client-targeted alerts
router.get("/admin/whatsapp/client-notifications", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) ?? "30"), 100);
    const rows = await db.execute(sql`
      SELECT wcn.id, wcn.user_id, wcn.phone, wcn.event_type, wcn.message, wcn.status, wcn.error, wcn.sent_at,
             u.first_name, u.last_name, u.email
      FROM whatsapp_client_notifications wcn
      LEFT JOIN users u ON u.id = wcn.user_id
      ORDER BY wcn.sent_at DESC LIMIT ${limit}
    `);
    res.json(rows.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /admin/whatsapp/send-custom — custom message to any client ─────────
router.post("/admin/whatsapp/send-custom", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { clientId, message } = req.body as { clientId: string; message: string };
    if (!clientId || !message) { res.status(400).json({ error: "clientId and message required" }); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, clientId)).limit(1);
    if (!user) { res.status(404).json({ error: "Client not found" }); return; }
    if (!user.phone) { res.status(400).json({ error: "Client has no phone number on file" }); return; }

    const ok = await sendToClientPhone(user.phone, message, "custom_message");
    await logClientNotif(clientId, user.phone, "custom_message", message, ok ? "sent" : "failed");

    res.json({ success: ok, message: ok ? "Message sent" : "WhatsApp not connected — logged only" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
