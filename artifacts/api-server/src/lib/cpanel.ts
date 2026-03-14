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

/** Low-level HTTPS GET using node:https so we can bypass self-signed certs */
function httpsGet(url: string, headers: Record<string, string>, timeoutMs = 15000): Promise<string> {
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
    req.on("timeout", () => { req.destroy(); reject(new Error("WHM API timed out (15s)")); });
    req.on("error", (err) => reject(new Error(`WHM connection failed: ${err.message}`)));
  });
}

async function whmRequest(server: ServerConfig, func: string, params: Record<string, string> = {}): Promise<any> {
  const query = new URLSearchParams({ ...params, "api.version": "1" });
  const port = server.port || 2087;
  const url = `https://${server.hostname}:${port}/json-api/${func}?${query}`;
  // WHM API token auth header: "whm USERNAME:TOKEN" — username defaults to "root"
  const authUser = server.username || "root";
  const headers = {
    "Authorization": `whm ${authUser}:${server.apiToken}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  const body = await httpsGet(url, headers);
  let data: any;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(`WHM returned non-JSON response: ${body.substring(0, 200)}`);
  }

  // WHM error detection
  if (data.metadata?.result === 0) {
    throw new Error(data.metadata?.reason || "cPanel operation failed");
  }
  if (data.result?.[0]?.status === 0) {
    throw new Error(data.result[0]?.statusmsg || "cPanel operation failed");
  }

  return data;
}

export async function cpanelCreateAccount(server: ServerConfig, account: CpanelAccount) {
  return whmRequest(server, "createacct", {
    username: account.username,
    domain: account.domain,
    password: account.password,
    contactemail: account.contactemail || account.email || "",
    plan: account.plan || "default",
    featurelist: "default",
    quota: "unlimited",
    bwlimit: "unlimited",
    hasshell: "0",
    cgi: "1",
    cpmod: "jupiter",
    maxpop: "unlimited",
    maxsub: "unlimited",
    maxpark: "unlimited",
    maxaddon: "0",
  });
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
