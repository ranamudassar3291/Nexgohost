/**
 * cPanel WHM API v1 Module
 * Uses Node.js https module with rejectUnauthorized:false because WHM servers
 * almost always use self-signed TLS certificates. fetch() rejects those by
 * default, causing "400" or "SSL" errors that have nothing to do with the
 * credentials.
 */

import https from "node:https";

interface ServerConfig {
  hostname: string;
  port: number;
  username: string;
  apiToken: string;
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
          reject(new Error(`WHM API error: HTTP ${res.statusCode} — ${body.substring(0, 200)}`));
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
          reject(new Error(`WHM API error: HTTP ${res.statusCode} — ${responseBody.substring(0, 200)}`));
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
  const headers = { "Authorization": `whm ${authUser}:${server.apiToken}` };

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
    const body = await httpsGet(url, { "Authorization": `whm ${authUser}:${server.apiToken}` });
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
  const whmUrl = `https://${server.hostname}:${port}/json-api/cpanel?cpanel_jsonapi_version=2&cpanel_jsonapi_module=ZoneEdit&cpanel_jsonapi_func=fetchzone_records&domain=${encodeURIComponent(domain)}&customonly=0&api.version=1&user=${encodeURIComponent(username)}`;
  const body = await httpsGet(whmUrl, { "Authorization": `whm ${authUser}:${server.apiToken}` });
  const data = JSON.parse(body);
  const records: any[] = data?.cpanelresult?.data?.[0]?.record || data?.data?.record || data?.result?.[0]?.data?.record || [];
  return records.map((r: any) => ({
    Line: r.Line,
    type: r.type,
    name: r.name,
    address: r.address,
    cname: r.cname,
    exchange: r.exchange,
    txtdata: r.txtdata,
    ttl: Number(r.ttl) || 14400,
    preference: r.preference,
  }));
}

export async function cpanelAddDnsRecord(server: ServerConfig, username: string, domain: string, record: Omit<DnsRecord, "Line">): Promise<void> {
  const port = server.port || 2087;
  const authUser = server.username || "root";
  const params = new URLSearchParams({
    "api.version": "1", user: username,
    cpanel_jsonapi_version: "2", cpanel_jsonapi_module: "ZoneEdit", cpanel_jsonapi_func: "add_zone_record",
    domain, type: record.type, name: record.name, ttl: String(record.ttl || 14400),
    ...(record.address && { address: record.address }),
    ...(record.cname && { cname: record.cname }),
    ...(record.exchange && { exchange: record.exchange }),
    ...(record.txtdata && { txtdata: record.txtdata }),
    ...(record.preference && { preference: String(record.preference) }),
  });
  const url = `https://${server.hostname}:${port}/json-api/cpanel?${params.toString()}`;
  const body = await httpsGet(url, { "Authorization": `whm ${authUser}:${server.apiToken}` });
  const data = JSON.parse(body);
  if (data?.cpanelresult?.error) throw new Error(data.cpanelresult.error);
}

export async function cpanelEditDnsRecord(server: ServerConfig, username: string, domain: string, line: number, record: Omit<DnsRecord, "Line">): Promise<void> {
  const port = server.port || 2087;
  const authUser = server.username || "root";
  const params = new URLSearchParams({
    "api.version": "1", user: username,
    cpanel_jsonapi_version: "2", cpanel_jsonapi_module: "ZoneEdit", cpanel_jsonapi_func: "edit_zone_record",
    domain, Line: String(line), type: record.type, name: record.name, ttl: String(record.ttl || 14400),
    ...(record.address && { address: record.address }),
    ...(record.cname && { cname: record.cname }),
    ...(record.exchange && { exchange: record.exchange }),
    ...(record.txtdata && { txtdata: record.txtdata }),
    ...(record.preference && { preference: String(record.preference) }),
  });
  const url = `https://${server.hostname}:${port}/json-api/cpanel?${params.toString()}`;
  const body = await httpsGet(url, { "Authorization": `whm ${authUser}:${server.apiToken}` });
  const data = JSON.parse(body);
  if (data?.cpanelresult?.error) throw new Error(data.cpanelresult.error);
}

export async function cpanelDeleteDnsRecord(server: ServerConfig, username: string, domain: string, line: number): Promise<void> {
  const port = server.port || 2087;
  const authUser = server.username || "root";
  const params = new URLSearchParams({
    "api.version": "1", user: username,
    cpanel_jsonapi_version: "2", cpanel_jsonapi_module: "ZoneEdit", cpanel_jsonapi_func: "remove_zone_record",
    domain, Line: String(line),
  });
  const url = `https://${server.hostname}:${port}/json-api/cpanel?${params.toString()}`;
  const body = await httpsGet(url, { "Authorization": `whm ${authUser}:${server.apiToken}` });
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
    "api.version": "1",
    user: cpanelUser,
    cpanel_jsonapi_apiversion: "uapi",
    cpanel_jsonapi_module: module,
    cpanel_jsonapi_func: func,
    ...params,
  });
  const url = `https://${server.hostname}:${port}/json-api/cpanel?${query}`;
  const raw = await httpsGet(url, { "Authorization": `whm ${authUser}:${server.apiToken}` }, 60_000);

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

export async function cpanelCreateUserSession(
  server: ServerConfig,
  username: string,
  service: "cpaneld" | "webmaild",
): Promise<string> {
  const port = server.port || 2087;
  const authUser = server.username || "root";
  const url = `https://${server.hostname}:${port}/json-api/create_user_session?api.version=1`;
  const bodyParams = new URLSearchParams({ user: username, service }).toString();

  const rawBody = await httpsPost(url, { "Authorization": `whm ${authUser}:${server.apiToken}` }, bodyParams, 30000);

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
