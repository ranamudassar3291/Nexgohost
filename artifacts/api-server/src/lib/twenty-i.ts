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

// ─── StackUser (reseller sub-accounts) ───────────────────────────────────────

export interface TwentyIStackUser {
  id: string;
  email: string;
  name: string;
}

/** Create a new StackUser under the reseller account */
export async function twentyiCreateStackUser(
  apiKey: string,
  email: string,
  name: string,
): Promise<TwentyIStackUser> {
  const result = await twentyiRequest(apiKey, "POST", "/reseller/addUser", { email, name });
  const id = result?.id ?? result?.user_id ?? result?.userId;
  if (!id) throw new Error(`20i did not return a StackUser ID. Response: ${JSON.stringify(result).substring(0, 200)}`);
  return { id: String(id), email, name };
}

/** List StackUsers belonging to this reseller account */
export async function twentyiListStackUsers(apiKey: string): Promise<TwentyIStackUser[]> {
  const data = await twentyiRequest(apiKey, "GET", "/reseller/users");
  if (!Array.isArray(data)) return [];
  return data.map((u: any) => ({ id: String(u.id ?? u.user_id ?? ""), email: u.email ?? "", name: u.name ?? "" }));
}

/**
 * Find an existing StackUser by email or create a new one.
 * Tries to find first to avoid duplicates.
 */
export async function twentyiGetOrCreateStackUser(
  apiKey: string,
  email: string,
  name: string,
): Promise<TwentyIStackUser> {
  try {
    const users = await twentyiListStackUsers(apiKey);
    const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) return existing;
  } catch {
    // Ignore list errors — proceed to create
  }
  return twentyiCreateStackUser(apiKey, email, name);
}

/** Assign a hosting site to a StackUser so they can manage it via StackCP */
export async function twentyiAssignSiteToUser(
  apiKey: string,
  siteId: string,
  stackUserId: string,
): Promise<void> {
  await twentyiRequest(apiKey, "POST", `/userHosting/${siteId}/setUser`, { userId: stackUserId });
}

// ─── List all hosting sites ───────────────────────────────────────────────────

export interface TwentyISite {
  id: string;
  domain: string;
  status: string;
  package?: string;
  stackUserId?: string;
}

export async function twentyiListSites(apiKey: string): Promise<TwentyISite[]> {
  const data = await twentyiRequest(apiKey, "GET", "/reseller/web");
  if (!Array.isArray(data)) return [];
  return data.map((s: any) => ({
    id: String(s.id ?? s.web_name ?? ""),
    domain: String(s.domain_name ?? s.domain ?? ""),
    status: s.status ?? (s.suspended ? "suspended" : "active"),
    package: s.package_name ?? s.package ?? "",
    stackUserId: s.user_id ? String(s.user_id) : undefined,
  }));
}

// ─── Delete StackUser ─────────────────────────────────────────────────────────

export async function twentyiDeleteStackUser(apiKey: string, userId: string): Promise<void> {
  await twentyiRequest(apiKey, "DELETE", `/reseller/user/${userId}`);
}

// ─── Migrations ───────────────────────────────────────────────────────────────

export interface TwentyIMigration {
  id: string;
  domain: string;
  status: string;
  progress?: number;
  sourceType?: string;
  createdAt?: string;
}

export async function twentyiStartMigration(
  apiKey: string,
  domain: string,
  sourceType: "cpanel" | "plesk" | "directadmin" | "other",
  host: string,
  username: string,
  password: string,
  siteId?: string,
): Promise<{ id: string }> {
  const body: any = {
    domain,
    migration_type: sourceType,
    source_host: host,
    source_username: username,
    source_password: password,
  };
  if (siteId) body.web_id = siteId;
  const result = await twentyiRequest(apiKey, "POST", "/reseller/migration", body);
  const id = result?.id ?? result?.migration_id ?? String(Date.now());
  return { id: String(id) };
}

export async function twentyiListMigrations(apiKey: string): Promise<TwentyIMigration[]> {
  const data = await twentyiRequest(apiKey, "GET", "/reseller/migration");
  if (!Array.isArray(data)) return [];
  return data.map((m: any) => ({
    id: String(m.id ?? ""),
    domain: m.domain ?? m.domain_name ?? "",
    status: m.status ?? "unknown",
    progress: m.progress ?? m.percent ?? 0,
    sourceType: m.migration_type ?? m.type ?? "",
    createdAt: m.created_at ?? m.date ?? "",
  }));
}

