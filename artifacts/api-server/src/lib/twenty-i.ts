/**
 * 20i Reseller API - TypeScript/Node.js Client
 * https://api.20i.com  (official API Blueprint v1)
 *
 * Authentication
 *   Authorization: Bearer {base64(apiKey)}
 *   Per official docs: the raw API key MUST be Base64-encoded before use
 *   as the Bearer token value.
 *
 * Reseller self-reference
 *   All /reseller/{resellerId}/... endpoints use "*" as the resellerId
 *   to refer to yourself (the authenticated reseller).
 *
 * Proxy support
 *   Set TWENTYI_PROXY env var to an HTTP proxy URL to route all calls through it.
 *   Format: http://user:pass@host:port
 */

import axios, { type AxiosRequestConfig } from "axios";
import { AsyncLocalStorage } from "async_hooks";

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = "https://api.20i.com";
const DEFAULT_TIMEOUT_MS = 25_000;
const MAX_RETRIES = 3;

// ─── Per-request context (proxy + key type) ────────────────────────────────────

interface RequestCtx {
  proxyUrl?: string;
  keyType?: string;
}

const _ctxStore = new AsyncLocalStorage<RequestCtx>();

// Legacy: proxy-only override (kept for backwards compat)
const _proxyStore = new AsyncLocalStorage<string | undefined>();

export function runWithProxy<T>(proxyUrl: string | undefined, fn: () => T): T {
  return _proxyStore.run(proxyUrl, fn);
}

export function runWithCtx<T>(ctx: RequestCtx, fn: () => T): T {
  return _ctxStore.run(ctx, fn);
}

// ─── Proxy helpers ────────────────────────────────────────────────────────────

function resolveProxyUrl(): string | undefined {
  const ctx = _ctxStore.getStore();
  if (ctx?.proxyUrl !== undefined) return ctx.proxyUrl || undefined;
  const legacy = _proxyStore.getStore();
  if (legacy !== undefined) return legacy || undefined;
  return process.env.TWENTYI_PROXY || process.env.HTTPS_PROXY || process.env.FIXIE_URL;
}

function resolveKeyType(): string {
  return _ctxStore.getStore()?.keyType ?? "general";
}

function buildAxiosProxy(raw: string): AxiosRequestConfig["proxy"] | undefined {
  try {
    const u = new URL(raw);
    return {
      host: u.hostname,
      port: parseInt(u.port || "80", 10),
      protocol: u.protocol.replace(":", ""),
      ...(u.username
        ? { auth: { username: decodeURIComponent(u.username), password: decodeURIComponent(u.password) } }
        : {}),
    };
  } catch {
    return undefined;
  }
}

export function getProxyConfig(): { enabled: boolean; url?: string } {
  const raw = resolveProxyUrl();
  if (!raw) return { enabled: false };
  return { enabled: true, url: raw.replace(/:[^:@]+@/, ":***@") };
}

// ─── API key sanitisation ─────────────────────────────────────────────────────

// Strip only true invisible/zero-width characters that silently corrupt the Bearer token.
// We intentionally do NOT strip printable ASCII — Combined Keys can be longer and use
// characters like +, /, =, :, which must be preserved.
export function sanitiseKey(key: string): string {
  return key
    .trim()
    .replace(/[\u200B-\u200D\uFEFF\u00AD\u007F]/g, "")   // zero-width + DEL
    .replace(/[\r\n\t]/g, "");                             // carriage-return, newline, tab (pasting artefacts)
}

// Per 20i official docs: BOTH General and Combined API keys must be
// Base64-encoded before use as the Bearer token value.
// General Key:  Authorization: Bearer base64(generalKey)
// Combined Key: Authorization: Bearer base64(combinedKey)   ← same encoding, key is just longer
// There is NO length restriction — Combined Keys are longer than General Keys and are fully supported.
function buildBearerToken(raw: string): string {
  const clean = sanitiseKey(raw);
  // ↓ This is the exact encoding line — works for BOTH General and Combined keys
  const token = Buffer.from(clean).toString("base64");
  return token;
}

// Exported helper for any route that constructs the Authorization header directly.
// Always use this instead of a raw `Bearer ${apiToken}` string.
export function buildAuthHeader(apiKey: string): string {
  return `Bearer ${buildBearerToken(apiKey)}`;
}

