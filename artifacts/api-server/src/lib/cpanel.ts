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

/** Check if a file exists via Fileman::list_files */
export async function cpanelFileExists(
  server: ServerConfig,
  cpanelUser: string,
  dirPath: string,
  fileName: string,
): Promise<boolean> {
  try {
    const data = await cpanelUapi(server, cpanelUser, "Fileman", "list_files", {
      dir: dirPath,
      include_mime: "0",
    });
    const files: any[] = Array.isArray(data) ? data : (data?.files ?? []);
    return files.some((f: any) => f.file === fileName || f.name === fileName || f.path === fileName);
  } catch {
    return false;
  }
}

// ─── Softaculous installer ────────────────────────────────────────────────────
// Uses the proper cPanel session-based Softaculous API endpoint:
//   https://SERVER:2083/cpsessXXXXXXXXXX/softaculous/index.live.php
//
// Flow:
//   1. Create a cPanel user session via WHM's create_user_session API.
//   2. Extract the cpsessXXXXXX token from the returned URL.
//   3. POST to Softaculous with all install parameters.
//   4. Parse JSON response:  done=1 → success,  otherwise extract exact error.
//
// soft=26 is WordPress.  autoinstall=1 tells Softaculous to handle DB + files.
// The admin_pass is never logged — only masked confirmation is emitted.

export interface SoftaculousInstallOpts {
  /** Full domain for the site, e.g. "example.com" */
  softdomain: string;
  /** Sub-directory within public_html (empty string = root, "wp" = /wp) */
  softdirectory: string;
  /** Site title */
  site_name: string;
  /** WordPress admin username chosen by the client */
  admin_username: string;
  /** WordPress admin password chosen by the client (never logged) */
  admin_pass: string;
  /** WordPress admin email */
  admin_email: string;
  /** Pre-created DB name (full cPanel-prefixed, e.g. johndoe_wp123) */
  softdb?: string;
  /** Pre-created DB user (full cPanel-prefixed) */
  dbusername?: string;
  /** Pre-created DB password */
  dbuserpasswd?: string;
}

export async function cpanelSoftaculousInstallWordPress(
  server: ServerConfig,
  cpanelUser: string,
  opts: SoftaculousInstallOpts,
): Promise<{ success: boolean; adminUrl?: string; insid?: string; error?: string }> {
  // ── Step 1: Create a cPanel user session via WHM ──────────────────────────
  let cpsessToken: string;
  try {
    const sessionUrl = await cpanelCreateUserSession(server, cpanelUser, "cpaneld");
    // sessionUrl looks like: https://hostname:2083/cpsessXXXXXXXXXX/login/?session=...
    const match = sessionUrl.match(/\/cpsess([A-Za-z0-9]+)\//);
    if (!match) throw new Error(`Could not extract cpsess token from session URL: ${sessionUrl}`);
    cpsessToken = `cpsess${match[1]}`;
    console.log(`[Softaculous] cPanel session created for ${cpanelUser} — token: ${cpsessToken.substring(0, 14)}…`);
  } catch (e: any) {
    return { success: false, error: `Session creation failed: ${e.message}` };
  }

  // ── Step 2: Build the Softaculous POST request ────────────────────────────
  // Endpoint: https://SERVER:2083/cpsessXXX/softaculous/index.live.php
  const softHost = server.hostname;
  const softPort = 2083;  // cPanel user port, not WHM port (2087)
  const softUrl  = `https://${softHost}:${softPort}/${cpsessToken}/softaculous/index.live.php`;

  const body = new URLSearchParams({
    act:            "install",
    soft:           "26",          // Softaculous soft ID for WordPress
    autoinstall:    "1",           // Softaculous handles DB + file deployment
    softdomain:     opts.softdomain,
    softdirectory:  opts.softdirectory ?? "",
    site_name:      opts.site_name,
    admin_username: opts.admin_username,
    admin_pass:     opts.admin_pass,    // posted securely over HTTPS, never logged
    admin_email:    opts.admin_email,
    // Pre-created DB creds (optional when autoinstall=1 but avoids naming conflicts)
    ...(opts.softdb       && { softdb:       opts.softdb }),
    ...(opts.dbusername   && { dbusername:   opts.dbusername }),
    ...(opts.dbuserpasswd && { dbuserpasswd: opts.dbuserpasswd }),
    // Ask for JSON response
    return_json: "1",
  });

  console.log(`[Softaculous] POST ${softUrl} | domain=${opts.softdomain} dir="${opts.softdirectory}" user=${opts.admin_username} pass=****`);

  // ── Step 3: Send the POST and parse the response ──────────────────────────
  try {
    const rawBody = await httpsPost(softUrl, {}, body.toString(), 240_000);

    // Softaculous returns JSON or a PHP-rendered HTML page depending on version.
    // Strip any leading/trailing whitespace and attempt JSON parse.
    const trimmed = rawBody.trim();
    let data: any = null;
    try {
      data = JSON.parse(trimmed);
    } catch {
      // Not JSON — check for common success/error strings in the rendered output
      if (/done.*1|installation.*complete|success/i.test(trimmed)) {
        const adminPath = opts.softdirectory ? `/${opts.softdirectory}/wp-admin` : "/wp-admin";
        return { success: true, adminUrl: `https://${opts.softdomain}${adminPath}` };
      }
      // Extract the first <error> or visible message from HTML
      const htmlErr = trimmed.match(/<div[^>]*error[^>]*>([^<]+)</i)?.[1]
                   || trimmed.match(/error.*?:\s*(.+)/i)?.[1]
                   || trimmed.substring(0, 300);
      return { success: false, error: `Softaculous returned non-JSON response: ${htmlErr}` };
    }

    // ── Parse JSON response ────────────────────────────────────────────────
    // Success indicators: done=1, insid present, or success=1
    if (data?.done == 1 || data?.insid || data?.success == 1) {
      const adminPath = opts.softdirectory
        ? `/${opts.softdirectory}/wp-admin`
        : "/wp-admin";
      const adminUrl = data?.admin_url
        ?? data?.insurl
        ?? `https://${opts.softdomain}${adminPath}`;
      console.log(`[Softaculous] Installation succeeded — insid=${data?.insid ?? "n/a"} admin=${adminUrl}`);
      return { success: true, adminUrl, insid: String(data?.insid ?? "") };
    }

    // Failure — extract the exact error message(s)
    const errMessages: string[] = [];
    if (data?.error)  errMessages.push(String(data.error));
    if (data?.errors) {
      const errs = Array.isArray(data.errors) ? data.errors : Object.values(data.errors);
      errs.forEach((e: any) => errMessages.push(String(e)));
    }
    if (data?.message) errMessages.push(String(data.message));
    // Fallback: dump the first 300 chars of the raw response
    if (errMessages.length === 0) errMessages.push(trimmed.substring(0, 300));

    const combinedError = errMessages.join("; ");
    console.warn(`[Softaculous] Installation failed: ${combinedError}`);
    return { success: false, error: combinedError };

  } catch (e: any) {
    return { success: false, error: `Softaculous request failed: ${e.message}` };
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
