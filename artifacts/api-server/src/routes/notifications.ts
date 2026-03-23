import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../lib/auth.js";

const router = Router();

// GET /my/notifications
router.get("/my/notifications", authenticate, async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || "30")), 100);
    const notifications = await db.select().from(notificationsTable)
      .where(eq(notificationsTable.userId, req.user!.userId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(limit);
    const unreadCount = notifications.filter(n => !n.isRead).length;
    res.json({ notifications, unreadCount });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// GET /my/notifications/unread-count — lightweight poll endpoint (MUST be before /:id routes)
router.get("/my/notifications/unread-count", authenticate, async (req: AuthRequest, res) => {
  try {
    const [row] = await db.select({ count: sql<number>`count(*)` })
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, req.user!.userId), eq(notificationsTable.isRead, false)));
    res.json({ unreadCount: Number(row?.count ?? 0) });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// POST /my/notifications/read-all — mark all read (MUST be before /:id routes)
router.post("/my/notifications/read-all", authenticate, async (req: AuthRequest, res) => {
  try {
    await db.update(notificationsTable)
      .set({ isRead: true })
      .where(and(eq(notificationsTable.userId, req.user!.userId), eq(notificationsTable.isRead, false)));
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// PUT /my/notifications/:id/read — mark single notification read
router.put("/my/notifications/:id/read", authenticate, async (req: AuthRequest, res) => {
  try {
    await db.update(notificationsTable)
      .set({ isRead: true })
      .where(and(eq(notificationsTable.id, req.params.id), eq(notificationsTable.userId, req.user!.userId)));
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// DELETE /my/notifications/:id
router.delete("/my/notifications/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    await db.delete(notificationsTable)
      .where(and(eq(notificationsTable.id, req.params.id), eq(notificationsTable.userId, req.user!.userId)));
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

export default router;
