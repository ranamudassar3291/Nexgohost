/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║   NOE — WhatsApp AI Admin Agent for Noehost                         ║
 * ║   Pakistan's most advanced hosting management agent                  ║
 * ║                                                                      ║
 * ║   Features:                                                          ║
 * ║   • Natural language understanding (no ! prefix needed)              ║
 * ║   • Gemini AI intent detection                                       ║
 * ║   • Multi-turn conversation state                                    ║
 * ║   • Domain check, client add, order create, activate, suspend       ║
 * ║   • AI-powered issue diagnosis with client-shareable fix steps       ║
 * ║   • Invoice sharing, renewal alerts, bulk client messaging           ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import dns from "dns/promises";
import { db } from "@workspace/db";
import {
  usersTable, hostingServicesTable, invoicesTable,
  ordersTable, hostingPlansTable, domainsTable, serversTable,
  settingsTable, ticketsTable, ticketMessagesTable,
} from "@workspace/db/schema";
import { eq, ilike, or, and, sql, desc, lte, gte, inArray } from "drizzle-orm";
import { hashPassword } from "./auth.js";
import { provisionHostingService } from "./provision.js";
import { processInvoicePaid } from "./activateInvoice.js";
import { suspendHostingAccount, unsuspendHostingAccount } from "./provision.js";
import {
  cpanelTerminate, cpanelInstallSSL, cpanelSaveFile,
  cpanelFullBackup, cpanelUapi, cpanelChangePassword,
} from "./cpanel.js";
import {
  emailOrderCreated, emailHostingCreated, emailWelcome,
  emailServiceSuspended, emailGeneric,
} from "./email.js";
import { sendToClientPhone, formatPKPhone, getPaymentInfo } from "./whatsapp.js";

// ── Conversation state (per admin session, 15-min TTL) ────────────────────────
interface ConvStep {
  intent: string;
  collected: Record<string, string>;
  missing: string[];
  ts: number;
}
const convMap = new Map<string, ConvStep>();

function getConv(jid: string): ConvStep | null {
  const c = convMap.get(jid);
  if (!c) return null;
  if (Date.now() - c.ts > 15 * 60 * 1000) { convMap.delete(jid); return null; }
  return c;
}
function setConv(jid: string, c: ConvStep) { convMap.set(jid, { ...c, ts: Date.now() }); }
function clearConv(jid: string) { convMap.delete(jid); }

// ── Gemini helper ─────────────────────────────────────────────────────────────
async function askGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.AI_MODEL || "gemini-2.0-flash";
  const resp = await ai.models.generateContent({ model, contents: prompt });
  return resp.text?.trim() ?? "";
}

