/**
 * Admin routes for 20i Master Center
 * All routes require admin authentication.
 */
import { Router } from "express";
import { authenticate, requireAdmin, hashPassword, type AuthRequest } from "../lib/auth.js";
import { db } from "@workspace/db";
import { serversTable, hostingServicesTable, usersTable } from "@workspace/db/schema";
import { eq, and, desc, isNotNull } from "drizzle-orm";
import { runWithCtx,
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

// ─── In-memory site list cache ─────────────────────────────────────────────────
// Shared across StackUsers + Packages routes to avoid redundant /package calls.
// Keyed by API token; TTL = 60 seconds.
const _sitesCache = new Map<string, { sites: Awaited<ReturnType<typeof twentyiListSites>>; expiry: number }>();
async function getCachedSites(server: any): Promise<Awaited<ReturnType<typeof twentyiListSites>>> {
  const key = String(server?.apiToken ?? "");
  const cached = _sitesCache.get(key);
  if (cached && Date.now() < cached.expiry) return cached.sites;
  const sites = await runWith20i(server, () => twentyiListSites(server!.apiToken!));
  _sitesCache.set(key, { sites, expiry: Date.now() + 60_000 });
  return sites;
}

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

// Classify any error thrown by 20i library functions into a human-readable response.
// Returns true if the error was handled (response already sent), false otherwise.
function handle20iError(e: any, res: any, emptyFallback?: any): boolean {
  const msg: string = e?.message ?? String(e);
  const code: string = e?.code ?? "";

  // IP not whitelisted — 20i returns 404 on reseller/* when IP is not in the whitelist
  if (code === "IP_NOT_WHITELISTED" || msg.includes("IP_NOT_WHITELISTED") || msg.includes("ip_not_whitelisted")) {
    res.status(200).json({
      error: "ip_not_whitelisted",
      message: "Your server's outbound IP is not whitelisted at 20i. Go to my.20i.com → Reseller API → IP Whitelist and add your IP, then refresh.",
      ...(emptyFallback !== undefined ? { data: emptyFallback } : {}),
    });
    return true;
  }
  // Authentication failed — wrong key
  if (msg.includes("KEY NOT RECOGNISED") || msg.includes("User ID") || msg.includes("Authentication failed")) {
    res.status(200).json({
      error: "auth_failed",
      message: "20i API key is invalid. Edit the server in Admin → Servers and re-enter the correct key.",
      ...(emptyFallback !== undefined ? { data: emptyFallback } : {}),
    });
    return true;
  }
  // IP blocked (403 from 20i)
  if (msg.includes("403") || msg.includes("Forbidden") || msg.includes("IpMatch")) {
    res.status(200).json({
      error: "ip_not_whitelisted",
      message: "Your server's outbound IP is not whitelisted at 20i (403 Forbidden). Go to my.20i.com → Reseller API → IP Whitelist and add your IP.",
      ...(emptyFallback !== undefined ? { data: emptyFallback } : {}),
    });
    return true;
  }
  return false;
}

/**
 * Run `fn` in the context of a 20i server record.
 * Threads the server's keyType (general vs combined) and proxyUrl (per-server static IP proxy)
 * through AsyncLocalStorage so all 20i API calls pick them up automatically.
 */
async function runWith20i<T>(server: any, fn: () => Promise<T>): Promise<T> {
  return runWithCtx(
    { keyType: server?.keyType ?? "general", proxyUrl: server?.proxyUrl ?? undefined },
    fn,
  );
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
    const serverId = req.query.serverId as string | undefined;
    const server = await get20iServer(serverId);
    const { key, source } = await get20iApiKey(serverId);
    if (!key) {
      return res.json({
        ok: false,
        error: "no_key",
        message: "No 20i API key found. Add it in Admin -> Servers (type: 20i).",
      });
    }

    console.log(`[20i-DIAGNOSTIC] Key source: ${source}`);
    const [debug, ip, proxy] = await Promise.all([
      runWith20i(server, () => twentyiRawDebug(key)),
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
      ok: debug.diagnosis === "connected",
      keySource: source,
      outboundIp: ip,
      proxy,
      debug,
      hint: debug.diagnosis === "ip_blocked" || debug.responseStatus === 401
        ? `Whitelist ${debug.outboundIp} in my.20i.com → Reseller API → IP Whitelist, then retry.`
        : debug.diagnosis === "connected" && debug.responseStatus !== 200
        ? `API connected — some reseller endpoints return 404/403 for this account type. Core hosting management works correctly.`
        : undefined,
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: "exception", message: e.message });
  }
});

