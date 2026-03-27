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
  publicKey: string;
  webhookSecret: string;
  isSandbox: boolean;
} | null> {
  const [method] = await db.select().from(paymentMethodsTable)
    .where(eq(paymentMethodsTable.type, "safepay"))
    .limit(1);
  if (!method || !method.isActive) return null;
  const settings = JSON.parse(method.settings ?? "{}");
  const isSandbox = !!method.isSandbox;
  const secretKey = isSandbox ? (settings.sandboxSecretKey ?? "") : (settings.liveSecretKey ?? "");
  const publicKey = isSandbox ? (settings.sandboxApiKey ?? settings.sandboxPublicKey ?? "") : (settings.livePublicKey ?? "");
  const webhookSecret = settings.webhookSecret ?? "";
  if (!secretKey) {
    console.error("[SAFEPAY] No secret key configured for mode:", isSandbox ? "sandbox" : "live");
    return null;
  }
  // Log first 8 chars of each key so admin can verify they match the dashboard
  console.log(
    `[SAFEPAY] Config loaded — mode: ${isSandbox ? "sandbox" : "live"}` +
    ` | client(publicKey): ${publicKey ? publicKey.substring(0, 12) + "…" : "MISSING"}` +
    ` | secretKey: ${secretKey ? secretKey.substring(0, 8) + "…" : "MISSING"}`
  );
  return { secretKey, publicKey, webhookSecret, isSandbox };
}

// ─── Safepay base URLs ─────────────────────────────────────────────────────────
function getBaseUrl(isSandbox: boolean) {
  return isSandbox
    ? "https://sandbox.api.getsafepay.com"
    : "https://api.getsafepay.com";
}

