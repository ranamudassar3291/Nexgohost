import { Router } from "express";
import { db } from "@workspace/db";
import { migrationsTable, usersTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";

const router = Router();

function formatMigration(m: typeof migrationsTable.$inferSelect, clientName?: string) {
  return {
    id: m.id,
    clientId: m.clientId,
    clientName: clientName || "",
    domain: m.domain,
    oldHostingProvider: m.oldHostingProvider,
    oldCpanelHost: m.oldCpanelHost,
    oldCpanelUsername: m.oldCpanelUsername,
    status: m.status,
    progress: m.progress,
    notes: m.notes,
    requestedAt: m.requestedAt.toISOString(),
    completedAt: m.completedAt?.toISOString(),
  };
}

// Client: get my migrations
router.get("/migrations", authenticate, async (req: AuthRequest, res) => {
  try {
    const migrations = await db.select().from(migrationsTable).where(eq(migrationsTable.clientId, req.user!.userId)).orderBy(sql`requested_at DESC`);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    res.json(migrations.map(m => formatMigration(m, user ? `${user.firstName} ${user.lastName}` : "")));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Client: request migration
router.post("/migrations", authenticate, async (req: AuthRequest, res) => {
  try {
    const { domain, oldHostingProvider, oldCpanelHost, oldCpanelUsername, oldCpanelPassword, notes } = req.body;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const [migration] = await db.insert(migrationsTable).values({
      clientId: req.user!.userId,
      domain,
      oldHostingProvider,
      oldCpanelHost,
      oldCpanelUsername,
      oldCpanelPassword,
      notes,
      status: "pending",
      progress: 0,
    }).returning();

    res.status(201).json(formatMigration(migration, `${user.firstName} ${user.lastName}`));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: get all migrations
router.get("/admin/migrations", authenticate, requireAdmin, async (_req, res) => {
  try {
    const migrations = await db.select().from(migrationsTable).orderBy(sql`requested_at DESC`);
    const result = await Promise.all(migrations.map(async (m) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, m.clientId)).limit(1);
      return formatMigration(m, user ? `${user.firstName} ${user.lastName}` : "");
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: update migration status
router.put("/admin/migrations/:id/status", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { status, progress, notes } = req.body;
    const completedAt = (status === "completed" || status === "failed") ? new Date() : undefined;

    const [updated] = await db.update(migrationsTable)
      .set({
        status,
        progress: progress !== undefined ? progress : undefined,
        notes: notes || undefined,
        completedAt,
      })
      .where(eq(migrationsTable.id, req.params.id))
      .returning();

    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated.clientId)).limit(1);
    res.json(formatMigration(updated, user ? `${user.firstName} ${user.lastName}` : ""));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