// ─── Outbound IP detection ────────────────────────────────────────────────────

export async function getOutboundIp(): Promise<string> {
  try {
    const proxyUrl = resolveProxyUrl();
    const cfg: AxiosRequestConfig = { timeout: 8_000 };
    if (proxyUrl) {
      const proxy = buildAxiosProxy(proxyUrl);
      if (proxy) cfg.proxy = proxy;
    }
    const res = await axios.get<{ ip: string }>("https://api.ipify.org?format=json", cfg);
    const ip = res.data?.ip ?? "unknown";
    const via = proxyUrl ? `via proxy` : `direct — no proxy`;
    console.log(`[20i] Outbound IP (${via}): ${ip}  \u2190 whitelist THIS in 20i, or set TWENTYI_PROXY for a static IP`);
    return ip;
  } catch {
    return "unknown";
  }
}

// ─── Core HTTP request ────────────────────────────────────────────────────────

async function request<T = any>(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = buildBearerToken(apiKey);
  const url = `${BASE_URL}${path}`;
  const proxyUrl = resolveProxyUrl();

  console.log(`[20i] -> ${method} ${url}`);

  const cfg: AxiosRequestConfig = {
    method: method as any,
    url,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...(body !== undefined ? { data: body } : {}),
    timeout: DEFAULT_TIMEOUT_MS,
    validateStatus: () => true,
  };

  if (proxyUrl) {
    const proxy = buildAxiosProxy(proxyUrl);
    if (proxy) cfg.proxy = proxy;
  }

  const res = await axios(cfg);
  const bodyPreview = JSON.stringify(res.data).substring(0, 300);
  console.log(`[20i] <- HTTP ${res.status}  body=${bodyPreview}`);

  if (res.status >= 200 && res.status < 300) return res.data as T;

  const raw = typeof res.data === "string" ? res.data : JSON.stringify(res.data);

  if (res.status === 401) {
    let errType: string | null = null;
    try { errType = (typeof res.data === "object" ? res.data?.type : JSON.parse(raw)?.type) ?? null; } catch { /* ignore */ }
    if (errType === "User ID") {
      throw new Error(
        `20i Authentication failed (401) — KEY NOT RECOGNISED. ` +
        `Your API key was rejected by 20i. Verify that you are using a valid General Key or Combined Key from my.20i.com → Reseller API. ` +
        `Response: ${raw.substring(0, 200)}`,
      );
    }
    throw new Error(
      `20i Authentication failed (401) — IP NOT WHITELISTED or key invalid. ` +
      `Add this server's outbound IP at my.20i.com → Reseller API → IP Whitelist, then retry. ` +
      `Response: ${raw.substring(0, 200)}`,
    );
  }
  if (res.status === 403) {
    throw new Error(
      `20i Forbidden (403). Make sure you are using a Reseller Combined API key. ` +
      `Response: ${raw.substring(0, 200)}`,
    );
  }
  if (res.status === 404) {
    throw new Error(`20i Endpoint not found (404): ${path}`);
  }
  if (res.status === 429) {
    throw new Error("20i Rate limit exceeded (429). Please wait before retrying.");
  }
  if (res.status >= 500) {
    throw new Error(`20i Server error (${res.status}): ${raw.substring(0, 200)}`);
  }

  throw new Error(`20i API error ${res.status}: ${raw.substring(0, 300)}`);
}

