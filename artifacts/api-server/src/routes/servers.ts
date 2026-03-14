import { Router } from "express";
import https from "node:https";
import { db } from "@workspace/db";
import { serversTable, serverGroupsTable } from "@workspace/db/schema";
import { authenticate, requireAdmin } from "../lib/auth.js";
import { eq } from "drizzle-orm";
import { cpanelTestConnection } from "../lib/cpanel.js";

/** HTTPS GET with self-signed cert bypass — needed for WHM servers */
function whmGet(url: string, authHeader: string, timeoutMs = 10000): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      rejectUnauthorized: false,
      timeout: timeoutMs,
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString();
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`WHM HTTP ${res.statusCode}: ${body.substring(0, 200)}`));
          return;
        }
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error(`Non-JSON from WHM: ${body.substring(0, 200)}`)); }
      });
    });
    req.on("timeout", () => { req.destroy(); reject(new Error("WHM timed out")); });
    req.on("error", (e) => reject(new Error(`WHM connection failed: ${e.message}`)));
  });
}

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
    apiToken: serversTable.apiToken,   // needed for hasApiToken check below
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
  // Return hasApiToken flag without exposing the actual token value
  const safeServers = servers.map(({ apiToken, ...s }) => ({ ...s, hasApiToken: !!apiToken }));
  res.json(safeServers);
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
  if (apiUsername !== undefined) updates.apiUsername = apiUsername || null;
  // Only overwrite the stored token when a non-empty value is provided
  // (empty string means "keep existing token" — prevents accidental wipe)
  if (apiToken !== undefined && apiToken !== "") updates.apiToken = apiToken;
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

// POST /api/admin/servers/:id/test — test module connection and fetch package list
router.post("/admin/servers/:id/test", authenticate, requireAdmin, async (req, res) => {
  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, req.params.id));
  if (!server) { res.status(404).json({ error: "Not found" }); return; }
  if (!server.apiToken) {
    res.status(400).json({ error: "API token is required — enter it in the server configuration and save first" }); return;
  }

  const serverCfg = {
    hostname: server.hostname,
    port: server.apiPort || 2087,
    username: server.apiUsername || "root",   // WHM API token auth uses root by default
    apiToken: server.apiToken,
  };

  if (server.type === "cpanel") {
    // Single listpkgs call — tests credentials AND fetches packages simultaneously
    const result = await cpanelTestConnection(serverCfg);
    if (!result.success) {
      res.status(400).json({ error: result.message, success: false });
      return;
    }
    res.json({
      success: true,
      connected: true,
      message: result.message,
      packages: result.packages,
    });
    return;
  }

  if (server.type === "20i") {
    res.json({ success: true, message: `20i API credentials saved for ${server.hostname}`, packages: [], connected: true });
    return;
  }

  res.json({ success: true, message: `${server.type} server at ${server.hostname}:${server.apiPort} is configured`, packages: [], connected: true });
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
        const resp = await fetch("https://api.20i.com/package", {
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

  // cPanel / WHM: fetch packages directly from WHM — NO mock fallback
  if (server.type === "cpanel") {
    if (!server.apiToken || !server.hostname) {
      res.json({ plans: [], fromWHM: false, error: "WHM API credentials not configured for this server" });
      return;
    }
    try {
      const port = server.apiPort || 2087;
      const url = `https://${server.hostname}:${port}/json-api/listpkgs?api.version=1`;
      const authUser = server.apiUsername || "root";
      const data: any = await whmGet(url, `whm ${authUser}:${server.apiToken}`);
      const pkgs: any[] = data?.data?.pkg ?? data?.pkg ?? [];
      if (pkgs.length === 0) {
        res.json({ plans: [], fromWHM: true, error: "No WHM packages found on this server — create packages in WHM first" });
        return;
      }
      // WHM packages have no pricing — price comes from billing panel
      const plans: Plan[] = pkgs.map((p: any) => ({
        id: p.name,
        name: p.name,
        monthlyPrice: 0,
        yearlyPrice: 0,
      }));
      res.json({ plans, fromWHM: true, error: null });
    } catch (err: any) {
      const msg = err.message?.includes("fetch") || err.code === "ECONNREFUSED"
        ? `Cannot connect to WHM at ${server.hostname}:${server.apiPort || 2087}`
        : `WHM Package Not Found: ${err.message}`;
      res.json({ plans: [], fromWHM: false, error: msg });
    }
    return;
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
