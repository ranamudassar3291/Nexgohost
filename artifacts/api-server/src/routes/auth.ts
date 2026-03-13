import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, comparePassword, signToken, authenticate, type AuthRequest } from "../lib/auth.js";
import { emailVerificationCode } from "../lib/email.js";
import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const { authenticator } = _require("otplib") as typeof import("otplib");
import QRCode from "qrcode";

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

    const token = signToken({ userId: user.id, role: user.role, email: user.email });
    res.json({ token, requiresVerification: !user.emailVerified, user: formatUser(user) });
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

export default router;