// Retry up to MAX_RETRIES times using exponential backoff. Skips retry on auth/not-found errors.
async function requestWithRetry<T = any>(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  let lastErr!: Error;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await request<T>(apiKey, method, path, body);
    } catch (err: any) {
      lastErr = err;
      const msg: string = err.message ?? "";
      if (msg.includes("401") || msg.includes("403") || msg.includes("404")) throw err;
      if (attempt < MAX_RETRIES) {
        const delay = attempt * 1_200;
        console.warn(`[20i] attempt ${attempt} failed (${msg.substring(0, 80)}), retrying in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TwentyIPackageType {
  id: string;
  label: string;
  platform: string;
  limits?: Record<string, any>;
  installApps?: string[];
  extraData?: { temporaryUrlDomain?: string; phpVersion?: string };
}

export interface TwentyISite {
  id: string;
  name: string;
  domain: string;
  status: "active" | "suspended" | string;
  packageTypeName?: string;
  platform?: string;
  enabled: boolean;
  created?: string;
  names?: string[];
  stackUsers?: string[];
  typeRef?: string;
}

export interface TwentyIStackUser {
  id: string;
  name: string;
  email?: string;
  type: string;
  masterFtp?: boolean;
  siteCount?: number;
}

export interface TwentyICreateResult {
  siteId: string | null;
  cpanelUrl: string;
  webmailUrl: string;
}

export interface TwentyIConnectionResult {
  success: boolean;
  message: string;
  packageCount?: number;
}

// ─── Debug test (used by diagnostic endpoint) ─────────────────────────────────

export interface TwentyIDebugAttempt {
  format: "raw";
  authHeaderPreview: string;
  status: number | null;
  body: string;
  durationMs: number;
}

export interface TwentyIDebugInfo {
  url: string;
  method: string;
  authFormat: string;
  keyLength: number;
  tokenLength: number;   // length of base64-encoded Bearer token — the actual bytes sent over the wire
  keyFirst4: string;
  keyLast4: string;
  keyHasHiddenChars: boolean;
  outboundIp: string;
  proxyActive: boolean;
  proxyUrl?: string;
  responseStatus: number | null;
  responseBody: string;
  durationMs: number;
  attempts: TwentyIDebugAttempt[];
  workingFormat: "raw" | "none";
  // Parsed from the 20i error JSON: "User ID" = wrong key, "GeneralApiKey" = IP blocked, etc.
  twentyiErrorType: string | null;
  // Human-readable diagnosis
  diagnosis: "connected" | "wrong_key" | "ip_blocked" | "unknown_401" | "error";
}

export async function twentyiRawDebug(apiKey: string): Promise<TwentyIDebugInfo> {
  const rawKey = apiKey;
  const cleanKey = sanitiseKey(apiKey);
  const keyHasHiddenChars = cleanKey !== rawKey;
  const keyLen = cleanKey.length;
  const token = buildBearerToken(apiKey);   // base64(cleanKey)
  const tokenLen = token.length;            // bytes sent in the Authorization header
  const keyMask = keyLen > 8
    ? `Bearer ${"*".repeat(Math.max(0, keyLen - 4))}${cleanKey.slice(-4)}`
    : `Bearer ${"*".repeat(keyLen)}`;

  // ── Diagnostic log (visible in server console) ─────────────────────────────
  console.log(
    `[20i-DEBUG] raw_key_len=${rawKey.length}  clean_key_len=${keyLen}` +
    `  token_b64_len=${tokenLen}  stripped=${keyHasHiddenChars}` +
    `  first4=${cleanKey.substring(0, 4)}  last4=${cleanKey.slice(-4)}`
  );

  const url = `${BASE_URL}/reseller/*/packageCount`;
  const proxyUrl = resolveProxyUrl();
  const proxyConfig = getProxyConfig();
  const outboundIp = await getOutboundIp();

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
      timeout: DEFAULT_TIMEOUT_MS,
      validateStatus: () => true,
    };
    if (proxyUrl) {
      const proxy = buildAxiosProxy(proxyUrl);
      if (proxy) cfg.proxy = proxy;
    }
    const res = await axios(cfg);
    status = res.status;
    const raw = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    body = raw.length > 600 ? raw.substring(0, 600) + "..." : raw;
    if (res.status >= 200 && res.status < 300) workingFormat = "raw";
  } catch (e: any) {
    body = `Network error: ${e.message}`;
  }

  const durationMs = Date.now() - t0;

  // Parse 20i error type from response body to distinguish key-invalid vs IP-blocked
  let twentyiErrorType: string | null = null;
  let diagnosis: TwentyIDebugInfo["diagnosis"] = "error";
  if (workingFormat === "raw") {
    diagnosis = "connected";
  } else if (status === 401) {
    try {
      const parsed = JSON.parse(body);
      twentyiErrorType = parsed?.type ?? null;
    } catch { /* not JSON */ }
    // "User ID" type means the key is not recognised at all (wrong key)
    // Any other type on 401 means the key decoded fine but IP is blocked
    if (twentyiErrorType === "User ID") {
      diagnosis = "wrong_key";
    } else {
      diagnosis = "ip_blocked";
    }
  } else {
    diagnosis = "unknown_401";
  }

  // Build what the actual Authorization header value looks like (one "Bearer " only)
  const authHeaderPreview = `Authorization: Bearer <base64(${keyLen}-char-key)>`;
  return {
    url,
    method: "GET",
    authFormat: workingFormat === "raw"
      ? `${authHeaderPreview} ✓ accepted`
      : `${authHeaderPreview} ✗ rejected (HTTP ${status})`,
    keyLength: keyLen,
    tokenLength: tokenLen,
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
    twentyiErrorType,
    diagnosis,
    attempts: [{
      format: "raw",
      // Shows exactly what the Authorization header value looks like — one "Bearer " only
      authHeaderPreview: `Bearer <base64(${keyLen}-char-key, first4=${cleanKey.substring(0, 4)}, last4=${cleanKey.slice(-4)})>`,
      status,
      body,
      durationMs,
    }],
  };
}

