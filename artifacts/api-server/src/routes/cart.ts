import { Router } from "express";
import { db } from "@workspace/db";
import { cartItemsTable } from "@workspace/db/schema";
import { authenticate, type AuthRequest } from "../lib/auth.js";
import { eq, and } from "drizzle-orm";

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
      monthlyPrice, quarterlyPrice, semiannualPrice, yearlyPrice, renewalPrice, renewalEnabled,
    } = req.body;

    if (!planId || !planName) {
      return res.status(400).json({ error: "planId and planName are required" });
    }

    // Upsert: update if exists, insert if not
    const existing = await db.select().from(cartItemsTable)
      .where(and(eq(cartItemsTable.userId, userId), eq(cartItemsTable.planId, planId)))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db.update(cartItemsTable)
        .set({
          planName,
          billingCycle: billingCycle || "monthly",
          monthlyPrice: String(monthlyPrice || 0),
          quarterlyPrice: quarterlyPrice != null ? String(quarterlyPrice) : null,
          semiannualPrice: semiannualPrice != null ? String(semiannualPrice) : null,
          yearlyPrice: yearlyPrice != null ? String(yearlyPrice) : null,
          renewalPrice: renewalPrice != null ? String(renewalPrice) : null,
          renewalEnabled: renewalEnabled ? "true" : "false",
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
      billingCycle: billingCycle || "monthly",
      monthlyPrice: String(monthlyPrice || 0),
      quarterlyPrice: quarterlyPrice != null ? String(quarterlyPrice) : null,
      semiannualPrice: semiannualPrice != null ? String(semiannualPrice) : null,
      yearlyPrice: yearlyPrice != null ? String(yearlyPrice) : null,
      renewalPrice: renewalPrice != null ? String(renewalPrice) : null,
      renewalEnabled: renewalEnabled ? "true" : "false",
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

export default router;
