/**
 * 20i Reseller API - TypeScript/Node.js Client
 * https://api.20i.com  (official API Blueprint v1)
 *
 * Authentication
 *   Authorization: Bearer {base64(apiKey + "\n")}
 *   Per official 20i API docs: the key MUST have a trailing newline appended
 *   BEFORE base64 encoding. Proven by decoding their example token:
 *   "ZTRkNGZkMzFhNTJkY2FlMwo=" → "e4d4fd31a52dcae3\n"
 *   Without the "\n" the token is different and 20i returns 401 {"type":"User ID"}.
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

// STEP 1 — Sanitise: strip ONLY invisible/control chars.
// Preserves ALL printable ASCII including +, which is the separator in Combined Keys.
// Combined Key format: generalApiKey+oauthClientKey  (e.g. "cb574b954e850f7f5+c6e95e89ebd7ea3c0")
export function sanitiseKey(key: string): string {
  return key
    .trim()
    .replace(/[\u200B-\u200D\uFEFF\u00AD\u007F]/g, "")  // zero-width + DEL (copy-paste artefacts)
    .replace(/[\r\n\t]/g, "");                            // carriage-return, newline, tab
}

// STEP 1b — Extract the General Key for Bearer authentication.
//
// 20i uses the General Key for Bearer token auth.
// The Combined Key format is "GeneralKey+OAuthKey" — when pasted as-is, only
// the GENERAL KEY must be encoded into the Bearer token.
//
// IMPORTANT: The separator format can vary. We try three variants:
//   A) Part before "+"  (classic Combined Key: "GeneralKey+OAuthKey")
//   B) Part after "+"   (some account types: "OAuthKey+GeneralKey")
//   C) Full key as-is   (standalone General Key without "+" separator)
//
// Use twentyiFindWorkingKeyFormat() to auto-detect which format works.
// Once detected, store it so every request uses the correct format.
export function extractGeneralKey(cleanKey: string): string {
  const plusIdx = cleanKey.indexOf("+");
  if (plusIdx > 0) return cleanKey.substring(0, plusIdx);
  return cleanKey;
}

// Returns the key that should be used given a specific format label.
export function getKeyForFormat(cleanKey: string, fmt: "before_plus" | "after_plus" | "full"): string {
  if (fmt === "full") return cleanKey;
  const plusIdx = cleanKey.indexOf("+");
  if (plusIdx < 0) return cleanKey; // No "+" — only one option
  if (fmt === "before_plus") return cleanKey.substring(0, plusIdx);
  return cleanKey.substring(plusIdx + 1);
}

// Module-level cache: the detected working key format per API key (keyed by last4 chars).
const _workingKeyFormatCache: Record<string, "before_plus" | "after_plus" | "full"> = {};

export function getCachedKeyFormat(cleanKey: string): "before_plus" | "after_plus" | "full" {
  const last4 = cleanKey.slice(-4);
  return _workingKeyFormatCache[last4] ?? "before_plus";
}

export function setCachedKeyFormat(cleanKey: string, fmt: "before_plus" | "after_plus" | "full") {
  const last4 = cleanKey.slice(-4);
  _workingKeyFormatCache[last4] = fmt;
}

// Try to auto-detect the correct key format by attempting a real API call with each variant.
// Returns { format, authKey } for the first format that gives a non-401 response.
// A 404 from a reseller/* endpoint still counts as "auth passed" because 401 = definitely rejected.
export async function twentyiFindWorkingKeyFormat(
  rawKey: string,
  proxyUrl?: string | null,
): Promise<{ format: "before_plus" | "after_plus" | "full"; authKey: string; status: number }> {
  const cleanKey = sanitiseKey(rawKey);
  const formats: Array<"before_plus" | "after_plus" | "full"> = ["before_plus", "after_plus", "full"];
  const testPath = "/reseller/*/packageTypes";

  for (const fmt of formats) {
    const keyVariant = getKeyForFormat(cleanKey, fmt);
    const token = encodeKeyToBase64(keyVariant);
    const authHeader = `Bearer ${token}`;

    try {
      const cfg: AxiosRequestConfig = {
        method: "GET",
        url: `${BASE_URL}${testPath}`,
        headers: { Authorization: authHeader, "Content-Type": "application/json", Accept: "application/json" },
        timeout: DEFAULT_TIMEOUT_MS,
        validateStatus: () => true,
      };
      if (proxyUrl) {
        const proxy = buildAxiosProxy(proxyUrl);
        if (proxy) cfg.proxy = proxy;
      }
      const res = await axios(cfg);
      console.log(`[20i-KEY-DETECT] format=${fmt} keyLen=${keyVariant.length} → HTTP ${res.status}`);

      // 200 = fully working; 404 from reseller/* = auth passed (account might have no packages);
      // 403 = IP not yet whitelisted or permission denied but key might be correct;
      // 401 = key format definitively WRONG — skip this format.
      if (res.status !== 401) {
        console.log(`[20i-KEY-DETECT] ✓ Working format: "${fmt}" (HTTP ${res.status})`);
        return { format: fmt, authKey: keyVariant, status: res.status };
      }
      console.log(`[20i-KEY-DETECT] ✗ Format "${fmt}" rejected (401 — wrong key)`);
    } catch (err: any) {
      console.warn(`[20i-KEY-DETECT] format=${fmt} network error: ${err.message}`);
    }
  }

  // Fallback: before_plus (original behavior)
  const fallback = getKeyForFormat(cleanKey, "before_plus");
  return { format: "before_plus", authKey: fallback, status: 0 };
}

