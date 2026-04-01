/**
 * Admin routes for 20i Master Center
 * All routes require admin authentication.
 */
import { Router } from "express";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { db } from "@workspace/db";
import { serversTable, hostingServicesTable, usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import {
  twentyiListStackUsers,
  twentyiCreateStackUser,
  twentyiDeleteStackUser,
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
} from "../lib/twenty-i.js";

const router = Router();

// ─── Helper: get 20i server ───────────────────────────────────────────────────

async function get20iServer() {
  const [server] = await db
    .select()
    .from(serversTable)
    .where(and(eq(serversTable.type, "20i"), eq(serversTable.status, "active")))
    .limit(1);
  return server ?? null;
}

function requireApiKey(server: any, res: any): boolean {
  if (!server) { res.status(400).json({ error: "No active 20i server configured. Add one in Admin → Servers." }); return false; }
  if (!server.apiToken) { res.status(400).json({ error: "20i API key missing. Edit the server in Admin → Servers to add the API key." }); return false; }
  return true;
}

/**
 * Run `fn` with the server's per-server proxy URL active (stored in ipAddress).
 * If ipAddress is empty / not set, uses env-var proxy as normal.
 */
async function runWith20i<T>(server: any, fn: () => Promise<T>): Promise<T> {
  const proxyUrl: string | undefined = server?.ipAddress || undefined;
  return runWithProxy(proxyUrl, fn);
}

// ─── Server info ──────────────────────────────────────────────────────────────

router.get("/admin/twenty-i/server", authenticate, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const server = await get20iServer();
    if (!server) return res.json({ connected: false, error: "No active 20i server configured." });
    res.json({
      connected: true,
      id: server.id,
      name: server.name,
      hasApiToken: !!server.apiToken,
      ns1: server.ns1 ?? "ns1.20i.com",
      ns2: server.ns2 ?? "ns2.20i.com",
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Direct diagnostic (no UI cache — tests saved key against live 20i API) ──

router.get("/admin/twenty-i/diagnostic", authenticate, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const server = await get20iServer();
    if (!server) {
      return res.json({
        ok: false,
        error: "no_server",
        message: "No active 20i server configured. Add one in Admin → Servers.",
      });
    }
    if (!server.apiToken) {
      return res.json({
        ok: false,
        error: "no_key",
        message: "20i API key missing from the saved server record. Edit the server in Admin → Servers.",
      });
    }

    // Run full debug with the saved server's proxy URL (stored in ipAddress)
    const runDiag = async () => {
      const [debug, ip, proxy] = await Promise.all([
        twentyiRawDebug(server.apiToken!),
        getOutboundIp(),
        Promise.resolve(getProxyConfig()),
      ]);
      return { debug, ip, proxy };
    };

    const { debug, ip, proxy } = await runWithProxy(
      server.ipAddress || undefined,
      runDiag
    );

    // Log to console so admin can see it immediately in workflow logs
    console.log(`[20i-DIAGNOSTIC] Outbound IP: ${debug.outboundIp}${proxy.enabled ? ` (proxy: ${proxy.url})` : " (direct)"}`);
    console.log(`[20i-DIAGNOSTIC] HTTP ${debug.responseStatus} in ${debug.durationMs}ms — key: ${debug.authFormat}`);

    return res.json({
      ok: debug.responseStatus === 200,
      serverName: server.name,
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
router.get("/admin/twenty-i/whitelist", authenticate, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const server = await get20iServer();
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
 */
router.post("/admin/twenty-i/whitelist/sync", authenticate, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const server = await get20iServer();
    if (!server) return res.status(400).json({ error: "No active 20i server configured." });
    if (!server.apiToken) return res.status(400).json({ error: "20i API key missing." });

    const outboundIp = await getOutboundIp();

    const result = await runWith20i(server, () =>
      twentyiAddToWhitelist(server!.apiToken!, outboundIp)
    );

    // Always log the attempt
    if (result.success) {
      console.log(`[20i-WHITELIST] ✓ Added ${outboundIp} to whitelist`);
    } else {
      console.warn(`[20i-WHITELIST] ✗ Failed to add ${outboundIp}: ${result.error}`);
    }

    return res.json({ outboundIp, ...result });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── StackUsers ───────────────────────────────────────────────────────────────

router.get("/admin/twenty-i/stack-users", authenticate, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const server = await get20iServer();
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
    const server = await get20iServer();
    if (!requireApiKey(server, res)) return;
    const user = await twentyiCreateStackUser(server!.apiToken!, email, name);
    res.json(user);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/admin/twenty-i/stack-users/:userId", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const server = await get20iServer();
    if (!requireApiKey(server, res)) return;
    await twentyiDeleteStackUser(server!.apiToken!, req.params.userId);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Hosting Sites ────────────────────────────────────────────────────────────

router.get("/admin/twenty-i/sites", authenticate, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const server = await get20iServer();
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
    const server = await get20iServer();
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
    const server = await get20iServer();
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
    const server = await get20iServer();
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
    const server = await get20iServer();
    if (!requireApiKey(server, res)) return;
    await twentyiAssignSiteToUser(server!.apiToken!, req.params.siteId, stackUserId);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/admin/twenty-i/sites/:siteId/sso", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const server = await get20iServer();
    if (!requireApiKey(server, res)) return;
    const url = await twentyiGetSSOUrl(server!.apiToken!, req.params.siteId);
    res.json({ url });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Packages ─────────────────────────────────────────────────────────────────

router.get("/admin/twenty-i/packages", authenticate, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const server = await get20iServer();
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

    const server = await get20iServer();
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

router.get("/admin/twenty-i/clients", authenticate, requireAdmin, async (_req: AuthRequest, res) => {
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

router.get("/admin/twenty-i/migrations", authenticate, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const server = await get20iServer();
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
    const server = await get20iServer();
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
    const server = await get20iServer();
    if (!requireApiKey(server, res)) return;
    const status = await twentyiGetMigrationStatus(server!.apiToken!, req.params.id);
    res.json(status);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Support Tickets ──────────────────────────────────────────────────────────

router.get("/admin/twenty-i/tickets", authenticate, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const server = await get20iServer();
    if (!requireApiKey(server, res)) return;
    const tickets = await twentyiListTickets(server!.apiToken!);
    res.json(tickets);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/admin/twenty-i/tickets/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const server = await get20iServer();
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
    const server = await get20iServer();
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
    const server = await get20iServer();
    if (!requireApiKey(server, res)) return;
    await twentyiReplyTicket(server!.apiToken!, req.params.id, body);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Sync ──────────────────────────────────────────────────────────────────────

router.post("/admin/twenty-i/sync", authenticate, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const server = await get20iServer();
    if (!requireApiKey(server, res)) return;
    const sites = await twentyiListSites(server!.apiToken!);

    let synced = 0;
    for (const site of sites) {
      const updated = await db.update(hostingServicesTable)
        .set({
          status: site.status === "suspended" ? "suspended" : "active",
          updatedAt: new Date(),
        })
        .where(eq(hostingServicesTable.username, site.id));
      if ((updated as any).rowCount > 0) synced++;
    }

    res.json({ ok: true, total: sites.length, synced, syncedAt: new Date().toISOString() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
