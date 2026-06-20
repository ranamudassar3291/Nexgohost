/**
 * Noehost WhatsApp Gateway — powered by Baileys (100% Free, no monthly fees)
 * QR-code authentication using your personal WhatsApp account
 *
 * Features:
 *  - Persistent session with auto-reconnect
 *  - Admin alert messages (orders, tickets, payments)
 *  - Client alert messages (new order confirm, suspension warning, invoice paid)
 *  - Remote admin command engine (!status, !suspend, !unsuspend, !terminate, !info)
 *  - Pakistan phone number auto-formatting (adds 92 country code)
 */
import path from "path";
import { existsSync, mkdirSync } from "fs";
import qrcode from "qrcode";
import { db } from "@workspace/db";
import {
  whatsappLogsTable,
  settingsTable,
  hostingServicesTable,
  usersTable,
  invoicesTable,
} from "@workspace/db/schema";
import { eq, or, ilike, sql, and } from "drizzle-orm";
import { suspendHostingAccount, unsuspendHostingAccount } from "./provision.js";

// ── State ─────────────────────────────────────────────────────────────────────
type WaStatus = "disconnected" | "connecting" | "qr_ready" | "connected" | "error";

export interface WaState {
  status: WaStatus;
  qrDataUrl: string | null;
  qrRaw: string | null;
  connectedAt: Date | null;
  phone: string | null;
  error: string | null;
  sessionInDb: boolean;
}

let state: WaState = {
  status: "disconnected",
  qrDataUrl: null,
  qrRaw: null,
  connectedAt: null,
  phone: null,
  error: null,
  sessionInDb: false,
};

let sock: any = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const SESSION_DIR = path.join(process.cwd(), "whatsapp-session");

function ensureSessionDir() {
  if (!existsSync(SESSION_DIR)) mkdirSync(SESSION_DIR, { recursive: true });
}

// ── Baileys availability check ────────────────────────────────────────────────
let _baileysAvailable: boolean | null = null;
async function isBaileysAvailable(): Promise<boolean> {
  if (_baileysAvailable !== null) return _baileysAvailable;
  try {
    await import("@whiskeysockets/baileys");
    _baileysAvailable = true;
  } catch {
    _baileysAvailable = false;
    console.warn("[WA] @whiskeysockets/baileys not available — WhatsApp features disabled");
  }
  return _baileysAvailable;
}

// ── Pure DB-based auth state (no disk dependency) ────────────────────────────
// Replaces useMultiFileAuthState — reads/writes creds + signal keys directly
// from PostgreSQL. Works across container restarts and ephemeral environments.
async function useDbAuthState() {
  const { initAuthCreds, BufferJSON, proto } = await import("@whiskeysockets/baileys");

  // Load existing session from DB
  let creds: any = null;
  const keysInMemory: Record<string, any> = {};
  let hasSession = false;

  try {
    const result = await db.execute(sql`SELECT data FROM wa_sessions WHERE id = 'default' LIMIT 1`);
    const row = (result as any).rows?.[0];
    if (row?.data) {
      const stored = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
      if (stored.creds) {
        creds = JSON.parse(JSON.stringify(stored.creds), BufferJSON.reviver);
        hasSession = true;
      }
      if (stored.keys && typeof stored.keys === "object") {
        for (const [k, v] of Object.entries(stored.keys as Record<string, any>)) {
          keysInMemory[k] = JSON.parse(JSON.stringify(v), BufferJSON.reviver);
        }
      }
      console.log(`[WA] Session loaded from DB ✓ (${Object.keys(keysInMemory).length} keys)`);
    }
  } catch (err: any) {
    console.warn("[WA] DB session load failed:", err.message);
  }

  if (!creds) creds = initAuthCreds();

  const saveToDb = async () => {
    try {
      const payload = {
        creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
        keys: JSON.parse(JSON.stringify(keysInMemory, BufferJSON.replacer)),
      };
      await db.execute(sql`
        INSERT INTO wa_sessions (id, data, updated_at)
        VALUES ('default', ${JSON.stringify(payload)}::jsonb, NOW())
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
      `);
      state = { ...state, sessionInDb: true };
      console.log("[WA] ✓ Session saved to DB");
    } catch (err: any) {
      console.error("[WA] ✗ Session DB save failed:", err.message);
    }
  };

  return {
    hasSession,
    state: {
      creds,
      keys: {
        get: (type: string, ids: string[]) => {
          const data: Record<string, any> = {};
          for (const id of ids) {
            const val = keysInMemory[`${type}:${id}`];
            if (val != null) data[id] = val;
          }
          return data;
        },
        set: async (data: Record<string, Record<string, any>>) => {
          for (const [type, map] of Object.entries(data)) {
            for (const [id, value] of Object.entries(map ?? {})) {
              const k = `${type}:${id}`;
              if (value != null) keysInMemory[k] = value;
              else delete keysInMemory[k];
            }
          }
          await saveToDb();
        },
      },
    },
    saveCreds: saveToDb,
  };
}

