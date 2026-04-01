import { Router } from "express";
import https from "node:https";
import { db } from "@workspace/db";
import { serversTable, serverGroupsTable, hostingServicesTable } from "@workspace/db/schema";
import { authenticate, requireAdmin } from "../lib/auth.js";
import { eq, sql, and } from "drizzle-orm";
import { cpanelTestConnection, cpanelTestPermissions, cpanelCsfWhitelistIp } from "../lib/cpanel.js";
import { twentyiTestConnection, twentyiGetPackages, twentyiRawDebug, runWithProxy, sanitiseKey, getOutboundIp, getProxyConfig } from "../lib/twenty-i.js";

/** HTTPS GET with self-signed cert bypass — needed for WHM servers */
function whmGet(url: string, authHeader: string, timeoutMs = 10000): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { Authorization: authHeader },
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

  // Count active accounts per server for capacity monitoring
  const countRows = await db
    .select({
      serverId: hostingServicesTable.serverId,
      cnt: sql<number>`cast(count(*) as int)`,
    })
    .from(hostingServicesTable)
    .where(
      and(
        sql`${hostingServicesTable.serverId} IS NOT NULL`,
        sql`${hostingServicesTable.status} NOT IN ('terminated')`,
      )
    )
    .groupBy(hostingServicesTable.serverId);

  const accountCounts: Record<string, number> = {};
  for (const row of countRows) {
    if (row.serverId) accountCounts[row.serverId] = Number(row.cnt);
  }

  // Return hasApiToken flag without exposing the actual token value; include live account count
  const safeServers = servers.map(({ apiToken, ...s }) => ({
    ...s,
    hasApiToken: !!apiToken,
    accountCount: accountCounts[s.id] ?? 0,
  }));
  res.json(safeServers);
});

// GET /api/admin/servers/outbound-ip — returns current outbound IP (through proxy if configured)
// IMPORTANT: must be defined BEFORE the /:id wildcard route
router.get("/admin/servers/outbound-ip", authenticate, requireAdmin, async (_req, res) => {
  try {
    const [ip, proxy] = await Promise.all([getOutboundIp(), Promise.resolve(getProxyConfig())]);
    res.json({ ip, proxy });
  } catch (e: any) {
    res.json({ ip: "unknown", proxy: getProxyConfig() });
  }
});

// GET /api/admin/servers/proxy-config — proxy status without triggering an IP lookup
router.get("/admin/servers/proxy-config", authenticate, requireAdmin, (_req, res) => {
  res.json(getProxyConfig());
});

router.get("/admin/servers/:id", authenticate, requireAdmin, async (req, res) => {
  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, req.params.id));
  if (!server) { res.status(404).json({ error: "Not found" }); return; }
  res.json(server);
});

// POST /api/admin/servers/test-api-key — pre-save credential test with full debug info
router.post("/admin/servers/test-api-key", authenticate, requireAdmin, async (req, res) => {
  const { apiKey, type, proxyUrl } = req.body;
  if (!apiKey) { res.status(400).json({ error: "apiKey is required" }); return; }
  if (type === "20i") {
    const runTest = async () => {
      // Raw debug info — always collected
      const debug = await twentyiRawDebug(apiKey);
      const result = await twentyiTestConnection(apiKey);
      if (!result.success) {
        return res.json({ success: false, message: result.message, diagnostic: result.diagnostic ?? null, packages: [], debug });
      }
      let pkgs: any[] = [];
      try { pkgs = await twentyiGetPackages(apiKey); } catch { /* empty */ }
      return res.json({ success: true, message: result.message, diagnostic: result.diagnostic ?? null, packages: pkgs, debug });
    };
    // Run with optional per-request proxy override
    if (proxyUrl !== undefined) {
      await runWithProxy(proxyUrl || undefined, runTest);
    } else {
      await runTest();
    }
    return;
  }
  res.status(400).json({ error: "Pre-save testing is only supported for 20i servers" });
});

