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
import { cpanelCreateAccount } from "./cpanel.js";
import { twentyiCreateHosting } from "./twenty-i.js";
import { emailHostingCreated } from "./email.js";

function generatePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  return Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/** Generate a WHM-valid username: max 8 chars, lowercase alphanumeric only */
export function generateUsername(domain: string, existingUsernames: string[] = []): string {
  const base = domain.split(".")[0]!.replace(/[^a-z0-9]/gi, "").toLowerCase().substring(0, 8) || "user";
  let candidate = base;
  let i = 1;
  while (existingUsernames.includes(candidate)) {
    candidate = `${base.substring(0, 7)}${i++}`;
  }
  return candidate;
}

/** Sanitize an admin-supplied username to WHM requirements (max 8, alphanumeric) */
function sanitizeUsername(raw: string): string {
  return raw.replace(/[^a-z0-9]/gi, "").toLowerCase().substring(0, 8);
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
  const username = rawUsername || generateUsername(domain);
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
  // 3. Service already has a server assigned
  if (!server && service.serverId) {
    const [svcServer] = await db.select().from(serversTable)
      .where(eq(serversTable.id, service.serverId)).limit(1);
    if (svcServer?.status === "active") server = svcServer;
  }
  // 4. Auto-select: match module type → default flag → first active
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

  // ── cPanel/Webmail URLs use DOMAIN (not server hostname) ──────────────────
  // Client cPanel always uses port 2083; WHM admin uses 2087 (server.apiPort)
  const cpanelUrl = `https://${domain}:2083`;
  const webmailUrl = `https://${domain}/webmail`;
  const webmailAlt = `https://${domain}:2096`;

  // ── Provision on the actual panel ─────────────────────────────────────────
  if (server) {
    finalServerId = server.id;
    finalServerIp = server.ipAddress || server.hostname;

    if (module === "cpanel" && server.apiUsername && server.apiToken) {
      const whmPlan = plan?.modulePlanName || plan?.modulePlanId || "default";
      const whmPort = server.apiPort || 2087;

      const requestParams = {
        username,
        domain,
        password: "***",
        plan: whmPlan,
        contactemail: user.email,
      };

      console.log(`[PROVISION] WHM createacct: domain=${domain} user=${username} plan=${whmPlan} server=${server.hostname}:${whmPort}`);

      try {
        const result = await cpanelCreateAccount(
          { hostname: server.hostname, port: whmPort, username: server.apiUsername, apiToken: server.apiToken },
          { username, domain, password, email: user.email, plan: whmPlan, contactemail: user.email },
        );
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
