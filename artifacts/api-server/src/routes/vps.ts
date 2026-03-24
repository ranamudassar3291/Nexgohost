import { Router } from "express";
import { db } from "@workspace/db";
import { vpsPlansTable, vpsOsTemplatesTable, vpsLocationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";

const router = Router();

function fmt(v: any) { return v == null ? null : Number(v); }

function formatPlan(p: typeof vpsPlansTable.$inferSelect) {
  return {
    ...p,
    price: fmt(p.price),
    yearlyPrice: fmt(p.yearlyPrice),
    bandwidthTb: fmt(p.bandwidthTb),
    saveAmount: fmt(p.saveAmount),
    features: p.features ?? [],
    osTemplateIds: p.osTemplateIds ?? [],
    locationIds: p.locationIds ?? [],
  };
}

// ── Public endpoints ──────────────────────────────────────────────────────────

router.get("/vps-plans", async (_req, res) => {
  try {
    const plans = await db.select().from(vpsPlansTable)
      .where(eq(vpsPlansTable.isActive, true))
      .orderBy(vpsPlansTable.sortOrder, vpsPlansTable.createdAt);
    res.json(plans.map(formatPlan));
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

router.get("/vps-os-templates", async (_req, res) => {
  try {
    const rows = await db.select().from(vpsOsTemplatesTable)
      .where(eq(vpsOsTemplatesTable.isActive, true))
      .orderBy(vpsOsTemplatesTable.name);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

router.get("/vps-locations", async (_req, res) => {
  try {
    const rows = await db.select().from(vpsLocationsTable)
      .where(eq(vpsLocationsTable.isActive, true))
      .orderBy(vpsLocationsTable.countryName);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// ── Admin endpoints ───────────────────────────────────────────────────────────

// VPS Plans
router.get("/admin/vps-plans", authenticate, requireAdmin, async (_req, res) => {
  try {
    const plans = await db.select().from(vpsPlansTable).orderBy(vpsPlansTable.sortOrder, vpsPlansTable.createdAt);
    res.json(plans.map(formatPlan));
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

router.post("/admin/vps-plans", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const {
      name, description, price, yearlyPrice,
      cpuCores, ramGb, storageGb, bandwidthTb,
      virtualization, features, osTemplateIds, locationIds,
      saveAmount, isActive, sortOrder,
    } = req.body;
    if (!name || price == null) { res.status(400).json({ error: "name and price are required" }); return; }
    const [plan] = await db.insert(vpsPlansTable).values({
      name, description: description || null,
      price: String(Number(price).toFixed(2)),
      yearlyPrice: yearlyPrice != null ? String(Number(yearlyPrice).toFixed(2)) : null,
      cpuCores: cpuCores ? Number(cpuCores) : 1,
      ramGb: ramGb ? Number(ramGb) : 1,
      storageGb: storageGb ? Number(storageGb) : 20,
      bandwidthTb: bandwidthTb != null ? String(Number(bandwidthTb).toFixed(2)) : "1",
      virtualization: virtualization || "KVM",
      features: Array.isArray(features) ? features : [],
      osTemplateIds: Array.isArray(osTemplateIds) ? osTemplateIds : [],
      locationIds: Array.isArray(locationIds) ? locationIds : [],
      saveAmount: saveAmount != null ? String(Number(saveAmount).toFixed(2)) : null,
      isActive: isActive !== false,
      sortOrder: sortOrder ? Number(sortOrder) : 0,
    }).returning();
    res.status(201).json(formatPlan(plan));
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

router.get("/admin/vps-plans/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const [plan] = await db.select().from(vpsPlansTable).where(eq(vpsPlansTable.id, req.params.id)).limit(1);
    if (!plan) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatPlan(plan));
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

router.put("/admin/vps-plans/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const {
      name, description, price, yearlyPrice,
      cpuCores, ramGb, storageGb, bandwidthTb,
      virtualization, features, osTemplateIds, locationIds,
      saveAmount, isActive, sortOrder,
    } = req.body;
    const updates: Partial<typeof vpsPlansTable.$inferInsert> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description || null;
    if (price !== undefined) updates.price = String(Number(price).toFixed(2));
    if (yearlyPrice !== undefined) updates.yearlyPrice = yearlyPrice != null ? String(Number(yearlyPrice).toFixed(2)) : null;
    if (cpuCores !== undefined) updates.cpuCores = Number(cpuCores);
    if (ramGb !== undefined) updates.ramGb = Number(ramGb);
    if (storageGb !== undefined) updates.storageGb = Number(storageGb);
    if (bandwidthTb !== undefined) updates.bandwidthTb = String(Number(bandwidthTb).toFixed(2));
    if (virtualization !== undefined) updates.virtualization = virtualization;
    if (features !== undefined) updates.features = Array.isArray(features) ? features : [];
    if (osTemplateIds !== undefined) updates.osTemplateIds = Array.isArray(osTemplateIds) ? osTemplateIds : [];
    if (locationIds !== undefined) updates.locationIds = Array.isArray(locationIds) ? locationIds : [];
    if (saveAmount !== undefined) updates.saveAmount = saveAmount != null ? String(Number(saveAmount).toFixed(2)) : null;
    if (isActive !== undefined) updates.isActive = isActive;
    if (sortOrder !== undefined) updates.sortOrder = Number(sortOrder);
    const [updated] = await db.update(vpsPlansTable).set(updates).where(eq(vpsPlansTable.id, req.params.id)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatPlan(updated));
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

router.delete("/admin/vps-plans/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    await db.delete(vpsPlansTable).where(eq(vpsPlansTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// OS Templates
router.get("/admin/vps-os-templates", authenticate, requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(vpsOsTemplatesTable).orderBy(vpsOsTemplatesTable.name);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

router.post("/admin/vps-os-templates", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, version, iconUrl, isActive } = req.body;
    if (!name || !version) { res.status(400).json({ error: "name and version are required" }); return; }
    const [row] = await db.insert(vpsOsTemplatesTable).values({
      name, version, iconUrl: iconUrl || null, isActive: isActive !== false,
    }).returning();
    res.status(201).json(row);
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

router.put("/admin/vps-os-templates/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, version, iconUrl, isActive } = req.body;
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (version !== undefined) updates.version = version;
    if (iconUrl !== undefined) updates.iconUrl = iconUrl || null;
    if (isActive !== undefined) updates.isActive = isActive;
    const [updated] = await db.update(vpsOsTemplatesTable).set(updates).where(eq(vpsOsTemplatesTable.id, req.params.id)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

router.delete("/admin/vps-os-templates/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    await db.delete(vpsOsTemplatesTable).where(eq(vpsOsTemplatesTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Locations
router.get("/admin/vps-locations", authenticate, requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(vpsLocationsTable).orderBy(vpsLocationsTable.countryName);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

router.post("/admin/vps-locations", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { countryName, countryCode, flagIcon, isActive } = req.body;
    if (!countryName || !countryCode) { res.status(400).json({ error: "countryName and countryCode are required" }); return; }
    const [row] = await db.insert(vpsLocationsTable).values({
      countryName, countryCode, flagIcon: flagIcon || null, isActive: isActive !== false,
    }).returning();
    res.status(201).json(row);
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

router.put("/admin/vps-locations/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { countryName, countryCode, flagIcon, isActive } = req.body;
    const updates: any = {};
    if (countryName !== undefined) updates.countryName = countryName;
    if (countryCode !== undefined) updates.countryCode = countryCode;
    if (flagIcon !== undefined) updates.flagIcon = flagIcon || null;
    if (isActive !== undefined) updates.isActive = isActive;
    const [updated] = await db.update(vpsLocationsTable).set(updates).where(eq(vpsLocationsTable.id, req.params.id)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

router.delete("/admin/vps-locations/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    await db.delete(vpsLocationsTable).where(eq(vpsLocationsTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

export default router;
