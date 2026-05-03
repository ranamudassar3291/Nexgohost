/**
 * Autonomous Support Agent — Noe AI
 *
 * Public / Client:
 *   POST /ai/support/session              — create or resume a session
 *   POST /ai/support/message              — send message, get AI reply
 *   GET  /ai/support/session/:id/messages — load chat history
 *   POST /ai/support/handover/:id         — request human agent
 *   POST /ai/support/attachment/:id       — attach file (URL + metadata)
 *
 * Admin:
 *   GET  /admin/ai/support/sessions           — list all sessions
 *   GET  /admin/ai/support/sessions/:id       — full conversation
 *   POST /admin/ai/support/sessions/:id/reply — admin sends message
 *   PUT  /admin/ai/support/sessions/:id/status — take over / close
 *   GET  /admin/ai/support/knowledge           — list training docs
 *   POST /admin/ai/support/knowledge           — add training doc
 *   DELETE /admin/ai/support/knowledge/:id     — remove training doc
 */

import { Router } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import {
  usersTable,
  hostingServicesTable,
  hostingPlansTable,
  kbArticlesTable,
} from "@workspace/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { authenticate, requireRole, type AuthRequest } from "../lib/auth.js";
import { sendWhatsAppAlert } from "../lib/whatsapp.js";

const router = Router();

// ─── OpenAI ──────────────────────────────────────────────────────────────────
function getAI(): OpenAI | null {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) return null;
  return new OpenAI({ baseURL, apiKey });
}

// ─── DB helpers (raw SQL — no Drizzle schema needed for new tables) ──────────
async function createSession(data: {
  sessionId: string;
  userId: string | null;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  serviceId?: string;
  subject?: string;
  source: "website" | "dashboard";
}) {
  await db.execute(sql`
    INSERT INTO chat_sessions
      (session_id, user_id, client_name, client_email, client_phone,
       service_id, subject, source, status, failed_attempts, created_at, updated_at)
    VALUES
      (${data.sessionId}, ${data.userId}, ${data.clientName}, ${data.clientEmail},
       ${data.clientPhone ?? null}, ${data.serviceId ?? null}, ${data.subject ?? null},
       ${data.source}, 'ai', 0, NOW(), NOW())
    ON CONFLICT (session_id) DO NOTHING
  `);
}

async function getSession(sessionId: string) {
  const rows = await db.execute(sql`
    SELECT * FROM chat_sessions WHERE session_id = ${sessionId} LIMIT 1
  `);
  return (rows.rows[0] as any) ?? null;
}

async function saveMessage(data: {
  sessionId: string;
  role: "user" | "assistant" | "admin";
  content: string;
  metadata?: Record<string, any>;
}) {
  await db.execute(sql`
    INSERT INTO chat_messages (session_id, role, content, metadata_json, created_at)
    VALUES (${data.sessionId}, ${data.role}, ${data.content},
            ${JSON.stringify(data.metadata ?? {})}, NOW())
  `);
  await db.execute(sql`
    UPDATE chat_sessions SET updated_at = NOW() WHERE session_id = ${data.sessionId}
  `);
}

async function getMessages(sessionId: string, limit = 60) {
  const rows = await db.execute(sql`
    SELECT id, role, content, metadata_json, created_at
    FROM chat_messages
    WHERE session_id = ${sessionId}
    ORDER BY created_at ASC
    LIMIT ${limit}
  `);
  return rows.rows as any[];
}

async function bumpFailedAttempts(sessionId: string): Promise<number> {
  const rows = await db.execute(sql`
    UPDATE chat_sessions
    SET failed_attempts = failed_attempts + 1, updated_at = NOW()
    WHERE session_id = ${sessionId}
    RETURNING failed_attempts
  `);
  return (rows.rows[0] as any)?.failed_attempts ?? 1;
}

async function setSessionStatus(sessionId: string, status: string) {
  await db.execute(sql`
    UPDATE chat_sessions SET status = ${status}, updated_at = NOW()
    WHERE session_id = ${sessionId}
  `);
}

