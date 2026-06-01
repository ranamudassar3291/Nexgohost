/**
 * Noehost Live Chat — Gemini 1.5 Flash powered support
 * Routes:
 *   POST /chat/session               — create or resume session
 *   POST /chat/message               — send message, get AI reply
 *   GET  /chat/session/:id/messages  — load full history
 *   POST /chat/handover/:id          — request human agent
 *   GET  /admin/live-chat/sessions   — list all sessions (admin)
 *   GET  /admin/live-chat/sessions/:id — full convo (admin)
 *   POST /admin/live-chat/sessions/:id/reply   — admin reply
 *   PUT  /admin/live-chat/sessions/:id/status  — change status
 */

import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { authenticate, requireAdmin, verifyToken, type AuthRequest } from "../lib/auth.js";
import { getClientIp } from "../lib/security.js";
import { sendWhatsAppAlert } from "../lib/whatsapp.js";

const router = Router();

const SYSTEM_INSTRUCTION = `You are NoeBot, the official premium AI Support Assistant for Noehost (noehost.com). Respond in a highly professional, polite, and helpful blend of Roman Urdu and English. Your focus is web hosting, premium Cloud VPS, domain registrations, and business email (NoeMail). Keep answers concise, accurate, and guide the user on how to navigate the platform or place an order if needed. If after 2 failed attempts you still cannot resolve the user's issue, politely suggest they click the "Talk to Human Agent" button. Never break character.`;

const FALLBACK = "Our agents are currently processing multiple requests. Please try sending your message again in a few moments.";

function getModel() {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  const genai = new GoogleGenerativeAI(apiKey);
  return genai.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: SYSTEM_INSTRUCTION,
  });
}

// ── DB helpers ────────────────────────────────────────────────────────────────
async function getOrCreateSession(sessionId: string, opts: {
  userId?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  source?: string;
}) {
  const [existing] = (await db.execute(sql`
    SELECT * FROM chat_sessions WHERE session_id = ${sessionId} LIMIT 1
  `)).rows as any[];
  if (existing) return existing;
  await db.execute(sql`
    INSERT INTO chat_sessions (session_id, user_id, client_name, client_email, client_phone, source, status, failed_attempts, created_at, updated_at)
    VALUES (
      ${sessionId},
      ${opts.userId ?? null},
      ${opts.clientName ?? "Guest"},
      ${opts.clientEmail ?? null},
      ${opts.clientPhone ?? null},
      ${opts.source ?? "website"},
      'ai',
      0,
      NOW(),
      NOW()
    )
    ON CONFLICT (session_id) DO NOTHING
  `);
  const [row] = (await db.execute(sql`
    SELECT * FROM chat_sessions WHERE session_id = ${sessionId} LIMIT 1
  `)).rows as any[];
  return row;
}

async function saveMessage(sessionId: string, role: string, content: string, meta?: Record<string, any>) {
  await db.execute(sql`
    INSERT INTO chat_messages (session_id, role, content, metadata_json, created_at)
    VALUES (${sessionId}, ${role}, ${content}, ${JSON.stringify(meta ?? {})}::jsonb, NOW())
  `);
  await db.execute(sql`
    UPDATE chat_sessions SET updated_at = NOW() WHERE session_id = ${sessionId}
  `);
}

async function getMessages(sessionId: string) {
  const result = await db.execute(sql`
    SELECT id, session_id, role, content, metadata_json, created_at
    FROM chat_messages
    WHERE session_id = ${sessionId}
    ORDER BY created_at ASC
  `);
  return result.rows as any[];
}

