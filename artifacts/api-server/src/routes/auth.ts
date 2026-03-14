import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, settingsTable, adminLogsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, comparePassword, signToken, authenticate, type AuthRequest } from "../lib/auth.js";
import { emailVerificationCode } from "../lib/email.js";
import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const { authenticator } = _require("otplib") as typeof import("otplib");
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
    const { firstName, lastName, email, password, company, phone } = req.body;
    if (!firstName || !lastName || !email || !password) {
      res.status(400).json({ error: "Validation error", message: "Required fields missing" }); return;
    }
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(400).json({ error: "Validation error", message: "Email already registered" }); return;
    }
    const passwordHash = await hashPassword(password);
    const code = makeVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const [user] = await db.insert(usersTable).values({
      firstName, lastName, email, passwordHash,
      company: company || null, phone: phone || null,
      role: "client", status: "active",
      emailVerified: false, verificationCode: code, verificationExpiresAt: expiresAt,
    }).returning();
    await emailVerificationCode(email, firstName, code).catch(() => {});
    const token = signToken({ userId: user.id, role: user.role, email: user.email });
    res.status(201).json({ token, requiresVerification: true, user: formatUser(user) });
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

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password, totp } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Validation error", message: "Email and password required" }); return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user) { res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" }); return; }
    if (user.status === "suspended") { res.status(401).json({ error: "Unauthorized", message: "Account suspended" }); return; }
    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) { res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" }); return; }

    // 2FA check
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!totp) {
        // Signal client to ask for TOTP
        const tempToken = signToken({ userId: user.id, role: user.role, email: user.email });
        res.json({ requires2FA: true, tempToken }); return;
      }
      const valid2FA = authenticator.verify({ token: totp, secret: user.twoFactorSecret });
      if (!valid2FA) { res.status(401).json({ error: "Unauthorized", message: "Invalid authenticator code" }); return; }
    }

    // Block client login until email is verified
    if (!user.emailVerified && user.role === "client") {
      const tempToken = signToken({ userId: user.id, role: user.role, email: user.email });
      res.status(403).json({
        error: "Email not verified",
        requiresVerification: true,
        tempToken,
        message: "Please verify your email before logging in. Check your inbox for the verification code.",
      });
      return;
    }

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
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, "Nexgohost", secret);
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
    const valid = authenticator.verify({ token: totp, secret: user.twoFactorSecret });
    if (!valid) { res.status(400).json({ error: "Invalid authenticator code" }); return; }
    const [updated] = await db.update(usersTable).set({ twoFactorEnabled: true, updatedAt: new Date() }).where(eq(usersTable.id, user.id)).returning();
    res.json({ success: true, user: formatUser(updated) });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// POST /auth/2fa/disable — disable 2FA
router.post("/auth/2fa/disable", authenticate, async (req: AuthRequest, res) => {
  try {
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
    const valid = authenticator.verify({ token: totp, secret: user.twoFactorSecret });
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

export default router;