export async function twentyiGetMigrationStatus(apiKey: string, migrationId: string): Promise<TwentyIMigration> {
  const result = await twentyiRequest(apiKey, "GET", `/reseller/migration/${migrationId}`);
  return {
    id: String(result.id ?? migrationId),
    domain: result.domain ?? result.domain_name ?? "",
    status: result.status ?? "unknown",
    progress: result.progress ?? result.percent ?? 0,
    sourceType: result.migration_type ?? result.type ?? "",
    createdAt: result.created_at ?? result.date ?? "",
  };
}

// ─── Support Tickets ──────────────────────────────────────────────────────────

export interface TwentyITicket {
  id: string;
  subject: string;
  status: string;
  priority?: string;
  createdAt?: string;
  updatedAt?: string;
  messages?: { from: string; body: string; createdAt: string }[];
}

export async function twentyiListTickets(apiKey: string): Promise<TwentyITicket[]> {
  const data = await twentyiRequest(apiKey, "GET", "/reseller/supportTicket");
  if (!Array.isArray(data)) {
    if (data && typeof data === "object") {
      const arr = Object.values(data);
      if (Array.isArray(arr)) return arr.map((t: any) => ({
        id: String(t.id ?? t.ticket_id ?? ""),
        subject: t.subject ?? "",
        status: t.status ?? "open",
        priority: t.priority,
        createdAt: t.created_at ?? t.date ?? "",
        updatedAt: t.updated_at ?? "",
      }));
    }
    return [];
  }
  return data.map((t: any) => ({
    id: String(t.id ?? t.ticket_id ?? ""),
    subject: t.subject ?? "",
    status: t.status ?? "open",
    priority: t.priority,
    createdAt: t.created_at ?? t.date ?? "",
    updatedAt: t.updated_at ?? "",
  }));
}

export async function twentyiGetTicket(apiKey: string, ticketId: string): Promise<TwentyITicket> {
  const data = await twentyiRequest(apiKey, "GET", `/reseller/supportTicket/${ticketId}`);
  return {
    id: String(data.id ?? ticketId),
    subject: data.subject ?? "",
    status: data.status ?? "open",
    priority: data.priority,
    createdAt: data.created_at ?? "",
    updatedAt: data.updated_at ?? "",
    messages: Array.isArray(data.messages) ? data.messages.map((m: any) => ({
      from: m.from ?? m.author ?? "Support",
      body: m.body ?? m.message ?? "",
      createdAt: m.created_at ?? m.date ?? "",
    })) : [],
  };
}

export async function twentyiCreateTicket(
  apiKey: string,
  subject: string,
  body: string,
  priority: "low" | "normal" | "high" = "normal",
): Promise<{ id: string }> {
  const result = await twentyiRequest(apiKey, "POST", "/reseller/supportTicket", { subject, body, priority });
  const id = result?.id ?? result?.ticket_id ?? String(Date.now());
  return { id: String(id) };
}

export async function twentyiReplyTicket(apiKey: string, ticketId: string, body: string): Promise<void> {
  await twentyiRequest(apiKey, "PUT", `/reseller/supportTicket/${ticketId}`, { body });
}

// ─── SSO / Temporary Login ────────────────────────────────────────────────────

/**
 * Generate a temporary one-click login URL for StackCP.
 * Tries multiple 20i endpoint patterns for compatibility across API versions.
 */
export async function twentyiGetSSOUrl(apiKey: string, siteId: string): Promise<string> {
  const endpoints = [
    `/userHosting/${siteId}/temporaryLoginLink`,
    `/userHosting/${siteId}/sso`,
    `/userHosting/${siteId}/getLoginLink`,
  ];

  for (const path of endpoints) {
    try {
      const result = await twentyiRequest(apiKey, "GET", path);
      const url = result?.url ?? result?.link ?? result?.loginUrl ?? result?.login_url;
      if (url && typeof url === "string" && url.startsWith("http")) return url;
      // Some endpoints return the URL directly as a string
      if (typeof result === "string" && result.startsWith("http")) return result;
    } catch (err: any) {
      if (err.message?.includes("404")) continue; // Try next endpoint
      throw err;
    }
  }

  // Final fallback — return the static StackCP URL (user must already be logged in)
  return twentyiStackCPUrl(siteId);
}
