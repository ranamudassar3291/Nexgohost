/**
 * Safepay Payment Gateway Integration
 *
 * Routes:
 *   POST /api/payments/safepay/initiate  — Create a payment tracker & return checkout URL
 *   POST /api/webhooks/safepay           — Receive & verify Safepay webhook, activate service
 *
 * The webhook route is registered in app.ts BEFORE express.json() so it receives
 * the raw Buffer body needed for HMAC signature verification.
 */
import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { invoicesTable, paymentMethodsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../lib/auth.js";
import { processInvoicePaid } from "../lib/activateInvoice.js";

const router = Router();

// ─── Helper: fetch active Safepay gateway config ───────────────────────────────
async function getSafepayConfig(): Promise<{
  secretKey: string;
  webhookSecret: string;
  isSandbox: boolean;
} | null> {
  const [method] = await db.select().from(paymentMethodsTable)
    .where(eq(paymentMethodsTable.type, "safepay"))
    .limit(1);
  if (!method || !method.isActive) return null;
  const settings = JSON.parse(method.settings ?? "{}");
  const secretKey = method.isSandbox ? settings.sandboxSecretKey : settings.liveSecretKey;
  const webhookSecret = settings.webhookSecret ?? "";
  if (!secretKey) return null;
  return { secretKey, webhookSecret, isSandbox: !!method.isSandbox };
}

// ─── Safepay base URLs ─────────────────────────────────────────────────────────
function getBaseUrl(isSandbox: boolean) {
  return isSandbox
    ? "https://sandbox.api.getsafepay.com"
    : "https://api.getsafepay.com";
}

// ─── POST /api/payments/safepay/initiate ──────────────────────────────────────
router.post("/payments/safepay/initiate", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { invoiceId } = req.body ?? {};
    if (!invoiceId) {
      res.status(400).json({ error: "invoiceId is required" });
      return;
    }

    // Load invoice
    const [invoice] = await db.select().from(invoicesTable)
      .where(eq(invoicesTable.id, invoiceId)).limit(1);
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    if (invoice.clientId !== req.user!.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (invoice.status === "paid") {
      res.status(400).json({ error: "Invoice already paid" });
      return;
    }

    // Load Safepay config
    const config = await getSafepayConfig();
    if (!config) {
      res.status(503).json({ error: "Safepay gateway is not configured or inactive" });
      return;
    }

    const base = getBaseUrl(config.isSandbox);
    const amount = Math.round(parseFloat(invoice.total) * 100); // Safepay uses paisa (smallest unit)

    // Create payment tracker
    const trackerRes = await fetch(`${base}/order/v1/init`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SFPY-SECRET-KEY": config.secretKey,
      },
      body: JSON.stringify({
        amount,         // in paisa
        currency: "PKR",
      }),
    });

    if (!trackerRes.ok) {
      const errText = await trackerRes.text();
      console.error("[SAFEPAY] Tracker creation failed:", errText);
      res.status(502).json({ error: "Failed to create Safepay payment — please try again" });
      return;
    }

    const trackerData = await trackerRes.json() as any;
    const tracker = trackerData?.token?.tracker;

    if (!tracker) {
      console.error("[SAFEPAY] No tracker in response:", JSON.stringify(trackerData));
      res.status(502).json({ error: "Invalid response from Safepay" });
      return;
    }

    console.log(`[SAFEPAY] Tracker created: ${tracker} for invoice ${invoice.invoiceNumber}`);

    // Store tracker token in invoice paymentRef
    await db.update(invoicesTable)
      .set({
        status: "payment_pending",
        paymentRef: tracker,
        paymentNotes: `Safepay — ${config.isSandbox ? "sandbox" : "live"}`,
        updatedAt: new Date(),
      })
      .where(eq(invoicesTable.id, invoice.id));

    // Build return/cancel URLs
    const appDomain = process.env["REPLIT_DEV_DOMAIN"]
      ? `https://${process.env["REPLIT_DEV_DOMAIN"]}`
      : process.env["APP_URL"] ?? "https://noehost.com";
    const redirectUrl = `${appDomain}/client/payment/return?tracker=${tracker}&invoice=${invoice.id}`;
    const cancelUrl = `${appDomain}/client/invoices`;

    // Checkout URL
    const env = config.isSandbox ? "sandbox" : "production";
    const checkoutUrl = `${base}/checkout/pay?env=${env}&tracker=${tracker}&source=custom&order_id=${invoice.invoiceNumber}&redirect_url=${encodeURIComponent(redirectUrl)}&cancel_url=${encodeURIComponent(cancelUrl)}`;

    res.json({ checkoutUrl, tracker, invoiceId: invoice.id });
  } catch (err) {
    console.error("[SAFEPAY] initiate error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Exported webhook handler (raw body) ──────────────────────────────────────
// Registered in app.ts BEFORE express.json() so rawBody is a Buffer
export async function safepayWebhookHandler(req: Request, res: Response): Promise<void> {
  try {
    const rawBody: Buffer = req.body as Buffer;
    const signature = req.headers["x-sfpy-signature"] as string | undefined;

    // Load Safepay config
    const config = await getSafepayConfig();

    // Verify HMAC signature if webhookSecret is configured
    if (config?.webhookSecret && signature) {
      const hmac = crypto.createHmac("sha256", config.webhookSecret);
      hmac.update(rawBody);
      const expected = hmac.digest("hex");
      if (expected !== signature) {
        console.warn("[SAFEPAY WEBHOOK] Invalid signature — rejecting");
        res.status(401).json({ error: "Invalid signature" });
        return;
      }
    } else if (config?.webhookSecret && !signature) {
      console.warn("[SAFEPAY WEBHOOK] Missing X-SFPY-SIGNATURE header — rejecting");
      res.status(401).json({ error: "Missing signature" });
      return;
    }

    // Parse body
    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }

    console.log("[SAFEPAY WEBHOOK] Received:", JSON.stringify(payload).substring(0, 400));

    const notificationType: string = payload?.notification_type ?? "";
    const tracker: string =
      payload?.payload?.tracker?.token ??
      payload?.payload?.tracker ??
      "";
    const orderId: string =
      payload?.payload?.order?.order_id ??
      payload?.payload?.order_id ??
      "";

    // Only process successful payment notifications
    if (!notificationType.includes("payment")) {
      console.log(`[SAFEPAY WEBHOOK] Ignoring notification type: ${notificationType}`);
      res.json({ received: true });
      return;
    }

    const paymentStatus: string =
      payload?.payload?.tracker?.status ??
      payload?.payload?.status ??
      "";

    if (paymentStatus && !["paid", "PAID", "success", "SUCCESS"].includes(paymentStatus)) {
      console.log(`[SAFEPAY WEBHOOK] Payment status is not success: ${paymentStatus}`);
      res.json({ received: true });
      return;
    }

    // Find invoice by tracker (stored as paymentRef) or by invoice number (orderId)
    let invoice = null;
    if (tracker) {
      const [inv] = await db.select().from(invoicesTable)
        .where(eq(invoicesTable.paymentRef, tracker)).limit(1);
      invoice = inv ?? null;
    }
    if (!invoice && orderId) {
      const [inv] = await db.select().from(invoicesTable)
        .where(eq(invoicesTable.invoiceNumber, orderId)).limit(1);
      invoice = inv ?? null;
    }

    if (!invoice) {
      console.error(`[SAFEPAY WEBHOOK] Invoice not found — tracker: ${tracker}, orderId: ${orderId}`);
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    console.log(`[SAFEPAY WEBHOOK] Processing payment for invoice ${invoice.invoiceNumber}`);

    // Activate invoice — this does: mark paid, provision service, affiliate credit, send email
    const result = await processInvoicePaid(
      invoice.id,
      tracker || `SFPY-${Date.now()}`,
      `Safepay webhook — ${config?.isSandbox ? "sandbox" : "live"} — type: ${notificationType}`,
    );

    if (result.success) {
      console.log(`[SAFEPAY WEBHOOK] Successfully activated invoice ${invoice.invoiceNumber}`);
      res.json({ received: true, activated: true });
    } else {
      console.error(`[SAFEPAY WEBHOOK] Activation failed for invoice ${invoice.invoiceNumber}:`, result.error);
      res.status(500).json({ error: result.error ?? "Activation failed" });
    }
  } catch (err) {
    console.error("[SAFEPAY WEBHOOK] Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export default router;
