/**
 * Noehost Live Chat — Gemini powered support agent
 */

import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { authenticate, requireAdmin, verifyToken, type AuthRequest } from "../lib/auth.js";
import { sendWhatsAppAlert } from "../lib/whatsapp.js";
import { createNotification } from "../lib/notifications.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = "/tmp/noe-chat-uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

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

## SHARED HOSTING PLANS (CURRENT LIVE PRICES)
NOTE: Always use the live DB prices above if available. These are fallback prices.

1. Starter Plan — Rs. 270/month
   - Host 3 Websites, Free SSL Certificate, cPanel Access
   - 24/7 Customer Support, One-Click WordPress Install
   - 1 Free .com Domain, Free Site Migration
   - Best for: Beginners, personal sites, small blogs
   - Order: noehost.com/dashboard/orders/new

2. Geek Plan — Rs. 450/month (Popular)
   - Host 10 Websites, Free SSL, cPanel Access
   - Daily Backups, 24/7 Support, Free Domain
   - Best for: Freelancers, multiple websites
   - Order: noehost.com/dashboard/orders/new

3. Pro Plan — Rs. 650/month
   - Unlimited Websites, Priority Support, Daily Backups
   - Staging Environment, Node.js & Python Support, SSH Access
   - Free Domain, Free SSL, cPanel
   - Best for: Developers, growing businesses
   - Order: noehost.com/dashboard/orders/new

## WORDPRESS HOSTING PLANS (CURRENT LIVE PRICES)
1. WordPress Starter — Rs. 350/month — 1 WP site, 10 GB NVMe SSD, Free SSL & CDN
2. WordPress Pro — Rs. 550/month — 5 WP sites, 50 GB NVMe SSD, LiteSpeed Cache
3. WordPress Business — Rs. 750/month — 10 WP sites, 100 GB NVMe SSD, Staging
4. WordPress Geek — Rs. 950/month — Unlimited WP sites, Unlimited NVMe SSD

All WordPress plans include: Auto-updates, WP-CLI, LSCache Plugin, WP Admin auto-login from dashboard
Order: noehost.com/dashboard/orders/new

## RESELLER HOSTING
- Reseller Starter: Rs. 1200/month — WHM/cPanel, Up to 30 cPanel accounts, Free SSL for all
- White-label, custom nameservers, WHMCS billing integration available
- Order: noehost.com/dashboard/orders/new

## VPS (CLOUD VPS) PLANS
- VPS 1: Rs. 1500/month — 1 vCPU, 1 GB RAM, 25 GB SSD, 1 TB BW
- VPS 2: Rs. 2500/month — 2 vCPU, 2 GB RAM, 50 GB SSD, 2 TB BW
- VPS 3: Rs. 4000/month — 4 vCPU, 4 GB RAM, 100 GB SSD, 4 TB BW
- VPS 4: Rs. 7000/month — 8 vCPU, 8 GB RAM, 200 GB SSD, 8 TB BW
- Full root access, KVM virtualization, choice of Ubuntu / CentOS / Debian / AlmaLinux

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
- Client Portal: noehost.com/login
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
- Be warm, professional, and thorough
- ALWAYS give COMPLETE, DETAILED answers — never cut short or say "contact support" for things you can answer
- Use bullet points for step-by-step guides
- Include specific prices, plan names, features when plans are asked about
- Format plan comparisons as a clear table or list with all details

CAPABILITIES:
- Answer ALL questions about Noehost hosting plans, pricing, features from the live DB data below
- Give step-by-step technical guides for cPanel, WordPress, domains, emails, billing
- Explain how to place orders, access client portal, manage services
- Troubleshoot hosting problems with complete solutions
- Compare plans and recommend the best one based on user needs

