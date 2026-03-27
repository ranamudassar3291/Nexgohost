import { Router } from "express";
import { db } from "@workspace/db";
import { promoCodesTable, productGroupsTable, hostingPlansTable, domainPricingTable, vpsPlansTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";

const router = Router();

function formatCode(c: typeof promoCodesTable.$inferSelect & { groupName?: string | null; planName?: string | null }) {
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
    applicablePlanId: (c as any).applicablePlanId ?? null,
    applicablePlanName: (c as any).planName ?? null,
    billingCycleLock: (c as any).billingCycleLock ?? "all",
    createdAt: c.createdAt.toISOString(),
  };
}

// Client: validate a promo code and compute discounted amount (public — no auth required)
router.get("/promo-codes/validate", async (req: AuthRequest, res) => {
  try {
    const { code, amount, serviceType, groupId, planId, tld, billingCycle } = req.query as {
      code: string; amount: string; serviceType?: string; groupId?: string; planId?: string; tld?: string; billingCycle?: string;
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
    // Normalize service type aliases so domain promo codes work on both the Domains
    // page (serviceType="domain") and the Order New page (serviceType="registration"
    // or "domain_registration") — all treated as "domain".
    const normalizedServiceType = (serviceType === "registration" || serviceType === "domain_registration")
      ? "domain"
      : serviceType;
    if (normalizedServiceType && applicableTo !== "all" && applicableTo !== normalizedServiceType) {
      const applicableLabel = applicableTo === "domain" ? "domain registration" : applicableTo;
      res.status(400).json({ error: `This promo code is only valid for ${applicableLabel} services` }); return;
    }

    // Billing cycle lock check
    const cycleLock = (promo as any).billingCycleLock ?? "all";
    if (cycleLock !== "all" && billingCycle && cycleLock !== billingCycle) {
      const lockLabel = cycleLock === "yearly" ? "Yearly (Annual)" : "Monthly";
      res.status(400).json({ error: `This promo code is only valid for ${lockLabel} billing plans` }); return;
    }

    // Group scope check
    const applicableGroupId = (promo as any).applicableGroupId;
    if (applicableGroupId && groupId && applicableGroupId !== groupId) {
      res.status(400).json({ error: "This promo code is not valid for the selected hosting category" }); return;
    }

    // Plan scope check (specific plan within group)
    const applicablePlanId = (promo as any).applicablePlanId;
    if (applicablePlanId && planId && applicablePlanId !== planId) {
      res.status(400).json({ error: "This promo code is only valid for a specific hosting plan" }); return;
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

// Admin: list all promo codes (with group and plan names)
router.get("/admin/promo-codes", authenticate, requireAdmin, async (_req, res) => {
  try {
    const codes = await db.select().from(promoCodesTable).orderBy(sql`created_at DESC`);

    const groupIds = [...new Set(codes.map(c => (c as any).applicableGroupId).filter(Boolean))];
    let groupMap: Record<string, string> = {};
    if (groupIds.length > 0) {
      const groups = await db.select().from(productGroupsTable);
      groupMap = Object.fromEntries(groups.map((g: any) => [g.id, g.name]));
    }

    const planIds = [...new Set(codes.map(c => (c as any).applicablePlanId).filter(Boolean))];
    let planMap: Record<string, string> = {};
    if (planIds.length > 0) {
      const hostingPlans = await db.select().from(hostingPlansTable);
      const vpsPlans = await db.select().from(vpsPlansTable);
      planMap = {
        ...Object.fromEntries(hostingPlans.map((p: any) => [p.id, p.name])),
        ...Object.fromEntries(vpsPlans.map((p: any) => [p.id, p.name])),
      };
    }

    res.json(codes.map(c => formatCode({
      ...c,
      groupName: groupMap[(c as any).applicableGroupId] ?? null,
      planName: planMap[(c as any).applicablePlanId] ?? null,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: get plans for a specific group (hosting or VPS)
router.get("/admin/promo-codes/plans-for-group/:groupId", authenticate, requireAdmin, async (req, res) => {
  try {
    // Check if this group is the VPS group (slug = vps-hosting)
    const [group] = await db.select().from(productGroupsTable)
      .where(eq(productGroupsTable.id, req.params.groupId))
      .limit(1);

    if (group?.slug === "vps-hosting") {
      // Return VPS plans from vps_plans table
      const vpsPlans = await db.select({
        id: vpsPlansTable.id,
        name: vpsPlansTable.name,
        price: vpsPlansTable.price,
      }).from(vpsPlansTable)
        .where(eq(vpsPlansTable.isActive, true))
        .orderBy(vpsPlansTable.sortOrder);
      return res.json(vpsPlans.map(p => ({ id: p.id, name: p.name, price: Number(p.price) })));
    }

    // Otherwise return hosting plans for this group
    const plans = await db.select({
      id: hostingPlansTable.id,
      name: hostingPlansTable.name,
      price: hostingPlansTable.price,
    }).from(hostingPlansTable)
      .where(eq(hostingPlansTable.groupId, req.params.groupId));
    res.json(plans.map(p => ({ id: p.id, name: p.name, price: Number(p.price) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: get all domain TLDs (for promo code UI)
router.get("/admin/promo-codes/domain-tlds", authenticate, requireAdmin, async (_req, res) => {
  try {
    const tlds = await db.select({
      id: domainPricingTable.id,
      tld: domainPricingTable.tld,
      registrationPrice: domainPricingTable.registrationPrice,
    }).from(domainPricingTable).orderBy(domainPricingTable.tld);
    res.json(tlds.map(t => ({ id: t.id, tld: t.tld, price: Number(t.registrationPrice) })));
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
      applicableTo = "all", applicableGroupId, applicableDomainTld, applicablePlanId,
      billingCycleLock = "all",
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
      applicablePlanId: applicablePlanId || null,
      billingCycleLock: ["all", "yearly", "monthly"].includes(billingCycleLock) ? billingCycleLock : "all",
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

// Admin: edit promo code
router.patch("/admin/promo-codes/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const {
      description, discountType, discountPercent, fixedAmount,
      usageLimit, expiresAt, applicableTo, applicableGroupId,
      applicableDomainTld, applicablePlanId, billingCycleLock, isActive,
    } = req.body;

    const updates: Record<string, any> = {};
    if (description !== undefined) updates.description = description || null;
    if (discountType !== undefined) updates.discountType = discountType;
    if (discountPercent !== undefined) updates.discountPercent = discountType === "percent" ? parseInt(discountPercent) : 0;
    if (fixedAmount !== undefined) updates.fixedAmount = discountType === "fixed" ? String(parseFloat(fixedAmount)) : null;
    if (usageLimit !== undefined) updates.usageLimit = usageLimit ? parseInt(usageLimit) : null;
    if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (applicableTo !== undefined) updates.applicableTo = ["all", "hosting", "domain"].includes(applicableTo) ? applicableTo : "all";
    if (applicableGroupId !== undefined) updates.applicableGroupId = applicableGroupId || null;
    if (applicableDomainTld !== undefined) updates.applicableDomainTld = applicableDomainTld
      ? (applicableDomainTld.startsWith(".") ? applicableDomainTld : `.${applicableDomainTld}`) : null;
    if (applicablePlanId !== undefined) updates.applicablePlanId = applicablePlanId || null;
    if (billingCycleLock !== undefined) updates.billingCycleLock = ["all", "yearly", "monthly"].includes(billingCycleLock) ? billingCycleLock : "all";
    if (isActive !== undefined) updates.isActive = isActive;

    const [promo] = await db.update(promoCodesTable)
      .set(updates)
      .where(eq(promoCodesTable.id, req.params.id))
      .returning();

    if (!promo) { res.status(404).json({ error: "Promo code not found" }); return; }
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