// ─── IP Whitelist ─────────────────────────────────────────────────────────────
// Endpoint: GET/POST /reseller/*/apiWhitelist

export async function twentyiGetWhitelist(apiKey: string): Promise<string[]> {
  const data = await requestWithRetry<Record<string, any>>(apiKey, "GET", "/reseller/*/apiWhitelist");
  if (data && typeof data === "object") return Object.keys(data);
  return [];
}

export async function twentyiAddToWhitelist(apiKey: string, ip: string): Promise<void> {
  await requestWithRetry(apiKey, "POST", "/reseller/*/apiWhitelist", {
    apiWhitelist: { [ip]: {} },
  });
}

export async function twentyiRemoveFromWhitelist(apiKey: string, ip: string): Promise<void> {
  await requestWithRetry(apiKey, "DELETE", `/reseller/*/apiWhitelist/${ip}`);
}

// Try to auto-add IP to whitelist. Returns { added: boolean, reason: string }.
export async function twentyiAutoWhitelist(
  apiKey: string,
  ip: string,
): Promise<{ added: boolean; reason: string }> {
  try {
    await request(apiKey, "POST", "/reseller/*/apiWhitelist", {
      apiWhitelist: { [ip]: {} },
    });
    console.log(`[20i-WL] Auto-whitelist: added ${ip}`);
    return { added: true, reason: "ok" };
  } catch (e: any) {
    const msg = String(e.message ?? "");
    const reason = msg.includes("403") ? "ip_blocked"
      : msg.includes("401") ? "auth_failed"
      : msg.includes("404") ? "not_supported"
      : "error";
    if (reason === "ip_blocked") {
      console.warn(`[20i-WL] Auto-whitelist: IP ${ip} must be added manually at my.20i.com → Reseller API → IP Whitelist`);
    } else if (reason !== "not_supported") {
      console.warn(`[20i-WL] Auto-whitelist: could not add ${ip} (${reason}): ${msg.substring(0, 120)}`);
    }
    return { added: false, reason };
  }
}

// ─── Connection test ──────────────────────────────────────────────────────────
// Endpoint: GET /reseller/*/packageCount
// Returns: { linux: N, windows: N, wordpress: N }

export async function twentyiTestConnection(apiKey: string): Promise<TwentyIConnectionResult> {
  const cleanKey = sanitiseKey(apiKey);
  if (cleanKey.length < 8) {
    return { success: false, message: "API key is too short. Minimum 8 characters required." };
  }

  try {
    const data = await request<{ linux?: number; windows?: number; wordpress?: number }>(
      cleanKey, "GET", "/reseller/*/packageCount",
    );
    const total = Number(data?.linux ?? 0) + Number(data?.windows ?? 0) + Number(data?.wordpress ?? 0);
    console.log("[20i] Connection test OK — package counts:", data);
    return {
      success: true,
      message: `Connected to 20i API. ${total} package(s) available.`,
      packageCount: total,
    };
  } catch (err: any) {
    return { success: false, message: err.message ?? "Connection failed" };
  }
}

// ─── Package Types ────────────────────────────────────────────────────────────
// Endpoint: GET /reseller/*/packageTypes
// Returns array of package type objects

