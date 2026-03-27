import { Router } from "express";
import { db } from "@workspace/db";
import { paymentMethodsTable } from "@workspace/db/schema";
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
  return { ...formatMethod(m), settings: JSON.parse(m.settings ?? "{}") };
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
    case "jazzcash":
      return { accountTitle: settings.accountTitle, mobileNumber: settings.mobileNumber };
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
    default:
      return {};
  }
}

// Public/client: list active payment methods (for checkout page)
router.get("/payment-methods", authenticate, async (_req, res) => {
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

    const validTypes = ["stripe", "paypal", "jazzcash", "easypaisa", "bank_transfer", "crypto", "manual", "safepay"];
    if (!validTypes.includes(type)) {
      res.status(400).json({ error: `type must be one of: ${validTypes.join(", ")}` });
      return;
    }

    const [method] = await db.insert(paymentMethodsTable).values({
      name, type, description, isSandbox, isActive: true,
      settings: JSON.stringify(settings),
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

    // ── Safepay key prefix enforcement ────────────────────────────────────────
    if (settings && type === "safepay") {
      const lp = (settings.livePublicKey ?? "") as string;
      const ls = (settings.liveSecretKey ?? "") as string;
      const sp = (settings.sandboxPublicKey ?? "") as string;
      const ss = (settings.sandboxSecretKey ?? "") as string;

      if (lp && !lp.startsWith("pub_")) {
        const hint = lp.startsWith("sec_")
          ? " It looks like you entered the Secret Key in this field."
          : "";
        res.status(400).json({ error: `Invalid Live Public Key format. Must start with pub_.${hint}` });
        return;
      }
      if (ls && !ls.startsWith("sec_")) {
        const hint = ls.startsWith("pub_")
          ? " It looks like you entered the Public Key in this field."
          : "";
        res.status(400).json({ error: `Invalid Live Secret Key format. Must start with sec_.${hint}` });
        return;
      }
      if (sp && !sp.startsWith("pub_")) {
        res.status(400).json({ error: "Invalid Sandbox Public Key format. Must start with pub_." });
        return;
      }
      if (ss && !ss.startsWith("sec_")) {
        res.status(400).json({ error: "Invalid Sandbox Secret Key format. Must start with sec_." });
        return;
      }
      console.log(`[PAYMENT-METHODS] Safepay keys validated ✓ | pub: ${lp.substring(0, 10)}… sec: ${ls.substring(0, 10)}…`);
    }

    // ── Detect type from existing record if not provided ─────────────────────
    let effectiveType = type;
    if (!effectiveType && settings) {
      const [existing] = await db.select({ type: paymentMethodsTable.type })
        .from(paymentMethodsTable).where(eq(paymentMethodsTable.id, id)).limit(1);
      effectiveType = existing?.type;
    }
    // Re-run Safepay check with inferred type
    if (!type && effectiveType === "safepay" && settings) {
      const lp = (settings.livePublicKey ?? "") as string;
      const ls = (settings.liveSecretKey ?? "") as string;
      if (lp && !lp.startsWith("pub_")) {
        res.status(400).json({ error: "Invalid Live Public Key format. Must start with pub_. It looks like your keys are swapped." });
        return;
      }
      if (ls && !ls.startsWith("sec_")) {
        res.status(400).json({ error: "Invalid Live Secret Key format. Must start with sec_. It looks like your keys are swapped." });
        return;
      }
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (type !== undefined) updates.type = type;
    if (description !== undefined) updates.description = description;
    if (isSandbox !== undefined) updates.isSandbox = isSandbox;
    if (settings !== undefined) updates.settings = JSON.stringify(settings);
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