async function clearDbSession(): Promise<void> {
  try {
    await db.execute(sql`DELETE FROM wa_sessions WHERE id = 'default'`);
    state = { ...state, sessionInDb: false };
    console.log("[WA] DB session cleared");
  } catch (err: any) {
    console.warn("[WA] Could not clear DB session:", err.message);
  }
}

export function getWaState(): WaState {
  return { ...state };
}

// ── Admin phone number (from DB settings) ─────────────────────────────────────
export async function getAdminPhone(): Promise<string | null> {
  try {
    const rows = await db.select().from(settingsTable)
      .where(eq(settingsTable.key, "whatsapp_admin_phone")).limit(1);
    return rows[0]?.value || null;
  } catch { return null; }
}

export async function setAdminPhone(phone: string) {
  const existing = await db.select().from(settingsTable)
    .where(eq(settingsTable.key, "whatsapp_admin_phone")).limit(1);
  if (existing.length > 0) {
    await db.update(settingsTable).set({ value: phone })
      .where(eq(settingsTable.key, "whatsapp_admin_phone"));
  } else {
    await db.insert(settingsTable).values({ key: "whatsapp_admin_phone", value: phone });
  }
}

// ── Log ───────────────────────────────────────────────────────────────────────
async function logAlert(eventType: string, message: string, status: "sent" | "failed", errorMessage?: string) {
  try {
    await db.insert(whatsappLogsTable).values({
      eventType: eventType as any,
      message: message.substring(0, 500),
      status,
      errorMessage: errorMessage?.substring(0, 300),
    });
  } catch (err) {
    console.warn("[WA] Log write failed:", err);
  }
}

// ── Silent Baileys logger ─────────────────────────────────────────────────────
const noop = () => {};
const baileysLogger: any = {
  level: "silent",
  trace: noop, debug: noop, info: noop,
  warn: noop, error: noop, fatal: noop,
  child() { return baileysLogger; },
};

// ── Phone number formatting (Pakistan 92 country code auto-add) ───────────────
/**
 * Normalises a raw phone number to E.164 digits only (no +).
 * Pakistan-specific rules:
 *   0300XXXXXXX  (11 digits, starts with 0) → 92300XXXXXXX
 *   300XXXXXXX   (10 digits, no country code) → 92300XXXXXXX
 *   Already has 92… → unchanged
 *   Other country codes → unchanged
 */
export function formatPKPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return digits;
  // Pakistani mobile: starts with 03XX (11 digits) or 3XX (10 digits)
  if (digits.length === 11 && digits.startsWith("0")) return "92" + digits.slice(1);
  if (digits.length === 10 && !digits.startsWith("9")) return "92" + digits;
  return digits;
}

// ── Pending terminations (in-memory confirmation store, 5 min TTL) ───────────
const pendingTerminations = new Map<string, number>();

