import { Router } from "express";
import { db } from "@workspace/db";
import { activityLogsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";

const router = Router();

// GET /my/activity — client's own login/activity history
router.get("/my/activity", authenticate, async (req: AuthRequest, res) => {
  try {
    const logs = await db.select().from(activityLogsTable)
      .where(eq(activityLogsTable.userId, req.user!.userId))
      .orderBy(desc(activityLogsTable.createdAt))
      .limit(50);
    res.json(logs);
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// GET /admin/activity — admin view all activity logs
router.get("/admin/activity", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || "100")), 500);
    const logs = await db.select().from(activityLogsTable)
      .orderBy(desc(activityLogsTable.createdAt))
      .limit(limit);
    res.json(logs);
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

export default router;
