/**
 * Noehost Backup & Drive API
 *
 * OAuth Flow:
 *   GET  /admin/backups/google/auth-url   → returns { url } to redirect browser to Google consent
 *   GET  /admin/backups/google/callback   → Google redirects here after consent (browser endpoint)
 *   DELETE /admin/backups/google/disconnect → revoke tokens
 *
 * Backup Control:
 *   GET  /admin/backups/status     → { connected, email, autoEnabled, last }
 *   GET  /admin/backups            → list last 50 backup logs
 *   POST /admin/backups/run        → trigger manual backup in background
 *   POST /admin/backups/toggle     → { enabled: boolean } toggle auto-backup
 */
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { driveBackupLogsTable } from "@workspace/db/schema";
import { desc } from "drizzle-orm";
import { authenticate, requireAdmin } from "../lib/auth.js";
import {
  buildDriveAuthUrl,
  exchangeCodeForTokens,
  disconnectDrive,
  getDriveConnectionStatus,
  isAutoBackupEnabled,
  setAutoBackupEnabled,
  runGoogleDriveBackup,
  getDriveCallbackUrl,
  getDriveStorageInfo,
} from "../lib/drive-backup.js";
import { getAppUrl } from "../lib/app-url.js";

const router = Router();

// ─── OAuth Flow ───────────────────────────────────────────────────────────────

router.get("/admin/backups/google/auth-url", authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const url = await buildDriveAuthUrl();
    res.json({ url, callbackUrl: getDriveCallbackUrl() });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Browser redirect endpoint (Google redirects here after consent)
router.get("/admin/backups/google/callback", async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const error = req.query.error as string;
  const frontendUrl = `${getAppUrl()}/admin/backups`;

  if (error) {
    console.error("[Backup] Google OAuth error:", error);
    res.redirect(`${frontendUrl}?drive_error=${encodeURIComponent(error)}`);
    return;
  }

  if (!code) {
    res.redirect(`${frontendUrl}?drive_error=no_code`);
    return;
  }

  try {
    const { email } = await exchangeCodeForTokens(code);
    console.log(`[Backup] Google Drive connected for: ${email}`);
    res.redirect(`${frontendUrl}?drive_connected=1&email=${encodeURIComponent(email)}`);
  } catch (err: any) {
    console.error("[Backup] Token exchange failed:", err.message);
    res.redirect(`${frontendUrl}?drive_error=${encodeURIComponent(err.message)}`);
  }
});

router.delete("/admin/backups/google/disconnect", authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    await disconnectDrive();
    res.json({ message: "Google Drive disconnected successfully." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Status & Config ──────────────────────────────────────────────────────────

router.get("/admin/backups/status", authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const [connection, autoEnabled, lastArr] = await Promise.all([
      getDriveConnectionStatus(),
      isAutoBackupEnabled(),
      db.select().from(driveBackupLogsTable).orderBy(desc(driveBackupLogsTable.startedAt)).limit(1),
    ]);
    res.json({ ...connection, autoEnabled, last: lastArr[0] ?? null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/admin/backups/toggle", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body as { enabled: boolean };
    await setAutoBackupEnabled(!!enabled);
    res.json({ enabled: !!enabled, message: `Automatic backups ${enabled ? "enabled" : "disabled"}.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Live Drive Storage ────────────────────────────────────────────────────────

router.get("/admin/backups/storage", authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const info = await getDriveStorageInfo();
    if (!info) {
      res.json({ usedMb: null, totalMb: null });
      return;
    }
    res.json(info);
  } catch (err: any) {
    res.json({ usedMb: null, totalMb: null, error: err.message });
  }
});

// ─── Backup History ───────────────────────────────────────────────────────────

router.get("/admin/backups", authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const logs = await db.select().from(driveBackupLogsTable)
      .orderBy(desc(driveBackupLogsTable.startedAt))
      .limit(50);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Manual Trigger ───────────────────────────────────────────────────────────

router.post("/admin/backups/run", authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const { connected } = await getDriveConnectionStatus();
    if (!connected) {
      res.status(400).json({ error: "Google Drive not connected. Use 'Connect Google Drive' first." });
      return;
    }
    res.json({ message: "Backup started — check the history table in 1–2 minutes." });
    runGoogleDriveBackup("manual").catch(err => {
      console.error("[Backup] Manual backup failed:", err.message);
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
