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

function generateUsername(domain: string, existingUsernames: string[] = []): string {
  const base = domain.replace(/[^a-z0-9]/g, "").substring(0, 8);
  let candidate = base;
  let i = 1;
  while (existingUsernames.includes(candidate)) {
    candidate = `${base}${i++}`;
  }
  return candidate;
}

export interface ProvisionResult {
  success: boolean;
  message: string;
  credentials?: {
    username: string;
    password: string;
    cpanelUrl: string;
    webmailUrl: string;
  };
}

export async function provisionHostingService(serviceId: string): Promise<ProvisionResult> {
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

  const module = (plan as any)?.module || "none";
  const domain = service.domain || `${user.firstName?.toLowerCase()}.${user.lastName?.toLowerCase()}.hosted.com`;

  // Find default active server of matching type
  const servers = await db.select().from(serversTable)
    .where(and(eq(serversTable.status, "active"), eq(serversTable.isDefault, true)));
  const server = servers.find(s => module === "none" || s.type === module) || servers[0];

  const password = generatePassword();
  const username = generateUsername(domain);

  let cpanelUrl = service.cpanelUrl || "";
  let webmailUrl = service.webmailUrl || "";
  let finalServerId = service.serverId;
  let finalServerIp = service.serverIp || "";

  if (server) {
    finalServerId = server.id;
    finalServerIp = server.ipAddress || server.hostname;
    cpanelUrl = `https://${server.hostname}:${server.apiPort || 2083}`;
    webmailUrl = `https://${server.hostname}/webmail`;

    // Attempt real provisioning if module is configured
    if (module === "cpanel" && server.apiUsername && server.apiToken) {
      try {
        await cpanelCreateAccount(
          { hostname: server.hostname, port: server.apiPort || 2087, username: server.apiUsername, apiToken: server.apiToken },
          { username, domain, password, email: user.email }
        );
      } catch (err: any) {
        console.warn(`[PROVISION] cPanel create account failed (proceeding with DB update): ${err.message}`);
      }
    } else if (module === "20i" && server.apiToken) {
      try {
        await twentyiCreateHosting({ apiKey: server.apiToken }, domain, user.email);
      } catch (err: any) {
        console.warn(`[PROVISION] 20i create hosting failed (proceeding with DB update): ${err.message}`);
      }
    }
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
    const s = server;
    await emailHostingCreated(user.email, {
      clientName: `${user.firstName} ${user.lastName}`,
      domain: service.domain || domain,
      username,
      password,
      cpanelUrl: cpanelUrl || `https://${finalServerIp}:2083`,
      ns1: s?.ns1 || "ns1.nexgohost.com",
      ns2: s?.ns2 || "ns2.nexgohost.com",
      webmailUrl: webmailUrl || `https://${finalServerIp}/webmail`,
    });
  } catch (emailErr: any) {
    console.warn("[PROVISION] Failed to send welcome email:", emailErr.message);
  }

  return {
    success: true,
    message: `Hosting provisioned for ${domain}`,
    credentials: { username, password, cpanelUrl: cpanelUrl || `https://${finalServerIp}:2083`, webmailUrl: webmailUrl || `https://${finalServerIp}/webmail` },
  };
}