function cleanExpiredTerminations() {
  const now = Date.now();
  for (const [key, ts] of pendingTerminations.entries()) {
    if (now - ts > 5 * 60 * 1000) pendingTerminations.delete(key);
  }
}

// ── Admin Command Engine ───────────────────────────────────────────────────────

async function cmdStatus(): Promise<string> {
  const [activeRow] = await db.select({ count: sql<number>`count(*)::int` })
    .from(hostingServicesTable).where(eq(hostingServicesTable.status, "active"));
  const [suspRow] = await db.select({ count: sql<number>`count(*)::int` })
    .from(hostingServicesTable).where(eq(hostingServicesTable.status, "suspended"));
  const [termRow] = await db.select({ count: sql<number>`count(*)::int` })
    .from(hostingServicesTable).where(eq(hostingServicesTable.status, "terminated"));
  const [unpaidRow] = await db.select({ count: sql<number>`count(*)::int` })
    .from(invoicesTable).where(eq(invoicesTable.status, "unpaid"));
  const [overdueRow] = await db.select({ count: sql<number>`count(*)::int` })
    .from(invoicesTable).where(eq(invoicesTable.status, "overdue"));
  const [clientRow] = await db.select({ count: sql<number>`count(*)::int` })
    .from(usersTable).where(eq(usersTable.role, "client"));

  const time = new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" });
  return [
    "📊 *Noehost System Status*",
    "",
    `👥 Total Clients: ${clientRow.count}`,
    `✅ Active Services: ${activeRow.count}`,
    `⏸️ Suspended Services: ${suspRow.count}`,
    `🗑️ Terminated Services: ${termRow.count}`,
    `💳 Unpaid Invoices: ${unpaidRow.count}`,
    `⚠️ Overdue Invoices: ${overdueRow.count}`,
    "",
    `🕐 _${time}_`,
  ].join("\n");
}

async function findServiceByIdOrDomain(identifier: string) {
  const trimmed = identifier.trim();
  // Try UUID first
  const [byId] = await db.select().from(hostingServicesTable)
    .where(eq(hostingServicesTable.id, trimmed)).limit(1);
  if (byId) return byId;
  // Try domain
  const [byDomain] = await db.select().from(hostingServicesTable)
    .where(ilike(hostingServicesTable.domain, trimmed)).limit(1);
  if (byDomain) return byDomain;
  // Try username
  const [byUser] = await db.select().from(hostingServicesTable)
    .where(ilike(hostingServicesTable.username, trimmed)).limit(1);
  return byUser || null;
}

async function cmdSuspend(identifier: string): Promise<string> {
  const service = await findServiceByIdOrDomain(identifier);
  if (!service) return `❌ No service found for: *${identifier}*`;
  if (service.status === "suspended") return `⏸️ *${service.domain || service.planName}* is already suspended.`;

  try {
    if (service.username) {
      await suspendHostingAccount(service.username, service.serverId, "Admin WA command");
    }
  } catch (e: any) {
    console.warn("[WA-CMD] suspend provision warning:", e.message);
  }

  await db.update(hostingServicesTable)
    .set({ status: "suspended", updatedAt: new Date() })
    .where(eq(hostingServicesTable.id, service.id));

  await logAlert("admin_command", `!suspend ${identifier}`, "sent");
  return `✅ *${service.domain || service.planName}* has been suspended.\nClient ID: ${service.clientId}`;
}

async function cmdUnsuspend(identifier: string): Promise<string> {
  const service = await findServiceByIdOrDomain(identifier);
  if (!service) return `❌ No service found for: *${identifier}*`;
  if (service.status === "active") return `✅ *${service.domain || service.planName}* is already active.`;

  try {
    if (service.username) {
      await unsuspendHostingAccount(service.username, service.serverId);
    }
  } catch (e: any) {
    console.warn("[WA-CMD] unsuspend provision warning:", e.message);
  }

  await db.update(hostingServicesTable)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(hostingServicesTable.id, service.id));

  await logAlert("admin_command", `!unsuspend ${identifier}`, "sent");
  return `✅ *${service.domain || service.planName}* has been unsuspended and is now active.`;
}

