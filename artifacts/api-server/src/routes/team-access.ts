import { Router } from "express";
import { db } from "@workspace/db";
import { authenticate, type AuthRequest } from "../lib/auth.js";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────
function getClientIp(req: any): string {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

async function logAccess(
  ownerUserId: string,
  actorEmail: string,
  actorRole: string,
  ip: string,
  action: string,
  userAgent: string
) {
  const id = randomUUID();
  await db.execute(sql`
    INSERT INTO team_access_logs (id, owner_user_id, actor_email, actor_role, ip_address, action, user_agent, created_at)
    VALUES (${id}, ${ownerUserId}, ${actorEmail}, ${actorRole}, ${ip}, ${action}, ${userAgent}, NOW())
  `);
}

// ── GET /api/my/team ─────────────────────────────────────────────────── members
router.get("/my/team", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const rows = await db.execute(sql`
      SELECT id, email, name, role, status, created_at
      FROM team_members
      WHERE owner_user_id = ${userId}
      ORDER BY created_at DESC
    `);
    res.json({ members: rows.rows });
  } catch (err: any) {
    console.error("[team-access] GET /my/team:", err.message);
    res.status(500).json({ error: "Failed to load team members" });
  }
});

// ── POST /api/my/team ─────────────────────────────────────────────────── add
router.post("/my/team", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { email, name, role } = req.body as { email: string; name: string; role: string };
    const validRoles = ["support_only", "billing_only", "developer", "full_access"];
    if (!email || !name || !validRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid request. Provide email, name, and a valid role." });
    }

    // Check duplicate
    const dup = await db.execute(sql`
      SELECT id FROM team_members WHERE owner_user_id = ${userId} AND email = ${email}
    `);
    if (dup.rows.length > 0) {
      return res.status(409).json({ error: "This email is already a team member." });
    }

    const id = randomUUID();
    await db.execute(sql`
      INSERT INTO team_members (id, owner_user_id, email, name, role, status, created_at, updated_at)
      VALUES (${id}, ${userId}, ${email}, ${name}, ${role}, 'active', NOW(), NOW())
    `);
    await logAccess(userId, req.user!.email, "owner", getClientIp(req), `Added team member: ${email} (${role})`, req.headers["user-agent"] || "");
    res.json({ ok: true, id, email, name, role, status: "active" });
  } catch (err: any) {
    console.error("[team-access] POST /my/team:", err.message);
    res.status(500).json({ error: "Failed to add team member" });
  }
});

// ── PATCH /api/my/team/:memberId ───────────────────────────────── update role
router.patch("/my/team/:memberId", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { memberId } = req.params;
    const { role } = req.body as { role: string };
    const validRoles = ["support_only", "billing_only", "developer", "full_access"];
    if (!validRoles.includes(role)) return res.status(400).json({ error: "Invalid role" });

    const result = await db.execute(sql`
      UPDATE team_members SET role = ${role}, updated_at = NOW()
      WHERE id = ${memberId} AND owner_user_id = ${userId}
      RETURNING email
    `);
    if (!result.rows.length) return res.status(404).json({ error: "Member not found" });
    const email = (result.rows[0] as any).email;
    await logAccess(userId, req.user!.email, "owner", getClientIp(req), `Updated ${email} role to ${role}`, req.headers["user-agent"] || "");
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[team-access] PATCH /my/team/:id:", err.message);
    res.status(500).json({ error: "Failed to update member" });
  }
});

// ── DELETE /api/my/team/:memberId ───────────────────────────────── remove
router.delete("/my/team/:memberId", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { memberId } = req.params;
    const result = await db.execute(sql`
      DELETE FROM team_members WHERE id = ${memberId} AND owner_user_id = ${userId}
      RETURNING email
    `);
    if (!result.rows.length) return res.status(404).json({ error: "Member not found" });
    const email = (result.rows[0] as any).email;
    await logAccess(userId, req.user!.email, "owner", getClientIp(req), `Removed team member: ${email}`, req.headers["user-agent"] || "");
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[team-access] DELETE /my/team/:id:", err.message);
    res.status(500).json({ error: "Failed to remove member" });
  }
});

