/**
 * Autonomous Support Agent — Noe AI Sentinel
 * Zero-Training | Web-Crawling | Real-Time Search | DB-Aware
 *
 * Intelligence layers (priority order):
 *   1. Live crawl of noehost.com at session start (cached 10 min)
 *   2. Real-time web search via Serper (Google) or DuckDuckGo fallback
 *   3. PostgreSQL: client services, hosting plans, KB articles, site_pages
 *   4. Admin-uploaded training docs
 *
 * Public / Client:
 *   POST /ai/support/session              — create or resume a session (+ crawl)
 *   POST /ai/support/message              — send message, get AI reply
 *   GET  /ai/support/session/:id/messages — load chat history
 *   POST /ai/support/handover/:id         — request human agent
 *   POST /ai/support/attachment/:id       — attach file
 *   GET  /ai/support/suggestions          — dynamic suggested questions
 *
 * Admin:
 *   GET  /admin/ai/support/sessions           — list all sessions
 *   GET  /admin/ai/support/sessions/:id       — full conversation + web logs
 *   POST /admin/ai/support/sessions/:id/reply — admin sends message
 *   PUT  /admin/ai/support/sessions/:id/status — take over / close
 *   GET  /admin/ai/support/knowledge           — list training docs
 *   POST /admin/ai/support/knowledge           — add training doc
 *   DELETE /admin/ai/support/knowledge/:id     — remove training doc
 *   GET  /admin/ai/support/search-logs         — web search audit log
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
import { eq, desc, sql } from "drizzle-orm";
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

// ══════════════════════════════════════════════════════════════════════════════
// WEB CRAWLING ENGINE
// ══════════════════════════════════════════════════════════════════════════════

interface CrawlCache {
  text: string;
  suggestions: string[];
  fetchedAt: number;
}

let crawlCache: CrawlCache | null = null;
const CRAWL_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Strip HTML tags, collapse whitespace, limit length */
function htmlToText(html: string, maxLen = 6000): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, maxLen);
}

/** Fetch a single URL and return clean text */
async function crawlPage(url: string, maxLen = 3000): Promise<string> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "NoeBot/1.0 (Noehost AI Support)" },
    });
    if (!res.ok) return "";
    const html = await res.text();
    return htmlToText(html, maxLen);
  } catch {
    return "";
  }
}

/** Derive suggested questions from crawled text */
function derivesuggestions(text: string): string[] {
  const base = [
    "What hosting plans do you offer and what are the prices?",
    "How do I install WordPress on my hosting?",
    "How do I activate my free SSL certificate?",
    "How do I set up a professional email account?",
    "What is the refund policy?",
    "How do I transfer my domain to Noehost?",
  ];

  const extras: string[] = [];
  if (/reseller/i.test(text)) extras.push("Tell me about reseller hosting plans.");
  if (/vps/i.test(text))      extras.push("What VPS hosting options are available?");
  if (/wordpress/i.test(text)) extras.push("Do you offer managed WordPress hosting?");
  if (/backup/i.test(text))   extras.push("How are backups handled?");
  if (/cpanel|cPanel/i.test(text)) extras.push("How do I access my cPanel control panel?");
  if (/24.7|support/i.test(text)) extras.push("What are your support hours and response times?");

  return [...extras, ...base].slice(0, 6);
}

/** Crawl noehost.com — returns cached result if fresh */
export async function crawlNoehost(): Promise<CrawlCache> {
  const now = Date.now();
  if (crawlCache && now - crawlCache.fetchedAt < CRAWL_TTL_MS) {
    return crawlCache;
  }

  console.log("[AI-CRAWL] Crawling noehost.com for fresh context…");

  const PAGES = [
    "https://noehost.com",
    "https://noehost.com/#pricing",
    "https://noehost.com/#services",
    "https://noehost.com/help",
  ];

  const results = await Promise.allSettled(
    PAGES.map(url => crawlPage(url, 2500))
  );

  const parts: string[] = [];
  const urls = PAGES;
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value.trim().length > 50) {
      parts.push(`--- ${urls[i]} ---\n${r.value}`);
    }
  });

  const combined = parts.join("\n\n");
  const suggestions = derivesuggestions(combined);

  crawlCache = {
    text: combined || "Noehost is a professional web hosting company offering shared, reseller, and VPS hosting with 24/7 support.",
    suggestions,
    fetchedAt: now,
  };

  console.log(`[AI-CRAWL] Done — ${combined.length} chars extracted from ${parts.length}/${PAGES.length} pages`);
  return crawlCache;
}

