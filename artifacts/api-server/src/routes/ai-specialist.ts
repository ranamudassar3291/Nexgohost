/**
 * AI Support Specialist — Context-aware AI agent for client hosting issues
 *
 * POST /ai/specialist/chat          — context-injected chat (reads service logs, status)
 * POST /ai/specialist/auto-ticket   — auto-generate + create a support ticket from conversation
 * GET  /ai/specialist/history/:sid  — conversation history for a service
 */

import { Router } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import { ticketsTable, ticketMessagesTable, hostingServicesTable, serversTable, usersTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../lib/auth.js";

const router = Router();

// ─── OpenAI client ─────────────────────────────────────────────────────────────
function getAI(): OpenAI | null {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) return null;
  return new OpenAI({ baseURL, apiKey });
}

// ─── Save message to DB ────────────────────────────────────────────────────────
async function saveMsg(
  userId: string,
  serviceId: string | null,
  role: "user" | "assistant" | "system",
  content: string,
  metadata: Record<string, any> = {}
) {
  await db.execute(sql`
    INSERT INTO ai_conversations (user_id, service_id, role, content, metadata_json, created_at)
    VALUES (${userId}, ${serviceId}, ${role}, ${content}, ${JSON.stringify(metadata)}, NOW())
  `).catch(() => {});
}

// ─── Build rich service context ────────────────────────────────────────────────
async function buildServiceContext(serviceId: string, userId: string): Promise<string> {
  try {
    const [svc] = await db.select().from(hostingServicesTable)
      .where(eq(hostingServicesTable.id, serviceId)).limit(1);
    if (!svc || svc.userId !== userId) return "";

    let serverType = "unknown";
    if (svc.serverId) {
      const [srv] = await db.select().from(serversTable)
        .where(eq(serversTable.id, svc.serverId)).limit(1);
      if (srv) serverType = srv.type ?? "unknown";
    }

    // Last 5 resource log entries
    const resLogs = await db.execute(sql`
      SELECT entry_processes, inodes_used, cpu_pct, disk_io_read, recorded_at
      FROM resource_usage_logs WHERE service_id = ${serviceId}
      ORDER BY recorded_at DESC LIMIT 5
    `).catch(() => ({ rows: [] }));

    // Last 3 security scans
    const secLogs = await db.execute(sql`
      SELECT scan_type, result, dirs_fixed, files_fixed, scanned_at
      FROM security_scan_logs WHERE service_id = ${serviceId}
      ORDER BY scanned_at DESC LIMIT 3
    `).catch(() => ({ rows: [] }));

    // Last 5 staging sync logs
    const stgLogs = await db.execute(sql`
      SELECT action, status, note, logged_at
      FROM staging_sync_logs WHERE service_id = ${serviceId}
      ORDER BY logged_at DESC LIMIT 3
    `).catch(() => ({ rows: [] }));

    const ctx = [
      `=== Hosting Service Context ===`,
      `Domain: ${svc.domain ?? "N/A"}`,
      `Plan: ${svc.planName ?? "N/A"}`,
      `Status: ${svc.status}`,
      `Server type: ${serverType}`,
      `SSL: ${svc.sslStatus ?? "unknown"}`,
      `WordPress installed: ${svc.wpInstalled ? `yes (${svc.wpProvisionStatus ?? "active"})` : "no"}`,
      svc.wpProvisionError ? `WordPress error: ${svc.wpProvisionError}` : "",
      `Disk used: ${svc.diskUsed ?? "N/A"}`,
      `Bandwidth used: ${svc.bandwidthUsed ?? "N/A"}`,
    ].filter(Boolean);

    if (resLogs.rows.length) {
      const latest = resLogs.rows[0] as any;
      ctx.push(`\n=== Latest Resource Metrics ===`);
      ctx.push(`CPU: ${latest.cpu_pct ?? "N/A"}%`);
      ctx.push(`Entry Processes: ${latest.entry_processes ?? "N/A"}`);
      ctx.push(`Inodes Used: ${latest.inodes_used ?? "N/A"}`);
      ctx.push(`Disk I/O Read: ${latest.disk_io_read ?? "N/A"} MB/s`);
    }

    if (secLogs.rows.length) {
      ctx.push(`\n=== Recent Security Scans ===`);
      for (const s of secLogs.rows as any[]) {
        ctx.push(`${s.scan_type}: ${s.result} (${s.dirs_fixed} dirs, ${s.files_fixed} files fixed at ${new Date(s.scanned_at).toISOString().slice(0,10)})`);
      }
    }

    if (stgLogs.rows.length) {
      ctx.push(`\n=== Recent Staging Activity ===`);
      for (const s of stgLogs.rows as any[]) {
        ctx.push(`${s.action}: ${s.status}${s.note ? ` — ${s.note}` : ""}`);
      }
    }

    return ctx.join("\n");
  } catch { return ""; }
}

