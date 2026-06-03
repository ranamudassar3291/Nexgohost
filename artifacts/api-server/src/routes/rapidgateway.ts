/**
 * RapidGateway.pk Payment Integration
 *
 * Flow:
 *   1. Admin pastes Merchant ID + Client Secret in Payment Methods settings
 *   2. Client clicks Pay → POST /api/payments/rapidgateway/initiate
 *      • Server fetches OAuth2 Bearer token  (Basic Base64(id:secret))
 *      • Server submits transaction to /rapid/process-transaction
 *      • Server captures Location redirect URL and returns it
 *   3. Frontend redirects customer to RapidGateway hosted checkout
 *   4. Customer pays (card details NEVER touch our server — PCI-DSS safe)
 *   5. RapidGateway redirects to /api/payments/rapidgateway/success (GET)
 *   6. Server verifies by BASKET_ID + TXN_ID, activates invoice automatically
 *   7. Customer lands on /client/payment/rg-return (frontend success page)
 *
 * Routes:
 *   GET  /api/payments/rapidgateway/test      — verify keys (admin)
 *   POST /api/payments/rapidgateway/initiate  — create session, return redirect URL
 *   GET  /api/payments/rapidgateway/success   — success callback from RapidGateway
 *   GET  /api/payments/rapidgateway/failure   — failure callback from RapidGateway
 */