// ══════════════════════════════════════════════════════════════════════════════
// WEB SEARCH ENGINE
// ══════════════════════════════════════════════════════════════════════════════

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

/** Detect if a message is a technical/error query that needs web search */
function isTechnicalQuery(message: string): boolean {
  const msg = message.toLowerCase();
  return (
    /\b(error|fix|how to|how do i|problem|issue|failed|not working|403|404|500|502|503|timeout|ssl|dns|php|mysql|wordpress|cpanel|email|smtp|imap|ftp|sftp|htaccess|redirect|domain|nameserver|mx record|cname)\b/.test(msg) &&
    msg.length > 15
  );
}

/** Search via Serper (Google) API */
async function searchSerper(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: `${query} hosting cPanel`, num: 5 }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data = await res.json() as any;
    return (data.organic ?? []).slice(0, 4).map((r: any) => ({
      title: r.title ?? "",
      snippet: r.snippet ?? "",
      url: r.link ?? "",
    }));
  } catch {
    return [];
  }
}

/** Search via DuckDuckGo (free, no key) */
async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return [];
    const data = await res.json() as any;
    const results: SearchResult[] = [];

    if (data.AbstractText) {
      results.push({
        title: data.Heading || query,
        snippet: data.AbstractText.slice(0, 400),
        url: data.AbstractURL || "",
      });
    }
    (data.RelatedTopics ?? []).slice(0, 3).forEach((t: any) => {
      if (t.Text && t.FirstURL) {
        results.push({ title: t.Text.slice(0, 80), snippet: t.Text.slice(0, 300), url: t.FirstURL });
      }
    });
    return results;
  } catch {
    return [];
  }
}

/** Search the web — Serper primary, DuckDuckGo fallback */
async function searchWeb(query: string): Promise<SearchResult[]> {
  const hasSerper = !!process.env.SERPER_API_KEY;
  const results = hasSerper
    ? await searchSerper(query)
    : await searchDuckDuckGo(query);
  return results;
}