export async function twentyiGetPackages(apiKey: string): Promise<TwentyIPackageType[]> {
  try {
    const data = await requestWithRetry<any[]>(apiKey, "GET", "/reseller/*/packageTypes");
    const arr = Array.isArray(data) ? data : (data && typeof data === "object" ? Object.values(data) : []);
    return (arr as any[]).map((p: any) => ({
      id: String(p.id ?? ""),
      label: String(p.label ?? p.name ?? p.id ?? "Unknown"),
      platform: String(p.platform ?? "linux"),
      limits: p.limits,
      installApps: p.installApps,
      extraData: p.extraData,
    }));
  } catch {
    return [];
  }
}

// ─── List Sites (Hosting Packages) ────────────────────────────────────────────
// Endpoint: GET /package
// Returns array of all hosting packages for this reseller

export async function twentyiListSites(apiKey: string): Promise<TwentyISite[]> {
  const data = await requestWithRetry<any[]>(apiKey, "GET", "/package");
  const arr = Array.isArray(data) ? data : (data && typeof data === "object" ? Object.values(data) : []);
  return (arr as any[]).map((p: any) => ({
    id: String(p.id ?? ""),
    name: String(p.name ?? p.id ?? ""),
    domain: String(p.name ?? ""),
    status: p.enabled === false ? "suspended" : "active",
    enabled: p.enabled !== false,
    packageTypeName: p.packageTypeName ?? null,
    platform: p.packageTypePlatform ?? null,
    created: p.created ?? null,
    names: Array.isArray(p.names) ? p.names : [],
    stackUsers: Array.isArray(p.stackUsers) ? p.stackUsers : [],
    typeRef: p.typeRef ?? null,
  }));
}

// ─── Create Hosting Package ────────────────────────────────────────────────────
// Endpoint: POST /reseller/*/addWeb
// Body:
//   type          - package type ID (from /reseller/*/packageTypes)
//   domain_name   - primary domain for the site
//   extra_domain_names - array of extra domains (can be empty)
//   label         - memorable name for the package
//   documentRoots - map of domain to document root path (e.g. "public_html")
//   stackUser     - optional: "stack-user:{id}" to link an existing stack user
// Returns: new package ID (integer)

export async function twentyiCreateHosting(
  apiKey: string,
  domain: string,
  _email: string,
  packageTypeId?: string,
  stackUserId?: string,
): Promise<TwentyICreateResult> {
  const body: Record<string, any> = {
    domain_name: domain,
    extra_domain_names: [],
    label: domain,
    documentRoots: { [domain]: "public_html" },
  };

  if (packageTypeId) body.type = packageTypeId;
  if (stackUserId) body.stackUser = stackUserId.startsWith("stack-user:") ? stackUserId : `stack-user:${stackUserId}`;

  const result = await requestWithRetry(apiKey, "POST", "/reseller/*/addWeb", body);

  const siteId: string | null = typeof result === "number"
    ? String(result)
    : result?.id != null
    ? String(result.id)
    : result?.name != null
    ? String(result.name)
    : null;

  const cpanelUrl = siteId ? `https://my.20i.com/cp/${siteId}` : "";
  const webmailUrl = domain ? `https://webmail.${domain}` : "";

  return { siteId, cpanelUrl, webmailUrl };
}

// ─── Suspend / Unsuspend ──────────────────────────────────────────────────────
// Endpoint: POST /package/{packageId}/userStatus
// Body:
//   includeRepeated - when reactivating, true = revoke all deactivations
//   subservices     - { default: false } = suspend, { default: true } = unsuspend
//   subservice_name "default" covers typical set of services
// Returns: true

export async function twentyiSuspend(apiKey: string, siteId: string): Promise<void> {
  await requestWithRetry(apiKey, "POST", `/package/${siteId}/userStatus`, {
    includeRepeated: false,
    subservices: { default: false },
  });
}

export async function twentyiUnsuspend(apiKey: string, siteId: string): Promise<void> {
  await requestWithRetry(apiKey, "POST", `/package/${siteId}/userStatus`, {
    includeRepeated: true,
    subservices: { default: true },
  });
}

// ─── Delete Package ───────────────────────────────────────────────────────────
// Endpoint: POST /reseller/*/deleteWeb
// Body: { "delete-id": [packageId] }
// Returns: { [id]: true }

export async function twentyiDelete(apiKey: string, siteId: string): Promise<void> {
  await requestWithRetry(apiKey, "POST", "/reseller/*/deleteWeb", {
    "delete-id": [siteId],
  });
}