async function cmdTerminateRequest(identifier: string): Promise<string> {
  const service = await findServiceByIdOrDomain(identifier);
  if (!service) return `❌ No service found for: *${identifier}*`;

  cleanExpiredTerminations();
  pendingTerminations.set(identifier.toLowerCase(), Date.now());

  return [
    `⚠️ *Termination Confirmation Required*`,
    ``,
    `Service: *${service.domain || service.planName}*`,
    `Status: ${service.status}`,
    `Client ID: ${service.clientId}`,
    ``,
    `To permanently terminate this service, reply:`,
    `*!terminate confirm ${identifier}*`,
    ``,
    `⏳ Confirmation expires in 5 minutes.`,
  ].join("\n");
}

async function cmdTerminateConfirm(identifier: string): Promise<string> {
  cleanExpiredTerminations();
  const pending = pendingTerminations.get(identifier.toLowerCase());
  if (!pending) return `❌ No pending termination found for *${identifier}*. Run *!terminate ${identifier}* first.`;
  if (Date.now() - pending > 5 * 60 * 1000) {
    pendingTerminations.delete(identifier.toLowerCase());
    return `⏰ Termination confirmation for *${identifier}* has expired. Run !terminate again.`;
  }

  const service = await findServiceByIdOrDomain(identifier);
  if (!service) return `❌ Service not found: *${identifier}*`;

  // Suspend externally first to prevent access
  try {
    if (service.username) {
      await suspendHostingAccount(service.username, service.serverId, "Terminated via WA command");
    }
  } catch { /* non-fatal */ }

  await db.update(hostingServicesTable)
    .set({ status: "terminated", updatedAt: new Date() })
    .where(eq(hostingServicesTable.id, service.id));

  pendingTerminations.delete(identifier.toLowerCase());
  await logAlert("admin_command", `!terminate confirm ${identifier}`, "sent");

  return `🗑️ *${service.domain || service.planName}* has been terminated.\nStatus updated to terminated in database.`;
}

async function cmdInfo(query: string): Promise<string> {
  const trimmed = query.trim();

  const users = await db.select().from(usersTable)
    .where(or(
      ilike(usersTable.email, `%${trimmed}%`),
      ilike(usersTable.firstName, `%${trimmed}%`),
      ilike(usersTable.lastName, `%${trimmed}%`),
    )!).limit(3);

  if (!users.length) return `❌ No client found matching: *${trimmed}*`;

  const lines: string[] = [];
  for (const user of users) {
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "—";
    const services = await db.select({ status: hostingServicesTable.status, domain: hostingServicesTable.domain })
      .from(hostingServicesTable).where(eq(hostingServicesTable.clientId, user.id)).limit(5);
    const unpaid = await db.select({ count: sql<number>`count(*)::int` })
      .from(invoicesTable).where(and(eq(invoicesTable.clientId, user.id), eq(invoicesTable.status, "unpaid")));

    lines.push(
      `👤 *${name}*`,
      `📧 ${user.email}`,
      `📱 ${user.phone ? formatPKPhone(user.phone) : "—"}`,
      `📦 Services: ${services.map(s => `${s.domain || "?"} (${s.status})`).join(", ") || "none"}`,
      `💳 Unpaid Invoices: ${unpaid[0]?.count ?? 0}`,
      `🏷️ Status: ${user.status}`,
      `─────────────────`,
    );
  }

  return lines.join("\n");
}

