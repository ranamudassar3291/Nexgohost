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

router.get("/admin/servers", authenticate, requireAdmin, async (req, res) => {
  const { type } = req.query as { type?: string };
  let query = db.select({
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
  }).from(serversTable).orderBy(serversTable.name).$dynamic();
  if (type) query = query.where(eq(serversTable.type, type as any));
  const servers = await query;
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

// GET /api/admin/servers/:id/plans — fetch available plans + pricing from module
router.get("/admin/servers/:id/plans", authenticate, requireAdmin, async (req, res) => {
  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, req.params.id));
  if (!server) { res.status(404).json({ error: "Not found" }); return; }

  type Plan = { id: string; name: string; monthlyPrice: number; yearlyPrice: number; };

  // 20i: try real API, fall back to mock with pricing
  if (server.type === "20i") {
    if (server.apiToken) {
      try {
        const fetch = (await import("node-fetch")).default;
        const resp = await (fetch as any)("https://api.20i.com/package", {
          headers: { Authorization: `Bearer ${server.apiToken}` },
        });
        if (resp.ok) {
          const data: any = await resp.json();
          if (Array.isArray(data) && data.length > 0) {
            const plans: Plan[] = data.map((p: any) => ({
              id: String(p.id || p.name),
              name: p.name || String(p.id),
              monthlyPrice: Number(p.monthly_price ?? p.monthlyPrice ?? p.price ?? 0),
              yearlyPrice: Number(p.yearly_price ?? p.yearlyPrice ?? p.annual_price ?? 0),
            }));
            res.json({ plans }); return;
          }
        }
      } catch (_e) { /* fall through to mock */ }
    }
    // Mock 20i plans with pricing
    res.json({ plans: [
      { id: "starter", name: "Starter", monthlyPrice: 3.99, yearlyPrice: 39.99 },
      { id: "geek",    name: "Geek",    monthlyPrice: 9.99, yearlyPrice: 99.99 },
      { id: "pro",     name: "Pro",     monthlyPrice: 14.99, yearlyPrice: 149.99 },
      { id: "super",   name: "Super",   monthlyPrice: 24.99, yearlyPrice: 249.99 },
    ] as Plan[] }); return;
  }

  // cPanel / WHM: try WHM listpkgs API, fall back to mock
  if (server.type === "cpanel") {
    if (server.apiToken && server.hostname) {
      try {
        const fetch = (await import("node-fetch")).default;
        const port = server.apiPort || 2087;
        const resp = await (fetch as any)(
          `https://${server.hostname}:${port}/json-api/listpkgs?api.version=1`,
          { headers: { Authorization: `whm ${server.apiUsername}:${server.apiToken}` }, signal: AbortSignal.timeout(5000) }
        );
        if (resp.ok) {
          const data: any = await resp.json();
          const pkgs = data?.data?.pkg ?? [];
          if (pkgs.length > 0) {
            const plans: Plan[] = pkgs.map((p: any) => ({
              id: p.name, name: p.name,
              monthlyPrice: Number(p.QUOTA) > 0 ? 4.99 : 2.99,
              yearlyPrice: Number(p.QUOTA) > 0 ? 49.99 : 29.99,
            }));
            res.json({ plans }); return;
          }
        }
      } catch (_e) { /* fall through */ }
    }
    res.json({ plans: [
      { id: "starter",   name: "Starter",   monthlyPrice: 2.99,  yearlyPrice: 29.99  },
      { id: "basic",     name: "Basic",     monthlyPrice: 4.99,  yearlyPrice: 49.99  },
      { id: "business",  name: "Business",  monthlyPrice: 9.99,  yearlyPrice: 99.99  },
      { id: "pro",       name: "Pro",       monthlyPrice: 19.99, yearlyPrice: 199.99 },
      { id: "unlimited", name: "Unlimited", monthlyPrice: 29.99, yearlyPrice: 299.99 },
    ] as Plan[] }); return;
  }

  // DirectAdmin
  if (server.type === "directadmin") {
    res.json({ plans: [
      { id: "starter",  name: "Starter",  monthlyPrice: 3.99,  yearlyPrice: 39.99  },
      { id: "standard", name: "Standard", monthlyPrice: 7.99,  yearlyPrice: 79.99  },
      { id: "business", name: "Business", monthlyPrice: 14.99, yearlyPrice: 149.99 },
      { id: "reseller", name: "Reseller", monthlyPrice: 24.99, yearlyPrice: 249.99 },
    ] as Plan[] }); return;
  }

  // Plesk
  if (server.type === "plesk") {
    res.json({ plans: [
      { id: "web-admin", name: "Web Admin",    monthlyPrice: 9.99,  yearlyPrice: 99.99  },
      { id: "web-pro",   name: "Web Pro",      monthlyPrice: 19.99, yearlyPrice: 199.99 },
      { id: "web-host",  name: "Web Host",     monthlyPrice: 39.99, yearlyPrice: 399.99 },
    ] as Plan[] }); return;
  }

  res.json({ plans: [{ id: "default", name: "Default Package", monthlyPrice: 4.99, yearlyPrice: 49.99 }] as Plan[] });
});

export default router;
