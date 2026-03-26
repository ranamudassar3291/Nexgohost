import { Router } from "express";
import { db } from "@workspace/db";
import { cronLogsTable, hostingServicesTable, invoicesTable, usersTable } from "@workspace/db/schema";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { desc, sql, eq, and } from "drizzle-orm";
import {
  runAllCronTasks,
  runBillingCron, runMarkOverdueCron, runSuspendOverdueCron, runAutoTerminateCron,
  runUnsuspendRestoredCron, runHostingRenewalReminderCron,
  runDomainRenewalCron, runInvoiceRemindersCron,
  runVpsPowerOffCron, runDailyBackupCron,
} from "../lib/cron.js";
import { suspendHostingAccount } from "../lib/provision.js";
import { emailServiceTerminated } from "../lib/email.js";

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
    "billing:mark_overdue":            runMarkOverdueCron,
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

// List services pending manual termination approval
router.get("/admin/pending-terminations", authenticate, requireAdmin, async (_req, res) => {
  try {
    const services = await db.select().from(hostingServicesTable)
      .where(eq(hostingServicesTable.status, "pending_termination" as any));

    const result = await Promise.all(services.map(async (s) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, s.clientId)).limit(1);
      const [invoice] = await db.select().from(invoicesTable)
        .where(and(eq(invoicesTable.serviceId, s.id), eq(invoicesTable.status, "overdue"))).limit(1);
      return {
        id: s.id,
        planName: s.planName,
        domain: s.domain ?? null,
        clientId: s.clientId,
        clientName: user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email : "Unknown",
        clientEmail: user?.email ?? null,
        overdueInvoiceId: invoice?.id ?? null,
        overdueAmount: invoice ? Number(invoice.total) : 0,
        dueDate: invoice?.dueDate?.toISOString() ?? null,
        flaggedAt: s.updatedAt?.toISOString() ?? null,
      };
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin manually confirms termination of a specific service
router.post("/admin/services/:id/terminate", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    const [service] = await db.select().from(hostingServicesTable).where(eq(hostingServicesTable.id, id)).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });
    if (service.status !== "pending_termination") {
      return res.status(400).json({ error: "Service is not pending termination" });
    }

    // Suspend in WHM (non-fatal)
    try {
      if (service.username) await suspendHostingAccount(service.username, service.serverId, "Terminated by admin");
    } catch { /* non-fatal */ }

    await db.update(hostingServicesTable)
      .set({ status: "terminated", updatedAt: new Date() })
      .where(eq(hostingServicesTable.id, id));

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, service.clientId)).limit(1);
    if (user) {
      const terminationDate = new Date().toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" });
      emailServiceTerminated(user.email, {
        clientName: user.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user.email,
        domain: service.domain ?? service.planName,
        serviceName: service.planName,
        terminationDate,
      }, { clientId: service.clientId, referenceId: service.id }).catch(() => {});
    }

    res.json({ success: true, message: `Service ${service.planName} terminated` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin cancels pending termination (client paid or admin decided to keep)
router.post("/admin/services/:id/cancel-termination", authenticate, requireAdmin, async (_req: AuthRequest, res) => {
  const { id } = _req.params;
  try {
    const [service] = await db.select().from(hostingServicesTable).where(eq(hostingServicesTable.id, id)).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });

    await db.update(hostingServicesTable)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(eq(hostingServicesTable.id, id));

    res.json({ success: true, message: `Termination cancelled — service returned to suspended status` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
