/**
 * Admin routes for 20i Master Center
 * All routes require admin authentication.
 */
import { Router } from "express";
import { authenticate, requireAdmin, hashPassword, type AuthRequest } from "../lib/auth.js";
import { db } from "@workspace/db";
import { serversTable, hostingServicesTable, usersTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  twentyiListStackUsers,
  twentyiCreateStackUser,
  twentyiDeleteStackUser,
  twentyiSetStackUserPassword,
  twentyiGetOrCreateStackUser,
  twentyiListSites,
  twentyiGetPackages,
  twentyiCreateHosting,
  twentyiSuspend,
  twentyiUnsuspend,
  twentyiDelete,
  twentyiAssignSiteToUser,
  twentyiGetSSOUrl,
  twentyiStartMigration,
  twentyiListMigrations,
  twentyiGetMigrationStatus,
  twentyiListTickets,
  twentyiGetTicket,
  twentyiCreateTicket,
  twentyiReplyTicket,
  runWithProxy,
  twentyiRawDebug,
  getOutboundIp,
  getProxyConfig,
  twentyiGetWhitelist,
  twentyiAddToWhitelist,
  twentyiAutoWhitelist,
  twentyiGetSiteRenewalDate,
} from "../lib/twenty-i.js";

const router = Router();

// ─── Helper: get 20i server ───────────────────────────────────────────────────

// Get the active 20i server record from the database.
// If serverId is provided, fetch that specific server.
// Otherwise fall back to the most recently created active 20i server.
async function get20iServer(serverId?: string | null) {
  if (serverId) {
    const [server] = await db
      .select()
      .from(serversTable)
      .where(and(eq(serversTable.id, serverId), eq(serversTable.type, "20i")))
      .limit(1);
    return server ?? null;
  }
  const [server] = await db
    .select()
    .from(serversTable)
    .where(and(eq(serversTable.type, "20i"), eq(serversTable.status, "active")))
    .orderBy(desc(serversTable.updatedAt))
    .limit(1);
  return server ?? null;
}

// Get the 20i API key from the active server record.
async function get20iApiKey(serverId?: string | null): Promise<{ key: string | null; source: "server" | "none" }> {
  const server = await get20iServer(serverId);
  if (server?.apiToken) {
    const key = server.apiToken.trim();
    console.log(`[20i-KEY] Using key from server "${server.name}" (${key.length} chars, last4: ${key.slice(-4)})`);
    return { key, source: "server" };
  }
  console.warn("[20i-KEY] No 20i API key found. Add it in Admin -> Servers.");
  return { key: null, source: "none" };
}

function requireApiKey(server: any, res: any): boolean {
  if (!server) { res.status(400).json({ error: "No active 20i server configured. Add one in Admin → Servers." }); return false; }
  if (!server.apiToken) { res.status(400).json({ error: "20i API key missing. Edit the server in Admin → Servers to add the API key." }); return false; }
  return true;
}

/**
 * Run `fn` for a 20i server.
 * Proxy is controlled exclusively via the TWENTYI_PROXY env var — the
 * per-server ipAddress field is no longer used as a proxy override.
 */
async function runWith20i<T>(_server: any, fn: () => Promise<T>): Promise<T> {
  return fn();
}

// ─── Server info ──────────────────────────────────────────────────────────────

