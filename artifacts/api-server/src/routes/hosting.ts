import { Router } from "express";
import { db } from "@workspace/db";
import { hostingPlansTable, hostingServicesTable, usersTable, domainsTable, invoicesTable, ticketsTable, serversTable, serverLogsTable } from "@workspace/db/schema";
import { eq, sql, and, isNull, isNotNull } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { provisionHostingService } from "../lib/provision.js";
import { emailServiceSuspended, emailHostingCreated } from "../lib/email.js";
import { cpanelCreateUserSession, cpanelSuspend, cpanelUnsuspend, cpanelTerminate, cpanelInstallSSL } from "../lib/cpanel.js";

const router = Router();

/** Log a WHM action to server_logs (never throws) */
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
    console.warn("[HOSTING] Failed to write server log:", e);
  }
}

function formatPlan(p: typeof hostingPlansTable.$inferSelect) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: Number(p.price),
    billingCycle: p.billingCycle,
    diskSpace: p.diskSpace,
    bandwidth: p.bandwidth,
    emailAccounts: p.emailAccounts,
    databases: p.databases,
    subdomains: p.subdomains,
    ftpAccounts: p.ftpAccounts,
    isActive: p.isActive,
    features: p.features || [],
  };
}

function formatService(s: typeof hostingServicesTable.$inferSelect, clientName?: string) {
  return {
    id: s.id,
    clientId: s.clientId,
    clientName: clientName || "",
    planId: s.planId,
    planName: s.planName,
    domain: s.domain,
    username: s.username,
    serverId: s.serverId,
    serverIp: s.serverIp,
    status: s.status,
    billingCycle: s.billingCycle,
    nextDueDate: s.nextDueDate?.toISOString(),
    sslStatus: s.sslStatus || "not_installed",
    startDate: s.startDate?.toISOString(),
    expiryDate: s.expiryDate?.toISOString(),
    diskUsed: s.diskUsed,
    bandwidthUsed: s.bandwidthUsed,
    cpanelUrl: s.cpanelUrl,
    webmailUrl: s.webmailUrl,
    cancelRequested: s.cancelRequested,
    cancelReason: s.cancelReason,
    cancelRequestedAt: s.cancelRequestedAt?.toISOString(),
    createdAt: s.createdAt.toISOString(),
  };
}