router.post("/admin/servers", authenticate, requireAdmin, async (req, res) => {
  const { name, hostname, ipAddress, type, apiUsername, apiToken, apiPort, ns1, ns2, maxAccounts, groupId, isDefault, skipTest } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  if (type !== "20i" && !hostname) { res.status(400).json({ error: "hostname is required" }); return; }

  const cleanToken = apiToken ? sanitiseKey(apiToken) : null;

  // ── Step 1: Test API before saving (20i only) ─────────────────────────────
  if (type === "20i" && cleanToken && !skipTest) {
    console.log(`[ADD-SERVER] Testing 20i API before saving — key_len=${cleanToken.length}  last4=${cleanToken.slice(-4)}`);
    try {
      const testResult = await twentyiTestConnection(cleanToken);
      console.log(`[ADD-SERVER] Test result: success=${testResult.success}  message=${testResult.message}`);
      if (!testResult.success) {
        res.status(400).json({
          error: testResult.message,
          diagnostic: testResult.diagnostic ?? null,
          hint: testResult.diagnostic?.detail ?? "Check your API key and ensure this server's IP is whitelisted at my.20i.com → Reseller API → IP Whitelist.",
          success: false,
        });
        return;
      }
    } catch (err: any) {
      console.error(`[ADD-SERVER] Pre-save test threw: ${err.message}`);
      res.status(400).json({
        error: err.message,
        hint: "The API key test failed. Verify the key and IP whitelist at my.20i.com → Reseller API.",
        success: false,
      });
      return;
    }
  }

  // ── Step 2: Save to database ───────────────────────────────────────────────
  if (isDefault) { await db.update(serversTable).set({ isDefault: false }); }
  const resolvedHostname = (type === "20i") ? "api.20i.com" : hostname;

  const [record] = await db.insert(serversTable).values({
    name,
    hostname: resolvedHostname,
    ipAddress: ipAddress || null,
    type: type || "cpanel",
    apiUsername: (type === "20i") ? null : (apiUsername || null),
    apiToken: cleanToken,
    apiPort: (type === "20i") ? null : (apiPort ? parseInt(apiPort) : 2087),
    ns1: ns1 || null,
    ns2: ns2 || null,
    maxAccounts: maxAccounts ? parseInt(maxAccounts) : 500,
    groupId: groupId || null,
    isDefault: isDefault ?? false,
    status: "active",
  }).returning();

  console.log(`[ADD-SERVER] ✓ Saved server id=${record.id}  name=${record.name}  type=${record.type}`);
  res.status(201).json({ ...record, success: true, message: type === "20i" ? "Connected Successfully" : "Server added" });
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
  // Only overwrite the stored token when a non-empty value is provided.
  // Also sanitise — strips hidden/zero-width chars that break Bearer auth.
  if (apiToken !== undefined && apiToken !== "") updates.apiToken = sanitiseKey(apiToken);
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
    // Test basic connection first (fast)
    const result = await cpanelTestConnection(serverCfg);
    if (!result.success) {
      res.status(400).json({ error: result.message, success: false });
      return;
    }
    // Run permission diagnostics + CSF whitelist in parallel (both non-destructive)
    let permissions: { name: string; api: string; ok: boolean; reason: string }[] = [];
    let csfMessage = "";
    try {
      // Detect the outbound IP of this API server so CSF can whitelist it
      const serverIp: string = await new Promise((resolve) => {
        const req = https.get({ hostname: "api.ipify.org", path: "/?format=json", rejectUnauthorized: false }, (resp) => {
          let d = "";
          resp.on("data", c => d += c);
          resp.on("end", () => {
            try { resolve(JSON.parse(d).ip ?? ""); } catch { resolve(""); }
          });
        });
        req.on("error", () => resolve(""));
        req.setTimeout(5000, () => { req.destroy(); resolve(""); });
      });

      const [permResult, csfResult] = await Promise.all([
        cpanelTestPermissions(serverCfg),
        serverIp
          ? cpanelCsfWhitelistIp(serverCfg, serverIp)
          : Promise.resolve({ ok: true, message: "Could not detect outbound IP for CSF whitelist." }),
      ]);
      permissions = permResult.results;
      csfMessage = csfResult.message;
      console.log(`[SERVERS] Permission test for ${server.hostname}: ${permResult.results.filter(r => r.ok).length}/${permResult.results.length} OK`);
      console.log(`[SERVERS] CSF whitelist for ${server.hostname} (IP: ${serverIp || "unknown"}): ${csfMessage}`);
    } catch (e: any) {
      console.warn(`[SERVERS] Permission/CSF test error: ${e.message}`);
    }
    res.json({
      success: true,
      connected: true,
      message: result.message,
      packages: result.packages,
      permissions,
      csfWhitelist: csfMessage,
    });
    return;
  }

  if (server.type === "20i") {
    const effectiveKey = server.apiToken;
    if (!effectiveKey) {
      res.json({ success: false, connected: false, message: "No 20i API key found. Edit this server to add the API key.", packages: [] });
      return;
    }
    const result = await twentyiTestConnection(effectiveKey);
    if (!result.success) {
      res.json({ success: false, connected: false, message: result.message, diagnostic: result.diagnostic ?? null, packages: [] });
      return;
    }
    let pkgs: any[] = [];
    try { pkgs = await twentyiGetPackages(effectiveKey); } catch { /* ignore */ }
    res.json({ success: true, connected: true, message: result.message, diagnostic: result.diagnostic ?? null, packages: pkgs });
    return;
  }

  res.json({ success: true, message: `${server.type} server at ${server.hostname}:${server.apiPort} is configured`, packages: [], connected: true });
});

