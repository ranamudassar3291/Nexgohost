import { Router } from "express";
import { db } from "@workspace/db";
import { cronLogsTable } from "@workspace/db/schema";
import { authenticate, requireAdmin } from "../lib/auth.js";
import { desc, sql } from "drizzle-orm";
import { runAllCronTasks } from "../lib/cron.js";

const router = Router();

router.get("/admin/cron-logs", authenticate, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string || "50");
    const logs = await db.select().from(cronLogsTable).orderBy(desc(cronLogsTable.executedAt)).limit(limit);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/admin/cron/run", authenticate, requireAdmin, async (_req, res) => {
  try {
    res.json({ started: true, message: "Cron tasks started" });
    runAllCronTasks().catch(console.warn);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/admin/cron-logs", authenticate, requireAdmin, async (_req, res) => {
  try {
    await db.delete(cronLogsTable).where(sql`executed_at < NOW() - INTERVAL '30 days'`);
    res.json({ success: true, message: "Cleared logs older than 30 days" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
