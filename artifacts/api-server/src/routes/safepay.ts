/**
 * Safepay Payment Gateway Integration — Official SDK (@sfpy/node-core)
 *
 * Key mapping:
 *   livePublicKey  (pub_xxx) → `client` field in API body (merchant identifier)
 *   liveSecretKey  (sec_xxx) → SDK constructor → X-SFPY-SECRET-KEY header
 *
 * Routes:
 *   POST /api/payments/safepay/initiate  — Create payment session, return checkout URL
 *   POST /api/webhooks/safepay           — Receive & verify webhook, auto-activate service
 *
 * Webhook is registered BEFORE express.json() in app.ts (receives raw Buffer for HMAC).
 */
import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import Safepay from "@sfpy/node-core";
import { db } from "@workspace/db";
import { invoicesTable, paymentMethodsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../lib/auth.js";
import { processInvoicePaid } from "../lib/activateInvoice.js";

const router = Router();

// ─── Config loader ─────────────────────────────────────────────────────────────
interface SafepayConfig {
  publicKey: string;   // pub_xxx  — merchant identifier (goes in `client` field)
  secretKey: string;   // sec_xxx  — API secret (goes in X-SFPY-SECRET-KEY header)
  webhookSecret: string;
  isSandbox: boolean;
}

async function getSafepayConfig(): Promise<SafepayConfig | null> {
  const [method] = await db.select().from(paymentMethodsTable)
    .where(eq(paymentMethodsTable.type, "safepay"))
    .limit(1);
  if (!method?.isActive) return null;

  const settings = JSON.parse(method.settings ?? "{}");
  const isSandbox = !!method.isSandbox;

  const publicKey = isSandbox
    ? (settings.sandboxPublicKey ?? "")
    : (settings.livePublicKey ?? "");

  const secretKey = isSandbox
    ? (settings.sandboxSecretKey ?? "")
    : (settings.liveSecretKey ?? "");

  const webhookSecret = settings.webhookSecret ?? "";

  // Key format validation — log first 12 chars so admin can verify against dashboard
  const pubPreview  = publicKey  ? `${publicKey.substring(0, 12)}…`  : "MISSING";
  const secPreview  = secretKey  ? `${secretKey.substring(0, 12)}…`  : "MISSING";
  const hookPreview = webhookSecret ? `${webhookSecret.substring(0, 8)}…` : "none";

  console.log(
    `[SAFEPAY] Mode: ${isSandbox ? "sandbox" : "LIVE"} | ` +
    `publicKey: ${pubPreview} | secretKey: ${secPreview} | webhookSecret: ${hookPreview}`
  );

  // Warn if keys look swapped (pub_ in wrong field, sec_ where pub_ expected, etc.)
  if (publicKey && publicKey.startsWith("sec_")) {
    console.warn(
      "[SAFEPAY] ⚠ Live Public Key starts with 'sec_' — it may be in the wrong field. " +
      "The Public Key field should contain your pub_xxx key from Safepay Dashboard → Developers → API Keys."
    );
  }
  if (secretKey && !secretKey.startsWith("sec_")) {
    console.warn(
      "[SAFEPAY] ⚠ Live Secret Key doesn't start with 'sec_' — verify it matches " +
      "your Secret Key from Safepay Dashboard → Developers → API Keys."
    );
  }

  if (!publicKey || !secretKey) {
    console.error("[SAFEPAY] Missing required keys — cannot initiate payment.");
    return null;
  }

  return { publicKey, secretKey, webhookSecret, isSandbox };
}

// ─── Friendly error parser ──────────────────────────────────────────────────────
function parseSafepayError(body: string): { userMsg: string; techDetail: string } {
  try {
    const parsed = JSON.parse(body);
    const errors: string[] = parsed?.status?.errors ?? [];
    const msg = errors[0] ?? parsed?.status?.message ?? parsed?.message ?? "Unknown error";

    if (msg.toLowerCase().includes("client") && msg.toLowerCase().includes("not found")) {
      return {
        userMsg: "Payment gateway configuration error — please contact support.",
        techDetail:
          `[KEY ERROR] Safepay rejected the merchant identifier (pub_ key). ` +
          `Go to Admin → Payment Methods → Safepay and verify:\n` +
          `  • Live Public Key  = your pub_xxx key from Safepay Dashboard\n` +
          `  • Live Secret Key  = your sec_xxx key from Safepay Dashboard\n` +
          `Safepay error: "${msg}"`,
      };
    }
    if (msg.toLowerCase().includes("environment")) {
      return {
        userMsg: "Payment gateway environment mismatch — please contact support.",
        techDetail: `[ENV ERROR] ${msg} — ensure sandbox mode checkbox matches your key type.`,
      };
    }
    if (msg.toLowerCase().includes("amount")) {
      return {
        userMsg: "Invalid payment amount — please contact support.",
        techDetail: `[AMOUNT ERROR] ${msg} — amount must be a positive integer in paisa.`,
      };
    }
    return { userMsg: "Payment creation failed — please try again.", techDetail: msg };
  } catch {
    return { userMsg: "Unexpected response from payment gateway.", techDetail: body.substring(0, 300) };
  }
}

// ─── POST /api/payments/safepay/initiate ───────────────────────────────────────
router.post("/payments/safepay/initiate", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { invoiceId } = req.body ?? {};
    if (!invoiceId) {
      res.status(400).json({ error: "invoiceId is required" });
      return;
    }

    // Load & verify invoice
    const [invoice] = await db.select().from(invoicesTable)
      .where(eq(invoicesTable.id, invoiceId)).limit(1);
    if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
    if (invoice.clientId !== req.user!.userId) { res.status(403).json({ error: "Forbidden" }); return; }
    if (invoice.status === "paid") { res.status(400).json({ error: "Invoice already paid" }); return; }

    const config = await getSafepayConfig();
    if (!config) {
      res.status(503).json({ error: "Safepay gateway is not configured or inactive" });
      return;
    }

    const env  = config.isSandbox ? "sandbox" : "production";
    const host = config.isSandbox
      ? "https://sandbox.api.getsafepay.com"
      : "https://api.getsafepay.com";

    // Amount must be a whole integer in paisa (PKR smallest unit: 1 PKR = 100 paisa)
    const amount = Math.round(parseFloat(invoice.total) * 100);

    // Build Safepay SDK instance — secretKey goes in X-SFPY-SECRET-KEY header
    const sfpy = new Safepay(config.secretKey, {
      authType: "secret",
      host,
    });

    const sessionPayload = {
      client:      config.publicKey,   // pub_xxx — merchant identifier
      environment: env,
      amount,                          // integer paisa — e.g. Rs.1,845.00 → 184500
      currency:    "PKR",
      order_id:    invoice.invoiceNumber,
    };

    console.log(
      `[SAFEPAY] → POST ${host}/order/payments/v3/ | Invoice: ${invoice.invoiceNumber}\n` +
      `[SAFEPAY] → Payload: ${JSON.stringify({ ...sessionPayload, _secretPreview: config.secretKey.substring(0, 12) + "…" }, null, 2)}`
    );

    // ── Call Safepay API via SDK ───────────────────────────────────────────────
    let sessionData: any;
    try {
      sessionData = await sfpy.payments.session.setup(sessionPayload);
    } catch (sdkErr: any) {
      // SDK wraps HTTP errors — extract body for friendly message
      const rawBody = sdkErr?.response?.data ?? sdkErr?.message ?? String(sdkErr);
      const bodyStr = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody);
      const { userMsg, techDetail } = parseSafepayError(bodyStr);
      console.error(`[SAFEPAY] ✗ Session setup failed: ${techDetail}`);
      console.error(`[SAFEPAY] Raw error:`, rawBody);
      res.status(502).json({ error: userMsg, detail: techDetail });
      return;
    }

    // Support both v1 and v3 response shapes
    const tracker: string =
      sessionData?.data?.token?.tracker ??
      sessionData?.token?.tracker ??
      sessionData?.tracker ??
      "";

    const tbt: string =
      sessionData?.data?.token?.tbt ??
      sessionData?.token?.tbt ??
      sessionData?.tbt ??
      "";

    if (!tracker) {
      console.error("[SAFEPAY] No tracker in response:", JSON.stringify(sessionData));
      res.status(502).json({ error: "Payment gateway returned no token — please try again." });
      return;
    }

    console.log(`[SAFEPAY] ✓ Session created | tracker: ${tracker} | tbt: ${tbt ? tbt.substring(0, 12) + "…" : "none"}`);

    // Persist tracker so webhook can match payment back to this invoice
    await db.update(invoicesTable)
      .set({
        status:       "payment_pending",
        paymentRef:   tracker,
        paymentNotes: `Safepay — ${env}`,
        updatedAt:    new Date(),
      })
      .where(eq(invoicesTable.id, invoice.id));

    // Build return/cancel URLs
    const appDomain = process.env["REPLIT_DEV_DOMAIN"]
      ? `https://${process.env["REPLIT_DEV_DOMAIN"]}`
      : (process.env["APP_URL"] ?? "https://noehost.com");
    const redirectUrl = `${appDomain}/client/payment/return?tracker=${tracker}&invoice=${invoice.id}`;
    const cancelUrl   = `${appDomain}/client/invoices`;

    // Build checkout URL using SDK helper
    const checkoutUrl = sfpy.checkout.createCheckoutUrl({
      env:          env as "sandbox" | "production",
      tbt:          tbt || tracker,    // tbt preferred; fall back to tracker
      tracker,
      source:       "custom",
      order_id:     invoice.invoiceNumber,
      redirect_url: redirectUrl,
      cancel_url:   cancelUrl,
    });

    console.log(`[SAFEPAY] ✓ Checkout URL: ${checkoutUrl.substring(0, 140)}…`);

    res.json({ checkoutUrl, tracker, invoiceId: invoice.id });
  } catch (err) {
    console.error("[SAFEPAY] Unhandled initiate error:", err);
    res.status(500).json({ error: "Server error — please try again." });
  }
});

