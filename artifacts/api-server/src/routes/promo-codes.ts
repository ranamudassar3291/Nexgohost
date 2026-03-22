import { Router } from "express";
import { db } from "@workspace/db";
import { promoCodesTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";

const router = Router();

function formatCode(c: typeof promoCodesTable.$inferSelect) {
  return {
    id: c.id,
    code: c.code,
    description: c.description,
    discountPercent: c.discountPercent,
    isActive: c.isActive,
    usageLimit: c.usageLimit,
    usedCount: c.usedCount,
    expiresAt: c.expiresAt?.toISOString() ?? null,
    applicableTo: (c as any).applicableTo ?? "all",
    createdAt: c.createdAt.toISOString(),
  };
}

// Client: validate a promo code and compute discounted amount
router.get("/promo-codes/validate", authenticate, async (req: AuthRequest, res) => {
  try {
    const { code, amount, serviceType } = req.query as { code: string; amount: string; serviceType?: string };
    if (!code) { res.status(400).json({ error: "code is required" }); return; }

    const [promo] = await db.select().from(promoCodesTable)
      .where(eq(promoCodesTable.code, code.toUpperCase()))
      .limit(1);

    if (!promo) { res.status(404).json({ error: "Invalid promo code" }); return; }
    if (!promo.isActive) { res.status(400).json({ error: "This promo code is no longer active" }); return; }
    if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
      res.status(400).json({ error: "This promo code has reached its usage limit" });
      return;
    }
    if (promo.expiresAt && new Date() > promo.expiresAt) {
      res.status(400).json({ error: "This promo code has expired" });
      return;
    }

    const applicableTo = (promo as any).applicableTo ?? "all";
    if (serviceType && applicableTo !== "all" && applicableTo !== serviceType) {
      res.status(400).json({ error: `This promo code is only valid for ${applicableTo} services` });
      return;
    }

    const originalAmount = parseFloat(amount || "0");
    const discount = originalAmount * (promo.discountPercent / 100);
    const finalAmount = Math.max(0, originalAmount - discount);

    res.json({
      valid: true,
      code: promo.code,
      discountPercent: promo.discountPercent,
      discountAmount: Number(discount.toFixed(2)),
      originalAmount: Number(originalAmount.toFixed(2)),
      finalAmount: Number(finalAmount.toFixed(2)),
      applicableTo,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: list all promo codes
router.get("/admin/promo-codes", authenticate, requireAdmin, async (_req, res) => {
  try {
    const codes = await db.select().from(promoCodesTable).orderBy(sql`created_at DESC`);
    res.json(codes.map(formatCode));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: create promo code
router.post("/admin/promo-codes", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { code, description, discountPercent, usageLimit, expiresAt, applicableTo = "all" } = req.body;
    if (!code || !discountPercent) {
      res.status(400).json({ error: "code and discountPercent are required" });
      return;
    }
    if (discountPercent < 1 || discountPercent > 100) {
      res.status(400).json({ error: "discountPercent must be between 1 and 100" });
      return;
    }

    const [promo] = await db.insert(promoCodesTable).values({
      code: code.toUpperCase(),
      description,
      discountPercent: parseInt(discountPercent),
      isActive: true,
      usageLimit: usageLimit ? parseInt(usageLimit) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      applicableTo: ["all", "hosting", "domain"].includes(applicableTo) ? applicableTo : "all",
    } as any).returning();

    res.status(201).json(formatCode(promo));
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "A promo code with this code already exists" });
    } else {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
});

// Admin: toggle active status
router.post("/admin/promo-codes/:id/toggle", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [existing] = await db.select().from(promoCodesTable).where(eq(promoCodesTable.id, req.params.id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Promo code not found" }); return; }

    const [promo] = await db.update(promoCodesTable)
      .set({ isActive: !existing.isActive })
      .where(eq(promoCodesTable.id, req.params.id))
      .returning();

    res.json(formatCode(promo));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: delete promo code
router.delete("/admin/promo-codes/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    await db.delete(promoCodesTable).where(eq(promoCodesTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