RULES:
- ALWAYS use the LIVE PLAN DATA from DB first (it overrides the static knowledge below)
- When someone asks about plans or prices — list ALL relevant plans with prices AND features
- Give complete answers in one message — do NOT say "I'll explain further" or trail off
- For billing/account-specific issues (invoice, suspension, specific service), ask for their email
- NEVER mention or suggest "Talk to Human Agent" or "contact human support" in your replies — handle everything yourself
- NEVER tell the user to click any button or use any UI element — just answer the question
- If you cannot solve something, say "Please email support@noehost.com or WhatsApp +92 315 1711821"
- Never refuse to answer something that's in the knowledge base
- If asked to compare plans, give a full comparison table

TONE RULES (VERY IMPORTANT):
- Be professional like a senior support engineer
- Do NOT use excessive Roman Urdu — keep it mostly English, only light Urdu like "Aap ke liye" or "Bilkul!"
- No baby talk, no excessive exclamation marks
- Reply in a clean, organized format with sections when needed

IMPORTANT — PLAN SHARING:
When asked about plans, ALWAYS show:
1. Plan name
2. Price per month
3. Key features (websites, storage, bandwidth, special features)
4. Who it's best for
5. Order link: noehost.com/dashboard/orders/new

${NOEHOST_KNOWLEDGE}`;

const FALLBACK = "Abhi AI temporarily unavailable hai. Aap **Talk to Human Agent** button use karein ya 📧 support@noehost.com pe email karein. WhatsApp: +92 315 1711821";

// Simple keyword-based responses for when Gemini quota is exhausted
function keywordFallback(msg: string): string | null {
  const m = msg.toLowerCase();
  if (/cpanel|control panel|hosting panel/.test(m))
    return "cPanel access ke liye apna client area open karein → Hosting → cPanel Login. Ya seedha link: `https://your-domain.com:2083`";
  if (/ssl|https|certificate/.test(m))
    return "SSL install karne ke liye: Client Area → Hosting → SSL tab → Let's Encrypt Install button click karein. Free automatic SSL install ho jaata hai.";
  if (/domain.*transfer|transfer.*domain/.test(m))
    return "Domain transfer ke liye EPP/Auth code apne current registrar se lein, phir humari Domains page pe Transfer Domain option use karein. Process 5-7 din leta hai.";
  if (/invoice|billing|payment|pay/.test(m))
    return "Invoice aur billing ke liye: Client Area → Finance section. PayFast/bank transfer se pay kar sakte hain. Koi specific invoice chahiye to support@noehost.com pe email karein.";
  if (/password|reset.*pass|forgot/.test(m))
    return "Password reset ke liye: login page pe 'Forgot Password' option use karein. Email ayega jisme reset link hoga.";
  if (/wordpress|wp|install.*wp/.test(m))
    return "WordPress install karne ke liye: Client Area → Hosting → WordPress tab → Install WordPress button. 1-click install hai, bas domain aur admin details bhar dein.";
  if (/email.*account|create.*email|mail/.test(m))
    return "Email account banane ke liye: Client Area → Hosting → Email tab → Create Email Account. Format: name@yourdomain.com";
  if (/backup|restore/.test(m))
    return "Backup ke liye: Client Area → Hosting → Backups tab. Manual backup create kar sakte hain ya scheduled backup set kar sakte hain.";
  if (/dns|nameserver|ns1|ns2|a record|cname/.test(m))
    return "DNS management ke liye: Client Area → Hosting → Domains & DNS tab. A, CNAME, MX, TXT records add/edit kar sakte hain.";
  if (/suspend|block|disabled|access.*denied/.test(m))
    return "Agar account suspend hua hai, support@noehost.com pe email karein ya WhatsApp: +92 315 1711821. Reference number aur domain name zaroor mention karein.";
  if (/plan|upgrade|price|cost|pricing/.test(m))
    return "Hosting plans dekhne ke liye: noehost.com/shared-hosting. Upgrade ke liye Client Area → Services → Upgrade button.";
  if (/hello|hi|salam|assalam/.test(m))
    return "Salam! 👋 Noehost Support mein aapka swagat hai. Kisi bhi hosting, domain, billing ya technical masle mein madad ke liye likh saktay hain.";
  return null;
}

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
      SELECT name, description, price, billing_cycle, features FROM hosting_plans WHERE price > 0 ORDER BY price ASC LIMIT 20
    `)).rows as any[];
    if (plans.length) {
      parts.push("=== CURRENT LIVE HOSTING PLANS (from DB) ===");
      for (const p of plans) {
        const feats = Array.isArray(p.features) ? p.features.join(", ") : "";
        const desc = String(p.description ?? "").replace(/<[^>]+>/g, "").replace(/\r?\n/g, " ").trim().slice(0, 80);
        parts.push(`• ${p.name} — Rs.${p.price}/${p.billing_cycle ?? "month"}${desc ? " | " + desc : ""}${feats ? " | Features: " + feats : ""}`);
      }
      parts.push("=== END PLANS ===");
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

function getAI() {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  return new GoogleGenAI({ apiKey });
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

    // Build alternating user/model history — Gemini requires strict alternation
    const rawHistory = trimmed.filter((m: any) => m.role === "user" || m.role === "assistant");
    const chatHistory: { role: "user" | "model"; parts: { text: string }[] }[] = [];
    let lastRole: string | null = null;
    for (const m of rawHistory) {
      const role = m.role === "user" ? "user" : "model";
      if (role === lastRole) continue; // skip consecutive same-role messages
      chatHistory.push({ role, parts: [{ text: String(m.content ?? "") }] });
      lastRole = role;
    }
    // History must start with "user" message for Gemini
    while (chatHistory.length > 0 && chatHistory[0].role !== "user") {
      chatHistory.shift();
    }

    let reply = FALLBACK;
    let failedAttempts = Number(session?.failed_attempts ?? 0);

    // Models to try in order — fallback chain if quota exceeded on primary
    const MODEL_CHAIN = (process.env.AI_MODEL
      ? [process.env.AI_MODEL]
      : ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b"]
    );

    const tryModel = async (model: string): Promise<string | null> => {
      const extraCtx = await buildKnowledgeContext();
      const systemInstruction = extraCtx
        ? `${BASE_SYSTEM}\n\n=== LIVE DB DATA ===\n${extraCtx}`
        : BASE_SYSTEM;
      const ai = getAI();
      const chat = ai.chats.create({
        model,
        history: chatHistory,
        config: { systemInstruction, maxOutputTokens: 512, temperature: 0.7 },
      });
      const response = await chat.sendMessage({ message: message.trim() });
      return response.text || null;
    };

    try {
      let text: string | null = null;
      let lastErr: any = null;
      for (const model of MODEL_CHAIN) {
        try {
          text = await tryModel(model);
          if (text) { console.log(`[LIVE-CHAT] AI reply via ${model}`); break; }
        } catch (e: any) {
          lastErr = e;
          const is429 = e?.message?.includes("429") || e?.status === 429;
          const is404 = e?.message?.includes("404") || e?.message?.includes("not found") || e?.message?.includes("models/");
          if (is429 || is404) {
            console.warn(`[LIVE-CHAT] ${model} failed (${is429 ? "quota" : "not found"}), trying next model…`);
            continue; // try next model in chain
          }
          throw e; // non-recoverable error
        }
      }
      if (!text && lastErr) throw lastErr;
      reply = text || keywordFallback(message) || FALLBACK;
      await db.execute(sql`
        UPDATE chat_sessions SET failed_attempts = 0, updated_at = NOW()
        WHERE session_id = ${sessionId}
      `);
    } catch (geminiErr: any) {
      console.error("[LIVE-CHAT] Gemini error (all models failed):", geminiErr?.message?.slice(0, 150));
      // Try keyword fallback before giving up
      const kw = keywordFallback(message);
      if (kw) { reply = kw; }
      else {
        failedAttempts += 1;
        await db.execute(sql`
          UPDATE chat_sessions SET failed_attempts = ${failedAttempts}, updated_at = NOW()
          WHERE session_id = ${sessionId}
        `);
      }
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
      sendWhatsAppAlert("other",
        `🚨 *Live Chat Handover — Noehost*\n\nClient: ${sName}\nSession: ${sessionId}\nReason: AI failed 3 consecutive attempts\n\nPlease open Admin → Support → Live Chat`
      ).catch(() => {});
      createNotification("1", "system", "Live Chat Needs Agent",
        `AI could not resolve issue for ${sName}. Session: ${sessionId}`,
        "/admin/support",
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

// ── POST /chat/upload ─────────────────────────────────────────────────────────
router.post("/chat/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });
    const publicUrl = `/api/chat/files/${req.file.filename}`;
    res.json({ url: publicUrl, name: req.file.originalname, type: req.file.mimetype, size: req.file.size });
  } catch (err) {
    res.status(500).json({ error: "Upload failed" });
  }
});

// ── GET /chat/files/:filename ─────────────────────────────────────────────────
router.get("/chat/files/:filename", (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Not found" });
  res.sendFile(filePath);
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
    sendWhatsAppAlert("other",
      `🚨 *Live Chat Handover — Noehost*\n\nClient: ${clientName || "Guest"}\nEmail: ${clientEmail || "N/A"}\nSession: ${id}\n\nClient ne human agent request kiya.\n\nAdmin Panel → Support → Live Chat`
    ).catch(() => {});
    createNotification("1", "system", "Live Chat — Agent Requested",
      `${clientName || "Guest"} (${clientEmail || "N/A"}) ne human agent request kiya.`,
      "/admin/support",
    ).catch(() => {});
    res.json({ success: true, status: "handover" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ── ADMIN ROUTES ───────────────────────────────────────────────────────────────

router.get("/admin/live-chat/sessions", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { status, search } = req.query;
    const statusFilter = status && status !== "all" ? String(status) : null;
    const searchStr = search ? `%${String(search).toLowerCase()}%` : null;

    let rows: any[];
    if (statusFilter && searchStr) {
      rows = (await db.execute(sql`
        SELECT s.*,
          (SELECT content FROM chat_messages WHERE session_id = s.session_id ORDER BY created_at DESC LIMIT 1) as last_message,
          (SELECT COUNT(*) FROM chat_messages WHERE session_id = s.session_id) as message_count
        FROM chat_sessions s
        WHERE s.status = ${statusFilter}
          AND (LOWER(s.client_name) LIKE ${searchStr} OR LOWER(s.client_email) LIKE ${searchStr})
        ORDER BY s.updated_at DESC LIMIT 100
      `)).rows;
    } else if (statusFilter) {
      rows = (await db.execute(sql`
        SELECT s.*,
          (SELECT content FROM chat_messages WHERE session_id = s.session_id ORDER BY created_at DESC LIMIT 1) as last_message,
          (SELECT COUNT(*) FROM chat_messages WHERE session_id = s.session_id) as message_count
        FROM chat_sessions s
        WHERE s.status = ${statusFilter}
        ORDER BY s.updated_at DESC LIMIT 100
      `)).rows;
    } else if (searchStr) {
      rows = (await db.execute(sql`
        SELECT s.*,
          (SELECT content FROM chat_messages WHERE session_id = s.session_id ORDER BY created_at DESC LIMIT 1) as last_message,
          (SELECT COUNT(*) FROM chat_messages WHERE session_id = s.session_id) as message_count
        FROM chat_sessions s
        WHERE LOWER(s.client_name) LIKE ${searchStr} OR LOWER(s.client_email) LIKE ${searchStr}
        ORDER BY s.updated_at DESC LIMIT 100
      `)).rows;
    } else {
      rows = (await db.execute(sql`
        SELECT s.*,
          (SELECT content FROM chat_messages WHERE session_id = s.session_id ORDER BY created_at DESC LIMIT 1) as last_message,
          (SELECT COUNT(*) FROM chat_messages WHERE session_id = s.session_id) as message_count
        FROM chat_sessions s
        ORDER BY s.updated_at DESC LIMIT 100
      `)).rows;
    }

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