import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { invoicesTable, paymentMethodsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../lib/auth.js";
import { decryptField } from "../lib/fieldCrypto.js";
import { processInvoicePaid } from "../lib/activateInvoice.js";
import { getAppUrl } from "../lib/app-url.js";

const router = Router();

const RG_BASE_URL = "https://secure.rapid-gateway.com";

// ─── Config loader ─────────────────────────────────────────────────────────────
interface RapidGatewayConfig {
  merchantId: string;
  clientSecret: string;
  merchantName: string;
}

async function getRapidGatewayConfig(): Promise<RapidGatewayConfig | null> {
  const [method] = await db
    .select()
    .from(paymentMethodsTable)
    .where(eq(paymentMethodsTable.type, "rapidgateway"))
    .limit(1);

  if (!method?.isActive) return null;

  const s: Record<string, string> = JSON.parse(method.settings ?? "{}");
  const merchantId    = decryptField(s.merchantId    ?? "");
  const clientSecret  = decryptField(s.clientSecret  ?? "");
  const merchantName  = s.merchantName ?? "Noehost";

  if (!merchantId || !clientSecret) {
    console.error("[RG] Missing Merchant ID or Client Secret — configure in Admin → Payment Methods");
    return null;
  }

  return { merchantId, clientSecret, merchantName };
}

// ─── OAuth2: get Bearer token ─────────────────────────────────────────────────
async function getRapidGatewayToken(config: RapidGatewayConfig): Promise<string> {
  const creds = Buffer.from(`${config.merchantId}:${config.clientSecret}`).toString("base64");

  const tokenRes = await fetch(`${RG_BASE_URL}/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    throw new Error(`RapidGateway auth failed (${tokenRes.status}): ${body.substring(0, 300)}`);
  }

  const json: any = await tokenRes.json();
  const token = json?.access_token ?? json?.token ?? "";

  if (!token) {
    throw new Error("RapidGateway returned no access_token");
  }

  console.log(`[RG] ✓ OAuth2 token obtained (${token.substring(0, 12)}…)`);
  return token;
}

// ─── GET /api/payments/rapidgateway/test — verify keys (admin) ────────────────
router.get("/payments/rapidgateway/test", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const rawMerchantId   = (req.query.merchantId   as string ?? "").trim();
    const rawClientSecret = (req.query.clientSecret as string ?? "").trim();

    if (!rawMerchantId || !rawClientSecret) {
      res.json({ ok: false, error: "Merchant ID and Client Secret are required" });
      return;
    }

    const config: RapidGatewayConfig = {
      merchantId:    rawMerchantId,
      clientSecret:  rawClientSecret,
      merchantName:  "Test",
    };

    const token = await getRapidGatewayToken(config);
    console.log(`[RG TEST] ✓ Token obtained — merchantId=${rawMerchantId.substring(0, 8)}…`);
    res.json({ ok: true, message: "RapidGateway credentials are valid ✓", tokenPreview: `${token.substring(0, 20)}…` });
  } catch (err: any) {
    console.error("[RG TEST]", err.message);
    res.json({ ok: false, error: err.message });
  }
});

// ─── POST /api/payments/rapidgateway/initiate ──────────────────────────────────
router.post("/payments/rapidgateway/initiate", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { invoiceId } = req.body ?? {};
    if (!invoiceId) { res.status(400).json({ error: "invoiceId is required" }); return; }

    // Load & verify invoice
    const [invoice] = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, invoiceId))
      .limit(1);

    if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
    if (invoice.clientId !== req.user!.userId) { res.status(403).json({ error: "Forbidden" }); return; }
    if (invoice.status === "paid") { res.status(400).json({ error: "Invoice is already paid" }); return; }

    const config = await getRapidGatewayConfig();
    if (!config) {
      res.status(503).json({ error: "RapidGateway is not configured or inactive. Please contact support." });
      return;
    }

    // Amount: PKR integer (RapidGateway works in PKR paisa or full rupees — using full rupees per docs sample)
    const amount = Math.round(parseFloat(invoice.total as string));

    // Build callback URLs
    const appDomain = getAppUrl();
    const successUrl = `${appDomain}/api/payments/rapidgateway/success?invoice=${invoice.id}`;
    const failureUrl = `${appDomain}/api/payments/rapidgateway/failure?invoice=${invoice.id}`;
    const checkoutUrl = `${appDomain}/client/payment/rg-return?invoice=${invoice.id}`;

    // Load client details for prefill
    const { usersTable } = await import("@workspace/db/schema");
    const [user] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email, phone: usersTable.phone })
      .from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);

    const phone = (user as any)?.phone ?? "";
    const email = user?.email ?? "";

    console.log(
      `[RG] → Initiating payment | Invoice: ${invoice.invoiceNumber} | Amount: Rs.${amount} | ` +
      `Client: ${email}`
    );

    // Step 1: Get Bearer token
    const accessToken = await getRapidGatewayToken(config);

    // Step 2: Submit transaction
    const body = new URLSearchParams({
      MERCHANT_ID:              config.merchantId,
      MERCHANT_NAME:            config.merchantName,
      TXNAMT:                   String(amount),
      CURRENCY_CODE:            "PKR",
      CUSTOMER_MOBILE_NO:       phone,
      CUSTOMER_EMAIL_ADDRESS:   email,
      BASKET_ID:                invoice.invoiceNumber,
      SUCCESS_URL:              successUrl,
      FAILURE_URL:              failureUrl,
      CHECKOUT_URL:             checkoutUrl,
      VERSION:                  "MY_VER_1.0",
      PROCCODE:                 "00",
    });

    const txnRes = await fetch(`${RG_BASE_URL}/rapid/process-transaction`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      redirect: "manual",
    });

    // RapidGateway returns a 302 redirect with the checkout URL in Location header
    const redirectUrl =
      txnRes.headers.get("location") ??
      txnRes.headers.get("Location") ?? "";

    if (!redirectUrl) {
      const responseBody = await txnRes.text();
      console.error(`[RG] ✗ No redirect URL. Status: ${txnRes.status}, Body: ${responseBody.substring(0, 500)}`);
      res.status(502).json({
        error: `RapidGateway did not return a checkout URL (HTTP ${txnRes.status}). Please try again or contact support.`,
        detail: responseBody.substring(0, 300),
      });
      return;
    }

    console.log(`[RG] ✓ Checkout redirect obtained → ${redirectUrl.substring(0, 100)}…`);

    // Persist payment reference so callback can locate this invoice
    await db.update(invoicesTable)
      .set({
        status: "payment_pending",
        paymentRef: invoice.invoiceNumber,
        paymentNotes: `RapidGateway — BASKET_ID: ${invoice.invoiceNumber}`,
        updatedAt: new Date(),
      })
      .where(eq(invoicesTable.id, invoice.id));

    res.json({
      redirectUrl,
      invoiceId: invoice.id,
      basketId: invoice.invoiceNumber,
      pkrAmount: amount,
    });
  } catch (err: any) {
    console.error("[RG] Unhandled initiate error:", err);
    res.status(500).json({ error: `Payment initiation failed: ${err.message}` });
  }
});

// ─── GET /api/payments/rapidgateway/success — RapidGateway callback ───────────
// RapidGateway redirects here after successful payment.
// Typical params: BASKET_ID, TXN_ID, TRAN_AUTH_ID, STATUS, TXN_DATE
router.get("/payments/rapidgateway/success", async (req: Request, res: Response) => {
  const appDomain = getAppUrl();

  try {
    const {
      invoice: invoiceId,
      BASKET_ID,
      TXN_ID,
      STATUS,
      TRAN_AUTH_ID,
    } = req.query as Record<string, string>;

    console.log("[RG CALLBACK] Success callback received:", {
      invoiceId: invoiceId?.substring(0, 16),
      BASKET_ID,
      TXN_ID: TXN_ID?.substring(0, 12),
      STATUS,
      TRAN_AUTH_ID: TRAN_AUTH_ID?.substring(0, 12),
    });

    // Locate invoice by ID (from our URL) or BASKET_ID (from RapidGateway)
    let invoice: any = null;

    if (invoiceId) {
      const [inv] = await db.select().from(invoicesTable)
        .where(eq(invoicesTable.id, invoiceId)).limit(1);
      invoice = inv ?? null;
    }

    if (!invoice && BASKET_ID) {
      const [inv] = await db.select().from(invoicesTable)
        .where(eq(invoicesTable.invoiceNumber, BASKET_ID)).limit(1);
      invoice = inv ?? null;
    }

    if (!invoice) {
      console.error(`[RG CALLBACK] Invoice not found — invoiceId=${invoiceId} BASKET_ID=${BASKET_ID}`);
      res.redirect(`${appDomain}/client/payment/rg-return?status=error&error=Invoice+not+found`);
      return;
    }

    // Idempotency — already paid is fine
    if (invoice.status === "paid") {
      console.log(`[RG CALLBACK] Invoice ${invoice.invoiceNumber} already paid — redirect to success`);
      res.redirect(`${appDomain}/client/payment/rg-return?invoice=${invoice.id}&status=success`);
      return;
    }

    // STATUS "000" = success for RapidGateway/similar Pakistani gateways
    // We also accept if STATUS is missing (some gateway versions omit it in success callback)
    const isSuccess = !STATUS || STATUS === "000" || STATUS === "00" || STATUS.toLowerCase() === "success";

    if (!isSuccess) {
      console.warn(`[RG CALLBACK] Non-success STATUS="${STATUS}" for invoice ${invoice.invoiceNumber}`);
      res.redirect(`${appDomain}/client/payment/rg-return?invoice=${invoice.id}&status=failed&ref=${TXN_ID ?? ""}`);
      return;
    }

    const txnRef = TXN_ID ?? TRAN_AUTH_ID ?? `RG-${invoice.invoiceNumber}-${Date.now()}`;

    console.log(`[RG CALLBACK] ✓ Activating invoice ${invoice.invoiceNumber} | TXN: ${txnRef}`);

    const result = await processInvoicePaid(invoice.id, txnRef, "RapidGateway", `RapidGateway payment | TXN: ${txnRef}`);

    if (!result.success) {
      console.error(`[RG CALLBACK] processInvoicePaid failed: ${result.error}`);
      res.redirect(`${appDomain}/client/payment/rg-return?invoice=${invoice.id}&status=error&error=${encodeURIComponent(result.error ?? "Activation failed")}`);
      return;
    }

    console.log(`[RG CALLBACK] ✓ Invoice ${invoice.invoiceNumber} activated`);
    res.redirect(`${appDomain}/client/payment/rg-return?invoice=${invoice.id}&status=success&ref=${encodeURIComponent(txnRef)}`);
  } catch (err: any) {
    console.error("[RG CALLBACK] Unhandled error:", err);
    res.redirect(`${appDomain}/client/payment/rg-return?status=error&error=${encodeURIComponent(err.message)}`);
  }
});

// ─── GET /api/payments/rapidgateway/failure — failure callback ────────────────
router.get("/payments/rapidgateway/failure", async (req: Request, res: Response) => {
  const appDomain = getAppUrl();
  const { invoice: invoiceId, BASKET_ID, STATUS } = req.query as Record<string, string>;

  // Re-set invoice to unpaid so client can retry
  try {
    const id = invoiceId ?? null;
    if (id) {
      const [inv] = await db.select({ id: invoicesTable.id, invoiceNumber: invoicesTable.invoiceNumber, status: invoicesTable.status })
        .from(invoicesTable).where(eq(invoicesTable.id, id)).limit(1);
      if (inv && inv.status === "payment_pending") {
        await db.update(invoicesTable)
          .set({ status: "unpaid", paymentNotes: `RapidGateway payment cancelled/failed (STATUS=${STATUS ?? "unknown"})`, updatedAt: new Date() })
          .where(eq(invoicesTable.id, inv.id));
        console.log(`[RG] Invoice ${inv.invoiceNumber} reset to unpaid after failure`);
      }
    }
  } catch { /* non-fatal */ }

  console.log(`[RG] Failure callback — invoiceId=${invoiceId} BASKET_ID=${BASKET_ID} STATUS=${STATUS}`);
  res.redirect(`${appDomain}/client/payment/rg-return?invoice=${invoiceId ?? ""}&status=failed`);
});

export default router;