/** Format search results for AI context */
function formatSearchResults(results: SearchResult[]): string {
  if (!results.length) return "";
  return [
    "=== Live Web Search Results ===",
    ...results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}\n   Source: ${r.url}`),
  ].join("\n");
}

// ══════════════════════════════════════════════════════════════════════════════
// WEB SEARCH LOGGING
// ══════════════════════════════════════════════════════════════════════════════

async function logWebSearch(data: {
  sessionId: string;
  queryText: string;
  searchType: "website_crawl" | "web_search" | "duckduckgo";
  sourceUrl: string;
  resultSnippet: string;
  resultsCount: number;
}) {
  try {
    await db.execute(sql`
      INSERT INTO chat_web_searches
        (session_id, query_text, search_type, source_url, result_snippet, results_count, created_at)
      VALUES
        (${data.sessionId}, ${data.queryText}, ${data.searchType},
         ${data.sourceUrl}, ${data.resultSnippet.slice(0, 500)}, ${data.resultsCount}, NOW())
    `);
  } catch { /* non-fatal */ }
}

// ══════════════════════════════════════════════════════════════════════════════
// DB HELPERS
// ══════════════════════════════════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE CONTEXT (DB + Crawl)
// ══════════════════════════════════════════════════════════════════════════════

async function buildDbKnowledgeContext(): Promise<string> {
  const parts: string[] = [];

  try {
    const plans = await db.select({
      name: hostingPlansTable.name,
      price: hostingPlansTable.price,
      billingCycle: hostingPlansTable.billingCycle,
      description: hostingPlansTable.description,
    }).from(hostingPlansTable).limit(20).catch(() => []);

    if (plans.length) {
      parts.push("=== Noehost Hosting Plans (from DB) ===");
      for (const p of plans) {
        parts.push(`• ${p.name}: $${p.price}/${p.billingCycle ?? "mo"} — ${p.description ?? ""}`);
      }
    }
  } catch { /* non-fatal */ }

  try {
    const articles = await db.select({
      title: kbArticlesTable.title,
      content: kbArticlesTable.content,
    }).from(kbArticlesTable)
      .where(eq(kbArticlesTable.isPublished, true))
      .orderBy(desc(kbArticlesTable.views))
      .limit(12).catch(() => []);

    if (articles.length) {
      parts.push("\n=== Knowledge Base Articles ===");
      for (const a of articles) {
        const snippet = (a.content ?? "").replace(/<[^>]+>/g, "").slice(0, 250);
        if (snippet) parts.push(`• ${a.title}: ${snippet}`);
      }
    }
  } catch { /* non-fatal */ }

  try {
    const docs = await db.execute(sql`
      SELECT title, content FROM ai_training_docs WHERE is_active = true ORDER BY created_at DESC LIMIT 15
    `).catch(() => ({ rows: [] }));

    if ((docs.rows as any[]).length) {
      parts.push("\n=== Admin Training Docs ===");
      for (const d of docs.rows as any[]) {
        parts.push(`• ${d.title}: ${(d.content ?? "").slice(0, 350)}`);
      }
    }
  } catch { /* non-fatal */ }

  try {
    const pages = await db.execute(sql`
      SELECT page_id, section_name, content_json
      FROM site_pages WHERE is_visible = true LIMIT 25
    `).catch(() => ({ rows: [] }));

    if ((pages.rows as any[]).length) {
      parts.push("\n=== Website Page Content ===");
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

// ══════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT FACTORY
// ══════════════════════════════════════════════════════════════════════════════

function buildSystemPrompt(opts: {
  websiteCrawl: string;
  dbKnowledge: string;
  clientCtx: string;
  webSearchResults: string;
  searchedFor?: string;
}): string {
  const hasWebSearch = !!opts.webSearchResults;

  return `You are Noe — an Autonomous AI Support Agent for Noehost, a professional web hosting and domain management company. You operate in real-time, combining live website data, Google search results, and internal database knowledge to give accurate, professional answers.

YOUR INTELLIGENCE SOURCES (in priority order):
1. LIVE WEBSITE DATA — freshly crawled from noehost.com
2. REAL-TIME WEB SEARCH — latest results from Google/web${hasWebSearch ? ` (searched for: "${opts.searchedFor}")` : " (not triggered this turn)"}
3. INTERNAL DATABASE — client services, hosting plans, KB articles
4. GENERAL KNOWLEDGE — your own training data as last resort

BEHAVIOR RULES:
- Always cite your source (e.g., "According to the Noehost website…" or "Based on your hosting service data…" or "I searched the web and found…")
- For technical errors (403, 500, SSL, DNS, WordPress), give step-by-step solutions based on web search + cPanel knowledge
- ALWAYS personalize answers using the client's actual service data when available
- For billing: direct to billing@noehost.com
- For complex unresolved issues after 2 attempts: suggest human agent with [ACTION: create_ticket]
- Keep replies concise (3–6 sentences) unless a numbered guide is needed
- Sign off as "Noe · Noehost AI"

${opts.clientCtx ? `\n${opts.clientCtx}\n` : ""}

${opts.websiteCrawl ? `\n=== LIVE NOEHOST.COM WEBSITE DATA ===\n${opts.websiteCrawl.slice(0, 4000)}\n` : ""}

${opts.dbKnowledge ? `\n${opts.dbKnowledge}\n` : ""}

${opts.webSearchResults ? `\n${opts.webSearchResults}\n` : ""}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// ─── POST /ai/support/session ─────────────────────────────────────────────────
router.post("/ai/support/session", async (req: AuthRequest, res) => {
  try {
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
    if (!sessionId) return res.status(400).json({ error: "sessionId required" });

    const existing = await getSession(sessionId);
    if (existing) {
      // Trigger background crawl refresh if cache is stale
      crawlNoehost().catch(() => {});
      return res.json({ sessionId, status: existing.status, existing: true });
    }

    await createSession({ sessionId, userId, clientName, clientEmail, clientPhone, serviceId, subject, source });

    // Kick off crawl in background (non-blocking)
    crawlNoehost().then(cache => {
      logWebSearch({
        sessionId,
        queryText: "noehost.com website crawl",
        searchType: "website_crawl",
        sourceUrl: "https://noehost.com",
        resultSnippet: cache.text.slice(0, 300),
        resultsCount: 4,
      }).catch(() => {});
    }).catch(() => {});

    res.json({ sessionId, status: "ai", existing: false });
  } catch (err: any) {
    console.error("[AI SUPPORT SESSION]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /ai/support/message ─────────────────────────────────────────────────
router.post("/ai/support/message", async (req: AuthRequest, res) => {
  try {
    const { sessionId, message } = req.body as { sessionId: string; message: string };

    if (!sessionId || !message?.trim()) {
      return res.status(400).json({ error: "sessionId and message required" });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found. Create a session first." });
    }

    await saveMessage({ sessionId, role: "user", content: message.trim() });

    if (session.status === "human") {
      return res.json({
        reply: "✅ A human agent is reviewing your case. Please wait — they will reply shortly.",
        status: "human",
        handedOver: true,
        webSearched: false,
      });
    }

    // ── Parallel context gathering ────────────────────────────────────────────
    const doSearch = isTechnicalQuery(message);
    const searchQuery = `${message.trim().slice(0, 120)} site:noehost.com OR cPanel OR hosting`;

    const [crawlData, dbKnowledge, clientCtx, searchResults] = await Promise.all([
      crawlNoehost(),
      buildDbKnowledgeContext(),
      session.user_id ? buildClientContext(session.user_id) : Promise.resolve(""),
      doSearch ? searchWeb(message.trim()) : Promise.resolve([]),
    ]);

    // Log web search
    if (doSearch && searchResults.length) {
      const hasSerper = !!process.env.SERPER_API_KEY;
      logWebSearch({
        sessionId,
        queryText: message.trim().slice(0, 200),
        searchType: hasSerper ? "web_search" : "duckduckgo",
        sourceUrl: searchResults[0]?.url ?? "",
        resultSnippet: searchResults.map(r => r.snippet).join(" | ").slice(0, 500),
        resultsCount: searchResults.length,
      }).catch(() => {});
    }

    // ── Load recent history ───────────────────────────────────────────────────
    const history = await getMessages(sessionId, 20);
    const aiMessages = history
      .filter(m => m.role === "user" || m.role === "assistant")
      .slice(-16)
      .map(m => ({ role: m.role === "admin" ? "assistant" : m.role, content: m.content })) as { role: "user" | "assistant"; content: string }[];

    // ── Build system prompt ───────────────────────────────────────────────────
    const systemPrompt = buildSystemPrompt({
      websiteCrawl: crawlData.text,
      dbKnowledge,
      clientCtx,
      webSearchResults: formatSearchResults(searchResults),
      searchedFor: doSearch ? message.trim().slice(0, 80) : undefined,
    });

    // ── AI completion ─────────────────────────────────────────────────────────
    const ai = getAI();
    let reply: string;
    let webSearched = doSearch && searchResults.length > 0;

    if (!ai) {
      reply = "Hi! I'm Noe, your Noehost AI assistant. My AI engine is warming up. For immediate help, please contact support@noehost.com or click **Talk to Human Agent** below. 🙏";
      webSearched = false;
    } else {
      try {
        const completion = await ai.chat.completions.create({
          model: "gpt-4o-mini",
          max_completion_tokens: 600,
          messages: [
            { role: "system", content: systemPrompt },
            ...aiMessages,
          ],
        });
        reply = completion.choices[0]?.message?.content?.trim()
          ?? "I couldn't generate a response. Please try again or contact our support team.";
      } catch (aiErr: any) {
        console.error("[AI SUPPORT AI ERROR]", aiErr.message);
        reply = "I ran into a technical hiccup. [ACTION: create_ticket] and a human agent will help you immediately.";
        await bumpFailedAttempts(sessionId);
      }
    }

    // ── Escalation logic ──────────────────────────────────────────────────────
    const isUnsure = reply.toLowerCase().includes("[action: create_ticket]") ||
      reply.toLowerCase().includes("contact our support") ||
      reply.toLowerCase().includes("reach out to our team");

    let failedAttempts = session.failed_attempts ?? 0;
    if (isUnsure) failedAttempts = await bumpFailedAttempts(sessionId);

    let autoHandover = false;
    if (failedAttempts >= 2 && session.status !== "handover" && session.status !== "human") {
      await setSessionStatus(sessionId, "handover");
      autoHandover = true;

      const researchSummary = searchResults.length
        ? `Web search results: ${searchResults.map(r => r.snippet).join(" | ").slice(0, 300)}`
        : "No additional web data found.";

      const waMsg = [
        "🤖 *Noe AI — Human Handover Required*",
        "",
        `👤 Client: *${session.client_name ?? "Guest"}*`,
        `📧 Email: ${session.client_email ?? "unknown"}`,
        `❓ Issue: ${message.trim().slice(0, 150)}`,
        `🔍 AI Research: ${researchSummary.slice(0, 200)}`,
        `🔗 Session: ${sessionId}`,
        "",
        "Please check Admin → Support → Live Support to take over.",
      ].join("\n");

      sendWhatsAppAlert("ai_handover", waMsg).catch(() => {});
      reply += "\n\n🙋 I've notified a human agent — they'll join this chat shortly. You can also click **Talk to Human** below.";
    }

    // Save AI reply with metadata
    await saveMessage({
      sessionId,
      role: "assistant",
      content: reply,
      metadata: {
        webSearched,
        searchQuery: doSearch ? message.trim().slice(0, 80) : null,
        searchResultsCount: searchResults.length,
        crawledAt: crawlData.fetchedAt,
        hasSerper: !!process.env.SERPER_API_KEY,
      },
    });

    res.json({
      reply,
      status: session.status,
      autoHandover,
      failedAttempts,
      webSearched,
      searchedFor: doSearch ? message.trim().slice(0, 60) : null,
      crawledSite: "noehost.com",
    });
  } catch (err: any) {
    console.error("[AI SUPPORT MESSAGE]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /ai/support/session/:id/messages ─────────────────────────────────────
router.get("/ai/support/session/:id/messages", async (req, res) => {
  try {
    const messages = await getMessages(req.params.id, 80);
    const session = await getSession(req.params.id);
    res.json({ messages, status: session?.status ?? "ai" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /ai/support/suggestions — Dynamic suggested questions ─────────────────
router.get("/ai/support/suggestions", async (req, res) => {
  try {
    const cache = await crawlNoehost();
    res.json({
      suggestions: cache.suggestions,
      crawledAt: cache.fetchedAt,
      source: "noehost.com",
    });
  } catch {
    res.json({
      suggestions: [
        "What hosting plans do you offer?",
        "How do I install WordPress?",
        "How do I activate SSL?",
        "How do I set up email?",
        "What is your refund policy?",
      ],
      source: "fallback",
    });
  }
});

// ─── POST /ai/support/handover/:id ────────────────────────────────────────────
router.post("/ai/support/handover/:id", async (req, res) => {
  try {
    const sessionId = req.params.id;
    const session = await getSession(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });

    await setSessionStatus(sessionId, "handover");
    await saveMessage({
      sessionId,
      role: "assistant",
      content: "🙋 **Human agent requested.** Our support team has been notified and will join this chat shortly. Average response: 2–5 minutes during business hours.",
    });

    const waMsg = [
      "🔔 *Live Support Request*",
      "",
      `👤 Client: *${session.client_name ?? "Guest"}*`,
      `📧 Email: ${session.client_email ?? "unknown"}`,
      `📱 Phone: ${session.client_phone ?? "N/A"}`,
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

// ─── POST /ai/support/attachment/:id ──────────────────────────────────────────
router.post("/ai/support/attachment/:id", async (req, res) => {
  try {
    const { fileName, fileUrl, mimeType, fileSize, uploadedBy } = req.body;
    if (!fileUrl) return res.status(400).json({ error: "fileUrl required" });

    await db.execute(sql`
      INSERT INTO chat_attachments (session_id, file_name, file_url, mime_type, file_size, uploaded_by, created_at)
      VALUES (${req.params.id}, ${fileName ?? "attachment"}, ${fileUrl},
              ${mimeType ?? "application/octet-stream"}, ${fileSize ?? 0}, ${uploadedBy ?? "client"}, NOW())
    `);

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

// ─── ADMIN: GET /admin/ai/support/sessions ────────────────────────────────────
router.get("/admin/ai/support/sessions", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const status = (req.query.status as string) || "";
    const rows = await db.execute(sql`
      SELECT
        s.*,
        (SELECT content FROM chat_messages WHERE session_id = s.session_id ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT COUNT(*) FROM chat_messages WHERE session_id = s.session_id)::int AS message_count,
        (SELECT COUNT(*) FROM chat_web_searches WHERE session_id = s.session_id)::int AS search_count
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

    const [messages, attachments, webSearches] = await Promise.all([
      getMessages(req.params.id, 100),
      db.execute(sql`SELECT * FROM chat_attachments WHERE session_id = ${req.params.id} ORDER BY created_at ASC`).catch(() => ({ rows: [] })),
      db.execute(sql`SELECT * FROM chat_web_searches WHERE session_id = ${req.params.id} ORDER BY created_at ASC`).catch(() => ({ rows: [] })),
    ]);

    res.json({ session, messages, attachments: attachments.rows, webSearches: webSearches.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN: POST /admin/ai/support/sessions/:id/reply ───────────────────────
router.post("/admin/ai/support/sessions/:id/reply", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: "message required" });

    const session = await getSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });

    if (session.status !== "human") await setSessionStatus(req.params.id, "human");

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

// ─── ADMIN: PUT /admin/ai/support/sessions/:id/status ───────────────────────
router.put("/admin/ai/support/sessions/:id/status", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { status } = req.body;
    if (!["ai", "handover", "human", "closed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    await setSessionStatus(req.params.id, status);
    if (status === "human") {
      await saveMessage({ sessionId: req.params.id, role: "assistant", content: "✅ A human support agent has joined this chat. How can we help you?" });
    } else if (status === "closed") {
      await saveMessage({ sessionId: req.params.id, role: "assistant", content: "This session has been closed. Thank you for contacting Noehost Support! Start a new conversation anytime." });
    }
    res.json({ success: true, status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN: GET /admin/ai/support/search-logs ────────────────────────────────
router.get("/admin/ai/support/search-logs", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT w.*, s.client_name, s.client_email
      FROM chat_web_searches w
      LEFT JOIN chat_sessions s ON s.session_id = w.session_id
      ORDER BY w.created_at DESC LIMIT 200
    `).catch(() => ({ rows: [] }));
    res.json({ logs: rows.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN: GET /admin/ai/support/knowledge ──────────────────────────────────
router.get("/admin/ai/support/knowledge", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const docs = await db.execute(sql`SELECT * FROM ai_training_docs ORDER BY created_at DESC LIMIT 100`).catch(() => ({ rows: [] }));
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