// List all active 20i servers so the admin can switch between them
router.get("/admin/twenty-i/servers", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const servers = await db
      .select()
      .from(serversTable)
      .where(and(eq(serversTable.type, "20i"), eq(serversTable.status, "active")))
      .orderBy(desc(serversTable.updatedAt));
    res.json(servers.map(s => ({
      id: s.id,
      name: s.name,
      hasApiToken: !!s.apiToken,
      apiTokenMasked: s.apiToken ? `••••${s.apiToken.slice(-6)}` : null,
      ns1: s.ns1 ?? "ns1.20i.com",
      ns2: s.ns2 ?? "ns2.20i.com",
    })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/admin/twenty-i/server", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const serverId = req.query.serverId as string | undefined;
    const server = await get20iServer(serverId);
    if (!server) return res.json({ connected: false, error: "No active 20i server configured." });
    res.json({
      connected: true,
      id: server.id,
      name: server.name,
      hasApiToken: !!server.apiToken,
      apiTokenMasked: server.apiToken ? `••••${server.apiToken.slice(-6)}` : null,
      ns1: server.ns1 ?? "ns1.20i.com",
      ns2: server.ns2 ?? "ns2.20i.com",
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Direct diagnostic (no UI cache — tests saved key against live 20i API) ──

router.get("/admin/twenty-i/diagnostic", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { key, source } = await get20iApiKey();
    if (!key) {
      return res.json({
        ok: false,
        error: "no_key",
        message: "No 20i API key found. Add it in Admin -> Servers (type: 20i).",
      });
    }

    console.log(`[20i-DIAGNOSTIC] Key source: ${source}`);
    const [debug, ip, proxy] = await Promise.all([
      twentyiRawDebug(key),
      getOutboundIp(),
      Promise.resolve(getProxyConfig()),
    ]);

    // Full verbose log — visible in workflow logs immediately
    console.log("=".repeat(60));
    console.log("[20i-RAW-DIAGNOSTIC] ▶ Starting raw 20i API test");
    console.log(`[20i-RAW-DIAGNOSTIC] Outbound IP  : ${debug.outboundIp}`);
    console.log(`[20i-RAW-DIAGNOSTIC] Proxy        : ${proxy.enabled ? proxy.url : "none (direct)"}`);
    console.log(`[20i-RAW-DIAGNOSTIC] Key length   : ${debug.keyLength} chars`);
    console.log(`[20i-RAW-DIAGNOSTIC] Key (masked) : ${debug.authFormat}`);
    console.log(`[20i-RAW-DIAGNOSTIC] Key first4   : ${debug.keyFirst4}  last4: ${debug.keyLast4}`);
    console.log(`[20i-RAW-DIAGNOSTIC] Hidden chars : ${debug.keyHasHiddenChars}`);
    for (const attempt of debug.attempts) {
      console.log(`[20i-RAW-DIAGNOSTIC] ── Format: ${attempt.format} ──`);
      console.log(`[20i-RAW-DIAGNOSTIC]    Auth header  : ${attempt.authHeaderPreview}`);
      console.log(`[20i-RAW-DIAGNOSTIC]    HTTP status  : ${attempt.status}`);
      console.log(`[20i-RAW-DIAGNOSTIC]    Duration     : ${attempt.durationMs}ms`);
      console.log(`[20i-RAW-DIAGNOSTIC]    Raw response : ${attempt.body}`);
    }
    console.log(`[20i-RAW-DIAGNOSTIC] ✔ Working format: ${debug.workingFormat}`);
    console.log("=".repeat(60));

    return res.json({
      ok: debug.responseStatus === 200,
      keySource: source,
      outboundIp: ip,
      proxy,
      debug,
      hint: debug.responseStatus === 401
        ? `Whitelist ${debug.outboundIp} in my.20i.com → Reseller API → IP Whitelist, then retry.`
        : undefined,
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: "exception", message: e.message });
  }
});

// ─── IP Whitelist ─────────────────────────────────────────────────────────────

/**
 * GET /admin/twenty-i/whitelist
 * Returns current outbound IP + current 20i whitelist entries.
 * Works even if NOT whitelisted (outbound IP from ipify.org is always available).
 */
router.get("/admin/twenty-i/whitelist", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const server = await get20iServer(req.query?.serverId as string | undefined);
    const outboundIp = await getOutboundIp();
    const proxy = getProxyConfig();

    if (!server || !server.apiToken) {
      return res.json({ outboundIp, proxy, currentList: [], serverConfigured: false });
    }

    let currentList: string[] = [];
    let fetchError: string | null = null;
    try {
      currentList = await runWith20i(server, () => twentyiGetWhitelist(server!.apiToken!));
    } catch (e: any) {
      fetchError = e.message; // Will be 401 if IP not yet whitelisted — that's ok
    }

    return res.json({
      outboundIp,
      proxy,
      currentList,
      fetchError,
      isWhitelisted: currentList.includes(outboundIp),
      serverConfigured: true,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

/**
 * POST /admin/twenty-i/whitelist/sync
 * Fetches the current outbound IP and attempts to add it to the 20i whitelist.
 * Returns { success, outboundIp } or { error: "chicken_and_egg", outboundIp } when auth fails.
 */
router.post("/admin/twenty-i/whitelist/sync", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const server = await get20iServer(req.query?.serverId as string | undefined);
    if (!server) return res.status(400).json({ error: "No active 20i server configured." });
    if (!server.apiToken) return res.status(400).json({ error: "20i API key missing." });

    const outboundIp = await getOutboundIp();
    const apiKey = server.apiToken;

    const wlResult = await runWith20i(server, () => twentyiAutoWhitelist(apiKey, outboundIp));

    if (wlResult.added) {
      console.log(`[20i-WHITELIST] ✓ Added ${outboundIp} to whitelist`);
      return res.json({ success: true, outboundIp });
    }

    if (wlResult.reason === "ip_blocked") {
      // Chicken-and-egg: 20i blocks all API calls including whitelist management until IP is added manually
      console.warn(`[20i-WHITELIST] ✗ IP ${outboundIp} must be whitelisted manually at my.20i.com first`);
      return res.json({
        success: false,
        error: "chicken_and_egg",
        outboundIp,
        message: `The 20i API requires your server IP to already be whitelisted. You must add ${outboundIp} manually once at my.20i.com → Reseller API → IP Whitelist. After that, this button will keep it up to date automatically.`,
      });
    }

    console.warn(`[20i-WHITELIST] ✗ Failed to add ${outboundIp}: ${wlResult.reason}`);
    return res.json({ success: false, error: wlResult.reason, outboundIp });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── StackUsers ───────────────────────────────────────────────────────────────

router.get("/admin/twenty-i/stack-users", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const server = await get20iServer(req.query?.serverId as string | undefined);
    if (!requireApiKey(server, res)) return;
    const users = await runWith20i(server, () => twentyiListStackUsers(server!.apiToken!));
    res.json(users);
  } catch (e: any) {
    console.warn(`[20i] stack-users fetch failed: ${e.message}`);
    res.json([]);
  }
});

router.post("/admin/twenty-i/stack-users", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { email, name } = req.body as { email?: string; name?: string };
    if (!email || !name) return res.status(400).json({ error: "email and name are required" });
    const server = await get20iServer(req.query?.serverId as string | undefined);
    if (!requireApiKey(server, res)) return;
    const user = await twentyiCreateStackUser(server!.apiToken!, email, name);
    res.json(user);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/admin/twenty-i/stack-users/:userId", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const server = await get20iServer(req.query?.serverId as string | undefined);
    if (!requireApiKey(server, res)) return;
    await twentyiDeleteStackUser(server!.apiToken!, req.params.userId);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Set or reset a StackUser's password
router.post("/admin/twenty-i/stack-users/:userId/reset-password", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { password } = req.body as { password?: string };
    if (!password || password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
    const server = await get20iServer(req.query?.serverId as string | undefined);
    if (!requireApiKey(server, res)) return;
    await twentyiSetStackUserPassword(server!.apiToken!, req.params.userId, password);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Create a StackUser on 20i and also create a panel client user with the same email/name
router.post("/admin/twenty-i/stack-users/with-panel-user", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { email, name, createPanelUser } = req.body as { email?: string; name?: string; createPanelUser?: boolean };
    if (!email || !name) return res.status(400).json({ error: "email and name are required" });
    const server = await get20iServer(req.query?.serverId as string | undefined);
    if (!requireApiKey(server, res)) return;

    const stackUser = await twentyiCreateStackUser(server!.apiToken!, email, name);

    let panelUserId: string | null = null;
    if (createPanelUser) {
      const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
      if (existing.length > 0) {
        panelUserId = existing[0].id;
      } else {
        const nameParts = name.trim().split(" ");
        const firstName = nameParts[0] ?? name;
        const lastName = nameParts.slice(1).join(" ") || "";
        const randomPass = Math.random().toString(36).slice(2, 14);
        const passwordHash = await hashPassword(randomPass);
        const [inserted] = await db.insert(usersTable).values({
          email,
          firstName,
          lastName,
          passwordHash,
          role: "client",
          status: "active",
        } as any).returning({ id: usersTable.id });
        panelUserId = inserted?.id ?? null;
      }
    }

    res.json({ ok: true, stackUser, panelUserId });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Hosting Sites ────────────────────────────────────────────────────────────

router.get("/admin/twenty-i/sites", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const server = await get20iServer(req.query?.serverId as string | undefined);
    if (!requireApiKey(server, res)) return;
    const sites = await runWith20i(server, () => twentyiListSites(server!.apiToken!));
    res.json(sites);
  } catch (e: any) {
    const msg: string = e.message ?? "";
    if (msg.includes("401") || msg.includes("Authentication failed") || msg.includes("403")) {
      return res.status(200).json({ error: "auth_failed", message: "20i API key is invalid or the server IP is not whitelisted. Verify your API key in Admin → Servers.", sites: [] });
    }
    res.status(500).json({ error: e.message });
  }
});

router.post("/admin/twenty-i/sites/:siteId/suspend", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const server = await get20iServer(req.query?.serverId as string | undefined);
    if (!requireApiKey(server, res)) return;
    await twentyiSuspend(server!.apiToken!, req.params.siteId);
    // Mirror in DB
    await db.update(hostingServicesTable)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(eq(hostingServicesTable.username, req.params.siteId));
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/admin/twenty-i/sites/:siteId/unsuspend", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const server = await get20iServer(req.query?.serverId as string | undefined);
    if (!requireApiKey(server, res)) return;
    await twentyiUnsuspend(server!.apiToken!, req.params.siteId);
    await db.update(hostingServicesTable)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(hostingServicesTable.username, req.params.siteId));
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/admin/twenty-i/sites/:siteId", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const server = await get20iServer(req.query?.serverId as string | undefined);
    if (!requireApiKey(server, res)) return;
    await twentyiDelete(server!.apiToken!, req.params.siteId);
    await db.update(hostingServicesTable)
      .set({ status: "terminated", updatedAt: new Date() })
      .where(eq(hostingServicesTable.username, req.params.siteId));
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/admin/twenty-i/sites/:siteId/assign", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { stackUserId } = req.body as { stackUserId?: string };
    if (!stackUserId) return res.status(400).json({ error: "stackUserId is required" });
    const server = await get20iServer(req.query?.serverId as string | undefined);
    if (!requireApiKey(server, res)) return;
    await twentyiAssignSiteToUser(server!.apiToken!, req.params.siteId, stackUserId);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/admin/twenty-i/sites/:siteId/sso", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const server = await get20iServer(req.query?.serverId as string | undefined);
    if (!requireApiKey(server, res)) return;
    const url = await twentyiGetSSOUrl(server!.apiToken!, req.params.siteId);
    res.json({ url });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Packages ─────────────────────────────────────────────────────────────────

router.get("/admin/twenty-i/packages", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const server = await get20iServer(req.query?.serverId as string | undefined);
    if (!requireApiKey(server, res)) return;
    const packages = await twentyiGetPackages(server!.apiToken!);
    res.json(packages);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Manual Provisioning ──────────────────────────────────────────────────────

router.post("/admin/twenty-i/provision", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { domain, packageId, clientId, stackUserId } = req.body as {
      domain?: string;
      packageId?: string;
      clientId?: string;
      stackUserId?: string;
    };
    if (!domain || !clientId) return res.status(400).json({ error: "domain and clientId are required" });

    const server = await get20iServer(req.query?.serverId as string | undefined);
    if (!requireApiKey(server, res)) return;

    // Get client email
    const [client] = await db.select().from(usersTable).where(eq(usersTable.id, clientId)).limit(1);
    if (!client) return res.status(404).json({ error: "Client not found" });

    // Create the hosting on 20i
    const result = await twentyiCreateHosting(
      server!.apiToken!,
      domain,
      client.email,
      packageId || undefined,
      stackUserId || undefined,
    );

    if (!result.siteId) return res.status(500).json({ error: "20i did not return a site ID. Hosting may have been created — check your 20i panel." });

    // Determine the plan name
    let planName = "20i Hosting";
    if (packageId) {
      try {
        const pkgs = await twentyiGetPackages(server!.apiToken!);
        const pkg = pkgs.find(p => p.id === packageId);
        if (pkg) planName = pkg.name;
      } catch { /* ignore */ }
    }

    // Save to DB (ID auto-generated by Drizzle $defaultFn)
    const [inserted] = await db.insert(hostingServicesTable).values({
      clientId,
      serverId: server!.id,
      planName,
      domain,
      username: result.siteId,
      status: "active",
      cpanelUrl: result.cpanelUrl,
      webmailUrl: result.webmailUrl,
      startDate: new Date(),
    } as any).returning({ id: hostingServicesTable.id });

    // Assign to StackUser if provided
    if (stackUserId) {
      try {
        await twentyiAssignSiteToUser(server!.apiToken!, result.siteId, stackUserId);
      } catch (e: any) {
        console.warn(`[20i] assign site to user failed: ${e.message}`);
      }
    }

    res.json({ ok: true, serviceId: inserted?.id, siteId: result.siteId, cpanelUrl: result.cpanelUrl });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Clients (for provisioning form) ─────────────────────────────────────────

router.get("/admin/twenty-i/clients", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const clients = await db
      .select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.role, "client"))
      .limit(200);
    res.json(clients);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Migrations ───────────────────────────────────────────────────────────────

router.get("/admin/twenty-i/migrations", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const server = await get20iServer(req.query?.serverId as string | undefined);
    if (!requireApiKey(server, res)) return;
    const migrations = await runWith20i(server, () => twentyiListMigrations(server!.apiToken!));
    res.json(migrations);
  } catch (e: any) {
    const msg: string = e.message ?? "";
    if (msg.includes("401") || msg.includes("Authentication failed") || msg.includes("403")) {
      return res.status(200).json({ error: "auth_failed", message: "20i API key is invalid or the server IP is not whitelisted. Verify your API key in Admin → Servers.", migrations: [] });
    }
    res.status(500).json({ error: e.message });
  }
});

router.post("/admin/twenty-i/migrations", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { domain, sourceType, host, username, password, siteId } = req.body as {
      domain?: string;
      sourceType?: string;
      host?: string;
      username?: string;
      password?: string;
      siteId?: string;
    };
    if (!domain || !sourceType || !host || !username || !password) {
      return res.status(400).json({ error: "domain, sourceType, host, username, and password are required" });
    }
    const server = await get20iServer(req.query?.serverId as string | undefined);
    if (!requireApiKey(server, res)) return;
    const result = await twentyiStartMigration(
      server!.apiToken!,
      domain,
      sourceType as any,
      host,
      username,
      password,
      siteId,
    );
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/admin/twenty-i/migrations/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const server = await get20iServer(req.query?.serverId as string | undefined);
    if (!requireApiKey(server, res)) return;
    const status = await twentyiGetMigrationStatus(server!.apiToken!, req.params.id);
    res.json(status);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Smart migrate: auto-detect/create StackUser + hosting, then start 20i migration
router.post("/admin/twenty-i/smart-migrate", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { clientId, domain, sourceType, host, username, password, siteId } = req.body as {
      clientId?: string;
      domain?: string;
      sourceType?: string;
      host?: string;
      username?: string;
      password?: string;
      siteId?: string;
    };
    if (!clientId || !domain || !host || !username || !password) {
      return res.status(400).json({ error: "clientId, domain, host, username and password are required" });
    }
    const server = await get20iServer(req.query?.serverId as string | undefined);
    if (!requireApiKey(server, res)) return;

    const apiKey = server!.apiToken!;
    const steps: string[] = [];

    // Step 1: Get client from DB
    const [client] = await db.select().from(usersTable).where(eq(usersTable.id, clientId)).limit(1);
    if (!client) return res.status(404).json({ error: "Client not found" });
    const clientName = `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim() || client.email;

    // Step 2: Get or create StackUser for this client
    const existingUsers = await twentyiListStackUsers(apiKey);
    const existingUser = existingUsers.find(u =>
      u.email?.toLowerCase() === client.email.toLowerCase() ||
      u.name?.toLowerCase() === client.email.toLowerCase()
    );
    const stackUser = existingUser ?? await twentyiCreateStackUser(apiKey, client.email, clientName);
    if (existingUser) {
      steps.push(`Found existing StackUser: ${stackUser.id}`);
    } else {
      steps.push(`Created new StackUser for ${client.email}`);
    }

    // Step 3: Create hosting if no siteId provided
    let resolvedSiteId = siteId ?? null;
    if (!resolvedSiteId) {
      const result = await twentyiCreateHosting(apiKey, domain, client.email, undefined, stackUser.id);
      if (!result.siteId) return res.status(500).json({ error: "Failed to create 20i hosting account" });
      resolvedSiteId = result.siteId;
      steps.push(`Created hosting account: ${resolvedSiteId}`);

      // Save to DB
      try {
        await db.insert(hostingServicesTable).values({
          clientId,
          serverId: server!.id,
          planName: "20i Hosting (Migrated)",
          domain,
          username: resolvedSiteId,
          status: "active",
          startDate: new Date(),
        } as any);
        steps.push("Saved hosting service to NoePanel");
      } catch (dbErr: any) {
        steps.push(`DB save warning: ${dbErr.message}`);
      }
    } else {
      steps.push(`Using existing site: ${resolvedSiteId}`);
    }

    // Step 4: Assign to StackUser
    try {
      await twentyiAssignSiteToUser(apiKey, resolvedSiteId, stackUser.id);
      steps.push(`Site assigned to StackUser ${stackUser.id}`);
    } catch (assignErr: any) {
      steps.push(`Assign warning: ${assignErr.message}`);
    }

    // Step 5: Start migration
    const migration = await twentyiStartMigration(apiKey, domain, sourceType ?? "cpanel", host, username, password, resolvedSiteId);
    steps.push(`Migration started — ID: ${migration.id ?? migration.migrationId ?? "pending"}`);

    res.json({
      ok: true,
      steps,
      stackUserId: stackUser.id,
      siteId: resolvedSiteId,
      migrationId: migration.id ?? migration.migrationId ?? null,
      migration,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Support Tickets ──────────────────────────────────────────────────────────

router.get("/admin/twenty-i/tickets", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const server = await get20iServer(req.query?.serverId as string | undefined);
    if (!requireApiKey(server, res)) return;
    const tickets = await twentyiListTickets(server!.apiToken!);
    res.json(tickets);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/admin/twenty-i/tickets/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const server = await get20iServer(req.query?.serverId as string | undefined);
    if (!requireApiKey(server, res)) return;
    const ticket = await twentyiGetTicket(server!.apiToken!, req.params.id);
    res.json(ticket);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/admin/twenty-i/tickets", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { subject, body, priority } = req.body as { subject?: string; body?: string; priority?: string };
    if (!subject || !body) return res.status(400).json({ error: "subject and body are required" });
    const server = await get20iServer(req.query?.serverId as string | undefined);
    if (!requireApiKey(server, res)) return;
    const result = await twentyiCreateTicket(server!.apiToken!, subject, body, (priority as any) ?? "normal");
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/admin/twenty-i/tickets/:id/reply", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { body } = req.body as { body?: string };
    if (!body) return res.status(400).json({ error: "body is required" });
    const server = await get20iServer(req.query?.serverId as string | undefined);
    if (!requireApiKey(server, res)) return;
    await twentyiReplyTicket(server!.apiToken!, req.params.id, body);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Sync (status + renewal dates) ────────────────────────────────────────────

router.post("/admin/twenty-i/sync", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const server = await get20iServer(req.query?.serverId as string | undefined);
    if (!requireApiKey(server, res)) return;
    const apiKey = server!.apiToken!;
    const sites = await twentyiListSites(apiKey);

    let synced = 0;
    let datesSynced = 0;
    const errors: string[] = [];

    for (const site of sites) {
      try {
        // Fetch renewal dates for this specific package
        const { expiryDate, renewalDate } = await twentyiGetSiteRenewalDate(apiKey, site.id);

        const updatePayload: Record<string, any> = {
          status: site.status === "suspended" ? "suspended" : "active",
          updatedAt: new Date(),
        };
        if (renewalDate) { updatePayload.nextDueDate = renewalDate; datesSynced++; }
        if (expiryDate) updatePayload.expiryDate = expiryDate;

        // Match by domain first, then by username (which stores the 20i site id)
        const byDomain = await db.update(hostingServicesTable)
          .set(updatePayload)
          .where(eq(hostingServicesTable.domain, site.domain))
          .returning({ id: hostingServicesTable.id });

        if (byDomain.length > 0) {
          synced++;
        } else {
          // Fallback: match by username = site.id
          const byUser = await db.update(hostingServicesTable)
            .set(updatePayload)
            .where(eq(hostingServicesTable.username, site.id))
            .returning({ id: hostingServicesTable.id });
          if (byUser.length > 0) synced++;
        }
      } catch (siteErr: any) {
        errors.push(`${site.domain}: ${siteErr.message}`);
      }
    }

    res.json({
      ok: true,
      total: sites.length,
      synced,
      datesSynced,
      errors: errors.length ? errors : undefined,
      syncedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
