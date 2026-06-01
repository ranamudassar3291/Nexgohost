/**
 * Noehost Live Chat — Gemini powered support agent
 */

import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { authenticate, requireAdmin, verifyToken, type AuthRequest } from "../lib/auth.js";
import { sendWhatsAppAlert } from "../lib/whatsapp.js";

const router = Router();

// ── Comprehensive hardcoded knowledge about Noehost ───────────────────────────
const NOEHOST_KNOWLEDGE = `
=== NOEHOST COMPLETE KNOWLEDGE BASE ===

## COMPANY INFO
- Name: Noehost (noehost.com)
- Tagline: Next-Gen Hosting Infrastructure
- Support: support@noehost.com | +92 3151711821
- WhatsApp Support available
- 99.9% Uptime guarantee

## SHARED HOSTING PLANS
1. Starter Plan — Rs. 180/month
   - 1 Website, 5 GB SSD, 10 GB Bandwidth
   - 1 Email account, Free SSL, cPanel
   - Best for: Personal blogs, small sites

2. Business Plan — Rs. 350/month (Most Popular)
   - Unlimited Websites, 20 GB SSD, Unlimited Bandwidth
   - 10 Email accounts, Free SSL, cPanel, Daily Backups
   - Free Domain for 1 year
   - Best for: Small businesses, portfolios

3. Professional Plan — Rs. 600/month
   - Unlimited Websites, 50 GB SSD, Unlimited Bandwidth
   - Unlimited Emails, Priority Support, Daily Backups
   - Free Domain, Free CDN, Free Migration
   - Best for: Growing businesses

4. Enterprise Plan — Rs. 1200/month
   - Unlimited everything, 100 GB NVMe SSD
   - Dedicated resources, 24/7 priority support
   - Free domain, Free CDN, LiteSpeed cache
   - Best for: High-traffic sites, eCommerce

## WORDPRESS HOSTING
- Optimized WordPress hosting available
- One-click WordPress installation
- Auto-updates, WP-CLI, staging environment
- LiteSpeed cache pre-installed
- Plans: Same pricing as shared hosting but WP-optimized
- WP Admin auto-login from dashboard

## VPS (CLOUD VPS) PLANS
- VPS 1: Rs. 1500/month — 1 vCPU, 1 GB RAM, 25 GB SSD, 1 TB BW
- VPS 2: Rs. 2500/month — 2 vCPU, 2 GB RAM, 50 GB SSD, 2 TB BW
- VPS 3: Rs. 4000/month — 4 vCPU, 4 GB RAM, 100 GB SSD, 4 TB BW
- VPS 4: Rs. 7000/month — 8 vCPU, 8 GB RAM, 200 GB SSD, 8 TB BW
- Full root access, KVM virtualization, instant setup
- Choice of OS: Ubuntu, CentOS, Debian, Almalinux

## RESELLER HOSTING
- White-label reseller accounts available
- WHM/cPanel included
- Custom nameservers
- Plans start from Rs. 800/month
- WHMCS billing integration available

## DOMAIN REGISTRATION
- .com — Rs. 1,800/year
- .net — Rs. 2,000/year
- .org — Rs. 2,200/year
- .pk — Rs. 1,200/year
- .co.uk — Rs. 1,500/year
- Free domain with Business plan and above
- Domain transfer available — bring your domain to Noehost
- Free domain privacy protection

## BUSINESS EMAIL (NOEMAIL)
- Professional email @yourdomain.com
- Plans: 5 GB, 10 GB, 25 GB per mailbox
- Webmail access, IMAP/POP3/SMTP
- Spam filter, virus protection
- Prices: From Rs. 200/month per mailbox

## PAYMENT METHODS
- EasyPaisa (mobile wallet)
- Bank Transfer (Meezan Bank, HBL, UBL)
- Safepay (credit/debit cards)
- Manual payment with admin approval

## BILLING & INVOICES
- Invoices sent by email automatically
- Pay via client portal at /client/invoices
- Late payment: 7 day grace period
- Suspension after unpaid invoice (after grace period)
- Refund policy: 30-day money back guarantee on shared hosting

## CONTROL PANEL (cPANEL) GUIDE
- Access: Login to client portal → Hosting → cPanel button
- File Manager: Upload, edit, manage website files
- Databases: Create MySQL databases, phpMyAdmin
- Email Accounts: Create @yourdomain.com emails
- SSL Certificates: Install free Let's Encrypt SSL
- Subdomains, Addon Domains, Parked Domains
- Cron Jobs, PHP settings (7.4, 8.0, 8.1, 8.2, 8.3)
- Error logs, Bandwidth usage stats

## HOW TO PLACE AN ORDER
1. Go to noehost.com → Hosting → choose plan
2. Click "Order Now" or "Get Started"
3. Register or login to your account
4. Choose billing cycle (monthly/quarterly/yearly)
5. Add domain (new or existing)
6. Complete payment
7. Account activated within minutes

## HOW TO LOGIN
- Client Portal: noehost.com/client/login
- Admin: noehost.com/admin/noe (admin only)
- Forgot password: Click "Forgot Password" on login page

## SSL CERTIFICATES
- Free Let's Encrypt SSL on all plans
- Install from: Client Portal → Hosting → SSL section
- Auto-renewal available
- Wildcard SSL available on request

## MIGRATIONS
- Free website migration on Business plan and above
- Migration from cPanel, Plesk, or any host
- Contact support to start migration
- Migration time: 24-48 hours

## WORDPRESS - HOW TO INSTALL
1. Login → Client Portal → Hosting → select service
2. Click "WordPress" tab
3. Click "Install WordPress"
4. Set admin username/password
5. Done! WP ready in minutes

## COMMON ISSUES & SOLUTIONS

### Website Not Loading
- Check if domain is pointed to Noehost nameservers
- Nameservers: ns1.noehost.com, ns2.noehost.com
- DNS propagation takes 24-48 hours
- Check if hosting is active/not suspended
- Contact support if issue persists

### Email Not Working
- Ensure email account created in cPanel
- Use correct IMAP/SMTP settings:
  - Incoming: mail.yourdomain.com Port 993 (SSL)
  - Outgoing: mail.yourdomain.com Port 465 (SSL)
- Check spam folder
- Password must match cPanel email password

### cPanel Login Issue
- Login via: Client Portal → Hosting → cPanel button (auto-login)
- Or direct: yourdomain.com:2083
- Username/password: Set during account creation

### Domain Not Pointing to Hosting
- Update nameservers at your domain registrar
- Noehost nameservers: ns1.noehost.com, ns2.noehost.com
- Wait 24-48 hours for propagation
- Or use Noehost DNS management if domain registered here

### Forgot cPanel Password
- Login to client portal → Hosting → change cPanel password
- Or contact support for reset

### Account Suspended
- Check for unpaid invoice in client portal
- Pay invoice to reactivate
- If paid, contact support

### How to Create a Database
1. cPanel → MySQL Databases
2. Create database → Create user → Add user to database
3. Give ALL PRIVILEGES
4. Use in WordPress: DB_HOST = localhost

### How to Upload Files
- cPanel → File Manager → public_html folder
- Or use FTP: FileZilla with cPanel FTP credentials
- FTP Host: yourdomain.com, Port: 21

### PHP Version Change
- cPanel → MultiPHP Manager → select PHP version
- Supported: 7.4, 8.0, 8.1, 8.2, 8.3

## UPGRADE/DOWNGRADE PLAN
- Login → Client Portal → Hosting → Upgrade button
- Prorated billing applied
- No downtime during upgrade

## CANCELLATION/REFUND
- 30-day money back guarantee (shared hosting)
- Submit cancellation from client portal
- Refund processed in 5-7 business days
- Email support@noehost.com for refund requests

## SUPPORT CHANNELS
- Live Chat: This chat (fastest response)
- Email: support@noehost.com
- WhatsApp: +92 3151711821
- Support Tickets: Client Portal → Support → New Ticket
- Response time: Live Chat < 5 min | Email < 4 hours

## UPTIME & PERFORMANCE
- 99.9% uptime SLA
- LiteSpeed web server
- NVMe SSD storage
- Cloudflare CDN integration
- Daily automated backups
- DDoS protection included

## SERVER LOCATIONS
- Primary: Pakistan data center
- CDN: Global Cloudflare network

=== END KNOWLEDGE BASE ===
`;

