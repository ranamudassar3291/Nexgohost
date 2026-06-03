import { Router } from "express";
import { db } from "@workspace/db";
import { cartItemsTable, guestCartItemsTable, hostingPlansTable, vpsPlansTable, affiliatesTable, promoCodesTable, domainExtensionsTable } from "@workspace/db/schema";
import { authenticate, type AuthRequest } from "../lib/auth.js";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router = Router();

// ─── GET /client/cart — fetch user's persisted cart items ────────────────────
router.get("/client/cart", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const items = await db.select().from(cartItemsTable)
      .where(eq(cartItemsTable.userId, userId))
      .orderBy(cartItemsTable.addedAt);
    return res.json(items);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /client/cart — add or update a cart item ───────────────────────────
router.post("/client/cart", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const {
      planId, planName, billingCycle,
      monthlyPrice, quarterlyPrice, semiannualPrice, yearlyPrice,
      renewalPrice, renewalEnabled,
      itemType, domainName, tld,
    } = req.body;

    if (!planId || !planName) {
      return res.status(400).json({ error: "planId and planName are required" });
    }

    const itemTypeVal = (["hosting", "domain", "vps"].includes(itemType) ? itemType : "hosting") as string;

    const existing = await db.select().from(cartItemsTable)
      .where(and(eq(cartItemsTable.userId, userId), eq(cartItemsTable.planId, planId)))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db.update(cartItemsTable)
        .set({
          planName,
          itemType: itemTypeVal,
          billingCycle: billingCycle || "monthly",
          monthlyPrice: String(monthlyPrice || 0),
          quarterlyPrice: quarterlyPrice != null ? String(quarterlyPrice) : null,
          semiannualPrice: semiannualPrice != null ? String(semiannualPrice) : null,
          yearlyPrice: yearlyPrice != null ? String(yearlyPrice) : null,
          renewalPrice: renewalPrice != null ? String(renewalPrice) : null,
          renewalEnabled: renewalEnabled ? "true" : "false",
          domainName: domainName || null,
          tld: tld || null,
          updatedAt: new Date(),
        })
        .where(and(eq(cartItemsTable.userId, userId), eq(cartItemsTable.planId, planId)))
        .returning();
      return res.json(updated);
    }

    const [inserted] = await db.insert(cartItemsTable).values({
      userId,
      planId,
      planName,
      itemType: itemTypeVal,
      billingCycle: billingCycle || "monthly",
      monthlyPrice: String(monthlyPrice || 0),
      quarterlyPrice: quarterlyPrice != null ? String(quarterlyPrice) : null,
      semiannualPrice: semiannualPrice != null ? String(semiannualPrice) : null,
      yearlyPrice: yearlyPrice != null ? String(yearlyPrice) : null,
      renewalPrice: renewalPrice != null ? String(renewalPrice) : null,
      renewalEnabled: renewalEnabled ? "true" : "false",
      domainName: domainName || null,
      tld: tld || null,
    }).returning();

    return res.json(inserted);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /client/cart/:planId — update billing cycle ───────────────────────
router.patch("/client/cart/:planId", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { planId } = req.params;
    const { billingCycle } = req.body;

    await db.update(cartItemsTable)
      .set({ billingCycle, updatedAt: new Date() })
      .where(and(eq(cartItemsTable.userId, userId), eq(cartItemsTable.planId, planId)));

    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /client/cart/:planId — remove one item ───────────────────────────
router.delete("/client/cart/:planId", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { planId } = req.params;

    await db.delete(cartItemsTable)
      .where(and(eq(cartItemsTable.userId, userId), eq(cartItemsTable.planId, planId)));

    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /client/cart — clear all cart items for user ─────────────────────
router.delete("/client/cart", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    await db.delete(cartItemsTable).where(eq(cartItemsTable.userId, userId));
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Guest Cart Routes ────────────────────────────────────────────────────────
// No auth required — identified by a guestSessionToken (UUID) stored in
// the browser's localStorage. Cart is persisted in guest_cart_items.

// GET /guest/cart?token=TOKEN — fetch guest cart items
router.get("/guest/cart", async (req, res) => {
  const token = (req.query.token as string) || "";
  if (!token) return res.status(400).json({ error: "token is required" });
  try {
    const items = await db.select().from(guestCartItemsTable)
      .where(eq(guestCartItemsTable.guestSessionToken, token))
      .orderBy(guestCartItemsTable.addedAt);
    return res.json(items);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /guest/cart — add or update a guest cart item
router.post("/guest/cart", async (req, res) => {
  try {
    const {
      guestSessionToken, planId, planName, billingCycle,
      monthlyPrice, quarterlyPrice, semiannualPrice, yearlyPrice,
      renewalPrice, renewalEnabled, itemType, domainName, tld,
    } = req.body;

    if (!guestSessionToken || !planId || !planName) {
      return res.status(400).json({ error: "guestSessionToken, planId and planName are required" });
    }

    const itemTypeVal = (["hosting", "domain", "vps"].includes(itemType) ? itemType : "hosting") as string;

    const existing = await db.select().from(guestCartItemsTable)
      .where(and(
        eq(guestCartItemsTable.guestSessionToken, guestSessionToken),
        eq(guestCartItemsTable.planId, planId),
      ))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db.update(guestCartItemsTable)
        .set({
          planName,
          itemType: itemTypeVal,
          billingCycle: billingCycle || "monthly",
          monthlyPrice: String(monthlyPrice || 0),
          quarterlyPrice: quarterlyPrice != null ? String(quarterlyPrice) : null,
          semiannualPrice: semiannualPrice != null ? String(semiannualPrice) : null,
          yearlyPrice: yearlyPrice != null ? String(yearlyPrice) : null,
          renewalPrice: renewalPrice != null ? String(renewalPrice) : null,
          renewalEnabled: renewalEnabled ? "true" : "false",
          domainName: domainName || null,
          tld: tld || null,
          updatedAt: new Date(),
        })
        .where(and(
          eq(guestCartItemsTable.guestSessionToken, guestSessionToken),
          eq(guestCartItemsTable.planId, planId),
        ))
        .returning();
      return res.json(updated);
    }

    const [inserted] = await db.insert(guestCartItemsTable).values({
      guestSessionToken,
      planId,
      planName,
      itemType: itemTypeVal,
      billingCycle: billingCycle || "monthly",
      monthlyPrice: String(monthlyPrice || 0),
      quarterlyPrice: quarterlyPrice != null ? String(quarterlyPrice) : null,
      semiannualPrice: semiannualPrice != null ? String(semiannualPrice) : null,
      yearlyPrice: yearlyPrice != null ? String(yearlyPrice) : null,
      renewalPrice: renewalPrice != null ? String(renewalPrice) : null,
      renewalEnabled: renewalEnabled ? "true" : "false",
      domainName: domainName || null,
      tld: tld || null,
    }).returning();

    return res.json(inserted);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /guest/cart/:planId — remove one guest item
router.delete("/guest/cart/:planId", async (req, res) => {
  try {
    const token = (req.query.token as string) || "";
    const { planId } = req.params;
    if (!token) return res.status(400).json({ error: "token is required" });

    await db.delete(guestCartItemsTable)
      .where(and(
        eq(guestCartItemsTable.guestSessionToken, token),
        eq(guestCartItemsTable.planId, planId),
      ));
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /cart/merge-guest — merge guest cart into authenticated user cart ────────
// Called immediately after login to transfer guest items → user account.
router.post("/cart/merge-guest", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { guestToken } = req.body;
    if (!guestToken) return res.json({ merged: 0 });

    const guestItems = await db.select().from(guestCartItemsTable)
      .where(eq(guestCartItemsTable.guestSessionToken, guestToken));

    if (guestItems.length === 0) return res.json({ merged: 0 });

    let merged = 0;
    for (const item of guestItems) {
      const existing = await db.select().from(cartItemsTable)
        .where(and(eq(cartItemsTable.userId, userId), eq(cartItemsTable.planId, item.planId)))
        .limit(1);

      if (existing.length > 0) {
        await db.update(cartItemsTable)
          .set({
            billingCycle: item.billingCycle,
            monthlyPrice: item.monthlyPrice,
            quarterlyPrice: item.quarterlyPrice,
            semiannualPrice: item.semiannualPrice,
            yearlyPrice: item.yearlyPrice,
            renewalPrice: item.renewalPrice,
            renewalEnabled: item.renewalEnabled,
            updatedAt: new Date(),
          })
          .where(and(eq(cartItemsTable.userId, userId), eq(cartItemsTable.planId, item.planId)));
      } else {
        await db.insert(cartItemsTable).values({
          userId,
          planId: item.planId,
          planName: item.planName,
          itemType: item.itemType ?? "hosting",
          billingCycle: item.billingCycle,
          monthlyPrice: item.monthlyPrice,
          quarterlyPrice: item.quarterlyPrice,
          semiannualPrice: item.semiannualPrice,
          yearlyPrice: item.yearlyPrice,
          renewalPrice: item.renewalPrice,
          renewalEnabled: item.renewalEnabled,
          domainName: item.domainName,
          tld: item.tld,
        });
      }
      merged++;
    }

    // Clean up guest items after merge
    await db.delete(guestCartItemsTable)
      .where(eq(guestCartItemsTable.guestSessionToken, guestToken));

    return res.json({ merged });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Domain Cart Session Routes ───────────────────────────────────────────────
// Persists public-site domain searches so the checkout wizard can pre-populate.

// POST /guest/domain-session — save domain selected on public website
router.post("/guest/domain-session", async (req, res) => {
  try {
    const { sessionToken, domainName, tld, fullDomain, price, durationYears, actionType } = req.body;
    if (!sessionToken || !domainName || !tld) {
      return res.status(400).json({ error: "sessionToken, domainName, tld are required" });
    }
    const full = fullDomain || `${domainName}${tld}`;
    await db.execute(sql`
      INSERT INTO website_cart_sessions (session_token, domain_name, tld, full_domain, price, duration_years, action_type)
      VALUES (${sessionToken}, ${domainName}, ${tld}, ${full}, ${price ?? 0}, ${durationYears ?? 1}, ${actionType ?? 'register'})
      ON CONFLICT (session_token) DO UPDATE SET
        domain_name    = EXCLUDED.domain_name,
        tld            = EXCLUDED.tld,
        full_domain    = EXCLUDED.full_domain,
        price          = EXCLUDED.price,
        duration_years = EXCLUDED.duration_years,
        action_type    = EXCLUDED.action_type,
        created_at     = NOW()
    `);
    return res.json({ ok: true, sessionToken });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /guest/domain-session/:token — retrieve saved domain session
router.get("/guest/domain-session/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const rows = await db.execute(sql`
      SELECT * FROM website_cart_sessions WHERE session_token = ${token} ORDER BY created_at DESC LIMIT 1
    `);
    if (!rows.rows || rows.rows.length === 0) return res.status(404).json({ error: "Session not found" });
    return res.json(rows.rows[0]);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /guest/domain-session/:token — clear session after use
router.delete("/guest/domain-session/:token", async (req, res) => {
  try {
    const { token } = req.params;
    await db.execute(sql`DELETE FROM website_cart_sessions WHERE session_token = ${token}`);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/cart/lookup/:packageId — detect product type + return pricing ──
// Resolves hosting, VPS, email (admin_email_packages), and domain (extension tld) plans.
router.get("/cart/lookup/:packageId", async (req, res) => {
  try {
    const { packageId } = req.params;
    const { type } = req.query as { type?: string };

    // 1. VPS check
    if (type === "vps" || !type) {
      const [vpsPlan] = await db.select().from(vpsPlansTable)
        .where(eq(vpsPlansTable.id, packageId)).limit(1);
      if (vpsPlan?.isActive) {
        return res.json({
          packageId: vpsPlan.id,
          packageName: vpsPlan.name,
          productType: "vps",
          monthlyPrice: Number(vpsPlan.price),
          quarterlyPrice: (vpsPlan as any).quarterlyPrice ? Number((vpsPlan as any).quarterlyPrice) : null,
          semiannualPrice: (vpsPlan as any).semiannualPrice ? Number((vpsPlan as any).semiannualPrice) : null,
          yearlyPrice: (vpsPlan as any).yearlyPrice ? Number((vpsPlan as any).yearlyPrice) : null,
          description: vpsPlan.description ?? null,
          features: (vpsPlan as any).features ?? [],
        });
      }
    }

    // 2. Email (admin_email_packages) check
    if (type === "email" || !type) {
      const emailRows = await db.execute(sql`SELECT * FROM admin_email_packages WHERE id = ${packageId} LIMIT 1`);
      const ep = (emailRows as any).rows?.[0] ?? (emailRows as any)[0];
      if (ep) {
        return res.json({
          packageId: ep.id,
          packageName: ep.name,
          productType: "email",
          monthlyPrice: Number(ep.price ?? 0),
          yearlyPrice: ep.yearly_price ? Number(ep.yearly_price) : null,
          quarterlyPrice: null,
          semiannualPrice: null,
          maxStorageGb: ep.max_storage_gb ?? null,
          maxMailboxes: ep.max_mailboxes ?? null,
          description: ep.description ?? null,
          features: [],
        });
      }
    }

    // 3. Domain extension (tld) check — packageId may be a tld like ".com"
    if (type === "domain" || !type) {
      const tld = packageId.startsWith(".") ? packageId : `.${packageId}`;
      const [ext] = await db.select().from(domainExtensionsTable)
        .where(eq(domainExtensionsTable.extension, tld)).limit(1);
      if (ext && ext.isActive) {
        return res.json({
          packageId: ext.extension,
          packageName: `${ext.extension} Domain`,
          productType: "domain",
          monthlyPrice: Number(ext.registerPrice),
          yearlyPrice: Number(ext.registerPrice),
          quarterlyPrice: null,
          semiannualPrice: null,
          transferPrice: Number(ext.transferPrice),
          renewalPrice: ext.renewalPrice ? Number(ext.renewalPrice) : Number(ext.registerPrice),
          renewalEnabled: true,
          description: null,
          features: [],
        });
      }
    }

    // 4. Hosting plan check
    const [plan] = await db.select().from(hostingPlansTable)
      .where(eq(hostingPlansTable.id, packageId)).limit(1);
    if (plan?.isActive) {
      return res.json({
        packageId: plan.id,
        packageName: plan.name,
        productType: "hosting",
        monthlyPrice: Number(plan.price),
        quarterlyPrice: (plan as any).quarterlyPrice ? Number((plan as any).quarterlyPrice) : null,
        semiannualPrice: (plan as any).semiannualPrice ? Number((plan as any).semiannualPrice) : null,
        yearlyPrice: plan.yearlyPrice ? Number(plan.yearlyPrice) : null,
        renewalPrice: (plan as any).renewalPrice ? Number((plan as any).renewalPrice) : null,
        renewalEnabled: plan.renewalEnabled ?? true,
        freeDomainEnabled: plan.freeDomainEnabled ?? false,
        freeDomainTlds: plan.freeDomainTlds ?? [],
        diskSpace: plan.diskSpace ?? null,
        bandwidth: plan.bandwidth ?? null,
        emailAccounts: plan.emailAccounts ?? null,
        features: plan.features ?? [],
        description: plan.description ?? null,
      });
    }

    return res.status(404).json({ error: "Product not found or not active" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/cart/validate-referral — validate affiliate referral code ──────
router.post("/cart/validate-referral", async (req, res) => {
  try {
    const { code } = req.body;
    if (!code?.trim()) return res.status(400).json({ error: "Code is required" });

    const [affiliate] = await db.select({
      id: affiliatesTable.id,
      referralCode: affiliatesTable.referralCode,
      userId: affiliatesTable.userId,
      status: affiliatesTable.status,
    }).from(affiliatesTable)
      .where(eq(affiliatesTable.referralCode, code.trim().toUpperCase()))
      .limit(1);

    if (!affiliate || affiliate.status === "suspended") {
      return res.status(404).json({ error: "Invalid referral code" });
    }

    return res.json({
      valid: true,
      code: affiliate.referralCode,
      affiliateId: affiliate.id,
      discountPercent: 10,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/cart/session — create or update a cart recovery session ───────
// Maps to existing cart_sessions table (abandoned cart recovery schema).
router.post("/cart/session", async (req, res) => {
  try {
    const { sessionId, items, subtotal } = req.body;
    if (!sessionId) return res.status(400).json({ error: "sessionId is required" });
    const token = req.headers.authorization?.replace("Bearer ", "") ?? null;
    let userId = "anonymous";
    if (token) {
      try {
        const { verifyToken } = await import("../lib/auth.js");
        const payload = verifyToken(token);
        userId = (payload as any).id ?? "anonymous";
      } catch {}
    }
    const firstItem = Array.isArray(items) && items.length > 0 ? items[0] : null;
    await db.execute(sql`
      INSERT INTO cart_sessions (id, user_id, package_id, package_name, billing_cycle, completed, reminder_sent, abandoned_at)
      VALUES (
        ${sessionId}, ${userId},
        ${firstItem?.packageId ?? null}, ${firstItem?.packageName ?? null},
        ${firstItem?.billingCycle ?? "monthly"}, false, false, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        package_id   = EXCLUDED.package_id,
        package_name = EXCLUDED.package_name,
        billing_cycle = EXCLUDED.billing_cycle,
        abandoned_at = NOW()
    `);
    return res.json({ ok: true, sessionId, itemCount: Array.isArray(items) ? items.length : 0, subtotal: subtotal ?? 0 });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/cart/validate-coupon — validate promo code for unified cart ───
// Thin wrapper: accepts { code, amount } and calls promo-codes validate logic
router.post("/cart/validate-coupon", async (req, res) => {
  try {
    const { code, amount } = req.body;
    if (!code?.trim()) return res.status(400).json({ error: "Code is required" });
    const amountNum = Number(amount) || 0;
    const [promo] = await db.select().from(promoCodesTable)
      .where(eq(promoCodesTable.code, code.trim().toUpperCase()))
      .limit(1);
    if (!promo || !promo.isActive) {
      return res.status(404).json({ error: "Invalid or expired promo code" });
    }
    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
      return res.status(400).json({ error: "Promo code has expired" });
    }
    if (promo.maxUses && (promo.usedCount ?? 0) >= promo.maxUses) {
      return res.status(400).json({ error: "Promo code usage limit reached" });
    }
    const discountType = (promo as any).discountType ?? "percent";
    let discountAmount: number;
    if (discountType === "fixed") {
      discountAmount = Math.min(Number((promo as any).fixedAmount ?? 0), amountNum);
    } else {
      discountAmount = amountNum * (promo.discountPercent / 100);
    }
    const finalAmount = Math.max(0, amountNum - discountAmount);
    return res.json({
      valid: true,
      code: promo.code,
      discountType,
      discountPercent: promo.discountPercent,
      discountAmount: Number(discountAmount.toFixed(2)),
      originalAmount: amountNum,
      finalAmount: Number(finalAmount.toFixed(2)),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
