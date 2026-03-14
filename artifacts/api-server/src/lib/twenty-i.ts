/**
 * 20i Hosting API Module
 * https://my.20i.com/reseller/apidoc
 */

async function twentyiRequestRaw(apiKey: string, method: string, path: string, body?: unknown): Promise<any> {
  const url = `https://api.20i.com${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 401) throw new Error("Unauthorized — check your 20i API Key (401)");
    if (res.status === 403) throw new Error("Forbidden — your API key lacks permission for this action (403)");
    if (res.status === 404) throw new Error(`Endpoint not found — check API Key / path: ${path} (404)`);
    if (res.status === 429) throw new Error("Rate limited — too many requests to 20i API (429)");
    throw new Error(`20i API error ${res.status}: ${text.substring(0, 300)}`);
  }
  return res.json();
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

// ─── Connection test ─────────────────────────────────────────────────────────

export async function twentyiTestConnection(apiKey: string): Promise<{ success: boolean; message: string; packageCount?: number }> {
  try {
    const data = await twentyiRequest(apiKey, "GET", "/reseller/packages");
    const count = Array.isArray(data) ? data.length : 0;
    return { success: true, message: `Connected to 20i API successfully. ${count} package(s) available.`, packageCount: count };
  } catch (err: any) {
    return { success: false, message: err.message || "20i connection failed" };
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

export async function twentyiGetPackages(apiKey: string): Promise<TwentyIPackage[]> {
  const data = await twentyiRequest(apiKey, "GET", "/reseller/packages");
  if (!Array.isArray(data)) return [];
  return data.map((pkg: any) => ({
    id: String(pkg.id ?? pkg.name ?? ""),
    name: String(pkg.label ?? pkg.name ?? pkg.id ?? "Unknown Package"),
    diskSpaceMb: pkg.diskSpaceMb ?? pkg.diskSpace,
    bandwidthGb: pkg.monthlyBandwidthGb ?? pkg.bandwidth,
    emailBoxes: pkg.emailBoxes,
    databases: pkg.mySQLDatabases ?? pkg.databases,
    subdomains: pkg.subDomains ?? pkg.subdomains,
  }));
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