// ── Intent detection via Gemini ───────────────────────────────────────────────
async function detectIntent(msg: string): Promise<{
  intent: string;
  domain?: string;
  email?: string;
  name?: string;
  phone?: string;
  password?: string;
  orderId?: string;
  planName?: string;
  issueDesc?: string;
  clientMsg?: string;
  invoiceId?: string;
  filterDays?: string;
  amount?: string;
  months?: string;
  price?: string;
  ticketId?: string;
  replyText?: string;
}> {
  const systemPrompt = `You are an intent classifier for a hosting company admin WhatsApp bot called "Noe".
Classify the admin's message into one of these intents and extract parameters.
Return ONLY valid JSON, no markdown, no explanation.

Intents:
- domain_check: Check if a domain is available. Extract: domain
- add_client: Create a new client account. Extract: name (full name), email, phone, password
- add_order: Create an order/service for a client. Extract: email (client email), domain, planName, amount (optional custom price in PKR, e.g. "4000 mein", "3500 ka order")
- add_domain: Register/add a domain for a client. Extract: email (client email), domain
- activate_order: Activate a pending order. Extract: orderId OR email OR domain
- suspend: Suspend a hosting service. Extract: email OR domain
- unsuspend: Unsuspend/reactivate a hosting service. Extract: email OR domain
- terminate_service: Permanently terminate/delete a hosting service. Extract: email OR domain
- extend_billing: Add months to a service billing period. Extract: email OR domain, months (number, e.g. "1 month"→"1", "3 mahine"→"3")
- update_plan_price: Change/update the price of a hosting plan. Extract: planName, price (new monthly price number), yearlyPrice (optional yearly price), quarterlyPrice (optional quarterly price)
- list_tickets: Show open support tickets. No params.
- reply_ticket: Reply to a support ticket. Extract: ticketId (ticket number e.g. TKT-123 or numeric ID), replyText (the reply content)
- client_info: Look up client details. Extract: email OR name OR phone OR domain
- system_status: Show system stats. No params.
- renewals: Show upcoming/overdue renewals. Extract: filterDays (optional, default "7")
- share_invoice: Share an invoice with client via WhatsApp. Extract: email OR invoiceId
- mark_invoice_paid: Mark an invoice as paid. Extract: invoiceId OR email (latest unpaid)
- fix_issue: Admin describes a client technical issue, generate fix steps. Extract: issueDesc, domain (optional), email (optional)
- ssl_install: Install/reinstall SSL certificate on a domain. Extract: domain
- wp_fix_404: Fix WordPress 404 / permalink errors by rewriting .htaccess. Extract: domain OR email
- reset_password: Reset cPanel account password. Extract: domain OR email, password (optional new password)
- site_check: Check if a website is up/down. Extract: domain
- create_backup: Create a full cPanel backup. Extract: domain OR email
- disk_usage: Check disk usage of a hosting account. Extract: domain OR email
- mark_paid: Mark an invoice as paid and activate service. Extract: invoiceId OR email
- send_message: Send a custom WhatsApp message to a client. Extract: email OR phone, clientMsg
- remind_all: Send renewal reminders to all due clients. Extract: filterDays (optional)
- help: Show help/commands. No params.
- unknown: Cannot classify.

Message: "${msg.replace(/"/g, "'")}"

Return JSON like: {"intent":"domain_check","domain":"example.com"}`;

  try {
    const raw = await askGemini(systemPrompt);
    const json = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    return JSON.parse(json);
  } catch {
    // Fallback: simple keyword matching
    const lower = msg.toLowerCase();
    if (/check.*domain|domain.*check|available|domain.*avail/.test(lower)) {
      const m = msg.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
      return { intent: "domain_check", domain: m?.[1] };
    }
    if (/add.*client|new.*client|create.*client|client.*add/.test(lower)) return { intent: "add_client" };
    if (/add.*domain|register.*domain|domain.*add/.test(lower)) return { intent: "add_domain" };
    if (/terminat|delete.*service|service.*delete|band karo|hatao/.test(lower)) return { intent: "terminate_service" };
    if (/extend|month.*add|add.*month|mahine.*add|add.*mahine|renew.*extend/.test(lower)) return { intent: "extend_billing" };
    if (/plan.*price|price.*update|price.*change|update.*price|price.*karo|plan.*update/.test(lower)) return { intent: "update_plan_price" };
    if (/tickets|ticket.*list|open.*ticket|ticket.*dikhao/.test(lower)) return { intent: "list_tickets" };
    if (/ticket.*reply|reply.*ticket|ticket.*ka.*reply/.test(lower)) return { intent: "reply_ticket" };
    if (/activat|live karo|activate/.test(lower)) return { intent: "activate_order" };
    if (/suspend/.test(lower)) return { intent: "suspend" };
    if (/unsuspend|reactivat|resume/.test(lower)) return { intent: "unsuspend" };
    if (/mark.*paid|paid.*mark|invoice.*paid/.test(lower)) return { intent: "mark_invoice_paid" };
    if (/info|details|client ka|client ki/.test(lower)) return { intent: "client_info" };
    if (/status|system|stats/.test(lower)) return { intent: "system_status" };
    if (/renewal|due|expire/.test(lower)) return { intent: "renewals" };
    if (/invoice.*share|share.*invoice|invoice.*send/.test(lower)) return { intent: "share_invoice" };
    if (/remind.*all|all.*remind|bulk.*remind/.test(lower)) return { intent: "remind_all" };
    if (/ssl.*install|ssl.*lagao|install.*ssl|ssl.*laga|certificate.*install/.test(lower)) {
      const m = msg.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/); return { intent: "ssl_install", domain: m?.[1] };
    }
    if (/404|wp.*fix|wordpress.*fix|htaccess|permalink|fix.*wp|fix.*wordpress/.test(lower)) {
      const emailM = msg.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
      const domainM = msg.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
      return { intent: "wp_fix_404", email: emailM?.[0], domain: domainM?.[1] };
    }
    if (/password.*reset|reset.*password|password.*badlo|password.*change|naya.*password/.test(lower)) {
      const emailM = msg.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
      const domainM = msg.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
      const passM = msg.match(/\b([A-Z][a-zA-Z0-9@#$!]{7,})\b/);
      return { intent: "reset_password", email: emailM?.[0], domain: domainM?.[1], password: passM?.[1] };
    }
    if (/site.*check|check.*site|website.*check|up.*down|site.*dekho/.test(lower)) {
      const m = msg.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/); return { intent: "site_check", domain: m?.[1] };
    }
    if (/backup.*lo|backup.*karo|create.*backup|full.*backup|backup.*banao/.test(lower)) {
      const emailM = msg.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
      const domainM = msg.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
      return { intent: "create_backup", email: emailM?.[0], domain: domainM?.[1] };
    }
    if (/disk.*usage|disk.*dekho|disk.*kitna|space.*check|storage.*check/.test(lower)) {
      const emailM = msg.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
      const domainM = msg.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
      return { intent: "disk_usage", email: emailM?.[0], domain: domainM?.[1] };
    }
    if (/invoice.*paid|paid.*karo|mark.*paid|payment.*received/.test(lower)) {
      const emailM = msg.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
      const invM = msg.match(/\b(NOE-\d+|\d{3,})\b/i);
      return { intent: "mark_paid", email: emailM?.[0], invoiceId: invM?.[1] };
    }
    if (/fix|issue|problem|error|masla|solve/.test(lower)) return { intent: "fix_issue" };
    if (/message|msg.*send|send.*msg|client.*ko.*bolo/.test(lower)) return { intent: "send_message" };
    if (/order.*add|add.*order|new.*order|create.*order/.test(lower)) {
      // Heuristic extraction for add_order in fallback path
      const emailM = msg.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
      const domainM = msg.match(/\b([a-zA-Z0-9-]+\.(com|net|org|pk|io|co))\b/);
      const amountM = msg.match(/(\d[\d,]*)\s*(mein|mein?|rs|pkr|rupee|rupees|ka order)?/i);
      return {
        intent: "add_order",
        email: emailM?.[0],
        domain: domainM?.[1],
        amount: amountM ? amountM[1].replace(/,/g, "") : undefined,
      };
    }
    if (/help|commands/.test(lower)) return { intent: "help" };
    return { intent: "unknown" };
  }
}

// ── Server config helper ──────────────────────────────────────────────────────
async function getServerConfig(serverId: string) {
  const [srv] = await db.select().from(serversTable).where(eq(serversTable.id, serverId)).limit(1);
  if (!srv?.hostname || !srv.apiToken) return null;
  return { hostname: srv.hostname, port: Number(srv.port ?? 2087), username: srv.username ?? "root", apiToken: srv.apiToken };
}

async function findServiceWithServer(identifier: string) {
  let service = await findService(identifier);
  if (!service) {
    const c = await findClient(identifier);
    if (c) service = await findServiceByEmail(c.email);
  }
  return service || null;
}

// ── CMD: SSL Install ──────────────────────────────────────────────────────────
async function cmdSslInstall(domain: string): Promise<string> {
  if (!domain) return "❌ Domain name batao. Example: *ssl install karo xyz.com*";
  const clean = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const service = await findServiceWithServer(clean);
  if (!service) return `❌ *${clean}* ki koi hosting service nahi mili. Domain check karo.`;
  if (!service.username) return `⚠️ *${clean}* ka cPanel username nahi hai. Service manually provision karein pehle.`;
  if (!service.serverId) return `⚠️ *${clean}* ka server nahi assign hua.`;

  const server = await getServerConfig(service.serverId);
  if (!server) return `❌ Server config incomplete hai. Admin → Servers check karo.`;

  try {
    await cpanelInstallSSL(server, clean);
    await db.update(hostingServicesTable).set({ sslStatus: "active", updatedAt: new Date() }).where(eq(hostingServicesTable.id, service.id));
    const [client] = await db.select().from(usersTable).where(eq(usersTable.id, service.clientId)).limit(1);
    if (client?.phone) {
      sendToClientPhone(client.phone,
        `🔒 *SSL Certificate Installed — Noehost*\n\n` +
        `Hi *${client.firstName}!*\n\n` +
        `Your website *${clean}* ka SSL certificate successfully install ho gaya hai! 🎉\n\n` +
        `✅ Website ab HTTPS se accessible hai: https://${clean}\n\n` +
        `_Noehost Team 🚀_`, "client_notification"
      ).catch(() => {});
    }
    return [
      `🔒 *SSL Installed Successfully!*\n`,
      `🌐 Domain: *${clean}*`,
      `👤 cPanel User: *${service.username}*`,
      `✅ Status: *HTTPS Active*`,
      `🔗 Visit: https://${clean}`,
      client?.phone ? `📲 Client notified via WhatsApp.` : `⚠️ No phone — notification skipped.`,
    ].join("\n");
  } catch (e: any) {
    return `❌ *SSL install failed* for ${clean}\n\nError: ${e.message}\n\n💡 Check DNS propagation — domain must point to your server.`;
  }
}

// ── CMD: WordPress 404 Fix ────────────────────────────────────────────────────
const WP_HTACCESS = `# BEGIN WordPress
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /
RewriteRule ^index\\.php$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.php [L]
</IfModule>
# END WordPress`;

async function cmdWpFix404(identifier: string): Promise<string> {
  if (!identifier) return "❌ Domain ya email batao. Example: *wp fix 404 xyz.com*";
  const service = await findServiceWithServer(identifier);
  if (!service) return `❌ *${identifier}* ki koi hosting service nahi mili.`;
  if (!service.username) return `⚠️ cPanel username missing. Service provision check karo.`;
  if (!service.serverId) return `⚠️ Server assign nahi hua.`;

  const server = await getServerConfig(service.serverId);
  if (!server) return `❌ Server config incomplete.`;

  const domain = service.domain || identifier;
  const htaccessPath = `/home/${service.username}/public_html/.htaccess`;

  try {
    await cpanelSaveFile(server, service.username, htaccessPath, WP_HTACCESS);
    const [client] = await db.select().from(usersTable).where(eq(usersTable.id, service.clientId)).limit(1);
    if (client?.phone) {
      sendToClientPhone(client.phone,
        `🔧 *WordPress 404 Fixed — Noehost*\n\n` +
        `Hi *${client.firstName}!*\n\n` +
        `Aapki website *${domain}* ka WordPress permalink issue fix ho gaya! ✅\n\n` +
        `Agar abhi bhi koi page 404 de raha hai to WordPress Dashboard → Settings → Permalinks → Save Changes karein.\n\n` +
        `_Noehost Team 🚀_`, "client_notification"
      ).catch(() => {});
    }
    return [
      `🔧 *WordPress 404 Fixed!*\n`,
      `🌐 Domain: *${domain}*`,
      `📁 File: public_html/.htaccess`,
      `✅ Standard WordPress rewrite rules written`,
      ``,
      `💡 Agar abhi bhi 404 aaye: WordPress → Settings → Permalinks → Save`,
      client?.phone ? `📲 Client notified.` : `⚠️ No phone — notification skipped.`,
    ].join("\n");
  } catch (e: any) {
    return `❌ .htaccess update failed: ${e.message}`;
  }
}

// ── CMD: Reset cPanel Password ────────────────────────────────────────────────
async function cmdResetPassword(identifier: string, newPass?: string): Promise<string> {
  if (!identifier) return "❌ Domain ya email batao. Example: *reset password xyz.com NewPass@123*";
  const service = await findServiceWithServer(identifier);
  if (!service) return `❌ *${identifier}* ki koi hosting service nahi mili.`;
  if (!service.username) return `⚠️ cPanel username missing.`;
  if (!service.serverId) return `⚠️ Server nahi assign hua.`;

  const server = await getServerConfig(service.serverId);
  if (!server) return `❌ Server config incomplete.`;

  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#!";
  const generatedPass = newPass && newPass.length >= 8
    ? newPass
    : Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

  try {
    await cpanelChangePassword(server, service.username, generatedPass);
    const [client] = await db.select().from(usersTable).where(eq(usersTable.id, service.clientId)).limit(1);
    if (client?.phone) {
      sendToClientPhone(client.phone,
        `🔑 *cPanel Password Updated — Noehost*\n\n` +
        `Hi *${client.firstName}!*\n\n` +
        `Aapka cPanel password reset ho gaya hai.\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🌐 Domain: *${service.domain || identifier}*\n` +
        `👤 Username: *${service.username}*\n` +
        `🔑 New Password: *${generatedPass}*\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `🔗 cPanel Login: ${service.cpanelUrl || `https://${server.hostname}:2083`}\n\n` +
        `⚠️ Yeh message save kar lein!\n` +
        `_Noehost Team 🚀_`, "client_notification"
      ).catch(() => {});
    }
    return [
      `🔑 *Password Reset Successful!*\n`,
      `🌐 Domain: *${service.domain || identifier}*`,
      `👤 cPanel User: *${service.username}*`,
      `🔑 New Password: *${generatedPass}*`,
      `🔗 cPanel: ${service.cpanelUrl || `https://${server.hostname}:2083`}`,
      ``,
      client?.phone ? `📲 New credentials sent to client via WhatsApp!` : `⚠️ No phone — WhatsApp not sent. Share manually.`,
    ].join("\n");
  } catch (e: any) {
    return `❌ Password reset failed: ${e.message}`;
  }
}

// ── CMD: Site Check ───────────────────────────────────────────────────────────
async function cmdSiteCheck(domain: string): Promise<string> {
  if (!domain) return "❌ Domain batao. Example: *site check karo xyz.com*";
  const clean = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const url = `https://${clean}`;
  const start = Date.now();

  try {
    const resp = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "NoeAgent-SiteCheck/1.0" },
    });
    const ms = Date.now() - start;
    const finalUrl = resp.url !== url ? `\n🔀 Redirected to: ${resp.url}` : "";
    const speed = ms < 500 ? "⚡ Excellent" : ms < 1500 ? "✅ Good" : ms < 3000 ? "🟡 Slow" : "🔴 Very Slow";

    return [
      `🌐 *Site Check: ${clean}*\n`,
      `━━━━━━━━━━━━━━━━━━`,
      `✅ *Status: ONLINE*`,
      `📊 HTTP Code: *${resp.status} ${resp.statusText}*`,
      `⏱️ Response Time: *${ms}ms* — ${speed}`,
      finalUrl,
      `━━━━━━━━━━━━━━━━━━`,
      `🕐 Checked: ${new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}`,
    ].filter(Boolean).join("\n");
  } catch (e: any) {
    const ms = Date.now() - start;
    const reason = e.name === "TimeoutError" ? "Request timed out (>10s)" : e.message;
    return [
      `🌐 *Site Check: ${clean}*\n`,
      `━━━━━━━━━━━━━━━━━━`,
      `❌ *Status: OFFLINE / UNREACHABLE*`,
      `⏱️ Time: *${ms}ms*`,
      `❗ Reason: ${reason}`,
      `━━━━━━━━━━━━━━━━━━`,
      `💡 Check: DNS propagation, server status, or firewall rules.`,
    ].join("\n");
  }
}

// ── CMD: Create Backup ────────────────────────────────────────────────────────
async function cmdCreateBackup(identifier: string): Promise<string> {
  if (!identifier) return "❌ Domain ya email batao. Example: *backup karo xyz.com*";
  const service = await findServiceWithServer(identifier);
  if (!service) return `❌ *${identifier}* ki koi hosting service nahi mili.`;
  if (!service.username) return `⚠️ cPanel username missing.`;
  if (!service.serverId) return `⚠️ Server nahi assign hua.`;

  const server = await getServerConfig(service.serverId);
  if (!server) return `❌ Server config incomplete.`;

  try {
    const result = await cpanelFullBackup(server, service.username);
    const ts = new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" });
    return [
      `📦 *Backup ${result.status === "initiated" ? "Started" : "Done"}!*\n`,
      `🌐 Domain: *${service.domain || identifier}*`,
      `👤 cPanel User: *${service.username}*`,
      `📋 Status: *${result.status.toUpperCase()}*`,
      `📝 ${result.message}`,
      `🕐 Time: ${ts}`,
    ].join("\n");
  } catch (e: any) {
    return `❌ Backup failed: ${e.message}`;
  }
}

// ── CMD: Disk Usage ───────────────────────────────────────────────────────────
async function cmdDiskUsage(identifier: string): Promise<string> {
  if (!identifier) return "❌ Domain ya email batao. Example: *disk usage dekho xyz.com*";
  const service = await findServiceWithServer(identifier);
  if (!service) return `❌ *${identifier}* ki koi hosting service nahi mili.`;
  if (!service.username) return `⚠️ cPanel username missing.`;
  if (!service.serverId) return `⚠️ Server nahi assign hua.`;

  const server = await getServerConfig(service.serverId);
  if (!server) return `❌ Server config incomplete.`;

  try {
    const qd = await cpanelUapi(server, service.username, "Quota", "get_quota_info");
    const data = qd ?? {};

    const usedBytes = Number(data.bytes_used ?? data.quota_bytes_used ?? data.used ?? data.diskused ?? 0);
    const limitBytes = Number(data.bytes_limit ?? data.quota_bytes_limit ?? data.limit ?? data.disklimit ?? 0);
    const usedMB = usedBytes > 0 ? (usedBytes / 1048576).toFixed(1) : (Number(service.diskUsage ?? 0)).toFixed(1);
    const limitMB = limitBytes > 0 ? (limitBytes / 1048576).toFixed(0) : Number(service.diskLimit ?? 0);
    const pct = limitBytes > 0 ? Math.round((usedBytes / limitBytes) * 100) : 0;
    const filled = Math.round(pct / 10);
    const bar = "█".repeat(filled) + "░".repeat(10 - filled);
    const alert = pct >= 90 ? `\n⚠️ *CRITICAL: ${pct}% full! Clean files ya upgrade plan karo!*`
      : pct >= 75 ? `\n🟡 *Warning: ${pct}% used. Monitor closely.*` : "";

    return [
      `💾 *Disk Usage: ${service.domain || identifier}*\n`,
      `━━━━━━━━━━━━━━━━━━`,
      `👤 cPanel User: *${service.username}*`,
      `📊 Used: *${usedMB} MB* ${limitMB ? `/ ${limitMB} MB` : "(unlimited)"}`,
      limitMB ? `📈 [${bar}] ${pct}%` : "",
      alert,
      `━━━━━━━━━━━━━━━━━━`,
      `🕐 ${new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}`,
    ].filter(Boolean).join("\n");
  } catch (e: any) {
    const fallbackUsed = Number(service.diskUsage ?? 0).toFixed(1);
    const fallbackLimit = Number(service.diskLimit ?? 0);
    return [
      `💾 *Disk Usage: ${service.domain || identifier}*\n`,
      `👤 cPanel User: *${service.username}*`,
      `📊 Used (DB record): *${fallbackUsed} MB*${fallbackLimit ? ` / ${fallbackLimit} MB` : ""}`,
      `⚠️ Live UAPI call failed: ${e.message}`,
    ].join("\n");
  }
}

// ── CMD: Mark Invoice Paid ────────────────────────────────────────────────────
async function cmdMarkPaid(data: { invoiceId?: string; email?: string }): Promise<string> {
  let invoice: any = null;
  let client: any = null;

  if (data.invoiceId) {
    const id = data.invoiceId.replace(/^NOE-/i, "");
    [invoice] = await db.select().from(invoicesTable)
      .where(or(eq(invoicesTable.id, data.invoiceId), ilike(invoicesTable.invoiceNumber, `%${id}%`))).limit(1);
  }
  if (!invoice && data.email) {
    client = await findClient(data.email);
    if (client) {
      [invoice] = await db.select().from(invoicesTable)
        .where(and(
          eq(invoicesTable.clientId, client.id),
          or(eq(invoicesTable.status, "unpaid"), eq(invoicesTable.status, "overdue")),
        )).orderBy(desc(invoicesTable.createdAt)).limit(1);
    }
  }

  if (!invoice) return `❌ Invoice nahi mila. Invoice number (e.g. NOE-02341) ya client email batao.`;
  if (invoice.status === "paid") return `✅ Invoice *${invoice.invoiceNumber}* already paid hai!`;

  if (!client) {
    [client] = await db.select().from(usersTable).where(eq(usersTable.id, invoice.clientId)).limit(1);
  }

  const txnRef = `WA-AGENT-${Date.now()}`;
  let activationStatus = "Not triggered (no linked order)";

  try {
    const result = await processInvoicePaid(invoice.id, txnRef, "Marked paid via Noe WhatsApp Agent");
    activationStatus = result ? "✅ Service activated/updated!" : "ℹ️ processInvoicePaid returned null";
  } catch (e: any) {
    activationStatus = `⚠️ Activation error: ${e.message.slice(0, 60)}`;
  }

  if (client?.phone) {
    sendToClientPhone(client.phone,
      `✅ *Payment Received — Noehost*\n\n` +
      `Hi *${client?.firstName || "Client"}!*\n\n` +
      `Aapka payment receive ho gaya hai. Shukriya! 🙏\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🧾 Invoice: *${invoice.invoiceNumber}*\n` +
      `💰 Amount: *PKR ${Number(invoice.total).toLocaleString()}*\n` +
      `📌 Status: *PAID ✅*\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `Aapki service activate ho rahi hai. Thodi der mein ready ho jaye gi.\n\n` +
      `_Noehost Team 🚀_`, "client_notification"
    ).catch(() => {});
  }

  return [
    `✅ *Invoice Marked PAID!*\n`,
    `🧾 Invoice: *${invoice.invoiceNumber}*`,
    `👤 Client: ${client ? `${client.firstName} (${client.email})` : invoice.clientId}`,
    `💰 Amount: *PKR ${Number(invoice.total).toLocaleString()}*`,
    `🔖 TXN Ref: ${txnRef}`,
    ``,
    `⚡ Activation: ${activationStatus}`,
    client?.phone ? `📲 Client notified via WhatsApp.` : `⚠️ No phone — WhatsApp not sent.`,
  ].join("\n");
}

// ── Domain availability check (DNS + TLD list) ────────────────────────────────
async function checkDomainAvailability(domain: string): Promise<{ available: boolean; method: string }> {
  try {
    await dns.lookup(domain);
    return { available: false, method: "dns" };
  } catch (e: any) {
    if (e.code === "ENOTFOUND") return { available: true, method: "dns" };
  }
  return { available: false, method: "dns" };
}

async function cmdDomainCheck(domain: string): Promise<string> {
  if (!domain) return "❌ Domain name batao. Example: *check domain kalahost.com*";
  const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, "");
  const tlds = cleanDomain.includes(".") ? [cleanDomain]
    : [cleanDomain + ".com", cleanDomain + ".net", cleanDomain + ".pk", cleanDomain + ".org", cleanDomain + ".store"];

  const lines = [`🔍 *Domain Availability Check*\n`];
  for (const d of tlds) {
    const { available } = await checkDomainAvailability(d);
    lines.push(available ? `✅ *${d}* — Available! 🎉` : `❌ *${d}* — Taken`);
  }

  // Also check DB (already registered with us)
  const [existing] = await db.select({ id: domainsTable.id }).from(domainsTable)
    .where(ilike(domainsTable.domain, `%${cleanDomain}%`)).limit(1);
  if (existing) lines.push(`\n⚠️ Note: This domain is already in your system.`);

  lines.push(`\n📝 To register: *add domain [email] [domain]*`);
  return lines.join("\n");
}

// ── Find client by email/name/phone/domain ────────────────────────────────────
async function findClient(identifier: string) {
  if (!identifier) return null;
  const trimmed = identifier.trim();
  const [byEmail] = await db.select().from(usersTable)
    .where(ilike(usersTable.email, trimmed)).limit(1);
  if (byEmail) return byEmail;
  const [byPhone] = await db.select().from(usersTable)
    .where(ilike(usersTable.phone, `%${trimmed.replace(/\D/g, "").slice(-9)}%`)).limit(1);
  if (byPhone) return byPhone;
  const byDomain = await db.select({ clientId: hostingServicesTable.clientId })
    .from(hostingServicesTable).where(ilike(hostingServicesTable.domain, trimmed)).limit(1);
  if (byDomain[0]) {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, byDomain[0].clientId)).limit(1);
    if (u) return u;
  }
  const names = await db.select().from(usersTable).where(or(
    ilike(usersTable.firstName, `%${trimmed}%`),
    ilike(usersTable.lastName, `%${trimmed}%`),
    sql`concat(first_name, ' ', last_name) ILIKE ${"%" + trimmed + "%"}`,
  )!).limit(1);
  return names[0] || null;
}

// ── Find hosting service ──────────────────────────────────────────────────────
async function findService(identifier: string) {
  const [byDomain] = await db.select().from(hostingServicesTable)
    .where(ilike(hostingServicesTable.domain, identifier.trim())).limit(1);
  if (byDomain) return byDomain;
  const [byId] = await db.select().from(hostingServicesTable)
    .where(eq(hostingServicesTable.id, identifier.trim())).limit(1);
  return byId || null;
}

async function findServiceByEmail(email: string) {
  const client = await findClient(email);
  if (!client) return null;
  const [svc] = await db.select().from(hostingServicesTable)
    .where(eq(hostingServicesTable.clientId, client.id))
    .orderBy(desc(hostingServicesTable.createdAt)).limit(1);
  return svc || null;
}

// ── Generate invoice number ───────────────────────────────────────────────────
async function genInvNumber(): Promise<string> {
  await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS inv_seq START WITH 2001`);
  const r = await db.execute(sql`SELECT nextval('inv_seq') AS seq`);
  const seq = Number((r.rows[0] as any).seq);
  return `NOE-${String(seq).padStart(5, "0")}`;
}

// ── CMD: Add client ───────────────────────────────────────────────────────────
async function cmdAddClient(data: { name?: string; email?: string; phone?: string; password?: string }): Promise<string> {
  const { name = "", email = "", phone = "", password = "" } = data;
  if (!email || !name) return "❌ Name aur email zaruri hai.";

  const parts = name.trim().split(/\s+/);
  const firstName = parts[0] || name;
  const lastName = parts.slice(1).join(" ") || "";
  const genPass = password || `Noe@${Math.random().toString(36).slice(2, 8)}`;
  const existingUser = await db.select({ id: usersTable.id }).from(usersTable)
    .where(ilike(usersTable.email, email.trim())).limit(1);
  if (existingUser.length > 0) {
    return `⚠️ *${email}* already registered hai!\nUse: *info ${email}* for details.`;
  }

  const hashed = await hashPassword(genPass);
  const [user] = await db.insert(usersTable).values({
    firstName, lastName, email: email.toLowerCase().trim(),
    passwordHash: hashed,
    phone: phone || null, role: "client", status: "active",
    emailVerified: true,
  }).returning();

  emailWelcome(user.email, {
    clientName: `${firstName} ${lastName}`.trim(),
    dashboardUrl: `${process.env.CLIENT_AREA_URL ?? "https://noehost.com"}/dashboard`,
  }).catch(() => {});

  if (phone) {
    const payInfo = await getPaymentInfo();
    const paySection = payInfo ? `\n\n💳 *Payment Info:*\n${payInfo}` : "";
    sendToClientPhone(phone,
      `🎉 *Welcome to Noehost!*\n\n` +
      `Hi *${firstName}!*\n\n` +
      `Your account has been created successfully.\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📧 Email: *${user.email}*\n` +
      `🔑 Password: *${genPass}*\n` +
      `🔗 Login: noehost.com/login\n` +
      `━━━━━━━━━━━━━━━━━━${paySection}\n\n` +
      `_Noehost Team — Welcome aboard! 🚀_`,
      "client_notification"
    ).catch(() => {});
  }

  return [
    `✅ *Client Created Successfully!*\n`,
    `👤 Name: *${[firstName, lastName].filter(Boolean).join(' ')}*`,
    `📧 Email: *${user.email}*`,
    `📱 Phone: ${phone ? formatPKPhone(phone) : "—"}`,
    `🔑 Password: *${genPass}*`,
    `🆔 Client ID: ${user.id.slice(0, 8).toUpperCase()}`,
    ``,
    `📧 Welcome email sent!`,
    phone ? `📲 WhatsApp welcome message sent!` : `⚠️ No phone — WhatsApp not sent.`,
    ``,
    `📝 To add a service: *order add ${email} domain.com*`,
  ].join("\n");
}

// ── CMD: Add order (domain + hosting) ────────────────────────────────────────
async function cmdAddOrder(data: { email?: string; domain?: string; planName?: string; amount?: string }): Promise<string> {
  const { email, domain, planName } = data;
  const customAmount = data.amount ? parseFloat(data.amount.replace(/[^0-9.]/g, "")) : null;
  if (!email) return "❌ Client email batao.";

  const client = await findClient(email);
  if (!client) return `❌ Client *${email}* nahi mila. Pehle: *add client ${email}*`;

  // Find plan
  let plan = null;
  if (planName) {
    const [p] = await db.select().from(hostingPlansTable)
      .where(ilike(hostingPlansTable.name, `%${planName}%`)).limit(1);
    plan = p;
  }
  if (!plan) {
    const [p] = await db.select().from(hostingPlansTable)
      .where(eq(hostingPlansTable.isActive, true)).orderBy(hostingPlansTable.price).limit(1);
    plan = p;
  }

  const amount = customAmount && customAmount > 0 ? customAmount : (plan ? Number(plan.price) : 0);
  const itemName = plan?.name ?? planName ?? "Hosting Package";

  const [order] = await db.insert(ordersTable).values({
    clientId: client.id, type: "hosting",
    itemId: plan?.id ?? null, itemName,
    amount: String(amount), status: "pending",
    domain: domain || null,
  }).returning();

  // Create invoice
  const invNumber = await genInvNumber();
  const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 7);
  const [invoice] = await db.insert(invoicesTable).values({
    invoiceNumber: invNumber, clientId: client.id, orderId: order.id,
    status: "unpaid", total: String(amount), dueDate,
    notes: domain ? `Service: ${domain}` : undefined,
  }).returning();

  // Update order with invoice
  await db.update(ordersTable).set({ invoiceId: invoice.id }).where(eq(ordersTable.id, order.id));

  const clientName = `${client.firstName} ${client.lastName ?? ""}`.trim();
  const payInfo = await getPaymentInfo();
  const paySection = payInfo ? `\n\n💳 *Payment Details:*\n${payInfo}` : "";
  const dashUrl = process.env.CLIENT_AREA_URL ?? "https://noehost.com/dashboard";

  // Email
  emailOrderCreated(client.email, {
    clientName, serviceName: itemName,
    domain: domain || "", orderId: order.id.slice(0, 8).toUpperCase(),
  }).catch(() => {});

  // WhatsApp to client
  if (client.phone) {
    sendToClientPhone(client.phone,
      `📦 *New Order — Noehost*\n\n` +
      `Hi *${client.firstName}!*\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📋 *Order Details*\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🆔 Order: *#${order.id.slice(0, 8).toUpperCase()}*\n` +
      `🧾 Invoice: *${invNumber}*\n` +
      (domain ? `🌐 Domain: *${domain}*\n` : "") +
      `📦 Plan: *${itemName}*\n` +
      `💰 Amount: *PKR ${amount.toLocaleString()}*\n` +
      `📅 Due: *${dueDate.toLocaleDateString("en-PK")}*\n` +
      `━━━━━━━━━━━━━━━━━━` +
      paySection + `\n\n` +
      `✅ Service will be activated after payment.\n` +
      `🔗 Dashboard: ${dashUrl}\n\n` +
      `_Noehost Team 🚀_`,
      "client_notification"
    ).catch(() => {});
  }

  return [
    `✅ *Order Created!*\n`,
    `👤 Client: *${clientName}*`,
    `📧 Email: ${client.email}`,
    `📱 Phone: ${client.phone ? formatPKPhone(client.phone) : "—"}`,
    ``,
    `🆔 Order ID: *#${order.id.slice(0, 8).toUpperCase()}*`,
    `🧾 Invoice: *${invNumber}*`,
    domain ? `🌐 Domain: *${domain}*` : "",
    `📦 Plan: *${itemName}*`,
    `💰 Amount: *PKR ${amount.toLocaleString()}*${customAmount && customAmount > 0 ? " _(Custom Price)_" : ""}`,
    `📅 Due Date: ${dueDate.toLocaleDateString("en-PK")}`,
    ``,
    `📧 Order email sent!`,
    client.phone ? `📲 WhatsApp invoice sent to client!` : `⚠️ No phone on file — WhatsApp not sent.`,
    ``,
    `📝 To activate: *activate order #${order.id.slice(0, 8).toUpperCase()}*`,
  ].filter(Boolean).join("\n");
}

// ── CMD: Add domain ───────────────────────────────────────────────────────────
async function cmdAddDomain(data: { email?: string; domain?: string }): Promise<string> {
  const { email, domain } = data;
  if (!email) return "❌ Client email batao.";
  if (!domain) return "❌ Domain name batao.";

  const client = await findClient(email);
  if (!client) return `❌ Client *${email}* nahi mila. Pehle: *add client ${email}*`;

  const cleanDomain = domain.toLowerCase().trim();
  const dotIdx = cleanDomain.indexOf(".");
  const domainName = dotIdx > 0 ? cleanDomain.substring(0, dotIdx) : cleanDomain;
  const tld = dotIdx > 0 ? cleanDomain.substring(dotIdx) : ".com";

  const existing = await db.select({ id: domainsTable.id }).from(domainsTable)
    .where(and(
      ilike(domainsTable.domain, domainName),
      ilike(domainsTable.tld, tld),
    )).limit(1);
  if (existing.length > 0) return `⚠️ Domain *${cleanDomain}* already in system!`;

  const expiryDate = new Date(); expiryDate.setFullYear(expiryDate.getFullYear() + 1);
  const invNumber = await genInvNumber();
  const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 7);

  const [domainRecord] = await db.insert(domainsTable).values({
    clientId: client.id, domain: domainName, tld,
    status: "pending", registrationDate: new Date(), expiryDate,
    ns1: "ns1.noehost.com", ns2: "ns2.noehost.com",
  }).returning();

  const [invoice] = await db.insert(invoicesTable).values({
    invoiceNumber: invNumber, clientId: client.id,
    status: "unpaid", total: "1500", dueDate,
    notes: `Domain registration: ${cleanDomain}`,
  }).returning();

  const clientName = `${client.firstName} ${client.lastName ?? ""}`.trim();
  const payInfo = await getPaymentInfo();
  const paySection = payInfo ? `\n\n💳 *Payment Details:*\n${payInfo}` : "";

  if (client.phone) {
    sendToClientPhone(client.phone,
      `🔤 *Domain Order — Noehost*\n\n` +
      `Hi *${client.firstName}!*\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🌐 Domain: *${cleanDomain}*\n` +
      `🧾 Invoice: *${invNumber}*\n` +
      `💰 Amount: *PKR 1,500*\n` +
      `📅 Due: *${dueDate.toLocaleDateString("en-PK")}*\n` +
      `━━━━━━━━━━━━━━━━━━` +
      paySection + `\n\n` +
      `✅ Domain will be registered after payment.\n\n` +
      `_Noehost Team 🚀_`,
      "client_notification"
    ).catch(() => {});
  }

  return [
    `✅ *Domain Order Created!*\n`,
    `🌐 Domain: *${cleanDomain}*`,
    `👤 Client: *${clientName}*`,
    `📧 Email: ${client.email}`,
    ``,
    `🧾 Invoice: *${invNumber}*`,
    `💰 Amount: *PKR 1,500*`,
    `📅 Due: ${dueDate.toLocaleDateString("en-PK")}`,
    ``,
    client.phone ? `📲 WhatsApp invoice sent to client!` : `⚠️ No phone — WhatsApp not sent.`,
    ``,
    `📝 Register after payment: *activate domain ${cleanDomain}*`,
  ].join("\n");
}

