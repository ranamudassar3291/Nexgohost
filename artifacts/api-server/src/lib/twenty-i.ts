/**
 * 20i Hosting API Module — axios-based transport
 * https://my.20i.com/reseller/apidoc
 *
 * Auth:    Bearer <raw_api_key>  (NO Base64)
 * Base URL: https://api.20i.com
 *
 * Proxy support: Set TWENTYI_PROXY (or HTTPS_PROXY / FIXIE_URL) env var.
 * Format: http://user:pass@proxy.host:port
 */
import axios, { AxiosRequestConfig, AxiosError } from "axios";
import { AsyncLocalStorage } from "async_hooks";

// ─── Per-request proxy override ───────────────────────────────────────────────
const _requestProxyStore = new AsyncLocalStorage<string | undefined>();

export function runWithProxy<T>(proxyUrl: string | undefined, fn: () => T): T {
  return _requestProxyStore.run(proxyUrl, fn);
}

// ─── Proxy helpers ────────────────────────────────────────────────────────────

function getProxyUrl(): string | undefined {
  const requestProxy = _requestProxyStore.getStore();
  if (requestProxy !== undefined) return requestProxy || undefined;
  return process.env.TWENTYI_PROXY || process.env.HTTPS_PROXY || process.env.FIXIE_URL;
}

function buildAxiosProxy(proxyUrl: string): AxiosRequestConfig["proxy"] | undefined {
  try {
    const u = new URL(proxyUrl);
    return {
      host: u.hostname,
      port: parseInt(u.port || "80"),
      protocol: u.protocol.replace(":", ""),
      ...(u.username ? { auth: { username: decodeURIComponent(u.username), password: decodeURIComponent(u.password) } } : {}),
    };
  } catch {
    return undefined;
  }
}

export function getProxyConfig(): { enabled: boolean; url?: string } {
  const raw = getProxyUrl();
  if (!raw) return { enabled: false };
  return { enabled: true, url: raw.replace(/:[^:@]+@/, ":***@") };
}

// ─── Outbound IP detection ────────────────────────────────────────────────────

export async function getOutboundIp(): Promise<string> {
  try {
    const proxyUrl = getProxyUrl();
    const cfg: AxiosRequestConfig = { timeout: 8000 };
    if (proxyUrl) cfg.proxy = buildAxiosProxy(proxyUrl);
    const res = await axios.get<{ ip: string }>("https://api.ipify.org?format=json", cfg);
    const ip = res.data?.ip ?? "unknown";
    console.log(`[20i] Outbound IP (${proxyUrl ? "via proxy" : "direct — no proxy"}): ${ip}  ← whitelist THIS in 20i, or set TWENTYI_PROXY for a static IP`);
    return ip;
  } catch {
    return "unknown";
  }
}

// ─── Key sanitisation ─────────────────────────────────────────────────────────

export function sanitiseKey(apiKey: string): string {
  return apiKey.trim().replace(/[\u200B-\u200D\uFEFF\u00AD\u0000-\u001F\u007F]/g, "");
}

// ─── Core axios request ───────────────────────────────────────────────────────

