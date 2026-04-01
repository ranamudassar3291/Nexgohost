/**
 * 20i Hosting API Module
 * https://my.20i.com/reseller/apidoc
 *
 * Proxy support: Set TWENTYI_PROXY (or HTTPS_PROXY / FIXIE_URL) env var, OR
 * store a proxy URL in the server record's ipAddress field (per-server override).
 * Format: http://user:pass@proxy.host:port
 */
import { ProxyAgent } from "undici";
import { AsyncLocalStorage } from "async_hooks";

// ─── Per-request proxy override (via AsyncLocalStorage) ──────────────────────
// This allows per-server proxy URLs without changing all function signatures.
const _requestProxyStore = new AsyncLocalStorage<string | undefined>();

/**
 * Run `fn` with a specific proxy URL active for all 20i calls within it.
 * Pass `undefined` to explicitly disable the per-request override.
 */
export function runWithProxy<T>(proxyUrl: string | undefined, fn: () => T): T {
  return _requestProxyStore.run(proxyUrl, fn);
}

// ─── Proxy dispatcher ─────────────────────────────────────────────────────────

function buildProxyDispatcher(proxyUrl: string): ProxyAgent | undefined {
  try {
    return new ProxyAgent(proxyUrl);
  } catch (e: any) {
    console.warn(`[20i] Proxy config error: ${e.message}`);
    return undefined;
  }
}

// Env-var proxy (cached after first build)
let _envProxyDispatcher: ProxyAgent | undefined | null = null;
function getEnvProxy(): ProxyAgent | undefined {
  if (_envProxyDispatcher === null) {
    const raw = process.env.TWENTYI_PROXY || process.env.HTTPS_PROXY || process.env.FIXIE_URL;
    if (raw) {
      _envProxyDispatcher = buildProxyDispatcher(raw);
      const sanitised = raw.replace(/:[^:@]+@/, ":***@");
      console.log(`[20i] Proxy bridge active → ${sanitised}`);
    } else {
      _envProxyDispatcher = undefined;
      console.log("[20i] No proxy configured — calls go direct (Replit IP). Set TWENTYI_PROXY for a fixed IP.");
    }
  }
  return _envProxyDispatcher;
}

/** Resolve the proxy to use: per-request override > env var > direct */
function getProxy(): ProxyAgent | undefined {
  const requestProxy = _requestProxyStore.getStore();
  if (requestProxy !== undefined) {
    // requestProxy is explicitly set (could be "" to force direct)
    if (!requestProxy) return undefined;
    return buildProxyDispatcher(requestProxy);
  }
  return getEnvProxy();
}

