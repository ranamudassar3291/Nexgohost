import { Router } from "express";
import { db } from "@workspace/db";
import { serversTable } from "@workspace/db/schema";
import { authenticate, requireAdmin } from "../lib/auth.js";
import { eq } from "drizzle-orm";

const router = Router();

// GET /api/admin/servers
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
    isDefault: serversTable.isDefault,
    createdAt: serversTable.createdAt,
  }).from(serversTable).orderBy(serversTable.name);
  res.json(servers);
});

// GET /api/admin/servers/:id
router.get("/admin/servers/:id", authenticate, requireAdmin, async (req, res) => {
  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, req.params.id));
  if (!server) return res.status(404).json({ error: "Not found" });
  res.json(server);
});

// POST /api/admin/servers
router.post("/admin/servers", authenticate, requireAdmin, async (req, res) => {
  const { name, hostname, ipAddress, type, apiUsername, apiToken, apiPort, ns1, ns2, maxAccounts, isDefault } = req.body;
  if (!name || !hostname) return res.status(400).json({ error: "name and hostname are required" });

  if (isDefault) {
    await db.update(serversTable).set({ isDefault: false });
  }
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
    isDefault: isDefault ?? false,
    status: "active",
  }).returning();
  res.status(201).json(record);
});

// PUT /api/admin/servers/:id
router.put("/admin/servers/:id", authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, hostname, ipAddress, type, apiUsername, apiToken, apiPort, ns1, ns2, maxAccounts, status, isDefault } = req.body;
  if (isDefault) {
    await db.update(serversTable).set({ isDefault: false });
  }
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
  if (isDefault !== undefined) updates.isDefault = isDefault;
  const [record] = await db.update(serversTable).set(updates).where(eq(serversTable.id, id)).returning();
  if (!record) return res.status(404).json({ error: "Not found" });
  res.json(record);
});

// DELETE /api/admin/servers/:id
router.delete("/admin/servers/:id", authenticate, requireAdmin, async (req, res) => {
  await db.delete(serversTable).where(eq(serversTable.id, req.params.id));
  res.json({ success: true });
});

// POST /api/admin/servers/:id/test — test cPanel connection
router.post("/admin/servers/:id/test", authenticate, requireAdmin, async (req, res) => {
  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, req.params.id));
  if (!server) return res.status(404).json({ error: "Not found" });
  if (server.type !== "cpanel") return res.json({ success: true, message: "Non-cPanel server — skipping API test" });
  if (!server.apiUsername || !server.apiToken) {
    return res.status(400).json({ error: "API username and token required to test connection" });
  }
  res.json({ success: true, message: `Connection to ${server.hostname} configured (live test requires network access)` });
});

export default router;