// ─── Knowledge Context Builder ────────────────────────────────────────────────
async function buildKnowledgeContext(): Promise<string> {
  const parts: string[] = [];

  try {
    // Hosting packages / plans
    const plans = await db.select({
      name: hostingPlansTable.name,
      price: hostingPlansTable.price,
      billingCycle: hostingPlansTable.billingCycle,
      description: hostingPlansTable.description,
    }).from(hostingPlansTable).limit(20).catch(() => []);

    if (plans.length) {
      parts.push("=== Noehost Hosting Plans ===");
      for (const p of plans) {
        parts.push(`• ${p.name}: $${p.price}/${p.billingCycle ?? "mo"} — ${p.description ?? ""}`);
      }
    }
  } catch { /* non-fatal */ }

  try {
    // KB articles for AI training
    const articles = await db.select({
      title: kbArticlesTable.title,
      content: kbArticlesTable.content,
    }).from(kbArticlesTable)
      .where(eq(kbArticlesTable.isPublished, true))
      .orderBy(desc(kbArticlesTable.views))
      .limit(15).catch(() => []);

    if (articles.length) {
      parts.push("\n=== Knowledge Base Articles ===");
      for (const a of articles) {
        const snippet = (a.content ?? "").replace(/<[^>]+>/g, "").slice(0, 300);
        if (snippet) parts.push(`• ${a.title}: ${snippet}`);
      }
    }
  } catch { /* non-fatal */ }

  try {
    // Custom AI training docs
    const docs = await db.execute(sql`
      SELECT title, content FROM ai_training_docs WHERE is_active = true ORDER BY created_at DESC LIMIT 20
    `).catch(() => ({ rows: [] }));

    if ((docs.rows as any[]).length) {
      parts.push("\n=== Admin-Uploaded Training Docs ===");
      for (const d of docs.rows as any[]) {
        parts.push(`• ${d.title}: ${(d.content ?? "").slice(0, 400)}`);
      }
    }
  } catch { /* non-fatal */ }

  try {
    // Site pages content (About, Services, Pricing, etc.)
    const pages = await db.execute(sql`
      SELECT page_id, section_name, content_json
      FROM site_pages WHERE is_visible = true LIMIT 30
    `).catch(() => ({ rows: [] }));

    if ((pages.rows as any[]).length) {
      parts.push("\n=== Website Content ===");
      for (const p of pages.rows as any[]) {
        try {
          const parsed = typeof p.content_json === "string"
            ? JSON.parse(p.content_json) : p.content_json;
          const text = Object.values(parsed ?? {}).join(" ").slice(0, 200);
          if (text.trim()) parts.push(`• [${p.page_id}/${p.section_name}]: ${text}`);
        } catch { /* skip */ }
      }
    }
  } catch { /* non-fatal */ }

  return parts.join("\n");
}

// ─── Client service context ───────────────────────────────────────────────────
async function buildClientContext(userId: string): Promise<string> {
  try {
    const [user] = await db.select({
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
    }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);

    const services = await db.select({
      domain: hostingServicesTable.domain,
      planName: hostingServicesTable.planName,
      status: hostingServicesTable.status,
      diskUsed: hostingServicesTable.diskUsed,
      bandwidthUsed: hostingServicesTable.bandwidthUsed,
      sslStatus: hostingServicesTable.sslStatus,
      wpInstalled: hostingServicesTable.wpInstalled,
    }).from(hostingServicesTable)
      .where(eq(hostingServicesTable.clientId, userId))
      .limit(5);

    const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Client";

    const lines = [
      `=== Client Profile ===`,
      `Name: ${name}`,
      `Email: ${user?.email ?? "unknown"}`,
    ];

    if (services.length) {
      lines.push(`\n=== Their Hosting Services ===`);
      for (const s of services) {
        lines.push(`• ${s.domain ?? "?"} (${s.planName ?? "?"}) — Status: ${s.status}, Disk: ${s.diskUsed ?? "?"}, SSL: ${s.sslStatus ?? "?"}, WP: ${s.wpInstalled ? "yes" : "no"}`);
      }
    }

    return lines.join("\n");
  } catch { return ""; }
}