async function twentyiRequestRaw(apiKey: string, method: string, path: string, body?: unknown): Promise<any> {
  const cleanKey = sanitiseKey(apiKey);
  // 20i requires the API key to be Base64-encoded in the Bearer token (per official docs)
  const token = Buffer.from(cleanKey).toString("base64");
  const url = `https://api.20i.com${path}`;

  console.log(`[20i] → ${method} ${url}`);
  console.log(`[20i]   raw_key: ${cleanKey.substring(0, 4)}****${cleanKey.slice(-4)} (len=${cleanKey.length})`);
  console.log(`[20i]   b64_token: ${token.substring(0, 8)}... (len=${token.length})`);

  const cfg: AxiosRequestConfig = {
    method: method as any,
    url,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    data: body,
    timeout: 25000,
    validateStatus: () => true,   // handle all statuses ourselves
  };

  const proxyUrl = getProxyUrl();
  if (proxyUrl) {
    const proxy = buildAxiosProxy(proxyUrl);
    if (proxy) cfg.proxy = proxy;
    console.log(`[20i]   Proxy: ${proxyUrl.replace(/:[^:@]+@/, ":***@")}`);
  }

  const res = await axios(cfg);
  console.log(`[20i] ← HTTP ${res.status}  body=${JSON.stringify(res.data).substring(0, 300)}`);

  if (res.status >= 200 && res.status < 300) {
    console.log(`[20i] ✓ ${method} ${path} → HTTP ${res.status}`);
    return res.data;
  }

  const bodyStr = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
  console.error(`[20i] ✗ ${method} ${path} → HTTP ${res.status}  body: ${bodyStr.substring(0, 300)}`);

  if (res.status === 401) {
    const proxyActive = !!proxyUrl;
    throw new Error(
      `20i auth failed (401) — Authorization Bearer sent. ` +
      (proxyActive
        ? `Proxy active — check if proxy IP is also whitelisted.`
        : `Check: (1) IP whitelisted at my.20i.com → Reseller API → IP Whitelist. (2) API key is correct.`) +
      ` Raw: ${bodyStr.substring(0, 200)}`
    );
  }
  if (res.status === 403) throw new Error(`20i permission denied (403). Use a Reseller Combined key. Raw: ${bodyStr.substring(0, 200)}`);
  if (res.status === 404) throw new Error(`20i endpoint not found (404): ${path}`);
  if (res.status === 429) throw new Error("20i rate limit hit (429) — please wait and retry.");
  if (res.status === 500) throw new Error(`20i server error (500): ${bodyStr.substring(0, 200)}`);
  throw new Error(`20i API error ${res.status}: ${bodyStr.substring(0, 300)}`);
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

// ─── Internal whitelist-add (no circular import) ──────────────────────────────

async function twentyiAddToWhitelistRaw(cleanKey: string, ip: string): Promise<void> {
  try {
    await twentyiRequestRaw(cleanKey, "POST", "/reseller/apiWhitelist", { apiWhitelist: { [ip]: {} } });
    console.log(`[20i] Auto-whitelist: ✓ Added ${ip}`);
  } catch (e: any) {
    console.warn(`[20i] Auto-whitelist: Could not add ${ip} — ${e.message}`);
  }
}

// ─── Probe helper ─────────────────────────────────────────────────────────────

async function probeEndpoints(apiKey: string, method: string, paths: string[]): Promise<{ path: string; data: any }> {
  let lastErr: Error | null = null;
  for (const path of paths) {
    try {
      const data = await twentyiRequestRaw(apiKey, method, path);
      return { path, data };
    } catch (err: any) {
      lastErr = err;
      const msg = err.message ?? "";
      if (msg.includes("401") || msg.includes("403")) throw err;
      if (msg.includes("404")) continue;
      throw err;
    }
  }
  throw lastErr ?? new Error("All endpoint variants returned 404 — check your API key and reseller account.");
}

// ─── Debug info (used by pre-save test endpoint) ──────────────────────────────

export interface TwentyIDebugInfo {
  url: string;
  method: string;
  authFormat: string;
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
  format: "raw";
  authHeaderPreview: string;
  status: number | null;
  body: string;
  durationMs: number;
}

/**
 * Makes a raw, fully-logged test request to 20i /reseller using raw Bearer.
 * Returns full debug info including real outbound IP.
 */
export async function twentyiRawDebug(apiKey: string): Promise<TwentyIDebugInfo & { attempts: TwentyIDebugAttempt[]; workingFormat: "raw" | "none" }> {
  const rawKey = apiKey;
  const cleanKey = sanitiseKey(apiKey);
  const keyHasHiddenChars = cleanKey !== rawKey;
  const keyLen = cleanKey.length;
  const keyMask = keyLen > 8
    ? `Bearer ${"*".repeat(Math.max(0, keyLen - 4))}${cleanKey.slice(-4)}`
    : `Bearer ${"*".repeat(keyLen)}`;

  const url = "https://api.20i.com/reseller/*/packageCount";
  const proxyConfig = getProxyConfig();
  const proxyUrl = getProxyUrl();

  const outboundIp = await getOutboundIp();

  // Base64-encode the API key (required by official 20i docs)
  const token = Buffer.from(cleanKey).toString("base64");

  const t0 = Date.now();
  let status: number | null = null;
  let body = "";
  let workingFormat: "raw" | "none" = "none";

  try {
    const cfg: AxiosRequestConfig = {
      method: "GET",
      url,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 20000,
      validateStatus: () => true,
    };
    if (proxyUrl) {
      const proxy = buildAxiosProxy(proxyUrl);
      if (proxy) cfg.proxy = proxy;
    }
    const res = await axios(cfg);
    status = res.status;
    const raw = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    body = raw.length > 600 ? raw.substring(0, 600) + "…" : raw;
    if (res.status >= 200 && res.status < 300) workingFormat = "raw";
  } catch (e: any) {
    body = `Network error: ${e.message}`;
  }

  const durationMs = Date.now() - t0;

  return {
    url,
    method: "GET",
    authFormat: workingFormat === "raw" ? `${keyMask} ✓ (raw Bearer — working)` : `${keyMask} ✗ (raw Bearer — failed)`,
    keyLength: keyLen,
    keyFirst4: cleanKey.substring(0, 4),
    keyLast4: cleanKey.slice(-4),
    keyHasHiddenChars,
    outboundIp,
    proxyActive: proxyConfig.enabled,
    proxyUrl: proxyConfig.url,
    responseStatus: status,
    responseBody: body,
    durationMs,
    workingFormat,
    attempts: [{
      format: "raw",
      authHeaderPreview: keyMask,
      status,
      body,
      durationMs,
    }],
  };
}

// ─── Connection test ──────────────────────────────────────────────────────────

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

export async function twentyiTestConnection(apiKey: string): Promise<TwentyIConnectionResult> {
  const cleanKey = sanitiseKey(apiKey);
  console.log(`[20i] Testing connection — key_len=${cleanKey.length}  last4=${cleanKey.slice(-4)}`);

  // Step 1: Verify auth with the reseller packageCount endpoint
  let resellerOk = false;
  try {
    await probeEndpoints(apiKey, "GET", ["/reseller/*/packageCount"]);
    resellerOk = true;
    console.log("[20i] ✓ Reseller auth OK");
  } catch (err: any) {
    const msg = err.message ?? "";
    if (msg.includes("401") || msg.includes("auth failed") || msg.includes("403") || msg.includes("permission")) {
      return {
        success: false,
        message: "Authentication failed (401 Unauthorized)",
        diagnostic: {
          step: "Authentication",
          detail: "Check: (1) IP whitelisted at my.20i.com → Reseller API → IP Whitelist. (2) API key is a valid Reseller Combined key.",
        },
      };
    }
    console.warn(`[20i] /reseller/*/packageCount probe non-fatal: ${msg}`);
  }

  // Step 2: Find the packages/accounts endpoint
  const PACKAGE_PATHS = ["/reseller/*/packageTypes", "/package"];
  try {
    const { path, data } = await probeEndpoints(apiKey, "GET", PACKAGE_PATHS);
    const packages = Array.isArray(data) ? data : (typeof data === "object" && data !== null ? Object.values(data) : []);
    const count = packages.length;
    console.log(`[20i] ✓ Packages found at ${path} — ${count} package(s)`);
    return {
      success: true,
      message: `Connected to 20i API. ${count} package(s) available.`,
      packageCount: count,
      diagnostic: { step: "Packages", endpoint: path },
    };
  } catch (err: any) {
    const msg = err.message ?? "";
    if (resellerOk) {
      return {
        success: true,
        message: "Connected to 20i API. No packages found — create some in your 20i reseller portal.",
        packageCount: 0,
        diagnostic: { step: "Packages", detail: "Auth OK but package endpoint returned 404." },
      };
    }
    return {
      success: false,
      message: msg,
      diagnostic: { step: "Packages", detail: msg },
    };
  }
}

// ─── Packages ─────────────────────────────────────────────────────────────────

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

// ─── Create hosting account ───────────────────────────────────────────────────

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

// ─── Suspend / Unsuspend / Delete ─────────────────────────────────────────────

export async function twentyiSuspend(apiKey: string, siteId: string): Promise<void> {
  await twentyiRequest(apiKey, "POST", `/userHosting/${siteId}/updateSubscription`, { status: 0 });
}

export async function twentyiUnsuspend(apiKey: string, siteId: string): Promise<void> {
  await twentyiRequest(apiKey, "POST", `/userHosting/${siteId}/updateSubscription`, { status: 1 });
}

export async function twentyiDelete(apiKey: string, siteId: string): Promise<void> {
  await twentyiRequest(apiKey, "DELETE", `/userHosting/${siteId}`);
}

// ─── SSL ──────────────────────────────────────────────────────────────────────

export async function twentyiInstallSSL(apiKey: string, siteId: string, domain: string): Promise<void> {
  await twentyiRequest(apiKey, "POST", `/userHosting/${siteId}/freeSSL`, { domains: [domain] });
}

// ─── Site info ────────────────────────────────────────────────────────────────

export async function twentyiGetSiteInfo(apiKey: string, siteId: string): Promise<any> {
  return twentyiRequest(apiKey, "GET", `/userHosting/${siteId}`);
}

// ─── StackCP URL ──────────────────────────────────────────────────────────────

export function twentyiStackCPUrl(siteId: string): string {
  return `https://my.20i.com/cp/${siteId}`;
}

// ─── StackUsers ───────────────────────────────────────────────────────────────

export interface TwentyIStackUser {
  id: string;
  email: string;
  name: string;
}

export async function twentyiCreateStackUser(apiKey: string, email: string, name: string): Promise<TwentyIStackUser> {
  const result = await twentyiRequest(apiKey, "POST", "/reseller/addUser", { email, name });
  const id = result?.id ?? result?.user_id ?? result?.userId;
  if (!id) throw new Error(`20i did not return a StackUser ID. Response: ${JSON.stringify(result).substring(0, 200)}`);
  return { id: String(id), email, name };
}

export async function twentyiListStackUsers(apiKey: string): Promise<TwentyIStackUser[]> {
  const data = await twentyiRequest(apiKey, "GET", "/reseller/users");
  if (!Array.isArray(data)) return [];
  return data.map((u: any) => ({ id: String(u.id ?? u.user_id ?? ""), email: u.email ?? "", name: u.name ?? "" }));
}

export async function twentyiGetOrCreateStackUser(apiKey: string, email: string, name: string): Promise<TwentyIStackUser> {
  try {
    const users = await twentyiListStackUsers(apiKey);
    const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) return existing;
  } catch { /* ignore list errors — proceed to create */ }
  return twentyiCreateStackUser(apiKey, email, name);
}

