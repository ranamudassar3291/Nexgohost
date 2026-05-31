import { Router } from "express";
import { db } from "@workspace/db";
import { cartItemsTable, guestCartItemsTable } from "@workspace/db/schema";
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

export default router;
