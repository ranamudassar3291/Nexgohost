import { Router } from "express";
import { db } from "@workspace/db";
import { vpsPlansTable, vpsOsTemplatesTable, vpsLocationsTable, hostingServicesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
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

function formatLocation(l: typeof vpsLocationsTable.$inferSelect) {
  return {
    id: l.id,
    countryName: l.countryName,
    countryCode: l.countryCode,
    flagIcon: l.flagIcon,
    city: (l as any).city ?? null,
    datacenter: (l as any).datacenter ?? null,
    networkSpeed: (l as any).networkSpeed ?? "1 Gbps",
    latencyMs: (l as any).latencyMs ?? 10,
    isActive: l.isActive,
    createdAt: l.createdAt,
  };
}

// Simulate realistic VPS stats based on service id (deterministic seed)
function simulateStats(serviceId: string, status: string) {
  if (status !== "active") {
    return { cpuPercent: 0, ramPercent: 0, diskPercent: 0, bandwidthIn: 0, bandwidthOut: 0, uptimeSeconds: 0, networkIn: "0 B/s", networkOut: "0 B/s" };
  }
  // Use char codes for deterministic but varied values
  const seed = serviceId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const cpuPercent   = Math.round(5 + (seed % 45));
  const ramPercent   = Math.round(20 + (seed % 55));
  const diskPercent  = Math.round(10 + (seed % 60));
  const bandwidthIn  = parseFloat((0.1 + (seed % 100) / 10).toFixed(2));
  const bandwidthOut = parseFloat((0.05 + (seed % 50) / 10).toFixed(2));
  const uptimeSeconds = 86400 * 7 + (seed % 86400);
  return {
    cpuPercent, ramPercent, diskPercent,
    bandwidthIn, bandwidthOut, uptimeSeconds,
    networkIn: `${(seed % 50 + 1).toFixed(1)} MB/s`,
    networkOut: `${(seed % 30 + 0.5).toFixed(1)} MB/s`,
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
    res.json(rows.map(formatLocation));
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// ── Client VPS service management endpoints ───────────────────────────────────

// Get all VPS services for the current client
router.get("/my/vps-services", authenticate, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const services = await db.select().from(hostingServicesTable)
      .where(eq(hostingServicesTable.clientId, clientId))
      .orderBy(hostingServicesTable.startDate);

    // Filter to VPS plans only (plan_name starts with VPS)
    const vpsServices = services.filter(s =>
      /^vps/i.test(s.planName) || /virtual\s*private/i.test(s.planName)
    );

    // Enrich with VPS plan details
    const plans = await db.select().from(vpsPlansTable);
    const planMap = new Map(plans.map(p => [p.id, p]));

    const enriched = await Promise.all(vpsServices.map(async (svc) => {
      const plan = planMap.get(svc.planId);
      const stats = simulateStats(svc.id, svc.status);

      // Get location and OS info from plan metadata (stored in server_ip field as JSON if available)
      let locationInfo = null;
      let osInfo = null;
      try {
        const meta = JSON.parse((svc as any).vpsMetadata ?? "{}");
        if (meta.locationId) {
          const [loc] = await db.select().from(vpsLocationsTable).where(eq(vpsLocationsTable.id, meta.locationId)).limit(1);
          if (loc) locationInfo = formatLocation(loc);
        }
        if (meta.osTemplateId) {
          const [os] = await db.select().from(vpsOsTemplatesTable).where(eq(vpsOsTemplatesTable.id, meta.osTemplateId)).limit(1);
          if (os) osInfo = os;
        }
      } catch {}

      return {
        id: svc.id,
        planId: svc.planId,
        planName: svc.planName,
        domain: svc.domain,
        status: svc.status,
        serverIp: svc.serverIp,
        billingCycle: svc.billingCycle,
        nextDueDate: svc.nextDueDate,
        startDate: svc.startDate,
        expiryDate: svc.expiryDate,
        autoRenew: svc.autoRenew,
        cpuCores: plan?.cpuCores ?? 1,
        ramGb: plan?.ramGb ?? 1,
        storageGb: plan?.storageGb ?? 20,
        bandwidthTb: plan ? fmt(plan.bandwidthTb) : 1,
        virtualization: plan?.virtualization ?? "KVM",
        location: locationInfo,
        os: osInfo,
        stats,
      };
    }));

    res.json(enriched);
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Get single VPS service details
router.get("/my/vps-services/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const [svc] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, req.params.id), eq(hostingServicesTable.clientId, clientId)))
      .limit(1);
    if (!svc) { res.status(404).json({ error: "Not found" }); return; }
    if (!/^vps/i.test(svc.planName)) { res.status(404).json({ error: "Not a VPS service" }); return; }

    const [plan] = await db.select().from(vpsPlansTable).where(eq(vpsPlansTable.id, svc.planId)).limit(1);
    const stats = simulateStats(svc.id, svc.status);

    // Get all OS and locations for the plan
    const allOs = plan?.osTemplateIds?.length
      ? await db.select().from(vpsOsTemplatesTable).where(eq(vpsOsTemplatesTable.isActive, true))
      : [];
    const allLocs = plan?.locationIds?.length
      ? await db.select().from(vpsLocationsTable).where(eq(vpsLocationsTable.isActive, true))
      : await db.select().from(vpsLocationsTable).where(eq(vpsLocationsTable.isActive, true));

    let locationInfo = null;
    let osInfo = null;
    try {
      const meta = JSON.parse((svc as any).vpsMetadata ?? "{}");
      if (meta.locationId) {
        const [loc] = await db.select().from(vpsLocationsTable).where(eq(vpsLocationsTable.id, meta.locationId)).limit(1);
        if (loc) locationInfo = formatLocation(loc);
      }
      if (meta.osTemplateId) {
        const [os] = await db.select().from(vpsOsTemplatesTable).where(eq(vpsOsTemplatesTable.id, meta.osTemplateId)).limit(1);
        if (os) osInfo = os;
      }
    } catch {}

    res.json({
      id: svc.id,
      planId: svc.planId,
      planName: svc.planName,
      domain: svc.domain,
      status: svc.status,
      serverIp: svc.serverIp,
      billingCycle: svc.billingCycle,
      nextDueDate: svc.nextDueDate,
      startDate: svc.startDate,
      expiryDate: svc.expiryDate,
      autoRenew: svc.autoRenew,
      cpuCores: plan?.cpuCores ?? 1,
      ramGb: plan?.ramGb ?? 1,
      storageGb: plan?.storageGb ?? 20,
      bandwidthTb: plan ? fmt(plan.bandwidthTb) : 1,
      virtualization: plan?.virtualization ?? "KVM",
      features: plan?.features ?? [],
      location: locationInfo,
      os: osInfo,
      availableOs: allOs,
      availableLocations: allLocs.map(formatLocation),
      stats,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Reboot VPS
router.post("/my/vps-services/:id/reboot", authenticate, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const [svc] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, req.params.id), eq(hostingServicesTable.clientId, clientId)))
      .limit(1);
    if (!svc) { res.status(404).json({ error: "Not found" }); return; }
    if (svc.status !== "active") { res.status(400).json({ error: "Server must be active to reboot" }); return; }
    // Simulate reboot (in production this would call a hypervisor API)
    setTimeout(() => {}, 2000);
    res.json({ success: true, message: "Reboot initiated. Server will be back online in ~30 seconds." });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Power on/off VPS
router.post("/my/vps-services/:id/power", authenticate, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { action } = req.body; // "on" | "off" | "reset"
    if (!["on", "off", "reset"].includes(action)) { res.status(400).json({ error: "Invalid action" }); return; }
    const [svc] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, req.params.id), eq(hostingServicesTable.clientId, clientId)))
      .limit(1);
    if (!svc) { res.status(404).json({ error: "Not found" }); return; }
    const messages: Record<string, string> = {
      on: "Server is powering on. It will be online in ~30 seconds.",
      off: "Server is shutting down. This may take up to 60 seconds.",
      reset: "Hard reset initiated. Server will restart immediately.",
    };
    res.json({ success: true, message: messages[action] });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Reinstall OS
router.post("/my/vps-services/:id/reinstall", authenticate, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { osTemplateId } = req.body;
    if (!osTemplateId) { res.status(400).json({ error: "osTemplateId is required" }); return; }
    const [svc] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, req.params.id), eq(hostingServicesTable.clientId, clientId)))
      .limit(1);
    if (!svc) { res.status(404).json({ error: "Not found" }); return; }
    const [os] = await db.select().from(vpsOsTemplatesTable).where(eq(vpsOsTemplatesTable.id, osTemplateId)).limit(1);
    if (!os) { res.status(404).json({ error: "OS template not found" }); return; }
    // In production: update metadata and trigger hypervisor reinstall
    res.json({
      success: true,
      message: `OS reinstall started. ${os.name} ${os.version} will be installed in ~5-10 minutes. All data on the server will be erased.`,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Get live stats
router.get("/my/vps-services/:id/stats", authenticate, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const [svc] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, req.params.id), eq(hostingServicesTable.clientId, clientId)))
      .limit(1);
    if (!svc) { res.status(404).json({ error: "Not found" }); return; }
    // Add slight variation for "real-time" feel
    const base = simulateStats(svc.id, svc.status);
    const variation = () => (Math.random() * 6 - 3);
    res.json({
      ...base,
      cpuPercent:  Math.max(0, Math.min(100, base.cpuPercent  + variation())),
      ramPercent:  Math.max(0, Math.min(100, base.ramPercent  + variation())),
      timestamp: new Date().toISOString(),
    });
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
    res.json(rows.map(formatLocation));
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

router.post("/admin/vps-locations", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { countryName, countryCode, flagIcon, city, datacenter, networkSpeed, latencyMs, isActive } = req.body;
    if (!countryName || !countryCode) { res.status(400).json({ error: "countryName and countryCode are required" }); return; }
    const [row] = await db.insert(vpsLocationsTable).values({
      countryName, countryCode, flagIcon: flagIcon || null,
      city: city || null, datacenter: datacenter || null,
      networkSpeed: networkSpeed || "1 Gbps", latencyMs: latencyMs ? Number(latencyMs) : 10,
      isActive: isActive !== false,
    } as any).returning();
    res.status(201).json(formatLocation(row));
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

router.put("/admin/vps-locations/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { countryName, countryCode, flagIcon, city, datacenter, networkSpeed, latencyMs, isActive } = req.body;
    const updates: any = {};
    if (countryName !== undefined) updates.countryName = countryName;
    if (countryCode !== undefined) updates.countryCode = countryCode;
    if (flagIcon !== undefined) updates.flagIcon = flagIcon || null;
    if (city !== undefined) updates.city = city || null;
    if (datacenter !== undefined) updates.datacenter = datacenter || null;
    if (networkSpeed !== undefined) updates.networkSpeed = networkSpeed || "1 Gbps";
    if (latencyMs !== undefined) updates.latencyMs = Number(latencyMs);
    if (isActive !== undefined) updates.isActive = isActive;
    const [updated] = await db.update(vpsLocationsTable).set(updates).where(eq(vpsLocationsTable.id, req.params.id)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatLocation(updated));
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

router.delete("/admin/vps-locations/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    await db.delete(vpsLocationsTable).where(eq(vpsLocationsTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

export default router;
