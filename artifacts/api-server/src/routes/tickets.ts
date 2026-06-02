import { Router } from "express";
import { db } from "@workspace/db";
import { ticketsTable, ticketMessagesTable, usersTable } from "@workspace/db/schema";
import { sendWhatsAppAlert } from "../lib/whatsapp.js";
import { generateAiSupportReply } from "../lib/ai-support.js";
import { eq, sql } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { getSecurityConfig, verifyCaptcha } from "../lib/security.js";
import { createNotification } from "../lib/notifications.js";
import { emitActivity } from "../lib/activity.js";

const router = Router();

let ticketCounter = 1000;

function formatTicket(t: typeof ticketsTable.$inferSelect, clientName?: string) {
  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    clientId: t.clientId,
    clientName: clientName || "",
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    department: t.department,
    lastReply: t.lastReply?.toISOString(),
    messagesCount: t.messagesCount,
    createdAt: t.createdAt.toISOString(),
  };
}

function formatMessage(m: typeof ticketMessagesTable.$inferSelect) {
  return {
    id: m.id,
    ticketId: m.ticketId,
    senderId: m.senderId,
    senderName: m.senderName,
    senderRole: m.senderRole,
    message: m.message,
    attachments: m.attachments || [],
    createdAt: m.createdAt.toISOString(),
  };
}