// Public: list all hosting plans
router.get("/hosting/plans", async (_req, res) => {
  try {
    const plans = await db.select().from(hostingPlansTable).where(eq(hostingPlansTable.isActive, true));
    res.json(plans.map(formatPlan));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: create plan
router.post("/hosting/plans", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, description, price, billingCycle, diskSpace, bandwidth, emailAccounts, databases, subdomains, ftpAccounts, features } = req.body;
    const [plan] = await db.insert(hostingPlansTable).values({
      name, description, price: String(price), billingCycle, diskSpace, bandwidth,
      emailAccounts, databases, subdomains, ftpAccounts, features: features || [], isActive: true,
    }).returning();
    res.status(201).json(formatPlan(plan));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: update plan
router.put("/hosting/plans/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, description, price, billingCycle, diskSpace, bandwidth, emailAccounts, databases, subdomains, ftpAccounts, features } = req.body;
    const [plan] = await db.update(hostingPlansTable).set({
      name, description, price: String(price), billingCycle, diskSpace, bandwidth,
      emailAccounts, databases, subdomains, ftpAccounts, features: features || [],
    }).where(eq(hostingPlansTable.id, req.params.id)).returning();
    if (!plan) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatPlan(plan));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: delete plan
router.delete("/hosting/plans/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    await db.update(hostingPlansTable).set({ isActive: false }).where(eq(hostingPlansTable.id, req.params.id));
    res.json({ success: true, message: "Plan deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: get all hosting services
router.get("/admin/hosting", authenticate, requireAdmin, async (_req, res) => {
  try {
    const services = await db.select().from(hostingServicesTable);
    const result = await Promise.all(services.map(async (s) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, s.clientId)).limit(1);
      return formatService(s, user ? `${user.firstName} ${user.lastName}` : "");
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Shared helper: build server config from a resolved server row ─────────────
function toServerCfg(s: typeof serversTable.$inferSelect) {
  return {
    hostname: s.hostname,
    port: s.apiPort || 2087,
    username: s.apiUsername || "root",
    apiToken: s.apiToken!,
  };
}

// Admin: suspend hosting (DB + WHM)
router.post("/admin/hosting/:id/suspend", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [service] = await db.select().from(hostingServicesTable)
      .where(eq(hostingServicesTable.id, req.params.id)).limit(1);
    if (!service) { res.status(404).json({ error: "Service not found" }); return; }

    let whmNote = "";
    const server = service.username ? await resolveServerForService(service) : null;

    if (server && service.username) {
      try {
        const reason = (req.body?.reason as string) || "Suspended by admin";
        await cpanelSuspend(toServerCfg(server), service.username, reason);
        await logServerAction({
          serviceId: service.id, serverId: server.id,
          action: "suspendacct",
          status: "success",
          request: { user: service.username, reason },
        });
      } catch (whmErr: any) {
        whmNote = ` (WHM warning: ${whmErr.message})`;
        await logServerAction({
          serviceId: service.id, serverId: server?.id,
          action: "suspendacct", status: "failed",
          request: { user: service.username },
          errorMessage: whmErr.message,
        });
        console.warn(`[WHM] suspend failed for ${service.username}: ${whmErr.message}`);
        // Still update DB — admin intent overrides WHM failure
      }
    } else {
      whmNote = " (no WHM server resolved — DB only)";
    }

    const [updated] = await db.update(hostingServicesTable)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(eq(hostingServicesTable.id, service.id))
      .returning();

    // Email suspended client with proper variables
    db.select().from(usersTable).where(eq(usersTable.id, service.clientId)).limit(1)
      .then(([user]) => {
        if (user) {
          const reason = (req.body?.reason as string) || "Suspended by admin";
          emailServiceSuspended(user.email, {
            clientName: `${user.firstName} ${user.lastName}`.trim() || user.email,
            domain: service.domain || service.planName || "your hosting account",
            reason,
          }).catch(() => {});
        }
      }).catch(() => {});

    res.json({ ...formatService(updated!), whmNote });
  } catch (err: any) {
    console.error("[ADMIN] suspend error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Admin: unsuspend hosting (WHM + DB)
router.post("/admin/hosting/:id/unsuspend", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [service] = await db.select().from(hostingServicesTable)
      .where(eq(hostingServicesTable.id, req.params.id)).limit(1);
    if (!service) { res.status(404).json({ error: "Service not found" }); return; }

    let whmNote = "";
    const server = service.username ? await resolveServerForService(service) : null;

    if (server && service.username) {
      try {
        await cpanelUnsuspend(toServerCfg(server), service.username);
        await logServerAction({
          serviceId: service.id, serverId: server.id,
          action: "unsuspendacct", status: "success",
          request: { user: service.username },
        });
      } catch (whmErr: any) {
        whmNote = ` (WHM warning: ${whmErr.message})`;
        await logServerAction({
          serviceId: service.id, serverId: server?.id,
          action: "unsuspendacct", status: "failed",
          request: { user: service.username },
          errorMessage: whmErr.message,
        });
        console.warn(`[WHM] unsuspend failed for ${service.username}: ${whmErr.message}`);
      }
    } else {
      whmNote = " (no WHM server resolved — DB only)";
    }

    const [updated] = await db.update(hostingServicesTable)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(hostingServicesTable.id, service.id))
      .returning();

    res.json({ ...formatService(updated!), whmNote });
  } catch (err: any) {
    console.error("[ADMIN] unsuspend error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Admin: terminate hosting (WHM removeacct + DB)
router.post("/admin/hosting/:id/terminate", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [service] = await db.select().from(hostingServicesTable)
      .where(eq(hostingServicesTable.id, req.params.id)).limit(1);
    if (!service) { res.status(404).json({ error: "Service not found" }); return; }

    let whmNote = "";
    const server = service.username ? await resolveServerForService(service) : null;

    if (server && service.username) {
      try {
        await cpanelTerminate(toServerCfg(server), service.username);
        await logServerAction({
          serviceId: service.id, serverId: server.id,
          action: "removeacct", status: "success",
          request: { user: service.username },
        });
      } catch (whmErr: any) {
        whmNote = ` (WHM warning: ${whmErr.message})`;
        await logServerAction({
          serviceId: service.id, serverId: server?.id,
          action: "removeacct", status: "failed",
          request: { user: service.username },
          errorMessage: whmErr.message,
        });
        console.warn(`[WHM] terminate failed for ${service.username}: ${whmErr.message}`);
      }
    } else {
      whmNote = " (no WHM server resolved — DB only)";
    }

    const [updated] = await db.update(hostingServicesTable)
      .set({ status: "terminated", cpanelUrl: null, webmailUrl: null, updatedAt: new Date() })
      .where(eq(hostingServicesTable.id, service.id))
      .returning();

    res.json({ ...formatService(updated!), whmNote });
  } catch (err: any) {
    console.error("[ADMIN] terminate error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Client: request cancellation
router.post("/client/hosting/:id/cancel-request", authenticate, async (req: AuthRequest, res) => {
  try {
    const { reason } = req.body;
    const [service] = await db.select().from(hostingServicesTable)
      .where(eq(hostingServicesTable.id, req.params.id)).limit(1);
    if (!service) { res.status(404).json({ error: "Not found" }); return; }
    if (service.clientId !== req.user!.userId) { res.status(403).json({ error: "Forbidden" }); return; }
    const [updated] = await db.update(hostingServicesTable)
      .set({ cancelRequested: true, cancelReason: reason || "Requested by client", cancelRequestedAt: new Date(), updatedAt: new Date() })
      .where(eq(hostingServicesTable.id, req.params.id))
      .returning();
    res.json(formatService(updated));
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Admin: update hosting service (general)
router.put("/admin/hosting/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const allowed = ["status", "cancelRequested", "nextDueDate", "billingCycle", "sslStatus", "username", "domain", "serverId", "serverIp", "cpanelUrl", "webmailUrl"];
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const [updated] = await db.update(hostingServicesTable).set(updates).where(eq(hostingServicesTable.id, req.params.id)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated.clientId)).limit(1);
    res.json(formatService(updated, user ? `${user.firstName} ${user.lastName}` : ""));
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Admin: list all cancellation requests
router.get("/admin/hosting/cancellation-requests", authenticate, requireAdmin, async (_req, res) => {
  try {
    const services = await db.select().from(hostingServicesTable).where(eq(hostingServicesTable.cancelRequested, true));
    const result = await Promise.all(services.map(async s => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, s.clientId)).limit(1);
      return { ...formatService(s, user ? `${user.firstName} ${user.lastName}` : "") };
    }));
    res.json(result);
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Admin: reject cancellation request
router.post("/admin/hosting/:id/reject-cancel", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [updated] = await db.update(hostingServicesTable)
      .set({ cancelRequested: false, cancelReason: null, cancelRequestedAt: null, updatedAt: new Date() })
      .where(eq(hostingServicesTable.id, req.params.id)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true, message: "Cancellation request rejected", ...formatService(updated) });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Admin: manually provision hosting account on server
router.post("/admin/hosting/:id/provision", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const result = await provisionHostingService(req.params.id);
    if (!result.success) { res.status(400).json({ error: result.message }); return; }
    const [updated] = await db.select().from(hostingServicesTable).where(eq(hostingServicesTable.id, req.params.id)).limit(1);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated!.clientId)).limit(1);
    res.json({ ...formatService(updated!, user ? `${user.firstName} ${user.lastName}` : ""), credentials: result.credentials });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Admin: resend welcome email with fresh SSO login URLs (no password — that was sent on creation only)
router.post("/admin/hosting/:id/resend-welcome", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [service] = await db.select().from(hostingServicesTable)
      .where(eq(hostingServicesTable.id, req.params.id)).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });
    if (!service.username) return res.status(400).json({ error: "No cPanel username — account not provisioned yet" });

    const [user] = await db.select().from(usersTable)
      .where(eq(usersTable.id, service.clientId)).limit(1);
    if (!user) return res.status(404).json({ error: "Client not found" });

    const server = await resolveServerForService(service);
    const serverCfg = server ? toServerCfg(server) : null;

    // Generate fresh SSO URLs (best-effort — gracefully degrade if WHM unreachable)
    let freshCpanelUrl = service.cpanelUrl || "";
    let freshWebmailUrl = service.webmailUrl || "";
    if (serverCfg) {
      try {
        freshCpanelUrl = await cpanelCreateUserSession(serverCfg, service.username, "cpaneld");
        freshWebmailUrl = await cpanelCreateUserSession(serverCfg, service.username, "webmaild");
      } catch (ssoErr: any) {
        console.warn("[RESEND-WELCOME] WHM SSO failed:", ssoErr.message, "— using stored URLs");
      }
    }

    const result = await emailHostingCreated(user.email, {
      clientName: `${user.firstName} ${user.lastName}`.trim() || user.email,
      domain: service.domain || "your hosting account",
      username: service.username,
      cpanelUrl: freshCpanelUrl,
      webmailUrl: freshWebmailUrl,
      ns1: server?.ns1 || "ns1.nexgohost.com",
      ns2: server?.ns2 || "ns2.nexgohost.com",
    }, { clientId: user.id, referenceId: service.id });

    if (result.sent) {
      res.json({ success: true, message: `Welcome email resent to ${user.email}` });
    } else {
      res.status(500).json({ error: `Email failed: ${result.message}` });
    }
  } catch (err: any) {
    console.error("[ADMIN] resend-welcome error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Admin: approve cancellation (WHM removeacct + DB terminated)
router.post("/admin/hosting/:id/cancel", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [service] = await db.select().from(hostingServicesTable)
      .where(eq(hostingServicesTable.id, req.params.id)).limit(1);
    if (!service) { res.status(404).json({ error: "Service not found" }); return; }

    const server = service.username ? await resolveServerForService(service) : null;
    if (server && service.username) {
      try {
        await cpanelTerminate(toServerCfg(server), service.username);
        await logServerAction({
          serviceId: service.id, serverId: server.id,
          action: "removeacct (cancel approved)", status: "success",
          request: { user: service.username },
        });
      } catch (whmErr: any) {
        await logServerAction({
          serviceId: service.id, serverId: server?.id,
          action: "removeacct (cancel approved)", status: "failed",
          request: { user: service.username }, errorMessage: whmErr.message,
        });
        console.warn(`[WHM] cancel/terminate failed for ${service.username}: ${whmErr.message}`);
      }
    }

    const [updated] = await db.update(hostingServicesTable)
      .set({ status: "terminated", cancelRequested: false, cpanelUrl: null, webmailUrl: null, updatedAt: new Date() })
      .where(eq(hostingServicesTable.id, service.id))
      .returning();

    res.json(formatService(updated!));
  } catch (err: any) {
    console.error("[ADMIN] cancel error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Client: get my hosting
router.post("/client/hosting/:id/reinstall-ssl", authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const [service] = await db.select().from(hostingServicesTable)
    .where(eq(hostingServicesTable.id, id)).limit(1);
  if (!service || service.clientId !== req.user!.userId) {
    return res.status(404).json({ error: "Service not found" });
  }
  if (service.status !== "active") {
    return res.status(400).json({ error: "Service must be active to reinstall SSL" });
  }
  await db.update(hostingServicesTable)
    .set({ sslStatus: "installing", updatedAt: new Date() })
    .where(eq(hostingServicesTable.id, id));
  // In production this would call the server module API — simulate completion after 2s
  setTimeout(async () => {
    await db.update(hostingServicesTable)
      .set({ sslStatus: "installed", updatedAt: new Date() })
      .where(eq(hostingServicesTable.id, id));
  }, 2000);
  res.json({ success: true, message: "SSL reinstall initiated" });
});

// Admin: activate / reinstall SSL via WHM
router.post("/admin/hosting/:id/activate-ssl", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const [service] = await db.select().from(hostingServicesTable)
      .where(eq(hostingServicesTable.id, id)).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });
    if (!service.domain) return res.status(400).json({ error: "Service has no domain configured" });

    // Set status to installing immediately
    await db.update(hostingServicesTable)
      .set({ sslStatus: "installing", updatedAt: new Date() })
      .where(eq(hostingServicesTable.id, id));

    const server = await resolveServerForService(service);
    if (server && service.username) {
      try {
        await cpanelInstallSSL(toServerCfg(server), service.domain);
        await logServerAction({
          serviceId: service.id, serverId: server.id,
          action: "installssl", status: "success",
          request: { domain: service.domain },
        });
        await db.update(hostingServicesTable)
          .set({ sslStatus: "installed", updatedAt: new Date() })
          .where(eq(hostingServicesTable.id, id));
        return res.json({ success: true, message: `SSL installed for ${service.domain}` });
      } catch (whmErr: any) {
        await logServerAction({
          serviceId: service.id, serverId: server?.id,
          action: "installssl", status: "failed",
          request: { domain: service.domain }, errorMessage: whmErr.message,
        });
        // Revert status on failure
        await db.update(hostingServicesTable)
          .set({ sslStatus: "failed", updatedAt: new Date() })
          .where(eq(hostingServicesTable.id, id));
        return res.status(500).json({ error: `WHM SSL install failed: ${whmErr.message}` });
      }
    } else {
      // No server — mark as installing (simulated for demo without WHM)
      setTimeout(async () => {
        await db.update(hostingServicesTable)
          .set({ sslStatus: "installed", updatedAt: new Date() })
          .where(eq(hostingServicesTable.id, id));
      }, 3000);
      return res.json({ success: true, message: "SSL install initiated (no WHM server — simulated)" });
    }
  } catch (err: any) {
    console.error("[ADMIN] activate-ssl error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Resolve the best WHM server for a given service.
 * Priority: service.serverId → plan.moduleServerId → plan.moduleServerGroupId
 *           → default active cPanel server → first active cPanel server.
 * Saves the resolved serverId back to the service row for future calls.
 */
async function resolveServerForService(service: typeof hostingServicesTable.$inferSelect) {
  // 1. Already has a server assigned
  if (service.serverId) {
    const [s] = await db.select().from(serversTable).where(eq(serversTable.id, service.serverId)).limit(1);
    if (s?.status === "active" && s.apiToken && s.hostname) return s;
  }

  // 2. Look up plan server assignments
  const [plan] = await db.select().from(hostingPlansTable).where(eq(hostingPlansTable.id, service.planId)).limit(1);

  if (plan?.moduleServerId) {
    const [s] = await db.select().from(serversTable).where(eq(serversTable.id, plan.moduleServerId)).limit(1);
    if (s?.status === "active" && s.apiToken && s.hostname) {
      await db.update(hostingServicesTable).set({ serverId: s.id, updatedAt: new Date() })
        .where(eq(hostingServicesTable.id, service.id));
      return s;
    }
  }

  // 3. Plan server group — pick best matching active server
  const allActive = await db.select().from(serversTable).where(eq(serversTable.status, "active"));

  if (plan?.moduleServerGroupId) {
    const groupServer = allActive.find(s => s.groupId === plan.moduleServerGroupId && s.type === "cpanel" && s.apiToken)
      || allActive.find(s => s.groupId === plan.moduleServerGroupId && s.apiToken);
    if (groupServer?.hostname) {
      await db.update(hostingServicesTable).set({ serverId: groupServer.id, updatedAt: new Date() })
        .where(eq(hostingServicesTable.id, service.id));
      return groupServer;
    }
  }

  // 4. Default active cPanel server
  const defaultServer = allActive.find(s => s.isDefault && s.type === "cpanel" && s.apiToken)
    || allActive.find(s => s.isDefault && s.apiToken)
    || allActive.find(s => s.type === "cpanel" && s.apiToken)
    || allActive.find(s => s.apiToken && s.hostname);

  if (defaultServer?.hostname) {
    await db.update(hostingServicesTable).set({ serverId: defaultServer.id, updatedAt: new Date() })
      .where(eq(hostingServicesTable.id, service.id));
    return defaultServer;
  }

  return null;
}

// ── cPanel SSO login (generate session, redirect client to cPanel) ────────────
async function ssoLogin(req: AuthRequest, res: any, service_name: "cpaneld" | "webmaild") {
  try {
    const { id } = req.params;
    const [service] = await db.select().from(hostingServicesTable)
      .where(eq(hostingServicesTable.id, id)).limit(1);
    if (!service || service.clientId !== req.user!.userId) {
      return res.status(404).json({ error: "Service not found" });
    }
    if (service.status !== "active") {
      return res.status(400).json({ error: "Service must be active to login" });
    }
    if (!service.username) {
      return res.status(400).json({ error: "No cPanel username is linked to this service. Please contact support." });
    }

    // Resolve server (works for old services with no serverId)
    const server = await resolveServerForService(service);
    if (!server) {
      return res.status(400).json({ error: "No WHM server found. Add an active cPanel server in Admin → Servers." });
    }

    const serverCfg = {
      hostname: server.hostname,
      port: server.apiPort || 2087,
      username: server.apiUsername || "root",
      apiToken: server.apiToken!,
    };

    const loginUrl = await cpanelCreateUserSession(serverCfg, service.username, service_name);
    return res.json({ url: loginUrl });
  } catch (err: any) {
    const msg: string = err.message || "SSO login failed";
    console.warn(`[WHM SSO] ${service_name} login failed for service ${req.params.id}: ${msg}`);
    return res.status(500).json({ error: msg });
  }
}

router.post("/client/hosting/:id/cpanel-login", authenticate, (req: AuthRequest, res) =>
  ssoLogin(req, res, "cpaneld"),
);

router.post("/client/hosting/:id/webmail-login", authenticate, (req: AuthRequest, res) =>
  ssoLogin(req, res, "webmaild"),
);

// ── Admin SSO login: same as client SSO but no clientId check (admin can log into any account) ─
async function adminSsoLogin(req: AuthRequest, res: any, service_name: "cpaneld" | "webmaild") {
  try {
    const { id } = req.params;
    const [service] = await db.select().from(hostingServicesTable)
      .where(eq(hostingServicesTable.id, id)).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });

    if (!service.username) {
      return res.status(400).json({ error: "No cPanel username linked to this service." });
    }

    const server = await resolveServerForService(service);
    if (!server) {
      return res.status(400).json({ error: "No WHM server found. Add an active cPanel server in Admin → Servers." });
    }

    const serverCfg = {
      hostname: server.hostname,
      port: server.apiPort || 2087,
      username: server.apiUsername || "root",
      apiToken: server.apiToken!,
    };

    const loginUrl = await cpanelCreateUserSession(serverCfg, service.username, service_name);
    return res.json({ url: loginUrl });
  } catch (err: any) {
    const msg: string = err.message || "SSO login failed";
    console.warn(`[WHM ADMIN SSO] ${service_name} login failed for service ${req.params.id}: ${msg}`);
    return res.status(500).json({ error: msg });
  }
}

router.post("/admin/hosting/:id/cpanel-login", authenticate, requireAdmin, (req: AuthRequest, res) =>
  adminSsoLogin(req, res, "cpaneld"),
);

router.post("/admin/hosting/:id/webmail-login", authenticate, requireAdmin, (req: AuthRequest, res) =>
  adminSsoLogin(req, res, "webmaild"),
);

// ── Admin: bulk-link all services without a server to the best available server ─
// Covers old orders that were created before server assignment was automated.
router.post("/admin/hosting/link-all-servers", authenticate, requireAdmin, async (_req, res) => {
  try {
    const unlinked = await db.select().from(hostingServicesTable)
      .where(and(
        isNull(hostingServicesTable.serverId),
        isNotNull(hostingServicesTable.username),
      ));

    const allActive = await db.select().from(serversTable)
      .where(eq(serversTable.status, "active"));

    const defaultServer = allActive.find(s => s.isDefault && s.type === "cpanel" && s.apiToken)
      || allActive.find(s => s.isDefault && s.apiToken)
      || allActive.find(s => s.type === "cpanel" && s.apiToken)
      || allActive.find(s => s.apiToken && s.hostname)
      || null;

    let linked = 0;
    let skipped = 0;

    for (const service of unlinked) {
      // Try plan-level server first
      const [plan] = await db.select().from(hostingPlansTable)
        .where(eq(hostingPlansTable.id, service.planId)).limit(1);

      let targetServer = null;

      if (plan?.moduleServerId) {
        const [s] = await db.select().from(serversTable)
          .where(eq(serversTable.id, plan.moduleServerId)).limit(1);
        if (s?.status === "active" && s.apiToken) targetServer = s;
      }

      if (!targetServer && plan?.moduleServerGroupId) {
        targetServer = allActive.find(s => s.groupId === plan.moduleServerGroupId && s.type === "cpanel" && s.apiToken)
          || allActive.find(s => s.groupId === plan.moduleServerGroupId && s.apiToken)
          || null;
      }

      if (!targetServer) targetServer = defaultServer;

      if (!targetServer) { skipped++; continue; }

      const cpanelHost = targetServer.hostname;
      await db.update(hostingServicesTable).set({
        serverId: targetServer.id,
        serverIp: targetServer.ipAddress || targetServer.hostname,
        cpanelUrl: `https://${cpanelHost}:2083`,
        webmailUrl: `https://${cpanelHost}:2096`,
        updatedAt: new Date(),
      }).where(eq(hostingServicesTable.id, service.id));

      linked++;
    }

    res.json({
      success: true,
      message: `Linked ${linked} service(s) to servers. ${skipped} could not be linked (no server available).`,
      linked,
      skipped,
      total: unlinked.length,
    });
  } catch (err: any) {
    console.error("[ADMIN] link-all-servers error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get("/client/hosting", authenticate, async (req: AuthRequest, res) => {
  try {
    const services = await db.select().from(hostingServicesTable).where(eq(hostingServicesTable.clientId, req.user!.userId));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    res.json(services.map(s => formatService(s, user ? `${user.firstName} ${user.lastName}` : "")));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Client dashboard data
router.get("/client/dashboard", authenticate, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;

    const [services, allDomains, allInvoices, recentInvoices, recentTickets] = await Promise.all([
      db.select().from(hostingServicesTable).where(eq(hostingServicesTable.clientId, clientId)),
      db.select().from(domainsTable).where(eq(domainsTable.clientId, clientId)),
      db.select().from(invoicesTable).where(eq(invoicesTable.clientId, clientId)),
      db.select().from(invoicesTable).where(eq(invoicesTable.clientId, clientId)).orderBy(sql`created_at DESC`).limit(5),
      db.select().from(ticketsTable).where(eq(ticketsTable.clientId, clientId)).orderBy(sql`created_at DESC`).limit(5),
    ]);

    const unpaidInvoices = allInvoices.filter(i => i.status === "unpaid").length;
    const openTickets = recentTickets.filter(t => t.status === "open" || t.status === "pending").length;

    res.json({
      activeServices: services.filter(s => s.status === "active").length,
      activeDomains: allDomains.filter(d => d.status === "active").length,
      unpaidInvoices,
      openTickets,
      recentInvoices: recentInvoices.map(i => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        clientId: i.clientId,
        clientName: "",
        amount: Number(i.amount),
        tax: Number(i.tax),
        total: Number(i.total),
        status: i.status,
        dueDate: i.dueDate.toISOString(),
        paidDate: i.paidDate?.toISOString() ?? null,
        items: i.items || [],
        createdAt: i.createdAt.toISOString(),
      })),
      recentTickets: recentTickets.map(t => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        clientId: t.clientId,
        clientName: "",
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        department: t.department,
        messagesCount: t.messagesCount,
        lastReply: t.lastReply?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