// ─── Friendly error parser ─────────────────────────────────────────────────────
function parseSafepayError(body: string): { userMsg: string; techDetail: string } {
  try {
    const parsed = JSON.parse(body);
    const errors: string[] = parsed?.status?.errors ?? [];
    const msg = errors[0] ?? parsed?.status?.message ?? "Unknown error";

    if (msg.toLowerCase().includes("client") && msg.toLowerCase().includes("not found")) {
      return {
        userMsg: "Safepay gateway configuration error — please contact support.",
        techDetail: `[KEY ERROR] Safepay rejected the client identifier. ` +
          `Verify your Live API Key in: Admin → Payment Methods → Safepay → Live Public Key. ` +
          `Safepay error: "${msg}"`,
      };
    }
    if (msg.toLowerCase().includes("environment")) {
      return {
        userMsg: "Safepay environment mismatch — please contact support.",
        techDetail: `[ENV ERROR] ${msg} — ensure sandbox mode checkbox matches your key type.`,
      };
    }
    return { userMsg: "Safepay payment creation failed — please try again.", techDetail: msg };
  } catch {
    return { userMsg: "Unexpected response from Safepay.", techDetail: body.substring(0, 200) };
  }
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
    const env = config.isSandbox ? "sandbox" : "production";

    // Amount in paisa (PKR smallest unit — 1 PKR = 100 paisa)
    // Must be a whole integer — no decimals
    const amount = Math.round(parseFloat(invoice.total) * 100);

    const trackerPayload = {
      client: config.publicKey,  // Merchant API Key from Safepay dashboard → Developers → API Keys
      environment: env,          // "production" for live, "sandbox" for test
      amount,                    // Integer paisa — e.g. Rs. 1845 → 184500
      currency: "PKR",
      order_id: invoice.invoiceNumber,
    };

    // ── DIAGNOSTIC LOG — exact payload being sent to Safepay ──────────────────
    console.log(
      `[SAFEPAY] → POST ${base}/order/v1/init\n` +
      `[SAFEPAY] → Payload: ${JSON.stringify({ ...trackerPayload, _secret: config.secretKey.substring(0, 8) + "…" }, null, 2)}\n` +
      `[SAFEPAY] Invoice: ${invoice.invoiceNumber} | Rs. ${invoice.total} → ${amount} paisa`
    );

    // Create payment tracker
    const trackerRes = await fetch(`${base}/order/v1/init`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SFPY-SECRET-KEY": config.secretKey,
      },
      body: JSON.stringify(trackerPayload),
    });

    const trackerBody = await trackerRes.text();

    if (!trackerRes.ok) {
      const { userMsg, techDetail } = parseSafepayError(trackerBody);
      console.error(`[SAFEPAY] ✗ Tracker failed (${trackerRes.status}): ${techDetail}`);
      console.error(`[SAFEPAY] Raw response: ${trackerBody}`);
      res.status(502).json({ error: userMsg, detail: techDetail });
      return;
    }

    let trackerData: any;
    try { trackerData = JSON.parse(trackerBody); } catch {
      console.error("[SAFEPAY] Non-JSON response:", trackerBody);
      res.status(502).json({ error: "Unexpected response from Safepay — please try again." });
      return;
    }

    // Support both response shapes from Safepay
    const tracker: string =
      trackerData?.token?.tracker ??
      trackerData?.data?.token?.tracker ??
      "";

    if (!tracker) {
      console.error("[SAFEPAY] No tracker token in response:", JSON.stringify(trackerData));
      res.status(502).json({ error: "Invalid response from Safepay — no payment token received." });
      return;
    }

    console.log(`[SAFEPAY] ✓ Tracker created: ${tracker} for invoice ${invoice.invoiceNumber}`);

    // Persist tracker token so webhook can match it back to this invoice
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
    const cancelUrl   = `${appDomain}/client/invoices`;

    const checkoutUrl =
      `${base}/checkout/pay` +
      `?env=${env}` +
      `&tracker=${tracker}` +
      `&source=custom` +
      `&order_id=${encodeURIComponent(invoice.invoiceNumber)}` +
      `&redirect_url=${encodeURIComponent(redirectUrl)}` +
      `&cancel_url=${encodeURIComponent(cancelUrl)}`;

    console.log(`[SAFEPAY] ✓ Checkout URL: ${checkoutUrl.substring(0, 120)}…`);

    res.json({ checkoutUrl, tracker, invoiceId: invoice.id });
  } catch (err) {
    console.error("[SAFEPAY] Unhandled initiate error:", err);
    res.status(500).json({ error: "Server error — please try again." });
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
        console.warn("[SAFEPAY WEBHOOK] ✗ Invalid signature — rejecting");
        res.status(401).json({ error: "Invalid signature" });
        return;
      }
      console.log("[SAFEPAY WEBHOOK] ✓ Signature verified");
    } else if (config?.webhookSecret && !signature) {
      console.warn("[SAFEPAY WEBHOOK] Missing X-SFPY-SIGNATURE header — rejecting");
      res.status(401).json({ error: "Missing signature" });
      return;
    } else {
      console.warn("[SAFEPAY WEBHOOK] No webhook secret configured — skipping signature check");
    }

    // Parse body
    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }

    console.log("[SAFEPAY WEBHOOK] Received:", JSON.stringify(payload).substring(0, 500));

    const notificationType: string = payload?.notification_type ?? "";
    const tracker: string =
      payload?.payload?.tracker?.token ??
      payload?.payload?.tracker ??
      "";
    const orderId: string =
      payload?.payload?.order?.order_id ??
      payload?.payload?.order_id ??
      "";

    // Only process payment notifications
    if (!notificationType.toLowerCase().includes("payment")) {
      console.log(`[SAFEPAY WEBHOOK] Ignoring notification type: ${notificationType}`);
      res.json({ received: true });
      return;
    }

    const paymentStatus: string =
      payload?.payload?.tracker?.status ??
      payload?.payload?.status ??
      "";

    if (paymentStatus && !["paid", "PAID", "success", "SUCCESS", "captured", "CAPTURED"].includes(paymentStatus)) {
      console.log(`[SAFEPAY WEBHOOK] Payment status not successful: ${paymentStatus}`);
      res.json({ received: true });
      return;
    }

    // Find invoice by tracker token (stored as paymentRef) or by invoice number (orderId)
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
      console.error(`[SAFEPAY WEBHOOK] ✗ Invoice not found — tracker: ${tracker}, orderId: ${orderId}`);
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    if (invoice.status === "paid") {
      console.log(`[SAFEPAY WEBHOOK] Invoice ${invoice.invoiceNumber} already paid — ignoring duplicate webhook`);
      res.json({ received: true, alreadyPaid: true });
      return;
    }

    console.log(`[SAFEPAY WEBHOOK] Processing payment for invoice ${invoice.invoiceNumber}`);

    // Activate invoice — marks paid, provisions service, credits affiliate, sends emails
    const result = await processInvoicePaid(
      invoice.id,
      tracker || `SFPY-${Date.now()}`,
      `Safepay webhook — ${config?.isSandbox ? "sandbox" : "live"} — type: ${notificationType}`,
    );

    if (result.success) {
      console.log(`[SAFEPAY WEBHOOK] ✓ Invoice ${invoice.invoiceNumber} activated`);
      res.json({ received: true, activated: true });
    } else {
      console.error(`[SAFEPAY WEBHOOK] ✗ Activation failed for ${invoice.invoiceNumber}:`, result.error);
      res.status(500).json({ error: result.error ?? "Activation failed" });
    }
  } catch (err) {
    console.error("[SAFEPAY WEBHOOK] Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export default router;