// Client: get my tickets
router.get("/tickets", authenticate, async (req: AuthRequest, res) => {
  try {
    const isAdmin = req.user!.role === "admin";
    let tickets;
    if (isAdmin) {
      tickets = await db.select().from(ticketsTable).orderBy(sql`created_at DESC`);
    } else {
      tickets = await db.select().from(ticketsTable).where(eq(ticketsTable.clientId, req.user!.userId)).orderBy(sql`created_at DESC`);
    }

    const result = await Promise.all(tickets.map(async (t) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, t.clientId)).limit(1);
      return formatTicket(t, user ? `${user.firstName} ${user.lastName}` : "");
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Client: create ticket
router.post("/tickets", authenticate, async (req: AuthRequest, res) => {
  try {
    const { subject, message, priority, department, captchaToken } = req.body;

    // Captcha verification (if enabled for support tickets)
    const secConfig = await getSecurityConfig();
    if (secConfig.enabledPages.supportTicket && secConfig.secretKey) {
      if (!captchaToken) {
        res.status(400).json({ error: "Security check required. Please complete the captcha." });
        return;
      }
      const captchaOk = await verifyCaptcha(captchaToken, secConfig.secretKey, secConfig.provider);
      if (!captchaOk) {
        res.status(400).json({ error: "Security check failed. Please try again." });
        return;
      }
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    ticketCounter++;
    const ticketNumber = `TKT-${Date.now()}`;

    const [ticket] = await db.insert(ticketsTable).values({
      ticketNumber,
      clientId: req.user!.userId,
      subject,
      status: "open",
      priority: priority || "medium",
      department: department || "General",
      messagesCount: 1,
      lastReply: new Date(),
    }).returning();

    await db.insert(ticketMessagesTable).values({
      ticketId: ticket.id,
      senderId: req.user!.userId,
      senderName: `${user.firstName} ${user.lastName}`,
      senderRole: "client",
      message,
      attachments: [],
    });

    res.status(201).json(formatTicket(ticket, `${user.firstName} ${user.lastName}`));

    // Emit to Command Center activity stream (non-blocking)
    emitActivity({
      userId: req.user!.userId,
      userEmail: user.email ?? "",
      userName: `${user.firstName} ${user.lastName}`.trim(),
      action: `Submitted support ticket — "${subject.slice(0, 70)}${subject.length > 70 ? "…" : ""}"`,
      meta: { type: "ticket_create", ticketId: ticket.id, department: department || "General", priority: priority || "medium" },
    });

    // AI auto-reply (non-blocking — runs after response is sent)
    generateAiSupportReply(subject, message, department || "General").then(async (aiReply) => {
      if (!aiReply) return;
      try {
        await db.insert(ticketMessagesTable).values({
          ticketId: ticket.id,
          senderId: "ai-support",
          senderName: "AI Support",
          senderRole: "admin",
          message: aiReply,
          attachments: [],
        });
        await db.update(ticketsTable)
          .set({ messagesCount: 2, lastReply: new Date(), status: "answered", updatedAt: new Date() })
          .where(eq(ticketsTable.id, ticket.id));
        await createNotification({
          userId: req.user!.userId,
          type: "ticket",
          title: "Support Reply",
          message: `Your ticket "${subject}" has received an initial response.`,
        });
        console.log(`[AI SUPPORT] Auto-reply posted to ticket ${ticket.ticketNumber}`);
      } catch (e) { console.error("[AI SUPPORT] Failed to save auto-reply:", e); }
    }).catch(() => {});

    // WhatsApp alert (non-blocking)
    const adminUrl = process.env.ADMIN_PANEL_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "noehost.com"}`;
    sendWhatsAppAlert("new_ticket",
      `🎫 *New Support Ticket — Noehost*\n\n` +
      `👤 Client: ${user.firstName} ${user.lastName}\n` +
      `📧 Email: ${user.email}\n` +
      `🏷️ Subject: ${subject}\n` +
      `⚡ Priority: ${(priority || "medium").toUpperCase()}\n` +
      `🏢 Dept: ${department || "General"}\n` +
      `🎫 Ticket: *${ticket.ticketNumber}*\n\n` +
      `🔗 View: ${adminUrl}/admin/tickets/${ticket.id}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `💬 *Quick Reply via Noe AI:*\n` +
      `_reply ticket ${ticket.ticketNumber} [your message]_\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `_${new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}_`
    ).catch(() => {});

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get ticket detail
router.get("/tickets/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, req.params.id)).limit(1);
    if (!ticket) { res.status(404).json({ error: "Not found" }); return; }

    // Non-admin can only see their own tickets
    if (req.user!.role !== "admin" && ticket.clientId !== req.user!.userId) {
      res.status(403).json({ error: "Forbidden" }); return;
    }

    const messages = await db.select().from(ticketMessagesTable).where(eq(ticketMessagesTable.ticketId, ticket.id)).orderBy(sql`created_at ASC`);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, ticket.clientId)).limit(1);

    res.json({
      ...formatTicket(ticket, user ? `${user.firstName} ${user.lastName}` : ""),
      messages: messages.map(formatMessage),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Reply to ticket
router.post("/tickets/:id/reply", authenticate, async (req: AuthRequest, res) => {
  try {
    const { message } = req.body;
    const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, req.params.id)).limit(1);
    if (!ticket) { res.status(404).json({ error: "Not found" }); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const [msg] = await db.insert(ticketMessagesTable).values({
      ticketId: ticket.id,
      senderId: req.user!.userId,
      senderName: `${user.firstName} ${user.lastName}`,
      senderRole: user.role,
      message,
      attachments: [],
    }).returning();

    const newStatus = user.role === "admin" ? "answered" : "pending";
    await db.update(ticketsTable)
      .set({ status: newStatus, lastReply: new Date(), messagesCount: (ticket.messagesCount || 0) + 1, updatedAt: new Date() })
      .where(eq(ticketsTable.id, ticket.id));

    // Notify the other party about the reply
    if (user.role === "admin") {
      // Admin replied — notify client
      createNotification(ticket.clientId, "ticket", "Support Reply", `Admin replied to your ticket: "${ticket.subject}"`, `/dashboard/tickets/${ticket.id}`).catch(() => {});
    }

    res.status(201).json(formatMessage(msg));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: get all tickets
router.get("/admin/tickets", authenticate, requireAdmin, async (_req, res) => {
  try {
    const tickets = await db.select().from(ticketsTable).orderBy(sql`created_at DESC`);
    const result = await Promise.all(tickets.map(async (t) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, t.clientId)).limit(1);
      return formatTicket(t, user ? `${user.firstName} ${user.lastName}` : "");
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: close ticket
router.post("/admin/tickets/:id/close", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [updated] = await db.update(ticketsTable)
      .set({ status: "closed", updatedAt: new Date() })
      .where(eq(ticketsTable.id, req.params.id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated.clientId)).limit(1);
    res.json(formatTicket(updated, user ? `${user.firstName} ${user.lastName}` : ""));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Client: submit panel feedback (rating + optional comment)
// ── GET /api/tickets/draft — load saved draft for this user ──────────────────
router.get("/tickets/draft", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const rows = await db.execute(sql`
      SELECT subject, message, department, priority, updated_at
      FROM ticket_drafts
      WHERE user_id = ${userId}
      LIMIT 1
    `);
    const draft = rows.rows?.[0] ?? null;
    res.json(draft ?? { subject: "", message: "", department: "Technical Support", priority: "medium" });
  } catch (err: any) {
    res.json({ subject: "", message: "", department: "Technical Support", priority: "medium" });
  }
});

// ── PUT /api/tickets/draft — auto-save draft for this user ───────────────────
router.put("/tickets/draft", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { subject = "", message = "", department = "Technical Support", priority = "medium" } = req.body;
    await db.execute(sql`
      INSERT INTO ticket_drafts (id, user_id, subject, message, department, priority, updated_at)
      VALUES (
        ${'dft-' + userId.slice(0, 8)},
        ${userId}, ${subject}, ${message}, ${department}, ${priority}, NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        subject = EXCLUDED.subject,
        message = EXCLUDED.message,
        department = EXCLUDED.department,
        priority = EXCLUDED.priority,
        updated_at = NOW()
    `);
    res.json({ saved: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/tickets/draft — clear draft after ticket submitted ────────────
router.delete("/tickets/draft", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    await db.execute(sql`DELETE FROM ticket_drafts WHERE user_id = ${userId}`);
    res.json({ cleared: true });
  } catch {
    res.json({ cleared: true });
  }
});

router.post("/client/feedback", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { rating, message } = req.body;
    if (!rating || rating < 1 || rating > 5) { res.status(400).json({ error: "Rating must be 1–5" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const name = user ? `${user.firstName} ${user.lastName}` : userId;
    const stars = "★".repeat(Number(rating)) + "☆".repeat(5 - Number(rating));
    const wa = `⭐ *Client Feedback*\n👤 *${name}*\n${stars} (${rating}/5)${message ? `\n💬 "${message}"` : ""}`;
    await sendWhatsAppAlert("other", wa, "admin");
    console.log(`[FEEDBACK] ${name} rated ${rating}/5${message ? `: "${message}"` : ""}`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[FEEDBACK]", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