// ── GET /api/my/team/magic-links ─────────────────────────────────── list links
router.get("/my/team/magic-links", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const rows = await db.execute(sql`
      SELECT id, token, label, expires_at, used_at, used_ip, created_at
      FROM team_magic_links
      WHERE owner_user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 20
    `);
    res.json({ links: rows.rows });
  } catch (err: any) {
    console.error("[team-access] GET /my/team/magic-links:", err.message);
    res.status(500).json({ error: "Failed to load links" });
  }
});

// ── POST /api/my/team/magic-link ─────────────────────────────────── generate
router.post("/my/team/magic-link", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { label } = req.body as { label?: string };
    const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.execute(sql`
      INSERT INTO team_magic_links (id, owner_user_id, token, label, expires_at, created_at)
      VALUES (${id}, ${userId}, ${token}, ${label || "Developer Access"}, ${expiresAt.toISOString()}, NOW())
    `);
    await logAccess(userId, req.user!.email, "owner", getClientIp(req), `Generated magic link: ${label || "Developer Access"}`, req.headers["user-agent"] || "");
    res.json({ ok: true, id, token, label: label || "Developer Access", expiresAt: expiresAt.toISOString() });
  } catch (err: any) {
    console.error("[team-access] POST /my/team/magic-link:", err.message);
    res.status(500).json({ error: "Failed to generate link" });
  }
});

// ── DELETE /api/my/team/magic-link/:linkId ────────────────────────── revoke
router.delete("/my/team/magic-link/:linkId", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { linkId } = req.params;
    await db.execute(sql`
      DELETE FROM team_magic_links WHERE id = ${linkId} AND owner_user_id = ${userId}
    `);
    await logAccess(userId, req.user!.email, "owner", getClientIp(req), `Revoked magic link`, req.headers["user-agent"] || "");
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[team-access] DELETE /my/team/magic-link/:id:", err.message);
    res.status(500).json({ error: "Failed to revoke link" });
  }
});

// ── GET /api/my/team/access-logs ─────────────────────────────────── logs
router.get("/my/team/access-logs", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const rows = await db.execute(sql`
      SELECT id, actor_email, actor_role, ip_address, action, user_agent, created_at
      FROM team_access_logs
      WHERE owner_user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 50
    `);
    res.json({ logs: rows.rows });
  } catch (err: any) {
    console.error("[team-access] GET /my/team/access-logs:", err.message);
    res.status(500).json({ error: "Failed to load logs" });
  }
});

// ── GET /api/team/verify/:token ─────────────────────── PUBLIC: magic link use
router.get("/team/verify/:token", async (req, res) => {
  const { token } = req.params;
  const ip = getClientIp(req);
  const ua = req.headers["user-agent"] || "";
  try {
    const result = await db.execute(sql`
      SELECT id, owner_user_id, label, expires_at, used_at
      FROM team_magic_links
      WHERE token = ${token}
    `);
    if (!result.rows.length) {
      return res.status(404).json({ error: "Invalid or expired link." });
    }
    const link = result.rows[0] as any;
    if (new Date(link.expires_at) < new Date()) {
      return res.status(410).json({ error: "This link has expired.", expiredAt: link.expires_at });
    }
    // Mark as used (first use only) and log
    if (!link.used_at) {
      await db.execute(sql`
        UPDATE team_magic_links SET used_at = NOW(), used_ip = ${ip}
        WHERE id = ${link.id}
      `);
    }
    await logAccess(link.owner_user_id, "developer", "developer", ip, `Accessed via magic link: ${link.label}`, ua);
    res.json({
      ok: true,
      label: link.label,
      expiresAt: link.expires_at,
      accessedAt: new Date().toISOString(),
      ip,
      firstUse: !link.used_at,
    });
  } catch (err: any) {
    console.error("[team-access] GET /team/verify/:token:", err.message);
    res.status(500).json({ error: "Verification failed" });
  }
});

export default router;