// ─── Change Package Type ──────────────────────────────────────────────────────
// Endpoint: POST /reseller/*/updateWebType
// Body: { "package-id": id, type: newPackageTypeId }

export async function twentyiChangePackageType(
  apiKey: string,
  siteId: string,
  newTypeId: string,
): Promise<void> {
  await requestWithRetry(apiKey, "POST", "/reseller/*/updateWebType", {
    "package-id": siteId,
    type: newTypeId,
  });
}

// ─── Single Sign-On (SSO) ─────────────────────────────────────────────────────
// Endpoint: POST /package/{packageId}/web/userToken
// Body: {} (empty)
// Returns: { token: string } or { loginToken: string } or { url: string }

export async function twentyiGetSSOUrl(apiKey: string, siteId: string): Promise<string | null> {
  try {
    const result = await requestWithRetry(apiKey, "POST", `/package/${siteId}/web/userToken`, {});
    const token = result?.token ?? result?.loginToken ?? result?.userToken ?? null;
    if (token) return `https://my.20i.com/cp/login/${token}`;
    if (result?.url) return result.url;
    return `https://my.20i.com/cp/${siteId}`;
  } catch {
    return `https://my.20i.com/cp/${siteId}`;
  }
}

// Get a static StackCP URL without an SSO token -- always works regardless of auth.
export function twentyiStackCPUrl(siteId: string): string {
  return `https://my.20i.com/cp/${siteId}`;
}

// ─── Free SSL ────────────────────────────────────────────────────────────────
// Endpoint: POST /package/{packageId}/web/freeSSL
// Body: { domains: [domain] }
// Returns: true on success

export async function twentyiInstallSSL(apiKey: string, siteId: string, domain: string): Promise<void> {
  await requestWithRetry(apiKey, "POST", `/package/${siteId}/web/freeSSL`, {
    domains: [domain],
  });
}

// ─── DNS Records ──────────────────────────────────────────────────────────────
// Endpoint: GET /package/{packageId}/domain/{domainId}/dns
// Returns dns record objects

export async function twentyiGetDnsRecords(apiKey: string, siteId: string, domainId?: string): Promise<any[]> {
  try {
    const id = domainId ?? siteId;
    const data = await requestWithRetry(apiKey, "GET", `/package/${siteId}/domain/${id}/dns`);
    return Array.isArray(data) ? data : (typeof data === "object" ? Object.values(data) : []);
  } catch {
    return [];
  }
}

export async function twentyiUpdateDnsRecord(
  apiKey: string,
  siteId: string,
  domainId: string,
  records: any,
): Promise<void> {
  await requestWithRetry(apiKey, "POST", `/package/${siteId}/domain/${domainId}/dns`, records);
}

// ─── Email Configuration ──────────────────────────────────────────────────────
// Endpoint: GET /package/{packageId}/email/{emailId}
// emailId is typically the domain name

export async function twentyiGetEmailConfig(apiKey: string, siteId: string, emailId?: string): Promise<any> {
  try {
    const id = emailId ?? "0";
    return await requestWithRetry(apiKey, "GET", `/package/${siteId}/email/${id}`);
  } catch {
    return null;
  }
}

// ─── Bandwidth Stats ──────────────────────────────────────────────────────────
// Endpoint: GET /package/{packageId}/web/bandwidthStats

export async function twentyiGetBandwidth(apiKey: string, siteId: string): Promise<any> {
  try {
    return await requestWithRetry(apiKey, "GET", `/package/${siteId}/web/bandwidthStats`);
  } catch {
    return null;
  }
}

// ─── Domain Names for a Package ───────────────────────────────────────────────
// Endpoint: GET /package/{packageId}/names

export async function twentyiGetSiteNames(apiKey: string, siteId: string): Promise<string[]> {
  try {
    const data = await requestWithRetry(apiKey, "GET", `/package/${siteId}/names`);
    return Array.isArray(data) ? data.map((n: any) => String(n.name ?? n)) : [];
  } catch {
    return [];
  }
}

// ─── Renewal / Service Dates ──────────────────────────────────────────────────
// Uses the package info to get renewal and expiry dates

