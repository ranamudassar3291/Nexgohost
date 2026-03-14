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