// ─── System prompt factory ─────────────────────────────────────────────────────
function buildSystemPrompt(serviceCtx: string): string {
  return `You are Noe, an expert AI Support Specialist for Noehost — a professional web hosting platform. You operate 24/7 and help clients diagnose and fix their hosting issues in real time.

Your approach:
1. READ the service context provided below carefully before answering.
2. IDENTIFY the most likely root cause based on the error description + the service metrics.
3. SUGGEST specific, actionable fixes (not generic advice). Reference the actual service data.
4. Use [ACTION: fix_permissions] [ACTION: clear_cache] [ACTION: open_phpmyadmin] [ACTION: restart_php] or [ACTION: create_ticket] tags when you want to embed a clickable fix button in your response.
5. If the issue requires human intervention, end with: [ACTION: create_ticket] to auto-escalate.
6. Keep responses concise — 3–6 sentences max, then action buttons.
7. Format: plain text with [ACTION:...] tags. No markdown headers.

Available action tags:
- [ACTION: fix_permissions] — resets file permissions to 755/644
- [ACTION: clear_cache] — purges edge + object cache
- [ACTION: open_file_manager] — opens File Manager
- [ACTION: open_wordpress] — opens WordPress admin
- [ACTION: create_ticket] — auto-creates a support ticket with all logs

${serviceCtx ? `\n${serviceCtx}\n` : ""}
Always sign off as "Noe · Noehost AI".`;
}

// ─── POST /ai/specialist/chat ─────────────────────────────────────────────────
router.post("/ai/specialist/chat", authenticate, async (req: AuthRequest, res) => {
  try {
    const { messages, serviceId } = req.body as {
      messages: { role: "user" | "assistant"; content: string }[];
      serviceId?: string;
    };

    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: "messages array required" });
    }

    const userId = req.user!.userId;
    const lastUserMsg = messages[messages.length - 1]?.content ?? "";

    // Save user message
    await saveMsg(userId, serviceId ?? null, "user", lastUserMsg);

    // Build service context
    const serviceCtx = serviceId ? await buildServiceContext(serviceId, userId) : "";

    const ai = getAI();
    let reply: string;

    if (!ai) {
      reply = "Hi! I'm Noe, your Noehost AI Specialist. I'm not fully configured yet, but our human support team is available 24/7. [ACTION: create_ticket] to reach us immediately.";
    } else {
      const completion = await ai.chat.completions.create({
        model: "gpt-4o-mini",
        max_completion_tokens: 450,
        messages: [
          { role: "system", content: buildSystemPrompt(serviceCtx) },
          ...messages.slice(-12),
        ],
      });
      reply = completion.choices[0]?.message?.content?.trim()
        ?? "I'm having trouble right now. [ACTION: create_ticket] so our team can help you immediately.";
    }

    // Save AI reply
    await saveMsg(userId, serviceId ?? null, "assistant", reply, { serviceCtx: serviceCtx.slice(0, 500) });

    return res.json({ reply, serviceCtx: !!serviceCtx });
  } catch (err: any) {
    console.error("[AI SPECIALIST]", err.message);
    return res.json({
      reply: "I ran into an error. [ACTION: create_ticket] and our team will be with you shortly.",
    });
  }
});

// ─── POST /ai/specialist/auto-ticket ─────────────────────────────────────────
router.post("/ai/specialist/auto-ticket", authenticate, async (req: AuthRequest, res) => {
  try {
    const { conversation, serviceId, subject } = req.body as {
      conversation: { role: string; content: string }[];
      serviceId?: string;
      subject?: string;
    };

    const userId = req.user!.userId;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Build service context for the ticket body
    const serviceCtx = serviceId ? await buildServiceContext(serviceId, userId) : "";

    // Format conversation into ticket body
    const convoText = conversation
      .filter(m => m.role !== "system")
      .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
      .join("\n\n");

    const ticketBody = [
      "🤖 **Auto-generated by Noe AI Support Specialist**",
      "",
      "**Issue Summary:**",
      subject ?? "Technical issue requiring human support",
      "",
      "**AI Conversation Log:**",
      convoText,
      "",
      serviceCtx ? "**Service Technical Context:**\n" + serviceCtx : "",
    ].filter(s => s !== undefined).join("\n");

    const ticketNumber = `TKT-AI-${Date.now()}`;
    const [ticket] = await db.insert(ticketsTable).values({
      ticketNumber,
      clientId: userId,
      subject: subject ?? "AI Support Auto-Escalation",
      status: "open",
      priority: "high",
      department: "Technical",
      messagesCount: 1,
      lastReply: new Date(),
    }).returning();

    await db.insert(ticketMessagesTable).values({
      ticketId: ticket.id,
      senderId: userId,
      senderName: `${user.firstName} ${user.lastName}`,
      senderRole: "client",
      message: ticketBody,
      attachments: [],
    });

    // Log the auto-ticket creation in conversations
    await saveMsg(userId, serviceId ?? null, "system", `Auto-ticket created: ${ticketNumber}`, {
      ticketId: ticket.id, ticketNumber,
    });

    res.status(201).json({
      success: true,
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
    });
  } catch (err: any) {
    console.error("[AI SPECIALIST AUTO-TICKET]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /ai/specialist/history/:sid ─────────────────────────────────────────
router.get("/ai/specialist/history/:sid", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const rows = await db.execute(sql`
      SELECT role, content, created_at
      FROM ai_conversations
      WHERE service_id = ${req.params.sid} AND user_id = ${userId}
        AND role IN ('user', 'assistant')
      ORDER BY created_at DESC LIMIT 40
    `);
    res.json({ messages: (rows.rows as any[]).reverse() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
