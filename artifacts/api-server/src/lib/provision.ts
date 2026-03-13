/**
 * Hosting Provisioning Service
 * Called when invoice is paid or admin manually provisions.
 * Looks up the plan's module (cpanel/20i/none), finds the linked server,
 * creates the account, and returns credentials.
 */
import { db } from "@workspace/db";
import { hostingServicesTable, hostingPlansTable, serversTable, usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { cpanelCreateAccount } from "./cpanel.js";
import { twentyiCreateHosting } from "./twenty-i.js";
import { emailHostingCreated } from "./email.js";

function generatePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  return Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function generateUsername(domain: string, existingUsernames: string[] = []): string {
  const base = domain.split(".")[0]!.replace(/[^a-z0-9]/gi, "").toLowerCase().substring(0, 8) || "user";
  let candidate = base;
  let i = 1;
  while (existingUsernames.includes(candidate)) {
    candidate = `${base}${i++}`;
  }
  return candidate;
}

export interface ProvisionOverrides {
  username?: string;
  password?: string;
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
  // Load service + plan + server + user
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
  const domain = service.domain || `${user.firstName?.toLowerCase()}${user.lastName?.toLowerCase()}.hosted.com`;

  // Determine username and password — admin can override, otherwise auto-generate
  const username = (overrides?.username?.trim()) || generateUsername(domain);
  const password = (overrides?.password?.trim()) || generatePassword();

  // Find server: prefer plan's linked server, then any default active server of matching type
  let server: typeof serversTable.$inferSelect | null = null;

  // Try plan's linked server first
  if (plan?.moduleServerId) {
    const [linkedServer] = await db.select().from(serversTable)
      .where(eq(serversTable.id, plan.moduleServerId)).limit(1);
    if (linkedServer?.status === "active") server = linkedServer;
  }

  // Also try service's serverId
  if (!server && service.serverId) {
    const [svcServer] = await db.select().from(serversTable)
      .where(eq(serversTable.id, service.serverId)).limit(1);
    if (svcServer?.status === "active") server = svcServer;
  }

  // Fall back to any active default server of the right type
  if (!server) {
    const allServers = await db.select().from(serversTable)
      .where(eq(serversTable.status, "active"));
    server = allServers.find(s => module === "none" || s.type === module)
      || allServers.find(s => s.isDefault)
      || allServers[0]
      || null;
  }

  let cpanelUrl = "";
  let webmailUrl = "";
  let finalServerId = service.serverId;
  let finalServerIp = service.serverIp || "";
  let whmError: string | undefined;

  if (server) {
    finalServerId = server.id;
    finalServerIp = server.ipAddress || server.hostname;
    cpanelUrl = `https://${server.hostname}:${server.apiPort || 2083}`;
    webmailUrl = `https://${server.hostname}/webmail`;

    // Attempt real provisioning
    if (module === "cpanel" && server.apiUsername && server.apiToken) {
      try {
        const whmPlan = plan?.modulePlanName || plan?.modulePlanId || "default";
        console.log(`[PROVISION] WHM createacct: domain=${domain} user=${username} plan=${whmPlan} server=${server.hostname}`);
        await cpanelCreateAccount(
          {
            hostname: server.hostname,
            port: server.apiPort || 2087,
            username: server.apiUsername,
            apiToken: server.apiToken,
          },
          {
            username,
            domain,
            password,
            email: user.email,
            plan: whmPlan,
            contactemail: user.email,
          }
        );
        console.log(`[PROVISION] WHM account created successfully: ${username}@${domain}`);
      } catch (err: any) {
        whmError = err.message;
        console.warn(`[PROVISION] WHM createacct failed: ${err.message}`);
      }
    } else if (module === "20i" && server.apiToken) {
      try {
        await twentyiCreateHosting({ apiKey: server.apiToken }, domain, user.email);
      } catch (err: any) {
        whmError = err.message;
        console.warn(`[PROVISION] 20i create hosting failed: ${err.message}`);
      }
    }
  } else {
    // No server found — still provision in DB but note it
    finalServerIp = "127.0.0.1";
    cpanelUrl = `https://${domain}:2083`;
    webmailUrl = `https://${domain}/webmail`;
  }

  // Update the hosting service in DB
  const nextDueDate = new Date();
  nextDueDate.setMonth(nextDueDate.getMonth() + 1);

  await db.update(hostingServicesTable).set({
    status: "active",
    username,
    password,
    domain: service.domain || domain,
    serverId: finalServerId,
    serverIp: finalServerIp,
    cpanelUrl: cpanelUrl || `https://${finalServerIp}:2083`,
    webmailUrl: webmailUrl || `https://${finalServerIp}/webmail`,
    nextDueDate,
    updatedAt: new Date(),
  }).where(eq(hostingServicesTable.id, serviceId));

  // Send welcome email
  try {
    await emailHostingCreated(user.email, {
      clientName: `${user.firstName} ${user.lastName}`,
      domain: service.domain || domain,
      username,
      password,
      cpanelUrl: cpanelUrl || `https://${finalServerIp}:2083`,
      ns1: server?.ns1 || "ns1.nexgohost.com",
      ns2: server?.ns2 || "ns2.nexgohost.com",
      webmailUrl: webmailUrl || `https://${finalServerIp}/webmail`,
    });
  } catch (emailErr: any) {
    console.warn("[PROVISION] Failed to send welcome email:", emailErr.message);
  }

  return {
    success: true,
    message: whmError
      ? `Provisioned in DB (WHM error: ${whmError})`
      : `Hosting provisioned for ${domain}`,
    whmError,
    credentials: {
      username,
      password,
      cpanelUrl: cpanelUrl || `https://${finalServerIp}:2083`,
      webmailUrl: webmailUrl || `https://${finalServerIp}/webmail`,
    },
  };
}
