import { Router } from "express";
import { db } from "@workspace/db";
import { promoCodesTable, productGroupsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";

const router = Router();

function formatCode(c: typeof promoCodesTable.$inferSelect & { groupName?: string | null }) {
  const discountType = (c as any).discountType ?? "percent";
  return {
    id: c.id,
    code: c.code,
    description: c.description,
    discountType,
    discountPercent: c.discountPercent,
    fixedAmount: (c as any).fixedAmount ? Number((c as any).fixedAmount) : null,
    isActive: c.isActive,
    usageLimit: c.usageLimit,
    usedCount: c.usedCount,
    expiresAt: c.expiresAt?.toISOString() ?? null,
    applicableTo: (c as any).applicableTo ?? "all",
    applicableGroupId: (c as any).applicableGroupId ?? null,
    applicableGroupName: (c as any).groupName ?? null,
    applicableDomainTld: (c as any).applicableDomainTld ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

// Client: validate a promo code and compute discounted amount
router.get("/promo-codes/validate", authenticate, async (req: AuthRequest, res) => {
  try {
    const { code, amount, serviceType, groupId, tld } = req.query as {
      code: string; amount: string; serviceType?: string; groupId?: string; tld?: string;
    };
    if (!code) { res.status(400).json({ error: "code is required" }); return; }

    const [promo] = await db.select().from(promoCodesTable)
      .where(eq(promoCodesTable.code, code.toUpperCase()))
      .limit(1);

    if (!promo) { res.status(404).json({ error: "Invalid promo code" }); return; }
    if (!promo.isActive) { res.status(400).json({ error: "This promo code is no longer active" }); return; }
    if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
      res.status(400).json({ error: "This promo code has reached its usage limit" }); return;
    }
    if (promo.expiresAt && new Date() > promo.expiresAt) {
      res.status(400).json({ error: "This promo code has expired" }); return;
    }

    const applicableTo = (promo as any).applicableTo ?? "all";
    if (serviceType && applicableTo !== "all" && applicableTo !== serviceType) {
      res.status(400).json({ error: `This promo code is only valid for ${applicableTo} services` }); return;
    }

    // Group scope check
    const applicableGroupId = (promo as any).applicableGroupId;
    if (applicableGroupId && groupId && applicableGroupId !== groupId) {
      res.status(400).json({ error: "This promo code is not valid for the selected hosting category" }); return;
    }
    if (applicableGroupId && !groupId) {
      // Code is group-scoped but no group provided — still allow (client might not have group context)
    }

    // Domain TLD scope check
    const applicableDomainTld = (promo as any).applicableDomainTld;
    if (applicableDomainTld && tld) {
      const normTld = tld.startsWith(".") ? tld : `.${tld}`;
      const normPromoTld = applicableDomainTld.startsWith(".") ? applicableDomainTld : `.${applicableDomainTld}`;
      if (normTld.toLowerCase() !== normPromoTld.toLowerCase()) {
        res.status(400).json({ error: `This promo code is only valid for ${applicableDomainTld} domains` }); return;
      }
    }

    const originalAmount = parseFloat(amount || "0");
    const discountType = (promo as any).discountType ?? "percent";
    let discountAmount: number;

    if (discountType === "fixed") {
      const fixedAmt = Number((promo as any).fixedAmount ?? 0);
      discountAmount = Math.min(fixedAmt, originalAmount);
    } else {
      discountAmount = originalAmount * (promo.discountPercent / 100);
    }
    const finalAmount = Math.max(0, originalAmount - discountAmount);

    res.json({
      valid: true,
      code: promo.code,
      discountType,
      discountPercent: promo.discountPercent,
      fixedAmount: (promo as any).fixedAmount ? Number((promo as any).fixedAmount) : null,
      discountAmount: Number(discountAmount.toFixed(2)),
      originalAmount: Number(originalAmount.toFixed(2)),
      finalAmount: Number(finalAmount.toFixed(2)),
      applicableTo,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: list all promo codes (with group names)
router.get("/admin/promo-codes", authenticate, requireAdmin, async (_req, res) => {
  try {
    const codes = await db.select().from(promoCodesTable).orderBy(sql`created_at DESC`);

    const groupIds = [...new Set(codes.map(c => (c as any).applicableGroupId).filter(Boolean))];
    let groupMap: Record<string, string> = {};
    if (groupIds.length > 0) {
      const groups = await db.select().from(productGroupsTable);
      groupMap = Object.fromEntries(groups.map((g: any) => [g.id, g.name]));
    }

    res.json(codes.map(c => formatCode({ ...c, groupName: groupMap[(c as any).applicableGroupId] ?? null })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: create promo code
router.post("/admin/promo-codes", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const {
      code, description,
      discountType = "percent", discountPercent, fixedAmount,
      usageLimit, expiresAt,
      applicableTo = "all", applicableGroupId, applicableDomainTld,
    } = req.body;

    if (!code) { res.status(400).json({ error: "code is required" }); return; }

    if (discountType === "percent") {
      if (!discountPercent) { res.status(400).json({ error: "discountPercent is required for percent type" }); return; }
      const pct = parseInt(discountPercent);
      if (pct < 1 || pct > 100) { res.status(400).json({ error: "discountPercent must be between 1 and 100" }); return; }
    } else if (discountType === "fixed") {
      if (!fixedAmount || parseFloat(fixedAmount) <= 0) {
        res.status(400).json({ error: "fixedAmount must be a positive number" }); return;
      }
    } else {
      res.status(400).json({ error: "discountType must be 'percent' or 'fixed'" }); return;
    }

    const [promo] = await db.insert(promoCodesTable).values({
      code: code.toUpperCase(),
      description: description || null,
      discountType,
      discountPercent: discountType === "percent" ? parseInt(discountPercent) : 0,
      fixedAmount: discountType === "fixed" ? String(parseFloat(fixedAmount)) : null,
      isActive: true,
      usageLimit: usageLimit ? parseInt(usageLimit) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      applicableTo: ["all", "hosting", "domain"].includes(applicableTo) ? applicableTo : "all",
      applicableGroupId: applicableGroupId || null,
      applicableDomainTld: applicableDomainTld ? (applicableDomainTld.startsWith(".") ? applicableDomainTld : `.${applicableDomainTld}`) : null,
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
