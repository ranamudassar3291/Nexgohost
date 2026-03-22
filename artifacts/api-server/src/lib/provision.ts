import { db as _db } from "@workspace/db";
import { serversTable as _serversTable } from "@workspace/db/schema";
import { eq as _eq } from "drizzle-orm";
import { cpanelSuspend, cpanelUnsuspend } from "./cpanel.js";

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

export async function unsuspendHostingAccount(username: string, serverId: string | null): Promise<void> {
  if (!serverId) return;
  const [server] = await _db.select().from(_serversTable).where(_eq(_serversTable.id, serverId)).limit(1);
  if (!server || !server.apiUsername || !server.apiToken) return;
  await cpanelUnsuspend(
    { hostname: server.hostname, port: server.apiPort || 2087, username: server.apiUsername, apiToken: server.apiToken },
    username,
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
import type { TwentyICreateResult } from "./twenty-i.js";
import { emailHostingCreated, emailVerificationCode } from "./email.js";

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
  "daemon", "bin", "sys", "sync", "games", "man", "lp", "news",
  "uucp", "proxy", "www-data", "backup", "list", "irc", "gnats",
  "sshd", "postgres", "mysql", "puppet",
]);

/**
 * Validate a cPanel/WHM username:
 *  - Must start with a letter (a-z)
 *  - Only lowercase letters and digits (a-z, 0-9)
 *  - 1–8 characters
 *  - Not a reserved system username
 */
export function isValidWhmUsername(username: string): boolean {
  return (
    username.length >= 1 &&
    username.length <= 8 &&
    /^[a-z][a-z0-9]*$/.test(username) &&
    !RESERVED_USERNAMES.has(username)
  );
}

/**
 * Generate a WHM-compliant cPanel username from a domain name.
 *
 * Algorithm:
 *  1. Take the subdomain part before the first dot (strips TLD)
 *  2. Remove all non-alphanumeric characters → lowercase
 *  3. Strip leading digits so the first character is always a letter
 *  4. Truncate to 6 characters (leaves room for 2 suffix digits)
 *  5. Append 2 random digits (10–99) → final max 8 characters
 *  6. Retry with new digits if reserved or already taken
 *
 * Examples:
 *   93news.online → base "news"   → "news37"
 *   123abc.com    → base "abc"    → "abc51"
 *   example.com   → base "exampl" → "exampl82"
 */
export function generateUsername(domain: string, existingUsernames: string[] = []): string {
  // Step 1–3: extract a clean alphabetic base from the domain label
  const rawBase = domain.split(".")[0]!.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const alphaBase = rawBase.replace(/^[0-9]+/, ""); // strip leading digits
  const base = alphaBase.substring(0, 6) || "acct"; // max 6 chars; "acct" is safe fallback

  const makeCandidate = (): string => {
    const suffix = String(Math.floor(Math.random() * 90) + 10); // "10"–"99"
    return `${base}${suffix}`;
  };

  let candidate = makeCandidate();
  let attempts = 0;

  while (!isValidWhmUsername(candidate) || existingUsernames.includes(candidate)) {
    candidate = makeCandidate();
    if (++attempts >= 300) {
      // Absolute fallback: random 6-char alpha base + 2 digits
      const fb = `acct${String(Math.floor(Math.random() * 90) + 10)}`;
      return fb;
    }
  }

  return candidate;
}

/**
 * Sanitize an admin-supplied username to WHM requirements.
 *  - Strip non-alphanumeric characters → lowercase
 *  - Strip leading digits (WHM requires first char to be a letter)
 *  - Truncate to 8 characters
 *  - Returns empty string if result is invalid (caller falls back to auto-generate)
 */