// ─── Webhook handler (raw body — registered in app.ts before express.json()) ───
export async function safepayWebhookHandler(req: Request, res: Response): Promise<void> {
  try {
    const rawBody: Buffer = req.body as Buffer;
    const signature = req.headers["x-sfpy-signature"] as string | undefined;

    const config = await getSafepayConfig();

    // HMAC verification using webhookSecret
    if (config?.webhookSecret && signature) {
      const expected = crypto
        .createHmac("sha256", config.webhookSecret)
        .update(rawBody)
        .digest("hex");

      if (expected !== signature) {
        console.warn("[SAFEPAY WEBHOOK] ✗ Invalid signature — rejected");
        res.status(401).json({ error: "Invalid signature" });
        return;
      }
      console.log("[SAFEPAY WEBHOOK] ✓ Signature verified");
    } else if (config?.webhookSecret && !signature) {
      console.warn("[SAFEPAY WEBHOOK] Missing X-SFPY-SIGNATURE header — rejected");
      res.status(401).json({ error: "Missing signature" });
      return;
    } else {
      console.warn("[SAFEPAY WEBHOOK] No webhook secret configured — skipping signature check");
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }

    console.log("[SAFEPAY WEBHOOK] Received:", JSON.stringify(payload).substring(0, 600));

    const notificationType: string = (payload?.notification_type ?? "").toLowerCase();

    // Extract tracker & order ID — handle multiple Safepay payload shapes
    const tracker: string =
      payload?.payload?.tracker?.token ??
      payload?.payload?.tracker ??
      payload?.data?.tracker?.token ??
      "";

    const orderId: string =
      payload?.payload?.order?.order_id ??
      payload?.payload?.order_id ??
      payload?.data?.order?.order_id ??
      "";

    // Only process payment events
    if (!notificationType.includes("payment")) {
      console.log(`[SAFEPAY WEBHOOK] Ignoring non-payment event: ${notificationType}`);
      res.json({ received: true });
      return;
    }

    const paymentStatus: string = (
      payload?.payload?.tracker?.status ??
      payload?.payload?.status ??
      payload?.data?.status ??
      ""
    ).toLowerCase();

    const successStatuses = ["paid", "success", "captured", "completed", "settled"];
    if (paymentStatus && !successStatuses.includes(paymentStatus)) {
      console.log(`[SAFEPAY WEBHOOK] Payment not successful — status: ${paymentStatus}`);
      res.json({ received: true });
      return;
    }

    // Find invoice by tracker token (paymentRef) or invoice number (order_id)
    let invoice: any = null;
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
      console.error(`[SAFEPAY WEBHOOK] ✗ Invoice not found — tracker: "${tracker}", orderId: "${orderId}"`);
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    // Idempotency guard — ignore duplicate webhooks
    if (invoice.status === "paid") {
      console.log(`[SAFEPAY WEBHOOK] Invoice ${invoice.invoiceNumber} already paid — ignoring duplicate`);
      res.json({ received: true, alreadyPaid: true });
      return;
    }

    console.log(`[SAFEPAY WEBHOOK] Processing payment for invoice ${invoice.invoiceNumber}`);

    // Activate invoice: marks paid, provisions WHM service, credits affiliate, sends confirmation email
    const result = await processInvoicePaid(
      invoice.id,
      tracker || `SFPY-${Date.now()}`,
      `Safepay webhook — ${config?.isSandbox ? "sandbox" : "live"} | event: ${notificationType}`,
    );

    if (result.success) {
      console.log(`[SAFEPAY WEBHOOK] ✓ Invoice ${invoice.invoiceNumber} activated successfully`);
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