// ── POST /chat/session ────────────────────────────────────────────────────────
router.post("/chat/session", async (req: AuthRequest, res) => {
  try {
    const { sessionId, clientName, clientEmail, clientPhone, source } = req.body;
    if (!sessionId) { res.status(400).json({ error: "sessionId required" }); return; }

    let userId: string | undefined;
    // Try to parse JWT for optional auth (works for guests too)
    const authHeader = req.headers["authorization"] as string;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const payload = verifyToken(authHeader.replace("Bearer ", ""));
        if (payload?.userId) userId = String(payload.userId);
      } catch { /* guest — no token */ }
    }

    const session = await getOrCreateSession(sessionId, {
      userId,
      clientName: clientName || "Guest",
      clientEmail: clientEmail || null,
      clientPhone: clientPhone || null,
      source: source || "website",
    });

    const messages = await getMessages(sessionId);
    res.json({ session, messages });
  } catch (err) {
    console.error("[LIVE-CHAT] session error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── POST /chat/message ────────────────────────────────────────────────────────
router.post("/chat/message", async (req, res) => {
  try {
    const { sessionId, message, clientName, clientEmail, clientPhone } = req.body;
    if (!sessionId || !message?.trim()) {
      res.status(400).json({ error: "sessionId and message required" });
      return;
    }

    // Ensure session exists
    await getOrCreateSession(sessionId, {
      clientName: clientName || "Guest",
      clientEmail: clientEmail || null,
      clientPhone: clientPhone || null,
      source: "website",
    });

    // Check session status — if human/closed, don't run AI
    const [session] = (await db.execute(sql`
      SELECT status, failed_attempts FROM chat_sessions WHERE session_id = ${sessionId} LIMIT 1
    `)).rows as any[];

    if (session?.status === "closed") {
      res.status(400).json({ error: "Session is closed" }); return;
    }
    if (session?.status === "human") {
      // Save user message and let admin reply
      await saveMessage(sessionId, "user", message.trim());
      res.json({ reply: null, status: "human", awaitingAgent: true });
      return;
    }

    // Save user message
    await saveMessage(sessionId, "user", message.trim());

    // Build chat history for Gemini (last 20 exchanges)
    const history = await getMessages(sessionId);
    const trimmed = history.slice(0, -1).slice(-40); // exclude the message we just saved

    const geminiHistory = trimmed
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content as string }],
      }));

    let reply = FALLBACK;
    let failedAttempts = Number(session?.failed_attempts ?? 0);

    try {
      const model = getModel();
      const chat = model.startChat({ history: geminiHistory });
      const result = await chat.sendMessage(message.trim());
      reply = result.response.text() || FALLBACK;
      // Reset failed attempts on success
      await db.execute(sql`
        UPDATE chat_sessions SET failed_attempts = 0, updated_at = NOW()
        WHERE session_id = ${sessionId}
      `);
    } catch (geminiErr: any) {
      console.error("[LIVE-CHAT] Gemini error:", geminiErr?.message);
      failedAttempts += 1;
      await db.execute(sql`
        UPDATE chat_sessions SET failed_attempts = ${failedAttempts}, updated_at = NOW()
        WHERE session_id = ${sessionId}
      `);
    }

    // Save AI reply
    await saveMessage(sessionId, "assistant", reply);

    // Auto-trigger handover after 3 consecutive AI failures
    let newStatus = session?.status ?? "ai";
    if (failedAttempts >= 3) {
      newStatus = "handover";
      await db.execute(sql`
        UPDATE chat_sessions SET status = 'handover', updated_at = NOW()
        WHERE session_id = ${sessionId}
      `);
      // WhatsApp alert to admin
      const sName = clientName || clientEmail || sessionId;
      sendWhatsAppAlert("handover_request",
        `🚨 *Live Chat Handover — Noehost*\n\n` +
        `Client: ${sName}\n` +
        `Session: ${sessionId}\n` +
        `Reason: AI failed 3 consecutive attempts\n\n` +
        `Please open Admin → Support → Live Support`
      ).catch(() => {});
    }

    res.json({ reply, status: newStatus, failedAttempts });
  } catch (err) {
    console.error("[LIVE-CHAT] message error:", err);
    res.json({ reply: FALLBACK, status: "ai", failedAttempts: 0 });
  }
});