async function handleAdminCommand(text: string): Promise<string | null> {
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase();
  const args = parts.slice(1);
  const arg = args.join(" ").trim();

  try {
    switch (cmd) {
      case "!help":
        return [
          "🤖 *Noehost Admin Commands*",
          "",
          "*!status* — System stats",
          "*!suspend [id/domain]* — Suspend a hosting service",
          "*!unsuspend [id/domain]* — Reactivate a service",
          "*!terminate [id/domain]* — Terminate (confirm required)",
          "*!terminate confirm [id/domain]* — Confirm termination",
          "*!info [name/email]* — Look up a client",
          "*!help* — Show this list",
        ].join("\n");

      case "!status":
        return await cmdStatus();

      case "!suspend":
        if (!arg) return "Usage: *!suspend [service_id or domain]*";
        return await cmdSuspend(arg);

      case "!unsuspend":
        if (!arg) return "Usage: *!unsuspend [service_id or domain]*";
        return await cmdUnsuspend(arg);

      case "!terminate":
        if (args[0]?.toLowerCase() === "confirm") {
          const id = args.slice(1).join(" ").trim();
          if (!id) return "Usage: *!terminate confirm [service_id or domain]*";
          return await cmdTerminateConfirm(id);
        }
        if (!arg) return "Usage: *!terminate [service_id or domain]*";
        return await cmdTerminateRequest(arg);

      case "!info":
        if (!arg) return "Usage: *!info [client name or email]*";
        return await cmdInfo(arg);

      default:
        return null; // Not a recognised command — ignore
    }
  } catch (err: any) {
    console.error("[WA-CMD] Error:", err.message);
    return `❌ Command failed: ${err.message}`;
  }
}

