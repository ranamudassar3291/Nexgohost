import { Router } from "express";
import { db } from "@workspace/db";
import { hostingPlansTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";

const router = Router();

function formatPlan(p: typeof hostingPlansTable.$inferSelect) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: Number(p.price),
    yearlyPrice: p.yearlyPrice ? Number(p.yearlyPrice) : null,
    quarterlyPrice: (p as any).quarterlyPrice ? Number((p as any).quarterlyPrice) : null,
    semiannualPrice: (p as any).semiannualPrice ? Number((p as any).semiannualPrice) : null,
    billingCycle: p.billingCycle,
    groupId: p.groupId ?? null,
    module: p.module ?? "none",
    moduleServerId: p.moduleServerId ?? null,
    moduleServerGroupId: p.moduleServerGroupId ?? null,
    modulePlanId: p.modulePlanId ?? null,
    modulePlanName: p.modulePlanName ?? null,
    diskSpace: p.diskSpace,
    bandwidth: p.bandwidth,
    emailAccounts: p.emailAccounts,
    databases: p.databases,
    subdomains: p.subdomains,
    ftpAccounts: p.ftpAccounts,
    isActive: p.isActive,
    features: p.features ?? [],
    renewalEnabled: p.renewalEnabled ?? true,
    renewalPrice: (p as any).renewalPrice ? Number((p as any).renewalPrice) : null,
    freeDomainEnabled: p.freeDomainEnabled ?? false,
    freeDomainTlds: p.freeDomainTlds ?? [],
    createdAt: p.createdAt.toISOString(),
  };
}

// Public: list active packages (used in client new order page)
router.get("/packages", async (_req, res) => {
  try {
    const plans = await db.select().from(hostingPlansTable)
      .where(eq(hostingPlansTable.isActive, true))
      .orderBy(sql`price ASC`);
    res.json(plans.map(formatPlan));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Public: get single package by ID
router.get("/packages/:id", async (req, res) => {
  try {
    const [plan] = await db.select().from(hostingPlansTable)
      .where(eq(hostingPlansTable.id, req.params.id));
    if (!plan) return res.status(404).json({ error: "Package not found" });
    return res.json(formatPlan(plan));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Admin: list all packages (including inactive)
router.get("/admin/packages", authenticate, requireAdmin, async (_req, res) => {
  try {
    const plans = await db.select().from(hostingPlansTable).orderBy(sql`created_at DESC`);
    res.json(plans.map(formatPlan));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: get single package
router.get("/admin/packages/:id", authenticate, requireAdmin, async (_req, res) => {
  try {
    const [plan] = await db.select().from(hostingPlansTable).where(eq(hostingPlansTable.id, _req.params.id)).limit(1);
    if (!plan) return res.status(404).json({ error: "Not found" });
    res.json(formatPlan(plan));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: create package
router.post("/admin/packages", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const {
      name, description, price, yearlyPrice, quarterlyPrice, semiannualPrice,
      billingCycle = "monthly",
      groupId, module = "none", moduleServerId, moduleServerGroupId, modulePlanId, modulePlanName,
      diskSpace = "10 GB", bandwidth = "100 GB",
      emailAccounts = 10, databases = 5, subdomains = 10, ftpAccounts = 5,
      features = [],
      renewalEnabled = true, renewalPrice, freeDomainEnabled = false, freeDomainTlds = [],
    } = req.body;

    if (!name || !price) {
      res.status(400).json({ error: "name and price are required" });
      return;
    }

    const [plan] = await db.insert(hostingPlansTable).values({
      name, description, price: String(price),
      yearlyPrice: yearlyPrice ? String(yearlyPrice) : null,
      billingCycle, groupId: groupId || null, module,
      moduleServerId: moduleServerId || null,
      moduleServerGroupId: moduleServerGroupId || null,
      modulePlanId: modulePlanId || null,
      modulePlanName: modulePlanName || null,
      diskSpace, bandwidth, emailAccounts, databases, subdomains, ftpAccounts,
      isActive: true, features,
      renewalEnabled: Boolean(renewalEnabled),
      freeDomainEnabled: Boolean(freeDomainEnabled),
      freeDomainTlds: Array.isArray(freeDomainTlds) ? freeDomainTlds : [],
    } as any).returning();

    // Update quarterly/semiannual via raw SQL since drizzle schema may be stale
    if (quarterlyPrice || semiannualPrice || renewalPrice !== undefined) {
      await db.execute(sql`UPDATE hosting_plans SET
        quarterly_price = ${quarterlyPrice ? String(quarterlyPrice) : null},
        semiannual_price = ${semiannualPrice ? String(semiannualPrice) : null},
        renewal_price = ${renewalPrice ? String(renewalPrice) : null}
        WHERE id = ${plan.id}`);
    }

    const [updated] = await db.select().from(hostingPlansTable).where(eq(hostingPlansTable.id, plan.id)).limit(1);
    res.status(201).json(formatPlan(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: update package
router.put("/admin/packages/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { quarterlyPrice, semiannualPrice, renewalPrice, ...updates } = req.body;

    if (updates.price !== undefined) updates.price = String(updates.price);
    if (updates.yearlyPrice !== undefined) updates.yearlyPrice = updates.yearlyPrice ? String(updates.yearlyPrice) : null;
    if (updates.groupId !== undefined) updates.groupId = updates.groupId || null;
    if (updates.freeDomainEnabled !== undefined) updates.freeDomainEnabled = Boolean(updates.freeDomainEnabled);
    if (updates.renewalEnabled !== undefined) updates.renewalEnabled = Boolean(updates.renewalEnabled);
    if (updates.freeDomainTlds !== undefined) updates.freeDomainTlds = Array.isArray(updates.freeDomainTlds) ? updates.freeDomainTlds : [];

    await db.update(hostingPlansTable)
      .set(updates)
      .where(eq(hostingPlansTable.id, id));

    // Update quarterly/semiannual/renewal via raw SQL
    await db.execute(sql`UPDATE hosting_plans SET
      quarterly_price = ${quarterlyPrice ? String(quarterlyPrice) : null},
      semiannual_price = ${semiannualPrice ? String(semiannualPrice) : null},
      renewal_price = ${renewalPrice ? String(renewalPrice) : null}
      WHERE id = ${id}`);

    const [plan] = await db.select().from(hostingPlansTable).where(eq(hostingPlansTable.id, id)).limit(1);
    if (!plan) { res.status(404).json({ error: "Package not found" }); return; }
    res.json(formatPlan(plan));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: toggle active status
router.post("/admin/packages/:id/toggle", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const [existing] = await db.select().from(hostingPlansTable).where(eq(hostingPlansTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Package not found" }); return; }

    const [plan] = await db.update(hostingPlansTable)
      .set({ isActive: !existing.isActive })
      .where(eq(hostingPlansTable.id, id))
      .returning();

    res.json(formatPlan(plan));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: delete package
router.delete("/admin/packages/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await db.delete(hostingPlansTable).where(eq(hostingPlansTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