export async function twentyiGetSiteRenewalDate(
  apiKey: string,
  siteId: string,
): Promise<{ renewalDate: Date | null; expiryDate: Date | null }> {
  try {
    const data = await requestWithRetry(apiKey, "GET", `/package/${siteId}`);
    const renewal = data?.renewalDate ?? data?.nextRenewalDate ?? data?.renewal_date ?? null;
    const expiry = data?.expiryDate ?? data?.expiry_date ?? data?.expires ?? null;
    return {
      renewalDate: renewal ? new Date(renewal) : null,
      expiryDate: expiry ? new Date(expiry) : null,
    };
  } catch {
    return { renewalDate: null, expiryDate: null };
  }
}

// ─── StackCP Users ────────────────────────────────────────────────────────────
// Endpoint: GET /reseller/*/susers — retrieve stack user configuration
// Endpoint: POST /reseller/*/susers — create / update / delete users
// User ref format: "stack-user:{N}"

export async function twentyiListStackUsers(apiKey: string): Promise<TwentyIStackUser[]> {
  try {
    const data = await requestWithRetry<any>(apiKey, "GET", "/reseller/*/susers");
    if (!data?.users || typeof data.users !== "object") return [];

    const grantMap: Record<string, Record<string, boolean>> = data.grant_map ?? {};

    return Object.entries(data.users).map(([ref, u]: [string, any]) => {
      const grants = grantMap[ref] ?? {};
      const siteCount = Object.keys(grants).length;
      return {
        id: ref,
        name: u.person_name ?? u.name ?? ref,
        email: u.email ?? null,
        type: u.type ?? "stack-user",
        masterFtp: u.masterFtp ?? false,
        siteCount,
      };
    });
  } catch {
    return [];
  }
}

// Create a new StackCP user. Uses POST /reseller/*/susers and passes a newUser payload.
export async function twentyiCreateStackUser(
  apiKey: string,
  email: string,
  name: string,
): Promise<TwentyIStackUser> {
  const result = await requestWithRetry(apiKey, "POST", "/reseller/*/susers", {
    newUser: {
      person_name: name,
      email,
      sendNewStackUserEmail: true,
      cc: "GB",
      sp: "",
      pc: "",
      address: "",
      city: "",
      voice: "",
      notes: "",
      billing_ref: "",
    },
  });

  const ref = result?.userRef ?? result?.id ?? result?.user_id ?? null;
  if (!ref) throw new Error(`20i did not return a user ref. Response: ${JSON.stringify(result).substring(0, 200)}`);

  return { id: String(ref), name, type: "stack-user", masterFtp: false };
}

// Get an existing StackCP user by email, or create a new one if not found.
export async function twentyiGetOrCreateStackUser(
  apiKey: string,
  email: string,
  name: string,
): Promise<TwentyIStackUser> {
  const existing = await twentyiListStackUsers(apiKey);
  const found = existing.find((u) =>
    u.email?.toLowerCase() === email.toLowerCase() ||
    u.name?.toLowerCase() === email.toLowerCase()
  );
  if (found) return found;
  return twentyiCreateStackUser(apiKey, email, name);
}

// Delete a StackCP user by reference (e.g. "stack-user:1").
export async function twentyiDeleteStackUser(apiKey: string, userId: string): Promise<void> {
  const ref = userId.startsWith("stack-user:") ? userId : `stack-user:${userId}`;
  await requestWithRetry(apiKey, "POST", "/reseller/*/susers", {
    users: { [ref]: { delete: true } },
  });
}

// Set or reset a StackCP user's password.
export async function twentyiSetStackUserPassword(apiKey: string, userId: string, password: string): Promise<void> {
  const ref = userId.startsWith("stack-user:") ? userId : `stack-user:${userId}`;
  await requestWithRetry(apiKey, "POST", "/reseller/*/susers", {
    users: { [ref]: { password } },
  });
}

// Assign a hosting package to a StackCP user via grant_map.
export async function twentyiAssignSiteToUser(
  apiKey: string,
  siteId: string,
  stackUserId: string,
): Promise<void> {
  const userRef = stackUserId.startsWith("stack-user:") ? stackUserId : `stack-user:${stackUserId}`;
  const serviceRef = siteId.startsWith("stack-hosting:") ? siteId : `stack-hosting:${siteId}`;
  await requestWithRetry(apiKey, "POST", "/reseller/*/susers", {
    grant_map: { [userRef]: { [serviceRef]: true } },
  });
}

