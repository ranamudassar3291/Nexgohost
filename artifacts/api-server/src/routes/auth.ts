import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, settingsTable, adminLogsTable, affiliatesTable, affiliateReferralsTable, activityLogsTable, passwordResetsTable } from "@workspace/db/schema";
import { eq, sql, and, gt } from "drizzle-orm";
import { hashPassword, comparePassword, signToken, authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { emailVerificationCode, emailPasswordReset, emailWelcome, sendEmail } from "../lib/email.js";
import { getSecurityConfig, verifyCaptcha, recordFailedAttempt, isIpBlockedInDb, getClientIp } from "../lib/security.js";
import crypto from "node:crypto";
import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const _otplib = _require("otplib") as any;
const { TOTP: OtpTOTP, generateSecret: otpGenerateSecret, NobleCryptoPlugin, ScureBase32Plugin, verify: otpVerify } = _otplib;
function _makeTotp(secret: string) {
  return new OtpTOTP({ crypto: new NobleCryptoPlugin(), base32: new ScureBase32Plugin(), secret });
}
async function _otpVerify(token: string, secret: string): Promise<boolean> {
  const result = await otpVerify({ token, secret, crypto: new NobleCryptoPlugin(), base32: new ScureBase32Plugin() });
  return result?.valid === true;
}
import QRCode from "qrcode";
import { OAuth2Client } from "google-auth-library";

const router = Router();

function makeVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id, firstName: user.firstName, lastName: user.lastName,
    email: user.email, company: user.company, phone: user.phone,
    role: user.role, status: user.status,
    emailVerified: user.emailVerified,
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt.toISOString(),
  };
}

