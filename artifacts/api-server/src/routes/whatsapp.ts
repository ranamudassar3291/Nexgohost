/**
 * Noehost WhatsApp Alert System — Admin Routes
 */
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { whatsappLogsTable, settingsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { authenticate, requireAdmin } from "../lib/auth.js";
import {
  getWaState,
  connectWhatsApp,
  disconnectWhatsApp,
  sendWhatsAppAlert,
  getAdminPhone,
  setAdminPhone,
} from "../lib/whatsapp.js";

const router = Router();

// GET connection status + QR
router.get("/admin/whatsapp/status", authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const state = getWaState();
    const adminPhone = await getAdminPhone();
    res.json({
      status: state.status,
      qrDataUrl: state.qrDataUrl,
      connectedAt: state.connectedAt,
      phone: state.phone,
      error: state.error,
      adminPhone,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST connect (triggers QR generation)
router.post("/admin/whatsapp/connect", authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const state = getWaState();
    if (state.status === "connected") {
      res.json({ success: true, message: "Already connected" });
      return;
    }
    connectWhatsApp().catch(console.error);
    res.json({ success: true, message: "Connecting… scan the QR code in a few seconds" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST disconnect + clear session
router.post("/admin/whatsapp/disconnect", authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    await disconnectWhatsApp();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET/POST admin phone number
router.get("/admin/whatsapp/phone", authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const phone = await getAdminPhone();
    res.json({ phone });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/admin/whatsapp/phone", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { phone } = req.body as { phone: string };
    if (!phone) { res.status(400).json({ error: "Phone required" }); return; }
    await setAdminPhone(phone.replace(/\D/g, ""));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST test message
router.post("/admin/whatsapp/test", authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const ok = await sendWhatsAppAlert("test",
      `✅ *Noehost Test Alert*\n\nThis is a test message from your Noehost admin panel.\n\nIf you received this, your WhatsApp notifications are working perfectly! 🎉\n\n_Sent: ${new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}_`);
    if (ok) res.json({ success: true, message: "Test message sent!" });
    else res.json({ success: false, message: "WhatsApp not connected or admin phone not set" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET alert logs
router.get("/admin/whatsapp/logs", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) ?? "20"), 50);
    const logs = await db.select().from(whatsappLogsTable)
      .orderBy(desc(whatsappLogsTable.sentAt)).limit(limit);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
