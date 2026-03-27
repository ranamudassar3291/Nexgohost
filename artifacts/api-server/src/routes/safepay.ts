/**
 * Safepay Payment Gateway Integration
 *
 * Key mapping (Safepay Dashboard → Developers → API Keys):
 *   livePublicKey  (pub_xxx) → `client` field in /order/v1/init body (merchant API key)
 *   liveSecretKey  (sec_xxx) → X-SFPY-SECRET-KEY header (secret key)
 *   webhookSecret            → HMAC-SHA256 signature verification
 *
 * Checkout flow:
 *   1. POST /order/v1/init  → get tracker token
 *   2. Redirect to Safepay checkout URL with tracker
 *   3. Webhook POST /api/webhooks/safepay → auto-activate invoice
 *
 * Routes:
 *   GET  /api/payments/safepay/test      — verify keys are valid (admin)
 *   POST /api/payments/safepay/initiate  — create tracker & return checkout URL (client)
 *   POST /api/webhooks/safepay           — webhook handler (raw body, registered in app.ts)
 */
import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { invoicesTable, paymentMethodsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../lib/auth.js";
import { processInvoicePaid } from "../lib/activateInvoice.js";

const router = Router();

// ─── Config loader ─────────────────────────────────────────────────────────────
interface SafepayConfig {
  publicKey: string;    // pub_xxx — merchant API key → `client` in body
  secretKey: string;    // sec_xxx → X-SFPY-SECRET-KEY header
  webhookSecret: string;
  isSandbox: boolean;
}

async function getSafepayConfig(): Promise<SafepayConfig | null> {
  const [method] = await db.select().from(paymentMethodsTable)
    .where(eq(paymentMethodsTable.type, "safepay"))
    .limit(1);
  if (!method?.isActive) return null;

  const s = JSON.parse(method.settings ?? "{}");
  const isSandbox = !!method.isSandbox;

  // Keys are stored exactly as the admin entered them — no prefix enforcement.
  // livePublicKey  = Merchant Client ID  → sent as `client` in the API body
  // liveSecretKey  = API Secret Key      → sent as X-SFPY-SECRET-KEY header
  const publicKey     = isSandbox ? (s.sandboxPublicKey ?? "") : (s.livePublicKey ?? "");
  const secretKey     = isSandbox ? (s.sandboxSecretKey ?? "") : (s.liveSecretKey ?? "");
  const webhookSecret = s.webhookSecret ?? "";

  const pubPreview = publicKey  ? `${publicKey.substring(0, 16)}…`  : "MISSING";
  const secPreview = secretKey  ? `${secretKey.substring(0, 10)}…`  : "MISSING";

  console.log(
    `[SAFEPAY] Mode: ${isSandbox ? "sandbox ☑" : "LIVE"} | ` +
    `clientKey: ${pubPreview} | secretKey: ${secPreview}`
  );

  if (!publicKey || !secretKey) {
    console.error("[SAFEPAY] Missing keys — set both keys in Admin → Payment Methods → Safepay");
    return null;
  }

  return { publicKey, secretKey, webhookSecret, isSandbox };
}

function getApiBase(isSandbox: boolean) {
  return isSandbox ? "https://sandbox.api.getsafepay.com" : "https://api.getsafepay.com";
}

function getCheckoutBase(isSandbox: boolean) {
  return isSandbox ? "https://sandbox.api.getsafepay.com" : "https://api.getsafepay.com";
}

// ─── Friendly error parser ─────────────────────────────────────────────────────
function parseSafepayError(body: any): { userMsg: string; techDetail: string; isOnboarding?: boolean } {
  try {
    const parsed = typeof body === "string" ? JSON.parse(body) : body;
    const errors: string[] = parsed?.status?.errors ?? [];
    const msg = errors[0] ?? parsed?.status?.message ?? parsed?.message ?? "Unknown error";
    const msgLc = msg.toLowerCase();

    // ── Onboarding / account not live ────────────────────────────────────────
    const onboardingPhrases = [
      "onboarding", "not live", "not active", "account not", "pending approval",
      "pending verification", "under review", "not yet", "not approved",
      "setup mode", "incomplete", "not enabled", "disabled",
    ];
    if (onboardingPhrases.some(p => msgLc.includes(p))) {
      return {
        isOnboarding: true,
        userMsg: "Safepay is currently in setup mode. Please use Wallet or another payment method.",
        techDetail: `[ONBOARDING] Safepay account not yet live: "${msg}"`,
      };
    }

    // ── Key errors ───────────────────────────────────────────────────────────
    if (msgLc.includes("client") && msgLc.includes("not found")) {
      return {
        userMsg: "Payment gateway configuration error — please contact support.",
        techDetail:
          `[KEY ERROR] Safepay rejected the pub_ key as client identifier.\n` +
          `Verify Admin → Payment Methods → Safepay:\n` +
          `  • Live Public Key  = pub_xxx\n` +
          `  • Live Secret Key  = sec_xxx\n` +
          `Error: "${msg}"`,
      };
    }
    if (msgLc.includes("environment")) {
      return {
        userMsg: "Payment gateway environment mismatch — please contact support.",
        techDetail: `[ENV ERROR] ${msg}`,
      };
    }
    if (msgLc.includes("amount")) {
      return {
        userMsg: "Invalid payment amount — please contact support.",
        techDetail: `[AMOUNT ERROR] ${msg}`,
      };
    }
    return { userMsg: "Payment initiation failed — please try again.", techDetail: msg };
  } catch {
    const bodyStr = typeof body === "string" ? body : JSON.stringify(body ?? "");
    return {
      userMsg: "Unexpected response from Safepay — please try again or contact support.",
      techDetail: `Non-JSON response: ${bodyStr.substring(0, 300)}`,
    };
  }
}

// ─── GET /api/payments/safepay/test — verify API keys ────────────────────────
router.get("/payments/safepay/test", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { publicKey, secretKey, isSandbox } = (req.query as any) ?? {};

    // If params passed, test those keys; otherwise test the saved config
    let testPublic  = publicKey  as string ?? "";
    let testSecret  = secretKey  as string ?? "";
    let testSandbox = isSandbox === "true";

    if (!testPublic || !testSecret) {
      const config = await getSafepayConfig();
      if (!config) {
        res.status(400).json({ ok: false, error: "No Safepay configuration found." });
        return;
      }
      testPublic  = config.publicKey;
      testSecret  = config.secretKey;
      testSandbox = config.isSandbox;
    }

    const base = getApiBase(testSandbox);
    const env  = testSandbox ? "sandbox" : "production";

    // Make a minimal test call — create a Rs. 10 test tracker (10 PKR whole units)
    const payload = {
      client:      testPublic,
      environment: env,
      amount:      10,
      currency:    "PKR",
      order_id:    `TEST-${Date.now()}`,
    };

    console.log(`[SAFEPAY TEST] Testing keys against ${base} | env: ${env} | pub: ${testPublic.substring(0, 12)}…`);

    const r = await fetch(`${base}/order/v1/init`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "X-SFPY-SECRET-KEY": testSecret },
      body:    JSON.stringify(payload),
    });

    const bodyText = await r.text();
    let bodyJson: any;
    try { bodyJson = JSON.parse(bodyText); } catch { bodyJson = null; }

    if (r.ok) {
      const tracker = bodyJson?.data?.token?.tracker ?? bodyJson?.token?.tracker ?? "";
      console.log(`[SAFEPAY TEST] ✓ Keys verified | tracker: ${tracker}`);
      res.json({ ok: true, message: "API Keys Verified Successfully", tracker });
    } else {
      const { techDetail } = parseSafepayError(bodyJson ?? bodyText);
      console.warn(`[SAFEPAY TEST] ✗ Key verification failed (${r.status}): ${techDetail}`);
      const isKeyError = bodyText.toLowerCase().includes("client") && bodyText.toLowerCase().includes("not found");
      res.status(200).json({
        ok: false,
        error: isKeyError
          ? "Invalid API Keys. Please check pub_/sec_ prefix."
          : `Safepay error (${r.status}): ${techDetail.substring(0, 200)}`,
      });
    }
  } catch (err: any) {
    console.error("[SAFEPAY TEST] Network error:", err.message);
    res.status(200).json({ ok: false, error: `Network error: ${err.message}` });
  }
});

