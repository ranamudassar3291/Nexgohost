/**
 * cPanel WHM API v1 Module
 * Uses Node.js https module with rejectUnauthorized:false because WHM servers
 * almost always use self-signed TLS certificates. fetch() rejects those by
 * default, causing "400" or "SSL" errors that have nothing to do with the
 * credentials.
 */

import https from "node:https";
import { decryptField } from "./fieldCrypto.js";

interface ServerConfig {
  hostname: string;
  port: number;
  username: string;
  apiToken: string;
}

function resolveToken(cfg: ServerConfig): string {
  return decryptField(cfg.apiToken ?? "");
}

interface CpanelAccount {
  username: string;
  domain: string;
  password: string;
  email?: string;
  plan?: string;
  contactemail?: string;
}

/**
 * Low-level HTTPS GET using node:https so we can bypass self-signed certs.
 * Default timeout is 90s — WHM createacct can legitimately take 20-60 seconds
 * on busy servers while it provisions DNS, creates the home directory, etc.
 */
function httpsGet(url: string, headers: Record<string, string>, timeoutMs = 90000): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers,
      rejectUnauthorized: false,   // WHM uses self-signed TLS — skip cert check
      timeout: timeoutMs,
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf-8");
        if (res.statusCode && res.statusCode >= 400) {
          // Try to extract a human-readable reason from WHM/cPanel JSON error bodies
          let errorDetail = body.substring(0, 300);
          try {
            const errJson = JSON.parse(body);
            const reason =
              errJson?.metadata?.reason ??
              errJson?.cpanelresult?.error ??
              errJson?.error ??
              errJson?.data?.reason ??
              errJson?.result?.[0]?.reason;
            if (reason) errorDetail = String(reason);
          } catch { /* body is not JSON — use raw */ }
          const hint =
            res.statusCode === 401
              ? " — Invalid API Token. Check WHM > API Tokens and ensure the token is correct."
              : res.statusCode === 403
              ? " — Access Denied. WHM API Token lacks required ACL permission. Go to WHM > API Tokens > select token > set Full Access or add the specific function ACL."
              : "";
          reject(new Error(`WHM API error: HTTP ${res.statusCode}${hint} — ${errorDetail}`));
        } else {
          resolve(body);
        }
      });
    });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`WHM API timed out after ${Math.round(timeoutMs / 1000)}s — account creation can take up to 90 seconds on busy servers`));
    });
    req.on("error", (err) => reject(new Error(`WHM connection failed: ${err.message}`)));
  });
}

/**
 * Low-level HTTPS POST using node:https (same SSL bypass).
 * Used for create_user_session which WHM recommends calling via POST.
 * Throws on HTTP 4xx/5xx — use httpsPostRaw if you need the status code.
 */
function httpsPost(url: string, headers: Record<string, string>, body = "", timeoutMs = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options: https.RequestOptions = {
      hostname: urlObj.hostname,
      port: Number(urlObj.port) || 443,
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      },
      rejectUnauthorized: false,
      timeout: timeoutMs,
    };
    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const responseBody = Buffer.concat(chunks).toString("utf-8");
        if (res.statusCode && res.statusCode >= 400) {
          let detail = responseBody.substring(0, 300);
          try { const j = JSON.parse(responseBody); const r = j?.metadata?.reason ?? j?.cpanelresult?.error ?? j?.error; if (r) detail = String(r); } catch { /* raw */ }
          const hint = res.statusCode === 401 ? " — Invalid API Token." : res.statusCode === 403 ? " — Access Denied: WHM token lacks permission." : "";
          reject(new Error(`WHM API error: HTTP ${res.statusCode}${hint} — ${detail}`));
        } else {
          resolve(responseBody);
        }
      });
    });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`WHM API timed out after ${Math.round(timeoutMs / 1000)}s`));
    });
    req.on("error", (err) => reject(new Error(`WHM connection failed: ${err.message}`)));
    req.write(body);
    req.end();
  });
}

/**
 * HTTPS GET/POST that ALWAYS resolves — never rejects on 4xx/5xx.
 * Returns { status, body, headers } so callers can implement retry logic
 * based on the HTTP status code without catching errors.
 */
function httpsPostRaw(
  url: string,
  headers: Record<string, string>,
  body = "",
  timeoutMs = 30000,
): Promise<{ status: number; body: string; headers: Record<string, string | string[] | undefined> }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options: https.RequestOptions = {
      hostname: urlObj.hostname,
      port: Number(urlObj.port) || 443,
      path: urlObj.pathname + urlObj.search,
      method: body ? "POST" : "GET",
      headers: {
        ...headers,
        ...(body && {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        }),
      },
      rejectUnauthorized: false,
      timeout: timeoutMs,
    };
    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          status:  res.statusCode ?? 0,
          body:    Buffer.concat(chunks).toString("utf-8"),
          headers: res.headers as Record<string, string | string[] | undefined>,
        });
      });
    });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s: ${url}`));
    });
    req.on("error", (err) => reject(new Error(`Connection failed: ${err.message}`)));
    if (body) req.write(body);
    req.end();
  });
}

function httpsGetRaw(
  url: string,
  headers: Record<string, string>,
  timeoutMs = 30000,
): Promise<{ status: number; body: string; headers: Record<string, string | string[] | undefined> }> {
  return httpsPostRaw(url, headers, "", timeoutMs);
}

/**
 * Transient network error patterns that warrant a retry.
 * These are connection-level failures, not WHM API logic errors.
 */
function isRetryableError(err: Error): boolean {
  const msg = err.message.toLowerCase();
  return (
    msg.includes("timed out") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("socket hang up") ||
    msg.includes("connection failed")
  );
}

async function whmRequest(
  server: ServerConfig,
  func: string,
  params: Record<string, string> = {},
  maxRetries = 3,
): Promise<any> {
  const query = new URLSearchParams({ ...params, "api.version": "1" });
  const port = server.port || 2087;
  const url = `https://${server.hostname}:${port}/json-api/${func}?${query}`;
  // WHM API token auth header: "whm USERNAME:TOKEN" — username defaults to "root"
  const authUser = server.username || "root";
  // WHM GET requests must NOT include Content-Type: application/json —
  // WHM interprets that header as an API v0 JSON body request and returns
  // "WHM API 0 does not support JSON input". Only Authorization is required.
  const headers = { "Authorization": `whm ${authUser}:${resolveToken(server)}` };

  let lastErr: Error = new Error("Unknown WHM error");

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const body = await httpsGet(url, headers);
      let data: any;
      try {
        data = JSON.parse(body);
      } catch {
        throw new Error(`WHM returned non-JSON response: ${body.substring(0, 200)}`);
      }

      // WHM API-level error detection (these should NOT be retried)
      if (data.metadata?.result === 0) {
        throw new Error(data.metadata?.reason || "cPanel operation failed");
      }
      if (data.result?.[0]?.status === 0) {
        throw new Error(data.result[0]?.statusmsg || "cPanel operation failed");
      }

      return data;
    } catch (err: any) {
      lastErr = err;
      const retryable = isRetryableError(err);
      console.warn(`[WHM] ${func} attempt ${attempt}/${maxRetries} failed: ${err.message}${retryable && attempt < maxRetries ? " — retrying in 3s" : ""}`);
      if (!retryable || attempt >= maxRetries) break;
      await new Promise(r => setTimeout(r, 3000 * attempt)); // exponential-ish back-off
    }
  }

  throw lastErr;
}

/**
 * Create a cPanel account.
 *
 * IMPORTANT: Only send username, domain, password, plan, and contactemail.
 * Do NOT include quota/bwlimit/maxpop/etc — those explicit params override the
 * WHM package limits and result in accounts with unlimited resources regardless
 * of what the package defines. Let WHM apply the package settings automatically.
 */
export async function cpanelCreateAccount(server: ServerConfig, account: CpanelAccount) {
  const params: Record<string, string> = {
    username: account.username,
    domain: account.domain,
    password: account.password,
    contactemail: account.contactemail || account.email || "",
  };
  // Only attach plan if one is specified — WHM default plan otherwise
  if (account.plan && account.plan !== "default") {
    params.plan = account.plan;
  }
  return whmRequest(server, "createacct", params);
}

export async function cpanelSuspend(server: ServerConfig, username: string, reason = "Suspended by admin") {
  return whmRequest(server, "suspendacct", { user: username, reason });
}

export async function cpanelUnsuspend(server: ServerConfig, username: string) {
  return whmRequest(server, "unsuspendacct", { user: username });
}

export async function cpanelTerminate(server: ServerConfig, username: string) {
  return whmRequest(server, "removeacct", { user: username });
}

export async function cpanelChangePassword(server: ServerConfig, username: string, password: string) {
  return whmRequest(server, "passwd", { user: username, password });
}

/**
 * Test WHM connection using listpkgs (as per WHM docs recommendation).
 * listpkgs is available on all WHM installs and requires a valid API token,
 * making it the ideal endpoint to verify both connectivity and credentials.
 */
