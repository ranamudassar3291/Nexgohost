import { Router } from "express";
import { db } from "@workspace/db";
import { announcementsTable } from "@workspace/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { authenticate, requireRole, type AuthRequest } from "../lib/auth.js";

const router = Router();

// ── Public: Active announcements ──────────────────────────────────────────────
router.get("/announcements", async (_req, res) => {
  try {
    const items = await db.select().from(announcementsTable)
      .where(eq(announcementsTable.isActive, true))
      .orderBy(desc(announcementsTable.priority), asc(announcementsTable.createdAt));
    res.json({ announcements: items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: List all announcements ─────────────────────────────────────────────
router.get("/admin/announcements", authenticate, requireRole("admin"), async (_req, res) => {
  try {
    const items = await db.select().from(announcementsTable).orderBy(desc(announcementsTable.priority), asc(announcementsTable.createdAt));
    res.json({ announcements: items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: Create announcement ────────────────────────────────────────────────
router.post("/admin/announcements", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { title, message, type = "info", isActive = true, priority = 0 } = req.body;
    if (!title || !message) { res.status(400).json({ error: "title and message are required" }); return; }
    const [item] = await db.insert(announcementsTable).values({ title, message, type, isActive, priority }).returning();
    res.json({ announcement: item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: Update announcement ────────────────────────────────────────────────
router.put("/admin/announcements/:id", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { title, message, type, isActive, priority } = req.body;
    const [item] = await db.update(announcementsTable)
      .set({ title, message, type, isActive, priority, updatedAt: new Date() })
      .where(eq(announcementsTable.id, req.params.id!))
      .returning();
    if (!item) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ announcement: item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: Delete announcement ────────────────────────────────────────────────
router.delete("/admin/announcements/:id", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    await db.delete(announcementsTable).where(eq(announcementsTable.id, req.params.id!));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