export async function twentyiAssignSiteToUser(apiKey: string, siteId: string, stackUserId: string): Promise<void> {
  await twentyiRequest(apiKey, "POST", `/reseller/addUserToHosting`, { web_hosting_id: siteId, user_id: stackUserId });
}

// ─── Domain management ────────────────────────────────────────────────────────

export async function twentyiGetDomains(apiKey: string): Promise<any[]> {
  try {
    const data = await twentyiRequest(apiKey, "GET", "/reseller/domain");
    return Array.isArray(data) ? data : (typeof data === "object" ? Object.values(data) : []);
  } catch { return []; }
}

export async function twentyiRegisterDomain(
  apiKey: string,
  domain: string,
  years = 1,
  contact: Record<string, unknown> = {},
): Promise<any> {
  return twentyiRequest(apiKey, "POST", "/reseller/addDomain", { domain, years, contact });
}

// ─── Bandwidth / stats ────────────────────────────────────────────────────────

export async function twentyiGetBandwidth(apiKey: string, siteId: string): Promise<any> {
  try { return await twentyiRequest(apiKey, "GET", `/userHosting/${siteId}/bandwidth`); }
  catch { return null; }
}

// ─── IP whitelist management ──────────────────────────────────────────────────

export async function twentyiGetWhitelist(apiKey: string): Promise<string[]> {
  try {
    const data = await twentyiRequest(apiKey, "GET", "/reseller/apiWhitelist");
    if (data && typeof data === "object") return Object.keys(data);
    return [];
  } catch { return []; }
}