router.post("/auth/register", async (req, res) => {
  try {
    const { firstName, lastName, email, password, company, phone, captchaToken } = req.body;
    if (!firstName || !lastName || !email || !password) {
      res.status(400).json({ error: "Validation error", message: "Required fields missing" }); return;
    }

    // ── Captcha check ─────────────────────────────────────────────────────────
    const secConfig = await getSecurityConfig();
    if (secConfig.enabledPages.register && secConfig.secretKey && captchaToken) {
      const captchaOk = await verifyCaptcha(captchaToken, secConfig.secretKey, secConfig.provider);
      if (!captchaOk) {
        res.status(400).json({ error: "Captcha verification failed. Please try again.", code: "CAPTCHA_FAILED" }); return;
      }
    }
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(400).json({ error: "Validation error", message: "Email already registered" }); return;
    }
    const passwordHash = await hashPassword(password);
    const verificationRequired = await isEmailVerificationEnabled();

    let code: string | null = null;
    let expiresAt: Date | null = null;
    if (verificationRequired) {
      code = makeVerificationCode();
      expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    }

    const { refCode } = req.body;

    const [user] = await db.insert(usersTable).values({
      firstName, lastName, email, passwordHash,
      company: company || null, phone: phone || null,
      role: "client", status: "active",
      emailVerified: !verificationRequired,
      verificationCode: code,
      verificationExpiresAt: expiresAt,
    }).returning();

    if (verificationRequired && code) {
      await emailVerificationCode(email, firstName, code).catch(() => {});
    }

    // Welcome email — always sent on new account signup
    emailWelcome(email, {
      clientName: `${firstName} ${lastName}`,
      dashboardUrl: "https://noehost.com/client/dashboard",
    }, { clientId: user.id }).catch(() => {});

    // ── Track affiliate referral ────────────────────────────────────────────
    if (refCode) {
      try {
        const [affiliate] = await db.select().from(affiliatesTable)
          .where(eq(affiliatesTable.referralCode, refCode)).limit(1);
        if (affiliate && affiliate.status === "active") {
          await db.insert(affiliateReferralsTable).values({
            affiliateId: affiliate.id,
            referredUserId: user.id,
            status: "registered",
            ipAddress: (req.headers["x-forwarded-for"] as string || req.ip || "").split(",")[0]?.trim() || null,
          });
          await db.update(affiliatesTable)
            .set({ totalSignups: sql`${affiliatesTable.totalSignups} + 1`, updatedAt: new Date() })
            .where(eq(affiliatesTable.id, affiliate.id));
        }
      } catch (refErr) {
        console.warn("[AUTH] Failed to track referral:", refErr);
      }
    }

    const token = signToken({ userId: user.id, role: user.role, email: user.email });
    res.status(201).json({ token, requiresVerification: verificationRequired, user: formatUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", message: "Registration failed" });
  }
});

// POST /auth/verify-email
router.post("/auth/verify-email", authenticate, async (req: AuthRequest, res) => {
  try {
    const { code } = req.body;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) { res.status(404).json({ error: "Not found" }); return; }
    if (user.emailVerified) { res.json({ success: true, message: "Already verified" }); return; }
    if (!user.verificationCode || user.verificationCode !== code) {
      res.status(400).json({ error: "Invalid verification code" }); return;
    }
    if (user.verificationExpiresAt && user.verificationExpiresAt < new Date()) {
      res.status(400).json({ error: "Verification code has expired" }); return;
    }
    const [updated] = await db.update(usersTable)
      .set({ emailVerified: true, verificationCode: null, verificationExpiresAt: null, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id)).returning();
    res.json({ success: true, user: formatUser(updated) });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// POST /auth/resend-verification
router.post("/auth/resend-verification", authenticate, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) { res.status(404).json({ error: "Not found" }); return; }
    if (user.emailVerified) { res.json({ success: true, message: "Already verified" }); return; }
    const code = makeVerificationCode();
    await db.update(usersTable).set({
      verificationCode: code, verificationExpiresAt: new Date(Date.now() + 10 * 60 * 1000), updatedAt: new Date(),
    }).where(eq(usersTable.id, user.id));
    await emailVerificationCode(user.email, user.firstName, code).catch(() => {});
    res.json({ success: true, message: "Verification code resent" });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

async function logActivity(userId: string, action: typeof activityLogsTable.$inferInsert["action"], req: any, status: "success" | "failed" = "success", note?: string) {
  try {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || req.ip || null;
    const userAgent = req.headers["user-agent"] || null;
    await db.insert(activityLogsTable).values({ userId, action, ip, userAgent, status, note: note || null });
  } catch { /* non-fatal */ }
}

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password, totp, captchaToken } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Validation error", message: "Email and password required" }); return;
    }

    // ── Security checks ────────────────────────────────────────────────────────
    const ip = getClientIp(req);
    const ipBlocked = await isIpBlockedInDb(ip);
    if (ipBlocked) {
      res.status(429).json({ error: "Too many failed attempts. Your IP is temporarily blocked for 30 minutes.", code: "IP_BLOCKED" }); return;
    }

    const secConfig = await getSecurityConfig();
    if (secConfig.enabledPages.login && secConfig.secretKey && captchaToken) {
      const captchaOk = await verifyCaptcha(captchaToken, secConfig.secretKey, secConfig.provider);
      if (!captchaOk) {
        res.status(400).json({ error: "Captcha verification failed. Please try again.", code: "CAPTCHA_FAILED" }); return;
      }
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user) { res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" }); return; }
    if (user.status === "suspended") { res.status(401).json({ error: "Unauthorized", message: "Account suspended" }); return; }
    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      logActivity(user.id, "login_failed", req, "failed", "Invalid password").catch(() => {});
      await recordFailedAttempt(ip, req, email).catch(() => {});
      res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" }); return;
    }

    // 2FA check
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!totp) {
        const tempToken = signToken({ userId: user.id, role: user.role, email: user.email });
        res.json({ requires2FA: true, tempToken }); return;
      }
      const valid2FA = await _otpVerify(totp, user.twoFactorSecret!);
      if (!valid2FA) {
        logActivity(user.id, "login_failed", req, "failed", "Invalid 2FA code").catch(() => {});
        res.status(401).json({ error: "Unauthorized", message: "Invalid authenticator code" }); return;
      }
    }

    // Block client login until email is verified (only when verification is enabled)
    const verificationEnabled = await isEmailVerificationEnabled();
    if (verificationEnabled && !user.emailVerified && user.role === "client") {
      const tempToken = signToken({ userId: user.id, role: user.role, email: user.email });
      res.status(403).json({
        error: "Email not verified",
        requiresVerification: true,
        tempToken,
        message: "Please verify your email before logging in. Check your inbox for the verification code.",
      });
      return;
    }

    logActivity(user.id, "login_success", req, "success").catch(() => {});
    const token = signToken({ userId: user.id, role: user.role, email: user.email });
    res.json({ token, requiresVerification: false, user: formatUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", message: "Login failed" });
  }
});

router.get("/auth/me", authenticate, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatUser(user));
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// ─── 2FA Routes ──────────────────────────────────────────────────────────────

