import { Router } from "express";
import { db } from "@workspace/db";
import { cronLogsTable } from "@workspace/db/schema";
import { authenticate, requireAdmin } from "../lib/auth.js";
import { desc, sql } from "drizzle-orm";
import {
  runAllCronTasks,
  runBillingCron, runSuspendOverdueCron, runAutoTerminateCron,
  runUnsuspendRestoredCron, runHostingRenewalReminderCron,
  runDomainRenewalCron, runInvoiceRemindersCron,
  runVpsPowerOffCron, runDailyBackupCron,
} from "../lib/cron.js";

const router = Router();

// All logs (paginated)
router.get("/admin/cron-logs", authenticate, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string || "50");
    const logs = await db.select().from(cronLogsTable).orderBy(desc(cronLogsTable.executedAt)).limit(limit);
    res.json(logs);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// Per-task stats aggregation for the Automation Settings page
router.get("/admin/automation/stats", authenticate, requireAdmin, async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        task,
        COUNT(*) AS total_runs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successes,
        SUM(CASE WHEN status = 'failed'  THEN 1 ELSE 0 END) AS failures,
        SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) AS skipped,
        MAX(executed_at) AS last_run
      FROM cron_logs
      WHERE executed_at > NOW() - INTERVAL '30 days'
      GROUP BY task
      ORDER BY MAX(executed_at) DESC
    `);

    // Fetch the latest log entry per task for last_status + last_message
    const tasks: string[] = (rows as any[]).map((r: any) => r.task);
    const latestPerTask: Record<string, any> = {};
    for (const task of tasks) {
      const [latest] = await db.select()
        .from(cronLogsTable)
        .where(sql`task = ${task}`)
        .orderBy(desc(cronLogsTable.executedAt))
        .limit(1);
      if (latest) latestPerTask[task] = latest;
    }

    const stats = (rows as any[]).map((r: any) => ({
      task: r.task,
      totalRuns: Number(r.total_runs),
      successes: Number(r.successes),
      failures: Number(r.failures),
      skipped: Number(r.skipped),
      lastRun: r.last_run,
      lastStatus: latestPerTask[r.task]?.status ?? "unknown",
      lastMessage: latestPerTask[r.task]?.message ?? null,
    }));

    // Overall last cron run time
    const [lastRun] = await db.select({ executedAt: cronLogsTable.executedAt })
      .from(cronLogsTable)
      .orderBy(desc(cronLogsTable.executedAt))
      .limit(1);

    res.json({
      lastCronRun: lastRun?.executedAt ?? null,
      activeTasks: stats.length,
      stats,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Run all tasks
router.post("/admin/cron/run", authenticate, requireAdmin, async (_req, res) => {
  try {
    res.json({ started: true, message: "All automation tasks started" });
    runAllCronTasks().catch(console.warn);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// Run individual task
router.post("/admin/cron/run/:task", authenticate, requireAdmin, async (req, res) => {
  const taskMap: Record<string, () => Promise<void>> = {
    "billing:invoice_generation":      runBillingCron,
    "billing:auto_suspend":            runSuspendOverdueCron,
    "billing:auto_terminate":          runAutoTerminateCron,
    "billing:auto_unsuspend":          runUnsuspendRestoredCron,
    "emails:hosting_renewal_reminder": runHostingRenewalReminderCron,
    "domains:renewal_check":           runDomainRenewalCron,
    "emails:invoice_reminders":        runInvoiceRemindersCron,
    "vps:power_off_overdue":           runVpsPowerOffCron,
    "backup:daily":                    runDailyBackupCron,
  };
  const fn = taskMap[req.params.task];
  if (!fn) return res.status(404).json({ error: "Unknown task" });
  try {
    res.json({ started: true, task: req.params.task });
    fn().catch(console.warn);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// Clear old logs
router.delete("/admin/cron-logs", authenticate, requireAdmin, async (_req, res) => {
  try {
    await db.delete(cronLogsTable).where(sql`executed_at < NOW() - INTERVAL '30 days'`);
    res.json({ success: true, message: "Cleared logs older than 30 days" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
