import { Router } from "express";
import { db } from "@workspace/db";
import { activityLogsTable } from "@workspace/db/schema";
import { eq, desc, ilike, and, count, sql } from "drizzle-orm";
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

// GET /admin/activity-logs — paginated, filterable audit trail
router.get("/admin/activity-logs", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const page   = Math.max(1, parseInt(String(req.query.page  || "1")));
    const limit  = Math.min(Math.max(1, parseInt(String(req.query.limit || "50"))), 200);
    const offset = (page - 1) * limit;
    const search = String(req.query.search || "").trim();
    const action = String(req.query.action || "").trim();
    const status = String(req.query.status || "").trim();

    const conditions: ReturnType<typeof eq>[] = [];

    if (search) {
      conditions.push(
        sql`(${activityLogsTable.userEmail} ILIKE ${`%${search}%`} OR
             ${activityLogsTable.description} ILIKE ${`%${search}%`} OR
             ${activityLogsTable.ip} ILIKE ${`%${search}%`})` as any,
      );
    }
    if (action) conditions.push(eq(activityLogsTable.action, action as any));
    if (status === "success" || status === "failed") {
      conditions.push(eq(activityLogsTable.status, status as any));
    }

    const where = conditions.length > 0 ? and(...(conditions as any)) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(activityLogsTable)
      .where(where);

    const logs = await db
      .select()
      .from(activityLogsTable)
      .where(where)
      .orderBy(desc(activityLogsTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ logs, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Legacy endpoint — kept for backwards compatibility
router.get("/admin/activity", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || "100")), 500);
    const logs = await db
      .select()
      .from(activityLogsTable)
      .orderBy(desc(activityLogsTable.createdAt))
      .limit(limit);
    res.json(logs);
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

export default router;