const BASE_SYSTEM = `You are NoeBot, the official AI Support Assistant for Noehost (noehost.com) — a premium Pakistani web hosting company.

PERSONALITY & TONE:
- Speak in a friendly mix of Roman Urdu and English (e.g., "Aapka domain register karne ke liye...")
- Be warm, helpful, professional
- Keep answers clear and actionable
- Use bullet points for step-by-step guides
- Always give specific prices, steps, and solutions

CAPABILITIES:
- Answer all questions about Noehost hosting plans, pricing, features
- Guide users step-by-step through technical issues
- Help with cPanel, WordPress, domains, emails, billing
- Explain how to place orders and navigate the client portal
- Troubleshoot common hosting problems

RULES:
- ALWAYS use the knowledge base below — it has all accurate pricing and info
- Give complete, helpful answers — not partial or vague
- For billing/account-specific issues, ask for their email first
- After 2 failed attempts to solve an issue, suggest "Talk to Human Agent"
- Never say you don't know if the answer is in the knowledge base

${NOEHOST_KNOWLEDGE}`;

const FALLBACK = "Sorry, abhi AI temporary issue hai. Aap 'Talk to Human Agent' button use kar sakte hain ya support@noehost.com pe email kar sakte hain.";

// ── Knowledge context from DB (dynamic plans etc.) ───────────────────────────
let _knowledgeCache = "";
let _knowledgeAt = 0;