// GET /api/admin/servers/:id/plans — fetch available plans + pricing from module
router.get("/admin/servers/:id/plans", authenticate, requireAdmin, async (req, res) => {
  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, req.params.id));
  if (!server) { res.status(404).json({ error: "Not found" }); return; }

  type Plan = { id: string; name: string; monthlyPrice: number; yearlyPrice: number; };

  // 20i: fetch real packages from reseller API
  if (server.type === "20i") {
    const resolvedKey = server.apiToken;
    if (!resolvedKey) {
      res.json({ plans: [], error: "No API key configured for this 20i server" });
      return;
    }
    try {
      const pkgs = await twentyiGetPackages(resolvedKey);
      if (pkgs.length > 0) {
        const plans: Plan[] = pkgs.map(p => ({
          id: p.id,
          name: p.label,
          monthlyPrice: 0,
          yearlyPrice: 0,
        }));
        res.json({ plans, from20i: true }); return;
      }
      // No packages returned — return empty with info
      res.json({ plans: [], from20i: true, error: "No packages found on this 20i account — create packages in your 20i reseller portal first" });
    } catch (err: any) {
      res.json({ plans: [], from20i: false, error: `20i API error: ${err.message}` });
    }
    return;
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

// ─── POST /admin/servers/:id/whitelist-self — Add this API server's IP to CSF/WHM allowlist ───
// Detects the outbound IP used when reaching the WHM server, then attempts to add it to
// the server's CSF firewall whitelist via WHM's csf_whitelist API.
// Falls back to returning the IP with manual instructions if CSF API is unavailable.
router.post("/admin/servers/:id/whitelist-self", authenticate, requireAdmin, async (req, res) => {
  try {
    const [server] = await db.select().from(serversTable).where(eq(serversTable.id, req.params.id)).limit(1);
    if (!server) return res.status(404).json({ error: "Server not found" });
    if (!server.apiToken) return res.status(400).json({ error: "Server has no API token configured" });
    if (server.type !== "cpanel" && server.type !== "whm") {
      return res.status(400).json({ error: "Firewall whitelist only supported for cPanel/WHM servers" });
    }

    const authUser = server.username || "root";
    const port = server.port || 2087;
    const authHeader = `whm ${authUser}:${server.apiToken}`;

    // Step 1: Detect our outbound IP by asking an external IP service
    let myIp: string | null = null;
    try {
      const ipResp = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(5000) });
      const ipData: any = await ipResp.json();
      myIp = ipData?.ip || null;
    } catch {
      // Try alternative
      try {
        const ipResp2 = await fetch("https://api4.my-ip.io/ip.json", { signal: AbortSignal.timeout(5000) });
        const ipData2: any = await ipResp2.json();
        myIp = ipData2?.ip || null;
      } catch { /* ignore */ }
    }

    if (!myIp) {
      return res.json({
        success: false,
        message: "Could not detect API server IP automatically. Please add manually.",
        manualInstructions: "In WHM → Plugins → ConfigServer Security & Firewall → Quick Allow, add the API server's outbound IP.",
      });
    }

    // Step 2: Try WHM's CSF plugin whitelist API
    let whitelisted = false;
    let csfMethod = "";
    try {
      const csfUrl = `https://${server.hostname}:${port}/cgi-bin/addon_csf.cgi?action=whitelist&ip=${encodeURIComponent(myIp)}&dir=in&comment=Noehost+API+Server&submit=Quick+Allow`;
      const data = await whmGet(csfUrl, authHeader, 10_000);
      // CSF CGI returns HTML, check for success indicators
      const body = JSON.stringify(data);
      if (!body.includes("Error") && !body.includes("error")) {
        whitelisted = true;
        csfMethod = "csf_cgi";
      }
    } catch { /* CSF not available */ }

    // Step 3: Try WHM IP Allow API as fallback
    if (!whitelisted) {
      try {
        const allowUrl = `https://${server.hostname}:${port}/json-api/set_enforced_host_access?api.version=1&host=${encodeURIComponent(myIp)}&access=allow`;
        await whmGet(allowUrl, authHeader, 10_000);
        whitelisted = true;
        csfMethod = "whm_host_access";
      } catch { /* not available */ }
    }

    console.log(`[WHITELIST] Server ${server.hostname}: IP=${myIp}, whitelisted=${whitelisted}, method=${csfMethod}`);

    res.json({
      success: whitelisted,
      ip: myIp,
      method: whitelisted ? csfMethod : "none",
      message: whitelisted
        ? `API server IP ${myIp} has been added to the firewall allowlist on ${server.hostname}.`
        : `Detected API server IP: ${myIp}. Please add it manually to the CSF whitelist on ${server.hostname}.`,
      manualInstructions: whitelisted ? null
        : `In WHM → Plugins → ConfigServer Security & Firewall → Quick Allow, add: ${myIp}`,
    });
  } catch (err: any) {
    console.error("[WHITELIST] error:", err.message);
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ─── GET /admin/servers/:id/api-server-ip — Detect the outbound IP of the API server ───
router.get("/admin/servers/:id/api-server-ip", authenticate, requireAdmin, async (req, res) => {
  try {
    let myIp: string | null = null;
    try {
      const ipResp = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(5000) });
      const ipData: any = await ipResp.json();
      myIp = ipData?.ip || null;
    } catch { /* ignore */ }

    res.json({ ip: myIp });
  } catch (err: any) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── POST /admin/servers/:id/verify ───────────────────────────────────────────
// Calls WHM /json-api/listaccts to confirm credentials work, then fetches server
// disk / hostname / IP info via /json-api/gethostinginfoapi.
// On success, marks server status = 'active' in DB.
router.post("/admin/servers/:id/verify", authenticate, requireAdmin, async (req, res) => {
  try {
    const [server] = await db.select().from(serversTable).where(eq(serversTable.id, req.params.id)).limit(1);
    if (!server) return res.status(404).json({ error: "Server not found" });
    if (!server.apiToken) return res.status(400).json({ error: "No API token — save a token first" });

    const port = server.apiPort || 2087;
    const authUser = server.apiUsername || "root";
    const authHeader = `whm ${authUser}:${server.apiToken}`;
    const base = `https://${server.hostname}:${port}`;

    // ── Step 1: listaccts — proves credentials work ──────────────────────────
    let accounts: { user: string; domain: string }[] = [];
    try {
      const data: any = await whmGet(`${base}/json-api/listaccts?api.version=1`, authHeader, 15000);
      const accts: any[] = data?.data?.acct ?? data?.acct ?? [];
      accounts = accts.map((a: any) => ({ user: a.user || a.login, domain: a.domain }));
    } catch (err: any) {
      return res.status(400).json({ success: false, connected: false, error: err.message });
    }

    // ── Step 2: gethostinginfoapi — disk + hostname ──────────────────────────
    let diskUsedMB = 0;
    let diskFreeMB = 0;
    let diskTotalMB = 0;
    let resolvedHostname = server.hostname;
    let resolvedIp = server.ipAddress || "";

    try {
      const info: any = await whmGet(`${base}/json-api/gethostinginfoapi?api.version=1`, authHeader, 10000);
      const d = info?.data ?? info;

      // Hostname
      if (d?.hostname) resolvedHostname = d.hostname;

      // Disk: WHM returns bytes or blocks (1 block = 1024 bytes on most systems)
      const rawUsed  = Number(d?.diskused  ?? d?.disk_used  ?? 0);
      const rawFree  = Number(d?.diskfree  ?? d?.disk_free  ?? 0);
      const rawTotal = Number(d?.disktotal ?? d?.disk_total ?? 0);

      // Values > 1_000_000 are likely bytes; smaller values are likely MB already
      const toMB = (v: number) => v > 1_048_576 ? Math.round(v / 1024 / 1024) : Math.round(v);
      diskUsedMB  = toMB(rawUsed);
      diskFreeMB  = toMB(rawFree);
      diskTotalMB = toMB(rawTotal) || diskUsedMB + diskFreeMB;
    } catch { /* non-critical — ignore */ }

    // ── Step 3: Resolve IP from hostname if not stored ───────────────────────
    if (!resolvedIp) {
      try {
        const { default: dns } = await import("node:dns/promises");
        const addrs = await dns.lookup(resolvedHostname, { family: 4 });
        resolvedIp = addrs.address;
      } catch { /* ignore */ }
    }

    // ── Step 4: Update server in DB — mark active, store resolved IP/hostname ─
    await db.update(serversTable).set({
      status: "active",
      ...(resolvedIp && !server.ipAddress ? { ipAddress: resolvedIp } : {}),
      updatedAt: new Date(),
    }).where(eq(serversTable.id, server.id));

    console.log(`[VERIFY] Server ${server.hostname}: connected, ${accounts.length} accounts, disk ${diskUsedMB}/${diskTotalMB} MB`);

    res.json({
      success: true,
      connected: true,
      hostname: resolvedHostname,
      ipAddress: resolvedIp,
      accountCount: accounts.length,
      accounts: accounts.slice(0, 20),  // first 20 only
      diskUsedMB,
      diskFreeMB,
      diskTotalMB,
      message: `Connected — ${accounts.length} account(s) on ${resolvedHostname}`,
    });
  } catch (err: any) {
    console.error("[VERIFY] error:", err.message);
    res.status(500).json({ success: false, connected: false, error: err.message });
  }
});

// ─── POST /admin/servers/:id/reset-credentials ────────────────────────────────
// Clears the stored API token and marks the server inactive so a fresh token
// can be entered without stale-credential conflicts.
router.post("/admin/servers/:id/reset-credentials", authenticate, requireAdmin, async (req, res) => {
  try {
    const [server] = await db.select().from(serversTable).where(eq(serversTable.id, req.params.id)).limit(1);
    if (!server) return res.status(404).json({ error: "Server not found" });

    await db.update(serversTable).set({
      apiToken: null,
      status: "inactive",
      updatedAt: new Date(),
    }).where(eq(serversTable.id, server.id));

    console.log(`[RESET] Cleared API token for server ${server.name} (${server.hostname})`);
    res.json({ success: true, message: "Credentials cleared. Enter a new API token and save." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
