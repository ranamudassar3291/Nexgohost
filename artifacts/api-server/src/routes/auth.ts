import { getAppUrl, getClientUrl } from "../lib/app-url.js";
import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, settingsTable, adminLogsTable, affiliatesTable, affiliateReferralsTable, activityLogsTable, passwordResetsTable } from "@workspace/db/schema";
import { eq, sql, and, gt } from "drizzle-orm";
import { hashPassword, comparePassword, signToken, signVerificationToken, authenticate, authenticateVerification, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { decryptField } from "../lib/fieldCrypto.js";
import { emailVerificationCode, emailPasswordReset, emailWelcome, sendEmail, emailLoginAlert } from "../lib/email.js";
import { sendToClientPhone } from "../lib/whatsapp.js";
import { getSecurityConfig, verifyCaptcha, recordFailedAttempt, isIpBlockedInDb, getClientIp } from "../lib/security.js";
import crypto from "node:crypto";
import { createRequire } from "node:module";
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
    username: (user as any).username ?? null,
    country: (user as any).country ?? null,
    billingCurrency: (user as any).billingCurrency ?? null,
    canMigrate: user.canMigrate ?? false,
    createdAt: user.createdAt.toISOString(),
  };
}

async function generateUsername(firstName: string): Promise<string> {
  const base = firstName.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 12) || "user";
  for (let i = 0; i < 10; i++) {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const candidate = `${base}${suffix}`;
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(sql`lower(${(usersTable as any).username}) = ${candidate}`).limit(1);
    if (!existing) return candidate;
  }
  return `user${Date.now().toString().slice(-8)}`;
}

