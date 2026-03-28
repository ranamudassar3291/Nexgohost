/**
 * Noehost Backup & Security API
 * GET  /admin/backups          — list backup history (last 30)
 * POST /admin/backups/run      — trigger manual backup
 * GET  /admin/backups/status   — config + last backup summary
 * GET  /admin/backups/drive-info — Google Drive quota
 */
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { driveBackupLogsTable } from "@workspace/db/schema";
import { desc } from "drizzle-orm";
import { authenticate, requireAdmin } from "../lib/auth.js";
import { isDriveConfigured, runGoogleDriveBackup } from "../lib/drive-backup.js";

const router = Router();

router.get("/admin/backups", authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const logs = await db.select().from(driveBackupLogsTable)
      .orderBy(desc(driveBackupLogsTable.startedAt))
      .limit(30);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/admin/backups/status", authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const configured = isDriveConfigured();
    const [last] = await db.select().from(driveBackupLogsTable)
      .orderBy(desc(driveBackupLogsTable.startedAt))
      .limit(1);
    res.json({ configured, last: last ?? null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/admin/backups/run", authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    if (!isDriveConfigured()) {
      res.status(400).json({ error: "Google Drive is not configured. Add GOOGLE_SERVICE_ACCOUNT_JSON in environment secrets." });
      return;
    }
    res.json({ message: "Backup started in background — refresh in a minute to see results." });
    // Run async so the response returns immediately
    runGoogleDriveBackup("manual").catch(err => {
      console.error("[Backup] Manual backup failed:", err.message);
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