// ─── Domain Registration ──────────────────────────────────────────────────────
// Endpoint: POST /reseller/*/addDomain

export async function twentyiRegisterDomain(
  apiKey: string,
  domain: string,
  years = 1,
  contact: Record<string, unknown> = {},
): Promise<any> {
  return requestWithRetry(apiKey, "POST", "/reseller/*/addDomain", {
    domain,
    years,
    contact,
  });
}

// ─── List Domains ─────────────────────────────────────────────────────────────
// Endpoint: GET /domain

export async function twentyiGetDomains(apiKey: string): Promise<any[]> {
  try {
    const data = await requestWithRetry(apiKey, "GET", "/domain");
    return Array.isArray(data) ? data : (typeof data === "object" ? Object.values(data) : []);
  } catch {
    return [];
  }
}

// ─── Site Migrations ──────────────────────────────────────────────────────────
// Note: 20i's migration API is an internal/support feature.
// These functions attempt the most likely endpoints; gracefully fall back to [].

export async function twentyiStartMigration(
  apiKey: string,
  domain: string,
  sourceType: string,
  host: string,
  username: string,
  password: string,
  siteId?: string,
): Promise<any> {
  try {
    const body: Record<string, any> = {
      domain,
      source: { type: sourceType, host, username, password },
    };
    if (siteId) body.packageId = siteId;
    return await requestWithRetry(apiKey, "POST", "/reseller/*/addMigration", body);
  } catch (e: any) {
    throw new Error(`20i migration start failed: ${e.message}`);
  }
}

export async function twentyiListMigrations(apiKey: string): Promise<any[]> {
  try {
    const data = await requestWithRetry(apiKey, "GET", "/reseller/*/migrations");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function twentyiGetMigrationStatus(apiKey: string, migrationId: string): Promise<any> {
  try {
    return await requestWithRetry(apiKey, "GET", `/reseller/*/migration/${migrationId}`);
  } catch (e: any) {
    return { error: e.message };
  }
}

// ─── Support Tickets ──────────────────────────────────────────────────────────
// 20i ticket management — standard support ticket endpoints

export async function twentyiListTickets(apiKey: string): Promise<any[]> {
  try {
    const data = await requestWithRetry(apiKey, "GET", "/reseller/*/tickets");
    return Array.isArray(data) ? data : (typeof data === "object" ? Object.values(data) : []);
  } catch {
    return [];
  }
}

export async function twentyiGetTicket(apiKey: string, ticketId: string): Promise<any> {
  return requestWithRetry(apiKey, "GET", `/reseller/*/ticket/${ticketId}`);
}

export async function twentyiCreateTicket(
  apiKey: string,
  subject: string,
  body: string,
  priority: "low" | "normal" | "high" | "urgent" = "normal",
): Promise<any> {
  return requestWithRetry(apiKey, "POST", "/reseller/*/addTicket", {
    subject,
    body,
    type: "General",
    priority,
  });
}

export async function twentyiReplyTicket(
  apiKey: string,
  ticketId: string,
  body: string,
): Promise<void> {
  await requestWithRetry(apiKey, "POST", `/reseller/*/ticket/${ticketId}/reply`, { body, message: body });
}

// ─── PHP Version ──────────────────────────────────────────────────────────────
// Endpoint: POST /package/{packageId}/web/phpVersion

export async function twentyiSetPhpVersion(
  apiKey: string,
  siteId: string,
  phpVersion: string,
): Promise<void> {
  await requestWithRetry(apiKey, "POST", `/package/${siteId}/web/phpVersion`, {
    phpVersion,
  });
}

// ─── CDN Management ───────────────────────────────────────────────────────────
// Endpoint: POST /package/{packageId}/web/manageCdn

export async function twentyiSetCdn(
  apiKey: string,
  siteId: string,
  enabled: boolean,
): Promise<void> {
  await requestWithRetry(apiKey, "POST", `/package/${siteId}/web/manageCdn`, { enabled });
}

// ─── Force HTTPS ──────────────────────────────────────────────────────────────
// Endpoint: POST /package/{packageId}/web/forceSSL

export async function twentyiForceHttps(
  apiKey: string,
  siteId: string,
  enabled: boolean,
): Promise<void> {
  await requestWithRetry(apiKey, "POST", `/package/${siteId}/web/forceSSL`, { enabled });
}
