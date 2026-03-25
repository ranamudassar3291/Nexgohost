import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { authenticate, requireAdmin, hashPassword, type AuthRequest } from "../lib/auth.js";

const router = Router();

type AdminPermission = "super_admin" | "full" | "support" | "limited";

function formatAdminUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    role: u.role,
    status: u.status,
    adminPermission: u.adminPermission,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

// GET /api/admin/admin-users — list all admin accounts
router.get("/admin/admin-users", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const admins = await db.select().from(usersTable).where(eq(usersTable.role, "admin"));
    res.json({ admins: admins.map(formatAdminUser) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/admin/admin-users — create a new admin account
router.post("/admin/admin-users", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { firstName, lastName, email, password, adminPermission } = req.body;

    if (!firstName || !lastName || !email || !password) {
      res.status(400).json({ error: "firstName, lastName, email, and password are required" });
      return;
    }

    const validPermissions: AdminPermission[] = ["full", "support", "limited"];
    if (!adminPermission || !validPermissions.includes(adminPermission)) {
      res.status(400).json({ error: "adminPermission must be one of: full, support, limited" });
      return;
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }

    const hashed = await hashPassword(password);
    const [newAdmin] = await db.insert(usersTable).values({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: hashed,
      role: "admin",
      status: "active",
      adminPermission: adminPermission as AdminPermission,
      emailVerified: true,
    }).returning();

    res.status(201).json(formatAdminUser(newAdmin));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/admin/admin-users/:id — update admin account
router.put("/admin/admin-users/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, password, adminPermission, status } = req.body;

    const [existing] = await db.select().from(usersTable).where(and(eq(usersTable.id, id), eq(usersTable.role, "admin"))).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Admin user not found" });
      return;
    }

    const updates: Partial<typeof usersTable.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (firstName) updates.firstName = firstName.trim();
    if (lastName)  updates.lastName  = lastName.trim();
    if (status && ["active", "suspended"].includes(status)) updates.status = status;

    if (email && email.toLowerCase().trim() !== existing.email) {
      const conflict = await db.select().from(usersTable)
        .where(and(eq(usersTable.email, email.toLowerCase().trim()), ne(usersTable.id, id)))
        .limit(1);
      if (conflict.length > 0) {
        res.status(409).json({ error: "Email is already in use by another account" });
        return;
      }
      updates.email = email.toLowerCase().trim();
    }

    if (password && password.trim().length >= 6) {
      updates.passwordHash = await hashPassword(password.trim());
    }

    const validPermissions: AdminPermission[] = ["super_admin", "full", "support", "limited"];
    if (adminPermission && validPermissions.includes(adminPermission)) {
      updates.adminPermission = adminPermission as AdminPermission;
    }

    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
    res.json(formatAdminUser(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/admin/admin-users/:id — remove admin account (cannot delete self)
router.delete("/admin/admin-users/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    if (req.user!.userId === id) {
      res.status(400).json({ error: "You cannot delete your own admin account" });
      return;
    }

    const [existing] = await db.select().from(usersTable).where(and(eq(usersTable.id, id), eq(usersTable.role, "admin"))).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Admin user not found" });
      return;
    }

    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