async function buildKnowledgeContext(): Promise<string> {
  if (_knowledgeCache && Date.now() - _knowledgeAt < 5 * 60 * 1000) {
    return _knowledgeCache;
  }
  const parts: string[] = [];
  try {
    const plans = (await db.execute(sql`
      SELECT name, price, billing_cycle FROM hosting_plans ORDER BY price ASC LIMIT 15
    `)).rows as any[];
    if (plans.length) {
      parts.push("LIVE PLAN PRICES FROM DB: " + plans.map((p: any) => `${p.name} Rs.${p.price}/${p.billing_cycle ?? "mo"}`).join(" | "));
    }
  } catch { /* non-fatal */ }

  try {
    const docs = (await db.execute(sql`
      SELECT title, content FROM ai_training_docs WHERE is_active = true ORDER BY created_at DESC LIMIT 8
    `)).rows as any[];
    if (docs.length) {
      parts.push("\nADMIN TRAINING DOCS:");
      for (const d of docs as any[]) {
        parts.push(`• ${d.title}: ${String(d.content ?? "").slice(0, 200)}`);
      }
    }
  } catch { /* non-fatal */ }

  _knowledgeCache = parts.join("\n");
  _knowledgeAt = Date.now();
  return _knowledgeCache;
}

function getModel(extraContext: string) {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  const genai = new GoogleGenerativeAI(apiKey);
  const systemInstruction = extraContext
    ? `${BASE_SYSTEM}\n\n=== LIVE DB DATA ===\n${extraContext}`
    : BASE_SYSTEM;
  return genai.getGenerativeModel({
    model: "gemini-2.0-flash-lite",
    systemInstruction,
    generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
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
      ${opts.clientEmail ?? ""},
      ${opts.clientPhone ?? ""},
      ${opts.source ?? "website"},
      'ai',
      0,
      NOW(), NOW()
    )
    ON CONFLICT (session_id) DO NOTHING
  `);
  const [created] = (await db.execute(sql`
    SELECT * FROM chat_sessions WHERE session_id = ${sessionId} LIMIT 1
  `)).rows as any[];
  return created;
}

async function saveMessage(sessionId: string, role: "user" | "assistant" | "admin", content: string) {
  await db.execute(sql`
    INSERT INTO chat_messages (session_id, role, content, created_at)
    VALUES (${sessionId}, ${role}, ${content}, NOW())
  `);
  await db.execute(sql`
    UPDATE chat_sessions SET updated_at = NOW() WHERE session_id = ${sessionId}
  `);
}

async function getMessages(sessionId: string) {
  const rows = (await db.execute(sql`
    SELECT id, session_id, role, content, created_at
    FROM chat_messages
    WHERE session_id = ${sessionId}
    ORDER BY created_at ASC
    LIMIT 60
  `)).rows as any[];
  return rows;
}

// ── POST /chat/session ─────────────────────────────────────────────────────────
router.post("/chat/session", async (req, res) => {
  try {
    const { sessionId, clientName, clientEmail, clientPhone, source } = req.body;
    if (!sessionId) { res.status(400).json({ error: "sessionId required" }); return; }

    let userId: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const decoded = verifyToken(token) as any;
        if (decoded?.userId) userId = String(decoded.userId);
      } catch { /* not authenticated */ }
    }

    const session = await getOrCreateSession(sessionId, {
      userId,
      clientName: clientName || "Guest",
      clientEmail: clientEmail || "",
      clientPhone: clientPhone || "",
      source: source || "website",
    });

    const messages = await getMessages(sessionId);
    res.json({ session, messages });
  } catch (err) {
    console.error("[LIVE-CHAT] session error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── POST /chat/message ─────────────────────────────────────────────────────────
router.post("/chat/message", async (req, res) => {
  try {
    const { sessionId, message, clientName, clientEmail, clientPhone } = req.body;
    if (!sessionId || !message?.trim()) {
      res.status(400).json({ error: "sessionId and message required" });
      return;
    }

    await getOrCreateSession(sessionId, {
      clientName: clientName || "Guest",
      clientEmail: clientEmail || "",
      clientPhone: clientPhone || "",
      source: "website",
    });

    const [session] = (await db.execute(sql`
      SELECT status, failed_attempts FROM chat_sessions WHERE session_id = ${sessionId} LIMIT 1
    `)).rows as any[];

    if (session?.status === "closed") {
      res.status(400).json({ error: "Session is closed" }); return;
    }
    if (session?.status === "human") {
      await saveMessage(sessionId, "user", message.trim());
      res.json({ reply: null, status: "human", awaitingAgent: true });
      return;
    }

    await saveMessage(sessionId, "user", message.trim());

    const history = await getMessages(sessionId);
    const trimmed = history.slice(0, -1).slice(-30);

    const geminiHistory = trimmed
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content as string }],
      }));

    let reply = FALLBACK;
    let failedAttempts = Number(session?.failed_attempts ?? 0);

    const tryGemini = async (retryMs = 0): Promise<string | null> => {
      if (retryMs > 0) await new Promise(r => setTimeout(r, retryMs));
      const extraCtx = await buildKnowledgeContext();
      const model = getModel(extraCtx);
      const chat = model.startChat({ history: geminiHistory });
      const result = await chat.sendMessage(message.trim());
      return result.response.text() || null;
    };

    try {
      let text: string | null = null;
      try {
        text = await tryGemini();
      } catch (e: any) {
        const is429 = e?.message?.includes("429") || e?.status === 429;
        if (is429) {
          const match = e?.message?.match(/retry in (\d+)s/) || e?.message?.match(/retryDelay["\s:]+(\d+)s/);
          const waitMs = match ? Math.min(parseInt(match[1]) * 1000, 6000) : 3000;
          console.log(`[LIVE-CHAT] 429 — retrying after ${waitMs}ms`);
          text = await tryGemini(waitMs);
        } else {
          throw e;
        }
      }
      reply = text || FALLBACK;
      await db.execute(sql`
        UPDATE chat_sessions SET failed_attempts = 0, updated_at = NOW()
        WHERE session_id = ${sessionId}
      `);
    } catch (geminiErr: any) {
      console.error("[LIVE-CHAT] Gemini error:", geminiErr?.message?.slice(0, 150));
      failedAttempts += 1;
      await db.execute(sql`
        UPDATE chat_sessions SET failed_attempts = ${failedAttempts}, updated_at = NOW()
        WHERE session_id = ${sessionId}
      `);
    }

    await saveMessage(sessionId, "assistant", reply);

    let newStatus = session?.status ?? "ai";
    if (failedAttempts >= 3) {
      newStatus = "handover";
      await db.execute(sql`
        UPDATE chat_sessions SET status = 'handover', updated_at = NOW()
        WHERE session_id = ${sessionId}
      `);
      const sName = clientName || clientEmail || sessionId;
      sendWhatsAppAlert("handover_request",
        `🚨 *Live Chat Handover — Noehost*\n\nClient: ${sName}\nSession: ${sessionId}\nReason: AI failed 3 consecutive attempts\n\nPlease open Admin → Support → Live Support`
      ).catch(() => {});
    }

    res.json({ reply, status: newStatus, failedAttempts });
  } catch (err) {
    console.error("[LIVE-CHAT] message error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /chat/session/:id/messages ─────────────────────────────────────────────
router.get("/chat/session/:id/messages", async (req, res) => {
  try {
    const { id } = req.params;
    const messages = await getMessages(id);
    const [session] = (await db.execute(sql`
      SELECT * FROM chat_sessions WHERE session_id = ${id} LIMIT 1
    `)).rows as any[];
    res.json({ messages, session });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ── POST /chat/handover/:id ────────────────────────────────────────────────────
router.post("/chat/handover/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { clientName, clientEmail } = req.body;
    await db.execute(sql`
      UPDATE chat_sessions SET status = 'handover', updated_at = NOW()
      WHERE session_id = ${id}
    `);
    await saveMessage(id, "assistant",
      "✅ Aapki request receive ho gayi. Ek support agent jald hi aapke saath connect hoga. Neeche chat continue kar sakte hain."
    );
    sendWhatsAppAlert("handover_request",
      `🚨 *Live Chat Handover — Noehost*\n\nClient: ${clientName || "Guest"}\nEmail: ${clientEmail || "N/A"}\nSession: ${id}\n\nClient ne human agent request kiya.\n\nAdmin Panel → Support → Live Support`
    ).catch(() => {});
    res.json({ success: true, status: "handover" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ── ADMIN ROUTES ───────────────────────────────────────────────────────────────

router.get("/admin/live-chat/sessions", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { status } = req.query;
    const rows = (await db.execute(sql`
      SELECT
        s.*,
        (SELECT content FROM chat_messages WHERE session_id = s.session_id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT COUNT(*) FROM chat_messages WHERE session_id = s.session_id) as message_count
      FROM chat_sessions s
      ${status ? sql`WHERE s.status = ${String(status)}` : sql``}
      ORDER BY s.updated_at DESC
      LIMIT 100
    `)).rows;

    const stats = (await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('ai','handover','human')) as open,
        COUNT(*) FILTER (WHERE status = 'handover') as handover,
        COUNT(*) FILTER (WHERE status = 'human') as human,
        COUNT(*) as total
      FROM chat_sessions
    `)).rows[0] as any;

    res.json({ sessions: rows, stats });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/admin/live-chat/sessions/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const [session] = (await db.execute(sql`
      SELECT * FROM chat_sessions WHERE session_id = ${id} LIMIT 1
    `)).rows as any[];
    if (!session) { res.status(404).json({ error: "Session not found" }); return; }
    const messages = await getMessages(id);
    res.json({ session, messages });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/admin/live-chat/sessions/:id/reply", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    if (!message?.trim()) { res.status(400).json({ error: "message required" }); return; }
    await saveMessage(id, "admin", message.trim());
    await db.execute(sql`
      UPDATE chat_sessions SET status = 'human', updated_at = NOW()
      WHERE session_id = ${id} AND status != 'closed'
    `);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/admin/live-chat/sessions/:id/status", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const valid = ["ai", "handover", "human", "closed"];
    if (!valid.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }
    await db.execute(sql`
      UPDATE chat_sessions SET status = ${status}, updated_at = NOW()
      WHERE session_id = ${id}
    `);
    if (status === "closed") {
      await saveMessage(id, "assistant", "Session closed by support team. Thank you for contacting Noehost! 🙏");
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