// STEP 2 — Encode: base64(key [+ "\n"]).
// For /reseller/* endpoints (General Key usage), 20i requires a trailing newline:
//   Proof from docs: "ZTRkNGZkMzFhNTJkY2FlMwo=" decodes to "e4d4fd31a52dcae3\n"
// For /package (StackCP/customer-level) endpoints, the token must be encoded WITHOUT "\n":
//   Probe result (2026-04-04): before_plus NO-\n on /package → 200 with packages
//                               before_plus WITH-\n on /package → 403 user:null
// addNewline=true  → /reseller/* paths (General Key auth with \n)
// addNewline=false → /package paths (OAuthKey-style auth without \n)
function encodeKeyToBase64(cleanKey: string, addNewline = true): string {
  return Buffer.from(addNewline ? cleanKey + "\n" : cleanKey).toString("base64");
}

// Build the full Authorization header value.
// Extracts the General Key from a Combined Key if needed, then encodes it.
// Result: "Bearer " + base64(generalKey + "\n")
export function buildAuthHeader(apiKey: string): string {
  const clean = sanitiseKey(apiKey);
  const generalKey = extractGeneralKey(clean);
  const base64 = encodeKeyToBase64(generalKey);
  return `Bearer ${base64}`;
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

// ── Key selection per endpoint ────────────────────────────────────────────────
// PROVEN AUTH MATRIX (probed 2026-04-04 against live 20i account):
//
//   /reseller/* endpoints → before_plus WITH "\n"   → HTTP 200 [] or 404
//   /package   endpoints  → before_plus WITHOUT "\n" → HTTP 200 with packages ✓
//
// The full combined key (35 chars) always returns 401 "User ID" — never use it.
// The after_plus key on /package returns 403 (different StackCP user, no scope).
// Therefore:
//   - ALL paths use the before_plus key portion
//   - /reseller/* encoding: addNewline=true (General Key convention)
//   - /package encoding:    addNewline=false (StackCP token convention)
function selectKeyForPath(cleanKey: string): string {
  const plusIdx = cleanKey.indexOf("+");
  if (plusIdx < 1) return cleanKey; // No "+" — single key, use as-is
  return cleanKey.substring(0, plusIdx); // Always use before_plus
}

// Whether to append "\n" before base64 encoding — depends on endpoint type.
function useNewlineForPath(path: string): boolean {
  // /reseller/* endpoints use the General Key convention (requires "\n")
  return path.startsWith("/reseller/");
  // /package and all other customer endpoints use the OAuthKey convention (no "\n")
}

// Fallback key on auth failure — try the other key portion as an alternative.
function selectAlternativeKeyForPath(cleanKey: string, primaryKey: string): string | null {
  const plusIdx = cleanKey.indexOf("+");
  if (plusIdx < 1) return null;
  const beforePlus = cleanKey.substring(0, plusIdx);
  const afterPlus = cleanKey.substring(plusIdx + 1);
  return primaryKey === beforePlus ? afterPlus : beforePlus;
}

async function request<T = any>(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  // ── Auth header construction ──────────────────────────────────────────────────
  // Step 1: Sanitise — strip invisible chars, preserve + separator
  const cleanKey = sanitiseKey(apiKey);
  // Step 2: Pick the key portion — always before_plus (proven correct for both path types)
  const selectedKey = selectKeyForPath(cleanKey);
  // Step 3: Encode — with or without "\n" depending on endpoint type
  //   /reseller/* → WITH "\n"   (General Key convention — proven to authenticate)
  //   /package    → WITHOUT "\n" (StackCP token convention — proven to return packages)
  const addNl = useNewlineForPath(path);
  const base64Token = encodeKeyToBase64(selectedKey, addNl);
  // Step 4: Build header — exactly ONE "Bearer " prefix
  const authorizationHeader = `Bearer ${base64Token}`;

  const url = `${BASE_URL}${path}`;
  const proxyUrl = resolveProxyUrl();

  const keyDesc = path.startsWith("/reseller/")
    ? "reseller(before_+,nl)"
    : "customer(before_+,no-nl)";
  console.log(
    `[20i] ${method} ${url}` +
    ` | raw_len=${apiKey.length} clean_len=${cleanKey.length} auth_key_len=${selectedKey.length} b64_len=${base64Token.length}` +
    ` | key_mode=${keyDesc}`
  );

  const makeRequest = async (authHeader: string, reqBody?: unknown) => {
    const cfg: AxiosRequestConfig = {
      method: method as any,
      url,
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      ...(reqBody !== undefined ? { data: reqBody } : {}),
      timeout: DEFAULT_TIMEOUT_MS,
      validateStatus: () => true,
    };
    if (proxyUrl) {
      const proxy = buildAxiosProxy(proxyUrl);
      if (proxy) cfg.proxy = proxy;
    }
    return axios(cfg);
  };

  let res = await makeRequest(authorizationHeader, body);
  let bodyPreview = JSON.stringify(res.data).substring(0, 300);
  console.log(`[20i] <- HTTP ${res.status}  body=${bodyPreview}`);

  // ── Retry with alternative key portion on auth failure ─────────────────────
  // If the primary key (before_plus) gets 401 or 403 user:null, try after_plus.
  const needsRetry = res.status === 401
    || (res.status === 403 && typeof res.data === "object" && res.data !== null && (res.data as any).user === null);
  if (needsRetry) {
    const altKey = selectAlternativeKeyForPath(cleanKey, selectedKey);
    if (altKey && altKey !== selectedKey) {
      console.log(`[20i] Retrying with alt key (len=${altKey.length}) — primary got HTTP ${res.status}`);
      const altToken = encodeKeyToBase64(altKey, addNl);
      const retryRes = await makeRequest(`Bearer ${altToken}`, body);
      const retryPreview = JSON.stringify(retryRes.data).substring(0, 300);
      console.log(`[20i] <- Retry HTTP ${retryRes.status}  body=${retryPreview}`);
      // Accept the retry result if it's better (200/4xx other than 401)
      if (retryRes.status !== 401) {
        res = retryRes;
        bodyPreview = retryPreview;
      }
    }
  }

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
    const scopeInfo = typeof res.data === "object" && res.data !== null
      ? ` Scope: ${(res.data as any).scope ?? "unknown"}. User: ${(res.data as any).user ?? "null"}.`
      : "";
    throw new Error(
      `20i Forbidden (403).${scopeInfo} If using a Reseller Combined API Key, make sure the key has the required permissions. ` +
      `Response: ${raw.substring(0, 200)}`,
    );
  }
  if (res.status === 404) {
    // For reseller/* endpoints, 404 can mean:
    //   a) IP not whitelisted (20i returns 404 for unwhitelisted IPs on some account types)
    //   b) The endpoint simply doesn't exist for this account type
    // We throw IP_NOT_WHITELISTED so the route layer can surface the right message.
    if (path.startsWith("/reseller/")) {
      throw Object.assign(
        new Error(
          `20i reseller endpoint returned 404. ` +
          `This may mean: (a) IP not yet whitelisted at my.20i.com → Reseller API → IP Whitelist, ` +
          `or (b) this endpoint is not available for your account type. ` +
          `Endpoint: ${path}`,
        ),
        { code: "IP_NOT_WHITELISTED", status: 404 },
      );
    }
    throw Object.assign(
      new Error(`20i Not Found (404): ${path}`),
      { code: "NOT_FOUND_404", status: 404 },
    );
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
  keyLength: number;          // length of the full pasted key (combined or general)
  generalKeyLength: number;   // length of the General Key used for Bearer auth (before "+")
  isCombined: boolean;        // true if the pasted key contained "+" (Combined Key format)
  tokenLength: number;        // length of base64-encoded Bearer token sent over the wire
  keyFirst4: string;          // first 4 chars of the General Key
  keyLast4: string;           // last 4 chars of the General Key
  keyHasHiddenChars: boolean;
  outboundIp: string;
  proxyActive: boolean;
  proxyUrl?: string;
  responseStatus: number | null;
  responseBody: string;
  durationMs: number;
  attempts: TwentyIDebugAttempt[];
  workingFormat: "raw" | "none";
  twentyiErrorType: string | null;
  diagnosis: "connected" | "wrong_key" | "ip_blocked" | "unknown_401" | "error";
}

export async function twentyiRawDebug(apiKey: string): Promise<TwentyIDebugInfo> {
  const rawKey = apiKey;
  const cleanKey = sanitiseKey(rawKey);
  const keyHasHiddenChars = cleanKey.length !== rawKey.trim().length;
  const keyLen = cleanKey.length;
  const isCombined = cleanKey.includes("+");

  const proxyUrl = resolveProxyUrl();
  const proxyConfig = getProxyConfig();
  const outboundIp = await getOutboundIp();
  const testPath = "/reseller/*/packageTypes";
  const url = `${BASE_URL}${testPath}`;

  // Try all three key formats and report each attempt
  const fmts: Array<"before_plus" | "after_plus" | "full"> = ["before_plus", "after_plus", "full"];
  const attempts: TwentyIDebugInfo["attempts"] = [];
  let detectedFmt: "before_plus" | "after_plus" | "full" = "before_plus";
  let firstPassingStatus: number | null = null;
  let firstPassingBody = "";

  for (const fmt of fmts) {
    const keyVariant = getKeyForFormat(cleanKey, fmt);
    const token = encodeKeyToBase64(keyVariant);
    const t0 = Date.now();
    let status: number | null = null;
    let body = "";
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
      if (proxyUrl) { const p = buildAxiosProxy(proxyUrl); if (p) cfg.proxy = p; }
      const res = await axios(cfg);
      status = res.status;
      const raw = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
      body = raw.length > 400 ? raw.substring(0, 400) + "..." : raw;
    } catch (e: any) {
      body = `Network error: ${e.message}`;
    }
    const durationMs = Date.now() - t0;
    const passed = status !== null && status !== 401;
    attempts.push({
      format: fmt,
      authHeaderPreview: `Bearer <base64(${keyVariant.length}-char · ${fmt}) · first4=${keyVariant.substring(0, 4)} last4=${keyVariant.slice(-4)}>`,
      status,
      body,
      durationMs,
    });
    if (passed && firstPassingStatus === null) {
      detectedFmt = fmt;
      firstPassingStatus = status;
      firstPassingBody = body;
    }
  }

  // Cache the working format so subsequent request() calls use the right key portion
  setCachedKeyFormat(cleanKey, detectedFmt);

  // Determine diagnosis from the winning status
  let diagnosis: TwentyIDebugInfo["diagnosis"] = "error";
  let twentyiErrorType: string | null = null;
  const ws = firstPassingStatus;
  if (ws !== null && ws >= 200 && ws < 300) {
    diagnosis = "connected";
  } else if (ws === 404) {
    diagnosis = "connected"; // auth passed, no data
  } else if (ws === 403) {
    diagnosis = "ip_blocked";
  } else if (ws === 401 || ws === null) {
    try { twentyiErrorType = JSON.parse(firstPassingBody)?.type ?? null; } catch { /* ignore */ }
    diagnosis = twentyiErrorType === "User ID" ? "wrong_key" : "unknown_401";
  }

  const generalKey = getKeyForFormat(cleanKey, detectedFmt);
  const base64Token = encodeKeyToBase64(generalKey);
  const workingFmt = (ws !== null && ws !== 401) ? detectedFmt : "none";

  console.log(
    `[20i-DEBUG] raw_len=${rawKey.length} clean_len=${keyLen} detected_format=${detectedFmt}` +
    ` best_status=${ws} diagnosis=${diagnosis} combined=${isCombined} hidden_chars=${keyHasHiddenChars}`
  );

  return {
    url,
    method: "GET",
    authFormat: workingFmt !== "none"
      ? `Bearer <base64(${generalKey.length}-char ${detectedFmt})> ✓ accepted (HTTP ${ws})`
      : `All 3 key formats rejected (401)`,
    keyLength: keyLen,
    generalKeyLength: generalKey.length,
    isCombined,
    tokenLength: base64Token.length,
    keyFirst4: cleanKey.substring(0, 4),
    keyLast4: cleanKey.slice(-4),
    keyHasHiddenChars,
    outboundIp,
    proxyActive: proxyConfig.enabled,
    proxyUrl: proxyConfig.url,
    responseStatus: ws,
    responseBody: firstPassingBody,
    durationMs: attempts.reduce((a, x) => a + x.durationMs, 0),
    workingFormat: workingFmt as any,
    twentyiErrorType,
    diagnosis,
    attempts,
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

// Try to auto-add IP to whitelist. Returns { added: boolean, reason: string, alreadyPresent?: boolean }.
// First checks if the IP is already in the whitelist to avoid double-add errors.
// Returns `alreadyPresent: true` when the IP is already whitelisted (not an error).
export async function twentyiAutoWhitelist(
  apiKey: string,
  ip: string,
): Promise<{ added: boolean; reason: string; alreadyPresent?: boolean }> {
  // Step 1 — try to read the current whitelist. If we can read it we know for sure.
  try {
    const currentList = await twentyiGetWhitelist(apiKey);
    if (currentList.includes(ip)) {
      console.log(`[20i-WL] Auto-whitelist: ${ip} is already in 20i whitelist — no action needed`);
      return { added: false, reason: "already_present", alreadyPresent: true };
    }
    // IP not in list — add it
    await request(apiKey, "POST", "/reseller/*/apiWhitelist", {
      apiWhitelist: { [ip]: {} },
    });
    console.log(`[20i-WL] Auto-whitelist: ✓ added ${ip}`);
    return { added: true, reason: "ok" };
  } catch (firstErr: any) {
    const firstMsg = String(firstErr?.message ?? "");
    const firstCode = String(firstErr?.code ?? "");
    const isWhitelistEndpointMissing = (firstCode === "IP_NOT_WHITELISTED" || firstMsg.includes("IP_NOT_WHITELISTED"))
      && firstMsg.includes("/reseller/*/apiWhitelist");

    // If the whitelist GET returned 404, this could mean:
    //   a) IP is NOT in the whitelist (classic chicken-and-egg — common scenario)
    //   b) The whitelist management endpoint doesn't exist for this account type
    // We distinguish by checking if OTHER reseller/* endpoints already respond non-401
    // (i.e., the IP itself is accessible). If yes, case (b) is more likely.
    // Either way, attempt the POST — if it gives 404 too, conclude endpoint-not-available.

    // Try the POST anyway
    try {
      await request(apiKey, "POST", "/reseller/*/apiWhitelist", {
        apiWhitelist: { [ip]: {} },
      });
      console.log(`[20i-WL] Auto-whitelist: ✓ added ${ip} (read-list failed but POST succeeded)`);
      return { added: true, reason: "ok" };
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      const code = String(e?.code ?? "");

      // Both GET and POST returned 404 → the whitelist endpoint is not available for this account.
      // Do not treat this as "ip_blocked" — it is an account limitation.
      if (isWhitelistEndpointMissing && (code === "IP_NOT_WHITELISTED" || msg.includes("IP_NOT_WHITELISTED"))) {
        console.warn(`[20i-WL] Auto-whitelist: the apiWhitelist endpoint returned 404 for both GET and POST.`);
        console.warn(`[20i-WL] This usually means the IP whitelist API is not enabled for this account type.`);
        console.warn(`[20i-WL] The IP (${ip}) must be added manually at my.20i.com → Reseller API → IP Whitelist.`);
        return { added: false, reason: "endpoint_unavailable" };
      }

      // 403 from POST = chicken-and-egg (IP not yet in whitelist at all)
      const isChickenEgg = msg.includes("Forbidden (403)") || msg.includes("403");

      // 401 / KEY NOT RECOGNISED = auth failure
      const isAuthFail = msg.includes("KEY NOT RECOGNISED") || msg.includes("401")
        || msg.includes("Authentication failed");

      if (isChickenEgg) {
        console.warn(`[20i-WL] Auto-whitelist: ${ip} must be added manually at my.20i.com → Reseller API → IP Whitelist`);
        return { added: false, reason: "ip_blocked" };
      }
      if (isAuthFail) {
        console.warn(`[20i-WL] Auto-whitelist: API key authentication failed — check key format`);
        return { added: false, reason: "auth_failed" };
      }
      console.warn(`[20i-WL] Auto-whitelist: could not add ${ip}: ${msg.substring(0, 120)}`);
      return { added: false, reason: "error" };
    }
  }
}

// ─── Connection test ──────────────────────────────────────────────────────────
// Endpoint: GET /reseller/*/packageCount
// Returns: { linux: N, windows: N, wordpress: N }

export async function twentyiTestConnection(apiKey: string): Promise<TwentyIConnectionResult> {
  const cleanKey = sanitiseKey(apiKey);
  if (cleanKey.length < 4) {
    return { success: false, message: "API key is too short." };
  }

  const proxyUrl = resolveProxyUrl();

  // Auto-detect the correct key format (before_plus / after_plus / full).
  // This probes the API with each variant and finds which one does NOT give 401.
  const detected = await twentyiFindWorkingKeyFormat(apiKey, proxyUrl);
  console.log(`[20i] testConnection: detected key format="${detected.format}" (HTTP ${detected.status})`);

  if (detected.status === 0) {
    // Network or all-formats-401 failure
    return { success: false, message: "Could not connect to 20i API — all key formats rejected (401). Verify the key at my.20i.com → Reseller API." };
  }

  // Cache the working format so all subsequent request() calls use it
  setCachedKeyFormat(cleanKey, detected.format);

  if (detected.status >= 200 && detected.status < 300) {
    // Probe again with the correct key to get package count
    const url = `${BASE_URL}/reseller/*/packageTypes`;
    const cfg: AxiosRequestConfig = {
      method: "GET",
      url,
      headers: {
        Authorization: `Bearer ${encodeKeyToBase64(detected.authKey)}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: DEFAULT_TIMEOUT_MS,
      validateStatus: () => true,
    };
    if (proxyUrl) { const p = buildAxiosProxy(proxyUrl); if (p) cfg.proxy = p; }
    const res = await axios(cfg);
    const data = res.data as any;
    const pkgCount = Array.isArray(data) ? data.length
      : typeof data === "object" && data !== null ? Object.keys(data).length : 0;
    return {
      success: true,
      message: `Connected to 20i — ${pkgCount > 0 ? `${pkgCount} package type(s) available` : "API access confirmed"} [key format: ${detected.format}]`,
      packageCount: pkgCount,
    };
  }

  if (detected.status === 404) {
    // 404 from /reseller/* means auth passed but no data found — key IS valid.
    return {
      success: true,
      message: `Connected to 20i — key is valid [format: ${detected.format}] (IP must be whitelisted for full access)`,
      packageCount: 0,
    };
  }

  if (detected.status === 403) {
    // 403 means auth passed but IP not whitelisted (or scope missing)
    return {
      success: false,
      message: `Key format "${detected.format}" accepted, but access denied (403) — add your outbound IP to my.20i.com → Reseller API → IP Whitelist`,
    };
  }

  return { success: false, message: `Unexpected HTTP ${detected.status} from 20i — check your key and IP whitelist` };
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
// Endpoint: GET /reseller/*/web
// Returns array of all hosting (web) packages under this reseller account.
// NOTE: 20i calls hosting packages "web" at the reseller level:
//       addWeb / deleteWeb / web (list). The /package path refers to bolt-on packages.

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
// Endpoint: POST /reseller/*/web/{siteId}/userStatus (reseller-level)
// Body:
//   includeRepeated - when reactivating, true = revoke all deactivations
//   subservices     - { default: false } = suspend, { default: true } = unsuspend
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
// Endpoint: POST /package/{siteId}/userToken
// Body: {} (empty)
// Returns: { token: string } or { loginToken: string } or { url: string }
// NOTE: Returns 404 for some 20i account types — SSO is not universally available.

export interface TwentyiSSOResult {
  url: string | null;
  ssoAvailable: boolean;
  stackUsers?: string[];
  domain?: string | null;
}

export async function twentyiGetSSOUrl(apiKey: string, siteId: string): Promise<TwentyiSSOResult> {
  try {
    const result = await requestWithRetry(apiKey, "POST", `/package/${siteId}/userToken`, {});
    const token = result?.token ?? result?.loginToken ?? result?.userToken ?? null;
    if (token) {
      return { url: `https://stackcp.com/?loginToken=${token}`, ssoAvailable: true };
    }
    if (result?.url) return { url: result.url, ssoAvailable: true };
    // Response received but no token — SSO not supported for this account type
    return { url: null, ssoAvailable: false };
  } catch {
    // 404 or other error — SSO not available
    return { url: null, ssoAvailable: false };
  }
}

// Get a static StackCP URL without an SSO token (for use in admin links).
export function twentyiStackCPUrl(): string {
  return "https://stackcp.com";
}

// ─── Free SSL ────────────────────────────────────────────────────────────────
// Endpoint: POST /reseller/*/web/{siteId}/freeSSL

export async function twentyiInstallSSL(apiKey: string, siteId: string, domain: string): Promise<void> {
  await requestWithRetry(apiKey, "POST", `/package/${siteId}/freeSSL`, {
    domains: [domain],
  });
}

// ─── DNS Records ──────────────────────────────────────────────────────────────
// Endpoint: GET /reseller/*/web/{siteId}/domain/{domainId}/dns

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
// Endpoint: GET /reseller/*/web/{siteId}/email/{emailId}

export async function twentyiGetEmailConfig(apiKey: string, siteId: string, emailId?: string): Promise<any> {
  try {
    const id = emailId ?? "0";
    return await requestWithRetry(apiKey, "GET", `/package/${siteId}/email/${id}`);
  } catch {
    return null;
  }
}

// ─── Bandwidth Stats ──────────────────────────────────────────────────────────
// Endpoint: GET /reseller/*/web/{siteId}/bandwidthStats

export async function twentyiGetBandwidth(apiKey: string, siteId: string): Promise<any> {
  try {
    return await requestWithRetry(apiKey, "GET", `/package/${siteId}/bandwidthStats`);
  } catch {
    return null;
  }
}

// ─── Domain Names for a Package ───────────────────────────────────────────────
// Endpoint: GET /reseller/*/web/{siteId}/names

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
    // Use reseller-level endpoint to fetch package details (General Key auth).
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
// Endpoint: POST /reseller/*/web/{siteId}/phpVersion

export async function twentyiSetPhpVersion(
  apiKey: string,
  siteId: string,
  phpVersion: string,
): Promise<void> {
  await requestWithRetry(apiKey, "POST", `/package/${siteId}/phpVersion`, {
    phpVersion,
  });
}

// ─── CDN Management ───────────────────────────────────────────────────────────
// Endpoint: POST /reseller/*/web/{siteId}/manageCdn

export async function twentyiSetCdn(
  apiKey: string,
  siteId: string,
  enabled: boolean,
): Promise<void> {
  await requestWithRetry(apiKey, "POST", `/package/${siteId}/manageCdn`, { enabled });
}

// ─── Force HTTPS ──────────────────────────────────────────────────────────────
// Endpoint: POST /reseller/*/web/{siteId}/forceSSL

export async function twentyiForceHttps(
  apiKey: string,
  siteId: string,
  enabled: boolean,
): Promise<void> {
  await requestWithRetry(apiKey, "POST", `/package/${siteId}/forceSSL`, { enabled });
}