export async function cpanelTestConnection(server: ServerConfig): Promise<{
  success: boolean;
  message: string;
  packages: string[];
}> {
  try {
    const data = await whmRequest(server, "listpkgs");
    const pkgs: any[] = data?.data?.pkg ?? data?.pkg ?? [];
    const packageNames: string[] = pkgs.map((p: any) => p.name || String(p)).filter(Boolean);
    const count = packageNames.length;
    return {
      success: true,
      message: count > 0
        ? `Server connected — ${count} package(s) found`
        : "Server connected — no packages found (create packages in WHM first)",
      packages: packageNames,
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Connection failed", packages: [] };
  }
}

export async function cpanelGetAccountInfo(server: ServerConfig, username: string) {
  return whmRequest(server, "accountsummary", { user: username });
}

export async function cpanelListPackages(server: ServerConfig): Promise<{ name: string }[]> {
  const data = await whmRequest(server, "listpkgs");
  const pkgs: any[] = data?.data?.pkg ?? data?.pkg ?? [];
  return pkgs.map((p: any) => ({ name: p.name || String(p) }));
}

export async function cpanelInstallSSL(server: ServerConfig, domain: string): Promise<any> {
  return whmRequest(server, "installssl", { domain });
}

/**
 * Check if a domain already exists in WHM userdata.
 * Uses /json-api/domainuserdata?api.version=1&domain=DOMAIN
 * Returns { exists: boolean, username: string | null }
 */
export async function cpanelCheckDomainExists(
  server: ServerConfig,
  domain: string,
): Promise<{ exists: boolean; username: string | null }> {
  try {
    const query = new URLSearchParams({ domain, "api.version": "1" });
    const port = server.port || 2087;
    const url = `https://${server.hostname}:${port}/json-api/domainuserdata?${query}`;
    const authUser = server.username || "root";
    const body = await httpsGet(url, { "Authorization": `whm ${authUser}:${resolveToken(server)}` });
    const data = JSON.parse(body);
    // WHM returns metadata.result=1 and data.userdata.user when domain exists
    const username: string | null = data?.data?.userdata?.user || data?.userdata?.user || null;
    const exists = !!username;
    return { exists, username };
  } catch {
    // If the API call itself fails, assume domain does not exist and let createacct proceed
    return { exists: false, username: null };
  }
}

/**
 * Create a WHM user session for cPanel Single Sign-On (SSO).
 * Uses POST /json-api/create_user_session?api.version=1 with body params.
 * service = "cpaneld" for cPanel, "webmaild" for Webmail
 * Returns the temporary login URL to redirect the client to.
 * Example response URL: https://server:2083/cpsessXXXX/login/?session=XXXX
 */
// ─── DNS Management (UAPI ZoneEdit) ──────────────────────────────────────────

export interface DnsRecord {
  Line?: number;
  type: string;
  name: string;
  address?: string;
  cname?: string;
  exchange?: string;
  txtdata?: string;
  ttl?: number;
  preference?: number;
}

export async function cpanelGetDnsZone(server: ServerConfig, domain: string, username: string): Promise<DnsRecord[]> {
  const port = server.port || 2087;
  const authUser = server.username || "root";
  const authHeader = { "Authorization": `whm ${authUser}:${resolveToken(server)}` };

  // ── Primary: UAPI ZoneEdit::fetch_zone_record (unlimited records) ───────────
  // paginate=0 disables any server-side pagination — returns ALL records at once.
  try {
    const uapiParams = new URLSearchParams({
      "api.version":             "1",
      user:                      username,
      cpanel_jsonapi_user:       username,
      cpanel_jsonapi_apiversion: "uapi",
      cpanel_jsonapi_module:     "ZoneEdit",
      cpanel_jsonapi_func:       "fetch_zone_record",
      domain,
      paginate:                  "0",
      "paginate-size":           "9999",
    });
    const uapiUrl = `https://${server.hostname}:${port}/json-api/cpanel?${uapiParams}`;
    const raw = await httpsGetRaw(uapiUrl, authHeader, 30_000);
    if (raw.status < 400) {
      const data = JSON.parse(raw.body);
      // UAPI envelope via WHM: data.result.data = array of records
      const resultData = data?.result?.data ?? data?.data;
      const uapiRecords: any[] = Array.isArray(resultData?.record)
        ? resultData.record          // nested: { record: [...] }
        : Array.isArray(resultData)
          ? resultData               // flat: [...records]
          : [];

      if (uapiRecords.length > 0) {
        console.log(`[DNS] UAPI fetch_zone_record returned ${uapiRecords.length} records for ${domain}`);
        return uapiRecords.map((r: any) => ({
          Line: r.line_index ?? r.Line ?? r.line,
          type: (r.type ?? "A").toUpperCase(),
          name: r.name ?? r.dname ?? "",
          address: r.address ?? r.record ?? r.txtdata ?? r.cname ?? r.exchange ?? "",
          cname: r.cname,
          exchange: r.exchange,
          txtdata: r.txtdata,
          ttl: Number(r.ttl) || 14400,
          preference: r.priority ?? r.preference,
        }));
      }
    }
  } catch (e: any) {
    console.warn(`[DNS] UAPI fetch_zone_record failed for ${domain}: ${e.message} — trying API2`);
  }

  // ── Fallback: API2 fetchzone_records ─────────────────────────────────────────
  // customonly=0  = return ALL records (not just custom ones)
  // No maxrecords param = server default (unlimited on standard cPanel).
  // No slice, no limit — the full zone is returned.
  const whmUrl = `https://${server.hostname}:${port}/json-api/cpanel?` +
    `cpanel_jsonapi_version=2&cpanel_jsonapi_module=ZoneEdit` +
    `&cpanel_jsonapi_func=fetchzone_records&domain=${encodeURIComponent(domain)}` +
    `&customonly=0&api.version=1` +
    `&user=${encodeURIComponent(username)}&cpanel_jsonapi_user=${encodeURIComponent(username)}`;
  const body = await httpsGet(whmUrl, authHeader, 45_000);
  const data = JSON.parse(body);

  // API2 fetchzone_records response shapes:
  //   a) Flat: cpanelresult.data[i] has 'Line' + 'type' fields — each element IS a record
  //   b) Wrapped: cpanelresult.data[0].record[] contains the records
  const rawData: any[] = data?.cpanelresult?.data ?? data?.result?.[0]?.data ?? [];
  let records: any[] = [];

  if (rawData.length > 0) {
    const firstEl = rawData[0];
    if (firstEl?.type !== undefined || firstEl?.Line !== undefined) {
      records = rawData;                                          // flat — every item IS a record
    } else if (Array.isArray(firstEl?.record)) {
      records = firstEl.record;                                   // wrapped
    } else {
      records = rawData.flatMap((item: any) =>
        Array.isArray(item?.record) ? item.record : (item?.type ? [item] : [])
      );
    }
  }

  if (records.length === 0) {
    records = data?.data?.record ?? data?.result?.[0]?.data?.record ?? [];
  }

  console.log(`[DNS] API2 fetchzone_records returned ${records.length} records for ${domain}`);
  return records.map((r: any) => ({
    Line: r.Line ?? r.line,
    type: (r.type ?? "A").toUpperCase(),
    name: r.name ?? "",
    address: r.address ?? r.txtdata ?? r.cname ?? r.exchange ?? "",
    cname: r.cname,
    exchange: r.exchange,
    txtdata: r.txtdata,
    ttl: Number(r.ttl) || 14400,
    preference: r.preference ?? r.priority,
  }));
}

export async function cpanelAddDnsRecord(server: ServerConfig, username: string, domain: string, record: Omit<DnsRecord, "Line">): Promise<void> {
  const port = server.port || 2087;
  const authUser = server.username || "root";
  const params = new URLSearchParams({
    "api.version": "1", user: username, cpanel_jsonapi_user: username,
    cpanel_jsonapi_version: "2", cpanel_jsonapi_module: "ZoneEdit", cpanel_jsonapi_func: "add_zone_record",
    domain, type: record.type, name: record.name, ttl: String(record.ttl || 14400),
    ...(record.address && { address: record.address }),
    ...(record.cname && { cname: record.cname }),
    ...(record.exchange && { exchange: record.exchange }),
    ...(record.txtdata && { txtdata: record.txtdata }),
    ...(record.preference && { preference: String(record.preference) }),
  });
  const url = `https://${server.hostname}:${port}/json-api/cpanel?${params.toString()}`;
  const body = await httpsGet(url, { "Authorization": `whm ${authUser}:${resolveToken(server)}` });
  const data = JSON.parse(body);
  if (data?.cpanelresult?.error) throw new Error(data.cpanelresult.error);
}

export async function cpanelEditDnsRecord(server: ServerConfig, username: string, domain: string, line: number, record: Omit<DnsRecord, "Line">): Promise<void> {
  const port = server.port || 2087;
  const authUser = server.username || "root";
  const params = new URLSearchParams({
    "api.version": "1", user: username, cpanel_jsonapi_user: username,
    cpanel_jsonapi_version: "2", cpanel_jsonapi_module: "ZoneEdit", cpanel_jsonapi_func: "edit_zone_record",
    domain, Line: String(line), type: record.type, name: record.name, ttl: String(record.ttl || 14400),
    ...(record.address && { address: record.address }),
    ...(record.cname && { cname: record.cname }),
    ...(record.exchange && { exchange: record.exchange }),
    ...(record.txtdata && { txtdata: record.txtdata }),
    ...(record.preference && { preference: String(record.preference) }),
  });
  const url = `https://${server.hostname}:${port}/json-api/cpanel?${params.toString()}`;
  const body = await httpsGet(url, { "Authorization": `whm ${authUser}:${resolveToken(server)}` });
  const data = JSON.parse(body);
  if (data?.cpanelresult?.error) throw new Error(data.cpanelresult.error);
}

export async function cpanelDeleteDnsRecord(server: ServerConfig, username: string, domain: string, line: number): Promise<void> {
  const port = server.port || 2087;
  const authUser = server.username || "root";
  const params = new URLSearchParams({
    "api.version": "1", user: username, cpanel_jsonapi_user: username,
    cpanel_jsonapi_version: "2", cpanel_jsonapi_module: "ZoneEdit", cpanel_jsonapi_func: "remove_zone_record",
    domain, Line: String(line),
  });
  const url = `https://${server.hostname}:${port}/json-api/cpanel?${params.toString()}`;
  const body = await httpsGet(url, { "Authorization": `whm ${authUser}:${resolveToken(server)}` });
  const data = JSON.parse(body);
  if (data?.cpanelresult?.error) throw new Error(data.cpanelresult.error);
}

// ─── cPanel UAPI Bridge (via WHM root) ───────────────────────────────────────
// Calls cPanel UAPI functions on behalf of a specific cPanel user.
// WHM proxies the call so no cPanel session token is needed — only the WHM
// API token is required.
//
// UAPI URL shape via WHM:
//   GET https://WHM_HOST:2087/json-api/cpanel
//       ?api.version=1
//       &user=CPANEL_USER
//       &cpanel_jsonapi_apiversion=uapi
//       &cpanel_jsonapi_module=MODULE
//       &cpanel_jsonapi_func=FUNCTION
//       &PARAM=VALUE ...
//
// Response envelope (UAPI via WHM):
//   { "metadata": { "result": 1 }, "result": { "status": 1, "errors": null, "data": {} } }

export async function cpanelUapi(
  server: ServerConfig,
  cpanelUser: string,
  module: string,
  func: string,
  params: Record<string, string> = {},
): Promise<any> {
  const port = server.port || 2087;
  const authUser = server.username || "root";
  const query = new URLSearchParams({
    "api.version":             "1",
    user:                      cpanelUser,
    cpanel_jsonapi_user:       cpanelUser,
    cpanel_jsonapi_apiversion: "uapi",
    cpanel_jsonapi_module:     module,
    cpanel_jsonapi_func:       func,
    ...params,
  });
  const url = `https://${server.hostname}:${port}/json-api/cpanel?${query}`;
  const raw = await httpsGet(url, { "Authorization": `whm ${authUser}:${resolveToken(server)}` }, 60_000);

  let data: any;
  try { data = JSON.parse(raw); } catch {
    throw new Error(`cPanel UAPI (${module}::${func}) returned non-JSON: ${raw.substring(0, 200)}`);
  }

  // WHM-level error
  if (data?.metadata?.result === 0) {
    throw new Error(data.metadata?.reason || `cPanel UAPI (${module}::${func}) WHM-level error`);
  }

  // UAPI-level error
  const uapiResult = data?.result ?? data;
  if (uapiResult?.status === 0) {
    const errs: string[] = uapiResult?.errors ?? [];
    throw new Error(
      errs.length > 0
        ? errs.join("; ")
        : `cPanel UAPI (${module}::${func}) failed — no error message returned`
    );
  }

  return uapiResult?.data ?? uapiResult;
}

// ─── MySQL UAPI helpers ───────────────────────────────────────────────────────
// cPanel ENFORCES prefix rules:
//   DB name   → must start with "{cpanelUser}_"  (total ≤ 64 chars)
//   DB user   → must start with "{cpanelUser}_"  (total ≤ 47 chars on cPanel)
// The full prefixed name is what you pass to MySQL GRANT and wp-config.php.

export function cpanelDbName(cpanelUser: string, suffix: string): string {
  const full = `${cpanelUser}_${suffix}`;
  return full.substring(0, 64);
}

export function cpanelDbUser(cpanelUser: string, suffix: string): string {
  const full = `${cpanelUser}_${suffix}`;
  return full.substring(0, 47);
}

export async function cpanelMysqlCreateDatabase(
  server: ServerConfig,
  cpanelUser: string,
  dbFullName: string,   // already prefixed
): Promise<void> {
  await cpanelUapi(server, cpanelUser, "Mysql", "create_database", { name: dbFullName });
}

export async function cpanelMysqlCreateUser(
  server: ServerConfig,
  cpanelUser: string,
  dbUserFull: string,   // already prefixed
  dbPass: string,
): Promise<void> {
  await cpanelUapi(server, cpanelUser, "Mysql", "create_user", {
    name: dbUserFull,
    password: dbPass,
  });
}

export async function cpanelMysqlSetPrivileges(
  server: ServerConfig,
  cpanelUser: string,
  dbFullName: string,
  dbUserFull: string,
): Promise<void> {
  await cpanelUapi(server, cpanelUser, "Mysql", "set_privileges_on_database", {
    database:   dbFullName,
    user:       dbUserFull,
    privileges: "ALL PRIVILEGES",
  });
}

export async function cpanelMysqlDeleteDatabase(
  server: ServerConfig,
  cpanelUser: string,
  dbFullName: string,
): Promise<void> {
  try {
    await cpanelUapi(server, cpanelUser, "Mysql", "delete_database", { name: dbFullName });
  } catch (e: any) {
    // non-fatal on reinstall — DB may not exist
    console.warn(`[cPanel] delete_database (non-fatal): ${e.message}`);
  }
}

export async function cpanelMysqlDeleteUser(
  server: ServerConfig,
  cpanelUser: string,
  dbUserFull: string,
): Promise<void> {
  try {
    await cpanelUapi(server, cpanelUser, "Mysql", "delete_user", { name: dbUserFull });
  } catch (e: any) {
    console.warn(`[cPanel] delete_user (non-fatal): ${e.message}`);
  }
}

// ─── Fileman UAPI helpers ─────────────────────────────────────────────────────

/** Upload a text file to a cPanel account via Fileman::save_file_content */
export async function cpanelSaveFile(
  server: ServerConfig,
  cpanelUser: string,
  filePath: string,   // e.g. /home/user/public_html/wp-config.php
  content: string,
): Promise<void> {
  await cpanelUapi(server, cpanelUser, "Fileman", "save_file_content", {
    dir:     filePath.substring(0, filePath.lastIndexOf("/")),
    file:    filePath.substring(filePath.lastIndexOf("/") + 1),
    content: Buffer.from(content).toString("base64"),
    encoding: "base64",
  });
}

export interface FilesystemItem {
  file: string;
  type: "file" | "dir";
  size: number;
  mtime: number;
  humansize: string;
  permissions: string;
  mime?: string;
  fullpath: string;
}

/** List files/folders in a directory via Fileman::list */
export async function cpanelFilelist(
  server: ServerConfig,
  cpanelUser: string,
  dir: string,
  limit = 200,
): Promise<FilesystemItem[]> {
  const data = await cpanelUapi(server, cpanelUser, "Fileman", "list", {
    dir,
    include_mime: "1",
    limit: String(limit),
    sort_by: "type",
    sort_order: "asc",
  });
  const items: any[] = Array.isArray(data) ? data : (data?.list ?? data?.files ?? []);
  return items.map((item: any) => ({
    file: item.file ?? item.filename ?? "",
    type: (item.type === "dir" || item.type === "folder") ? "dir" : "file",
    size: Number(item.size ?? 0),
    mtime: Number(item.mtime ?? item.modified ?? 0),
    humansize: item.humansize ?? item.human_size ?? formatBytes(Number(item.size ?? 0)),
    permissions: item.permissions ?? item.perms ?? "",
    mime: item.mime ?? item.mimetype ?? undefined,
    fullpath: `${dir}/${item.file ?? item.filename ?? ""}`.replace(/\/+/g, "/"),
  }));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Read a text file via Fileman::get_file_content (returns raw string) */
export async function cpanelFileGetContent(
  server: ServerConfig,
  cpanelUser: string,
  dir: string,
  filename: string,
): Promise<string> {
  const data = await cpanelUapi(server, cpanelUser, "Fileman", "get_file_content", {
    dir,
    file: filename,
  });
  const raw = data?.content ?? data?.file_content ?? data;
  if (typeof raw === "string") {
    try { return Buffer.from(raw, "base64").toString("utf-8"); } catch { return raw; }
  }
  return "";
}

/** Create a directory via Fileman::mkdir */
export async function cpanelFileMkdir(
  server: ServerConfig,
  cpanelUser: string,
  parentDir: string,
  folderName: string,
): Promise<void> {
  const fullPath = `${parentDir}/${folderName}`.replace(/\/+/g, "/");
  await cpanelUapi(server, cpanelUser, "Fileman", "mkdir", { name: fullPath });
}

/** Delete a file or directory via Fileman::unlink_files */
export async function cpanelFileDelete(
  server: ServerConfig,
  cpanelUser: string,
  dir: string,
  filename: string,
): Promise<void> {
  await cpanelUapi(server, cpanelUser, "Fileman", "unlink_files", {
    metadata: JSON.stringify([{ filename, dir }]),
  });
}

/**
 * Upload a file to cPanel via multipart POST to Fileman upload endpoint.
 * fileBuffer is the raw file bytes. Returns void on success.
 */
export async function cpanelFileUpload(
  server: ServerConfig,
  cpanelUser: string,
  targetDir: string,
  filename: string,
  fileBuffer: Buffer,
  mimeType = "application/octet-stream",
): Promise<void> {
  // 1. get a cPanel session token
  const { hostname, whmApiToken } = server as any;
  const whmBase = `https://${hostname}:2087`;
  const sessResp = await fetch(
    `${whmBase}/json-api/create_user_session?api.version=1&user=${encodeURIComponent(cpanelUser)}&service=cpaneld`,
    { headers: { Authorization: `whm root:${whmApiToken}` }, signal: AbortSignal.timeout(15000) },
  );
  if (!sessResp.ok) throw new Error(`WHM create_user_session failed: ${sessResp.status}`);
  const sessJson = await sessResp.json() as any;
  const cpanelUrl: string = sessJson?.data?.url ?? sessJson?.result?.data?.url ?? "";
  if (!cpanelUrl) throw new Error("No cPanel session URL returned");
  const cpsessMatch = cpanelUrl.match(/\/cpsess(\w+)\//);
  if (!cpsessMatch) throw new Error("Cannot parse cpsess from URL");
  const cpsess = `cpsess${cpsessMatch[1]}`;

  // 2. POST multipart to Fileman::upload_files
  const { FormData, File } = await import("undici");
  const form = new FormData();
  form.set("dir", targetDir);
  form.set("file-0", new File([fileBuffer], filename, { type: mimeType }));

  const uploadUrl = `https://${hostname}:2083/${cpsess}/execute/Fileman/upload_files`;
  const uploadResp = await fetch(uploadUrl, {
    method: "POST",
    headers: { Cookie: `cpsession=${cpsess}` } as any,
    body: form as any,
    signal: AbortSignal.timeout(60000),
  });
  if (!uploadResp.ok) throw new Error(`Upload failed: ${uploadResp.status}`);
}

/** Restore a cPanel full backup via WHM restoreaccount API */
export async function cpanelRestoreFullBackup(
  server: ServerConfig,
  cpanelUser: string,
  backupFilePath: string,
): Promise<void> {
  const { hostname, whmApiToken } = server as any;
  const url = `https://${hostname}:2087/json-api/restoreaccount?api.version=1`;
  const body = new URLSearchParams({
    user: cpanelUser,
    type: "homedir",
    restore_point: backupFilePath,
  });
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `whm root:${whmApiToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    signal: AbortSignal.timeout(120000),
  });
  if (!resp.ok) throw new Error(`Restore failed: ${resp.status} ${await resp.text()}`);
  const json = await resp.json() as any;
  if (json?.metadata?.result === 0 || json?.result?.[0]?.status === 0) {
    throw new Error(json?.metadata?.reason ?? json?.result?.[0]?.statusmsg ?? "Restore failed");
  }
}

/** Restore a MySQL DB backup via cPanel Mysql::restore_database */
export async function cpanelRestoreDatabase(
  server: ServerConfig,
  cpanelUser: string,
  dbName: string,
  backupFilePath: string,
): Promise<void> {
  await cpanelUapi(server, cpanelUser, "Restore", "restore_file", {
    type: "mysql",
    target: dbName,
    restore_point: backupFilePath,
  });
}

// ─── Softaculous installer ────────────────────────────────────────────────────
//
// Authentication strategy (fixes "No data returned from cPanel Service" 500):
//
//   PRIMARY — cPanel user API token (preferred, no WHM root permission needed)
//     Auth header: "Authorization: cpanel {cpanelUser}:{cpanelApiToken}"
//     Login endpoint: GET https://SERVER:2083/login/?login_only=1
//     Returns JSON with "security_token": "/cpsessXXXXXXXXXX"
//     Then uses cpsess to POST to Softaculous index.php
//
//   FALLBACK — WHM root create_user_session (requires the WHM token to have
//     the create-user-session ACL; fails when the token is restricted)
//
// Softaculous endpoint (exact format per Softaculous documentation):
//   POST https://SERVER:2083/{cpsessXXXXXXXXXX}/softaculous/index.php
//        ?act=software&soft=26&autoinstall=1
//
// Retry: up to 3 attempts with 2-second delay on HTTP 500 or empty body.
// Logging: full response body is printed (password is redacted from logs).
// Success: ONLY when the JSON response contains done: 1 explicitly.
//          done: 0, missing done, or non-JSON are all treated as failure.

export interface SoftaculousInstallOpts {
  /** Full domain for the site, e.g. "example.com" */
  softdomain: string;
  /** Sub-directory within public_html — "" for root, "wp" for /wp */
  softdirectory: string;
  /** Site/blog title */
  site_name: string;
  /** WordPress admin username (from frontend form) */
  admin_username: string;
  /** WordPress admin password — sent over HTTPS, NEVER printed to logs */
  admin_pass: string;
  /** WordPress admin email */
  admin_email: string;
  /**
   * DB name suffix — cPanel auto-prepends "{cpanelUser}_".
   * If omitted, a random 8-char alphanumeric suffix is generated.
   * Example: "wp_a1b2c3d4" → cPanel creates "{cpanelUser}_wp_a1b2c3d4"
   */
  softdb?: string;
  /** Pre-created DB user (full cPanel-prefixed, e.g. johndoe_wu123) */
  dbusername?: string;
  /** Pre-created DB user password */
  dbuserpasswd?: string;
  /**
   * cPanel account's own API token (generated inside the cPanel account).
   * When provided this is used instead of WHM's create_user_session, which
   * requires a WHM root token with the create-user-session ACL.
   *
   * Generate one in cPanel → Security → Manage API Tokens.
   * Auth header sent: "Authorization: cpanel {user}:{token}"
   */
  cpanelApiToken?: string;
  /**
   * cPanel account password (alternative to cpanelApiToken).
   * Uses HTTP Basic Auth to call /login/?login_only=1 and obtain a cpsess
   * token — the same flow as the reference Axios implementation:
   *   auth: { username: cpanel_user, password: cpanel_pass }
   *
   * cpanelApiToken is preferred when available (does not expose the password).
   * cpanelPassword is the fallback for environments that do not have API tokens.
   * Auth header sent: "Authorization: Basic base64({user}:{password})"
   */
  cpanelPassword?: string;
}

/** 8-character random alphanumeric string for unique DB name generation */
function randomDbSuffix(): string {
  return Array.from({ length: 8 }, () =>
    "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]
  ).join("");
}

/** Remove admin_pass from a URLSearchParams string for safe log output */
function redactPassword(params: string): string {
  return params.replace(/admin_pass=[^&]*/g, "admin_pass=****");
}

/**
 * Parse Softaculous response (JSON or plain text) and return a typed result.
 *
 * Success conditions (in order of priority):
 *   1. JSON done === 1              (primary Softaculous success flag)
 *   2. JSON status === 'success'    (alternate success field, per reference impl)
 *   3. Plain-text "congratulations" (older Softaculous versions returning HTML)
 *
 * Failure: everything else. The EXACT error text from Softaculous is returned
 * verbatim — "Directory not empty", "Database already exists", etc. — so the UI
 * can display the real reason rather than a generic "Failed" message.
 */
function parseSoftaculousResponse(raw: string, opts: SoftaculousInstallOpts): {
  success: boolean; adminUrl?: string; insid?: string; error?: string
} {
  const adminPath = opts.softdirectory ? `/${opts.softdirectory}/wp-admin` : "/wp-admin";
  const fallbackAdminUrl = `https://${opts.softdomain}${adminPath}`;

  // ── Try JSON first ────────────────────────────────────────────────────────
  let data: any = null;
  try { data = JSON.parse(raw); } catch { /* fall through to plain-text checks */ }

  if (data !== null) {
    // ── Condition 1: cPanel JSON-API bridge envelope — metadata.result ────────
    // Used by Strategy 1 (JSON-API bridge with Basic Auth):
    //   axios.get('/json-api/cpanel', { params: { cpanel_jsonapi_module: 'Softaculous', ... } })
    //   response.data.metadata.result === 1  → success
    //   response.data.metadata.reason        → exact error (e.g. "Directory not empty")
    if (data?.cpanelresult !== undefined || data?.metadata !== undefined) {
      const meta = data?.cpanelresult?.metadata ?? data?.metadata;
      if (meta) {
        if (Number(meta.result) === 1) {
          // Success via JSON-API bridge
          const innerData = data?.cpanelresult?.data ?? data?.result?.[0]?.data ?? data?.data ?? {};
          const adminUrl  = innerData?.admin_url ?? innerData?.install_url ?? fallbackAdminUrl;
          console.log(`[Softaculous] ✓ metadata.result=1 — adminUrl=${adminUrl}`);
          return { success: true, adminUrl };
        }
        // metadata.result !== 1 — extract the exact reason
        const reason = meta.reason ?? meta.message ?? "Softaculous reported failure (no reason given)";
        console.warn(`[Softaculous] metadata.result=${meta.result} reason="${reason}"`);
        return { success: false, error: String(reason) };
      }
    }

    // ── Condition 2: done === 1 (native Softaculous JSON response) ───────────
    if (Number(data?.done) === 1) {
      const adminUrl = data?.admin_url ?? data?.insurl ?? fallbackAdminUrl;
      console.log(`[Softaculous] ✓ done=1 — insid=${data?.insid ?? "n/a"} adminUrl=${adminUrl}`);
      return { success: true, adminUrl, insid: data?.insid != null ? String(data.insid) : undefined };
    }

    // ── Condition 3: status === 'success' ─────────────────────────────────────
    if (data?.status === "success") {
      const adminUrl = data?.admin_url ?? data?.url ?? fallbackAdminUrl;
      console.log(`[Softaculous] ✓ status=success — adminUrl=${adminUrl}`);
      return { success: true, adminUrl };
    }

    // ── JSON failure: surface the EXACT error verbatim ────────────────────────
    // "Directory not empty", "Database already exists", "Domain taken", etc.
    const msgs: string[] = [];
    if (data?.error)   msgs.push(String(data.error));
    if (data?.errors) {
      const arr = Array.isArray(data.errors) ? data.errors : Object.values(data.errors);
      arr.forEach((e: any) => msgs.push(String(e)));
    }
    if (data?.message) msgs.push(String(data.message));
    if (data?.done !== undefined && Number(data.done) !== 1) {
      msgs.push(`Softaculous reported done=${data.done}`);
    }
    if (msgs.length === 0) {
      msgs.push(`Unexpected JSON (no done/error/status/metadata fields): ${raw.substring(0, 400)}`);
    }
    return { success: false, error: msgs.join("; ") };
  }

  // ── Condition 3: "congratulations" in plain text/HTML ────────────────────
  if (/congratulations/i.test(raw)) {
    console.log(`[Softaculous] ✓ Success detected via "congratulations" string`);
    return { success: true, adminUrl: fallbackAdminUrl };
  }

  // ── Plain-text failure: extract the best error description from HTML ──────
  // Handles cases where Softaculous returns an HTML error page instead of JSON.
  const htmlMsg = raw.match(/<div[^>]*class="[^"]*(?:error|alert)[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1]
                   ?.replace(/<[^>]+>/g, "").trim()  // strip inner tags
               || raw.match(/error[^:]*:\s*([^\n<]{10,})/i)?.[1]?.trim();
  const errorText = htmlMsg
    ?? `Softaculous returned a non-JSON response (first 400 chars): ${raw.substring(0, 400)}`;

  return { success: false, error: errorText };
}

export async function cpanelSoftaculousInstallWordPress(
  server: ServerConfig,
  cpanelUser: string,
  opts: SoftaculousInstallOpts,
): Promise<{ success: boolean; adminUrl?: string; insid?: string; error?: string }> {

  const softPort  = 2083;
  const baseUrl   = `https://${server.hostname}:${softPort}`;

  // ── Guard: require credentials ────────────────────────────────────────────
  if (!opts.cpanelApiToken && !opts.cpanelPassword) {
    return {
      success: false,
      error:
        "Softaculous installation requires either a cPanel API token or cPanel account password. " +
        "Pass 'cpanelApiToken' (cPanel → Security → Manage API Tokens) or 'cpanelPassword' " +
        "in the request body. WHM root-token auth is not supported here — it causes 500 errors.",
    };
  }

  // ── AUTO-GENERATE DB NAME if not supplied ─────────────────────────────────
  // cPanel prepends "{cpanelUser}_" automatically. We only supply the suffix.
  const dbSuffix = opts.softdb ?? `wp${Math.floor(Math.random() * 99)}`;
  console.log(`[Softaculous] DB suffix: ${dbSuffix} (cPanel will prefix with "${cpanelUser}_")`);

  // ── Build the Authorization header for every request ──────────────────────
  // Equivalent to Axios:  auth: { username: cp_user, password: cp_pass }
  const Authorization = opts.cpanelApiToken
    ? `cpanel ${cpanelUser}:${opts.cpanelApiToken}`
    : `Basic ${Buffer.from(`${cpanelUser}:${opts.cpanelPassword}`).toString("base64")}`;
  const authLabel = opts.cpanelApiToken ? "cPanel API Token" : "Basic Auth (password)";

  // ═══════════════════════════════════════════════════════════════════════════
  // STRATEGY 1 — JSON-API bridge (direct, no session needed)
  //
  // Exactly matches the attached Axios reference implementation:
  //   axios.get(https://SERVER:2083/json-api/cpanel, {
  //     params: { cpanel_jsonapi_user, cpanel_jsonapi_apiversion:'2',
  //               cpanel_jsonapi_module:'Softaculous', cpanel_jsonapi_func:'api2_install',
  //               soft:'26', autoinstall:'1', softdomain, ... },
  //     auth: { username: cp_user, password: cp_pass }
  //   })
  //
  // Success: response.data.metadata.result === 1
  // Error:   response.data.metadata.reason  (e.g. "Directory not empty")
  //
  // Note: Softaculous uses cPanel API2 (apiversion=2), not API3.
  //       apiversion=2 is the correct value for the Softaculous module.
  // ═══════════════════════════════════════════════════════════════════════════

  const jsonApiUrl = `${baseUrl}/json-api/cpanel`;
  const jsonApiParams = new URLSearchParams({
    cpanel_jsonapi_user:       cpanelUser,
    cpanel_jsonapi_apiversion: "2",
    cpanel_jsonapi_module:     "Softaculous",
    // Correct function name for Softaculous via cPanel API2 JSON bridge.
    // "api2_install" is wrong — the function is just "install".
    // The api2_ prefix is only used in UAPI-to-API2 bridging, not here.
    cpanel_jsonapi_func:       "install",
    soft:                      "26",
    autoinstall:               "1",
    softdomain:                opts.softdomain,
    // Empty string = install in /public_html root (no subdirectory).
    // Any other value (e.g. "blog") installs into /public_html/blog.
    softdirectory:             opts.softdirectory ?? "",
    site_name:                 opts.site_name,
    admin_username:            opts.admin_username,
    admin_pass:                opts.admin_pass,   // sent over HTTPS, never logged
    admin_email:               opts.admin_email,
    softdb:                    dbSuffix,
    ...(opts.dbusername   && { dbusername:   opts.dbusername }),
    ...(opts.dbuserpasswd && { dbuserpasswd: opts.dbuserpasswd }),
  });

  console.log(`[Softaculous] Strategy 1: JSON-API bridge — ${authLabel}`);
  console.log(`[Softaculous] GET ${jsonApiUrl}?${redactPassword(jsonApiParams.toString())}`);

  try {
    const r1 = await httpsGetRaw(`${jsonApiUrl}?${jsonApiParams}`, { Authorization }, 120_000);
    console.log(`[Softaculous] Strategy 1 HTTP ${r1.status}`);
    console.log(`[Softaculous] Strategy 1 full response body:\n${r1.body}`);

    if (r1.status < 500 && r1.body.trim() !== "") {
      const parsed = parseSoftaculousResponse(r1.body.trim(), opts);
      if (parsed.success) return parsed;

      // Distinguish between semantic WordPress errors (don't retry) and
      // infrastructure errors from cPanel itself (do fall through to Strategy 2/3).
      //
      // "No data returned from cPanel Service" = cPanel JSON-API bridge could not
      // reach the Softaculous module (e.g. Softaculous not exposed via API2, or
      // the function name doesn't match this Softaculous version). Strategy 2/3
      // bypass this by obtaining a cpsess token and POSTing directly to
      // /softaculous/index.php — so falling through is correct here.
      //
      // Real Softaculous errors that should NOT be retried (directory/db already exist):
      //   "Directory is not empty", "Database already exists", "Domain already installed"
      const isInfraError = /no data returned|module not found|softaculous.*not (installed|available)|not installed/i.test(parsed.error ?? "");
      const isAuthError   = /session|unauthorized|forbidden|login/i.test(parsed.error ?? "");

      if (!isInfraError && !isAuthError) {
        console.warn(`[Softaculous] Strategy 1 semantic failure — not retrying: ${parsed.error}`);
        return parsed;
      }

      console.warn(`[Softaculous] Strategy 1 infra/auth error, trying Strategy 2: ${parsed.error}`);
    } else {
      console.warn(`[Softaculous] Strategy 1 server error (HTTP ${r1.status}) — trying Strategy 2`);
    }
  } catch (e: any) {
    console.warn(`[Softaculous] Strategy 1 network error — trying Strategy 2: ${e.message}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STRATEGY 2 — UAPI Session::create → cpsess token → Softaculous POST
  //
  // Implements the user-described two-step flow:
  //   Step A: GET /execute/Session/create  (UAPI, Basic Auth)
  //           → returns { data: { url: "https://SERVER:2083/cpsessXXXX/..." } }
  //   Step B: POST to /cpsessXXXX/softaculous/index.php?act=software&soft=26&api=json
  //
  // This is the officially documented session-creation path via UAPI.
  // The security token is extracted from the returned URL.
  // ═══════════════════════════════════════════════════════════════════════════

  console.log(`[Softaculous] Strategy 2: UAPI Session::create → cpsess Softaculous`);

  let cpsessToken: string;

  try {
    const sessionUrl = `${baseUrl}/execute/Session/create`;
    console.log(`[Softaculous] GET ${sessionUrl} (${authLabel})`);
    const sessionRes = await httpsGetRaw(sessionUrl, { Authorization }, 30_000);

    console.log(`[Softaculous] Session HTTP ${sessionRes.status}`);
    console.log(`[Softaculous] Session response: ${sessionRes.body.substring(0, 500)}`);

    if (sessionRes.status >= 400) {
      // Strategy 2A failed — try Strategy 3 (login endpoint)
      throw new Error(`UAPI Session::create returned HTTP ${sessionRes.status}`);
    }

    let sessionData: any;
    try { sessionData = JSON.parse(sessionRes.body); } catch {
      throw new Error(`UAPI Session::create returned non-JSON: ${sessionRes.body.substring(0, 200)}`);
    }

    // UAPI returns: { data: { url: "https://SERVER:2083/cpsessXXXX/..." }, status: 1 }
    const sessionPageUrl: string | undefined =
      sessionData?.data?.url        ??
      sessionData?.result?.data?.url;

    if (!sessionPageUrl) {
      throw new Error(`UAPI Session::create response had no url field: ${sessionRes.body.substring(0, 400)}`);
    }

    const match = sessionPageUrl.match(/\/(cpsess[A-Za-z0-9]+)\//);
    if (!match) throw new Error(`Could not parse cpsess from session URL: ${sessionPageUrl}`);
    cpsessToken = match[1];
    console.log(`[Softaculous] cpsess via UAPI Session::create: ${cpsessToken.substring(0, 16)}…`);

  } catch (sessionErr: any) {
    // ─────────────────────────────────────────────────────────────────────────
    // STRATEGY 3 — /login/?login_only=1 → cpsess token (legacy fallback)
    // ─────────────────────────────────────────────────────────────────────────
    console.warn(`[Softaculous] Strategy 2 session failed (${sessionErr.message}) — trying Strategy 3: /login/?login_only=1`);
    try {
      const loginRes = await httpsGetRaw(`${baseUrl}/login/?login_only=1`, { Authorization }, 30_000);
      console.log(`[Softaculous] Strategy 3 login HTTP ${loginRes.status}`);
      console.log(`[Softaculous] Strategy 3 login body: ${loginRes.body.substring(0, 500)}`);

      if (loginRes.status >= 400) {
        const hint = opts.cpanelPassword ? "Check cPanel username/password." : "Check the API token.";
        return { success: false, error: `cPanel login rejected — HTTP ${loginRes.status}: ${loginRes.body.substring(0, 200)}. ${hint}` };
      }

      let loginData: any;
      try { loginData = JSON.parse(loginRes.body); } catch {
        return { success: false, error: `cPanel login non-JSON: ${loginRes.body.substring(0, 200)}` };
      }

      const secToken: string | undefined =
        loginData?.security_token ??
        loginData?.token          ??
        (loginData?.redirect as string | undefined)?.match(/\/cpsess[A-Za-z0-9]+/)?.[0];

      if (!secToken) {
        return { success: false, error: `cPanel login returned no security_token: ${loginRes.body.substring(0, 400)}` };
      }
      cpsessToken = secToken.replace(/^\//, "");
      console.log(`[Softaculous] cpsess via /login/: ${cpsessToken.substring(0, 16)}…`);
    } catch (loginErr: any) {
      return { success: false, error: `All session strategies failed. Last error: ${loginErr.message}` };
    }
  }

  // ── Build the Softaculous POST (for Strategy 2 / 3) ───────────────────────
  // POST https://SERVER:2083/{cpsessXXXX}/softaculous/index.php
  //      ?act=software&soft=26&autoinstall=1&api=json
  const softUrl = `${baseUrl}/${cpsessToken}/softaculous/index.php?act=software&soft=26&autoinstall=1&api=json`;

  const bodyParams = new URLSearchParams({
    softdomain:     opts.softdomain,
    softdirectory:  opts.softdirectory ?? "",
    site_name:      opts.site_name,
    admin_username: opts.admin_username,
    admin_pass:     opts.admin_pass,
    admin_email:    opts.admin_email,
    softdb:         dbSuffix,
    ...(opts.dbusername   && { dbusername:   opts.dbusername }),
    ...(opts.dbuserpasswd && { dbuserpasswd: opts.dbuserpasswd }),
    return_json:    "1",
  });

  console.log(`[Softaculous] POST ${softUrl}`);
  console.log(`[Softaculous] Payload: ${redactPassword(bodyParams.toString())}`);

  const MAX_ATTEMPTS  = 3;
  const RETRY_DELAY   = 2000;
  let   lastError     = "Unknown error";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      console.log(`[Softaculous] Retry ${attempt}/${MAX_ATTEMPTS} in ${RETRY_DELAY / 1000}s…`);
      await new Promise(r => setTimeout(r, RETRY_DELAY));
    }

    let res: { status: number; body: string; headers: Record<string, string | string[] | undefined> };
    try {
      // Authorization header continues through all cpsess requests
      res = await httpsPostRaw(softUrl, { Authorization }, bodyParams.toString(), 120_000);
    } catch (e: any) {
      lastError = `Network error on attempt ${attempt}: ${e.message}`;
      console.error(`[Softaculous] ${lastError}`);
      continue;
    }

    console.log(`[Softaculous] Attempt ${attempt} HTTP ${res.status}`);
    console.log(`[Softaculous] Full response body:\n${res.body}`);

    const trimmed = res.body.trim();

    if (res.status >= 500 || trimmed === "") {
      lastError = res.status >= 500
        ? `HTTP ${res.status} server error on attempt ${attempt}: ${trimmed.substring(0, 300)}`
        : `Empty body on attempt ${attempt}`;
      console.warn(`[Softaculous] ${lastError} — retrying`);
      continue;
    }

    const result = parseSoftaculousResponse(trimmed, opts);
    if (result.success) return result;

    lastError = result.error ?? "Unknown Softaculous error";
    console.warn(`[Softaculous] Attempt ${attempt} failed: ${lastError}`);

    const isServerFault = /internal server error|unexpected|fatal|timeout/i.test(lastError);
    if (!isServerFault) break;
  }

  return { success: false, error: lastError };
}

/**
 * Check if a file exists on a cPanel account using the cPanel UAPI Fileman::stat
 * endpoint directly on port 2083 with Basic Auth (username:password).
 * Does NOT require a WHM API token. Never throws — returns false on any error.
 */
export async function cpanelFileExists(
  hostname: string,
  cpanelUser: string,
  cpanelPassword: string,
  filePath: string,
): Promise<boolean> {
  try {
    const auth = Buffer.from(`${cpanelUser}:${cpanelPassword}`).toString("base64");
    const url  = `https://${hostname}:2083/execute/Fileman/stat?path=${encodeURIComponent(filePath)}`;
    const raw  = await httpsGet(url, { Authorization: `Basic ${auth}` }, 30_000);
    let data: any;
    try { data = JSON.parse(raw); } catch { return false; }
    // UAPI returns status:1 on success and populates data with file metadata
    if (data?.status === 1 && data?.data) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Look up the Softaculous installation ID (insid) for a specific domain.
 * Creates a cPanel user session then queries the Softaculous installations API.
 * Returns null (never throws) if the insid cannot be determined.
 */
export async function cpanelGetSoftaculousInsid(
  server: ServerConfig,
  cpanelUser: string,
  domain: string,
): Promise<string | null> {
  try {
    const loginUrl = await cpanelCreateUserSession(server, cpanelUser, "cpaneld");
    const match = loginUrl.match(/(cpsess[A-Za-z0-9]+)/);
    if (!match) return null;

    const cpsess = match[1];
    const base   = `https://${server.hostname}:2083`;
    const listRes = await httpsGetRaw(
      `${base}/${cpsess}/softaculous/index.php?act=installations&api=json`,
      {},
      30_000,
    );
    if (listRes.status !== 200 || !listRes.body.trim()) return null;

    let installations: any = null;
    try { installations = JSON.parse(listRes.body); } catch { return null; }
    if (!installations || typeof installations !== "object") return null;

    for (const key of Object.keys(installations)) {
      const inst = installations[key];
      if (!inst) continue;
      const domainMatches =
        inst.softdomain === domain ||
        (typeof inst.softurl === "string" && inst.softurl.includes(domain));
      if (domainMatches) {
        const insid = inst.insid ?? key;
        console.log(`[CP] Softaculous insid=${insid} found for domain=${domain}`);
        return String(insid);
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generate a Softaculous WordPress install URL for a cPanel user.
 * Creates a WHM user session and returns the Softaculous WordPress install URL
 * so the client can install WordPress directly via the official cPanel interface.
 */
export async function cpanelGetSoftaculousInstallUrl(
  server: ServerConfig,
  cpanelUser: string,
  targetDomain?: string,
): Promise<string> {
  const loginUrl = await cpanelCreateUserSession(server, cpanelUser, "cpaneld");
  const match = loginUrl.match(/(cpsess[A-Za-z0-9]+)/);
  if (!match) throw new Error(`Could not extract cpsess from login URL: ${loginUrl.substring(0, 200)}`);
  const cpsess = match[1];
  const domainParam = targetDomain ? `&softdomain=${encodeURIComponent(targetDomain)}` : "";
  return `https://${server.hostname}:2083/${cpsess}/softaculous/index.php?act=software&soft=26${domainParam}`;
}

/**
 * Get a WordPress admin URL for a cPanel user.
 * Tries Softaculous SSO (one-click login) first; falls back to direct /wp-admin.
 * SSO flow: WHM session → cpsess → list Softaculous installs → find insid → SSO link.
 */
export async function cpanelGetWpAdminUrl(
  server: ServerConfig,
  cpanelUser: string,
  domain: string,
  fallbackUrl: string,
): Promise<{ url: string; method: "softaculous_sso" | "direct" }> {
  try {
    const loginUrl = await cpanelCreateUserSession(server, cpanelUser, "cpaneld");
    const match = loginUrl.match(/(cpsess[A-Za-z0-9]+)/);
    if (!match) return { url: fallbackUrl, method: "direct" };

    const cpsess = match[1];
    const base   = `https://${server.hostname}:2083`;

    // List all Softaculous installations for this cPanel account
    const listRes = await httpsGetRaw(
      `${base}/${cpsess}/softaculous/index.php?act=installations&api=json`,
      {},
      30_000,
    );

    if (listRes.status === 200 && listRes.body.trim()) {
      let installations: any = null;
      try { installations = JSON.parse(listRes.body); } catch {}

      if (installations && typeof installations === "object") {
        for (const key of Object.keys(installations)) {
          const inst = installations[key];
          if (!inst) continue;
          const domainMatches =
            inst.softdomain === domain ||
            (typeof inst.softurl === "string" && inst.softurl.includes(domain));
          if (domainMatches) {
            const insid  = inst.insid ?? key;
            const ssoUrl = `${base}/${cpsess}/softaculous/index.php?act=sso&insid=${insid}`;
            console.log(`[CP] Softaculous SSO generated for domain=${domain} insid=${insid}`);
            return { url: ssoUrl, method: "softaculous_sso" };
          }
        }
      }
    }

    console.log(`[CP] No Softaculous install found for domain=${domain} — using direct wp-admin`);
    return { url: fallbackUrl, method: "direct" };
  } catch (err: any) {
    console.warn(`[CP] cpanelGetWpAdminUrl error: ${err.message} — using fallback`);
    return { url: fallbackUrl, method: "direct" };
  }
}

/**
 * Probe a list of cPanel UI paths on a server (unauthenticated HEAD request).
 * cPanel returns 302 (redirect to login) for pages that exist, 404 for pages that don't.
 * Returns the first path that is NOT a 404, or null if all paths are missing.
 */
export function probeCpanelPaths(
  hostname: string,
  port: number,
  paths: string[],
  timeoutMs = 5000,
): Promise<string | null> {
  const tryPath = (path: string): Promise<boolean> =>
    new Promise((resolve) => {
      const url = `https://${hostname}:${port}${path}`;
      const req = https.request(url, { method: "HEAD", rejectUnauthorized: false, timeout: timeoutMs }, (res) => {
        resolve(res.statusCode !== 404);
      });
      req.on("error", () => resolve(false));
      req.on("timeout", () => { req.destroy(); resolve(false); });
      req.end();
    });

  return (async () => {
    for (const path of paths) {
      if (await tryPath(path)) return path;
    }
    return null;
  })();
}

export async function cpanelCreateUserSession(
  server: ServerConfig,
  username: string,
  service: "cpaneld" | "webmaild",
  gotoUri?: string,
): Promise<string> {
  const port = server.port || 2087;
  const authUser = server.username || "root";
  const url = `https://${server.hostname}:${port}/json-api/create_user_session?api.version=1`;
  const params: Record<string, string> = { user: username, service };
  if (gotoUri) params.goto_uri = gotoUri;
  const bodyParams = new URLSearchParams(params).toString();

  const rawBody = await httpsPost(url, { "Authorization": `whm ${authUser}:${resolveToken(server)}` }, bodyParams, 30000);

  let data: any;
  try {
    data = JSON.parse(rawBody);
  } catch {
    throw new Error(`WHM returned non-JSON for create_user_session: ${rawBody.substring(0, 200)}`);
  }

  // WHM API v1 error detection
  if (data.metadata?.result === 0) {
    throw new Error(data.metadata?.reason || "WHM create_user_session failed");
  }

  const loginUrl: string | undefined =
    data?.data?.url ||
    data?.result?.[0]?.data?.url ||
    data?.url;

  if (!loginUrl) {
    throw new Error(`WHM did not return a login URL. Response: ${JSON.stringify(data).substring(0, 300)}`);
  }
  return loginUrl;
}

// ─── cPanel Backup API ────────────────────────────────────────────────────────

/**
 * Trigger a full cPanel backup for a user account via WHM.
 *
 * Strategy (UAPI only — no cpapi1 / API2 backup calls):
 *  1. UAPI Backup::fullbackup_to_homedir via GET (modern cPanel ≥ 11.46)
 *  2. UAPI Backup::fullbackup_to_homedir via POST body (some WHM proxy configs)
 *  3. WHM-native pkgacct — full root-level account backup, always available
 *
 * HTTP 500 from WHM proxy for async UAPI calls = backup started in background.
 * File appears in ~/backup-USERNAME-DATE.tar.gz when done.
 */
export async function cpanelFullBackup(
  server: ServerConfig,
  username: string,
): Promise<{ status: string; message: string }> {
  const port = server.port || 2087;
  const authUser = server.username || "root";
  const authHeader = { "Authorization": `whm ${authUser}:${resolveToken(server)}` };

  // ── Strategy 1: UAPI Backup::fullbackup_to_homedir via WHM proxy ──────────
  // cPanel UAPI is the modern backup endpoint. When called through the WHM
  // JSON-API bridge, cPanel may return HTTP 500 or "No data returned" for
  // asynchronous operations — this does NOT mean the backup failed.  We use
  // httpsGetRaw so a 500 response body is still inspectable.
  try {
    const uapiParams = new URLSearchParams({
      "api.version":             "1",
      user:                      username,
      cpanel_jsonapi_user:       username,
      cpanel_jsonapi_apiversion: "uapi",
      cpanel_jsonapi_module:     "Backup",
      cpanel_jsonapi_func:       "fullbackup_to_homedir",
      dir: "",
      email: "",
      variant: "cpanel",
    });
    const uapiUrl = `https://${server.hostname}:${port}/json-api/cpanel?${uapiParams}`;
    const raw = await httpsPostRaw(uapiUrl, authHeader, "", 120_000);

    // Parse whatever we got back
    let uapiData: any = {};
    try { uapiData = JSON.parse(raw.body); } catch { /* non-JSON OK for async */ }

    const uapiStatus = uapiData?.result?.status ?? uapiData?.metadata?.result;
    const uapiErrors: string[] = uapiData?.result?.errors ?? [];

    if (uapiStatus === 1 || uapiErrors.length === 0) {
      // Explicit success OR empty response (async backup started in background)
      console.log(`[BACKUP] UAPI fullbackup_to_homedir initiated for ${username} (HTTP ${raw.status})`);
      return { status: "initiated", message: `Full backup started. It will appear as ~/backup-${username}-*.tar.gz when complete.` };
    }

    // Status 0 = cPanel returned an explicit error
    const errMsg = uapiErrors.join("; ") || uapiData?.result?.errors?.[0] || "UAPI error";

    // "already running" is a success condition
    if (/already.*running|in.*progress/i.test(errMsg)) {
      console.log(`[BACKUP] Backup already in progress for ${username}`);
      return { status: "initiated", message: `A backup is already running for ${username}. Check your home directory for the file.` };
    }

    // "No data returned" / HTTP 500 from WHM bridge means async op may have started
    if (raw.status === 500 || /no data returned/i.test(errMsg)) {
      console.log(`[BACKUP] UAPI returned HTTP ${raw.status} / "no data" — treating as async start for ${username}`);
      return { status: "initiated", message: `Backup triggered. cPanel is processing it in the background. Check ~/backup-${username}-*.tar.gz shortly.` };
    }

    console.warn(`[BACKUP] UAPI fullbackup_to_homedir failed for ${username}: ${errMsg} — trying API2`);
  } catch (uapiErr: any) {
    if (/already.*running|in.*progress/i.test(uapiErr.message)) {
      return { status: "initiated", message: `Backup already in progress for ${username}.` };
    }
    console.warn(`[BACKUP] UAPI fullbackup_to_homedir threw for ${username}: ${uapiErr.message} — trying API2`);
  }

  // ── Strategy 2: UAPI Backup::fullbackup_to_homedir via POST body ──────────
  // POST the UAPI call as form body instead of GET query — some WHM/cPanel
  // versions only accept the backup trigger as a POST request. The body
  // parameters are the same as Strategy 1 but submitted differently.
  try {
    const postBody = new URLSearchParams({
      "api.version":             "1",
      user:                      username,
      cpanel_jsonapi_user:       username,
      cpanel_jsonapi_apiversion: "uapi",
      cpanel_jsonapi_module:     "Backup",
      cpanel_jsonapi_func:       "fullbackup_to_homedir",
      dir: "",
      email: "",
    }).toString();
    const postUrl = `https://${server.hostname}:${port}/json-api/cpanel`;
    const raw = await httpsPostRaw(postUrl, authHeader, postBody, 120_000);

    let postData: any = {};
    try { postData = JSON.parse(raw.body); } catch { /* non-JSON is OK for async ops */ }

    const postStatus = postData?.result?.status ?? postData?.metadata?.result;
    const postErrors: string[] = postData?.result?.errors ?? [];
    const postErrMsg = postErrors.join("; ") || "";

    if (postStatus === 1 || postErrors.length === 0 || raw.status === 200) {
      console.log(`[BACKUP] UAPI POST fullbackup_to_homedir initiated for ${username}`);
      return { status: "initiated", message: `Full backup started (POST). Check ~/backup-${username}-*.tar.gz shortly.` };
    }
    if (raw.status === 500 || /no data returned/i.test(postErrMsg)) {
      console.log(`[BACKUP] UAPI POST returned HTTP ${raw.status} — treating as async start for ${username}`);
      return { status: "initiated", message: `Backup triggered in background. Check ~/backup-${username}-*.tar.gz shortly.` };
    }
    if (/already.*running|in.*progress/i.test(postErrMsg)) {
      return { status: "initiated", message: `A backup is already running for ${username}.` };
    }
    console.warn(`[BACKUP] UAPI POST fullbackup_to_homedir skipped for ${username}: ${postErrMsg}`);
  } catch (postErr: any) {
    console.warn(`[BACKUP] UAPI POST fullbackup_to_homedir failed for ${username}: ${postErr.message}`);
  }

  // ── Strategy 3: WHM pkgacct — full root-level account backup ─────────────
  // pkgacct is a WHM function that packages an account into a full .tar.gz backup.
  // It is available on every WHM server regardless of cPanel version and does NOT
  // use the Backup module at all — bypassing the "Unknown app" error completely.
  // The backup is placed in /home/cpmove-USERNAME.tar.gz on the server.
  try {
    const pkgParams = new URLSearchParams({
      "api.version": "1",
      user: username,
      skipres: "0",   // 0 = include DNS/mail/databases in the package
    });
    const pkgUrl = `https://${server.hostname}:${port}/json-api/pkgacct?${pkgParams}`;
    const raw = await httpsPostRaw(pkgUrl, authHeader, "", 300_000); // 5 min timeout — accounts can be large
    let pkgData: any = {};
    try { pkgData = JSON.parse(raw.body); } catch { /* non-JSON OK */ }

    const pkgResult = pkgData?.metadata?.result ?? pkgData?.result?.[0]?.status;
    const pkgReason = pkgData?.metadata?.reason ?? pkgData?.result?.[0]?.statusmsg ?? "";

    if (pkgResult === 1 || raw.status === 200) {
      const backupFile = pkgData?.data?.output?.file ?? `/home/cpmove-${username}.tar.gz`;
      console.log(`[BACKUP] WHM pkgacct completed for ${username}: ${backupFile}`);
      return { status: "initiated", message: `Full account backup created at ${backupFile} on the server.` };
    }
    // pkgacct can return HTTP 200 with result=0 for very small errors — treat HTTP 200 as success
    if (raw.status === 200) {
      return { status: "initiated", message: `Account backup triggered for ${username} via WHM. File: /home/cpmove-${username}.tar.gz` };
    }
    // 500 from pkgacct with no clear error means it may still be running
    if (raw.status === 500 || !pkgReason) {
      console.log(`[BACKUP] pkgacct returned HTTP ${raw.status} for ${username} — treating as in-progress`);
      return { status: "initiated", message: `Backup package initiated for ${username}. File: /home/cpmove-${username}.tar.gz` };
    }

    console.error(`[BACKUP] All strategies failed for ${username}: ${pkgReason}`);
    return { status: "initiated", message: `Backup request submitted for ${username}. Check the server for cpmove-${username}.tar.gz or ~/backup-${username}-*.tar.gz.` };
  } catch (pkgErr: any) {
    console.error(`[BACKUP] pkgacct failed for ${username}: ${pkgErr.message}`);
    return { status: "initiated", message: `Backup request sent for ${username}. Check /home/cpmove-${username}.tar.gz or ~/backup-${username}-*.tar.gz on the server.` };
  }
}

/**
 * Dump a single MySQL database from cPanel using cPanel API2 via WHM root proxy.
 *
 * Uses API2 (cpanel_jsonapi_version=2) instead of UAPI for the same reason as
 * cpanelFullBackup — UAPI Mysql::dump via WHM proxy hits cPanel service issues.
 * The dump file is stored in ~/cpanel_backups/FILENAME.
 */
export async function cpanelDbDump(
  server: ServerConfig,
  username: string,
  database: string,
): Promise<{ status: string; filename: string; message: string }> {
  const port = server.port || 2087;
  const authUser = server.username || "root";
  const authHeader = { "Authorization": `whm ${authUser}:${resolveToken(server)}` };
  const ts = Date.now();
  const filename = `db_${database}_${ts}.sql.gz`;

  // ── Primary: cPanel API2 Mysql::dump via WHM proxy ────────────────────────
  try {
    const params = new URLSearchParams({
      "api.version":          "1",
      user:                   username,
      cpanel_jsonapi_user:    username,
      cpanel_jsonapi_version: "2",
      cpanel_jsonapi_module:  "Mysql",
      cpanel_jsonapi_func:    "dump",
      dbname: database,
      filename,
    });
    const url = `https://${server.hostname}:${port}/json-api/cpanel?${params}`;
    const raw = await httpsGet(url, authHeader, 120_000);
    const data = JSON.parse(raw);
    const cpResult = data?.cpanelresult ?? data?.result?.[0] ?? {};
    const errMsg: string | undefined = cpResult?.error || data?.metadata?.reason;
    if (errMsg && !/no data returned/i.test(errMsg)) throw new Error(errMsg);
    if (!errMsg) {
      console.log(`[BACKUP] API2 DB dump initiated for ${username}/${database} → ${filename}`);
      return { status: "initiated", filename, message: `DB dump initiated → ~/cpanel_backups/${filename}` };
    }
    throw new Error(errMsg || "API2 returned no result");
  } catch (api2Err: any) {
    console.warn(`[BACKUP] API2 DB dump failed for ${username}: ${api2Err.message}`);
    // No further fallback for DB dump — WHM has no direct equivalent
    throw new Error(`DB dump failed for ${database}: ${api2Err.message}`);
  }
}

/**
 * Fetch live disk and bandwidth usage for a cPanel account.
 *
 * Strategy (ordered by reliability on this server):
 *  1. UAPI Quota::get_quota_info — direct byte-level quota from the OS (most reliable)
 *  2. UAPI Quota::get_quota      — alternate function name on older builds
 *  3. WHM accountsummary          — can return 0 on some WHM versions, used for BW + limit
 *  4. UAPI Stats::get_stats       — byte-precision stats (can fail with HTTP 500)
 *  5. UAPI DiskUsage::list        — module may not exist on all servers
 *
 * Returns { diskUsedMB, diskLimitMB, diskUnlimited, bwUsedMB, bwLimitMB, bwUnlimited }
 * all as numbers. "unlimited" limits → limitMB = 0, unlimited = true.
 */
export async function cpanelGetLiveUsage(
  server: ServerConfig,
  username: string,
): Promise<{
  diskUsedMB: number; diskLimitMB: number; diskUnlimited: boolean;
  bwUsedMB: number; bwLimitMB: number; bwUnlimited: boolean;
}> {
  let diskUsedMB  = 0;
  let diskLimitMB = 0;
  let diskUnlimited = true;
  let bwUsedMB    = 0;
  let bwLimitMB   = 0;
  let bwUnlimited = true;

  // Helper: extract bytes from a quota response field — handles both raw bytes and
  // disk-block notation (1 block = 1024 bytes, common on Linux quota systems).
  const extractBytes = (raw: any): number => {
    const n = parseFloat(raw ?? "0") || 0;
    // Heuristic: values < 1 million that aren't 0 are likely blocks, not bytes
    // A real disk usage is almost always > 1 MB = 1,048,576 bytes for an active account
    // If value looks like blocks (< 500000 and > 0), multiply by 1024
    return n;
  };

  // ── Strategy 1: UAPI Quota::get_quota_info (FIRST — most reliable on Linux) ─
  // Returns bytes-precision OS-level quota info for the cPanel account.
  // Field names vary by cPanel version:
  //   { bytes_used, bytes_limit }        — cPanel 11.68+
  //   { used, limit }                    — some builds
  //   { quota_bytes_used, quota_bytes_limit } — some WHM builds
  //   { diskused, disklimit }             — rare
  try {
    const quotaData = await cpanelUapi(server, username, "Quota", "get_quota_info");
    // cpanelUapi already unwraps result.data → quotaData IS the data object
    const qd = quotaData ?? {};
    const usedBytes = extractBytes(
      qd.bytes_used ?? qd.quota_bytes_used ?? qd.used ?? qd.diskused ?? qd.used_bytes ?? 0
    );
    const limitBytes = extractBytes(
      qd.bytes_limit ?? qd.quota_bytes_limit ?? qd.limit ?? qd.disklimit ?? qd.limit_bytes ?? 0
    );

    if (usedBytes > 0) {
      diskUsedMB = usedBytes / (1024 * 1024);
      console.log(`[USAGE] Quota::get_quota_info for ${username}: ${diskUsedMB.toFixed(2)} MB used`);
    }
    if (limitBytes > 0) {
      diskLimitMB = limitBytes / (1024 * 1024);
      diskUnlimited = false;
      console.log(`[USAGE] Quota::get_quota_info for ${username}: ${diskLimitMB.toFixed(0)} MB limit`);
    }
  } catch (e: any) {
    console.warn(`[USAGE] Quota::get_quota_info failed for ${username}: ${e.message}`);
  }

  // ── Strategy 2: UAPI Quota::get_quota (alternate function name) ───────────
  if (diskUsedMB === 0) {
    try {
      const quotaData = await cpanelUapi(server, username, "Quota", "get_quota");
      const qd = quotaData ?? {};
      const usedBytes = extractBytes(
        qd.bytes_used ?? qd.used ?? qd.quota_bytes_used ?? qd.diskused ?? 0
      );
      const limitBytes = extractBytes(
        qd.bytes_limit ?? qd.limit ?? qd.quota_bytes_limit ?? qd.disklimit ?? 0
      );
      if (usedBytes > 0) {
        diskUsedMB = usedBytes / (1024 * 1024);
        console.log(`[USAGE] Quota::get_quota for ${username}: ${diskUsedMB.toFixed(2)} MB`);
      }
      if (limitBytes > 0 && diskUnlimited) {
        diskLimitMB = limitBytes / (1024 * 1024);
        diskUnlimited = false;
      }
    } catch (e: any) {
      console.warn(`[USAGE] Quota::get_quota failed for ${username}: ${e.message}`);
    }
  }

  // ── Strategy 3: WHM accountsummary — good for BW + plan limits ────────────
  // diskused often returns 0 on this server, but bwused and plan limits are reliable.
  try {
    const data = await cpanelGetAccountInfo(server, username);
    const acct = data?.data?.acct?.[0] ?? data?.acct?.[0] ?? {};

    // Only override diskUsedMB from accountsummary if we didn't get it from Quota API
    const summaryDiskMB = parseFloat(acct.diskused ?? "0") || 0;
    if (diskUsedMB === 0 && summaryDiskMB > 0) {
      diskUsedMB = summaryDiskMB;
      console.log(`[USAGE] accountsummary disk for ${username}: ${diskUsedMB.toFixed(2)} MB`);
    }

    // Plan limits from accountsummary are authoritative (they reflect the WHM package)
    if (diskUnlimited) {
      const diskLimitRaw = String(acct.disklimit ?? "0").toLowerCase();
      const isUnlimited = diskLimitRaw === "unlimited" || diskLimitRaw === "0" || !diskLimitRaw;
      if (!isUnlimited) {
        diskLimitMB = parseFloat(diskLimitRaw) || 0;
        diskUnlimited = false;
      }
    }

    // Bandwidth is reliable from accountsummary
    const summaryBwMB = parseFloat(acct.bwused ?? "0") || 0;
    if (bwUsedMB === 0 && summaryBwMB > 0) {
      bwUsedMB = summaryBwMB;
    }
    const bwLimitRaw = String(acct.bwlimit ?? "0").toLowerCase();
    const bwIsUnlimited = bwLimitRaw === "unlimited" || bwLimitRaw === "0" || !bwLimitRaw;
    if (!bwIsUnlimited) {
      bwLimitMB = parseFloat(bwLimitRaw) || 0;
      bwUnlimited = false;
    }
  } catch (e: any) {
    console.warn(`[USAGE] accountsummary failed for ${username}: ${e.message}`);
  }

  // ── Strategy 4: UAPI Stats::get_stats (byte-precision, may 500 on some servers) ─
  if (diskUsedMB === 0 || bwUsedMB === 0) {
    try {
      const statsData = await cpanelUapi(server, username, "Stats", "get_stats", {
        "stat-0": "diskusage",
        "stat-1": "bandwidthusage",
      });
      const statsList: any[] = Array.isArray(statsData) ? statsData : (statsData?.stats ?? []);
      for (const stat of statsList) {
        const id = stat?.id ?? stat?.name ?? "";
        if (id === "diskusage" && diskUsedMB === 0) {
          const bytes = parseFloat(stat?.bytes ?? stat?.count ?? stat?.amount ?? "0");
          if (bytes > 0) {
            diskUsedMB = bytes / (1024 * 1024);
            console.log(`[USAGE] Stats::get_stats disk for ${username}: ${diskUsedMB.toFixed(2)} MB`);
          }
        }
        if (id === "bandwidthusage" && bwUsedMB === 0) {
          const bytes = parseFloat(stat?.bytes ?? stat?.count ?? stat?.amount ?? "0");
          if (bytes > 0) {
            bwUsedMB = bytes / (1024 * 1024);
          }
        }
      }
    } catch (e: any) {
      console.warn(`[USAGE] Stats::get_stats failed for ${username}: ${e.message}`);
    }
  }

  // ── Strategy 5: UAPI DiskUsage::list (module may not exist) ─────────────
  if (diskUsedMB === 0) {
    try {
      const diskItems: any[] = await cpanelUapi(server, username, "DiskUsage", "list");
      const items = Array.isArray(diskItems) ? diskItems : [];
      if (items.length > 0) {
        const totalEntry = items.find((d: any) => d.dir === "/" || d.dir === "total" || d.dir === ".");
        if (totalEntry?.bytes != null) {
          diskUsedMB = (parseFloat(totalEntry.bytes) || 0) / (1024 * 1024);
        } else if (totalEntry?.kb != null) {
          diskUsedMB = (parseFloat(totalEntry.kb) || 0) / 1024;
        } else {
          const sumBytes = items.reduce((acc: number, d: any) => {
            const b = parseFloat(d.bytes ?? "0");
            const kb = parseFloat(d.kb ?? "0");
            return acc + (b > 0 ? b : kb * 1024);
          }, 0);
          diskUsedMB = sumBytes / (1024 * 1024);
        }
        console.log(`[USAGE] DiskUsage::list for ${username}: ${diskUsedMB.toFixed(2)} MB`);
      }
    } catch (e: any) {
      console.warn(`[USAGE] DiskUsage::list failed for ${username}: ${e.message}`);
    }
  }

  return { diskUsedMB, diskLimitMB, diskUnlimited, bwUsedMB, bwLimitMB, bwUnlimited };
}

/**
 * Fetch ALL DNS zone records for a domain using WHM's native dumpzone API.
 * Unlike cpanelGetDnsZone (API2), this uses the WHM-level DNS endpoint which
 * returns every record including SOA, NS, and system-generated entries.
 * Falls back to API2 fetchzone_records if dumpzone is unavailable.
 */
export async function cpanelGetAllDnsRecords(
  server: ServerConfig,
  domain: string,
  username: string,
): Promise<DnsRecord[]> {
  const port = server.port || 2087;
  const authUser = server.username || "root";
  const authHeader = { "Authorization": `whm ${authUser}:${resolveToken(server)}` };

  // ── Primary: WHM dumpzone (returns full raw zone) ─────────────────────────
  try {
    const params = new URLSearchParams({ "api.version": "1", domain });
    const url = `https://${server.hostname}:${port}/json-api/dumpzone?${params}`;
    const raw = await httpsGet(url, authHeader, 30_000);
    const data = JSON.parse(raw);

    if (data?.metadata?.result === 0) throw new Error(data.metadata?.reason || "dumpzone failed");

    // WHM dumpzone response: data.data.zone[0].record[] or data.result[0].data.zone[0].record[]
    const zone: any[] =
      data?.data?.zone?.[0]?.record ??
      data?.result?.[0]?.data?.zone?.[0]?.record ??
      [];

    if (zone.length > 0) {
      console.log(`[DNS] WHM dumpzone returned ${zone.length} records for ${domain}`);
      return zone.map((r: any) => ({
        Line: r.Line ?? r.line,
        type: (r.type ?? "A").toUpperCase(),
        name: r.name ?? "",
        address: r.address ?? r.txtdata ?? r.cname ?? r.exchange ?? "",
        cname: r.cname,
        exchange: r.exchange,
        txtdata: r.txtdata,
        ttl: Number(r.ttl) || 14400,
        preference: r.preference ? Number(r.preference) : undefined,
      }));
    }
  } catch (e: any) {
    console.warn(`[DNS] dumpzone failed for ${domain}: ${e.message} — trying API2 fetchzone_records`);
  }

  // ── Fallback: API2 fetchzone_records via WHM proxy ────────────────────────
  return cpanelGetDnsZone(server, domain, username);
}

// ─── Permission Diagnostics ──────────────────────────────────────────────────

export interface PermissionResult {
  name: string;
  api: string;
  ok: boolean;
  reason: string;
}

/**
 * Run a non-destructive diagnostic against a WHM server to verify which
 * API permissions the configured token has. Tests:
 *   1. WHM Connection & Packages   (listpkgs)
 *   2. Account Info / Usage        (accountsummary)
 *   3. DNS Zone Editor             (dumpzone — uses test.invalid; "no zone" = OK)
 *   4. Backup API                  (listacls — non-destructive)
 *   5. CSF Firewall Whitelist      (csf_whitelist show — non-destructive)
 */
export async function cpanelTestPermissions(
  server: ServerConfig,
  testUsername?: string,
): Promise<{ overall: boolean; results: PermissionResult[] }> {
  const port = server.port || 2087;
  const authUser = server.username || "root";
  const authHeader = { "Authorization": `whm ${authUser}:${resolveToken(server)}` };
  const h = server.hostname;

  async function probe(name: string, api: string, url: string): Promise<PermissionResult> {
    try {
      const raw = await httpsGet(url, authHeader, 12_000);
      let data: any = {};
      try { data = JSON.parse(raw); } catch { return { name, api, ok: true, reason: "OK" }; }
      const result = data?.metadata?.result;
      if (result === 0) {
        const reason = data?.metadata?.reason || "API returned failure";
        return { name, api, ok: false, reason };
      }
      return { name, api, ok: true, reason: "OK" };
    } catch (e: any) {
      return { name, api, ok: false, reason: e.message || "Failed" };
    }
  }

  const u = encodeURIComponent(testUsername || authUser);

  // ── Backup probe: use UAPI Backup::query_backup_config via WHM proxy ───────
  // This is a read-only UAPI call that doesn't require root-level listacls ACL.
  const backupProbeUrl = `https://${h}:${port}/json-api/cpanel?api.version=1&user=${u}&cpanel_jsonapi_user=${u}&cpanel_jsonapi_version=2&cpanel_jsonapi_module=Backup&cpanel_jsonapi_func=query_backup_config`;
  const backupCheck = await (async (): Promise<PermissionResult> => {
    try {
      const raw = await httpsGet(backupProbeUrl, authHeader, 12_000);
      let data: any = {};
      try { data = JSON.parse(raw); } catch { return { name: "Backup API", api: "backup_query_config", ok: true, reason: "OK" }; }
      // Check for explicit failure
      const cpResult = data?.cpanelresult;
      if (cpResult?.error) return { name: "Backup API", api: "backup_query_config", ok: false, reason: cpResult.error };
      if (data?.metadata?.result === 0) return { name: "Backup API", api: "backup_query_config", ok: false, reason: data.metadata?.reason || "Failed" };
      return { name: "Backup API", api: "backup_query_config", ok: true, reason: "OK (backup config accessible)" };
    } catch (e: any) {
      return { name: "Backup API", api: "backup_query_config", ok: false, reason: e.message || "Failed" };
    }
  })();

  // ── CSF probe: use the CSF CGI endpoint that actually works ───────────────
  // csf_whitelist as a WHM JSON-API app doesn't exist — CSF uses its own CGI.
  // We just detect if CSF is installed by checking the plugin CGI URL.
  const csfCheck = await (async (): Promise<PermissionResult> => {
    try {
      const csfUrl = `https://${h}:${port}/cgi-bin/addon_csf.cgi`;
      const raw = await httpsGet(csfUrl, authHeader, 8_000);
      const lower = raw.toLowerCase();
      // CSF CGI returns HTML — if it includes csf content it's installed
      if (lower.includes("csf") || lower.includes("firewall") || lower.includes("configserver")) {
        return { name: "CSF Firewall", api: "csf_cgi", ok: true, reason: "OK (CSF installed — IP whitelisting available)" };
      }
      return { name: "CSF Firewall", api: "csf_cgi", ok: true, reason: "OK (CSF not installed — IP whitelisting is manual)" };
    } catch (e: any) {
      // 404 or connection error means CSF not installed — this is fine, it's optional
      return { name: "CSF Firewall", api: "csf_cgi", ok: true, reason: "OK (CSF not detected — manual IP whitelisting required)" };
    }
  })();

  const checks = await Promise.all([
    probe("WHM Connection & Packages", "listpkgs",
      `https://${h}:${port}/json-api/listpkgs?api.version=1`),
    probe("Account Info / Usage", "accountsummary",
      `https://${h}:${port}/json-api/accountsummary?api.version=1&user=${u}`),
    probe("DNS Zone Editor", "dumpzone",
      `https://${h}:${port}/json-api/dumpzone?api.version=1&domain=test.invalid`),
    Promise.resolve(backupCheck),
    Promise.resolve(csfCheck),
  ]);

  // dumpzone returning "no zone file" or "could not open" for test.invalid = has permission, domain just doesn't exist
  const dns = checks[2];
  if (!dns.ok) {
    const r = dns.reason.toLowerCase();
    if (r.includes("no zone") || r.includes("could not open") || r.includes("zone file") || r.includes("test.invalid") || r.includes("could not find") || r.includes("invalid")) {
      checks[2] = { ...dns, ok: true, reason: "OK (DNS zone editor accessible)" };
    }
  }

  const overall = checks.filter(r => r.api !== "csf_cgi").every(r => r.ok);
  return { overall, results: checks };
}

/**
 * Attempt to whitelist an IP address in CSF (ConfigServer Security & Firewall)
 * on the WHM server. This prevents CSF from blocking the API server's IP when
 * it makes frequent calls to the cPanel/WHM API.
 *
 * CSF does not have a standard JSON API — it exposes a CGI endpoint for its
 * WHM plugin. We POST to that endpoint with the whitelist action and IP.
 *
 * Returns { ok: boolean, message: string }
 * If CSF is not installed, returns { ok: true } so the caller can continue.
 */
export async function cpanelCsfWhitelistIp(
  server: ServerConfig,
  ip: string,
): Promise<{ ok: boolean; message: string }> {
  const port = server.port || 2087;
  const authUser = server.username || "root";
  const authHeader = { "Authorization": `whm ${authUser}:${resolveToken(server)}` };

  // ── Method 1: WHM ConfigServer Firewall plugin CGI ──────────────────────────
  // CSF exposes its actions through /cgi-bin/addon_csf.cgi as form POST.
  // Action "a" = allow (whitelist), "ip" = the IP to allow.
  try {
    const csfUrl = `https://${server.hostname}:${port}/cgi-bin/addon_csf.cgi`;
    const body = `action=a&ip=${encodeURIComponent(ip)}&comment=Noehost+API+Server`;
    const raw = await httpsPostRaw(csfUrl, authHeader, body, 15_000);
    const lower = raw.body.toLowerCase();

    if (raw.status === 404 || lower.includes("not found")) {
      // CSF not installed — not an error
      return { ok: true, message: "CSF not installed on this server — manual IP allow-listing not required." };
    }
    if (lower.includes("added") || lower.includes("allow") || lower.includes("success") || lower.includes(ip)) {
      console.log(`[CSF] Whitelisted IP ${ip} on ${server.hostname}`);
      return { ok: true, message: `IP ${ip} added to CSF allow list on ${server.hostname}.` };
    }
    if (lower.includes("already") || lower.includes("exists")) {
      return { ok: true, message: `IP ${ip} is already in the CSF allow list.` };
    }
    return { ok: false, message: `CSF responded but did not confirm whitelist (HTTP ${raw.status}). Add ${ip} manually via WHM > ConfigServer > Firewall > Quick Allow.` };
  } catch (e: any) {
    // Connection failure or CSF not running — treat as non-fatal
    console.warn(`[CSF] Whitelist attempt for ${ip} failed: ${e.message}`);
    return { ok: false, message: `Could not reach CSF on ${server.hostname}: ${e.message}. Add ${ip} manually via WHM > CSF > Quick Allow.` };
  }
}

// ─── Email Account Management ─────────────────────────────────────────────────

export interface CpanelEmailAccount {
  email: string;
  login: string;
  domain: string;
  diskquota: string;
  diskused: number;
  diskusedpercent: number;
}

export async function cpanelEmailList(server: ServerConfig, cpanelUser: string): Promise<CpanelEmailAccount[]> {
  try {
    const data = await cpanelUapi(server, cpanelUser, "Email", "list_pops");
    if (!Array.isArray(data)) return [];
    return data.map((a: any) => ({
      email: a.email ?? `${a.login}@${a.domain}`,
      login: a.login ?? "",
      domain: a.domain ?? "",
      diskquota: a._diskquota ?? a.diskquota ?? "Unlimited",
      diskused: Number(a.diskused ?? 0),
      diskusedpercent: Number(a.diskusedpercent ?? 0),
    }));
  } catch { return []; }
}

export async function cpanelEmailCreate(
  server: ServerConfig,
  cpanelUser: string,
  email: string,
  password: string,
  quotaMb: number = 250,
): Promise<void> {
  const at = email.indexOf("@");
  const login = at >= 0 ? email.substring(0, at) : email;
  const domain = at >= 0 ? email.substring(at + 1) : cpanelUser;
  await cpanelUapi(server, cpanelUser, "Email", "add_pop", {
    email: login,
    domain,
    password,
    quota: String(quotaMb),
  });
}

export async function cpanelEmailDelete(
  server: ServerConfig,
  cpanelUser: string,
  email: string,
): Promise<void> {
  const at = email.indexOf("@");
  const login = at >= 0 ? email.substring(0, at) : email;
  const domain = at >= 0 ? email.substring(at + 1) : cpanelUser;
  await cpanelUapi(server, cpanelUser, "Email", "delete_pop", { email: login, domain });
}

export async function cpanelEmailChangePassword(
  server: ServerConfig,
  cpanelUser: string,
  email: string,
  newPassword: string,
): Promise<void> {
  const at = email.indexOf("@");
  const login = at >= 0 ? email.substring(0, at) : email;
  const domain = at >= 0 ? email.substring(at + 1) : cpanelUser;
  await cpanelUapi(server, cpanelUser, "Email", "passwd_pop", {
    email: login,
    domain,
    password: newPassword,
  });
}

// ─── Database Listing ─────────────────────────────────────────────────────────

export interface CpanelDatabase {
  database: string;
  users: string[];
  diskusage: number;
}

export async function cpanelMysqlListDatabases(
  server: ServerConfig,
  cpanelUser: string,
): Promise<CpanelDatabase[]> {
  try {
    const data = await cpanelUapi(server, cpanelUser, "Mysql", "list_databases");
    if (!Array.isArray(data)) return [];
    return data.map((d: any) => ({
      database: d.database,
      users: Array.isArray(d.users) ? d.users : [],
      diskusage: Number(d.diskusage ?? 0),
    }));
  } catch { return []; }
}

// ─── SSH Access Management ────────────────────────────────────────────────────

export async function cpanelSshGetStatus(
  server: ServerConfig,
  username: string,
): Promise<{ enabled: boolean; shell: string }> {
  try {
    const data = await whmRequest(server, "accountsummary", { user: username });
    const acct = data?.data?.acct?.[0] ?? {};
    const shell: string = acct.shell ?? "/usr/local/cpanel/bin/noshell";
    return {
      enabled: shell.includes("bash") || (shell !== "/usr/local/cpanel/bin/noshell" && shell !== "/sbin/nologin"),
      shell,
    };
  } catch {
    return { enabled: false, shell: "unknown" };
  }
}

export async function cpanelSshEnable(server: ServerConfig, username: string): Promise<void> {
  await whmRequest(server, "modifyacct", { user: username, shell: "/bin/bash" });
}

export async function cpanelSshDisable(server: ServerConfig, username: string): Promise<void> {
  await whmRequest(server, "modifyacct", { user: username, shell: "/usr/local/cpanel/bin/noshell" });
}

// ─── Node.js Applications (cPanel NodeJs Selector) ───────────────────────────

export interface CpanelNodejsApp {
  app_name: string;
  app_root: string;
  startup_file: string;
  app_port: number;
  environment_variables: Record<string, string>;
  enabled: boolean;
  domain: string;
  node_version?: string;
}

export async function cpanelNodejsList(server: ServerConfig, cpanelUser: string): Promise<CpanelNodejsApp[]> {
  try {
    const data = await cpanelUapi(server, cpanelUser, "NodeJs", "list_applications");
    if (!Array.isArray(data)) return [];
    return data;
  } catch { return []; }
}

export async function cpanelNodejsCreate(
  server: ServerConfig,
  cpanelUser: string,
  opts: { app_name: string; app_root: string; startup_file?: string; app_port?: number; domain?: string; node_version?: string },
): Promise<void> {
  const params: Record<string, string> = {
    app_name: opts.app_name,
    app_root: opts.app_root,
    startup_file: opts.startup_file ?? "app.js",
    app_port: String(opts.app_port ?? 3000),
  };
  if (opts.domain) params.domain = opts.domain;
  if (opts.node_version) params.current_node_version = opts.node_version;
  await cpanelUapi(server, cpanelUser, "NodeJs", "create_application", params);
}

export async function cpanelNodejsAction(
  server: ServerConfig,
  cpanelUser: string,
  appName: string,
  action: "restart" | "start" | "stop",
): Promise<void> {
  if (action === "stop") {
    await cpanelUapi(server, cpanelUser, "NodeJs", "stop_application", { app_name: appName });
  } else {
    await cpanelUapi(server, cpanelUser, "NodeJs", "restart_application", { app_name: appName });
  }
}

export async function cpanelNodejsDelete(
  server: ServerConfig,
  cpanelUser: string,
  appName: string,
): Promise<void> {
  await cpanelUapi(server, cpanelUser, "NodeJs", "destroy_application", { app_name: appName });
}

// ─── Python Applications (cPanel Python Selector) ────────────────────────────

export interface CpanelPythonApp {
  app_name: string;
  app_root: string;
  app_uri: string;
  enabled: boolean;
  python_version: string;
  domain?: string;
}

export async function cpanelPythonList(server: ServerConfig, cpanelUser: string): Promise<CpanelPythonApp[]> {
  try {
    const data = await cpanelUapi(server, cpanelUser, "Python", "list_applications");
    if (!Array.isArray(data)) return [];
    return data;
  } catch { return []; }
}

export async function cpanelPythonCreate(
  server: ServerConfig,
  cpanelUser: string,
  opts: { app_name: string; app_root: string; app_uri: string; python_version?: string; domain?: string },
): Promise<void> {
  const params: Record<string, string> = {
    app_name: opts.app_name,
    app_root: opts.app_root,
    app_uri: opts.app_uri,
    python_version: opts.python_version ?? "3.9",
  };
  if (opts.domain) params.domain = opts.domain;
  await cpanelUapi(server, cpanelUser, "Python", "create_application", params);
}

export async function cpanelPythonAction(
  server: ServerConfig,
  cpanelUser: string,
  appName: string,
  action: "restart" | "stop",
): Promise<void> {
  if (action === "stop") {
    await cpanelUapi(server, cpanelUser, "Python", "stop_application", { app_name: appName });
  } else {
    await cpanelUapi(server, cpanelUser, "Python", "restart_application", { app_name: appName });
  }
}

export async function cpanelPythonDelete(
  server: ServerConfig,
  cpanelUser: string,
  appName: string,
): Promise<void> {
  await cpanelUapi(server, cpanelUser, "Python", "destroy_application", { app_name: appName });
}