// ─── Endpoint Probe ───────────────────────────────────────────────────────────

/**
 * GET /admin/twenty-i/probe
 * Tests a set of 20i API endpoint patterns using the stored key and reports
 * the HTTP status and body snippet for each. Useful for diagnosing which
 * endpoints are accessible for this account type.
 */
router.get("/admin/twenty-i/probe", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const server = await get20iServer(req.query?.serverId as string | undefined);
    if (!requireApiKey(server, res)) return;

    const apiKey = server!.apiToken!.trim();
    const axios = (await import("axios")).default;
    const { sanitiseKey } = await import("../lib/twenty-i.js");
    const cleanKey = sanitiseKey(apiKey);
    const plusIdx = cleanKey.indexOf("+");
    const beforePlus = plusIdx > 0 ? cleanKey.substring(0, plusIdx) : cleanKey;
    const afterPlus = plusIdx > 0 ? cleanKey.substring(plusIdx + 1) : cleanKey;

    const encodeKey = (k: string) => Buffer.from(k + "\n").toString("base64");

    // Also probe the full key (no split) with and without \n
    const fullKey = cleanKey;
    const encodeFullKey = (k: string) => Buffer.from(k + "\n").toString("base64");
    const encodeFullKeyNoNl = (k: string) => Buffer.from(k).toString("base64");

    const endpointsToProbe = [
      { label: "GET /reseller (before)",              method: "GET", path: "/reseller",               key: "before" },
      { label: "GET /reseller (after)",               method: "GET", path: "/reseller",               key: "after"  },
      { label: "GET /reseller/*/web",                 method: "GET", path: "/reseller/*/web",         key: "before" },
      { label: "GET /reseller/*/package",             method: "GET", path: "/reseller/*/package",     key: "before" },
      { label: "GET /reseller/*/packageTypes",        method: "GET", path: "/reseller/*/packageTypes",key: "before" },
      { label: "GET /reseller/*/susers",              method: "GET", path: "/reseller/*/susers",      key: "before" },
      { label: "GET /package (after_plus)",           method: "GET", path: "/package",                key: "after"  },
      { label: "GET /package (before_plus)",          method: "GET", path: "/package",                key: "before" },
      { label: "GET /web (before)",                   method: "GET", path: "/web",                    key: "before" },
      { label: "GET /reseller/1/web",                 method: "GET", path: "/reseller/1/web",         key: "before" },
      { label: "GET /reseller/1/package",             method: "GET", path: "/reseller/1/package",     key: "before" },
    ];

    // Also test full (un-split) key on key-sensitive endpoints
    const fullKeyProbes = [
      { label: "GET /reseller [full+newline]",  path: "/reseller",         auth: `Bearer ${encodeFullKey(fullKey)}` },
      { label: "GET /reseller [full, no-nl]",   path: "/reseller",         auth: `Bearer ${encodeFullKeyNoNl(fullKey)}` },
      { label: "GET /reseller/*/web [full+nl]", path: "/reseller/*/web",   auth: `Bearer ${encodeFullKey(fullKey)}` },
      { label: "GET /package [full+nl]",        path: "/package",          auth: `Bearer ${encodeFullKey(fullKey)}` },
      { label: "GET /package [before, no-nl]",  path: "/package",          auth: `Bearer ${encodeFullKeyNoNl(beforePlus)}` },
      { label: "GET /package [after, no-nl]",   path: "/package",          auth: `Bearer ${encodeFullKeyNoNl(afterPlus)}` },
    ];

    const makeCall = async (label: string, method: string, path: string, auth: string) => {
      try {
        const r = await axios({
          method: method as any,
          url: `https://api.20i.com${path}`,
          headers: { Authorization: auth, "Content-Type": "application/json", Accept: "application/json" },
          timeout: 8_000,
          validateStatus: () => true,
        });
        const rawBody = typeof r.data === "string" ? r.data : JSON.stringify(r.data);
        return { label, status: r.status, body: rawBody.substring(0, 300) };
      } catch (e: any) {
        return { label, status: null, body: `Error: ${e.message}` };
      }
    };

    const [standardResults, fullKeyResults] = await Promise.all([
      Promise.all(endpointsToProbe.map(ep => {
        const k = ep.key === "before" ? beforePlus : afterPlus;
        return makeCall(ep.label, ep.method, ep.path, `Bearer ${encodeKey(k)}`);
      })),
      Promise.all(fullKeyProbes.map(fp => makeCall(fp.label, "GET", fp.path, fp.auth))),
    ]);

    const results = [...standardResults, ...fullKeyResults];
    results.forEach(r => {
      console.log(`[20i-PROBE] ${r.label} → HTTP ${r.status ?? "ERR"}  ${r.body.substring(0, 150)}`);
    });

    return res.json({ ok: true, results });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── IP Whitelist ─────────────────────────────────────────────────────────────

/**
 * GET /admin/twenty-i/whitelist
 * Returns current outbound IP + current 20i whitelist entries.
 * Works even if NOT whitelisted (outbound IP from ipify.org is always available).
 */
// Derive the stable server hostname for display in the whitelist manager.
// Priority:
//   1. SERVER_HOSTNAME env var (user-configured custom domain like "noehost.com")
//   2. A *.replit.app domain from REPLIT_DOMAINS (stable deployment hostname)
//   3. Any other custom domain in REPLIT_DOMAINS (not *.replit.dev which is ephemeral)
// Ephemeral *.replit.dev and *.kirk.replit.dev dev-only domains are excluded.
function getServerHostname(): string | null {
  // Prefer explicitly configured custom hostname
  if (process.env.SERVER_HOSTNAME?.trim()) return process.env.SERVER_HOSTNAME.trim();

  const replitDomains = (process.env.REPLIT_DOMAINS ?? "").split(",").map(d => d.trim()).filter(Boolean);
  if (!replitDomains.length) return null;

  // Prefer *.replit.app (stable, assigned at deployment time)
  const deployDomain = replitDomains.find(d => d.endsWith(".replit.app"));
  if (deployDomain) return deployDomain;

  // Prefer any truly custom domain (not *.replit.* or *.repl.co)
  const custom = replitDomains.find(d => !d.includes(".replit.") && !d.endsWith(".repl.co"));
  if (custom) return custom;

  // *.replit.dev / *.kirk.replit.dev are ephemeral dev domains — do not show them
  return null;
}

router.get("/admin/twenty-i/whitelist", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const server = await get20iServer(req.query?.serverId as string | undefined);
    const serverHostname = getServerHostname();
    // If the server has a proxy configured, detect outbound IP through it so
    // the panel shows the proxy's stable IP (not the ephemeral Replit IP)
    const serverProxyUrl = server?.proxyUrl ?? undefined;
    const outboundIp = serverProxyUrl
      ? await runWithProxy(serverProxyUrl, () => getOutboundIp())
      : await getOutboundIp();
    const proxy: { enabled: boolean; url?: string } = serverProxyUrl
      ? { enabled: true, url: serverProxyUrl }
      : getProxyConfig();

    if (!server || !server.apiToken) {
      return res.json({ outboundIp, serverHostname, proxy, currentList: [], serverConfigured: false, isWhitelisted: null });
    }

    let currentList: string[] = [];
    let fetchError: string | null = null;
    let canVerify = false;

    try {
      currentList = await runWith20i(server, () => twentyiGetWhitelist(server!.apiToken!));
      canVerify = true; // Successfully read the list — we know for sure
    } catch (e: any) {
      fetchError = e.message;
      canVerify = false;
      // Could not read whitelist — may be a permission issue or IP blocked.
      // Do NOT assume isWhitelisted=false here; it could be already whitelisted.
    }

    // isWhitelisted is:
    //   true  — confirmed in whitelist
    //   false — confirmed NOT in whitelist
    //   null  — cannot verify
    let isWhitelisted: boolean | null = canVerify ? currentList.includes(outboundIp) : null;

    // Secondary check: if whitelist API is unavailable (isWhitelisted still null),
    // probe GET /package to detect the IpMatch 403 — a definitive signal the IP is NOT whitelisted.
    // Uses the 60-second in-memory cache so subsequent calls within the same minute are free.
    if (isWhitelisted === null) {
      try {
        await getCachedSites(server);
        // /package succeeded — IP is in the whitelist
        isWhitelisted = true;
      } catch (probeErr: any) {
        const msg = String(probeErr?.message ?? "");
        if (msg.includes("IpMatch")) {
          // Confirmed: 403 IpMatch → IP not in 20i whitelist
          isWhitelisted = false;
        }
        // Any other error (auth failure, network, etc.) — leave isWhitelisted as null
      }
    }

    return res.json({
      outboundIp,
      serverHostname,
      proxy,
      currentList,
      fetchError,
      canVerify,
      isWhitelisted,
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

    const [outboundIp, serverHostname] = await Promise.all([getOutboundIp(), Promise.resolve(getServerHostname())]);
    const apiKey = server.apiToken;

    const wlResult = await runWith20i(server, () => twentyiAutoWhitelist(apiKey, outboundIp));

    if (wlResult.added) {
      console.log(`[20i-WHITELIST] ✓ Added ${outboundIp} to whitelist`);
      return res.json({ success: true, outboundIp, serverHostname, message: `IP ${outboundIp} successfully added to 20i whitelist.` });
    }

    // IP was already in the whitelist — treat as success
    if (wlResult.alreadyPresent || wlResult.reason === "already_present") {
      console.log(`[20i-WHITELIST] ✓ ${outboundIp} is already in the 20i whitelist`);
      return res.json({
        success: true,
        outboundIp,
        serverHostname,
        alreadyPresent: true,
        message: `IP ${outboundIp} is already in 20i's whitelist — no action needed.`,
      });
    }

    if (wlResult.reason === "ip_blocked") {
      console.warn(`[20i-WHITELIST] ✗ IP ${outboundIp} must be whitelisted manually at my.20i.com first`);
      return res.json({
        success: false,
        error: "chicken_and_egg",
        outboundIp,
        serverHostname,
        message: `The 20i API requires your IP to be whitelisted first. Add ${outboundIp} manually at my.20i.com → Reseller API → IP Whitelist. After that, this button will auto-update the whitelist whenever the IP changes.`,
      });
    }

    if (wlResult.reason === "endpoint_unavailable") {
      console.warn(`[20i-WHITELIST] ✗ Whitelist API endpoint not available for this 20i account type`);
      return res.json({
        success: false,
        error: "endpoint_unavailable",
        outboundIp,
        serverHostname,
        message: `The IP whitelist API is not available for your 20i account. Add ${outboundIp} manually at my.20i.com → Reseller API → IP Whitelist. This is a one-time step — if the IP changes, just click this button again to see the new IP.`,
      });
    }

    if (wlResult.reason === "auth_failed") {
      console.warn(`[20i-WHITELIST] ✗ API key authentication failed for whitelist sync`);
      return res.json({
        success: false,
        error: "auth_failed",
        outboundIp,
        serverHostname,
        message: `The 20i API key could not be authenticated. Please re-check your API key in Admin → Servers.`,
      });
    }

    console.warn(`[20i-WHITELIST] ✗ Failed to add ${outboundIp}: ${wlResult.reason}`);
    return res.json({ success: false, error: wlResult.reason, outboundIp, serverHostname });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── StackUsers ───────────────────────────────────────────────────────────────

router.get("/admin/twenty-i/stack-users", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const server = await get20iServer(req.query?.serverId as string | undefined);
    if (!requireApiKey(server, res)) return;

    // Fire both calls in parallel:
    // (1) /reseller/*/susers — full name/email if the account has stackUsersRead scope
    // (2) /package — site list for site-derived StackUser IDs (uses the in-memory cache when warm)
    const [susersResult, sitesResult] = await Promise.allSettled([
      runWith20i(server, () => twentyiListStackUsers(server!.apiToken!)),
      getCachedSites(server),
    ]);

    const users: Awaited<ReturnType<typeof twentyiListStackUsers>> =
      susersResult.status === "fulfilled" ? susersResult.value : [];

    // If the real susers endpoint returned data, use it — names/emails included.
    if (users.length > 0) return res.json(users);

    // Site-derived fallback — extract every unique stack-user ID from /package results.
    let sites: Awaited<ReturnType<typeof twentyiListSites>> = [];
    if (sitesResult.status === "fulfilled") {
      sites = sitesResult.value;
    } else {
      const siteErr = sitesResult.reason as Error;
      console.warn(`[20i] stack-users: getCachedSites failed (${siteErr.message}) — falling back to empty site list`);
      if (handle20iError(siteErr, res, [])) return;
      sites = [];
    }

    const suserMap = new Map<string, {
      id: string; name: string; email: string | null; type: string;
      masterFtp: boolean; siteCount: number; domains: string[];
      clientId: string | null; clientName: string | null; clientEmail: string | null;
    }>();

    for (const site of (Array.isArray(sites) ? sites : [])) {
      for (const su of (Array.isArray(site?.stackUsers) ? site.stackUsers : [])) {
        const raw = String(su);
        const numericId = raw.replace(/^stack-user:/, "");
        const key = raw.startsWith("stack-user:") ? raw : `stack-user:${raw}`;
        if (!suserMap.has(key)) {
          suserMap.set(key, { id: key, name: numericId, email: null, type: "stack-user", masterFtp: false, siteCount: 0, domains: [], clientId: null, clientName: null, clientEmail: null });
        }
        const entry = suserMap.get(key)!;
        entry.siteCount++;
        if (site.domain && entry.domains.length < 3) entry.domains.push(site.domain);
      }
    }

    // Cross-reference with our local usersTable to get real client names/emails.
    // Wrap in try/catch — a missing column or DB failure must not crash the route.
    try {
      const panelUsers = await db
        .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, stackUserId: usersTable.stackUserId })
        .from(usersTable)
        .where(isNotNull(usersTable.stackUserId));

      for (const pu of panelUsers) {
        const suId = pu.stackUserId as string | null;
        if (!suId) continue;
        const key = suId.startsWith("stack-user:") ? suId : `stack-user:${suId}`;
        const entry = suserMap.get(key);
        if (entry) {
          entry.clientId = String(pu.id);
          entry.clientName = pu.name ?? null;
          entry.clientEmail = pu.email ?? null;
          if (pu.name) entry.name = pu.name;
          if (pu.email) entry.email = pu.email;
        }
      }
    } catch (dbErr: any) {
      console.warn(`[20i] stack-users: DB enrichment failed (${dbErr.message}) — skipping client cross-reference`);
    }

    // For StackUsers without a linked panel client, use first domain as display name
    for (const entry of suserMap.values()) {
      if (!entry.clientId && entry.domains.length > 0) {
        entry.name = entry.domains[0];
      }
    }

    const result = Array.from(suserMap.values()).sort((a, b) => b.siteCount - a.siteCount);
    return res.json(result);
  } catch (e: any) {
    console.warn(`[20i] stack-users fetch failed: ${e.message}`);
    if (!handle20iError(e, res, [])) {
      res.status(200).json({ error: "fetch_failed", message: e.message, data: [] });
    }
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

    // Enrich sites with panel client info — wrapped in try/catch so DB issues never break the list
    let enriched: any[] = sites as any[];
    try {
      const panelUsers = await db
        .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, stackUserId: usersTable.stackUserId })
        .from(usersTable)
        .where(isNotNull(usersTable.stackUserId));

      const suToClient = new Map<string, { clientId: string; clientName: string | null; clientEmail: string | null }>();
      for (const pu of panelUsers) {
        if (!pu.stackUserId) continue;
        const rawKey = String(pu.stackUserId);
        const key = rawKey.startsWith("stack-user:") ? rawKey : `stack-user:${rawKey}`;
        suToClient.set(key, { clientId: String(pu.id), clientName: pu.name ?? null, clientEmail: pu.email ?? null });
      }

      enriched = (sites as any[]).map((site: any) => {
        let clientId: string | null = null;
        let clientName: string | null = null;
        let clientEmail: string | null = null;
        for (const su of (Array.isArray(site?.stackUsers) ? site.stackUsers : [])) {
          const rawSu = String(su ?? "");
          const key = rawSu.startsWith("stack-user:") ? rawSu : `stack-user:${rawSu}`;
          const client = suToClient.get(key);
          if (client) { clientId = client.clientId; clientName = client.clientName; clientEmail = client.clientEmail; break; }
        }
        return { ...(site ?? {}), clientId, clientName, clientEmail };
      });
    } catch (dbErr: any) {
      console.warn(`[20i-SITES] DB enrichment failed (sites still returned): ${dbErr?.message}`);
    }

    res.json(enriched);
  } catch (e: any) {
    console.warn(`[20i] sites fetch failed: ${e.message}`);
    if (!handle20iError(e, res, [])) {
      res.status(200).json({ error: "fetch_failed", message: e.message, data: [] });
    }
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
    const result = await twentyiGetSSOUrl(server!.apiToken!, req.params.siteId);

    if (result.url) {
      // SSO token obtained — send direct login URL
      return res.json({ url: result.url, ssoAvailable: true });
    }

    // SSO not available — return helpful info for the frontend to show a login modal
    return res.json({
      url: null,
      ssoAvailable: false,
      stackcpUrl: "https://stackcp.com",
      manageUrl: "https://my.20i.com/managed-vps/",
      stackUsers: result.stackUsers ?? [],
      domain: result.domain ?? null,
      message: "SSO login is not available for this 20i account. Use StackCP with StackUser credentials.",
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Packages ─────────────────────────────────────────────────────────────────

router.get("/admin/twenty-i/packages", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const server = await get20iServer(req.query?.serverId as string | undefined);
    if (!requireApiKey(server, res)) return;

    // Try /reseller/*/packageTypes first (may 404 on this account type — use site-derived fallback).
    const packages = await runWith20i(server, () => twentyiGetPackages(server!.apiToken!));
    if (packages.length > 0) return res.json(packages);

    // Derive unique package types from cached site list — each site has packageTypeName + typeRef.
    // Returns { id, label, platform } — same shape as TwentyIPackageType.
    const sites = await getCachedSites(server);
    const typeMap = new Map<string, { id: string; label: string; platform: string }>();
    for (const site of sites) {
      const typeId = String(site.typeRef ?? site.packageTypeName ?? "default");
      const label = site.packageTypeName ?? typeId;
      const platform = site.platform ?? "linux";
      if (!typeMap.has(typeId)) {
        typeMap.set(typeId, { id: typeId, label, platform });
      }
    }
    // Sort alphabetically by label for a clean dropdown
    const result = Array.from(typeMap.values()).sort((a, b) => a.label.localeCompare(b.label));
    return res.json(result);
  } catch (e: any) {
    console.warn(`[20i] packages fetch failed: ${e.message}`);
    if (!handle20iError(e, res, [])) {
      res.status(200).json({ error: "fetch_failed", message: e.message, data: [] });
    }
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
