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
    billingCycle: p.billingCycle,
    diskSpace: p.diskSpace,
    bandwidth: p.bandwidth,
    emailAccounts: p.emailAccounts,
    databases: p.databases,
    subdomains: p.subdomains,
    ftpAccounts: p.ftpAccounts,
    isActive: p.isActive,
    features: p.features ?? [],
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

// Admin: create package
router.post("/admin/packages", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const {
      name, description, price, billingCycle = "monthly",
      diskSpace = "10 GB", bandwidth = "100 GB",
      emailAccounts = 10, databases = 5, subdomains = 10, ftpAccounts = 5,
      features = [],
    } = req.body;

    if (!name || !price) {
      res.status(400).json({ error: "name and price are required" });
      return;
    }

    const [plan] = await db.insert(hostingPlansTable).values({
      name, description, price: String(price), billingCycle,
      diskSpace, bandwidth, emailAccounts, databases, subdomains, ftpAccounts,
      isActive: true, features,
    }).returning();

    res.status(201).json(formatPlan(plan));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: update package
router.put("/admin/packages/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.price !== undefined) updates.price = String(updates.price);

    const [plan] = await db.update(hostingPlansTable)
      .set(updates)
      .where(eq(hostingPlansTable.id, id))
      .returning();

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