// GET /auth/2fa/setup — generate QR code for Google Authenticator
router.get("/auth/2fa/setup", authenticate, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) { res.status(404).json({ error: "Not found" }); return; }
    const secret = otpGenerateSecret();
    const otpauth = await _makeTotp(secret).toURI({ label: user.email, issuer: "Noehost" });
    const qrCode = await QRCode.toDataURL(otpauth);
    // Store secret temporarily (not enabled until verified)
    await db.update(usersTable).set({ twoFactorSecret: secret, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
    res.json({ secret, qrCode, otpauth });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// POST /auth/2fa/enable — verify OTP and activate 2FA
router.post("/auth/2fa/enable", authenticate, async (req: AuthRequest, res) => {
  try {
    const { totp } = req.body;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user || !user.twoFactorSecret) { res.status(400).json({ error: "Setup 2FA first" }); return; }
    const valid = await _otpVerify(totp, user.twoFactorSecret!);
    if (!valid) { res.status(400).json({ error: "Invalid authenticator code" }); return; }
    const [updated] = await db.update(usersTable).set({ twoFactorEnabled: true, updatedAt: new Date() }).where(eq(usersTable.id, user.id)).returning();
    res.json({ success: true, user: formatUser(updated) });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// POST /auth/2fa/disable — disable 2FA (requires current TOTP code for safety)
router.post("/auth/2fa/disable", authenticate, async (req: AuthRequest, res) => {
  try {
    const { totp } = req.body;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) { res.status(404).json({ error: "Not found" }); return; }
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!totp) { res.status(400).json({ error: "Authenticator code required to disable 2FA" }); return; }
      const valid = await _otpVerify(totp, user.twoFactorSecret!);
      if (!valid) { res.status(400).json({ error: "Invalid authenticator code" }); return; }
    }
    const [updated] = await db.update(usersTable)
      .set({ twoFactorEnabled: false, twoFactorSecret: null, updatedAt: new Date() })
      .where(eq(usersTable.id, req.user!.userId)).returning();
    res.json({ success: true, user: formatUser(updated) });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// POST /auth/2fa/verify — verify OTP when tempToken was issued during login
router.post("/auth/2fa/verify", authenticate, async (req: AuthRequest, res) => {
  try {
    const { totp } = req.body;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user || !user.twoFactorSecret) { res.status(400).json({ error: "2FA not configured" }); return; }
    const valid = await _otpVerify(totp, user.twoFactorSecret!);
    if (!valid) { res.status(401).json({ error: "Invalid authenticator code" }); return; }
    const token = signToken({ userId: user.id, role: user.role, email: user.email });
    res.json({ token, user: formatUser(user) });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

router.get("/account", authenticate, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatUser(user));
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

router.put("/account", authenticate, async (req: AuthRequest, res) => {
  try {
    const { firstName, lastName, company, phone, newPassword, currentPassword } = req.body;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) { res.status(404).json({ error: "Not found" }); return; }

    let passwordHash = user.passwordHash;
    if (newPassword && currentPassword) {
      const { comparePassword: cp, hashPassword: hp } = await import("../lib/auth.js");
      const valid = await cp(currentPassword, user.passwordHash);
      if (!valid) { res.status(400).json({ error: "Invalid current password" }); return; }
      passwordHash = await hp(newPassword);
    }

    const [updated] = await db.update(usersTable).set({
      firstName: firstName || user.firstName,
      lastName: lastName || user.lastName,
      company: company ?? user.company,
      phone: phone ?? user.phone,
      passwordHash,
      updatedAt: new Date(),
    }).where(eq(usersTable.id, req.user!.userId)).returning();

    res.json({
      id: updated.id, firstName: updated.firstName, lastName: updated.lastName,
      email: updated.email, company: updated.company, phone: updated.phone,
      role: updated.role, status: updated.status, createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Google OAuth helpers ───────────────────────────────────────────────────

interface GoogleSettings {
  clientId: string;
  clientSecret: string;
  allowedDomains: string[];
}

async function getGoogleSettings(): Promise<GoogleSettings> {
  try {
    const rows = await db.select().from(settingsTable);
    const map: Record<string, string> = {};
    for (const r of rows) if (r.key && r.value) map[r.key] = r.value;
    const rawDomains = map["google_allowed_domains"] || "";
    const allowedDomains = rawDomains
      ? rawDomains.split(",").map(d => d.trim().toLowerCase()).filter(Boolean)
      : [];
    return {
      clientId: map["google_client_id"] || process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: map["google_client_secret"] || process.env.GOOGLE_CLIENT_SECRET || "",
      allowedDomains,
    };
  } catch {
    return { clientId: process.env.GOOGLE_CLIENT_ID || "", clientSecret: process.env.GOOGLE_CLIENT_SECRET || "", allowedDomains: [] };
  }
}

async function getGoogleClientId(): Promise<string> {
  const { clientId } = await getGoogleSettings();
  return clientId;
}

async function isEmailVerificationEnabled(): Promise<boolean> {
  try {
    const rows = await db.select().from(settingsTable);
    const map: Record<string, string> = {};
    for (const r of rows) if (r.key && r.value) map[r.key] = r.value;
    const val = map["email_verification_enabled"];
    return val === undefined ? true : val === "true";
  } catch {
    return true;
  }
}

function buildCallbackUrl(req: any): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"] || process.env.REPLIT_DOMAINS || "localhost:8080";
  return `${proto}://${host}/api/auth/google/callback`;
}

async function findOrCreateGoogleUser(googleUser: { sub: string; email: string; name: string; given_name?: string; family_name?: string }) {
  let [user] = await db.select().from(usersTable).where(eq(usersTable.email, googleUser.email)).limit(1);
  if (!user) {
    const [newUser] = await db.insert(usersTable).values({
      email: googleUser.email,
      firstName: googleUser.given_name || googleUser.name.split(" ")[0] || "User",
      lastName: googleUser.family_name || googleUser.name.split(" ").slice(1).join(" ") || "",
      passwordHash: await hashPassword(crypto.randomUUID()),
      role: "client",
      status: "active",
      emailVerified: true,
      googleId: googleUser.sub,
    }).returning();
    user = newUser;
    console.log(`[AUTH] New Google user created: ${user.email}`);
  } else if (!user.googleId) {
    await db.update(usersTable).set({ googleId: googleUser.sub, emailVerified: true, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
    user = { ...user, googleId: googleUser.sub, emailVerified: true };
  }
  return user;
}

async function logAuthEvent(opts: {
  userId?: string; email: string; action: string;
  method: string; status: string; ipAddress?: string; userAgent?: string; details?: string;
}) {
  try {
    await db.insert(adminLogsTable).values({
      userId: opts.userId ?? null,
      email: opts.email,
      action: opts.action,
      method: opts.method,
      status: opts.status,
      ipAddress: opts.ipAddress ?? null,
      userAgent: opts.userAgent ?? null,
      details: opts.details ?? null,
    });
  } catch { /* non-fatal */ }
}

// GET /api/auth/google/config — return Google Client ID so the frontend can initialise GIS
router.get("/auth/google/config", async (_req, res) => {
  const { clientId, clientSecret, allowedDomains } = await getGoogleSettings();
  res.json({
    clientId: clientId || null,
    configured: !!(clientId && clientSecret),
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    allowedDomains,
  });
});

// GET /api/auth/google/start — initiate server-side OAuth code flow
router.get("/auth/google/start", async (req, res) => {
  const { clientId, clientSecret } = await getGoogleSettings();
  if (!clientId || !clientSecret) {
    const frontendBase = (() => {
      const proto = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers["x-forwarded-host"] || req.headers["host"] || "";
      return `${proto}://${host}`;
    })();
    res.redirect(`${frontendBase}/client/login?error=google_not_configured`);
    return;
  }
  const callbackUrl = buildCallbackUrl(req);
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// GET /api/auth/google/callback — exchange code for user info, create session, redirect to frontend
router.get("/auth/google/callback", async (req, res) => {
  const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || "";
  const ua = req.headers["user-agent"] || "";
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"] || "";
  const frontendBase = `${proto}://${host}`;

  const { code, error } = req.query as Record<string, string>;

  if (error) {
    await logAuthEvent({ email: "unknown", action: "google_callback", method: "google", status: "denied", ipAddress: ip, userAgent: ua, details: error });
    res.redirect(`${frontendBase}/client/login?error=google_denied`);
    return;
  }

  if (!code) {
    res.redirect(`${frontendBase}/client/login?error=google_no_code`);
    return;
  }

  try {
    const { clientId, clientSecret, allowedDomains } = await getGoogleSettings();
    if (!clientId || !clientSecret) {
      res.redirect(`${frontendBase}/client/login?error=google_not_configured`);
      return;
    }

    const callbackUrl = buildCallbackUrl(req);
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      }).toString(),
    });

    const tokenData = await tokenResp.json() as any;
    if (!tokenResp.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || "Token exchange failed");
    }

    const userInfoResp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userInfo = await userInfoResp.json() as any;
    if (!userInfo.email) throw new Error("Google did not return an email address");

    if (allowedDomains.length > 0) {
      const domain = userInfo.email.split("@")[1]?.toLowerCase() || "";
      if (!allowedDomains.includes(domain)) {
        await logAuthEvent({ email: userInfo.email, action: "google_callback", method: "google", status: "blocked", ipAddress: ip, userAgent: ua, details: `Domain not allowed: ${domain}` });
        res.redirect(`${frontendBase}/client/login?error=google_domain_not_allowed`);
        return;
      }
    }

    const googleUser = {
      sub: userInfo.id || userInfo.sub,
      email: userInfo.email,
      name: userInfo.name || userInfo.email,
      given_name: userInfo.given_name,
      family_name: userInfo.family_name,
    };

    const user = await findOrCreateGoogleUser(googleUser);

    if (user.status === "suspended") {
      await logAuthEvent({ userId: user.id, email: user.email, action: "google_callback", method: "google", status: "blocked", ipAddress: ip, userAgent: ua, details: "Account suspended" });
      res.redirect(`${frontendBase}/client/login?error=account_suspended`);
      return;
    }

    const jwt = signToken({ userId: user.id, role: user.role });
    await logAuthEvent({ userId: user.id, email: user.email, action: "google_callback", method: "google", status: "success", ipAddress: ip, userAgent: ua });
    res.redirect(`${frontendBase}/google-callback?token=${encodeURIComponent(jwt)}&firstName=${encodeURIComponent(user.firstName || "")}`);
  } catch (err: any) {
    console.error("[AUTH] Google callback error:", err.message);
    await logAuthEvent({ email: "unknown", action: "google_callback", method: "google", status: "error", ipAddress: ip, userAgent: ua, details: err.message });
    res.redirect(`${frontendBase}/client/login?error=google_failed`);
  }
});

// POST /api/auth/google — verify Google ID token, find or create user, return JWT
router.post("/auth/google", async (req, res) => {
  const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || "";
  const ua = req.headers["user-agent"] || "";
  const { credential, role: requestedRole } = req.body;

  if (!credential) {
    res.status(400).json({ error: "Google credential is required" });
    return;
  }

  const clientId = await getGoogleClientId();
  if (!clientId) {
    res.status(503).json({ error: "Google Sign-In is not configured. Please contact the administrator." });
    return;
  }

  const { credential: credential2, access_token: accessToken } = req.body;
  const tokenToVerify = credential2 || credential;

  let googleUser: { sub: string; email: string; name: string; given_name?: string; family_name?: string; picture?: string };
  try {
    if (accessToken) {
      // Implicit flow: verify access_token via Google's userinfo endpoint
      const resp = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!resp.ok) throw new Error("Failed to fetch user info from Google");
      const info = await resp.json() as any;
      if (!info.email) throw new Error("Google did not return an email");
      googleUser = { sub: info.id, email: info.email, name: info.name || info.email, given_name: info.given_name, family_name: info.family_name, picture: info.picture };
    } else if (tokenToVerify) {
      // ID token flow (GoogleLogin component): verify with OAuth2Client
      const oauthClient = new OAuth2Client(clientId);
      const ticket = await oauthClient.verifyIdToken({ idToken: tokenToVerify, audience: clientId });
      const payload = ticket.getPayload();
      if (!payload || !payload.email) throw new Error("Invalid token payload");
      googleUser = { sub: payload.sub, email: payload.email, name: payload.name || payload.email, given_name: payload.given_name, family_name: payload.family_name, picture: payload.picture };
    } else {
      throw new Error("No Google token provided");
    }
  } catch (err: any) {
    await logAuthEvent({ email: "unknown", action: "google_login", method: "google", status: "failed", ipAddress: ip, userAgent: ua, details: err.message });
    res.status(401).json({ error: "Invalid Google token. Please try again." });
    return;
  }

  try {
    // Find existing user by email
    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, googleUser.email)).limit(1);

    if (!user) {
      // Create new client account — Google has already verified the email
      const [newUser] = await db.insert(usersTable).values({
        email: googleUser.email,
        firstName: googleUser.given_name || googleUser.name.split(" ")[0] || "User",
        lastName: googleUser.family_name || googleUser.name.split(" ").slice(1).join(" ") || "",
        passwordHash: await hashPassword(crypto.randomUUID()), // unusable password — login via Google
        role: requestedRole === "admin" ? "client" : "client", // Google users always start as clients
        status: "active",
        emailVerified: true, // Google already verified the email
        googleId: googleUser.sub,
      }).returning();
      user = newUser;
      console.log(`[AUTH] New Google user created: ${user.email}`);
    } else if (!user.googleId) {
      // Link Google account to existing user
      await db.update(usersTable).set({ googleId: googleUser.sub, emailVerified: true, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
      user = { ...user, googleId: googleUser.sub, emailVerified: true };
    }

    if (user.status === "suspended" || user.status === "banned") {
      await logAuthEvent({ userId: user.id, email: user.email, action: "google_login", method: "google", status: "blocked", ipAddress: ip, userAgent: ua, details: `Account ${user.status}` });
      res.status(403).json({ error: "Your account has been suspended. Please contact support." });
      return;
    }

    const token = signToken({ userId: user.id, role: user.role });
    await logAuthEvent({ userId: user.id, email: user.email, action: "google_login", method: "google", status: "success", ipAddress: ip, userAgent: ua });

    res.json({
      token,
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role },
    });
  } catch (err: any) {
    console.error("[AUTH] Google login error:", err.message);
    await logAuthEvent({ email: googleUser.email, action: "google_login", method: "google", status: "error", ipAddress: ip, userAgent: ua, details: err.message });
    res.status(500).json({ error: "Server error during sign-in. Please try again." });
  }
});

// ─── Forgot Password ──────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
// Generates a secure reset token, stores it with a 1-hour expiry, and emails the user.
router.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    return res.status(400).json({ error: "A valid email address is required." });
  }

  // Always return 200 to prevent email enumeration attacks
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
  if (!user) {
    return res.json({ message: "If an account with that email exists, a reset link has been sent." });
  }

  // Generate a cryptographically secure token
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Invalidate any previous tokens for this user by inserting a new one
  await db.insert(passwordResetsTable).values({ token, userId: user.id, expiresAt });

  // Build the reset link
  const baseUrl = process.env["APP_URL"] || "https://noehost.com";
  const resetLink = `${baseUrl}/reset-password?token=${token}`;

  // Send the email via the password-reset template
  try {
    await emailPasswordReset(user.email, {
      clientName: user.firstName || user.email,
      resetLink,
    });
    console.log(`[AUTH] Password reset email sent to ${user.email}`);
  } catch (emailErr: any) {
    console.error(`[AUTH] Failed to send reset email: ${emailErr.message}`);
  }

  return res.json({ message: "If an account with that email exists, a reset link has been sent." });
});

// ─── Reset Password ───────────────────────────────────────────────────────────
// POST /api/auth/reset-password
// Verifies the token, hashes the new password, updates the user, marks token as used.
router.post("/auth/reset-password", async (req, res) => {
  const { token, password } = req.body as { token?: string; password?: string };
  if (!token || !password) {
    return res.status(400).json({ error: "Token and new password are required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  // Find a valid, unused token that hasn't expired
  const [reset] = await db.select().from(passwordResetsTable).where(
    and(
      eq(passwordResetsTable.token, token),
      gt(passwordResetsTable.expiresAt, new Date()),
    )
  ).limit(1);

  if (!reset || reset.usedAt) {
    return res.status(400).json({ error: "This reset link is invalid or has expired. Please request a new one." });
  }

  const passwordHash = await hashPassword(password);

  // Update the user's password
  await db.update(usersTable)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(usersTable.id, reset.userId));

  // Mark token as used
  await db.update(passwordResetsTable)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetsTable.token, token));

  console.log(`[AUTH] Password reset successful for userId=${reset.userId}`);
  return res.json({ message: "Password updated successfully. You can now sign in." });
});

// ── Admin: Impersonate a client (Login as Client) ────────────────────────────
router.post("/auth/impersonate/:userId", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (user.role !== "client") { res.status(400).json({ error: "Can only impersonate client accounts" }); return; }
    const token = signToken({ userId: user.id, role: user.role, email: user.email });
    console.log(`[IMPERSONATE] Admin ${req.user!.email} impersonating client ${user.email}`);
    res.json({ token, user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role } });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

export default router;
