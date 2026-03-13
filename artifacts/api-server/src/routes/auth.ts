import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, comparePassword, signToken, authenticate, type AuthRequest } from "../lib/auth.js";

const router = Router();

router.post("/auth/register", async (req, res) => {
  try {
    const { firstName, lastName, email, password, company, phone } = req.body;
    if (!firstName || !lastName || !email || !password) {
      res.status(400).json({ error: "Validation error", message: "Required fields missing" });
      return;
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(400).json({ error: "Validation error", message: "Email already registered" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const [user] = await db.insert(usersTable).values({
      firstName,
      lastName,
      email,
      passwordHash,
      company: company || null,
      phone: phone || null,
      role: "client",
      status: "active",
    }).returning();

    const token = signToken({ userId: user.id, role: user.role, email: user.email });
    res.status(201).json({
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        company: user.company,
        phone: user.phone,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", message: "Registration failed" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Validation error", message: "Email and password required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
      return;
    }

    if (user.status === "suspended") {
      res.status(401).json({ error: "Unauthorized", message: "Account suspended" });
      return;
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
      return;
    }

    const token = signToken({ userId: user.id, role: user.role, email: user.email });
    res.json({
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        company: user.company,
        phone: user.phone,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", message: "Login failed" });
  }
});

router.get("/auth/me", authenticate, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      company: user.company,
      phone: user.phone,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/account", authenticate, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) { res.status(404).json({ error: "Not found" }); return; }
    res.json({
      id: user.id, firstName: user.firstName, lastName: user.lastName,
      email: user.email, company: user.company, phone: user.phone,
      role: user.role, status: user.status, createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
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
