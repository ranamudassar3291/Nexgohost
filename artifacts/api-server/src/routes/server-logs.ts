import { Router } from "express";
import { db } from "@workspace/db";
import { serverLogsTable } from "@workspace/db/schema";
import { authenticate, requireAdmin } from "../lib/auth.js";
import { desc, eq, sql } from "drizzle-orm";

const router = Router();

router.get("/admin/server-logs", authenticate, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt((req.query.limit as string) || "100");
    const serviceId = req.query.serviceId as string | undefined;

    let query = db.select().from(serverLogsTable).orderBy(desc(serverLogsTable.createdAt)).$dynamic();
    if (serviceId) {
      query = query.where(eq(serverLogsTable.serviceId, serviceId));
    }
    const logs = await query.limit(limit);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/admin/server-logs", authenticate, requireAdmin, async (_req, res) => {
  try {
    await db.delete(serverLogsTable).where(sql`created_at < NOW() - INTERVAL '30 days'`);
    res.json({ success: true, message: "Cleared logs older than 30 days" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
