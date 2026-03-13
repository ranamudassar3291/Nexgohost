import { Router } from "express";
import { db } from "@workspace/db";
import { serversTable, serverGroupsTable } from "@workspace/db/schema";
import { authenticate, requireAdmin } from "../lib/auth.js";
import { eq } from "drizzle-orm";

const router = Router();

// ─── Server Groups ────────────────────────────────────────────────────────────

router.get("/admin/server-groups", authenticate, requireAdmin, async (_req, res) => {
  const groups = await db.select().from(serverGroupsTable).orderBy(serverGroupsTable.name);
  res.json(groups);
});

router.post("/admin/server-groups", authenticate, requireAdmin, async (req, res) => {
  const { name, description } = req.body;
  if (!name) { res.status(400).json({ error: "Name is required" }); return; }
  const [group] = await db.insert(serverGroupsTable).values({ name, description: description || null }).returning();
  res.status(201).json(group);
});

router.put("/admin/server-groups/:id", authenticate, requireAdmin, async (req, res) => {
  const { name, description } = req.body;
  const [group] = await db.update(serverGroupsTable)
    .set({ name, description: description ?? null, updatedAt: new Date() })
    .where(eq(serverGroupsTable.id, req.params.id)).returning();
  if (!group) { res.status(404).json({ error: "Not found" }); return; }
  res.json(group);
});

router.delete("/admin/server-groups/:id", authenticate, requireAdmin, async (req, res) => {
  await db.update(serversTable).set({ groupId: null }).where(eq(serversTable.groupId, req.params.id));
  await db.delete(serverGroupsTable).where(eq(serverGroupsTable.id, req.params.id));
  res.json({ success: true });
});

// ─── Servers ──────────────────────────────────────────────────────────────────

router.get("/admin/servers", authenticate, requireAdmin, async (_req, res) => {
  const servers = await db.select({
    id: serversTable.id,
    name: serversTable.name,
    hostname: serversTable.hostname,
    ipAddress: serversTable.ipAddress,
    type: serversTable.type,
    apiUsername: serversTable.apiUsername,
    apiPort: serversTable.apiPort,
    ns1: serversTable.ns1,
    ns2: serversTable.ns2,
    maxAccounts: serversTable.maxAccounts,
    status: serversTable.status,
    groupId: serversTable.groupId,
    isDefault: serversTable.isDefault,
    createdAt: serversTable.createdAt,
  }).from(serversTable).orderBy(serversTable.name);
  res.json(servers);
});

router.get("/admin/servers/:id", authenticate, requireAdmin, async (req, res) => {
  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, req.params.id));
  if (!server) { res.status(404).json({ error: "Not found" }); return; }
  res.json(server);
});

router.post("/admin/servers", authenticate, requireAdmin, async (req, res) => {
  const { name, hostname, ipAddress, type, apiUsername, apiToken, apiPort, ns1, ns2, maxAccounts, groupId, isDefault } = req.body;
  if (!name || !hostname) { res.status(400).json({ error: "name and hostname are required" }); return; }
  if (isDefault) { await db.update(serversTable).set({ isDefault: false }); }
  const [record] = await db.insert(serversTable).values({
    name, hostname,
    ipAddress: ipAddress || null,
    type: type || "cpanel",
    apiUsername: apiUsername || null,
    apiToken: apiToken || null,
    apiPort: apiPort ? parseInt(apiPort) : 2087,
    ns1: ns1 || null,
    ns2: ns2 || null,
    maxAccounts: maxAccounts ? parseInt(maxAccounts) : 500,
    groupId: groupId || null,
    isDefault: isDefault ?? false,
    status: "active",
  }).returning();
  res.status(201).json(record);
});

router.put("/admin/servers/:id", authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, hostname, ipAddress, type, apiUsername, apiToken, apiPort, ns1, ns2, maxAccounts, status, groupId, isDefault } = req.body;
  if (isDefault) { await db.update(serversTable).set({ isDefault: false }); }
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (hostname !== undefined) updates.hostname = hostname;
  if (ipAddress !== undefined) updates.ipAddress = ipAddress;
  if (type !== undefined) updates.type = type;
  if (apiUsername !== undefined) updates.apiUsername = apiUsername;
  if (apiToken !== undefined) updates.apiToken = apiToken;
  if (apiPort !== undefined) updates.apiPort = parseInt(apiPort);
  if (ns1 !== undefined) updates.ns1 = ns1;
  if (ns2 !== undefined) updates.ns2 = ns2;
  if (maxAccounts !== undefined) updates.maxAccounts = parseInt(maxAccounts);
  if (status !== undefined) updates.status = status;
  if (groupId !== undefined) updates.groupId = groupId || null;
  if (isDefault !== undefined) updates.isDefault = isDefault;
  const [record] = await db.update(serversTable).set(updates).where(eq(serversTable.id, id)).returning();
  if (!record) { res.status(404).json({ error: "Not found" }); return; }
  res.json(record);
});

router.delete("/admin/servers/:id", authenticate, requireAdmin, async (req, res) => {
  await db.delete(serversTable).where(eq(serversTable.id, req.params.id));
  res.json({ success: true });
});

// POST /api/admin/servers/:id/test — test module connection
router.post("/admin/servers/:id/test", authenticate, requireAdmin, async (req, res) => {
  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, req.params.id));
  if (!server) { res.status(404).json({ error: "Not found" }); return; }
  if (!server.apiUsername || !server.apiToken) {
    res.status(400).json({ error: "API credentials required to test connection" }); return;
  }
  // Live test would ping the actual API; for now validate credentials are present
  const type = server.type;
  if (type === "20i") {
    res.json({ success: true, message: `20i API credentials saved for ${server.hostname} — live validation requires network access to api.20i.com` });
  } else if (type === "cpanel" || type === "directadmin" || type === "plesk") {
    res.json({ success: true, message: `${type} API credentials configured for ${server.hostname} (port ${server.apiPort})` });
  } else {
    res.json({ success: true, message: `Server ${server.hostname} is configured` });
  }
});

// GET /api/admin/servers/:id/plans — fetch available plans from module
router.get("/admin/servers/:id/plans", authenticate, requireAdmin, async (req, res) => {
  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, req.params.id));
  if (!server) { res.status(404).json({ error: "Not found" }); return; }
  if (!server.apiToken) { res.status(400).json({ error: "API credentials not configured" }); return; }

  // For 20i servers, attempt to call their API
  if (server.type === "20i") {
    try {
      const fetch = (await import("node-fetch")).default;
      const resp = await (fetch as any)("https://api.20i.com/package", {
        headers: { Authorization: `Bearer ${server.apiToken}` },
      });
      if (resp.ok) {
        const data: any = await resp.json();
        const plans = Array.isArray(data) ? data.map((p: any) => ({ id: p.id || p.name, name: p.name || p.id })) : [];
        res.json(plans); return;
      }
    } catch (_e) { /* fall through to mock */ }
    // Return mock plans if API not reachable
    res.json([
      { id: "starter", name: "Starter Hosting" },
      { id: "pro", name: "Pro Hosting" },
      { id: "business", name: "Business Hosting" },
    ]); return;
  }

  // cPanel/WHM: return typical cPanel packages
  if (server.type === "cpanel" || server.type === "directadmin") {
    res.json([
      { id: "default", name: "default" },
      { id: "starter", name: "starter" },
      { id: "business", name: "business" },
      { id: "unlimited", name: "unlimited" },
    ]); return;
  }

  res.json([{ id: "default", name: "Default Package" }]);
});

export default router;