// ─── POST /api/payments/safepay/initiate ─────────────────────────────────────
router.post("/payments/safepay/initiate", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { invoiceId } = req.body ?? {};
    if (!invoiceId) { res.status(400).json({ error: "invoiceId is required" }); return; }

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

    const base = getApiBase(config.isSandbox);
    const env  = config.isSandbox ? "sandbox" : "production";

    // Amount: whole integer in PKR — no decimals, no paisa conversion
    // Safepay /order/v1/init expects full PKR units (e.g. Rs. 1,845.00 → 1845)
    const amount = Math.round(parseFloat(invoice.total));

    const trackerPayload = {
      client:      config.publicKey,    // pub_xxx — merchant identifier
      environment: env,
      amount,                           // integer PKR — e.g. Rs.1,845.00 → 1845
      currency:    "PKR",
      order_id:    invoice.invoiceNumber,
    };

    console.log(
      `[SAFEPAY] → POST ${base}/order/v1/init\n` +
      `[SAFEPAY] Invoice: ${invoice.invoiceNumber} | Total: Rs.${invoice.total} → amount: ${amount} PKR\n` +
      `[SAFEPAY] Payload: ${JSON.stringify({ ...trackerPayload, _sec: config.secretKey.substring(0, 12) + "…" })}`
    );

    const trackerRes = await fetch(`${base}/order/v1/init`, {
      method:  "POST",
      headers: {
        "Content-Type":      "application/json",
        "X-SFPY-SECRET-KEY": config.secretKey,
      },
      body: JSON.stringify(trackerPayload),
    });

    const trackerText = await trackerRes.text();
    let trackerData: any;
    try { trackerData = JSON.parse(trackerText); } catch {
      console.error("[SAFEPAY] Non-JSON tracker response:", trackerText.substring(0, 300));
      res.status(502).json({ error: "Unexpected response from Safepay — please try again." });
      return;
    }

    if (!trackerRes.ok) {
      const { userMsg, techDetail, isOnboarding } = parseSafepayError(trackerData);
      console.error(`[SAFEPAY] ✗ Tracker creation failed (${trackerRes.status}): ${techDetail}`);
      res.status(502).json({ error: userMsg, isOnboarding: isOnboarding ?? false });
      return;
    }

    // Support multiple Safepay response shapes
    const tracker: string =
      trackerData?.data?.token?.tracker ??
      trackerData?.token?.tracker ??
      trackerData?.tracker ??
      "";

    if (!tracker) {
      console.error("[SAFEPAY] No tracker in response:", JSON.stringify(trackerData));
      res.status(502).json({ error: "Safepay returned no payment token. Please try again." });
      return;
    }

    console.log(`[SAFEPAY] ✓ Tracker created: ${tracker}`);

    // Persist tracker so webhook can link back to this invoice
    await db.update(invoicesTable)
      .set({
        status:       "payment_pending",
        paymentRef:   tracker,
        paymentNotes: `Safepay — ${env}`,
        updatedAt:    new Date(),
      })
      .where(eq(invoicesTable.id, invoice.id));

    // Build return / cancel URLs
    const appDomain = process.env["REPLIT_DEV_DOMAIN"]
      ? `https://${process.env["REPLIT_DEV_DOMAIN"]}`
      : (process.env["APP_URL"] ?? "https://noehost.com");

    const redirectUrl = `${appDomain}/client/payment/return?tracker=${encodeURIComponent(tracker)}&invoice=${invoice.id}`;
    const cancelUrl   = `${appDomain}/client/invoices`;

    const checkoutBase = getCheckoutBase(config.isSandbox);
    const checkoutUrl =
      `${checkoutBase}/checkout/pay` +
      `?env=${env}` +
      `&tracker=${encodeURIComponent(tracker)}` +
      `&source=hosted` +
      `&order_id=${encodeURIComponent(invoice.invoiceNumber)}` +
      `&redirect_url=${encodeURIComponent(redirectUrl)}` +
      `&cancel_url=${encodeURIComponent(cancelUrl)}`;

    console.log(`[SAFEPAY] ✓ Checkout URL ready → ${checkoutUrl.substring(0, 120)}…`);

    res.json({ checkoutUrl, tracker, invoiceId: invoice.id });
  } catch (err) {
    console.error("[SAFEPAY] Unhandled initiate error:", err);
    res.status(500).json({ error: "Server error — please try again." });
  }
});