// ── CMD: Activate order ───────────────────────────────────────────────────────
async function cmdActivateOrder(data: { orderId?: string; email?: string; domain?: string }, sock: any, adminJid: string): Promise<string> {
  let order = null;
  const id = data.orderId?.replace(/^#/, "");

  if (id) {
    const [o] = await db.select().from(ordersTable)
      .where(or(
        sql`upper(left(id::text, 8)) = ${id.toUpperCase()}`,
        eq(ordersTable.id, id),
      )).limit(1);
    order = o;
  }
  if (!order && data.email) {
    const client = await findClient(data.email);
    if (client) {
      const [o] = await db.select().from(ordersTable)
        .where(and(eq(ordersTable.clientId, client.id), eq(ordersTable.status, "pending")))
        .orderBy(desc(ordersTable.createdAt)).limit(1);
      order = o;
    }
  }
  if (!order && data.domain) {
    const [o] = await db.select().from(ordersTable)
      .where(and(
        ilike(ordersTable.domain, data.domain),
        or(eq(ordersTable.status, "pending"), eq(ordersTable.status, "approved")),
      )).limit(1);
    order = o;
  }

  if (!order) return `❌ Order nahi mila. Order ID, email ya domain batao.`;
  if (order.status === "approved") return `✅ Order *#${order.id.slice(0, 8).toUpperCase()}* already active hai.`;

  const [client] = await db.select().from(usersTable).where(eq(usersTable.id, order.clientId)).limit(1);
  if (!client) return `❌ Client nahi mila for order #${order.id.slice(0, 8).toUpperCase()}`;

  // Acknowledge immediately
  if (sock) {
    await sock.sendMessage(adminJid, {
      text: `⏳ *Activating order #${order.id.slice(0, 8).toUpperCase()}...*\n\nProvisioning cPanel account... please wait.`,
    });
  }

  let serviceId: string | null = null;
  let provisionResult: any = null;

  if (order.type === "hosting") {
    let [svc] = await db.select().from(hostingServicesTable)
      .where(eq(hostingServicesTable.orderId, order.id)).limit(1);

    if (!svc && order.itemId) {
      const months = order.billingCycle === "yearly" ? 12 : order.billingCycle === "quarterly" ? 3 : 1;
      const nextDue = new Date(); nextDue.setMonth(nextDue.getMonth() + months);
      const [ns] = await db.insert(hostingServicesTable).values({
        clientId: order.clientId, orderId: order.id,
        planId: order.itemId, planName: order.itemName,
        domain: order.domain || null,
        status: "pending" as any,
        billingCycle: order.billingCycle || "monthly",
        nextDueDate: nextDue,
      }).returning();
      svc = ns;
    }

    if (svc) {
      serviceId = svc.id;
      try {
        provisionResult = await provisionHostingService(svc.id);
      } catch (e: any) {
        console.warn("[NOE-AGENT] provision error:", e.message);
      }
    }
  }

  // Mark invoice paid
  let invoiceId = order.invoiceId;
  if (!invoiceId) {
    const invNumber = await genInvNumber();
    const [inv] = await db.insert(invoicesTable).values({
      invoiceNumber: invNumber, clientId: order.clientId, orderId: order.id,
      status: "unpaid", total: order.amount,
    }).returning();
    invoiceId = inv.id;
  }

  await db.update(ordersTable).set({
    status: "approved", paymentStatus: "paid", invoiceId, updatedAt: new Date(),
  }).where(eq(ordersTable.id, order.id));

  processInvoicePaid(invoiceId, `WA-AGENT-${Date.now()}`, "Activated via Noe WhatsApp Agent").catch(() => {});

  // Fetch final service + server
  const svcFinal = serviceId
    ? await db.select().from(hostingServicesTable).where(eq(hostingServicesTable.id, serviceId)).limit(1).then((r: any[]) => r[0])
    : null;
  const serverRec = svcFinal?.serverId
    ? await db.select().from(serversTable).where(eq(serversTable.id, svcFinal.serverId)).limit(1).then((r: any[]) => r[0])
    : null;

  const cpUser = svcFinal?.username || "(auto-generated)";
  const cpPass = provisionResult?.credentials?.password || "(check welcome email)";
  const cpUrl = svcFinal?.cpanelUrl || (serverRec?.hostname ? `https://${serverRec.hostname}:2083` : "");
  const wUrl = svcFinal?.webmailUrl || (serverRec?.hostname ? `https://${serverRec.hostname}:2096` : "");
  const ns1 = serverRec?.ns1 || "ns1.noehost.com";
  const ns2 = serverRec?.ns2 || "ns2.noehost.com";
  const domain = svcFinal?.domain || order.domain || order.itemName || "";
  const dashUrl = process.env.CLIENT_AREA_URL ?? "https://noehost.com/dashboard";
  const serviceLink = svcFinal ? `${dashUrl}/hosting/${svcFinal.id}` : dashUrl;

  // WhatsApp + email to client
  if (client.phone && svcFinal) {
    sendToClientPhone(client.phone,
      `🚀 *Service Activated — Noehost!*\n\n` +
      `Hi *${client.firstName}!*\n\n` +
      `Your hosting service is now *LIVE!* 🎉\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *Hosting Details*\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📌 Plan: *${svcFinal.planName || order.itemName}*\n` +
      `🔗 Domain: *${domain}*\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🖥️ *cPanel Login*\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      (cpUrl ? `🔗 URL: ${cpUrl}\n` : "") +
      `👤 Username: *${cpUser}*\n` +
      `🔑 Password: *${cpPass}*\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📧 *Webmail Login*\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      (wUrl ? `🔗 ${wUrl}\n` : "") +
      `(Same username & password)\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🌍 *Nameservers*\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `NS1: *${ns1}*\n` +
      `NS2: *${ns2}*\n\n` +
      `🔧 Manage: ${serviceLink}\n\n` +
      `📞 Need help? Reply here anytime!\n` +
      `_Noehost Team 🌟_`,
      "client_notification"
    ).catch(() => {});

    if (cpUrl && cpUser !== "(auto-generated)") {
      emailHostingCreated(client.email, {
        clientName: `${client.firstName} ${client.lastName ?? ""}`.trim(),
        domain, username: cpUser,
        password: cpPass !== "(check welcome email)" ? cpPass : undefined,
        cpanelUrl: cpUrl, ns1, ns2, webmailUrl: wUrl,
      }, { clientId: client.id, referenceId: svcFinal.id }).catch(() => {});
    }
  }

  const provOk = provisionResult?.success ?? false;
  const whmNote = provisionResult?.whmError ? `\n⚠️ WHM error: ${provisionResult.whmError.slice(0, 80)}` : "";

  return [
    `🚀 *Order Activated!*\n`,
    `👤 Client: *${[client.firstName, client.lastName].filter(Boolean).join(' ')}*`,
    `📧 Email: ${client.email}`,
    ``,
    `📌 Plan: *${order.itemName}*`,
    domain ? `🌐 Domain: *${domain}*` : "",
    ``,
    `🖥️ *cPanel Details*`,
    cpUrl ? `🔗 URL: ${cpUrl}` : "",
    `👤 Username: *${cpUser}*`,
    `🔑 Password: *${cpPass}*`,
    ``,
    `🌍 NS1: ${ns1}`,
    `🌍 NS2: ${ns2}`,
    provOk ? `\n✅ Provisioned on server successfully!` : `\n⚠️ Manually provision needed${whmNote}`,
    client.phone ? `📲 WhatsApp + email sent to client with all details!` : `⚠️ No phone — WhatsApp not sent.`,
  ].filter(Boolean).join("\n");
}

// ── CMD: Client info ──────────────────────────────────────────────────────────
async function cmdClientInfo(identifier: string): Promise<string> {
  if (!identifier) return "❌ Client email, name ya domain batao.";
  const client = await findClient(identifier);
  if (!client) return `❌ *${identifier}* se koi client nahi mila.`;

  const services = await db.select().from(hostingServicesTable)
    .where(eq(hostingServicesTable.clientId, client.id));
  const [unpaidCount] = await db.select({ count: sql<number>`count(*)::int` }).from(invoicesTable)
    .where(and(eq(invoicesTable.clientId, client.id), eq(invoicesTable.status, "unpaid")));
  const [overdueCount] = await db.select({ count: sql<number>`count(*)::int` }).from(invoicesTable)
    .where(and(eq(invoicesTable.clientId, client.id), eq(invoicesTable.status, "overdue")));
  const domains = await db.select({ domain: domainsTable.domain, tld: domainsTable.tld, status: domainsTable.status })
    .from(domainsTable).where(eq(domainsTable.clientId, client.id));

  const svcLines = services.map((s: any) =>
    `  • ${s.domain || s.planName} (${s.status}) — ${s.billingCycle || "monthly"}`
  ).join("\n") || "  None";
  const domLines = domains.map((d: any) => `  • ${d.domain}${d.tld} (${d.status})`).join("\n") || "  None";

  return [
    `👤 *Client Information*\n`,
    `━━━━━━━━━━━━━━━━━━`,
    `🏷️ Name: *${[client.firstName, client.lastName].filter(Boolean).join(' ')}*`,
    `📧 Email: ${client.email}`,
    `📱 Phone: ${client.phone ? formatPKPhone(client.phone) : "—"}`,
    `🏢 Company: ${client.company || "—"}`,
    `✅ Status: *${client.status}*`,
    `📅 Joined: ${client.createdAt ? new Date(client.createdAt).toLocaleDateString("en-PK") : "—"}`,
    `━━━━━━━━━━━━━━━━━━`,
    `🌐 *Hosting Services (${services.length}):*`,
    svcLines,
    `━━━━━━━━━━━━━━━━━━`,
    `🔤 *Domains (${domains.length}):*`,
    domLines,
    `━━━━━━━━━━━━━━━━━━`,
    `💳 Unpaid Invoices: *${unpaidCount.count}*`,
    `⚠️ Overdue Invoices: *${overdueCount.count}*`,
    `━━━━━━━━━━━━━━━━━━`,
    `📝 Quick actions:`,
    `• *suspend ${client.email}* — Suspend service`,
    `• *share invoice ${client.email}* — Send invoice`,
    `• *send message ${client.email}* [message]`,
  ].join("\n");
}

// ── CMD: System status ────────────────────────────────────────────────────────
async function cmdSystemStatus(): Promise<string> {
  const [active] = await db.select({ c: sql<number>`count(*)::int` }).from(hostingServicesTable).where(eq(hostingServicesTable.status, "active"));
  const [susp] = await db.select({ c: sql<number>`count(*)::int` }).from(hostingServicesTable).where(eq(hostingServicesTable.status, "suspended"));
  const [pend] = await db.select({ c: sql<number>`count(*)::int` }).from(hostingServicesTable).where(eq(hostingServicesTable.status, "pending"));
  const [unpaid] = await db.select({ c: sql<number>`count(*)::int` }).from(invoicesTable).where(eq(invoicesTable.status, "unpaid"));
  const [overdue] = await db.select({ c: sql<number>`count(*)::int` }).from(invoicesTable).where(eq(invoicesTable.status, "overdue"));
  const [clients] = await db.select({ c: sql<number>`count(*)::int` }).from(usersTable).where(eq(usersTable.role, "client"));
  const [domains] = await db.select({ c: sql<number>`count(*)::int` }).from(domainsTable).where(eq(domainsTable.status, "active"));
  const [pendOrders] = await db.select({ c: sql<number>`count(*)::int` }).from(ordersTable).where(eq(ordersTable.status, "pending"));
  const now = new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" });

  return [
    `📊 *Noehost — Live Dashboard*\n`,
    `━━━━━━━━━━━━━━━━━━`,
    `👥 Total Clients: *${clients.c}*`,
    `✅ Active Hosting: *${active.c}*`,
    `⏸️ Suspended: *${susp.c}*`,
    `⏳ Pending Setup: *${pend.c}*`,
    `━━━━━━━━━━━━━━━━━━`,
    `🌐 Active Domains: *${domains.c}*`,
    `📦 Pending Orders: *${pendOrders.c}*`,
    `━━━━━━━━━━━━━━━━━━`,
    `💳 Unpaid Invoices: *${unpaid.c}*`,
    `⚠️ Overdue Invoices: *${overdue.c}*`,
    `━━━━━━━━━━━━━━━━━━`,
    `🕐 _${now}_`,
  ].join("\n");
}

// ── CMD: Renewals due ─────────────────────────────────────────────────────────
async function cmdRenewals(days = 7): Promise<string> {
  const future = new Date(); future.setDate(future.getDate() + days);
  const today = new Date();

  const services = await db.select({
    id: hostingServicesTable.id,
    domain: hostingServicesTable.domain,
    planName: hostingServicesTable.planName,
    status: hostingServicesTable.status,
    nextDueDate: hostingServicesTable.nextDueDate,
    clientId: hostingServicesTable.clientId,
  }).from(hostingServicesTable)
    .where(and(
      lte(hostingServicesTable.nextDueDate, future),
      eq(hostingServicesTable.status, "active"),
    ))
    .orderBy(hostingServicesTable.nextDueDate).limit(20);

  if (!services.length) return `✅ *No renewals due in next ${days} days!*`;

  const clientIds = [...new Set(services.map((s: any) => s.clientId))];
  const clientsList = await db.select({
    id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName,
    email: usersTable.email, phone: usersTable.phone,
  }).from(usersTable).where(inArray(usersTable.id, clientIds));
  const clientMap = Object.fromEntries(clientsList.map((c: any) => [c.id, c]));

  const overdue = services.filter((s: any) => s.nextDueDate && new Date(s.nextDueDate) < today);
  const upcoming = services.filter((s: any) => s.nextDueDate && new Date(s.nextDueDate) >= today);

  const lines = [
    `📅 *Renewals — Next ${days} Days*\n`,
    `Total: *${services.length}* (${overdue.length} overdue, ${upcoming.length} upcoming)\n`,
  ];

  if (overdue.length) {
    lines.push(`🔴 *OVERDUE (${overdue.length}):*`);
    for (const s of overdue.slice(0, 5)) {
      const c = clientMap[s.clientId];
      const daysAgo = Math.abs(Math.round((today.getTime() - new Date(s.nextDueDate!).getTime()) / 86400000));
      lines.push(`  • *${s.domain || s.planName}* — ${c?.firstName || "?"} — ${daysAgo}d overdue — ${c?.phone ? formatPKPhone(c.phone) : "no phone"}`);
    }
  }

  if (upcoming.length) {
    lines.push(`\n🟡 *UPCOMING (${upcoming.length}):*`);
    for (const s of upcoming.slice(0, 10)) {
      const c = clientMap[s.clientId];
      const daysLeft = Math.round((new Date(s.nextDueDate!).getTime() - today.getTime()) / 86400000);
      lines.push(`  • *${s.domain || s.planName}* — ${c?.firstName || "?"} — ${daysLeft}d left — ${c?.phone ? formatPKPhone(c.phone) : "no phone"}`);
    }
  }

  lines.push(`\n📝 Remind all: *remind all ${days}d*`);
  return lines.join("\n");
}

// ── CMD: Share invoice ────────────────────────────────────────────────────────
async function cmdShareInvoice(data: { email?: string; invoiceId?: string }, sock: any, adminJid: string): Promise<string> {
  let invoice = null;
  let client = null;

  if (data.invoiceId) {
    const id = data.invoiceId.replace(/^NOE-/i, "");
    [invoice] = await db.select().from(invoicesTable)
      .where(or(eq(invoicesTable.id, data.invoiceId), ilike(invoicesTable.invoiceNumber, `%${id}%`))).limit(1);
    if (invoice) {
      [client] = await db.select().from(usersTable).where(eq(usersTable.id, invoice.clientId)).limit(1);
    }
  } else if (data.email) {
    client = await findClient(data.email);
    if (client) {
      [invoice] = await db.select().from(invoicesTable)
        .where(and(eq(invoicesTable.clientId, client.id), eq(invoicesTable.status, "unpaid")))
        .orderBy(desc(invoicesTable.createdAt)).limit(1);
    }
  }

  if (!invoice) return `❌ Invoice nahi mila. Invoice number ya client email batao.`;
  if (!client) return `❌ Client nahi mila for this invoice.`;
  if (!client.phone) return `⚠️ Client *${client.email}* ka phone number nahi hai. Update karein: *info ${client.email}*`;

  const payInfo = await getPaymentInfo();
  const paySection = payInfo ? `\n\n💳 *Payment Details:*\n${payInfo}` : "";
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-PK") : "—";
  const dashUrl = process.env.CLIENT_AREA_URL ?? "https://noehost.com/dashboard";

  await sendToClientPhone(client.phone,
    `🧾 *Invoice — Noehost*\n\n` +
    `Hi *${client.firstName}!*\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `📋 *Invoice Details*\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `🆔 Invoice: *${invoice.invoiceNumber}*\n` +
    `💰 Amount: *PKR ${Number(invoice.total).toLocaleString()}*\n` +
    `📅 Due Date: *${dueDate}*\n` +
    `📌 Status: *${invoice.status?.toUpperCase()}*\n` +
    `━━━━━━━━━━━━━━━━━━` +
    paySection + `\n\n` +
    `🔗 View & Download: ${dashUrl}/invoices/${invoice.id}\n\n` +
    `📞 Questions? Reply here anytime!\n` +
    `_Noehost Team 🚀_`,
    "client_notification"
  );

  return [
    `✅ *Invoice Shared!*\n`,
    `📧 Client: ${client.email}`,
    `📱 Sent to: *${formatPKPhone(client.phone)}*`,
    `🧾 Invoice: *${invoice.invoiceNumber}*`,
    `💰 Amount: *PKR ${Number(invoice.total).toLocaleString()}*`,
    `📅 Due: ${dueDate}`,
  ].join("\n");
}

// ── CMD: AI Issue Diagnosis (with smart auto-routing to real actions) ─────────
async function cmdFixIssue(issueDesc: string, context: { email?: string; domain?: string }): Promise<string> {
  if (!issueDesc) return "❌ Issue describe karo. Example: *fix issue client ka email nahi aa raha domain.com*";

  const lower = issueDesc.toLowerCase();
  const identifier = context.domain || context.email || "";

  // Smart routing: detect issue keywords → call real action directly
  if (/\bssl\b|certificate|https.*error|ssl.*expire|ssl.*install/.test(lower)) {
    const domain = context.domain || issueDesc.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/)?.[1] || "";
    if (domain) return cmdSslInstall(domain);
  }
  if (/\b404\b|permalink|htaccess|page.*not.*found|wordpress.*error|wp.*fix/.test(lower)) {
    if (identifier) return cmdWpFix404(identifier);
  }
  if (/password.*forgot|password.*reset|cant.*login.*cpanel|cpanel.*login.*fail/.test(lower)) {
    if (identifier) return cmdResetPassword(identifier);
  }
  if (/disk.*full|storage.*full|disk.*limit|no.*space|quota.*exceed/.test(lower)) {
    if (identifier) return cmdDiskUsage(identifier);
  }
  if (/backup.*needed|backup.*lo|create.*backup/.test(lower)) {
    if (identifier) return cmdCreateBackup(identifier);
  }

  // Fallback: Gemini AI text advice
  let contextStr = "";
  if (context.email || context.domain) {
    const client = context.email ? await findClient(context.email) : null;
    const service = context.domain ? await findService(context.domain) : (client ? await findServiceByEmail(context.email!) : null);
    if (client) contextStr += `Client: ${client.firstName} ${client.lastName ?? ""}, Email: ${client.email}\n`;
    if (service) contextStr += `Service: ${service.planName}, Domain: ${service.domain}, Status: ${service.status}, cPanel: ${service.cpanelUrl || "N/A"}\n`;
  }

  const prompt = `You are a senior hosting support specialist at Noehost, a Pakistani web hosting company using cPanel/WHM.
A client is having this issue: "${issueDesc}"
${contextStr ? `\nClient/Service context:\n${contextStr}` : ""}

Generate a comprehensive response with:
1. Root cause analysis (2-3 sentences)
2. Step-by-step fix guide for the client (numbered, simple Urdu/English mixed, max 8 steps)
3. Preventive tips (1-2 points)
4. A WhatsApp-formatted message the admin can send directly to client

Format your response EXACTLY as:
--- ADMIN SUMMARY ---
[2-3 sentence diagnosis for admin]

--- CLIENT STEPS ---
[numbered steps in simple language, emoji per step]

--- WHATSAPP MESSAGE ---
[ready-to-send WhatsApp message for client, professional, with emojis and stars for bold]`;

  try {
    const aiResp = await askGemini(prompt);
    const adminPart = aiResp.match(/--- ADMIN SUMMARY ---\n([\s\S]*?)(?=--- CLIENT STEPS ---|$)/)?.[1]?.trim() || "";
    const stepsPart = aiResp.match(/--- CLIENT STEPS ---\n([\s\S]*?)(?=--- WHATSAPP MESSAGE ---|$)/)?.[1]?.trim() || "";
    const waPart = aiResp.match(/--- WHATSAPP MESSAGE ---\n([\s\S]*?)$/)?.[1]?.trim() || "";

    return [
      `🔧 *Issue Diagnosis: ${issueDesc.slice(0, 50)}*\n`,
      `━━━━━━━━━━━━━━━━━━`,
      `📋 *Root Cause (Admin):*`,
      adminPart,
      ``,
      `━━━━━━━━━━━━━━━━━━`,
      `📝 *Fix Steps:*`,
      stepsPart,
      ``,
      `━━━━━━━━━━━━━━━━━━`,
      `📲 *Send this to client:*`,
      `━━━━━━━━━━━━━━━━━━`,
      waPart,
      `━━━━━━━━━━━━━━━━━━`,
      `📤 To send directly: *send message [phone/email]* and paste the message above.`,
    ].join("\n");
  } catch (e: any) {
    return `❌ AI diagnosis failed: ${e.message}. Check your GEMINI_API_KEY.`;
  }
}

// ── CMD: Terminate service (2-step confirm) ───────────────────────────────────
const pendingTerminations = new Map<string, { serviceId: string; domain: string; ts: number }>();

async function cmdTerminateService(identifier: string, adminJid: string, confirmed = false): Promise<string> {
  const key = adminJid;

  if (confirmed) {
    // Step 2 — confirmation received; resolve stored pending entry
    const pending = pendingTerminations.get(key);
    if (!pending || Date.now() - pending.ts > 5 * 60 * 1000) {
      pendingTerminations.delete(key);
      return `❌ Termination confirm timeout ho gaya. Dobara *terminate [domain/email]* likho.`;
    }
    pendingTerminations.delete(key);

    const [targetService] = await db.select().from(hostingServicesTable)
      .where(eq(hostingServicesTable.id, pending.serviceId)).limit(1);
    if (!targetService) return `❌ Service nahi mila.`;

    // Get server config for cpanelTerminate
    let terminated = false;
    if (targetService.username && targetService.serverId) {
      try {
        const [serverRec] = await db.select().from(serversTable)
          .where(eq(serversTable.id, targetService.serverId)).limit(1);
        if (serverRec?.hostname && serverRec.apiToken) {
          await cpanelTerminate(
            { hostname: serverRec.hostname, port: Number(serverRec.port ?? 2087), username: serverRec.username ?? "root", apiToken: serverRec.apiToken },
            targetService.username,
          );
          terminated = true;
        }
      } catch (e: any) {
        console.warn("[NOE] cpanelTerminate warn:", e.message);
      }
    }

    await db.update(hostingServicesTable)
      .set({ status: "terminated", updatedAt: new Date() })
      .where(eq(hostingServicesTable.id, pending.serviceId));

    const [client] = await db.select().from(usersTable)
      .where(eq(usersTable.id, targetService.clientId)).limit(1);

    if (client?.phone) {
      sendToClientPhone(client.phone,
        `🗑️ *Service Terminated — Noehost*\n\n` +
        `Hi *${client.firstName},*\n\n` +
        `Your service *${pending.domain}* has been *terminated*.\n\n` +
        `All data has been removed. For a new service:\n` +
        `🔗 noehost.com/client/orders/new\n\n` +
        `📞 Questions? Reply here or email support@noehost.com\n` +
        `_Noehost Team_`, "client_notification"
      ).catch(() => {});
    }
    if (client?.email) {
      emailServiceSuspended(client.email, {
        clientName: `${client.firstName} ${client.lastName ?? ""}`.trim(),
        domain: pending.domain,
        reason: "Service terminated by administrator",
      }).catch(() => {});
    }

    return [
      `🗑️ *Service Terminated!*\n`,
      `🌐 Domain: *${pending.domain}*`,
      `👤 Client: ${client ? client.email : targetService.clientId}`,
      terminated ? `✅ cPanel account removed from server.` : `⚠️ Server removal failed — DB marked terminated.`,
      client?.phone ? `📲 Client notified via WhatsApp + email.` : `⚠️ No phone — notification skipped.`,
    ].join("\n");
  }

  // Step 1 — request confirmation
  let service = await findService(identifier);
  if (!service) {
    const c = await findClient(identifier);
    if (c) service = await findServiceByEmail(c.email);
  }
  if (!service) return `❌ *${identifier}* ka koi service nahi mila.`;

  pendingTerminations.set(key, { serviceId: service.id, domain: service.domain || service.planName || service.id, ts: Date.now() });
  return [
    `⚠️ *Termination Confirmation Required*\n`,
    `🌐 Service: *${service.domain || service.planName}*`,
    `📌 Status: ${service.status}`,
    `🆔 Service ID: ${service.id.slice(0, 8)}…`,
    ``,
    `⚠️ Ye action *PERMANENT* hai! Service ka cPanel account delete ho jayega.`,
    ``,
    `Confirm karne ke liye likho:`,
    `*terminate confirm*`,
    ``,
    `⏳ 5 minute mein expire ho jaye ga.`,
  ].join("\n");
}

// ── CMD: Extend billing period ────────────────────────────────────────────────
async function cmdExtendBilling(data: { email?: string; domain?: string; months?: string }): Promise<string> {
  const identifier = data.email || data.domain || "";
  if (!identifier) return "❌ Client email ya domain batao.";

  let service = await findService(identifier);
  if (!service) {
    const c = await findClient(identifier);
    if (c) service = await findServiceByEmail(c.email);
  }
  if (!service) return `❌ *${identifier}* ka koi service nahi mila.`;

  const months = parseInt(data.months || "1") || 1;
  if (months < 1 || months > 24) return `❌ Months 1 se 24 ke darmiyan hone chahiye. Tumne diya: *${data.months}*`;

  const current = service.nextDueDate ? new Date(service.nextDueDate) : new Date();
  const extended = new Date(current);
  extended.setMonth(extended.getMonth() + months);

  await db.update(hostingServicesTable)
    .set({ nextDueDate: extended, updatedAt: new Date() })
    .where(eq(hostingServicesTable.id, service.id));

  const [client] = await db.select().from(usersTable)
    .where(eq(usersTable.id, service.clientId)).limit(1);

  if (client?.phone) {
    sendToClientPhone(client.phone,
      `✅ *Billing Extended — Noehost*\n\n` +
      `Hi *${client.firstName}!*\n\n` +
      `Your service *${service.domain || service.planName}* billing has been extended by *${months} month${months > 1 ? "s" : ""}*.\n\n` +
      `📅 New Due Date: *${extended.toLocaleDateString("en-PK")}*\n\n` +
      `_Noehost Team 🚀_`, "client_notification"
    ).catch(() => {});
  }

  return [
    `✅ *Billing Extended!*\n`,
    `🌐 Service: *${service.domain || service.planName}*`,
    `👤 Client: ${client ? client.email : service.clientId}`,
    `📅 Old Due Date: *${current.toLocaleDateString("en-PK")}*`,
    `📅 New Due Date: *${extended.toLocaleDateString("en-PK")}*`,
    `⏰ Extended by: *${months} month${months > 1 ? "s" : ""}*`,
    client?.phone ? `📲 Client notified via WhatsApp.` : `⚠️ No phone — notification skipped.`,
  ].join("\n");
}

// ── CMD: Update plan price ─────────────────────────────────────────────────────
async function cmdUpdatePlanPrice(data: { planName?: string; price?: string; yearlyPrice?: string; quarterlyPrice?: string }): Promise<string> {
  if (!data.planName) return "❌ Plan name batao. Example: *plan price update Business Pro 4000*";
  if (!data.price) return "❌ New price batao (PKR). Example: *plan price update Business Pro 4000*";

  const newPrice = parseFloat(data.price.replace(/[^0-9.]/g, ""));
  if (isNaN(newPrice) || newPrice <= 0) return `❌ Invalid price: *${data.price}*. Sirf number batao.`;

  const [plan] = await db.select().from(hostingPlansTable)
    .where(ilike(hostingPlansTable.name, `%${data.planName.trim()}%`)).limit(1);

  if (!plan) return `❌ Plan *${data.planName}* nahi mila. *status* type karo for plan list.`;

  const updateData: any = { price: String(newPrice), updatedAt: new Date() };

  if (data.yearlyPrice) {
    const yp = parseFloat(data.yearlyPrice.replace(/[^0-9.]/g, ""));
    if (!isNaN(yp) && yp > 0) updateData.yearlyPrice = String(yp);
  }

  if (data.quarterlyPrice) {
    const qp = parseFloat(data.quarterlyPrice.replace(/[^0-9.]/g, ""));
    if (!isNaN(qp) && qp > 0) updateData.quarterlyPrice = String(qp);
  }

  await db.update(hostingPlansTable).set(updateData)
    .where(eq(hostingPlansTable.id, plan.id));

  const extraLines: string[] = [];
  if (updateData.yearlyPrice) extraLines.push(`💰 Yearly Price: *PKR ${Number(updateData.yearlyPrice).toLocaleString()}*`);
  if (updateData.quarterlyPrice) extraLines.push(`💰 Quarterly Price: *PKR ${Number(updateData.quarterlyPrice).toLocaleString()}*`);

  return [
    `✅ *Plan Price Updated!*\n`,
    `📦 Plan: *${plan.name}*`,
    `💰 Old Monthly Price: *PKR ${Number(plan.price).toLocaleString()}*`,
    `💰 New Monthly Price: *PKR ${newPrice.toLocaleString()}*`,
    ...extraLines,
    ``,
    `⚡ New orders will use the updated price immediately.`,
  ].join("\n");
}

// ── CMD: List open tickets ─────────────────────────────────────────────────────
async function cmdListTickets(): Promise<string> {
  const tickets = await db.select({
    id: ticketsTable.id,
    ticketNumber: ticketsTable.ticketNumber,
    subject: ticketsTable.subject,
    status: ticketsTable.status,
    priority: ticketsTable.priority,
    clientId: ticketsTable.clientId,
    createdAt: ticketsTable.createdAt,
  }).from(ticketsTable)
    .where(or(eq(ticketsTable.status, "open"), eq(ticketsTable.status, "pending")))
    .orderBy(desc(ticketsTable.createdAt)).limit(10);

  if (!tickets.length) return `✅ *No open tickets right now!* 🎉`;

  const clientIds = [...new Set(tickets.map((t: any) => t.clientId).filter(Boolean))];
  const clients = clientIds.length
    ? await db.select({ id: usersTable.id, firstName: usersTable.firstName, email: usersTable.email })
        .from(usersTable).where(inArray(usersTable.id, clientIds))
    : [];
  const cmap = Object.fromEntries(clients.map((c: any) => [c.id, c]));

  const priorityIcon: Record<string, string> = {
    critical: "🔴", high: "🟠", medium: "🟡", low: "🟢",
  };

  const lines = [`🎫 *Open Support Tickets (${tickets.length})*\n`];
  for (const t of tickets) {
    const c = cmap[t.clientId || ""];
    const icon = priorityIcon[t.priority || "medium"] ?? "🟡";
    const age = t.createdAt
      ? `${Math.floor((Date.now() - new Date(t.createdAt).getTime()) / 3600000)}h ago`
      : "";
    lines.push(
      `${icon} *${t.ticketNumber}* — ${t.subject?.slice(0, 40)}`,
      `   👤 ${c ? `${c.firstName} (${c.email})` : "Unknown"} — ${t.status} — ${age}`,
    );
  }

  lines.push(`\n📝 Reply karne ke liye: *reply ticket TKT-123 [message]*`);
  return lines.join("\n");
}

// ── CMD: Reply to ticket ───────────────────────────────────────────────────────
async function cmdReplyTicket(data: { ticketId?: string; replyText?: string }): Promise<string> {
  if (!data.ticketId) return "❌ Ticket number batao. Example: *reply ticket TKT-123 message text*";
  if (!data.replyText) return "❌ Reply text batao.";

  const ticketNum = data.ticketId.trim().replace(/^#/, "");

  const [ticket] = await db.select().from(ticketsTable)
    .where(or(
      ilike(ticketsTable.ticketNumber, `%${ticketNum}%`),
      eq(ticketsTable.id, ticketNum),
    )).limit(1);

  if (!ticket) return `❌ Ticket *${data.ticketId}* nahi mila.`;

  const [client] = await db.select().from(usersTable)
    .where(eq(usersTable.id, ticket.clientId)).limit(1);

  // Polish reply using Gemini for professional support language
  let polishedReply = data.replyText;
  try {
    const polishPrompt = `You are a professional hosting support agent at Noehost.
Polish the following admin reply into professional, friendly English-Urdu mixed support language.
Keep it concise. Use appropriate emojis. Preserve all technical details.
Original reply: "${data.replyText}"
Return ONLY the polished reply text, nothing else.`;
    polishedReply = await askGemini(polishPrompt);
  } catch { /* keep original if Gemini fails */ }

  // Insert admin reply — satisfying NOT NULL constraints on senderId and senderName
  await db.insert(ticketMessagesTable).values({
    ticketId: ticket.id,
    senderId: "noe-agent",
    senderName: "Support Team",
    senderRole: "admin",
    message: polishedReply,
  });

  await db.update(ticketsTable).set({
    status: "answered" as any,
    updatedAt: new Date(),
  }).where(eq(ticketsTable.id, ticket.id));

  const dashUrl = process.env.CLIENT_AREA_URL ?? "https://noehost.com/dashboard";

  // Notify client via WhatsApp + email
  if (client?.phone) {
    sendToClientPhone(client.phone,
      `📨 *Ticket Reply — Noehost*\n\n` +
      `Hi *${client.firstName}!*\n\n` +
      `Aapki ticket *${ticket.ticketNumber}* ka jawab aa gaya hai!\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📋 *Subject:* ${ticket.subject}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `💬 *Reply:*\n${polishedReply}\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `🔗 View: ${dashUrl}/tickets/${ticket.id}\n\n` +
      `📞 Koi aur sawaal ho to reply karein!\n` +
      `_Noehost Team 🚀_`, "client_notification"
    ).catch(() => {});
  }

  if (client?.email) {
    emailGeneric(client.email,
      `Reply to your ticket: ${ticket.subject}`,
      client.firstName || "Client",
      `Your ticket *${ticket.ticketNumber}* has been replied to:\n\n${polishedReply}`,
    ).catch(() => {});
  }

  return [
    `✅ *Ticket Replied!*\n`,
    `🎫 Ticket: *${ticket.ticketNumber}*`,
    `📋 Subject: ${ticket.subject}`,
    `👤 Client: ${client ? `${client.firstName} (${client.email})` : "Unknown"}`,
    `💬 Reply: ${polishedReply.slice(0, 120)}${polishedReply.length > 120 ? "…" : ""}`,
    client?.phone ? `📲 Client notified via WhatsApp + email.` : `⚠️ No phone — WhatsApp not sent.`,
  ].join("\n");
}

// ── CMD: Suspend ──────────────────────────────────────────────────────────────
async function cmdSuspend(identifier: string, notifyClient = true): Promise<string> {
  let service = await findService(identifier);
  if (!service) {
    const c = await findClient(identifier);
    if (c) service = await findServiceByEmail(c.email);
  }
  if (!service) return `❌ *${identifier}* ka koi service nahi mila.`;
  if (service.status === "suspended") return `⏸️ *${service.domain || service.planName}* already suspended hai.`;

  try {
    if (service.username) await suspendHostingAccount(service.username, service.serverId, "Noe WA Agent");
  } catch (e: any) { console.warn("[NOE] suspend warn:", e.message); }

  await db.update(hostingServicesTable).set({ status: "suspended", updatedAt: new Date() })
    .where(eq(hostingServicesTable.id, service.id));

  const [client] = await db.select().from(usersTable).where(eq(usersTable.id, service.clientId)).limit(1);

  if (notifyClient && client) {
    if (client.phone) {
      sendToClientPhone(client.phone,
        `⚠️ *Service Suspended — Noehost*\n\n` +
        `Hi *${client.firstName},*\n\n` +
        `Your service *${service.domain || service.planName}* has been suspended.\n\n` +
        `Reason: *Non-payment / Admin action*\n\n` +
        `To restore your service, please:\n` +
        `1. Pay your outstanding invoice\n` +
        `2. Reply here or contact support\n\n` +
        `📧 support@noehost.com\n` +
        `_Noehost Team_`, "client_notification"
      ).catch(() => {});
    }
    emailServiceSuspended(client.email, {
      clientName: `${client.firstName} ${client.lastName ?? ""}`.trim(),
      domain: service.domain || service.planName || "",
      reason: "Non-payment",
    }).catch(() => {});
  }

  return [
    `✅ *Service Suspended!*\n`,
    `🌐 Domain: *${service.domain || service.planName}*`,
    `👤 Client: ${client ? client.email : service.clientId}`,
    notifyClient && client?.phone ? `📲 Client notified via WhatsApp + email.` : `⚠️ Client notification skipped.`,
  ].join("\n");
}

// ── CMD: Unsuspend ────────────────────────────────────────────────────────────
async function cmdUnsuspend(identifier: string): Promise<string> {
  let service = await findService(identifier);
  if (!service) {
    const c = await findClient(identifier);
    if (c) service = await findServiceByEmail(c.email);
  }
  if (!service) return `❌ *${identifier}* ka koi service nahi mila.`;
  if (service.status === "active") return `✅ *${service.domain || service.planName}* already active hai.`;

  try {
    if (service.username) await unsuspendHostingAccount(service.username, service.serverId);
  } catch (e: any) { console.warn("[NOE] unsuspend warn:", e.message); }

  await db.update(hostingServicesTable).set({ status: "active", updatedAt: new Date() })
    .where(eq(hostingServicesTable.id, service.id));

  const [client] = await db.select().from(usersTable).where(eq(usersTable.id, service.clientId)).limit(1);

  if (client?.phone) {
    sendToClientPhone(client.phone,
      `✅ *Service Restored — Noehost*\n\n` +
      `Hi *${client.firstName},*\n\n` +
      `Your service *${service.domain || service.planName}* has been *RESTORED!* 🎉\n\n` +
      `You can now access your hosting panel at:\n${service.cpanelUrl || "noehost.com/dashboard"}\n\n` +
      `_Noehost Team 🚀_`, "client_notification"
    ).catch(() => {});
  }

  return [
    `✅ *Service Unsuspended!*\n`,
    `🌐 Domain: *${service.domain || service.planName}*`,
    `👤 Client: ${client ? client.email : service.clientId}`,
    client?.phone ? `📲 Client notified via WhatsApp.` : `⚠️ No phone — notification skipped.`,
  ].join("\n");
}

// ── CMD: Send custom message to client ────────────────────────────────────────
async function cmdSendMessage(data: { email?: string; phone?: string; clientMsg?: string }): Promise<string> {
  const { clientMsg } = data;
  if (!clientMsg) return "❌ Message text batao.";

  let phone = data.phone;
  let clientName = "Client";

  if (!phone && data.email) {
    const client = await findClient(data.email);
    if (!client) return `❌ Client *${data.email}* nahi mila.`;
    phone = client.phone || undefined;
    clientName = client.firstName || "Client";
  }
  if (!phone) return "❌ Phone number ya client email batao.";

  await sendToClientPhone(phone, clientMsg, "client_notification");

  return `✅ *Message Sent!*\n\n📱 To: *${formatPKPhone(phone)}* (${clientName})\n💬 Message delivered via WhatsApp.`;
}

// ── CMD: Remind all due renewals ──────────────────────────────────────────────
async function cmdRemindAll(days = 7): Promise<string> {
  const future = new Date(); future.setDate(future.getDate() + days);
  const services = await db.select().from(hostingServicesTable)
    .where(and(lte(hostingServicesTable.nextDueDate, future), eq(hostingServicesTable.status, "active")));
  if (!services.length) return `✅ No renewals due in next ${days} days.`;

  const clientIds = [...new Set(services.map((s: any) => s.clientId))];
  const clients = await db.select().from(usersTable).where(inArray(usersTable.id, clientIds));
  const clientMap = Object.fromEntries(clients.map((c: any) => [c.id, c]));
  const payInfo = await getPaymentInfo();
  const paySection = payInfo ? `\n\n💳 *Payment:*\n${payInfo}` : "";

  let sent = 0; let noPhone = 0;
  for (const svc of services) {
    const c = clientMap[svc.clientId];
    if (!c?.phone) { noPhone++; continue; }
    const today = new Date();
    const due = svc.nextDueDate ? new Date(svc.nextDueDate) : today;
    const daysLeft = Math.round((due.getTime() - today.getTime()) / 86400000);
    const dueLabel = daysLeft <= 0 ? `*DUE TODAY ⚠️*` : `due in *${daysLeft} days*`;

    sendToClientPhone(c.phone,
      `⏰ *Renewal Reminder — Noehost*\n\n` +
      `Hi *${c.firstName}!*\n\n` +
      `Your service *${svc.domain || svc.planName}* is ${dueLabel}.\n\n` +
      `📅 Due: *${due.toLocaleDateString("en-PK")}*\n` +
      `💰 Renew now to avoid suspension!` +
      paySection + `\n\n` +
      `_Noehost Team_`, "client_notification"
    ).catch(() => {});
    sent++;
  }

  return `✅ *Renewal Reminders Sent!*\n\n📲 Sent: *${sent}* clients\n⚠️ No phone: *${noPhone}* clients`;
}

// ── HELP ──────────────────────────────────────────────────────────────────────
function cmdHelp(): string {
  return [
    `🤖 *Noe — WhatsApp Admin Agent*`,
    `_Pakistan's most advanced hosting AI agent_\n`,
    `━━━━━━━━━━━━━━━━━━`,
    `📋 *Commands (natural language — kaise bhi likho):*`,
    ``,
    `🔍 *Domain*`,
    `  • _check domain kalahost.com_`,
    `  • _add domain ali@email.com kalahost.com_`,
    ``,
    `👤 *Clients*`,
    `  • _add client Ali Hassan ali@x.com 0300-123 Pass@1_`,
    `  • _info ali@email.com_`,
    ``,
    `📦 *Orders*`,
    `  • _order add ali@email.com kalahost.com Business Pro_`,
    `  • _order add ali@email.com site.com 3500 mein_ (custom price)`,
    `  • _activate order #ORDER-ID_`,
    `  • _activate ali@email.com_`,
    ``,
    `🔧 *Services*`,
    `  • _suspend kalahost.com_`,
    `  • _unsuspend ali@email.com_`,
    `  • _terminate kalahost.com_ (2-step confirm)`,
    `  • _terminate confirm_ (confirm termination)`,
    `  • _extend billing ali@email.com 3 months_`,
    ``,
    `💰 *Plans*`,
    `  • _update plan price Business Pro 4000_`,
    `  • _Business Pro ki price 4000 kar do_`,
    ``,
    `🧾 *Invoices*`,
    `  • _share invoice ali@email.com_`,
    `  • _share invoice NOE-02341_`,
    ``,
    `📅 *Renewals*`,
    `  • _renewals_ (next 7 days)`,
    `  • _renewals 30 days_`,
    `  • _remind all 7d_`,
    ``,
    `🎫 *Tickets*`,
    `  • _tickets_ (show open tickets)`,
    `  • _reply ticket TKT-123 Your issue is fixed!_`,
    ``,
    `🔧 *AI Issue Fixer*`,
    `  • _fix issue email nahi aa raha kalahost.com_`,
    `  • _client ka cpanel login nahi ho raha_`,
    ``,
    `🔒 *SSL Certificate*`,
    `  • _ssl install karo kalahost.com_`,
    `  • _ssl lagao kalahost.com_`,
    ``,
    `🔧 *WordPress 404 Fix*`,
    `  • _wp fix 404 kalahost.com_`,
    `  • _wordpress permalink error fix karo_`,
    ``,
    `🔑 *cPanel Password Reset*`,
    `  • _password reset karo kalahost.com NewPass@123_`,
    `  • _password badlo ali@email.com auto_ (auto-generate)`,
    ``,
    `🌐 *Site Check (Up/Down)*`,
    `  • _site check karo kalahost.com_`,
    `  • _check kalahost.com up hai ya down_`,
    ``,
    `📦 *Backup*`,
    `  • _backup karo kalahost.com_`,
    `  • _backup lo ali@email.com_`,
    ``,
    `💾 *Disk Usage*`,
    `  • _disk usage dekho kalahost.com_`,
    `  • _disk kitna use ho raha kalahost.com_`,
    ``,
    `✅ *Mark Invoice Paid*`,
    `  • _invoice paid mark karo NOE-02341_`,
    `  • _payment received ali@email.com_`,
    ``,
    `💬 *Messaging*`,
    `  • _send message ali@email.com Your service is ready!_`,
    ``,
    `📊 *System*`,
    `  • _status_`,
    `━━━━━━━━━━━━━━━━━━`,
    `_Type anything naturally — Noe samjhega! 🚀_`,
  ].join("\n");
}

// ── MAIN AGENT ENTRY POINT ────────────────────────────────────────────────────
export async function noeAgent(msg: string, adminJid: string, sock: any): Promise<string | null> {
  const trimmed = msg.trim();
  if (!trimmed) return null;

  // Handle quick commands first (exact match shortcuts)
  const lower = trimmed.toLowerCase();
  if (lower === "status" || lower === "!status") return cmdSystemStatus();
  if (lower === "help" || lower === "!help" || lower === "commands") return cmdHelp();
  if (lower === "tickets" || lower === "ticket list" || lower === "open tickets") return cmdListTickets();

  // Affirmation when a pending termination is waiting — "haan", "yes", "confirm" etc.
  const isAffirmation = /^(haan|han|yes|y|confirm|terminate confirm|confirm terminate|ok|okay|ha|theek hai|done|karo)$/i.test(lower);
  if (isAffirmation && pendingTerminations.has(adminJid)) {
    return executeIntent("terminate_confirm", {}, adminJid, sock);
  }

  // Check for ongoing conversation step
  const existingConv = getConv(adminJid);

  // Collect missing fields in multi-turn conversations
  if (existingConv && existingConv.missing.length > 0) {
    const field = existingConv.missing[0];
    existingConv.collected[field] = trimmed;
    existingConv.missing.shift();
    setConv(adminJid, existingConv);

    if (existingConv.missing.length > 0) {
      const nextField = existingConv.missing[0];
      const prompts: Record<string, string> = {
        name: "👤 Client ka full name batao:",
        email: "📧 Client ki email batao:",
        phone: "📱 Phone number (optional, 0 type karo to skip):",
        password: "🔑 Password batao (ya 'auto' type karo random ke liye):",
        domain: "🌐 Domain name batao:",
        planName: "📦 Plan name batao (ya 'basic' for cheapest):",
        message: "💬 Client ko kya message bhejein?",
        issueDesc: "🔧 Issue describe karo:",
        months: "⏰ Kitne months extend karne hain? (1-24):",
        price: "💰 New price (PKR) batao:",
        ticketId: "🎫 Ticket number batao (e.g. TKT-123):",
        replyText: "💬 Ticket ka reply likho:",
        clientMsg: "💬 Client ko kya message bhejein?",
      };
      return prompts[nextField] || `${nextField} batao:`;
    }

    // All fields collected — execute
    return executeIntent(existingConv.intent, existingConv.collected, adminJid, sock);
  }

  // Detect intent from message
  let parsed: Awaited<ReturnType<typeof detectIntent>>;
  try {
    parsed = await detectIntent(trimmed);
  } catch {
    parsed = { intent: "unknown" };
  }

  const { intent, ...params } = parsed;
  console.log(`[NOE-AGENT] Intent: ${intent} | Params: ${JSON.stringify(params)}`);

  return executeIntent(intent, params as Record<string, string>, adminJid, sock);
}

async function executeIntent(intent: string, params: Record<string, string>, adminJid: string, sock: any): Promise<string> {
  clearConv(adminJid);

  try {
    switch (intent) {
      case "domain_check":
        if (!params.domain) {
          setConv(adminJid, { intent, collected: params, missing: ["domain"], ts: Date.now() });
          return "🔍 Domain name batao jise check karna hai:";
        }
        return await cmdDomainCheck(params.domain);

      case "add_client": {
        const missing = [];
        if (!params.name) missing.push("name");
        if (!params.email) missing.push("email");
        if (missing.length) {
          setConv(adminJid, { intent, collected: params, missing, ts: Date.now() });
          const prompts: Record<string, string> = { name: "👤 Client ka full name:", email: "📧 Client email:" };
          return prompts[missing[0]];
        }
        if (!params.password) params.password = "";
        return await cmdAddClient(params);
      }

      case "add_order": {
        const missing = [];
        if (!params.email) missing.push("email");
        if (!params.domain) missing.push("domain");
        if (missing.length) {
          setConv(adminJid, { intent, collected: params, missing, ts: Date.now() });
          const prompts: Record<string, string> = { email: "📧 Client email:", domain: "🌐 Domain name:" };
          return prompts[missing[0]];
        }
        return await cmdAddOrder(params);
      }

      case "add_domain": {
        const missing = [];
        if (!params.email) missing.push("email");
        if (!params.domain) missing.push("domain");
        if (missing.length) {
          setConv(adminJid, { intent, collected: params, missing, ts: Date.now() });
          const prompts: Record<string, string> = { email: "📧 Client email:", domain: "🌐 Domain name:" };
          return prompts[missing[0]];
        }
        return await cmdAddDomain(params);
      }

      case "activate_order":
        return await cmdActivateOrder(params, sock, adminJid);

      case "suspend":
        return await cmdSuspend(params.email || params.domain || params.name || "");

      case "unsuspend":
        return await cmdUnsuspend(params.email || params.domain || params.name || "");

      case "terminate_service": {
        const id = params.email || params.domain || params.name || "";
        if (!id) {
          setConv(adminJid, { intent, collected: params, missing: ["domain"], ts: Date.now() });
          return "🌐 Kis service ko terminate karna hai? Domain ya email batao:";
        }
        return await cmdTerminateService(id, adminJid, false);
      }

      case "terminate_confirm":
        return await cmdTerminateService("", adminJid, true);

      case "extend_billing": {
        const id = params.email || params.domain || "";
        if (!id) {
          setConv(adminJid, { intent, collected: params, missing: ["domain"], ts: Date.now() });
          return "🌐 Kis service ki billing extend karni hai? Domain ya email batao:";
        }
        if (!params.months) {
          setConv(adminJid, { intent, collected: { ...params, domain: id }, missing: ["months"], ts: Date.now() });
          return "⏰ Kitne months extend karne hain? (1-24):";
        }
        return await cmdExtendBilling(params);
      }

      case "update_plan_price": {
        if (!params.planName) {
          setConv(adminJid, { intent, collected: params, missing: ["planName"], ts: Date.now() });
          return "📦 Kaun se plan ki price update karni hai? Plan name batao:";
        }
        if (!params.price) {
          setConv(adminJid, { intent, collected: params, missing: ["price"], ts: Date.now() });
          return `💰 *${params.planName}* ki new monthly price batao (PKR):`;
        }
        return await cmdUpdatePlanPrice(params);
      }

      case "list_tickets":
        return await cmdListTickets();

      case "reply_ticket": {
        if (!params.ticketId) {
          setConv(adminJid, { intent, collected: params, missing: ["ticketId"], ts: Date.now() });
          return "🎫 Ticket number batao (e.g. TKT-123):";
        }
        if (!params.replyText) {
          setConv(adminJid, { intent, collected: params, missing: ["replyText"], ts: Date.now() });
          return `💬 Ticket *${params.ticketId}* ka reply likho:`;
        }
        return await cmdReplyTicket(params);
      }

      case "client_info":
        if (!params.email && !params.name && !params.phone && !params.domain) {
          setConv(adminJid, { intent, collected: params, missing: ["email"], ts: Date.now() });
          return "📧 Client email, name ya domain batao:";
        }
        return await cmdClientInfo(params.email || params.name || params.phone || params.domain || "");

      case "system_status":
        return await cmdSystemStatus();

      case "renewals": {
        const days = parseInt(params.filterDays || "7") || 7;
        return await cmdRenewals(days);
      }

      case "share_invoice":
        return await cmdShareInvoice(params, sock, adminJid);

      case "ssl_install": {
        if (!params.domain) {
          setConv(adminJid, { intent, collected: params, missing: ["domain"], ts: Date.now() });
          return "🔒 Kis domain par SSL install karein? Domain name batao:";
        }
        return await cmdSslInstall(params.domain);
      }

      case "wp_fix_404": {
        const id = params.domain || params.email || "";
        if (!id) {
          setConv(adminJid, { intent, collected: params, missing: ["domain"], ts: Date.now() });
          return "🔧 Kis website ka WordPress 404 fix karein? Domain ya email batao:";
        }
        return await cmdWpFix404(id);
      }

      case "reset_password": {
        const id = params.domain || params.email || "";
        if (!id) {
          setConv(adminJid, { intent, collected: params, missing: ["domain"], ts: Date.now() });
          return "🔑 Kis account ka password reset karein? Domain ya email batao:";
        }
        if (!params.password) {
          setConv(adminJid, { intent, collected: { ...params, domain: id }, missing: ["password"], ts: Date.now() });
          return `🔑 *${id}* ke liye naya password batao (ya *auto* likh dein aur main generate kar deta hun):`;
        }
        const newPass = params.password?.toLowerCase() === "auto" ? undefined : params.password;
        return await cmdResetPassword(id, newPass);
      }

      case "site_check": {
        if (!params.domain) {
          setConv(adminJid, { intent, collected: params, missing: ["domain"], ts: Date.now() });
          return "🌐 Kaun sa domain check karein? Domain name batao:";
        }
        return await cmdSiteCheck(params.domain);
      }

      case "create_backup": {
        const id = params.domain || params.email || "";
        if (!id) {
          setConv(adminJid, { intent, collected: params, missing: ["domain"], ts: Date.now() });
          return "📦 Kis account ka backup banayein? Domain ya email batao:";
        }
        return await cmdCreateBackup(id);
      }

      case "disk_usage": {
        const id = params.domain || params.email || "";
        if (!id) {
          setConv(adminJid, { intent, collected: params, missing: ["domain"], ts: Date.now() });
          return "💾 Kis account ki disk usage dekhein? Domain ya email batao:";
        }
        return await cmdDiskUsage(id);
      }

      case "mark_paid": {
        if (!params.invoiceId && !params.email) {
          setConv(adminJid, { intent, collected: params, missing: ["invoiceId"], ts: Date.now() });
          return "🧾 Invoice number (e.g. NOE-02341) ya client email batao jis ka invoice paid mark karein:";
        }
        return await cmdMarkPaid(params);
      }

      case "fix_issue": {
        if (!params.issueDesc) {
          setConv(adminJid, { intent, collected: params, missing: ["issueDesc"], ts: Date.now() });
          return "🔧 Client ka issue describe karo (e.g.: 'email nahi aa raha', 'SSL error', 'cPanel login fail'):";
        }
        return await cmdFixIssue(params.issueDesc, params);
      }

      case "send_message": {
        if (!params.email && !params.phone) {
          setConv(adminJid, { intent, collected: params, missing: ["email"], ts: Date.now() });
          return "📧 Client email ya phone number batao:";
        }
        if (!params.clientMsg) {
          setConv(adminJid, { intent, collected: params, missing: ["clientMsg"], ts: Date.now() });
          return "💬 Client ko kya message bhejein?";
        }
        return await cmdSendMessage(params);
      }

      case "help":
        return cmdHelp();

      default:
        // Try to be helpful with unknown messages
        return [
          `🤖 *Noe* — Main samajh nahi saka.\n`,
          `Kuch aise try karo:`,
          `• *check domain kalahost.com*`,
          `• *add order ali@email.com kalasss.com*`,
          `• *info ali@email.com*`,
          `• *status*`,
          `• *help* (full commands list)`,
        ].join("\n");
    }
  } catch (err: any) {
    console.error(`[NOE-AGENT] Execute error (${intent}):`, err.message);
    return `❌ Error: ${err.message}\n\nRetry karo ya *help* type karo.`;
  }
}