// ── Connect ───────────────────────────────────────────────────────────────────
export async function connectWhatsApp() {
  if (state.status === "connected" || state.status === "connecting") {
    console.log("[WA] Already connecting/connected");
    return;
  }

  ensureSessionDir();
  if (!await isBaileysAvailable()) {
    state = { ...state, status: "error", error: "WhatsApp package not available in this environment" };
    return;
  }

  state = { ...state, status: "connecting", qrDataUrl: null, qrRaw: null, error: null };
  console.log("[WA] Initializing connection…");

  try {
    const { default: makeWASocket, DisconnectReason, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } =
      await import("@whiskeysockets/baileys");

    // Pure DB auth state — no disk files, works on ephemeral containers
    const { hasSession: dbHasSession, state: authState, saveCreds } = await useDbAuthState();
    if (dbHasSession) {
      console.log("[WA] Resuming session from DB — no QR needed");
    }

    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1023561584] as [number, number, number] }));

    sock = makeWASocket({
      version,
      auth: {
        creds: authState.creds,
        keys: makeCacheableSignalKeyStore(authState.keys, baileysLogger),
      },
      printQRInTerminal: false,
      browser: ["NoePanel", "Chrome", "120.0.6099.109"],
      logger: baileysLogger,
      keepAliveIntervalMs: 25000,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      fireInitQueries: true,
    });

    // QR code + connection events
    sock.ev.on("connection.update", async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log("[WA] QR code received — admin must scan within 60s");
        try {
          const dataUrl = await qrcode.toDataURL(qr, { width: 300, margin: 2 });
          state = { ...state, status: "qr_ready", qrDataUrl: dataUrl, qrRaw: qr, error: null };
        } catch { state = { ...state, status: "qr_ready", qrRaw: qr, error: null }; }
      }

      if (connection === "close") {
        const code = (lastDisconnect?.error as any)?.output?.statusCode;
        const isLoggedOut = code === DisconnectReason.loggedOut;

        console.log("[WA] Connection closed, code:", code, "loggedOut:", isLoggedOut);
        sock = null;
        state = { ...state, status: "disconnected", phone: null, connectedAt: null };

        if (isLoggedOut) {
          // Do NOT clear session automatically — admin must disconnect manually
          // Session preserved in DB; send alert so admin knows to reconnect
          console.warn("[WA] Logged out by WhatsApp — session preserved in DB. Admin must reconnect from panel.");
          // Non-blocking email alert (best effort)
          import("./email.js").then(({ emailGeneric }) => {
            emailGeneric(
              "admin@noehost.com",
              "⚠️ WhatsApp Session Logged Out",
              `Your WhatsApp bot was remotely logged out at ${new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}.\n\nPlease go to Admin → WhatsApp Settings and reconnect by scanning the QR code.\n\nYour previous session data has been preserved in the database.`,
              {},
            ).catch(() => {});
          }).catch(() => {});
        } else {
          // Transient disconnect — auto-reconnect
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            console.log("[WA] Auto-reconnecting…");
            connectWhatsApp().catch(console.error);
          }, 8000);
        }
      }

      if (connection === "open") {
        const phone = sock?.user?.id?.split(":")?.[0] ?? "unknown";
        state = { ...state, status: "connected", qrDataUrl: null, qrRaw: null, connectedAt: new Date(), phone, error: null };
        console.log(`[WA] Connected as +${phone}`);
        // Persist fresh session to DB on successful connect
        await saveCreds();
      }
    });

    sock.ev.on("creds.update", saveCreds);

    // ── Incoming message handler — Noe AI Admin Agent ────────────────────────
    // Track message IDs that the bot itself sent — prevents echo loops when
    // admin uses their own number (fromMe: true messages from self-chat)
    const botSentIds = new Set<string>();

    sock.ev.on("messages.upsert", async ({ messages: msgs, type }: any) => {
      // "notify" = incoming from others; "append" = sent from admin's own phone (same number as bot)
      // We must handle BOTH so admin self-chat commands work
      if (type !== "notify" && type !== "append") return;

      const adminPhone = await getAdminPhone();
      if (!adminPhone) return;
      const adminJid = `${adminPhone.replace(/\D/g, "")}@s.whatsapp.net`;

      for (const msg of msgs) {
        // Only care about messages in the admin's JID (self-chat or incoming)
        if (msg.key.remoteJid !== adminJid) continue;

        // Skip echo: messages that the bot itself sent as replies
        const msgId = msg.key.id ?? "";
        if (botSentIds.has(msgId)) {
          botSentIds.delete(msgId);
          continue;
        }

        // Extract text from any message type
        const text = (
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.ephemeralMessage?.message?.conversation ||
          msg.message?.ephemeralMessage?.message?.extendedTextMessage?.text ||
          ""
        ).trim();

        if (!text) continue;

        // Skip automated system alerts the bot itself sends (prevent re-processing)
        if (text.includes("🤖 *Noe Assistant*") || text.includes("NoePanel") || text.includes("Auto-check runs")) continue;

        console.log(`[NOE-AGENT] Admin msg (type=${type} fromMe=${msg.key.fromMe}): ${text.slice(0, 80)}`);

        // Mark as read
        try { await sock.readMessages([msg.key]); } catch { /* non-fatal */ }

        try {
          let reply: string | null = null;
          if (text.startsWith("!")) {
            reply = await handleAdminCommand(text);
          }
          if (!reply || !text.startsWith("!")) {
            const { noeAgent } = await import("./noe-agent.js");
            reply = await noeAgent(text, adminJid, sock);
          }
          if (reply && sock) {
            // Prefix every reply with bot identity so admin can distinguish bot replies
            const fullReply = `🤖 *Noe Assistant*\n${reply}`;
            const sent = await sock.sendMessage(adminJid, { text: fullReply });
            if (sent?.key?.id) {
              botSentIds.add(sent.key.id);
              setTimeout(() => botSentIds.delete(sent!.key.id!), 30_000);
            }
          }
        } catch (err: any) {
          console.error("[NOE-AGENT] Handler error:", err.message);
          try {
            if (sock) {
              const errSent = await sock.sendMessage(adminJid, {
                text: `🤖 *Noe Assistant*\n❌ Error: ${err.message}\n\nType *help* for commands.`,
              });
              if (errSent?.key?.id) {
                botSentIds.add(errSent.key.id);
                setTimeout(() => botSentIds.delete(errSent!.key.id!), 30_000);
              }
            }
          } catch { /* ignore */ }
        }
      }
    });

  } catch (err: any) {
    console.error("[WA] Connection error:", err.message);
    state = { ...state, status: "error", error: err.message };
  }
}