export async function twentyiAddToWhitelist(apiKey: string, ip: string): Promise<void> {
  await twentyiRequest(apiKey, "POST", "/reseller/apiWhitelist", { apiWhitelist: { [ip]: {} } });
}

export async function twentyiRemoveFromWhitelist(apiKey: string, ip: string): Promise<void> {
  await twentyiRequest(apiKey, "DELETE", `/reseller/apiWhitelist/${ip}`);
}

// ─── Email hosting ────────────────────────────────────────────────────────────

export async function twentyiGetEmailBoxes(apiKey: string, siteId: string): Promise<any[]> {
  try {
    const data = await twentyiRequest(apiKey, "GET", `/userHosting/${siteId}/email`);
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

export async function twentyiCreateEmailBox(
  apiKey: string,
  siteId: string,
  localPart: string,
  password: string,
): Promise<any> {
  return twentyiRequest(apiKey, "POST", `/userHosting/${siteId}/email`, { localPart, password });
}

// ─── DNS management ───────────────────────────────────────────────────────────

export async function twentyiGetDnsRecords(apiKey: string, siteId: string): Promise<any[]> {
  try {
    const data = await twentyiRequest(apiKey, "GET", `/userHosting/${siteId}/dns`);
    return Array.isArray(data) ? data : (typeof data === "object" ? Object.values(data) : []);
  } catch { return []; }
}

export async function twentyiUpdateDnsRecord(
  apiKey: string,
  siteId: string,
  record: { type: string; host: string; data: string; ttl?: number },
): Promise<any> {
  return twentyiRequest(apiKey, "POST", `/userHosting/${siteId}/dns`, record);
}

// ─── FTP users ────────────────────────────────────────────────────────────────

export async function twentyiGetFtpUsers(apiKey: string, siteId: string): Promise<any[]> {
  try {
    const data = await twentyiRequest(apiKey, "GET", `/userHosting/${siteId}/ftpUsers`);
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

// ─── MySQL databases ──────────────────────────────────────────────────────────

export async function twentyiGetDatabases(apiKey: string, siteId: string): Promise<any[]> {
  try {
    const data = await twentyiRequest(apiKey, "GET", `/userHosting/${siteId}/mysql`);
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

// ─── PHP settings ─────────────────────────────────────────────────────────────

export async function twentyiGetPhpVersion(apiKey: string, siteId: string): Promise<string | null> {
  try {
    const data = await twentyiRequest(apiKey, "GET", `/userHosting/${siteId}/web`);
    return data?.phpVersion ?? null;
  } catch { return null; }
}

export async function twentyiSetPhpVersion(apiKey: string, siteId: string, version: string): Promise<void> {
  await twentyiRequest(apiKey, "POST", `/userHosting/${siteId}/web`, { phpVersion: version });
}

// ─── Stack Users (extended) ───────────────────────────────────────────────────

export async function twentyiDeleteStackUser(apiKey: string, userId: string): Promise<void> {
  await twentyiRequest(apiKey, "DELETE", `/reseller/user/${userId}`);
}

// ─── List sites ───────────────────────────────────────────────────────────────

export interface TwentyISite {
  id: string;
  name: string;
  domain?: string;
  status?: string;
  packageId?: string;
}

export async function twentyiListSites(apiKey: string): Promise<TwentyISite[]> {
  try {
    const data = await twentyiRequest(apiKey, "GET", "/reseller/web");
    const arr = Array.isArray(data) ? data : (typeof data === "object" && data !== null ? Object.values(data) : []);
    return (arr as any[]).map((s: any) => ({
      id: String(s.id ?? s.web_name ?? s.name ?? ""),
      name: String(s.name ?? s.domain ?? s.id ?? ""),
      domain: s.domain ?? s.name ?? undefined,
      status: s.status ?? undefined,
      packageId: s.package_id ?? s.packageId ?? undefined,
    }));
  } catch { return []; }
}

// ─── SSO URL ──────────────────────────────────────────────────────────────────

export async function twentyiGetSSOUrl(apiKey: string, siteId: string): Promise<string> {
  const data = await twentyiRequest(apiKey, "GET", `/userHosting/${siteId}/ssoURL`);
  return data?.url ?? data?.sso_url ?? data ?? "";
}

// ─── Migrations ───────────────────────────────────────────────────────────────

export async function twentyiStartMigration(
  apiKey: string,
  siteId: string,
  options: Record<string, unknown> = {},
): Promise<any> {
  return twentyiRequest(apiKey, "POST", `/userHosting/${siteId}/migrate`, options);
}

export async function twentyiListMigrations(apiKey: string): Promise<any[]> {
  try {
    const data = await twentyiRequest(apiKey, "GET", "/reseller/migrations");
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

export async function twentyiGetMigrationStatus(apiKey: string, migrationId: string): Promise<any> {
  return twentyiRequest(apiKey, "GET", `/reseller/migrations/${migrationId}`);
}

// ─── Support tickets ──────────────────────────────────────────────────────────

export async function twentyiListTickets(apiKey: string): Promise<any[]> {
  try {
    const data = await twentyiRequest(apiKey, "GET", "/reseller/tickets");
    return Array.isArray(data) ? data : (typeof data === "object" ? Object.values(data) : []);
  } catch { return []; }
}

export async function twentyiGetTicket(apiKey: string, ticketId: string): Promise<any> {
  return twentyiRequest(apiKey, "GET", `/reseller/tickets/${ticketId}`);
}

export async function twentyiCreateTicket(
  apiKey: string,
  subject: string,
  message: string,
  options: Record<string, unknown> = {},
): Promise<any> {
  return twentyiRequest(apiKey, "POST", "/reseller/tickets", { subject, message, ...options });
}

export async function twentyiReplyTicket(apiKey: string, ticketId: string, message: string): Promise<any> {
  return twentyiRequest(apiKey, "POST", `/reseller/tickets/${ticketId}`, { message });
}

// ─── Renewal date ─────────────────────────────────────────────────────────────

export async function twentyiGetSiteRenewalDate(apiKey: string, siteId: string): Promise<string | null> {
  try {
    const data = await twentyiRequest(apiKey, "GET", `/userHosting/${siteId}/renewalDate`);
    return data?.renewalDate ?? data?.renewal_date ?? null;
  } catch { return null; }
}