// ─── System prompt builder ────────────────────────────────────────────────────
function buildSystemPrompt(knowledgeCtx: string, clientCtx: string): string {
  return `You are Noe, an advanced AI Support Agent for Noehost — a professional web hosting and domain management company. You are proactive, knowledgeable, and resolve client issues efficiently.

Your capabilities:
- Answer questions about Noehost plans, pricing, features, and policies
- Help with cPanel, WordPress, DNS, SSL, domain, and email configuration
- Guide clients through billing, invoices, and payment procedures
- Provide personalized support using the client's actual service data
- Detect billing, technical, or account issues and suggest the right actions

Tone: Warm, concise, professional. Reply in 3–5 sentences max unless a step-by-step guide is needed.

Instructions:
1. ALWAYS reference the client's actual service data when available (domain, plan, status, disk usage)
2. For technical issues you cannot resolve, use [ACTION: create_ticket] to auto-escalate
3. For billing questions, direct to billing@noehost.com or [ACTION: create_ticket]
4. Never invent information. If unsure, say so and offer to escalate
5. Sign off as "Noe · Noehost AI"

${clientCtx ? `\n${clientCtx}\n` : ""}
${knowledgeCtx ? `\n${knowledgeCtx}\n` : ""}`;
}

// ─── POST /ai/support/session — Create or resume a session ───────────────────
router.post("/ai/support/session", async (req: AuthRequest, res) => {
  try {
    // Try to auth the user optionally
    const token = req.headers.authorization?.replace("Bearer ", "");
    let userId: string | null = null;
    let clientName = req.body.clientName ?? "Guest";
    let clientEmail = req.body.clientEmail ?? "";
    let clientPhone = req.body.clientPhone ?? null;

    if (token) {
      try {
        const { verifyToken } = await import("../lib/auth.js");
        const decoded = verifyToken(token);
        if (decoded?.userId) {
          userId = decoded.userId;
          const [user] = await db.select({
            firstName: usersTable.firstName,
            lastName: usersTable.lastName,
            email: usersTable.email,
            phone: usersTable.phone,
          }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
          if (user) {
            clientName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || clientName;
            clientEmail = user.email ?? clientEmail;
            clientPhone = user.phone ?? clientPhone;
          }
        }
      } catch { /* anonymous */ }
    }

    const { sessionId, serviceId, subject, source = "website" } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId required" });
    }

    // If session already exists, return it
    const existing = await getSession(sessionId);
    if (existing) {
      return res.json({ sessionId, status: existing.status, existing: true });
    }

    await createSession({
      sessionId,
      userId,
      clientName,
      clientEmail,
      clientPhone,
      serviceId,
      subject,
      source,
    });

    res.json({ sessionId, status: "ai", existing: false });
  } catch (err: any) {
    console.error("[AI SUPPORT SESSION]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /ai/support/message — Send a message, get AI reply ─────────────────
router.post("/ai/support/message", async (req: AuthRequest, res) => {
  try {
    const { sessionId, message, serviceId } = req.body as {
      sessionId: string;
      message: string;
      serviceId?: string;
    };

    if (!sessionId || !message?.trim()) {
      return res.status(400).json({ error: "sessionId and message required" });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found. Create a session first." });
    }

    // Save user message
    await saveMessage({ sessionId, role: "user", content: message.trim() });

    // If session is taken over by admin, just return pending status
    if (session.status === "human") {
      return res.json({
        reply: "✅ A human agent is reviewing your case. Please wait — they will reply shortly.",
        status: "human",
        handedOver: true,
      });
    }

    // Build contexts
    const [knowledgeCtx, clientCtx] = await Promise.all([
      buildKnowledgeContext(),
      session.user_id ? buildClientContext(session.user_id) : Promise.resolve(""),
    ]);

    // Load recent messages for context
    const history = await getMessages(sessionId, 20);
    const aiMessages = history
      .filter(m => m.role === "user" || m.role === "assistant")
      .slice(-16)
      .map(m => ({ role: m.role === "admin" ? "assistant" : m.role, content: m.content })) as { role: "user" | "assistant"; content: string }[];

    const ai = getAI();
    let reply: string;

    if (!ai) {
      reply = "Hi! I'm Noe, your Noehost AI assistant. I'm currently warming up. For immediate help, please contact support@noehost.com or click 'Talk to Human Agent' below. 🙏";
    } else {
      try {
        const completion = await ai.chat.completions.create({
          model: "gpt-4o-mini",
          max_completion_tokens: 500,
          messages: [
            { role: "system", content: buildSystemPrompt(knowledgeCtx, clientCtx) },
            ...aiMessages,
          ],
        });
        reply = completion.choices[0]?.message?.content?.trim()
          ?? "I'm sorry, I couldn't generate a response. Please try again or contact our support team.";
      } catch (aiErr: any) {
        console.error("[AI SUPPORT AI ERROR]", aiErr.message);
        reply = "I'm having trouble reaching my knowledge base right now. [ACTION: create_ticket] and a human agent will help you immediately.";
        await bumpFailedAttempts(sessionId);
      }
    }

    // Detect if AI is unsure / needs escalation
    const isUnsure = reply.toLowerCase().includes("[action: create_ticket]") ||
      reply.toLowerCase().includes("contact our support") ||
      reply.toLowerCase().includes("reach out to");

    let failedAttempts = session.failed_attempts ?? 0;
    if (isUnsure) {
      failedAttempts = await bumpFailedAttempts(sessionId);
    }

    // Auto-handover after 2 failed/uncertain attempts
    let autoHandover = false;
    if (failedAttempts >= 2 && session.status !== "handover" && session.status !== "human") {
      await setSessionStatus(sessionId, "handover");
      autoHandover = true;

      // Send WhatsApp alert to admin
      const waMsg = [
        "🤖 *Noe AI — Human Handover Required*",
        "",
        `👤 Client: *${session.client_name ?? "Guest"}*`,
        `📧 Email: ${session.client_email ?? "unknown"}`,
        `❓ Issue: ${message.trim().slice(0, 150)}`,
        `🔗 Session: ${sessionId}`,
        "",
        "Please check the Admin → Support → Live Support panel to take over this chat.",
      ].join("\n");

      sendWhatsAppAlert("ai_handover", waMsg).catch(() => {});

      reply += "\n\n🙋 I've notified a human agent about your case. They'll join this chat shortly. You can also click **Talk to Human** below for immediate assistance.";
    }

    // Save AI reply
    await saveMessage({ sessionId, role: "assistant", content: reply });

    res.json({
      reply,
      status: session.status,
      autoHandover,
      failedAttempts,
    });
  } catch (err: any) {
    console.error("[AI SUPPORT MESSAGE]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /ai/support/session/:id/messages ────────────────────────────────────
router.get("/ai/support/session/:id/messages", async (req, res) => {
  try {
    const messages = await getMessages(req.params.id, 80);
    const session = await getSession(req.params.id);
    res.json({ messages, status: session?.status ?? "ai" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /ai/support/handover/:id — Request human agent ─────────────────────
router.post("/ai/support/handover/:id", async (req, res) => {
  try {
    const sessionId = req.params.id;
    const session = await getSession(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });

    await setSessionStatus(sessionId, "handover");

    await saveMessage({
      sessionId,
      role: "assistant",
      content: "🙋 **Human agent requested.** Our support team has been notified and will join this chat shortly. Average response time: 2–5 minutes during business hours.",
    });

    // WhatsApp notification
    const waMsg = [
      "🔔 *Live Support Request*",
      "",
      `👤 Client: *${session.client_name ?? "Guest"}*`,
      `📧 Email: ${session.client_email ?? "unknown"}`,
      `💬 Session ID: ${sessionId}`,
      "",
      "Please open Admin → Support → Live Support to take over this chat.",
    ].join("\n");

    sendWhatsAppAlert("live_support_request", waMsg).catch(() => {});

    res.json({ success: true, status: "handover" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /ai/support/attachment/:id — Add file attachment ───────────────────
router.post("/ai/support/attachment/:id", async (req, res) => {
  try {
    const { fileName, fileUrl, mimeType, fileSize, uploadedBy } = req.body;
    if (!fileUrl) return res.status(400).json({ error: "fileUrl required" });

    await db.execute(sql`
      INSERT INTO chat_attachments (session_id, file_name, file_url, mime_type, file_size, uploaded_by, created_at)
      VALUES (${req.params.id}, ${fileName ?? "attachment"}, ${fileUrl}, ${mimeType ?? "application/octet-stream"},
              ${fileSize ?? 0}, ${uploadedBy ?? "client"}, NOW())
    `);

    // Add a message noting the attachment
    await saveMessage({
      sessionId: req.params.id,
      role: "user",
      content: `📎 Attached file: [${fileName ?? "attachment"}](${fileUrl})`,
      metadata: { attachment: true, fileUrl, mimeType },
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN: GET /admin/ai/support/sessions ───────────────────────────────────
router.get("/admin/ai/support/sessions", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const status = (req.query.status as string) || "";
    const rows = await db.execute(sql`
      SELECT
        s.*,
        (SELECT content FROM chat_messages WHERE session_id = s.session_id ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT COUNT(*) FROM chat_messages WHERE session_id = s.session_id)::int AS message_count
      FROM chat_sessions s
      ${status ? sql`WHERE s.status = ${status}` : sql``}
      ORDER BY s.updated_at DESC
      LIMIT 100
    `);
    res.json({ sessions: rows.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN: GET /admin/ai/support/sessions/:id ───────────────────────────────
router.get("/admin/ai/support/sessions/:id", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const session = await getSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });

    const messages = await getMessages(req.params.id, 100);
    const attachments = await db.execute(sql`
      SELECT * FROM chat_attachments WHERE session_id = ${req.params.id} ORDER BY created_at ASC
    `).catch(() => ({ rows: [] }));

    res.json({ session, messages, attachments: attachments.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN: POST /admin/ai/support/sessions/:id/reply ────────────────────────
router.post("/admin/ai/support/sessions/:id/reply", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: "message required" });

    const session = await getSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });

    // Mark session as human-handled
    if (session.status !== "human") {
      await setSessionStatus(req.params.id, "human");
    }

    await saveMessage({
      sessionId: req.params.id,
      role: "admin",
      content: message.trim(),
      metadata: { adminId: req.user?.userId },
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN: PUT /admin/ai/support/sessions/:id/status ────────────────────────
router.put("/admin/ai/support/sessions/:id/status", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { status } = req.body;
    if (!["ai", "handover", "human", "closed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    await setSessionStatus(req.params.id, status);

    if (status === "human") {
      await saveMessage({
        sessionId: req.params.id,
        role: "assistant",
        content: "✅ A human support agent has joined this chat. How can we help you?",
      });
    } else if (status === "closed") {
      await saveMessage({
        sessionId: req.params.id,
        role: "assistant",
        content: "This support session has been closed. Thank you for contacting Noehost Support! If you need further assistance, please start a new conversation.",
      });
    }

    res.json({ success: true, status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN: GET /admin/ai/support/knowledge ──────────────────────────────────
router.get("/admin/ai/support/knowledge", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const docs = await db.execute(sql`
      SELECT * FROM ai_training_docs ORDER BY created_at DESC LIMIT 100
    `).catch(() => ({ rows: [] }));
    res.json({ docs: docs.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN: POST /admin/ai/support/knowledge ─────────────────────────────────
router.post("/admin/ai/support/knowledge", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { title, content, docType } = req.body;
    if (!title || !content) return res.status(400).json({ error: "title and content required" });

    await db.execute(sql`
      INSERT INTO ai_training_docs (title, content, doc_type, is_active, created_by, created_at, updated_at)
      VALUES (${title}, ${content}, ${docType ?? "faq"}, true, ${req.user?.userId ?? "admin"}, NOW(), NOW())
    `);

    res.status(201).json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN: DELETE /admin/ai/support/knowledge/:id ───────────────────────────
router.delete("/admin/ai/support/knowledge/:id", authenticate, requireRole("admin"), async (req, res) => {
  try {
    await db.execute(sql`DELETE FROM ai_training_docs WHERE id = ${req.params.id}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
