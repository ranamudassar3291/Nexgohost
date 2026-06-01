import { Router } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { vpsPlansTable, vpsOsTemplatesTable, vpsLocationsTable, hostingServicesTable, usersTable, ordersTable } from "@workspace/db/schema";
import { eq, and, ilike, sql } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";

const router = Router();

function fmt(v: any) { return v == null ? null : Number(v); }

function formatPlan(p: typeof vpsPlansTable.$inferSelect) {
  return {
    ...p,
    price: fmt(p.price),
    quarterlyPrice: fmt(p.quarterlyPrice),
    semiannualPrice: fmt(p.semiannualPrice),
    yearlyPrice: fmt(p.yearlyPrice),
    biennialPrice: fmt(p.biennialPrice),
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

// ── Admin VPS Services management ──────────────────────────────────────────────

// List all VPS services (admin can see all clients)
router.get("/admin/vps-services", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { search, status } = req.query as { search?: string; status?: string };

    let query = db.select({
      service: hostingServicesTable,
      user: {
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        companyName: usersTable.companyName,
      },
    })
      .from(hostingServicesTable)
      .leftJoin(usersTable, eq(hostingServicesTable.clientId, usersTable.id))
      .where(ilike(hostingServicesTable.planName, "%VPS%"))
      .$dynamic();

    const rows = await query.orderBy(sql`${hostingServicesTable.createdAt} DESC`);

    let filtered = rows;
    if (status) filtered = filtered.filter(r => r.service.status === status);
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(r =>
        r.user?.email?.toLowerCase().includes(s) ||
        r.service.domain?.toLowerCase().includes(s) ||
        r.service.planName?.toLowerCase().includes(s) ||
        r.service.serverIp?.toLowerCase().includes(s) ||
        r.user?.firstName?.toLowerCase().includes(s)
      );
    }

    const plans = await db.select().from(vpsPlansTable);
    const planMap = new Map(plans.map(p => [p.id, p]));

    res.json(filtered.map(r => {
      const plan = planMap.get(r.service.planId);
      return {
        id: r.service.id,
        clientId: r.service.clientId,
        clientEmail: r.user?.email ?? null,
        clientName: r.user?.firstName ? `${r.user.firstName} ${r.user.lastName ?? ""}`.trim() : r.user?.email ?? null,
        companyName: r.user?.companyName ?? null,
        planId: r.service.planId,
        planName: r.service.planName,
        hostname: r.service.domain ?? null,
        dedicatedIp: r.service.serverIp ?? null,
        sshUsername: r.service.username ?? null,
        sshPassword: r.service.password ?? null,
        status: r.service.status,
        billingCycle: r.service.billingCycle,
        nextDueDate: r.service.nextDueDate,
        startDate: r.service.startDate,
        autoRenew: r.service.autoRenew,
        cpuCores: plan?.cpuCores ?? 1,
        ramGb: plan?.ramGb ?? 1,
        storageGb: plan?.storageGb ?? 20,
        bandwidthTb: plan ? fmt(plan.bandwidthTb) : 1,
        createdAt: r.service.createdAt,
      };
    }));
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Get single VPS service (admin)
router.get("/admin/vps-services/:id", authenticate, requireAdmin, async (_req, res) => {
  try {
    const [row] = await db.select({
      service: hostingServicesTable,
      user: {
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
      },
    })
      .from(hostingServicesTable)
      .leftJoin(usersTable, eq(hostingServicesTable.clientId, usersTable.id))
      .where(eq(hostingServicesTable.id, _req.params.id))
      .limit(1);

    if (!row) { res.status(404).json({ error: "Not found" }); return; }

    const [plan] = await db.select().from(vpsPlansTable).where(eq(vpsPlansTable.id, row.service.planId)).limit(1);

    res.json({
      id: row.service.id,
      clientId: row.service.clientId,
      clientEmail: row.user?.email ?? null,
      clientName: row.user?.firstName ? `${row.user.firstName} ${row.user.lastName ?? ""}`.trim() : row.user?.email ?? null,
      planName: row.service.planName,
      hostname: row.service.domain ?? null,
      dedicatedIp: row.service.serverIp ?? null,
      sshUsername: row.service.username ?? null,
      sshPassword: row.service.password ?? null,
      status: row.service.status,
      billingCycle: row.service.billingCycle,
      nextDueDate: row.service.nextDueDate,
      startDate: row.service.startDate,
      autoRenew: row.service.autoRenew,
      cpuCores: plan?.cpuCores ?? 1,
      ramGb: plan?.ramGb ?? 1,
      storageGb: plan?.storageGb ?? 20,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Update VPS service admin fields (hostname, IP, SSH credentials, status)
router.put("/admin/vps-services/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { hostname, dedicatedIp, sshUsername, sshPassword, status } = req.body;
    const updates: Partial<typeof hostingServicesTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (hostname !== undefined) updates.domain = hostname || null;
    if (dedicatedIp !== undefined) updates.serverIp = dedicatedIp || null;
    if (sshUsername !== undefined) updates.username = sshUsername || null;
    if (sshPassword !== undefined) updates.password = sshPassword || null;
    if (status !== undefined) updates.status = status;

    const [updated] = await db.update(hostingServicesTable)
      .set(updates)
      .where(eq(hostingServicesTable.id, req.params.id))
      .returning();

    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true, id: updated.id });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Admin: manually trigger VPS provisioning (Provisioning Module)
// Sets the service status to "active" and records the provisioning timestamp.
// In production, this endpoint can call the hypervisor API (e.g. Virtualizor / Proxmox).
router.post("/admin/vps-services/:id/provision", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [svc] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, req.params.id), eq(hostingServicesTable.serviceType, "vps")))
      .limit(1);
    if (!svc) { res.status(404).json({ error: "VPS service not found" }); return; }
    if (svc.status === "active") {
      res.status(400).json({ error: "VPS service is already active" }); return;
    }

    const { dedicatedIp, notes } = req.body;
    const provisionedAt = new Date();

    await db.update(hostingServicesTable).set({
      status: "active",
      serverIp: dedicatedIp || svc.serverIp || null,
      vpsProvisionStatus: "provisioned",
      vpsProvisionedAt: provisionedAt,
      vpsProvisionNotes: notes || `Manually provisioned by admin on ${provisionedAt.toISOString()}`,
      updatedAt: new Date(),
    } as any).where(eq(hostingServicesTable.id, svc.id));

    // Also mark linked order as approved
    if (svc.orderId) {
      await db.update(ordersTable).set({ status: "approved", updatedAt: new Date() })
        .where(eq(ordersTable.id, svc.orderId));
    }

    console.log(`[VPS-MODULE] Service ${svc.id} manually provisioned by admin ${req.user!.userId}. IP: ${dedicatedIp || "not assigned"}`);

    res.json({
      success: true,
      serviceId: svc.id,
      status: "active",
      provisionedAt: provisionedAt.toISOString(),
      message: `VPS ${svc.vpsHostname || svc.id} activated. Configure your hypervisor with imageId=${svc.vpsImageId || "n/a"}, hostname=${svc.vpsHostname || "n/a"}.`,
    });
  } catch (err) { console.error("[VPS-MODULE] provision error:", err); res.status(500).json({ error: "Server error" }); }
});

// Admin: get full VPS provision details (for reseller module)
router.get("/admin/vps-services/:id/provision-details", authenticate, requireAdmin, async (_req, res) => {
  try {
    const [svc] = await db.select().from(hostingServicesTable)
      .where(eq(hostingServicesTable.id, _req.params.id)).limit(1);
    if (!svc) { res.status(404).json({ error: "Not found" }); return; }

    res.json({
      serviceId: svc.id,
      hostname: svc.vpsHostname,
      rootUser: svc.vpsRootUser,
      rootPassword: svc.vpsRootPassword,
      imageId: svc.vpsImageId,
      osTemplate: svc.vpsOsTemplate,
      location: svc.vpsLocation,
      autoRenew: (svc as any).vpsAutoRenew ?? true,
      weeklyBackups: (svc as any).vpsWeeklyBackups ?? false,
      provisionStatus: (svc as any).vpsProvisionStatus ?? "not_started",
      provisionedAt: (svc as any).vpsProvisionedAt ?? null,
      provisionNotes: (svc as any).vpsProvisionNotes ?? null,
      status: svc.status,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Admin: import VPS plans from Virtualizor/Proxmox-style JSON (Reseller Module)
router.post("/admin/vps-plans/import", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { plans } = req.body;
    if (!Array.isArray(plans) || plans.length === 0) {
      res.status(400).json({ error: "plans array is required" }); return;
    }
    const inserted = [];
    for (const p of plans) {
      if (!p.name || !p.price) continue;
      const [row] = await db.insert(vpsPlansTable).values({
        name: p.name,
        description: p.description || null,
        price: String(p.price),
        yearlyPrice: p.yearlyPrice ? String(p.yearlyPrice) : null,
        cpuCores: p.cpuCores || 1,
        ramGb: p.ramGb || 1,
        storageGb: p.storageGb || 20,
        bandwidthTb: p.bandwidthTb ? String(p.bandwidthTb) : "1",
        virtualization: p.virtualization || "KVM",
        features: p.features || [],
        isActive: true,
        sortOrder: p.sortOrder || 0,
      }).returning();
      inserted.push(formatPlan(row));
    }
    res.status(201).json({ imported: inserted.length, plans: inserted });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// VPS SERVER ORDERS — Standalone Provisioning Engine
// ═══════════════════════════════════════════════════════════════════════════

/** Secure alphanumeric 16-char password */
function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(crypto.randomBytes(16))
    .map(b => chars[b % chars.length])
    .join("");
}

/** Maps OS name → cloud-init bootstrap script */
function getCloudInitScript(os: string): string {
  const lc = os.toLowerCase();
  if (lc.includes("n8n")) return `#!/bin/bash
curl -fsSL https://get.docker.com | sh
docker volume create n8n_data
docker run -d --restart always --name n8n -p 5678:5678 -v n8n_data:/home/node/.n8n n8nio/n8n`;
  if (lc.includes("docker") || lc.includes("portainer")) return `#!/bin/bash
curl -fsSL https://get.docker.com | sh
docker volume create portainer_data
docker run -d --restart always --name portainer -p 9000:9000 -v /var/run/docker.sock:/var/run/docker.sock -v portainer_data:/data portainer/portainer-ce`;
  if (lc.includes("windows")) return `# Windows Server: deploy via WinRM / custom image ID — no cloud-init`;
  // Default: Ubuntu/Debian/AlmaLinux hardening
  return `#!/bin/bash
apt-get update -y && apt-get upgrade -y
apt-get install -y ufw fail2ban curl wget
ufw allow OpenSSH && ufw --force enable
systemctl enable fail2ban && systemctl start fail2ban
echo "Server hardened at $(date)" >> /var/log/provision.log`;
}

// ── IP Pool: Network Allocation Adapter ──────────────────────────────────────

interface PoolIpRecord {
  id: number;
  ip_address: string;
  gateway: string | null;
  netmask: string | null;
  dns_servers: string | null;
  display_location: string;
}

/**
 * Atomically allocate an IP from vps_ips_pool for the given location.
 * Uses FOR UPDATE SKIP LOCKED for concurrent-safe allocation.
 * Falls back to any available IP if the requested location is exhausted.
 */
async function allocateIpFromPool(
  orderId: number,
  location?: string | null,
): Promise<PoolIpRecord | null> {
  // Try matching location first, then any available
  const queries = location
    ? [
        sql`SELECT * FROM vps_ips_pool WHERE is_allocated = FALSE AND LOWER(display_location) = LOWER(${location}) ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`,
        sql`SELECT * FROM vps_ips_pool WHERE is_allocated = FALSE ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`,
      ]
    : [sql`SELECT * FROM vps_ips_pool WHERE is_allocated = FALSE ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`];

  for (const q of queries) {
    const rows = await db.execute(q);
    if (rows.rows.length > 0) {
      const ip = rows.rows[0] as any;
      await db.execute(sql`
        UPDATE vps_ips_pool
        SET is_allocated = TRUE, order_id = ${orderId}
        WHERE id = ${ip.id}
      `);
      console.log(`[IP-POOL] Allocated ${ip.ip_address} (${ip.display_location}) → order #${orderId}`);
      return ip as PoolIpRecord;
    }
  }
  return null;
}

/**
 * Release an allocated IP back to the pool when an order is terminated.
 */
async function releaseIpToPool(orderId: number): Promise<void> {
  await db.execute(sql`
    UPDATE vps_ips_pool SET is_allocated = FALSE, order_id = NULL
    WHERE order_id = ${orderId}
  `);
  console.log(`[IP-POOL] Released IP for order #${orderId}`);
}

// ── Admin: IP Pool CRUD ───────────────────────────────────────────────────────

/** GET /admin/vps/ip-pool — list all IPs with stats */
router.get("/admin/vps/ip-pool", authenticate, requireAdmin, async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT p.*, o.package_name, u.email AS user_email
      FROM vps_ips_pool p
      LEFT JOIN vps_server_orders o ON o.id = p.order_id
      LEFT JOIN users u ON u.id = o.user_id
      ORDER BY p.display_location, p.is_allocated DESC, p.id
    `);
    const stats = await db.execute(sql`
      SELECT
        COUNT(*)                            AS total,
        COUNT(*) FILTER (WHERE is_allocated = FALSE) AS available,
        COUNT(*) FILTER (WHERE is_allocated = TRUE)  AS allocated,
        COUNT(DISTINCT display_location)    AS locations
      FROM vps_ips_pool
    `);
    res.json({ ips: rows.rows, stats: stats.rows[0] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/** POST /admin/vps/ip-pool — add single IP */
router.post("/admin/vps/ip-pool", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { ipAddress, gateway, netmask, dnsServers, displayLocation, notes } = req.body;
    if (!ipAddress?.trim()) { res.status(400).json({ error: "ipAddress is required" }); return; }
    const row = await db.execute(sql`
      INSERT INTO vps_ips_pool (ip_address, gateway, netmask, dns_servers, display_location, notes)
      VALUES (
        ${ipAddress.trim()},
        ${gateway ?? null},
        ${netmask ?? "255.255.255.0"},
        ${dnsServers ?? "8.8.8.8,8.8.4.4"},
        ${displayLocation ?? "Germany"},
        ${notes ?? null}
      )
      ON CONFLICT (ip_address) DO NOTHING
      RETURNING *
    `);
    if (!row.rows.length) { res.status(409).json({ error: "IP address already exists in pool" }); return; }
    console.log(`[IP-POOL] Admin added IP ${ipAddress} (${displayLocation})`);
    res.status(201).json({ success: true, ip: row.rows[0] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/** POST /admin/vps/ip-pool/bulk — paste multiple IPs (csv lines: ip,gateway,netmask,dns,location) */
router.post("/admin/vps/ip-pool/bulk", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { lines, defaultLocation } = req.body as { lines: string; defaultLocation?: string };
    if (!lines?.trim()) { res.status(400).json({ error: "lines is required" }); return; }
    const rows = lines.split("\n").map((l: string) => l.trim()).filter(Boolean);
    let inserted = 0, skipped = 0;
    for (const row of rows) {
      const parts = row.split(",").map((p: string) => p.trim());
      const [ip, gateway, netmask, dns, loc] = parts;
      if (!ip) continue;
      const result = await db.execute(sql`
        INSERT INTO vps_ips_pool (ip_address, gateway, netmask, dns_servers, display_location)
        VALUES (
          ${ip},
          ${gateway ?? null},
          ${netmask ?? "255.255.255.0"},
          ${dns ?? "8.8.8.8,8.8.4.4"},
          ${loc ?? defaultLocation ?? "Germany"}
        )
        ON CONFLICT (ip_address) DO NOTHING
      `);
      if ((result as any).rowCount > 0) inserted++; else skipped++;
    }
    console.log(`[IP-POOL] Bulk import: ${inserted} inserted, ${skipped} skipped`);
    res.json({ success: true, inserted, skipped });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/** DELETE /admin/vps/ip-pool/:id — remove unallocated IP */
router.delete("/admin/vps/ip-pool/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const check = await db.execute(sql`SELECT is_allocated FROM vps_ips_pool WHERE id = ${id}`);
    if (!check.rows.length) { res.status(404).json({ error: "IP not found" }); return; }
    if ((check.rows[0] as any).is_allocated) {
      res.status(409).json({ error: "Cannot delete an allocated IP. Release it first." }); return;
    }
    await db.execute(sql`DELETE FROM vps_ips_pool WHERE id = ${id}`);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/** POST /admin/vps/ip-pool/:id/release — force-release an IP back to the pool */
router.post("/admin/vps/ip-pool/:id/release", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.execute(sql`
      UPDATE vps_ips_pool SET is_allocated = FALSE, order_id = NULL WHERE id = ${id}
    `);
    console.log(`[IP-POOL] Admin force-released pool IP id=${id}`);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Expose releaseIpToPool for use in terminate/cancel routes ─────────────────
export { releaseIpToPool };

/** Simulate realistic stats seeded by order id */
function simulateOrderStats(id: number, status: string): object {
  if (status !== "active") {
    return { cpuPercent: 0, ramPercent: 0, diskPercent: 0, bandwidthIn: 0, bandwidthOut: 0, uptimeSeconds: 0, networkIn: "0 B/s", networkOut: "0 B/s" };
  }
  const seed = id * 7919;
  return {
    cpuPercent:   Math.round(5  + (seed % 55)),
    ramPercent:   Math.round(20 + (seed % 60)),
    diskPercent:  Math.round(10 + (seed % 65)),
    bandwidthIn:  parseFloat((0.1 + (seed % 100) / 10).toFixed(2)),
    bandwidthOut: parseFloat((0.05 + (seed % 50) / 10).toFixed(2)),
    uptimeSeconds: 86400 * 3 + (seed % 86400),
    networkIn:  `${((seed % 50) + 1).toFixed(1)} MB/s`,
    networkOut: `${((seed % 30) + 0.5).toFixed(1)} MB/s`,
  };
}

// ── Admin: Activate / Provision a VPS Server Order ───────────────────────────
// IP resolution order:
//   1. Admin supplies explicit ipAddress → use as override (e.g. Anycast/external)
//   2. Pool has an available IP matching selectedLocation → auto-allocate
//   3. Pool fallback: any available IP regardless of location
//   4. Pool empty → create order in 'provisioning' state, admin must add IPs
router.post("/admin/vps/activate", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const {
      userId, packageName, ipAddress: manualIp, selectedLocation,
      operatingSystem, billingCycle, renewalPrice,
      cpuCores, ramGb, storageGb, vpsReferenceId, notes,
    } = req.body;

    if (!userId) { res.status(400).json({ error: "userId is required" }); return; }

    const password = generatePassword();
    const cloudInitScript = getCloudInitScript(operatingSystem || "");
    const nextDue = new Date();
    nextDue.setMonth(nextDue.getMonth() + (billingCycle === "yearly" ? 12 : 1));

    // Step 1: Create the order row (status: provisioning, no IP yet)
    const result = await db.execute(sql`
      INSERT INTO vps_server_orders
        (user_id, package_name, ip_address, root_password, selected_location,
         operating_system, billing_cycle, renewal_price, vps_reference_id,
         server_status, cloud_init_script, cpu_cores, ram_gb, storage_gb,
         next_due_date, notes)
      VALUES
        (${userId}, ${packageName ?? null}, NULL, ${password},
         ${selectedLocation ?? null}, ${operatingSystem ?? null},
         ${billingCycle ?? "monthly"}, ${renewalPrice ? String(renewalPrice) : null},
         ${vpsReferenceId ?? null}, 'provisioning', ${cloudInitScript},
         ${cpuCores ?? 1}, ${ramGb ?? 1}, ${storageGb ?? 20},
         ${nextDue.toISOString()}, ${notes ?? null})
      RETURNING id, root_password, server_status
    `);
    const row = result.rows[0] as any;
    const orderId: number = row.id;

    // Step 2: Resolve IP — manual override → pool allocation → no IP
    let assignedIp: string | null = manualIp?.trim() || null;
    let networkConfig: PoolIpRecord | null = null;
    let poolEmpty = false;

    if (assignedIp) {
      // Manual override: update order with the provided IP and mark active
      await db.execute(sql`
        UPDATE vps_server_orders
        SET ip_address = ${assignedIp}, server_status = 'active'
        WHERE id = ${orderId}
      `);
    } else {
      // Auto-allocate from pool (location-preferring with any-location fallback)
      networkConfig = await allocateIpFromPool(orderId, selectedLocation);
      if (networkConfig) {
        assignedIp = networkConfig.ip_address;
        await db.execute(sql`
          UPDATE vps_server_orders
          SET ip_address = ${assignedIp}, server_status = 'active'
          WHERE id = ${orderId}
        `);
      } else {
        poolEmpty = true;
        console.warn(`[VPS-ORDERS] Pool empty — order #${orderId} created in 'provisioning' state`);
      }
    }

    console.log(`[VPS-ORDERS] Order #${orderId} | user=${userId} | OS=${operatingSystem} | IP=${assignedIp ?? "PENDING"} | location=${selectedLocation ?? "any"}`);

    res.status(201).json({
      success: true,
      orderId,
      rootPassword: row.root_password,
      status: poolEmpty ? "provisioning" : "active",
      assignedIp,
      networkConfig: networkConfig ? {
        gateway: networkConfig.gateway,
        netmask: networkConfig.netmask,
        dns: networkConfig.dns_servers,
        location: networkConfig.display_location,
      } : null,
      cloudInitScript,
      poolEmpty,
      message: poolEmpty
        ? `⚠️ Order #${orderId} created but no IPs available in pool. Add IPs via Admin → VPS → IP Pool, then assign manually.`
        : `✅ VPS provisioned. root@${assignedIp} | Password issued. Cloud-init script injected for ${operatingSystem ?? "base OS"}.`,
    });
  } catch (err: any) {
    console.error("[VPS-ORDERS] activate error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: List all VPS server orders ────────────────────────────────────────
router.get("/admin/vps/orders", authenticate, requireAdmin, async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT o.*, u.email AS user_email, u.first_name, u.last_name
      FROM vps_server_orders o
      LEFT JOIN users u ON u.id = o.user_id
      ORDER BY o.created_at DESC
      LIMIT 200
    `);
    res.json({ orders: rows.rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Admin: Update a VPS server order (IP, status, etc.) ──────────────────────
router.put("/admin/vps/orders/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { ipAddress, serverStatus, notes, vpsReferenceId } = req.body;
    await db.execute(sql`
      UPDATE vps_server_orders
      SET ip_address      = COALESCE(${ipAddress ?? null},     ip_address),
          server_status   = COALESCE(${serverStatus ?? null},  server_status),
          notes           = COALESCE(${notes ?? null},         notes),
          vps_reference_id = COALESCE(${vpsReferenceId ?? null}, vps_reference_id)
      WHERE id = ${parseInt(req.params.id)}
    `);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Client: Get own VPS order details ────────────────────────────────────────
router.get("/my/vps-orders/:orderId", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const rows = await db.execute(sql`
      SELECT * FROM vps_server_orders
      WHERE id = ${parseInt(req.params.orderId)} AND user_id = ${userId}
      LIMIT 1
    `);
    if (rows.rows.length === 0) { res.status(404).json({ error: "Order not found" }); return; }
    const order: any = rows.rows[0];

    // Map snake_case → camelCase
    const mapped = {
      id:               order.id,
      userId:           order.user_id,
      packageName:      order.package_name,
      ipAddress:        order.ip_address,
      rootPassword:     order.root_password,
      selectedLocation: order.selected_location,
      operatingSystem:  order.operating_system,
      billingCycle:     order.billing_cycle,
      renewalPrice:     order.renewal_price,
      vpsReferenceId:   order.vps_reference_id,
      serverStatus:     order.server_status,
      cpuCores:         order.cpu_cores ?? 1,
      ramGb:            order.ram_gb ?? 1,
      storageGb:        order.storage_gb ?? 20,
      nextDueDate:      order.next_due_date,
      createdAt:        order.created_at,
    };

    res.json({ order: mapped, stats: simulateOrderStats(order.id, order.server_status) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Client: Power actions (restart / stop / start) ───────────────────────────
router.post("/my/vps-orders/:orderId/power", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { action } = req.body as { action: "restart" | "stop" | "start" };
    if (!["restart", "stop", "start"].includes(action)) {
      res.status(400).json({ error: "Invalid action" }); return;
    }

    const rows = await db.execute(sql`
      SELECT id, server_status FROM vps_server_orders
      WHERE id = ${parseInt(req.params.orderId)} AND user_id = ${userId} LIMIT 1
    `);
    if (!rows.rows.length) { res.status(404).json({ error: "Order not found" }); return; }

    const newStatus = action === "stop" ? "stopped" : "active";
    await db.execute(sql`
      UPDATE vps_server_orders SET server_status = ${newStatus}
      WHERE id = ${parseInt(req.params.orderId)}
    `);

    const labels: Record<string, string> = {
      restart: "🔄 Soft reboot initiated. Server will be back online in ~60 seconds.",
      stop:    "⏹ Server powered down successfully.",
      start:   "⚡ Cold-boot sequence initiated. Server is starting up.",
    };
    console.log(`[VPS-ORDERS] Power action "${action}" on order ${req.params.orderId} by user ${userId}`);
    res.json({ success: true, message: labels[action], status: newStatus });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Client: Rebuild / OS Reinstall ───────────────────────────────────────────
router.post("/my/vps-orders/:orderId/rebuild", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { operatingSystem } = req.body;
    if (!operatingSystem) { res.status(400).json({ error: "operatingSystem is required" }); return; }

    const rows = await db.execute(sql`
      SELECT id FROM vps_server_orders
      WHERE id = ${parseInt(req.params.orderId)} AND user_id = ${userId} LIMIT 1
    `);
    if (!rows.rows.length) { res.status(404).json({ error: "Order not found" }); return; }

    const newPassword = generatePassword();
    const cloudInit   = getCloudInitScript(operatingSystem);

    await db.execute(sql`
      UPDATE vps_server_orders
      SET server_status    = 'provisioning',
          operating_system = ${operatingSystem},
          root_password    = ${newPassword},
          cloud_init_script = ${cloudInit}
      WHERE id = ${parseInt(req.params.orderId)}
    `);

    // Simulate rebuild completing after delay (in production: call hypervisor API)
    setTimeout(async () => {
      await db.execute(sql`
        UPDATE vps_server_orders SET server_status = 'active'
        WHERE id = ${parseInt(req.params.orderId)}
      `).catch(() => {});
    }, 30000);

    console.log(`[VPS-ORDERS] Rebuild to "${operatingSystem}" on order ${req.params.orderId}`);
    res.json({
      success: true,
      newPassword,
      message: `⚙️ Rebuild started with ${operatingSystem}. Server will be online in ~30s. New root password issued.`,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Client: Create renewal invoice ───────────────────────────────────────────
router.post("/my/vps-orders/:orderId/renew", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const rows = await db.execute(sql`
      SELECT * FROM vps_server_orders
      WHERE id = ${parseInt(req.params.orderId)} AND user_id = ${userId} LIMIT 1
    `);
    if (!rows.rows.length) { res.status(404).json({ error: "Order not found" }); return; }
    const order: any = rows.rows[0];

    const amount = parseFloat(order.renewal_price ?? "0");
    if (!amount) { res.json({ message: "No renewal price configured. Contact support." }); return; }

    // Create invoice row
    const inv = await db.execute(sql`
      INSERT INTO invoices (user_id, total, subtotal, status, due_date, notes, created_at, updated_at)
      VALUES (
        ${userId},
        ${String(amount)}, ${String(amount)},
        'unpaid',
        ${new Date(Date.now() + 7 * 86400000).toISOString()},
        ${"VPS Renewal: " + (order.package_name ?? `Order #${order.id}`)},
        NOW(), NOW()
      )
      RETURNING id
    `);
    const invoiceId = (inv.rows[0] as any).id;

    res.json({ success: true, invoiceId, message: "Renewal invoice created." });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;

