/**
 * Noehost WhatsApp Gateway — powered by Baileys (100% Free, no monthly fees)
 * QR-code authentication using your personal WhatsApp account
 */
import path from "path";
import { existsSync, mkdirSync } from "fs";
import qrcode from "qrcode";
import { db } from "@workspace/db";
import { whatsappLogsTable, settingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

// ── State ─────────────────────────────────────────────────────────────────────
type WaStatus = "disconnected" | "connecting" | "qr_ready" | "connected" | "error";

export interface WaState {
  status: WaStatus;
  qrDataUrl: string | null;
  qrRaw: string | null;
  connectedAt: Date | null;
  phone: string | null;
  error: string | null;
}

let state: WaState = {
  status: "disconnected",
  qrDataUrl: null,
  qrRaw: null,
  connectedAt: null,
  phone: null,
  error: null,
};

let sock: any = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const SESSION_DIR = path.join(process.cwd(), "whatsapp-session");

function ensureSessionDir() {
  if (!existsSync(SESSION_DIR)) mkdirSync(SESSION_DIR, { recursive: true });
}

export function getWaState(): WaState {
  return { ...state };
}

// ── Admin phone number (from DB settings) ────────────────────────────────────
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

// ── Silent Baileys logger (all child() calls return same silent object) ───────
const noop = () => {};
const baileysLogger: any = {
  level: "silent",
  trace: noop, debug: noop, info: noop,
  warn: noop, error: noop, fatal: noop,
  child() { return baileysLogger; },
};

// ── Connect ───────────────────────────────────────────────────────────────────
export async function connectWhatsApp() {
  if (state.status === "connected" || state.status === "connecting") {
    console.log("[WA] Already connecting/connected");
    return;
  }

  ensureSessionDir();
  state = { ...state, status: "connecting", qrDataUrl: null, qrRaw: null, error: null };
  console.log("[WA] Initializing connection…");

  try {
    const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } =
      await import("@whiskeysockets/baileys");

    const { state: authState, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1023561584] as [number, number, number] }));

    sock = makeWASocket({
      version,
      auth: {
        creds: authState.creds,
        keys: makeCacheableSignalKeyStore(authState.keys, baileysLogger),
      },
      printQRInTerminal: false,
      browser: ["Noehost", "Chrome", "1.0"],
      logger: baileysLogger,
    });

    // QR code event
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
        const shouldReconnect = code !== DisconnectReason.loggedOut;

        console.log("[WA] Connection closed, code:", code, "reconnect:", shouldReconnect);
        sock = null;
        state = { ...state, status: "disconnected", phone: null, connectedAt: null };

        if (shouldReconnect) {
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
      }
    });

    sock.ev.on("creds.update", saveCreds);
  } catch (err: any) {
    console.error("[WA] Connection error:", err.message);
    state = { ...state, status: "error", error: err.message };
  }
}

// ── Disconnect ────────────────────────────────────────────────────────────────
export async function disconnectWhatsApp() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (sock) {
    try { await sock.logout(); } catch { sock.end(); }
    sock = null;
  }
  state = { status: "disconnected", qrDataUrl: null, qrRaw: null, connectedAt: null, phone: null, error: null };
  console.log("[WA] Disconnected and session cleared");
}

// ── Send alert ────────────────────────────────────────────────────────────────
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

  // Normalize phone: strip everything except digits, ensure no leading zeros or +
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.length < 7) {
    console.log("[WA] Client phone too short — skipping:", rawPhone);
    return false;
  }

  const jid = `${digits}@s.whatsapp.net`;
  try {
    await sock.sendMessage(jid, { text: message });
    console.log(`[WA] Client notification sent (${eventType}) → ${rawPhone}`);
    await logAlert(eventType, message, "sent");
    return true;
  } catch (err: any) {
    console.error("[WA] Client send failed:", err.message);
    await logAlert(eventType, message, "failed", err.message);
    return false;
  }
}

// ── Auto-reconnect on server start (if session exists) ───────────────────────
export async function initWhatsApp() {
  ensureSessionDir();
  const credFile = path.join(SESSION_DIR, "creds.json");
  if (existsSync(credFile)) {
    console.log("[WA] Found existing session — auto-connecting…");
    connectWhatsApp().catch(err => console.error("[WA] Auto-connect failed:", err.message));
  } else {
    console.log("[WA] No session found — waiting for admin to connect via QR");
  }
}