function sanitizeUsername(raw: string): string {
  const stripped = raw.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const clean = stripped.replace(/^[0-9]+/, "").substring(0, 8);
  return isValidWhmUsername(clean) ? clean : "";
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
  // Fetch all existing usernames from DB so we can guarantee global uniqueness
  const takenUsernames = await db
    .select({ username: hostingServicesTable.username })
    .from(hostingServicesTable)
    .then(rows => rows.map(r => r.username).filter(Boolean) as string[]);

  const rawUsername = overrides?.username?.trim()
    ? sanitizeUsername(overrides.username.trim())
    : generateUsername(domain, takenUsernames);
  let username = (rawUsername && isValidWhmUsername(rawUsername) && !takenUsernames.includes(rawUsername))
    ? rawUsername
    : generateUsername(domain, takenUsernames);

  // Final validation guard — should never be false after the above, but be safe
  if (!isValidWhmUsername(username)) {
    username = generateUsername(domain, takenUsernames);
  }

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
  let cpanelUrl = `https://${cpanelHost}:2083`;
  let webmailUrl = `https://${cpanelHost}:2096`;

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
        // Retry with a new username if WHM rejects due to invalid/taken username
        const MAX_USERNAME_RETRIES = 5;
        let createAttempt = 0;
        let created = false;
        const usedDuringRetry: string[] = [...takenUsernames];

        while (!created && createAttempt < MAX_USERNAME_RETRIES) {
          // Validate username before each attempt
          if (!isValidWhmUsername(username)) {
            console.warn(`[PROVISION] Generated username "${username}" failed WHM validation — regenerating`);
            usedDuringRetry.push(username);
            username = generateUsername(domain, usedDuringRetry);
          }

          const requestParams = {
            username,
            domain,
            password: "***",
            plan: whmPlan || "(default)",
            contactemail: user.email,
          };

          console.log(`[PROVISION] WHM createacct (attempt ${createAttempt + 1}): domain=${domain} user=${username} plan=${whmPlan || "(default)"} server=${server.hostname}:${whmPort}`);

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
            created = true;
          } catch (err: any) {
            const errMsg: string = err.message || "";
            console.warn(`[PROVISION] WHM createacct attempt ${createAttempt + 1} failed: ${errMsg}`);

            // Detect username-related errors → regenerate and retry
            const isUsernameError =
              /invalid.?username|username.*invalid|username.*taken|username.*exists|username.*in use|account.*exists/i.test(errMsg);

            if (isUsernameError && createAttempt < MAX_USERNAME_RETRIES - 1) {
              console.log(`[PROVISION] Username error detected — regenerating username (was: ${username})`);
              usedDuringRetry.push(username);
              username = generateUsername(domain, usedDuringRetry);
              createAttempt++;
              continue;
            }

            // Non-username error or max retries reached — record and abort
            whmError = errMsg;
            await logServerAction({
              serviceId,
              serverId: server.id,
              action: "createacct",
              status: "failed",
              request: requestParams,
              errorMessage: errMsg,
            });
            break;
          }

          createAttempt++;
        }
      }
    } else if (module === "20i" && server.apiToken) {
      try {
        const twentyiResult: TwentyICreateResult = await twentyiCreateHosting(
          server.apiToken,
          domain,
          user.email,
          plan?.modulePlanId ?? undefined,
        );
        if (twentyiResult.siteId) {
          username = twentyiResult.siteId;
        }
        if (twentyiResult.cpanelUrl) cpanelUrl = twentyiResult.cpanelUrl;
        if (twentyiResult.webmailUrl) webmailUrl = twentyiResult.webmailUrl;
        console.log(`[PROVISION] 20i hosting created: siteId=${twentyiResult.siteId} domain=${domain}`);
        await logServerAction({
          serviceId,
          serverId: server.id,
          action: "create_hosting_20i",
          status: "success",
          response: JSON.stringify(twentyiResult),
        });
      } catch (err: any) {
        whmError = err.message;
        console.warn(`[PROVISION] 20i create hosting failed: ${err.message}`);
        await logServerAction({
          serviceId,
          serverId: server.id,
          action: "create_hosting_20i",
          status: "failed",
          errorMessage: err.message,
        });
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
    }, { clientId: user.id, referenceId: serviceId });
  } catch (emailErr: any) {
    console.warn("[PROVISION] Failed to send welcome email:", emailErr.message);
  }

  // ── Generate and send OTP / email verification code ───────────────────────
  // Only send if the account is not already verified (new clients need this)
  try {
    if (!user.emailVerified) {
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      await db.update(usersTable)
        .set({ verificationCode: otpCode, verificationExpiresAt: otpExpiry, updatedAt: new Date() })
        .where(eq(usersTable.id, user.id));
      await emailVerificationCode(
        user.email,
        user.firstName || user.email,
        otpCode,
        { clientId: user.id, referenceId: serviceId },
      );
      console.log(`[PROVISION] OTP sent to ${user.email} (expires 10 min)`);
    }
  } catch (otpErr: any) {
    console.warn("[PROVISION] Failed to send OTP:", otpErr.message);
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
