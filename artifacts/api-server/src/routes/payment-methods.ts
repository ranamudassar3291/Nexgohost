import { Router } from "express";
import { db } from "@workspace/db";
import { paymentMethodsTable } from "@workspace/db/schema";
import { encryptField, decryptField } from "../lib/fieldCrypto.js";

const PAYMENT_SECRET_FIELDS = ["secretKey", "liveSecretKey", "sandboxSecretKey", "privateKey", "apiKey", "apiSecret", "clientSecret"];

function encryptPaymentSettings(settings: Record<string, unknown>): string {
  const result = { ...settings };
  for (const field of PAYMENT_SECRET_FIELDS) {
    if (typeof result[field] === "string" && result[field]) {
      result[field] = encryptField(result[field] as string);
    }
  }
  return JSON.stringify(result);
}

function decryptPaymentSettings(json: string | null | undefined): Record<string, unknown> {
  if (!json) return {};
  try {
    const obj = JSON.parse(json) as Record<string, unknown>;
    for (const field of PAYMENT_SECRET_FIELDS) {
      if (typeof obj[field] === "string") {
        obj[field] = decryptField(obj[field] as string);
      }
    }
    return obj;
  } catch { return {}; }
}
import { eq, sql } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";

const router = Router();

function formatMethod(m: typeof paymentMethodsTable.$inferSelect) {
  return {
    id: m.id,
    name: m.name,
    type: m.type,
    description: m.description,
    isActive: m.isActive,
    isSandbox: m.isSandbox,
    // Don't expose full settings to non-admins; admin routes return them
    createdAt: m.createdAt.toISOString(),
  };
}

function formatMethodAdmin(m: typeof paymentMethodsTable.$inferSelect) {
  return { ...formatMethod(m), settings: decryptPaymentSettings(m.settings) };
}

// Public settings fields exposed to clients per gateway type (no secrets)
function publicSettings(type: string, settings: Record<string, unknown>) {
  switch (type) {
    case "bank_transfer":
      return {
        bankName: settings.bankName,
        accountTitle: settings.accountTitle,
        accountNumber: settings.accountNumber,
        iban: settings.iban,
        swiftCode: settings.swiftCode,
      };
    case "easypaisa":
      return { accountTitle: settings.accountTitle, mobileNumber: settings.mobileNumber };
    case "paypal":
      return { paypalEmail: settings.paypalEmail };
    case "crypto":
      return { walletAddress: settings.walletAddress, cryptoType: settings.cryptoType };
    case "manual":
      return {
        accountTitle: settings.accountTitle,
        mobileNumber: settings.mobileNumber,
        accountNumber: settings.accountNumber,
        bankName: settings.bankName,
        instructions: settings.instructions,
      };
    case "stripe":
      return { publishableKey: settings.publishableKey };
    case "safepay":
      return {
        isSandbox: settings.isSandbox,
        sandboxPublicKey: settings.sandboxPublicKey,
        livePublicKey: settings.livePublicKey,
      };
    case "rapidgateway":
      return { merchantName: settings.merchantName };
    default:
      return {};
  }
}

// Public/client: list active payment methods (for checkout page — no auth required for guests)
router.get("/payment-methods", async (_req, res) => {
  try {
    const methods = await db.select().from(paymentMethodsTable)
      .where(eq(paymentMethodsTable.isActive, true))
      .orderBy(sql`created_at ASC`);
    res.json(methods.map(m => ({
      ...formatMethod(m),
      publicSettings: publicSettings(m.type, JSON.parse(m.settings ?? "{}")),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: list all payment methods
router.get("/admin/payment-methods", authenticate, requireAdmin, async (_req, res) => {
  try {
    const methods = await db.select().from(paymentMethodsTable).orderBy(sql`created_at ASC`);
    res.json(methods.map(formatMethodAdmin));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: add payment method
router.post("/admin/payment-methods", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, type, description, isSandbox = true, settings = {} } = req.body;
    if (!name || !type) {
      res.status(400).json({ error: "name and type are required" });
      return;
    }

    const validTypes = ["stripe", "paypal", "easypaisa", "bank_transfer", "crypto", "manual", "safepay", "rapidgateway"];
    if (!validTypes.includes(type)) {
      res.status(400).json({ error: `type must be one of: ${validTypes.join(", ")}` });
      return;
    }

    const [method] = await db.insert(paymentMethodsTable).values({
      name, type, description, isSandbox, isActive: true,
      settings: encryptPaymentSettings(settings),
    }).returning();

    res.status(201).json(formatMethodAdmin(method));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: update payment method
router.put("/admin/payment-methods/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name, type, description, isSandbox, settings } = req.body;

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (type !== undefined) updates.type = type;
    if (description !== undefined) updates.description = description;
    if (isSandbox !== undefined) updates.isSandbox = isSandbox;
    if (settings !== undefined) updates.settings = encryptPaymentSettings(settings);
    updates.updatedAt = new Date();

    const [method] = await db.update(paymentMethodsTable)
      .set(updates)
      .where(eq(paymentMethodsTable.id, id))
      .returning();

    if (!method) { res.status(404).json({ error: "Payment method not found" }); return; }
    res.json(formatMethodAdmin(method));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: toggle active
router.post("/admin/payment-methods/:id/toggle", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [existing] = await db.select().from(paymentMethodsTable).where(eq(paymentMethodsTable.id, req.params.id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    const [method] = await db.update(paymentMethodsTable)
      .set({ isActive: !existing.isActive, updatedAt: new Date() })
      .where(eq(paymentMethodsTable.id, req.params.id))
      .returning();
    res.json(formatMethodAdmin(method));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: delete payment method
router.delete("/admin/payment-methods/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    await db.delete(paymentMethodsTable).where(eq(paymentMethodsTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
