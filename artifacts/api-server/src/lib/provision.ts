import { db as _db } from "@workspace/db";
import { serversTable as _serversTable } from "@workspace/db/schema";
import { eq as _eq } from "drizzle-orm";
import { cpanelSuspend } from "./cpanel.js";

export async function suspendHostingAccount(username: string, serverId: string | null, reason = "Admin action"): Promise<void> {
  if (!serverId) return;
  const [server] = await _db.select().from(_serversTable).where(_eq(_serversTable.id, serverId)).limit(1);
  if (!server || !server.apiUsername || !server.apiToken) return;
  await cpanelSuspend(
    { hostname: server.hostname, port: server.apiPort || 2087, username: server.apiUsername, apiToken: server.apiToken },
    username,
    reason,
  );
}

/**
 * Hosting Provisioning Service
 * Called when invoice is paid or admin manually provisions.
 * Looks up the plan's module (cpanel/20i/none), finds the linked server,
 * creates the account, and returns credentials.
 */
import { db } from "@workspace/db";
import { hostingServicesTable, hostingPlansTable, serversTable, usersTable, serverLogsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { cpanelCreateAccount, cpanelCheckDomainExists } from "./cpanel.js";
import { twentyiCreateHosting } from "./twenty-i.js";
import { emailHostingCreated } from "./email.js";

function generatePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  return Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/**
 * WHM reserved usernames that must never be used for hosting accounts.
 * WHM will reject these with "invalid username" on createacct.
 */
const RESERVED_USERNAMES = new Set([
  "root", "admin", "administrator", "test", "user", "support",
  "webmaster", "hostmaster", "postmaster", "abuse", "info",
  "mail", "email", "ftp", "cpanel", "whm", "mysql", "nobody",
  "apache", "nginx", "www", "web", "host", "server", "service",
]);

/** Generate a WHM-valid username: max 8 chars, lowercase alphanumeric only.
 *  Skips reserved names and any already taken usernames. */
export function generateUsername(domain: string, existingUsernames: string[] = []): string {
  const base = domain.split(".")[0]!.replace(/[^a-z0-9]/gi, "").toLowerCase().substring(0, 8) || "host";
  // If base itself is reserved or too short, prefix with "h"
  const safeBase = (RESERVED_USERNAMES.has(base) || base.length < 2) ? `h${base}`.substring(0, 8) : base;
  let candidate = safeBase;
  let i = 1;
  while (existingUsernames.includes(candidate) || RESERVED_USERNAMES.has(candidate)) {
    candidate = `${safeBase.substring(0, 7)}${i++}`;
  }
  return candidate;
}

/** Sanitize an admin-supplied username to WHM requirements (max 8, alphanumeric).
 *  Rejects reserved names and returns empty string so the caller falls back to auto-generate. */
function sanitizeUsername(raw: string): string {
  const clean = raw.replace(/[^a-z0-9]/gi, "").toLowerCase().substring(0, 8);
  return RESERVED_USERNAMES.has(clean) ? "" : clean;
}

/** Log WHM API call to server_logs table (non-fatal) */
async function logServerAction(opts: {
  serviceId?: string;
  serverId?: string;
  action: string;
  status: "success" | "failed";
  request?: Record<string, string>;
  response?: string;
  errorMessage?: string;
}): Promise<void> {
  try {
    await db.insert(serverLogsTable).values({
      serviceId: opts.serviceId ?? null,
      serverId: opts.serverId ?? null,
      action: opts.action,
      status: opts.status,
      request: opts.request ? JSON.stringify(opts.request) : null,
      response: opts.response ?? null,
      errorMessage: opts.errorMessage ?? null,
    });
  } catch (e) {
    console.warn("[PROVISION] Failed to write server log:", e);
  }
}

export interface ProvisionOverrides {
  username?: string;
  password?: string;
  /** Admin-selected server ID — takes priority over plan server and default server */
  serverId?: string;
}

export interface ProvisionResult {
  success: boolean;
  message: string;
  whmError?: string;
  credentials?: {
    username: string;
    password: string;
    cpanelUrl: string;
    webmailUrl: string;
  };
}

export async function provisionHostingService(
  serviceId: string,
  overrides?: ProvisionOverrides,
): Promise<ProvisionResult> {
  // ── Load service + plan + user ─────────────────────────────────────────────
  const [service] = await db.select().from(hostingServicesTable)
    .where(eq(hostingServicesTable.id, serviceId)).limit(1);
  if (!service) return { success: false, message: "Service not found" };
  if (service.status === "active") return { success: false, message: "Service is already active" };

  const [plan] = await db.select().from(hostingPlansTable)
    .where(eq(hostingPlansTable.id, service.planId)).limit(1);
  const [user] = await db.select().from(usersTable)
    .where(eq(usersTable.id, service.clientId)).limit(1);
  if (!user) return { success: false, message: "Client not found" };

  const module = plan?.module || "none";
  const domain = service.domain || `${(user.firstName || "user").toLowerCase()}${(user.lastName || "host").toLowerCase()}.hosted.com`;

  // ── Username and password ──────────────────────────────────────────────────
  const rawUsername = overrides?.username?.trim()
    ? sanitizeUsername(overrides.username.trim())
    : generateUsername(domain);
  let username = rawUsername || generateUsername(domain);
  const password = overrides?.password?.trim() || generatePassword();

  // ── Required field validation for cPanel ──────────────────────────────────
  if (module === "cpanel") {
    if (!domain) return { success: false, message: "Missing required hosting parameters: domain" };
    if (!username) return { success: false, message: "Missing required hosting parameters: username" };
    if (!password) return { success: false, message: "Missing required hosting parameters: password" };
  }

  // ── Resolve server (priority: admin override → plan server → service server → default) ─
  let server: typeof serversTable.$inferSelect | null = null;

  // 1. Admin explicitly selected a server during activation
  if (overrides?.serverId) {
    const [overrideServer] = await db.select().from(serversTable)
      .where(eq(serversTable.id, overrides.serverId)).limit(1);
    if (overrideServer?.status === "active") server = overrideServer;
  }
  // 2. Plan has a linked server
  if (!server && plan?.moduleServerId) {
    const [linkedServer] = await db.select().from(serversTable)
      .where(eq(serversTable.id, plan.moduleServerId)).limit(1);
    if (linkedServer?.status === "active") server = linkedServer;
  }
  // 3. Plan specifies a server group — pick the first active server from that group
  if (!server && plan?.moduleServerGroupId) {
    const groupServers = await db.select().from(serversTable)
      .where(eq(serversTable.status, "active"));
    server = groupServers.find(s => s.groupId === plan.moduleServerGroupId && (module === "none" || s.type === module))
      || groupServers.find(s => s.groupId === plan.moduleServerGroupId)
      || null;
  }
  // 4. Service already has a server assigned
  if (!server && service.serverId) {
    const [svcServer] = await db.select().from(serversTable)
      .where(eq(serversTable.id, service.serverId)).limit(1);
    if (svcServer?.status === "active") server = svcServer;
  }
  // 5. Auto-select: match module type → default flag → first active
  if (!server) {
    const allServers = await db.select().from(serversTable)
      .where(eq(serversTable.status, "active"));
    server = allServers.find(s => module === "none" || s.type === module)
      || allServers.find(s => s.isDefault)
      || allServers[0]
      || null;
  }

  // ── Server configuration validation ───────────────────────────────────────
  if (module === "cpanel" && server) {
    if (!server.hostname) {
      return { success: false, message: "Server configuration incomplete: hostname is missing" };
    }
    if (!server.apiToken) {
      return { success: false, message: "Server configuration incomplete: API token is missing" };
    }
  }

  let finalServerId = service.serverId;
  let finalServerIp = service.serverIp || "";
  let whmError: string | undefined;

  // ── cPanel/Webmail URLs use SERVER HOSTNAME (not domain) ──────────────────
  // WHM/cPanel always uses the server hostname for access URLs because the
  // domain's DNS may not be pointing yet when the account is first created.
  // cPanel client port: 2083 | WHM admin port: 2087 | Webmail port: 2096
  const cpanelHost = server?.hostname || domain;
  const cpanelUrl = `https://${cpanelHost}:2083`;
  const webmailUrl = `https://${cpanelHost}:2096`;

  // ── Provision on the actual panel ─────────────────────────────────────────
  if (server) {
    finalServerId = server.id;
    finalServerIp = server.ipAddress || server.hostname;

    if (module === "cpanel" && server.apiUsername && server.apiToken) {
      const whmPlan = plan?.modulePlanName || plan?.modulePlanId || "";
      const whmPort = server.apiPort || 2087;
      const serverCfg = { hostname: server.hostname, port: whmPort, username: server.apiUsername, apiToken: server.apiToken };

      // ── Step 1: check if domain already exists to avoid "domain already in userdata" error
      const { exists: domainExists, username: existingUsername } = await cpanelCheckDomainExists(serverCfg, domain);

      if (domainExists && existingUsername) {
        // Domain already on this server — attach service to existing account instead of creating a new one
        console.log(`[PROVISION] Domain "${domain}" already exists on WHM with username "${existingUsername}" — attaching service`);
        // Use the existing WHM username; keep the newly generated password in DB
        // (admin can reset the password in cPanel if needed)
        username = existingUsername;
        await logServerAction({
          serviceId,
          serverId: server.id,
          action: "attach_existing",
          status: "success",
          request: { domain, existingUsername },
          response: "Domain already existed; service attached to existing WHM account",
        });
      } else {
        // Domain does not exist — proceed with account creation
        const requestParams = {
          username,
          domain,
          password: "***",
          plan: whmPlan || "(default)",
          contactemail: user.email,
        };

        console.log(`[PROVISION] WHM createacct: domain=${domain} user=${username} plan=${whmPlan || "(default)"} server=${server.hostname}:${whmPort}`);

        try {
          const result = await cpanelCreateAccount(serverCfg, { username, domain, password, email: user.email, plan: whmPlan, contactemail: user.email });
          console.log(`[PROVISION] WHM account created successfully: ${username}@${domain}`);
          await logServerAction({
            serviceId,
            serverId: server.id,
            action: "createacct",
            status: "success",
            request: requestParams,
            response: JSON.stringify(result),
          });
        } catch (err: any) {
          whmError = err.message;
          console.warn(`[PROVISION] WHM createacct failed: ${err.message}`);
          await logServerAction({
            serviceId,
            serverId: server.id,
            action: "createacct",
            status: "failed",
            request: requestParams,
            errorMessage: err.message,
          });
        }
      }
    } else if (module === "20i" && server.apiToken) {
      try {
        await twentyiCreateHosting({ apiKey: server.apiToken }, domain, user.email);
        await logServerAction({ serviceId, serverId: server.id, action: "create_hosting_20i", status: "success" });
      } catch (err: any) {
        whmError = err.message;
        console.warn(`[PROVISION] 20i create hosting failed: ${err.message}`);
        await logServerAction({ serviceId, serverId: server.id, action: "create_hosting_20i", status: "failed", errorMessage: err.message });
      }
    }
  }

  // ── Compute next due date from billing cycle ───────────────────────────────
  const nextDueDate = new Date();
  const cycle = (service.billingCycle || plan?.billingCycle || "monthly").toLowerCase();
  if (cycle === "yearly" || cycle === "annual") {
    nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
  } else if (cycle === "quarterly") {
    nextDueDate.setMonth(nextDueDate.getMonth() + 3);
  } else if (cycle === "semi_annual" || cycle === "biannual") {
    nextDueDate.setMonth(nextDueDate.getMonth() + 6);
  } else {
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);
  }

  // ── Persist service state ──────────────────────────────────────────────────
  await db.update(hostingServicesTable).set({
    status: "active",
    username,
    password,
    domain: service.domain || domain,
    serverId: finalServerId,
    serverIp: finalServerIp,
    cpanelUrl,
    webmailUrl,
    nextDueDate,
    updatedAt: new Date(),
  }).where(eq(hostingServicesTable.id, serviceId));

  // ── Send welcome email ─────────────────────────────────────────────────────
  try {
    await emailHostingCreated(user.email, {
      clientName: `${user.firstName} ${user.lastName}`,
      domain: service.domain || domain,
      username,
      password,
      cpanelUrl,
      ns1: server?.ns1 || "ns1.nexgohost.com",
      ns2: server?.ns2 || "ns2.nexgohost.com",
      webmailUrl,
    });
  } catch (emailErr: any) {
    console.warn("[PROVISION] Failed to send welcome email:", emailErr.message);
  }

  return {
    success: true,
    message: whmError
      ? `Service provisioned (WHM warning: ${whmError})`
      : `Hosting activated for ${domain}`,
    whmError,
    credentials: { username, password, cpanelUrl, webmailUrl },
  };
}