// ── Disconnect ────────────────────────────────────────────────────────────────
export async function disconnectWhatsApp() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (sock) {
    try { sock.end(); } catch { /* ignore */ }
    sock = null;
  }
  state = { status: "disconnected", qrDataUrl: null, qrRaw: null, connectedAt: null, phone: null, error: null };
  console.log("[WA] Disconnected (session files preserved — will auto-reconnect on next init)");
}

export async function clearWhatsAppSession() {
  await disconnectWhatsApp();
  // Clear DB session first
  await clearDbSession();
  // Clear disk session files
  const { rmSync, readdirSync } = await import("fs");
  try {
    const files = readdirSync(SESSION_DIR);
    for (const f of files) rmSync(path.join(SESSION_DIR, f), { recursive: true, force: true });
    console.log("[WA] Session files cleared — fresh QR will be required");
  } catch { /* dir may not exist */ }
  state = { status: "disconnected", qrDataUrl: null, qrRaw: null, connectedAt: null, phone: null, error: null, sessionInDb: false };
}

// ── Send alert to admin ───────────────────────────────────────────────────────
export async function sendWhatsAppAlert(eventType: string, message: string): Promise<boolean> {
  if (state.status !== "connected" || !sock) {
    console.log("[WA] Not connected — skipping alert:", eventType);
    await logAlert(eventType, message, "failed", "WhatsApp not connected");
    return false;
  }

  const adminPhone = await getAdminPhone();
  if (!adminPhone) {
    console.log("[WA] Admin phone not configured — skipping alert");
    await logAlert(eventType, message, "failed", "Admin phone not configured");
    return false;
  }

  const jid = `${adminPhone.replace(/\D/g, "")}@s.whatsapp.net`;

  try {
    await sock.sendMessage(jid, { text: message });
    console.log(`[WA] Alert sent (${eventType}) → ${adminPhone}`);
    await logAlert(eventType, message, "sent");
    return true;
  } catch (err: any) {
    console.error("[WA] Send failed:", err.message);
    await logAlert(eventType, message, "failed", err.message);
    return false;
  }
}

// ── Send to a specific client phone number ────────────────────────────────────
export async function sendToClientPhone(rawPhone: string, message: string, eventType = "client_notification"): Promise<boolean> {
  if (state.status !== "connected" || !sock) {
    console.log("[WA] Not connected — skipping client notification:", eventType);
    await logAlert(eventType, message, "failed", "WhatsApp not connected");
    return false;
  }

  const normalised = formatPKPhone(rawPhone);
  if (normalised.length < 7) {
    console.log("[WA] Client phone too short — skipping:", rawPhone);
    return false;
  }

  const jid = `${normalised}@s.whatsapp.net`;
  try {
    await sock.sendMessage(jid, { text: message });
    console.log(`[WA] Client notification sent (${eventType}) → +${normalised}`);
    await logAlert(eventType, message, "sent");
    return true;
  } catch (err: any) {
    console.error("[WA] Client send failed:", err.message);
    await logAlert(eventType, message, "failed", err.message);
    return false;
  }
}

// ── Payment info helper — reads configurable bank/payment details from DB ─────
export async function getPaymentInfo(): Promise<string> {
  try {
    const { settingsTable } = await import("@workspace/db/schema");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(settingsTable)
      .where(eq(settingsTable.key, "payment_whatsapp_info")).limit(1);
    if (row?.value?.trim()) return row.value.trim();
  } catch { /* non-fatal */ }
  return "";
}

// ── Auto-reconnect on server start (if session exists) ───────────────────────
export async function initWhatsApp() {
  ensureSessionDir();

  // Always auto-start — useDbAuthState handles loading from DB or fresh QR
  // DB is the only source of truth (no disk dependency)
  console.log("[WA] Auto-starting WhatsApp connection…");
  connectWhatsApp().catch(err => console.error("[WA] Auto-connect failed:", err.message));
}