// ── GET /chat/session/:id/messages ────────────────────────────────────────────
router.get("/chat/session/:id/messages", async (req, res) => {
  try {
    const { id } = req.params;
    const messages = await getMessages(id);
    const [session] = (await db.execute(sql`
      SELECT * FROM chat_sessions WHERE session_id = ${id} LIMIT 1
    `)).rows as any[];
    res.json({ messages, session });
  } catch (err) {
    console.error("[LIVE-CHAT] load history error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── POST /chat/handover/:id ───────────────────────────────────────────────────
router.post("/chat/handover/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { clientName, clientEmail } = req.body;
    await db.execute(sql`
      UPDATE chat_sessions SET status = 'handover', updated_at = NOW()
      WHERE session_id = ${id}
    `);
    await saveMessage(id, "assistant",
      "Your request has been received. A support agent will join shortly. Please hold on..."
    );
    const name = clientName || clientEmail || id;
    sendWhatsAppAlert("handover_request",
      `👤 *Human Agent Requested — Noehost*\n\n` +
      `Client: ${name}\n` +
      `Email: ${clientEmail ?? "N/A"}\n` +
      `Session: ${id}\n\n` +
      `Admin → Support → Live Support`
    ).catch(() => {});
    res.json({ success: true, status: "handover" });
  } catch (err) {
    console.error("[LIVE-CHAT] handover error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /admin/live-chat/sessions ─────────────────────────────────────────────
router.get("/admin/live-chat/sessions", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const statusFilter = req.query.status ? String(req.query.status) : null;
    const searchStr    = req.query.search  ? `%${String(req.query.search)}%` : null;

    let rows: any[];
    if (statusFilter && searchStr) {
      rows = (await db.execute(sql`
        SELECT s.*,
          (SELECT content FROM chat_messages WHERE session_id = s.session_id ORDER BY created_at DESC LIMIT 1) AS last_message,
          (SELECT COUNT(*) FROM chat_messages WHERE session_id = s.session_id) AS message_count
        FROM chat_sessions s
        WHERE s.status = ${statusFilter}
          AND (s.client_name ILIKE ${searchStr} OR s.client_email ILIKE ${searchStr})
        ORDER BY s.updated_at DESC LIMIT 100
      `)).rows as any[];
    } else if (statusFilter) {
      rows = (await db.execute(sql`
        SELECT s.*,
          (SELECT content FROM chat_messages WHERE session_id = s.session_id ORDER BY created_at DESC LIMIT 1) AS last_message,
          (SELECT COUNT(*) FROM chat_messages WHERE session_id = s.session_id) AS message_count
        FROM chat_sessions s
        WHERE s.status = ${statusFilter}
        ORDER BY s.updated_at DESC LIMIT 100
      `)).rows as any[];
    } else if (searchStr) {
      rows = (await db.execute(sql`
        SELECT s.*,
          (SELECT content FROM chat_messages WHERE session_id = s.session_id ORDER BY created_at DESC LIMIT 1) AS last_message,
          (SELECT COUNT(*) FROM chat_messages WHERE session_id = s.session_id) AS message_count
        FROM chat_sessions s
        WHERE s.client_name ILIKE ${searchStr} OR s.client_email ILIKE ${searchStr}
        ORDER BY s.updated_at DESC LIMIT 100
      `)).rows as any[];
    } else {
      rows = (await db.execute(sql`
        SELECT s.*,
          (SELECT content FROM chat_messages WHERE session_id = s.session_id ORDER BY created_at DESC LIMIT 1) AS last_message,
          (SELECT COUNT(*) FROM chat_messages WHERE session_id = s.session_id) AS message_count
        FROM chat_sessions s
        ORDER BY s.updated_at DESC LIMIT 100
      `)).rows as any[];
    }
    const sessions = rows;

    const open     = sessions.filter((s: any) => s.status === "ai" || s.status === "handover").length;
    const handover = sessions.filter((s: any) => s.status === "handover").length;
    const human    = sessions.filter((s: any) => s.status === "human").length;

    res.json({ sessions, stats: { open, handover, human, total: sessions.length } });
  } catch (err) {
    console.error("[LIVE-CHAT] admin sessions error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /admin/live-chat/sessions/:id ─────────────────────────────────────────
router.get("/admin/live-chat/sessions/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const sid = String(req.params["id"]);
    const [session] = (await db.execute(sql`
      SELECT * FROM chat_sessions WHERE session_id = ${sid} LIMIT 1
    `)).rows as any[];
    if (!session) { res.status(404).json({ error: "Not found" }); return; }
    const messages = await getMessages(sid);
    res.json({ session, messages });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ── POST /admin/live-chat/sessions/:id/reply ──────────────────────────────────
router.post("/admin/live-chat/sessions/:id/reply", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const sid = String(req.params["id"]);
    const { message } = req.body;
    if (!message?.trim()) { res.status(400).json({ error: "Message required" }); return; }
    await saveMessage(sid, "admin", message.trim());
    // Promote to human status if not already
    await db.execute(sql`
      UPDATE chat_sessions
      SET status = CASE WHEN status IN ('handover','ai') THEN 'human' ELSE status END, updated_at = NOW()
      WHERE session_id = ${sid}
    `);
    const [session] = (await db.execute(sql`
      SELECT status FROM chat_sessions WHERE session_id = ${sid} LIMIT 1
    `)).rows as any[];
    res.json({ success: true, status: session?.status });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ── PUT /admin/live-chat/sessions/:id/status ──────────────────────────────────
router.put("/admin/live-chat/sessions/:id/status", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const sid = String(req.params["id"]);
    const { status } = req.body;
    const allowed = ["ai", "handover", "human", "closed"];
    if (!allowed.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }
    await db.execute(sql`
      UPDATE chat_sessions SET status = ${status}, updated_at = NOW()
      WHERE session_id = ${sid}
    `);
    if (status === "closed") {
      await saveMessage(sid, "assistant",
        "This chat session has been closed. Thank you for contacting Noehost support! 👋"
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