router.post("/auth/register", async (req, res) => {
  try {
    const { firstName, lastName, email, password, company, phone, captchaToken, country, billingCurrency,
            username: reqUsername, address1, city, state, postCode } = req.body;
    if (!firstName || !email || !password) {
      res.status(400).json({ error: "Validation error", message: "First name, email, and password are required" }); return;
    }

    // ── Captcha check ─────────────────────────────────────────────────────────
    const secConfig = await getSecurityConfig();
    if (secConfig.enabledPages.register && secConfig.secretKey && captchaToken) {
      const captchaOk = await verifyCaptcha(captchaToken, secConfig.secretKey, secConfig.provider);
      if (!captchaOk) {
        res.status(400).json({ error: "Captcha verification failed. Please try again.", code: "CAPTCHA_FAILED" }); return;
      }
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail)).limit(1);
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

    const autoUsername = reqUsername
      ? reqUsername.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20) || await generateUsername(firstName)
      : await generateUsername(firstName);

    const [user] = await db.insert(usersTable).values({
      firstName, lastName: lastName || null, email: normalizedEmail, passwordHash,
      company: company || null, phone: phone || null,
      role: "client", status: "active",
      emailVerified: !verificationRequired,
      verificationCode: code,
      verificationExpiresAt: expiresAt,
      username: autoUsername,
      ...(country         ? { country }         : {}),
      ...(billingCurrency ? { billingCurrency }  : {}),
      ...(address1        ? { address1 }         : {}),
      ...(city            ? { city }             : {}),
      ...(state           ? { state }            : {}),
      ...(postCode        ? { postCode }         : {}),
    } as any).returning();

    if (verificationRequired && code) {
      try {
        const emailResult = await emailVerificationCode(email, firstName, code, { clientId: user.id });
        console.log(`[AUTH] Verification email to ${email}: sent=${emailResult.sent} msg=${emailResult.message}`);
      } catch (emailErr: any) {
        console.error(`[AUTH] ❌ Failed to send verification email to ${email}:`, emailErr.message);
      }
      // Also send same verification code via WhatsApp to phone if provided
      if (phone) {
        sendToClientPhone(phone,
          `🔐 *Your verification code is: ${code}*\n\nEnter this code on the website to verify your account.\nExpires in 10 minutes.\n\n_Do not share this code with anyone._`,
          "verification"
        ).catch(() => {});
      }
    }

    // Welcome email — always sent on new account signup
    emailWelcome(email, {
      clientName: `${firstName} ${lastName}`,
      dashboardUrl: `${getClientUrl()}/dashboard`,
      username: autoUsername,
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

    logActivity(user.id, "account_registered" as any, req, "success", undefined, user.email, `New client account registered`).catch(() => {});
    // If verification required: issue a scoped 10-min token (only usable for verify-email/resend routes)
    // Otherwise: issue a full auth token
    const token = verificationRequired
      ? signVerificationToken(user.id, user.email)
      : signToken({ userId: user.id, role: user.role, email: user.email, adminPermission: user.adminPermission ?? undefined });
    res.status(201).json({ token, requiresVerification: verificationRequired, user: formatUser(user) });

    // WhatsApp welcome message to client (non-blocking)
    if (user.phone) {
      sendToClientPhone(
        user.phone,
        `👋 *Welcome to Noehost, ${firstName}!*\n\n` +
        `Your account has been created successfully.\n\n` +
        `📧 Email: ${email}\n` +
        `🌐 Dashboard: ${getClientUrl()}/dashboard\n\n` +
        `If you have any questions, just reply to this message or open a support ticket.\n\n` +
        `_Noehost Team_ 🚀`,
        "welcome"
      ).catch(() => {});
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", message: "Registration failed" });
  }
});

// POST /auth/verify-email — accepts ONLY scoped email_verification tokens
router.post("/auth/verify-email", authenticateVerification, async (req: AuthRequest, res) => {
  try {
    const { code } = req.body;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) { res.status(404).json({ error: "Not found" }); return; }
    if (user.emailVerified) {
      // Already verified — issue a full auth token so client can proceed
      const fullToken = signToken({ userId: user.id, role: user.role, email: user.email ?? "", adminPermission: user.adminPermission ?? undefined });
      res.json({ success: true, message: "Already verified", token: fullToken });
      return;
    }
    if (!user.verificationCode || user.verificationCode !== code) {
      res.status(400).json({ error: "Invalid verification code" }); return;
    }
    if (user.verificationExpiresAt && user.verificationExpiresAt < new Date()) {
      res.status(400).json({ error: "Verification code has expired" }); return;
    }
    const [updated] = await db.update(usersTable)
      .set({ emailVerified: true, verificationCode: null, verificationExpiresAt: null, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id)).returning();
    // Issue a full auth token now that the user is verified
    const fullToken = signToken({ userId: updated.id, role: updated.role, email: updated.email ?? "", adminPermission: updated.adminPermission ?? undefined });
    res.json({ success: true, user: formatUser(updated), token: fullToken });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// POST /auth/resend-verification — accepts ONLY scoped email_verification tokens
router.post("/auth/resend-verification", authenticateVerification, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) { res.status(404).json({ error: "Not found" }); return; }
    if (user.emailVerified) { res.json({ success: true, message: "Already verified" }); return; }
    const code = makeVerificationCode();
    await db.update(usersTable).set({
      verificationCode: code, verificationExpiresAt: new Date(Date.now() + 10 * 60 * 1000), updatedAt: new Date(),
    }).where(eq(usersTable.id, user.id));
    try {
      const emailResult = await emailVerificationCode(user.email, user.firstName, code, { clientId: user.id });
      console.log(`[AUTH] Resend verification to ${user.email}: sent=${emailResult.sent} msg=${emailResult.message}`);
      if (!emailResult.sent) {
        res.status(500).json({ success: false, message: `Email delivery failed: ${emailResult.message}` }); return;
      }
    } catch (emailErr: any) {
      console.error(`[AUTH] ❌ Resend verification failed for ${user.email}:`, emailErr.message);
      res.status(500).json({ success: false, message: emailErr.message }); return;
    }
    res.json({ success: true, message: "Verification code resent" });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

async function logActivity(
  userId: string,
  action: typeof activityLogsTable.$inferInsert["action"],
  req: any,
  status: "success" | "failed" = "success",
  note?: string,
  userEmail?: string,
  description?: string,
) {
  try {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || req.ip || null;
    const userAgent = req.headers["user-agent"] || null;
    await db.insert(activityLogsTable).values({
      userId, action, ip, userAgent, status,
      note: note || null,
      userEmail: userEmail ?? null,
      description: description ?? null,
    });
  } catch { /* non-fatal */ }
}

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password, totp, captchaToken } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Validation error", message: "Email/username and password required" }); return;
    }

    // ── Fetch user early so admins can bypass IP rate-limiting ──────────────
    // Support login by email OR username
    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (!user && !email.includes("@")) {
      [user] = await db.select().from(usersTable)
        .where(sql`lower(${(usersTable as any).username}) = ${email.toLowerCase().trim()}`)
        .limit(1);
    }

    // ── Security checks ────────────────────────────────────────────────────────
    const ip = getClientIp(req);
    const isAdmin = user?.role === "admin";

    // Admin accounts bypass IP blocking to prevent panel lockout
    if (!isAdmin) {
      const ipBlocked = await isIpBlockedInDb(ip);
      if (ipBlocked) {
        res.status(429).json({ error: "Too many failed attempts. Your IP is temporarily blocked for 30 minutes.", code: "IP_BLOCKED" }); return;
      }
    }

    const secConfig = await getSecurityConfig();
    if (secConfig.enabledPages.login && secConfig.secretKey && captchaToken) {
      const captchaOk = await verifyCaptcha(captchaToken, secConfig.secretKey, secConfig.provider);
      if (!captchaOk) {
        res.status(400).json({ error: "Captcha verification failed. Please try again.", code: "CAPTCHA_FAILED" }); return;
      }
    }

    if (!user) { res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" }); return; }
    if (user.status === "suspended") { res.status(401).json({ error: "Unauthorized", message: "Account suspended" }); return; }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      logActivity(user.id, "login_failed", req, "failed", "Invalid password", user.email, "Login attempt failed — invalid password").catch(() => {});
      // Admins: log for audit trail but never trigger IP block (prevents panel lockout)
      // Non-admins: full brute-force protection (3 attempts → 30-min block)
      await recordFailedAttempt(ip, req, email, { skipBlock: isAdmin }).catch(() => {});
      res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" }); return;
    }

    // 2FA check — only for non-admin users who have 2FA enabled
    if (user.role !== "admin" && user.twoFactorEnabled && user.twoFactorSecret) {
      if (!totp) {
        const tempToken = signToken({ userId: user.id, role: user.role, email: user.email, adminPermission: user.adminPermission ?? undefined });
        res.json({ requires2FA: true, tempToken }); return;
      }
      const valid2FA = await _otpVerify(totp, user.twoFactorSecret!);
      if (!valid2FA) {
        logActivity(user.id, "login_failed", req, "failed", "Invalid 2FA code", user.email, "Login attempt failed — invalid 2FA code").catch(() => {});
        res.status(401).json({ error: "Unauthorized", message: "Invalid authenticator code" }); return;
      }
    }

    // Block client login until email is verified (only when verification is enabled)
    const verificationEnabled = await isEmailVerificationEnabled();
    if (verificationEnabled && !user.emailVerified && user.role === "client") {
      // Scoped 10-min token — only usable for verify-email/resend endpoints
      const tempToken = signVerificationToken(user.id, user.email);
      res.status(403).json({
        error: "Email not verified",
        requiresVerification: true,
        tempToken,
        message: "Please verify your email before logging in. Check your inbox for the verification code.",
      });
      return;
    }

    const loginIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || req.ip || "Unknown";
    logActivity(user.id, "login_success", req, "success", undefined, user.email, `Successful login from ${loginIp}`).catch(() => {});
    const token = signToken({ userId: user.id, role: user.role, email: user.email, adminPermission: user.adminPermission ?? undefined });
    res.json({ token, requiresVerification: false, user: formatUser(user) });

    // Login alert email — non-blocking, only for clients
    if (user.role === "client") {
      const now = new Date();
      const ua = req.headers["user-agent"] || "Unknown device";
      const deviceStr = (() => {
        if (ua.includes("Mobile")) return ua.includes("iPhone") ? "iPhone / Safari" : ua.includes("Android") ? "Android / Chrome" : "Mobile Browser";
        if (ua.includes("Windows")) return "Windows / " + (ua.includes("Chrome") ? "Chrome" : ua.includes("Firefox") ? "Firefox" : ua.includes("Edge") ? "Edge" : "Browser");
        if (ua.includes("Mac")) return "Mac / " + (ua.includes("Chrome") ? "Chrome" : ua.includes("Firefox") ? "Firefox" : ua.includes("Safari") ? "Safari" : "Browser");
        if (ua.includes("Linux")) return "Linux / " + (ua.includes("Chrome") ? "Chrome" : "Browser");
        return ua.slice(0, 60);
      })();
      const loginDate = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      const loginTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" }) + " PKT";
      emailLoginAlert(user.email, {
        clientName: `${user.firstName} ${user.lastName || ""}`.trim(),
        ip: loginIp,
        device: deviceStr,
        loginTime,
        loginDate,
      }, { clientId: user.id }).catch(() => {});
    }
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
    const token = signToken({ userId: updated.id, role: updated.role, email: updated.email, adminPermission: updated.adminPermission ?? undefined });
    res.json({ success: true, user: formatUser(updated), token });
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
    if (!valid) {
      logActivity(user.id, "login_failed", req, "failed", "Invalid 2FA code", user.email, "Login attempt failed — invalid 2FA code").catch(() => {});
      res.status(401).json({ error: "Invalid authenticator code" }); return;
    }
    // After 2FA — enforce email verification before issuing full token (prevents 2FA bypass of email gate)
    const ver2faEnabled = await isEmailVerificationEnabled();
    if (ver2faEnabled && !user.emailVerified && user.role === "client") {
      // Ensure a verification code exists (or create a fresh one)
      if (!user.verificationCode || !user.verificationExpiresAt || user.verificationExpiresAt < new Date()) {
        const code = makeVerificationCode();
        await db.update(usersTable).set({
          verificationCode: code, verificationExpiresAt: new Date(Date.now() + 10 * 60 * 1000), updatedAt: new Date(),
        }).where(eq(usersTable.id, user.id));
        emailVerificationCode(user.email, user.firstName, code, { clientId: user.id }).catch(() => {});
      }
      const verToken = signVerificationToken(user.id, user.email);
      res.status(403).json({ requiresVerification: true, tempToken: verToken,
        message: "Please verify your email before completing login." });
      return;
    }
    const token = signToken({ userId: user.id, role: user.role, email: user.email, adminPermission: user.adminPermission ?? undefined });
    logActivity(user.id, "login_success", req, "success", undefined, user.email, "Successful login via 2FA").catch(() => {});
    // Login alert — non-blocking
    if (user.role === "client") {
      const ip2fa = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || req.ip || "Unknown";
      const ua2fa = req.headers["user-agent"] || "";
      const now = new Date();
      const deviceStr = (() => {
        if (ua2fa.includes("Mobile")) return ua2fa.includes("iPhone") ? "iPhone / Safari" : "Android / Chrome";
        if (ua2fa.includes("Windows")) return "Windows / " + (ua2fa.includes("Chrome") ? "Chrome" : ua2fa.includes("Firefox") ? "Firefox" : "Browser");
        if (ua2fa.includes("Mac")) return "Mac / " + (ua2fa.includes("Safari") ? "Safari" : ua2fa.includes("Chrome") ? "Chrome" : "Browser");
        return ua2fa.slice(0, 60) || "Unknown";
      })();
      emailLoginAlert(user.email, {
        clientName: `${user.firstName} ${user.lastName || ""}`.trim(),
        ip: ip2fa,
        device: deviceStr,
        loginTime: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" }) + " PKT",
        loginDate: now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
      }, { clientId: user.id }).catch(() => {});
    }
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

interface GoogleSettingsWithSiteUrl extends GoogleSettings {
  siteUrl: string;
}

async function getGoogleSettings(): Promise<GoogleSettingsWithSiteUrl> {
  try {
    const rows = await db.select().from(settingsTable);
    const map: Record<string, string> = {};
    for (const r of rows) if (r.key && r.value) map[r.key] = r.value;
    const rawDomains = map["google_allowed_domains"] || "";
    const allowedDomains = rawDomains
      ? rawDomains.split(",").map(d => d.trim().toLowerCase()).filter(Boolean)
      : [];
    const rawSecret = map["google_client_secret"] || "";
    const clientSecret = rawSecret
      ? decryptField(rawSecret)
      : (process.env.GOOGLE_CLIENT_SECRET || "");
    return {
      clientId: map["google_client_id"] || process.env.GOOGLE_CLIENT_ID || "",
      clientSecret,
      allowedDomains,
      siteUrl: (map["brand_website"] || process.env.FRONTEND_URL || "").replace(/\/$/, ""),
    };
  } catch {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      allowedDomains: [],
      siteUrl: process.env.FRONTEND_URL || "",
    };
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

function buildFrontendBase(req: any, siteUrl?: string): string {
  if (siteUrl) return siteUrl;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"] || process.env.REPLIT_DOMAINS || "";
  return `${proto}://${host}`;
}

function buildCallbackUrl(req: any, siteUrl?: string): string {
  return `${buildFrontendBase(req, siteUrl)}/api/auth/google/callback`;
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
  const { clientId, clientSecret, siteUrl } = await getGoogleSettings();
  const frontendBase = buildFrontendBase(req, siteUrl);
  if (!clientId || !clientSecret) {
    res.redirect(`${frontendBase}/login?error=google_not_configured`);
    return;
  }
  const callbackUrl = buildCallbackUrl(req, siteUrl);
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

  const { code, error } = req.query as Record<string, string>;

  // Load settings first so we always redirect to the correct frontend domain
  const { clientId, clientSecret, allowedDomains, siteUrl } = await getGoogleSettings();
  const frontendBase = buildFrontendBase(req, siteUrl);

  if (error) {
    await logAuthEvent({ email: "unknown", action: "google_callback", method: "google", status: "denied", ipAddress: ip, userAgent: ua, details: error });
    res.redirect(`${frontendBase}/login?error=google_denied`);
    return;
  }

  if (!code) {
    res.redirect(`${frontendBase}/login?error=google_no_code`);
    return;
  }

  try {
    if (!clientId || !clientSecret) {
      res.redirect(`${frontendBase}/login?error=google_not_configured`);
      return;
    }

    const callbackUrl = buildCallbackUrl(req, siteUrl);
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
      const errDetail = tokenData.error_description || tokenData.error || "Token exchange failed";
      console.error("[AUTH] Google token exchange failed:", JSON.stringify(tokenData));
      throw new Error(errDetail);
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
        res.redirect(`${frontendBase}/login?error=google_domain_not_allowed`);
        return;
      }
    }

    const googleEmail = (userInfo.email as string).toLowerCase().trim();
    const googleFirstName = userInfo.given_name || (userInfo.name || "").split(" ")[0] || "User";
    const googleLastName = userInfo.family_name || (userInfo.name || "").split(" ").slice(1).join(" ") || "";
    const googleSub = userInfo.id || userInfo.sub;

    // Look up existing user
    let [existingUser] = await db.select().from(usersTable).where(eq(usersTable.email, googleEmail)).limit(1);

    if (!existingUser) {
      // ── NEW Google user ────────────────────────────────────────────────────
      const verificationRequired = await isEmailVerificationEnabled();
      const verCode = verificationRequired ? makeVerificationCode() : null;
      const verExpiry = verCode ? new Date(Date.now() + 10 * 60 * 1000) : null;

      const [newUser] = await db.insert(usersTable).values({
        email: googleEmail,
        firstName: googleFirstName,
        lastName: googleLastName,
        passwordHash: await hashPassword(crypto.randomUUID()),
        role: "client",
        status: "active",
        emailVerified: !verificationRequired,
        googleId: googleSub,
        verificationCode: verCode,
        verificationExpiresAt: verExpiry,
      } as any).returning();

      await logAuthEvent({ userId: newUser.id, email: newUser.email, action: "google_register", method: "google", status: "success", ipAddress: ip, userAgent: ua });

      if (verificationRequired && verCode) {
        // Send verification email (non-blocking)
        emailVerificationCode(newUser.email, newUser.firstName, verCode, { clientId: newUser.id }).catch((e: any) =>
          console.error("[AUTH] Google new-user verification email failed:", e.message));

        // Scoped 10-min token — ONLY usable for verify-email/resend endpoints (not full API access)
        const tempToken = signVerificationToken(newUser.id, newUser.email);
        res.redirect(
          `${frontendBase}/google-callback?requiresVerification=true` +
          `&tempToken=${encodeURIComponent(tempToken)}` +
          `&firstName=${encodeURIComponent(newUser.firstName || "")}` +
          `&email=${encodeURIComponent(newUser.email)}`
        );
        return;
      }

      // No verification needed — log in directly
      const jwt = signToken({ userId: newUser.id, role: "client", email: newUser.email, adminPermission: undefined });
      // Login alert for first Google sign-in (no verification needed path)
      if (newUser.role === "client") {
        const now = new Date();
        emailLoginAlert(newUser.email, {
          clientName: `${newUser.firstName} ${newUser.lastName || ""}`.trim(),
          ip: ip || "Unknown",
          device: `${ua.includes("Mobile") ? "Mobile" : "Desktop"} (via Google)`,
          loginTime: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" }) + " PKT",
          loginDate: now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
        }, { clientId: newUser.id }).catch(() => {});
      }
      res.redirect(`${frontendBase}/google-callback?token=${encodeURIComponent(jwt)}&firstName=${encodeURIComponent(newUser.firstName || "")}`);
      return;
    }

    // ── EXISTING user ────────────────────────────────────────────────────────
    if (!existingUser.googleId) {
      // Link Google ID only — do NOT force emailVerified (let verification gate apply)
      await db.update(usersTable)
        .set({ googleId: googleSub, updatedAt: new Date() })
        .where(eq(usersTable.id, existingUser.id));
      existingUser = { ...existingUser, googleId: googleSub };
    }

    if (existingUser.status === "suspended") {
      await logAuthEvent({ userId: existingUser.id, email: existingUser.email, action: "google_callback", method: "google", status: "blocked", ipAddress: ip, userAgent: ua, details: "Account suspended" });
      res.redirect(`${frontendBase}/login?error=account_suspended`);
      return;
    }

    // Gate: if email verification is enabled and user not yet verified, send to verify
    const verificationEnabled2 = await isEmailVerificationEnabled();
    if (verificationEnabled2 && !existingUser.emailVerified && existingUser.role === "client") {
      // Ensure a verification code exists
      if (!existingUser.verificationCode || !existingUser.verificationExpiresAt || existingUser.verificationExpiresAt < new Date()) {
        const code = makeVerificationCode();
        await db.update(usersTable).set({
          verificationCode: code, verificationExpiresAt: new Date(Date.now() + 10 * 60 * 1000), updatedAt: new Date(),
        }).where(eq(usersTable.id, existingUser.id));
        existingUser = { ...existingUser, verificationCode: code };
        emailVerificationCode(existingUser.email, existingUser.firstName, code, { clientId: existingUser.id }).catch(() => {});
      }
      const tempToken = signVerificationToken(existingUser.id, existingUser.email ?? "");
      await logAuthEvent({ userId: existingUser.id, email: existingUser.email, action: "google_callback", method: "google", status: "pending", ipAddress: ip, userAgent: ua, details: "Email verification required" });
      res.redirect(
        `${frontendBase}/google-callback?requiresVerification=true` +
        `&tempToken=${encodeURIComponent(tempToken)}` +
        `&firstName=${encodeURIComponent(existingUser.firstName || "")}` +
        `&email=${encodeURIComponent(existingUser.email ?? "")}`
      );
      return;
    }

    const jwt = signToken({ userId: existingUser.id, role: existingUser.role, email: existingUser.email ?? "", adminPermission: existingUser.adminPermission ?? undefined });
    await logAuthEvent({ userId: existingUser.id, email: existingUser.email, action: "google_callback", method: "google", status: "success", ipAddress: ip, userAgent: ua });

    // Login alert for existing users — non-blocking
    if (existingUser.role === "client") {
      const now = new Date();
      const deviceStr = (() => {
        if (ua.includes("Mobile")) return ua.includes("iPhone") ? "iPhone / Safari" : "Android / Chrome";
        if (ua.includes("Windows")) return "Windows / " + (ua.includes("Chrome") ? "Chrome" : ua.includes("Firefox") ? "Firefox" : "Browser");
        if (ua.includes("Mac")) return "Mac / " + (ua.includes("Safari") ? "Safari" : ua.includes("Chrome") ? "Chrome" : "Browser");
        return ua.slice(0, 60) || "Unknown";
      })();
      const loginDate = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      const loginTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" }) + " PKT";
      emailLoginAlert(existingUser.email, {
        clientName: `${existingUser.firstName} ${existingUser.lastName || ""}`.trim(),
        ip: ip || "Unknown",
        device: `${deviceStr} (via Google)`,
        loginTime,
        loginDate,
      }, { clientId: existingUser.id }).catch(() => {});
    }

    res.redirect(`${frontendBase}/google-callback?token=${encodeURIComponent(jwt)}&firstName=${encodeURIComponent(existingUser.firstName || "")}`);
  } catch (err: any) {
    console.error("[AUTH] Google callback error:", err.message);
    await logAuthEvent({ email: "unknown", action: "google_callback", method: "google", status: "error", ipAddress: ip, userAgent: ua, details: err.message });
    const detail = encodeURIComponent(err.message || "Unknown error");
    res.redirect(`${frontendBase}/login?error=google_failed&google_error=${detail}`);
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
      // Check if email verification is required before creating the account
      const googleVerRequired = await isEmailVerificationEnabled();
      const googleVerCode = googleVerRequired ? makeVerificationCode() : null;
      const googleVerExpiry = googleVerCode ? new Date(Date.now() + 10 * 60 * 1000) : null;

      const [newUser] = await db.insert(usersTable).values({
        email: googleUser.email,
        firstName: googleUser.given_name || googleUser.name.split(" ")[0] || "User",
        lastName: googleUser.family_name || googleUser.name.split(" ").slice(1).join(" ") || "",
        passwordHash: await hashPassword(crypto.randomUUID()),
        role: "client",
        status: "active",
        emailVerified: !googleVerRequired, // only mark verified if verification is disabled
        googleId: googleUser.sub,
        verificationCode: googleVerCode,
        verificationExpiresAt: googleVerExpiry,
      } as any).returning();
      user = newUser;
      console.log(`[AUTH] New Google user created: ${user.email} (verified=${!googleVerRequired})`);

      if (googleVerRequired && googleVerCode) {
        // Send verification email and return scoped token
        emailVerificationCode(user.email, user.firstName, googleVerCode, { clientId: user.id }).catch((e: any) =>
          console.error("[AUTH] POST /auth/google verification email failed:", e.message));
        await logAuthEvent({ userId: user.id, email: user.email, action: "google_register", method: "google", status: "pending", ipAddress: ip, userAgent: ua, details: "Verification required" });
        const tempToken = signVerificationToken(user.id, user.email);
        res.json({ requiresVerification: true, tempToken, email: user.email,
          user: { id: user.id, firstName: user.firstName, email: user.email, role: user.role } });
        return;
      }
    } else if (!user.googleId) {
      // Link Google ID only — do NOT force emailVerified (let verification gate apply)
      await db.update(usersTable).set({ googleId: googleUser.sub, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
      user = { ...user, googleId: googleUser.sub };
    }

    // Gate: existing (or newly-created, verified) user — check emailVerified
    const postGoogleVerEnabled = await isEmailVerificationEnabled();
    if (postGoogleVerEnabled && !user.emailVerified && user.role === "client") {
      if (!user.verificationCode || !user.verificationExpiresAt || (user.verificationExpiresAt as Date) < new Date()) {
        const code = makeVerificationCode();
        await db.update(usersTable).set({
          verificationCode: code, verificationExpiresAt: new Date(Date.now() + 10 * 60 * 1000), updatedAt: new Date(),
        }).where(eq(usersTable.id, user.id));
        user = { ...user, verificationCode: code };
        emailVerificationCode(user.email, user.firstName, code, { clientId: user.id }).catch(() => {});
      }
      const tempToken = signVerificationToken(user.id, user.email);
      res.status(403).json({ requiresVerification: true, tempToken, email: user.email,
        message: "Please verify your email before signing in." });
      return;
    }

    if (user.status === "suspended" || user.status === "banned") {
      await logAuthEvent({ userId: user.id, email: user.email, action: "google_login", method: "google", status: "blocked", ipAddress: ip, userAgent: ua, details: `Account ${user.status}` });
      res.status(403).json({ error: "Your account has been suspended. Please contact support." });
      return;
    }

    const token = signToken({ userId: user.id, role: user.role, email: user.email ?? "", adminPermission: user.adminPermission ?? undefined });
    await logAuthEvent({ userId: user.id, email: user.email, action: "google_login", method: "google", status: "success", ipAddress: ip, userAgent: ua });

    // Login alert — every Google sign-in (non-blocking)
    if (user.role === "client") {
      const now = new Date();
      const deviceStr = ua.includes("Mobile") ? "Mobile (via Google)" : "Desktop (via Google)";
      emailLoginAlert(user.email, {
        clientName: `${user.firstName} ${user.lastName || ""}`.trim(),
        ip: ip || "Unknown",
        device: deviceStr,
        loginTime: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" }) + " PKT",
        loginDate: now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
      }, { clientId: user.id }).catch(() => {});
    }

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
  const baseUrl = getAppUrl();
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

  logActivity(user.id, "password_reset_requested" as any, req, "success", undefined, user.email, "Password reset email requested").catch(() => {});
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

// ── Emergency: Reset admin password via secret token ─────────────────────────
// POST /auth/reset-admin  { email, newPassword, resetToken }
// Only works when ADMIN_RESET_TOKEN env var is set (remove it after use for security).
router.post("/auth/reset-admin", async (req, res) => {
  try {
    const resetToken = process.env["ADMIN_RESET_TOKEN"];
    if (!resetToken) {
      return res.status(403).json({ error: "Admin reset is not enabled. Set ADMIN_RESET_TOKEN env var to enable." });
    }
    const { email, newPassword, resetToken: provided } = req.body;
    if (!email || !newPassword || !provided) {
      return res.status(400).json({ error: "email, newPassword, and resetToken are required" });
    }
    if (provided !== resetToken) {
      return res.status(403).json({ error: "Invalid reset token" });
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user) return res.status(404).json({ error: `No user found with email: ${email}` });

    const passwordHash = await hashPassword(newPassword);
    await db.update(usersTable).set({ passwordHash, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
    console.log(`[AUTH] Emergency admin password reset for ${email} (role=${user.role})`);
    res.json({ success: true, message: `Password updated for ${email}. Remove ADMIN_RESET_TOKEN env var for security.`, role: user.role });
  } catch (err: any) {
    console.error("[AUTH] reset-admin error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Client: Change username ───────────────────────────────────────────────────
router.put("/auth/change-username", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { username } = req.body;
    if (!username) { res.status(400).json({ error: "Username is required" }); return; }
    const cleaned = username.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (cleaned.length < 3 || cleaned.length > 20) {
      res.status(400).json({ error: "Username must be 3–20 characters (letters, numbers, underscores)" }); return;
    }
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(sql`lower(${(usersTable as any).username}) = ${cleaned} AND id != ${userId}`)
      .limit(1);
    if (existing) { res.status(400).json({ error: "Username is already taken" }); return; }
    await db.update(usersTable).set({ username: cleaned, updatedAt: new Date() } as any).where(eq(usersTable.id, userId));
    res.json({ success: true, username: cleaned });
  } catch (err: any) {
    console.error("[AUTH] change-username error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Phone OTP: Send code ──────────────────────────────────────────────────────
router.post("/auth/send-phone-otp", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { phone } = req.body;
    if (!phone) { res.status(400).json({ error: "Phone number is required" }); return; }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.execute(sql.raw(`UPDATE users SET phone_otp='${otp}', phone_otp_expires_at='${expiresAt.toISOString()}', phone='${phone.replace(/'/g, "")}' WHERE id='${userId}'`));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    // Send OTP via WhatsApp/SMS to phone + email fallback
    try {
      const { sendToClientPhone } = await import("../lib/whatsapp.js") as any;
      await sendToClientPhone(phone, `🔐 *Your phone verification code is: ${otp}*\n\nThis code expires in 10 minutes. Do not share it with anyone.\n\n_Noehost Security_`, "otp");
    } catch { /* fallback: send via email */ }
    // Always send via email as backup
    try {
      const { emailVerificationCode } = await import("./email.js") as any;
      await emailVerificationCode(user.email, user.firstName, otp, { clientId: userId });
    } catch { /* non-fatal */ }
    console.log(`[AUTH] Phone OTP sent to ${phone} for user ${userId}: ${otp}`);
    res.json({ success: true, message: "Verification code sent to your phone" });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed to send OTP" }); }
});

// ── Phone OTP: Verify code ────────────────────────────────────────────────────
router.post("/auth/verify-phone-otp", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { code } = req.body;
    if (!code) { res.status(400).json({ error: "Code is required" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const stored = (user as any).phone_otp;
    const expiresAt = (user as any).phone_otp_expires_at;
    if (!stored || stored !== code.trim()) { res.status(400).json({ error: "Invalid verification code" }); return; }
    if (expiresAt && new Date() > new Date(expiresAt)) { res.status(400).json({ error: "Code has expired. Please request a new one." }); return; }
    await db.execute(sql.raw(`UPDATE users SET phone_verified=true, phone_otp=NULL, phone_otp_expires_at=NULL WHERE id='${userId}'`));
    res.json({ success: true, message: "Phone number verified successfully" });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed to verify OTP" }); }
});

// ── Admin: Impersonate a client (Login as Client) ────────────────────────────
router.post("/auth/impersonate/:userId", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (user.role !== "client") { res.status(400).json({ error: "Can only impersonate client accounts" }); return; }
    const token = signToken({ userId: user.id, role: user.role, email: user.email, adminPermission: user.adminPermission ?? undefined });
    console.log(`[IMPERSONATE] Admin ${req.user!.email} impersonating client ${user.email}`);
    res.json({ token, user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role } });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

export default router;
