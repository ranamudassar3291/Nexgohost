/**
 * cPanel WHM API v1 Module
 * Real API calls to cPanel/WHM server
 */

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

async function whmRequest(server: ServerConfig, func: string, params: Record<string, string> = {}): Promise<any> {
  const query = new URLSearchParams({ ...params, "api.version": "1" });
  const url = `https://${server.hostname}:${server.port || 2087}/json-api/${func}?${query}`;
  // WHM API token auth: "whm USERNAME:TOKEN" — username defaults to root for API token auth
  const authUser = server.username || "root";

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `whm ${authUser}:${server.apiToken}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) throw new Error(`WHM API error: ${response.status}`);
  const data: any = await response.json();
  if (data.metadata?.result === 0 || data.result?.[0]?.status === 0) {
    throw new Error(data.metadata?.reason || data.result?.[0]?.statusmsg || "cPanel operation failed");
  }
  return data;
}

export async function cpanelCreateAccount(server: ServerConfig, account: CpanelAccount) {
  return whmRequest(server, "createacct", {
    username: account.username,
    domain: account.domain,
    password: account.password,
    contactemail: account.email || "",
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

export async function cpanelTestConnection(server: ServerConfig): Promise<{ success: boolean; version?: string; message: string }> {
  try {
    const data = await whmRequest(server, "version");
    return { success: true, version: data.version, message: `Connected to cPanel/WHM ${data.version}` };
  } catch (err: any) {
    return { success: false, message: err.message || "Connection failed" };
  }
}

export async function cpanelGetAccountInfo(server: ServerConfig, username: string) {
  return whmRequest(server, "accountsummary", { user: username });
}

export async function cpanelListPackages(server: ServerConfig): Promise<{ name: string }[]> {
  const data = await whmRequest(server, "listpkgs");
  const pkgs = data?.data?.pkg || data?.pkg || [];
  return pkgs.map((p: any) => ({ name: p.name || p }));
}

export async function cpanelInstallSSL(server: ServerConfig, domain: string): Promise<any> {
  return whmRequest(server, "installssl", { domain });
}