/** Return the current outbound IP as seen by external services (respects active proxy) */
export async function getOutboundIp(): Promise<string> {
  try {
    const proxy = getProxy();
    const opts: any = { signal: AbortSignal.timeout(8000) };
    if (proxy) opts.dispatcher = proxy;
    const res = await fetch("https://api.ipify.org?format=json", opts);
    const data = await res.json() as { ip: string };
    return data.ip ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** Return proxy configuration status (safe — no secrets exposed) */
export function getProxyConfig(): { enabled: boolean; url?: string } {
  const requestProxy = _requestProxyStore.getStore();
  if (requestProxy !== undefined) {
    if (!requestProxy) return { enabled: false };
    return { enabled: true, url: requestProxy.replace(/:[^:@]+@/, ":***@") };
  }
  const raw = process.env.TWENTYI_PROXY || process.env.HTTPS_PROXY || process.env.FIXIE_URL;
  if (!raw) return { enabled: false };
  return { enabled: true, url: raw.replace(/:[^:@]+@/, ":***@") };
}

/**
 * Sanitise an API key: trim whitespace and strip invisible/zero-width chars
 * that silently break Bearer token auth.
 * Exported so routes can sanitise before saving to DB.
 */
export function sanitiseKey(apiKey: string): string {
  return apiKey.trim().replace(/[\u200B-\u200D\uFEFF\u00AD\u0000-\u001F\u007F]/g, "");
}

// ─── Raw debug test ───────────────────────────────────────────────────────────

export interface TwentyIDebugInfo {
  url: string;
  method: string;
  authFormat: string;       // "Bearer ****XXXX"
  keyLength: number;
  keyFirst4: string;
  keyLast4: string;
  keyHasHiddenChars: boolean;
  outboundIp: string;
  proxyActive: boolean;
  proxyUrl?: string;
  responseStatus: number | null;
  responseBody: string;
  durationMs: number;
}

export interface TwentyIDebugAttempt {
  format: "base64" | "raw";
  authHeaderPreview: string;
  status: number | null;
  body: string;
  durationMs: number;
}

/**
 * Makes raw, fully-logged test requests to 20i /reseller — tries BOTH
 * base64-encoded and raw key formats and reports which one worked.
 */
export async function twentyiRawDebug(apiKey: string): Promise<TwentyIDebugInfo & { attempts: TwentyIDebugAttempt[]; workingFormat: "base64" | "raw" | "none" }> {
  const rawKey = apiKey;
  const cleanKey = sanitiseKey(apiKey);
  const keyHasHiddenChars = cleanKey !== rawKey;
  const keyLen = cleanKey.length;
  const keyMask = keyLen > 8
    ? `Bearer ${"*".repeat(Math.max(0, keyLen - 4))}${cleanKey.slice(-4)}`
    : `Bearer ${"*".repeat(keyLen)}`;

  const url = "https://api.20i.com/reseller";
  const proxyConfig = getProxyConfig();
  const proxy = getProxy();

  const [outboundIp] = await Promise.allSettled([getOutboundIp()]).then(([r]) =>
    r.status === "fulfilled" ? [r.value] : ["unknown"]
  );

  const attempts: TwentyIDebugAttempt[] = [];
  let responseStatus: number | null = null;
  let responseBody = "";
  let workingFormat: "base64" | "raw" | "none" = "none";

  for (const useBase64 of [true, false] as const) {
    const format = useBase64 ? "base64" : "raw";
    const authHeader = buildAuthHeader(cleanKey, useBase64);
    const authHeaderPreview = useBase64
      ? `Bearer <base64(${keyMask.replace("Bearer ", "")})>`
      : keyMask;

    const t0 = Date.now();
    let status: number | null = null;
    let body = "";
    try {
      const fetchOpts: any = {
        method: "GET",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15000),
      };
      if (proxy) fetchOpts.dispatcher = proxy;
      const res = await fetch(url, fetchOpts);
      status = res.status;
      const raw = await res.text().catch(() => "(could not read body)");
      body = raw.length > 600 ? raw.substring(0, 600) + "…" : raw;

      if (res.ok && workingFormat === "none") {
        workingFormat = format;
        responseStatus = status;
        responseBody = body;
      } else if (responseStatus === null) {
        responseStatus = status;
        responseBody = body;
      }
    } catch (e: any) {
      body = `Network error: ${e.message}`;
    }
    attempts.push({ format, authHeaderPreview, status, body, durationMs: Date.now() - t0 });
  }

  const authFormat = workingFormat === "base64"
    ? `Bearer <base64> ✓ (working format)`
    : workingFormat === "raw"
    ? `Bearer <raw> ✓ (working format)`
    : keyMask + " (both formats failed)";

  return {
    url,
    method: "GET",
    authFormat,
    keyLength: keyLen,
    keyFirst4: cleanKey.substring(0, 4),
    keyLast4: cleanKey.slice(-4),
    keyHasHiddenChars,
    outboundIp,
    proxyActive: proxyConfig.enabled,
    proxyUrl: proxyConfig.url,
    responseStatus,
    responseBody,
    durationMs: attempts.reduce((s, a) => s + a.durationMs, 0),
    attempts,
    workingFormat,
  };
}

/**
 * Build the Authorization header value for a given key and encoding format.
 * 20i docs show Bearer token as raw, but some deployments require base64.
 * We try base64 first, then raw as fallback.
 */
function buildAuthHeader(cleanKey: string, useBase64: boolean): string {
  if (useBase64) {
    const encoded = Buffer.from(cleanKey).toString("base64");
    return `Bearer ${encoded}`;
  }
  return `Bearer ${cleanKey}`;
}

async function doFetch(
  cleanKey: string,
  method: string,
  url: string,
  body?: unknown,
  useBase64 = true,
): Promise<Response> {
  const fetchOpts: any = {
    method,
    headers: {
      Authorization: buildAuthHeader(cleanKey, useBase64),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(25000),
  };
  const proxy = getProxy();
  if (proxy) fetchOpts.dispatcher = proxy;
  return fetch(url, fetchOpts);
}

async function twentyiRequestRaw(apiKey: string, method: string, path: string, body?: unknown): Promise<any> {
  const cleanKey = sanitiseKey(apiKey);
  const url = `https://api.20i.com${path}`;

  // ── Attempt 1: Base64-encoded key (primary format per 20i dashboard) ─────────
  let res = await doFetch(cleanKey, method, url, body, true);
  let usedBase64 = true;

  // ── Attempt 2: If base64 fails → retry with raw key ──────────────────────────
  if (res.status === 401) {
    console.log("[20i] Base64 key rejected (401) — retrying with raw key…");
    res = await doFetch(cleanKey, method, url, body, false);
    usedBase64 = false;
  }

  // ── Attempt 3: If raw also fails → try auto-whitelist then retry both ─────────
  if (res.status === 401) {
    try {
      const outboundIp = await getOutboundIp();
      console.log(`[20i] Both formats rejected — attempting auto-whitelist of ${outboundIp}…`);
      await twentyiAddToWhitelistRaw(cleanKey, outboundIp);
      // Retry base64 first after whitelist
      res = await doFetch(cleanKey, method, url, body, true);
      usedBase64 = true;
      if (res.status === 401) {
        // Last chance: raw key after whitelist
        res = await doFetch(cleanKey, method, url, body, false);
        usedBase64 = false;
      }
    } catch {
      // Whitelist attempt failed — fall through to error reporting
    }
  }

  if (res.ok) {
    console.log(`[20i] ✓ Request succeeded (format: ${usedBase64 ? "base64" : "raw"}) → ${method} ${path}`);
    return res.json();
  }

  const text = await res.text().catch(() => "");
  if (res.status === 401) {
    const proxyNote = getProxy()
      ? "Proxy is active — ensure your proxy's IP is whitelisted in 20i."
      : "Outbound IP (35.229.81.149) must be whitelisted in 20i → Reseller API → IP Whitelist.";
    throw new Error(
      `Authentication failed (401) — both base64 and raw key formats tried. ${proxyNote}`
    );
  }
  if (res.status === 403) throw new Error("API key lacks permission for this action (403). Ensure it is a reseller-level key.");
  if (res.status === 404) throw new Error(`Endpoint not found (404): ${path}`);
  if (res.status === 429) throw new Error("Rate limited — too many requests to 20i API (429). Wait a moment and retry.");
  if (res.status === 500) throw new Error(`20i server error (500) — try again later. Response: ${text.substring(0, 200)}`);
  throw new Error(`20i API error ${res.status}: ${text.substring(0, 300)}`);
}

/**
 * Thin whitelist-add used internally for auto-heal — never throws.
 * Tries base64 first then raw key. Does NOT call twentyiAddToWhitelist
 * (which imports this file) to avoid circular dependency.
 */
async function twentyiAddToWhitelistRaw(cleanKey: string, ip: string): Promise<void> {
  const body = JSON.stringify({ apiWhitelist: { [ip]: {} } });
  for (const useBase64 of [true, false]) {
    const fetchOpts: any = {
      method: "POST",
      headers: {
        Authorization: buildAuthHeader(cleanKey, useBase64),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body,
      signal: AbortSignal.timeout(12000),
    };
    const proxy = getProxy();
    if (proxy) fetchOpts.dispatcher = proxy;
    const res = await fetch("https://api.20i.com/reseller/apiWhitelist", fetchOpts);
    if (res.ok) {
      console.log(`[20i] Auto-whitelist: ✓ Added ${ip} (format: ${useBase64 ? "base64" : "raw"})`);
      return;
    }
    console.warn(`[20i] Auto-whitelist: HTTP ${res.status} with ${useBase64 ? "base64" : "raw"} key`);
  }
  console.warn(`[20i] Auto-whitelist: Could not add ${ip} — manual whitelisting required`);
}

/** Retry up to 3 times with exponential backoff on transient errors */
async function twentyiRequest(apiKey: string, method: string, path: string, body?: unknown): Promise<any> {
  const maxAttempts = 3;
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await twentyiRequestRaw(apiKey, method, path, body);
    } catch (err: any) {
      lastErr = err;
      // Don't retry auth / permission / not-found errors
      if (err.message?.includes("401") || err.message?.includes("403") || err.message?.includes("404")) throw err;
      if (attempt < maxAttempts) {
        const delay = attempt * 1200;
        console.warn(`[20i] attempt ${attempt} failed (${err.message}), retrying in ${delay}ms…`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr!;
}

// ─── Probe helper — find working endpoint variant ────────────────────────────

/**
 * Try a list of endpoint paths in order, return the first successful response.
 * On auth errors (401/403) we stop immediately — no point trying others.
 * On 404 we move to the next path.
 */
async function probeEndpoints(apiKey: string, method: string, paths: string[]): Promise<{ path: string; data: any }> {
  let lastErr: Error | null = null;
  for (const path of paths) {
    try {
      const data = await twentyiRequestRaw(apiKey, method, path);
      return { path, data };
    } catch (err: any) {
      lastErr = err;
      const msg = err.message ?? "";
      // Stop probing on auth/permission errors — retrying won't help
      if (msg.includes("401") || msg.includes("authentication failed") ||
          msg.includes("403") || msg.includes("permission")) throw err;
      // On 404 continue to next candidate
      if (msg.includes("404")) continue;
      // On other errors (network, 5xx) propagate immediately
      throw err;
    }
  }
  throw lastErr ?? new Error("All endpoint variants returned 404 — check your API key and reseller account.");
}

// ─── Connection test ─────────────────────────────────────────────────────────

export interface TwentyIConnectionResult {
  success: boolean;
  message: string;
  packageCount?: number;
  diagnostic?: {
    step: string;
    endpoint?: string;
    detail?: string;
  };
}

/**
 * Test the 20i reseller API connection.
 * 1. Probe the reseller info endpoint (basic auth check).
 * 2. Probe the packages endpoint (functional check).
 * Returns structured diagnostic info so the UI can show exactly what failed.
 */
export async function twentyiTestConnection(apiKey: string): Promise<TwentyIConnectionResult> {
  // Step 1: verify auth with the reseller info endpoint
  let resellerOk = false;
  try {
    await probeEndpoints(apiKey, "GET", ["/reseller"]);
    resellerOk = true;
  } catch (err: any) {
    const msg = err.message ?? "";
    if (msg.includes("401") || msg.includes("authentication") || msg.includes("403") || msg.includes("permission")) {
      const proxyActive = !!getProxy();
      return {
        success: false,
        message: "Authentication failed (401 Unauthorized)",
        diagnostic: {
          step: "Authentication",
          detail: proxyActive
            ? "API key rejected even with proxy active. The API key itself is likely wrong — regenerate it at my.20i.com → Reseller API → API Key and paste it here."
            : "Two possible causes: (1) Your API key is wrong — double-check or regenerate it at my.20i.com → Reseller API → API Key. (2) The server IP shown above is not yet whitelisted — add it at my.20i.com → Reseller API → IP Whitelist. If you already whitelisted the IP, cause (1) is most likely.",
        },
      };
    }
    // Non-auth error on /reseller — log and continue to package probe
    console.warn(`[20i] /reseller probe non-fatal: ${msg}`);
  }

  // Step 2: find the packages endpoint
  const PACKAGE_PATHS = ["/reseller/package", "/reseller/packages", "/package"];
  try {
    const { path, data } = await probeEndpoints(apiKey, "GET", PACKAGE_PATHS);
    const packages = Array.isArray(data) ? data : (typeof data === "object" && data !== null ? Object.values(data) : []);
    const count = packages.length;
    console.log(`[20i] packages found at ${path} — ${count} package(s)`);
    return {
      success: true,
      message: `Connected to 20i API successfully. ${count} package(s) available.`,
      packageCount: count,
      diagnostic: { step: "Packages", endpoint: path },
    };
  } catch (err: any) {
    const msg = err.message ?? "";
    if (resellerOk) {
      // Auth works, but no packages endpoint found — connected but no packages
      return {
        success: true,
        message: "Connected to 20i API. No packages endpoint found — create packages in your 20i reseller portal first.",
        packageCount: 0,
        diagnostic: { step: "Packages", detail: "Reseller authenticated but package list returned 404. Create packages at my.20i.com first." },
      };
    }
    return {
      success: false,
      message: msg,
      diagnostic: { step: "Packages", detail: msg },
    };
  }
}

// ─── Packages ────────────────────────────────────────────────────────────────

export interface TwentyIPackage {
  id: string;
  name: string;
  diskSpaceMb?: number;
  bandwidthGb?: number;
  emailBoxes?: number;
  databases?: number;
  subdomains?: number;
}

function normalisePackages(raw: any): TwentyIPackage[] {
  const arr = Array.isArray(raw) ? raw : (raw && typeof raw === "object" ? Object.values(raw) : []);
  return (arr as any[]).map((pkg: any) => ({
    id: String(pkg.id ?? pkg.name ?? ""),
    name: String(pkg.label ?? pkg.name ?? pkg.id ?? "Unknown Package"),
    diskSpaceMb: pkg.diskSpaceMb ?? pkg.diskSpace,
    bandwidthGb: pkg.monthlyBandwidthGb ?? pkg.bandwidth,
    emailBoxes: pkg.emailBoxes,
    databases: pkg.mySQLDatabases ?? pkg.databases,
    subdomains: pkg.subDomains ?? pkg.subdomains,
  }));
}

export async function twentyiGetPackages(apiKey: string): Promise<TwentyIPackage[]> {
  const PATHS = ["/reseller/package", "/reseller/packages", "/package"];
  try {
    const { data } = await probeEndpoints(apiKey, "GET", PATHS);
    return normalisePackages(data);
  } catch {
    return [];
  }
}

// ─── Create hosting account ──────────────────────────────────────────────────

export interface TwentyICreateResult {
  siteId: string | null;
  cpanelUrl: string;
  webmailUrl: string;
}

export async function twentyiCreateHosting(
  apiKey: string,
  domain: string,
  email: string,
  packageId?: string,
  stackUser?: string,
): Promise<TwentyICreateResult> {
  const result = await twentyiRequest(apiKey, "POST", "/reseller/addWeb", {
    domain_name: domain,
    extra_domain_names: [],
    ...(packageId ? { package_id: packageId } : {}),
    ...(stackUser ? { username: stackUser } : {}),
    contact_email: email,
  });
  const siteId: string | null = result?.id ?? result?.web_name ?? result?.name ?? null;
  const cpanelUrl = siteId ? `https://my.20i.com/cp/${siteId}` : "";
  const webmailUrl = domain ? `https://webmail.${domain}` : "";
  return { siteId, cpanelUrl, webmailUrl };
}

// ─── Suspend / Unsuspend / Delete ────────────────────────────────────────────

export async function twentyiSuspend(apiKey: string, siteId: string): Promise<void> {
  await twentyiRequest(apiKey, "POST", `/userHosting/${siteId}/updateSubscription`, { status: 0 });
}

export async function twentyiUnsuspend(apiKey: string, siteId: string): Promise<void> {
  await twentyiRequest(apiKey, "POST", `/userHosting/${siteId}/updateSubscription`, { status: 1 });
}

export async function twentyiDelete(apiKey: string, siteId: string): Promise<void> {
  await twentyiRequest(apiKey, "DELETE", `/userHosting/${siteId}`);
}

// ─── SSL (Let's Encrypt free SSL) ────────────────────────────────────────────

export async function twentyiInstallSSL(apiKey: string, siteId: string, domain: string): Promise<void> {
  await twentyiRequest(apiKey, "POST", `/userHosting/${siteId}/freeSSL`, { domains: [domain] });
}

// ─── Site info ───────────────────────────────────────────────────────────────

export async function twentyiGetSiteInfo(apiKey: string, siteId: string): Promise<any> {
  return twentyiRequest(apiKey, "GET", `/userHosting/${siteId}`);
}

// ─── StackCP URL helper ───────────────────────────────────────────────────────

export function twentyiStackCPUrl(siteId: string): string {
  return `https://my.20i.com/cp/${siteId}`;
}

// ─── StackUser (reseller sub-accounts) ───────────────────────────────────────

export interface TwentyIStackUser {
  id: string;
  email: string;
  name: string;
}

/** Create a new StackUser under the reseller account */
export async function twentyiCreateStackUser(
  apiKey: string,
  email: string,
  name: string,
): Promise<TwentyIStackUser> {
  const result = await twentyiRequest(apiKey, "POST", "/reseller/addUser", { email, name });
  const id = result?.id ?? result?.user_id ?? result?.userId;
  if (!id) throw new Error(`20i did not return a StackUser ID. Response: ${JSON.stringify(result).substring(0, 200)}`);
  return { id: String(id), email, name };
}

/** List StackUsers belonging to this reseller account */
export async function twentyiListStackUsers(apiKey: string): Promise<TwentyIStackUser[]> {
  const data = await twentyiRequest(apiKey, "GET", "/reseller/users");
  if (!Array.isArray(data)) return [];
  return data.map((u: any) => ({ id: String(u.id ?? u.user_id ?? ""), email: u.email ?? "", name: u.name ?? "" }));
}

/**
 * Find an existing StackUser by email or create a new one.
 * Tries to find first to avoid duplicates.
 */
export async function twentyiGetOrCreateStackUser(
  apiKey: string,
  email: string,
  name: string,
): Promise<TwentyIStackUser> {
  try {
    const users = await twentyiListStackUsers(apiKey);
    const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) return existing;
  } catch {
    // Ignore list errors — proceed to create
  }
  return twentyiCreateStackUser(apiKey, email, name);
}

/** Assign a hosting site to a StackUser so they can manage it via StackCP */
export async function twentyiAssignSiteToUser(
  apiKey: string,
  siteId: string,
  stackUserId: string,
): Promise<void> {
  await twentyiRequest(apiKey, "POST", `/userHosting/${siteId}/setUser`, { userId: stackUserId });
}

// ─── List all hosting sites ───────────────────────────────────────────────────

export interface TwentyISite {
  id: string;
  domain: string;
  status: string;
  package?: string;
  stackUserId?: string;
}

export async function twentyiListSites(apiKey: string): Promise<TwentyISite[]> {
  const data = await twentyiRequest(apiKey, "GET", "/reseller/web");
  if (!Array.isArray(data)) return [];
  return data.map((s: any) => ({
    id: String(s.id ?? s.web_name ?? ""),
    domain: String(s.domain_name ?? s.domain ?? ""),
    status: s.status ?? (s.suspended ? "suspended" : "active"),
    package: s.package_name ?? s.package ?? "",
    stackUserId: s.user_id ? String(s.user_id) : undefined,
  }));
}

/**
 * Fetch renewal/expiry date for a specific hosting package from 20i.
 * Tries /package/{id} first then falls back gracefully.
 */
export async function twentyiGetSiteRenewalDate(
  apiKey: string,
  siteId: string,
): Promise<{ expiryDate: Date | null; renewalDate: Date | null }> {
  try {
    const data = await twentyiRequest(apiKey, "GET", `/package/${siteId}`);
    const raw = data?.renewal_date ?? data?.expiry_date ?? data?.next_due_date ?? null;
    const rawExpiry = data?.expiry_date ?? null;
    const parseD = (v: any): Date | null => {
      if (!v) return null;
      const d = new Date(typeof v === "number" ? v * 1000 : v);
      return isNaN(d.getTime()) ? null : d;
    };
    return { expiryDate: parseD(rawExpiry), renewalDate: parseD(raw) };
  } catch {
    return { expiryDate: null, renewalDate: null };
  }
}

// ─── Delete StackUser ─────────────────────────────────────────────────────────

export async function twentyiDeleteStackUser(apiKey: string, userId: string): Promise<void> {
  await twentyiRequest(apiKey, "DELETE", `/reseller/user/${userId}`);
}

// ─── Migrations ───────────────────────────────────────────────────────────────

export interface TwentyIMigration {
  id: string;
  domain: string;
  status: string;
  progress?: number;
  sourceType?: string;
  createdAt?: string;
}

export async function twentyiStartMigration(
  apiKey: string,
  domain: string,
  sourceType: "cpanel" | "plesk" | "directadmin" | "other",
  host: string,
  username: string,
  password: string,
  siteId?: string,
): Promise<{ id: string }> {
  const body: any = {
    domain,
    migration_type: sourceType,
    source_host: host,
    source_username: username,
    source_password: password,
  };
  if (siteId) body.web_id = siteId;
  const result = await twentyiRequest(apiKey, "POST", "/reseller/migration", body);
  const id = result?.id ?? result?.migration_id ?? String(Date.now());
  return { id: String(id) };
}

export async function twentyiListMigrations(apiKey: string): Promise<TwentyIMigration[]> {
  const data = await twentyiRequest(apiKey, "GET", "/reseller/migration");
  if (!Array.isArray(data)) return [];
  return data.map((m: any) => ({
    id: String(m.id ?? ""),
    domain: m.domain ?? m.domain_name ?? "",
    status: m.status ?? "unknown",
    progress: m.progress ?? m.percent ?? 0,
    sourceType: m.migration_type ?? m.type ?? "",
    createdAt: m.created_at ?? m.date ?? "",
  }));
}

export async function twentyiGetMigrationStatus(apiKey: string, migrationId: string): Promise<TwentyIMigration> {
  const result = await twentyiRequest(apiKey, "GET", `/reseller/migration/${migrationId}`);
  return {
    id: String(result.id ?? migrationId),
    domain: result.domain ?? result.domain_name ?? "",
    status: result.status ?? "unknown",
    progress: result.progress ?? result.percent ?? 0,
    sourceType: result.migration_type ?? result.type ?? "",
    createdAt: result.created_at ?? result.date ?? "",
  };
}

// ─── Support Tickets ──────────────────────────────────────────────────────────

export interface TwentyITicket {
  id: string;
  subject: string;
  status: string;
  priority?: string;
  createdAt?: string;
  updatedAt?: string;
  messages?: { from: string; body: string; createdAt: string }[];
}

export async function twentyiListTickets(apiKey: string): Promise<TwentyITicket[]> {
  const data = await twentyiRequest(apiKey, "GET", "/reseller/supportTicket");
  if (!Array.isArray(data)) {
    if (data && typeof data === "object") {
      const arr = Object.values(data);
      if (Array.isArray(arr)) return arr.map((t: any) => ({
        id: String(t.id ?? t.ticket_id ?? ""),
        subject: t.subject ?? "",
        status: t.status ?? "open",
        priority: t.priority,
        createdAt: t.created_at ?? t.date ?? "",
        updatedAt: t.updated_at ?? "",
      }));
    }
    return [];
  }
  return data.map((t: any) => ({
    id: String(t.id ?? t.ticket_id ?? ""),
    subject: t.subject ?? "",
    status: t.status ?? "open",
    priority: t.priority,
    createdAt: t.created_at ?? t.date ?? "",
    updatedAt: t.updated_at ?? "",
  }));
}

export async function twentyiGetTicket(apiKey: string, ticketId: string): Promise<TwentyITicket> {
  const data = await twentyiRequest(apiKey, "GET", `/reseller/supportTicket/${ticketId}`);
  return {
    id: String(data.id ?? ticketId),
    subject: data.subject ?? "",
    status: data.status ?? "open",
    priority: data.priority,
    createdAt: data.created_at ?? "",
    updatedAt: data.updated_at ?? "",
    messages: Array.isArray(data.messages) ? data.messages.map((m: any) => ({
      from: m.from ?? m.author ?? "Support",
      body: m.body ?? m.message ?? "",
      createdAt: m.created_at ?? m.date ?? "",
    })) : [],
  };
}

export async function twentyiCreateTicket(
  apiKey: string,
  subject: string,
  body: string,
  priority: "low" | "normal" | "high" = "normal",
): Promise<{ id: string }> {
  const result = await twentyiRequest(apiKey, "POST", "/reseller/supportTicket", { subject, body, priority });
  const id = result?.id ?? result?.ticket_id ?? String(Date.now());
  return { id: String(id) };
}

export async function twentyiReplyTicket(apiKey: string, ticketId: string, body: string): Promise<void> {
  await twentyiRequest(apiKey, "PUT", `/reseller/supportTicket/${ticketId}`, { body });
}

// ─── SSO / Temporary Login ────────────────────────────────────────────────────

/**
 * Generate a temporary one-click login URL for StackCP.
 * Tries multiple 20i endpoint patterns for compatibility across API versions.
 */
export async function twentyiGetSSOUrl(apiKey: string, siteId: string): Promise<string> {
  const endpoints = [
    `/userHosting/${siteId}/temporaryLoginLink`,
    `/userHosting/${siteId}/sso`,
    `/userHosting/${siteId}/getLoginLink`,
  ];

  for (const path of endpoints) {
    try {
      const result = await twentyiRequest(apiKey, "GET", path);
      const url = result?.url ?? result?.link ?? result?.loginUrl ?? result?.login_url;
      if (url && typeof url === "string" && url.startsWith("http")) return url;
      // Some endpoints return the URL directly as a string
      if (typeof result === "string" && result.startsWith("http")) return result;
    } catch (err: any) {
      if (err.message?.includes("404")) continue; // Try next endpoint
      throw err;
    }
  }

  // Final fallback — return the static StackCP URL (user must already be logged in)
  return twentyiStackCPUrl(siteId);
}

// ─── IP Whitelist management ───────────────────────────────────────────────────

export interface TwentyIWhitelistResult {
  success: boolean;
  ip: string;
  wasAlreadyPresent: boolean;
  currentList: string[];
  rawResponse?: any;
  error?: string;
}

/**
 * Fetch the current IP whitelist from 20i.
 * Returns an array of whitelisted IP strings.
 * NOTE: This call itself requires the calling IP to be whitelisted.
 */
export async function twentyiGetWhitelist(apiKey: string): Promise<string[]> {
  const data = await twentyiRequest(apiKey, "GET", "/reseller/apiWhitelist");
  // 20i returns { "apiWhitelist": { "ip": {} } } or similar
  const raw = data?.apiWhitelist ?? data ?? {};
  return Object.keys(raw);
}

/**
 * Add an IP address to the 20i API whitelist.
 * Returns full detail for the UI.
 *
 * ⚠ Chicken-and-egg: if the current IP is NOT already whitelisted, this call
 * will also fail with 401. In that case we return success=false with an
 * explanatory message.
 */
export async function twentyiAddToWhitelist(apiKey: string, ip: string): Promise<TwentyIWhitelistResult> {
  const cleanKey = sanitiseKey(apiKey);
  const url = "https://api.20i.com/reseller/apiWhitelist";

  // Build raw request so we can capture the status code even on 401
  const fetchOpts: any = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cleanKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ apiWhitelist: { [ip]: {} } }),
    signal: AbortSignal.timeout(20000),
  };
  const proxy = getProxy();
  if (proxy) fetchOpts.dispatcher = proxy;

  const res = await fetch(url, fetchOpts);
  const rawText = await res.text().catch(() => "");
  let rawResponse: any;
  try { rawResponse = JSON.parse(rawText); } catch { rawResponse = rawText; }

  if (res.status === 401) {
    return {
      success: false,
      ip,
      wasAlreadyPresent: false,
      currentList: [],
      rawResponse,
      error: "chicken_and_egg",
    };
  }

  if (!res.ok) {
    return {
      success: false,
      ip,
      wasAlreadyPresent: false,
      currentList: [],
      rawResponse,
      error: `HTTP ${res.status}`,
    };
  }

  // Fetch updated list after adding
  let currentList: string[] = [];
  try { currentList = await twentyiGetWhitelist(apiKey); } catch { /* ignore */ }
  const wasAlreadyPresent = currentList.includes(ip) && res.status === 200;

  return { success: true, ip, wasAlreadyPresent: false, currentList, rawResponse };
}