// ─── Webhook handler (raw body — registered in app.ts BEFORE express.json()) ──
export async function safepayWebhookHandler(req: Request, res: Response): Promise<void> {
  try {
    const rawBody: Buffer = req.body as Buffer;
    const signature = req.headers["x-sfpy-signature"] as string | undefined;

    const config = await getSafepayConfig();

    // HMAC-SHA256 signature verification
    if (config?.webhookSecret) {
      if (!signature) {
        console.warn("[SAFEPAY WEBHOOK] Missing X-SFPY-SIGNATURE — rejected");
        res.status(401).json({ error: "Missing signature" });
        return;
      }
      const expected = crypto
        .createHmac("sha256", config.webhookSecret)
        .update(rawBody)
        .digest("hex");
      if (expected !== signature) {
        console.warn("[SAFEPAY WEBHOOK] ✗ Invalid HMAC — rejected");
        res.status(401).json({ error: "Invalid signature" });
        return;
      }
      console.log("[SAFEPAY WEBHOOK] ✓ Signature OK");
    } else {
      console.warn("[SAFEPAY WEBHOOK] No webhookSecret — skipping HMAC check");
    }

    let payload: any;
    try { payload = JSON.parse(rawBody.toString("utf8")); }
    catch { res.status(400).json({ error: "Invalid JSON" }); return; }

    console.log("[SAFEPAY WEBHOOK] Payload:", JSON.stringify(payload).substring(0, 600));

    const notificationType = (payload?.notification_type ?? "").toLowerCase();

    if (!notificationType.includes("payment")) {
      console.log(`[SAFEPAY WEBHOOK] Ignoring event: ${notificationType}`);
      res.json({ received: true }); return;
    }

    const paymentStatus = (
      payload?.payload?.tracker?.status ??
      payload?.payload?.status ??
      payload?.data?.status ?? ""
    ).toLowerCase();

    const SUCCESS_STATUSES = ["paid", "success", "captured", "completed", "settled", "authorized"];
    if (paymentStatus && !SUCCESS_STATUSES.includes(paymentStatus)) {
      console.log(`[SAFEPAY WEBHOOK] Not successful — status: ${paymentStatus}`);
      res.json({ received: true }); return;
    }

    // Locate invoice by tracker (paymentRef) or invoice number (order_id)
    const tracker: string =
      payload?.payload?.tracker?.token ??
      payload?.payload?.tracker ??
      payload?.data?.tracker?.token ?? "";

    const orderId: string =
      payload?.payload?.order?.order_id ??
      payload?.payload?.order_id ??
      payload?.data?.order?.order_id ?? "";

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
      console.error(`[SAFEPAY WEBHOOK] Invoice not found — tracker: "${tracker}", orderId: "${orderId}"`);
      res.status(404).json({ error: "Invoice not found" }); return;
    }

    // Idempotency guard
    if (invoice.status === "paid") {
      console.log(`[SAFEPAY WEBHOOK] ${invoice.invoiceNumber} already paid — ignoring duplicate`);
      res.json({ received: true, alreadyPaid: true }); return;
    }

    console.log(`[SAFEPAY WEBHOOK] Activating invoice ${invoice.invoiceNumber}…`);

    // Activate: mark paid → provision WHM → credit affiliate → send confirmation email
    const result = await processInvoicePaid(
      invoice.id,
      tracker || `SFPY-${Date.now()}`,
      `Safepay webhook — ${config?.isSandbox ? "sandbox" : "live"} | ${notificationType}`,
    );

    if (result.success) {
      console.log(`[SAFEPAY WEBHOOK] ✓ ${invoice.invoiceNumber} activated`);
      res.json({ received: true, activated: true });
    } else {
      console.error(`[SAFEPAY WEBHOOK] ✗ Activation failed:`, result.error);
      res.status(500).json({ error: result.error ?? "Activation failed" });
    }
  } catch (err) {
    console.error("[SAFEPAY WEBHOOK] Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Startup key restorer ──────────────────────────────────────────────────────
// A previous auto-swap incorrectly moved keys. This detects that specific wrong
// state and restores them to the admin's intended configuration:
//   livePublicKey  = Merchant Client ID (sec_5486a972… or any client identifier)
//   liveSecretKey  = API Secret Key     (raw hex string)
export async function autoFixSafepayKeys(): Promise<void> {
  try {
    const [method] = await db.select().from(paymentMethodsTable)
      .where(eq(paymentMethodsTable.type, "safepay"))
      .limit(1);
    if (!method) return;

    const s = JSON.parse(method.settings ?? "{}");
    const livePublic = s.livePublicKey ?? "";
    const liveSecret = s.liveSecretKey ?? "";

    // Detect the wrongly-swapped state: secret field has sec_ key, public field has the hex key
    // This is the result of the previous incorrect auto-swap
    const wronglySwapped =
      liveSecret.startsWith("sec_") &&
      !livePublic.startsWith("sec_") &&
      livePublic.length > 10;

    if (wronglySwapped) {
      console.log(
        `[SAFEPAY] ↩ Restoring keys to admin's intended order…\n` +
        `  livePublicKey (Client ID): ${liveSecret.substring(0, 16)}…\n` +
        `  liveSecretKey (API Secret): ${livePublic.substring(0, 10)}…`
      );
      const fixedSettings = {
        ...s,
        livePublicKey: liveSecret,  // sec_5486a972… → public/client field
        liveSecretKey: livePublic,  // 9d43f88dff… → secret/header field
      };
      await db.update(paymentMethodsTable)
        .set({ settings: JSON.stringify(fixedSettings), updatedAt: new Date() })
        .where(eq(paymentMethodsTable.id, method.id));
      console.log("[SAFEPAY] ✓ Keys restored successfully.");
    } else {
      console.log(
        `[SAFEPAY] ✓ Key order looks correct:\n` +
        `  livePublicKey (Client ID): ${livePublic.substring(0, 16) || "EMPTY"}…\n` +
        `  liveSecretKey (API Secret): ${liveSecret.substring(0, 10) || "EMPTY"}…`
      );
    }
  } catch (err: any) {
    console.warn("[SAFEPAY] Startup key-check failed (non-fatal):", err.message);
  }
}

export default router;
