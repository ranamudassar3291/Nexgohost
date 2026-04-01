/**
 * Noehost Iron-Clad Security Engine
 * - In-memory IP rate limiter (3 attempts/min → 30-min DB block)
 * - Bad-bot blocker (403 on scanner UAs)
 * - Cloudflare Turnstile / Google reCAPTCHA v2 server-side verification
 * - DB-persisted blocked IPs (survives restarts)
 * - IP Whitelist (bypass auto-block for whitelisted IPs)
 * - Migration Whitelist (allow full API/DB access from migration IPs)
 */

import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import {
  securityLogsTable, blockedIpsTable, settingsTable,
  ipWhitelistTable, migrationWhitelistTable,
} from "@workspace/db/schema";
import { eq, gt } from "drizzle-orm";

// ── In-memory attempt tracker ─────────────────────────────────────────────────
interface AttemptBucket {
  count: number;
  windowStart: number;
}
const ipAttempts = new Map<string, AttemptBucket>();
const WINDOW_MS = 60_000;        // 1 minute sliding window
const MAX_ATTEMPTS = 3;           // before block (brute-force threshold)
const BLOCK_MINUTES = 30;         // block duration

export function getClientIp(req: Request): string {
  return (
    (req.headers["cf-connecting-ip"] as string) ||
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

// ── DB-backed blocked IP check (loaded fresh per request) ────────────────────
export async function isIpBlockedInDb(ip: string): Promise<boolean> {
  const now = new Date();
  const [row] = await db.select().from(blockedIpsTable)
    .where(eq(blockedIpsTable.ipAddress, ip)).limit(1);
  if (!row) return false;
  if (row.blockedUntil <= now) {
    // Block expired — remove
    await db.delete(blockedIpsTable).where(eq(blockedIpsTable.ipAddress, ip));
    return false;
  }
  return true;
}

// ── Whitelist checks ──────────────────────────────────────────────────────────
export async function isIpWhitelisted(ip: string): Promise<boolean> {
  try {
    const [row] = await db.select().from(ipWhitelistTable)
      .where(eq(ipWhitelistTable.ipAddress, ip)).limit(1);
    return !!row;
  } catch { return false; }
}

export async function isIpInMigrationWhitelist(ip: string): Promise<boolean> {
  try {
    const [row] = await db.select().from(migrationWhitelistTable)
      .where(eq(migrationWhitelistTable.ipAddress, ip)).limit(1);
    return !!row;
  } catch { return false; }
}

// ── Record a failed attempt and auto-block if threshold exceeded ──────────────
export async function recordFailedAttempt(
  ip: string,
  req: Request,
  email?: string,
): Promise<{ blocked: boolean }> {
  const now = Date.now();

  // Never auto-block whitelisted IPs
  const whitelisted = await isIpWhitelisted(ip);
  if (whitelisted) return { blocked: false };

  let bucket = ipAttempts.get(ip);
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    bucket = { count: 0, windowStart: now };
  }
  bucket.count++;
  ipAttempts.set(ip, bucket);

  // Log the failed attempt
  await db.insert(securityLogsTable).values({
    event: "login_failed",
    ipAddress: ip,
    userAgent: req.headers["user-agent"] ?? null,
    email: email ?? null,
    path: req.path,
    details: `Failed attempt ${bucket.count}/${MAX_ATTEMPTS}`,
    blocked: false,
  }).catch(() => {});

  if (bucket.count >= MAX_ATTEMPTS) {
    // Auto-block in DB
    const blockedUntil = new Date(Date.now() + BLOCK_MINUTES * 60_000);
    await db.insert(blockedIpsTable).values({
      ipAddress: ip,
      reason: `Brute force: ${bucket.count} failed attempts in ${WINDOW_MS / 1000}s`,
      failedAttempts: bucket.count,
      blockedUntil,
    }).onConflictDoUpdate({
      target: blockedIpsTable.ipAddress,
      set: {
        failedAttempts: bucket.count,
        blockedUntil,
        reason: `Brute force: ${bucket.count} failed attempts in ${WINDOW_MS / 1000}s`,
      },
    }).catch(() => {});

    await db.insert(securityLogsTable).values({
      event: "brute_force",
      ipAddress: ip,
      email: email ?? null,
      path: req.path,
      userAgent: req.headers["user-agent"] ?? null,
      details: `IP auto-blocked for ${BLOCK_MINUTES} minutes`,
      blocked: true,
    }).catch(() => {});

    ipAttempts.delete(ip);
    return { blocked: true };
  }

  return { blocked: false };
}

// ── Bad-bot UA patterns ───────────────────────────────────────────────────────
const BAD_BOT_UA_PATTERNS = [
  /sqlmap/i, /nikto/i, /masscan/i, /nmap/i, /zgrab/i, /python-requests\/[0-9]/i,
  /scrapy/i, /curl\/[0-9]/i, /wget\/[0-9]/i, /libwww/i, /lwp-trivial/i,
  /Go-http-client\/1/i, /dirbuster/i, /gobuster/i, /hydra/i, /medusa/i,
  /burpsuite/i, /acunetix/i, /nessus/i, /havij/i, /pangolin/i, /webshag/i,
];

const BAD_BOT_PATHS = [
  /\.env$/, /wp-admin/, /\.php$/, /xmlrpc\.php/, /\.git\//, /setup\.php/,
  /admin\.php/, /install\.php/, /config\.php/, /backup\.(zip|sql|tar)/i,
  /\/etc\/passwd/, /select.*from/i, /union.*select/i,
];

export function badBotMiddleware(req: Request, res: Response, next: NextFunction) {
  const ua = req.headers["user-agent"] ?? "";
  const path = req.path;

  // Trusted system API requests (website-to-panel sync) bypass the bot filter.
  // The key is validated by validateSystemApiKey() on the route itself.
  if (req.headers["x-system-api-key"]) return next();

  // Block bad bots by UA
  if (BAD_BOT_UA_PATTERNS.some(p => p.test(ua))) {
    db.insert(securityLogsTable).values({
      event: "bot_blocked",
      ipAddress: getClientIp(req),
      userAgent: ua,
      path,
      details: "Blocked by User-Agent pattern",
      blocked: true,
    }).catch(() => {});
    return res.status(403).json({ error: "Forbidden" });
  }

  // Block suspicious path probes
  if (BAD_BOT_PATHS.some(p => p.test(path))) {
    db.insert(securityLogsTable).values({
      event: "suspicious_scan",
      ipAddress: getClientIp(req),
      userAgent: ua,
      path,
      details: "Blocked by path probe pattern",
      blocked: true,
    }).catch(() => {});
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
}

// ── IP block middleware (DB-backed, whitelist bypasses) ────────────────────────
export async function ipBlockMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only guard sensitive auth routes
  const sensitiveRoutes = ["/api/auth/login", "/api/auth/register", "/api/auth/forgot-password"];
  if (!sensitiveRoutes.some(r => req.path.startsWith(r.replace("/api", "")))) {
    return next();
  }

  const ip = getClientIp(req);

  // Whitelisted IPs always get through
  const whitelisted = await isIpWhitelisted(ip).catch(() => false);
  if (whitelisted) return next();

  const blocked = await isIpBlockedInDb(ip);
  if (blocked) {
    await db.insert(securityLogsTable).values({
      event: "login_blocked",
      ipAddress: ip,
      path: req.path,
      userAgent: req.headers["user-agent"] ?? null,
      details: "IP is temporarily blocked",
      blocked: true,
    }).catch(() => {});
    return res.status(429).json({
      error: "Too many failed attempts. Your IP has been temporarily blocked for 30 minutes.",
      code: "IP_BLOCKED",
    });
  }
  next();
}

// ── Captcha verification ──────────────────────────────────────────────────────
export async function verifyCaptcha(token: string, secretKey: string, provider: "turnstile" | "recaptcha"): Promise<boolean> {
  // Turnstile always-pass test secret
  if (secretKey === "1x0000000000000000000000000000000AA" || secretKey === "test_secret") return true;

  try {
    const url = provider === "turnstile"
      ? "https://challenges.cloudflare.com/turnstile/v0/siteverify"
      : "https://www.google.com/recaptcha/api/siteverify";

    const body = provider === "turnstile"
      ? JSON.stringify({ secret: secretKey, response: token })
      : new URLSearchParams({ secret: secretKey, response: token }).toString();

    const headers = provider === "turnstile"
      ? { "Content-Type": "application/json" }
      : { "Content-Type": "application/x-www-form-urlencoded" };

    const res = await fetch(url, { method: "POST", headers, body });
    const data = await res.json() as { success: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

// ── Settings helpers ──────────────────────────────────────────────────────────
export async function getSecuritySetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(settingsTable)
    .where(eq(settingsTable.key, key)).limit(1);
  return row?.value ?? null;
}

export async function setSecuritySetting(key: string, value: string): Promise<void> {
  await db.insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value } });
}

export interface SecurityConfig {
  provider: "turnstile" | "recaptcha";
  siteKey: string;
  secretKey: string;
  enabledPages: {
    login: boolean;
    register: boolean;
    domainSearch: boolean;
    forgotPassword: boolean;
    contactForm: boolean;
    checkout: boolean;
    supportTicket: boolean;
  };
}

export async function getSecurityConfig(): Promise<SecurityConfig> {
  const [provider, siteKey, secretKey, enabledPagesRaw] = await Promise.all([
    getSecuritySetting("security.captcha.provider"),
    getSecuritySetting("security.captcha.site_key"),
    getSecuritySetting("security.captcha.secret_key"),
    getSecuritySetting("security.captcha.enabled_pages"),
  ]);

  let enabledPages = {
    login: false, register: false, domainSearch: false,
    forgotPassword: false, contactForm: false, checkout: false, supportTicket: false,
  };
  try { if (enabledPagesRaw) enabledPages = { ...enabledPages, ...JSON.parse(enabledPagesRaw) }; } catch { /* ok */ }

  return {
    provider: (provider as "turnstile" | "recaptcha") ?? "turnstile",
    siteKey: siteKey ?? "",
    secretKey: secretKey ?? "",
    enabledPages,
  };
}
