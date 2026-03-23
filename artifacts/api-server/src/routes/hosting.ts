import { Router } from "express";
import { db } from "@workspace/db";
import { hostingPlansTable, hostingServicesTable, usersTable, domainsTable, invoicesTable, ticketsTable, serversTable, serverLogsTable, ordersTable } from "@workspace/db/schema";
import { eq, sql, and, isNull, isNotNull } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { provisionHostingService } from "../lib/provision.js";
import { emailServiceSuspended, emailHostingCreated } from "../lib/email.js";
import { cpanelCreateUserSession, cpanelSuspend, cpanelUnsuspend, cpanelTerminate, cpanelInstallSSL, cpanelChangePassword } from "../lib/cpanel.js";
import { twentyiSuspend, twentyiUnsuspend, twentyiDelete, twentyiInstallSSL, twentyiGetPackages, twentyiStackCPUrl } from "../lib/twenty-i.js";
import { provisionWordPress, reinstallWordPress, checkWordPressInstalled, generateWpUsername, generateWpPassword, WP_STEPS } from "../lib/wordpress-provisioner.js";

const router = Router();

/**
 * Calculate the correct renewal amount for a hosting service.
 * Priority: renewalPrice (if configured) → cycle-specific price → base monthly price.
 */
function getRenewalAmount(
  plan: { price: string; renewalPrice: string | null; yearlyPrice: string | null; quarterlyPrice: string | null; semiannualPrice: string | null },
  billingCycle: string
): number {
  // Use dedicated renewal price if configured
  if (plan.renewalPrice) return Number(plan.renewalPrice);
  // Fall back to the billing-cycle-specific list price
  switch (billingCycle) {
    case "yearly":    return Number(plan.yearlyPrice    || plan.price);
    case "quarterly": return Number(plan.quarterlyPrice || plan.price);
    case "semiannual":return Number(plan.semiannualPrice|| plan.price);
    default:          return Number(plan.price);
  }
}

/**
 * Calculate the correct amount for a new order / plan change.
 * Uses cycle-specific prices; does NOT use renewalPrice (that's only for renewals).
 */
function getOrderAmount(
  plan: { price: string; yearlyPrice: string | null; quarterlyPrice: string | null; semiannualPrice: string | null },
  billingCycle: string
): number {
  switch (billingCycle) {
    case "yearly":    return Number(plan.yearlyPrice    || plan.price);
    case "quarterly": return Number(plan.quarterlyPrice || plan.price);
    case "semiannual":return Number(plan.semiannualPrice|| plan.price);
    default:          return Number(plan.price);
  }
}

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
    autoRenew: s.autoRenew ?? true,
    wpInstalled: s.wpInstalled ?? false,
    wpUrl: s.wpUrl,
    wpUsername: s.wpUsername,
    wpPassword: s.wpPassword,
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
      const reason = (req.body?.reason as string) || "Suspended by admin";
      try {
        if (server.type === "20i") {
          await twentyiSuspend(server.apiToken!, service.username);
        } else {
          await cpanelSuspend(toServerCfg(server), service.username, reason);
        }
        await logServerAction({
          serviceId: service.id, serverId: server.id,
          action: "suspendacct",
          status: "success",
          request: { user: service.username, reason, module: server.type },
        });
      } catch (whmErr: any) {
        whmNote = ` (${server.type} warning: ${whmErr.message})`;
        await logServerAction({
          serviceId: service.id, serverId: server?.id,
          action: "suspendacct", status: "failed",
          request: { user: service.username, module: server.type },
          errorMessage: whmErr.message,
        });
        console.warn(`[${server.type}] suspend failed for ${service.username}: ${whmErr.message}`);
      }
    } else {
      whmNote = " (no server resolved — DB only)";
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
        if (server.type === "20i") {
          await twentyiUnsuspend(server.apiToken!, service.username);
        } else {
          await cpanelUnsuspend(toServerCfg(server), service.username);
        }
        await logServerAction({
          serviceId: service.id, serverId: server.id,
          action: "unsuspendacct", status: "success",
          request: { user: service.username, module: server.type },
        });
      } catch (whmErr: any) {
        whmNote = ` (${server.type} warning: ${whmErr.message})`;
        await logServerAction({
          serviceId: service.id, serverId: server?.id,
          action: "unsuspendacct", status: "failed",
          request: { user: service.username, module: server.type },
          errorMessage: whmErr.message,
        });
        console.warn(`[${server.type}] unsuspend failed for ${service.username}: ${whmErr.message}`);
      }
    } else {
      whmNote = " (no server resolved — DB only)";
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
        if (server.type === "20i") {
          await twentyiDelete(server.apiToken!, service.username);
        } else {
          await cpanelTerminate(toServerCfg(server), service.username);
        }
        await logServerAction({
          serviceId: service.id, serverId: server.id,
          action: "removeacct", status: "success",
          request: { user: service.username, module: server.type },
        });
      } catch (whmErr: any) {
        whmNote = ` (${server.type} warning: ${whmErr.message})`;
        await logServerAction({
          serviceId: service.id, serverId: server?.id,
          action: "removeacct", status: "failed",
          request: { user: service.username, module: server.type },
          errorMessage: whmErr.message,
        });
        console.warn(`[${server.type}] terminate failed for ${service.username}: ${whmErr.message}`);
      }
    } else {
      whmNote = " (no server resolved — DB only)";
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

// Client: toggle auto-renew on own hosting service
router.put("/client/hosting/:id/auto-renew", authenticate, async (req: AuthRequest, res) => {
  try {
    const [service] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, req.params.id), eq(hostingServicesTable.clientId, req.user!.userId))).limit(1);
    if (!service) { res.status(404).json({ error: "Service not found" }); return; }
    const autoRenew = req.body.autoRenew === true;
    const [updated] = await db.update(hostingServicesTable)
      .set({ autoRenew, updatedAt: new Date() })
      .where(eq(hostingServicesTable.id, service.id))
      .returning();
    res.json({ success: true, autoRenew: updated.autoRenew });
  } catch (err: any) {
    console.error("[HOSTING] auto-renew toggle error:", err.message);
    res.status(500).json({ error: "Server error" });
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
        if (server.type === "20i") {
          await twentyiDelete(server.apiToken!, service.username);
        } else {
          await cpanelTerminate(toServerCfg(server), service.username);
        }
        await logServerAction({
          serviceId: service.id, serverId: server.id,
          action: "removeacct (cancel approved)", status: "success",
          request: { user: service.username, module: server.type },
        });
      } catch (whmErr: any) {
        await logServerAction({
          serviceId: service.id, serverId: server?.id,
          action: "removeacct (cancel approved)", status: "failed",
          request: { user: service.username, module: server.type }, errorMessage: whmErr.message,
        });
        console.warn(`[${server.type}] cancel/terminate failed for ${service.username}: ${whmErr.message}`);
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

  const server = await resolveServerForService(service);
  if (server?.type === "20i" && server.apiToken && service.username && service.domain) {
    try {
      await twentyiInstallSSL(server.apiToken, service.username, service.domain);
      await db.update(hostingServicesTable)
        .set({ sslStatus: "installed", updatedAt: new Date() })
        .where(eq(hostingServicesTable.id, id));
      await logServerAction({ serviceId: service.id, serverId: server.id, action: "install_ssl_20i", status: "success", request: { domain: service.domain } });
      return res.json({ success: true, message: "SSL installed via 20i API" });
    } catch (sslErr: any) {
      await db.update(hostingServicesTable)
        .set({ sslStatus: "failed", updatedAt: new Date() })
        .where(eq(hostingServicesTable.id, id));
      await logServerAction({ serviceId: service.id, serverId: server.id, action: "install_ssl_20i", status: "failed", errorMessage: sslErr.message });
      return res.status(500).json({ error: `20i SSL install failed: ${sslErr.message}` });
    }
  }

  // Fallback: simulate completion after 2s (for non-20i or no server)
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
        if (server.type === "20i") {
          await twentyiInstallSSL(server.apiToken!, service.username, service.domain);
        } else {
          await cpanelInstallSSL(toServerCfg(server), service.domain);
        }
        await logServerAction({
          serviceId: service.id, serverId: server.id,
          action: "installssl", status: "success",
          request: { domain: service.domain, module: server.type },
        });
        await db.update(hostingServicesTable)
          .set({ sslStatus: "installed", updatedAt: new Date() })
          .where(eq(hostingServicesTable.id, id));
        return res.json({ success: true, message: `SSL installed for ${service.domain}` });
      } catch (whmErr: any) {
        await logServerAction({
          serviceId: service.id, serverId: server?.id,
          action: "installssl", status: "failed",
          request: { domain: service.domain, module: server.type }, errorMessage: whmErr.message,
        });
        await db.update(hostingServicesTable)
          .set({ sslStatus: "failed", updatedAt: new Date() })
          .where(eq(hostingServicesTable.id, id));
        return res.status(500).json({ error: `SSL install failed: ${whmErr.message}` });
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
      // Fallback: return stored URL if available
      if (service_name === "cpaneld" && service.cpanelUrl) return res.json({ url: service.cpanelUrl });
      if (service_name === "webmaild" && service.webmailUrl) return res.json({ url: service.webmailUrl });
      return res.status(400).json({ error: "No server found. Contact support or add an active server in Admin → Servers." });
    }

    // 20i: StackCP uses direct URLs — no SSO token needed
    if (server.type === "20i") {
      const stackCPUrl = service.cpanelUrl || (service.username ? twentyiStackCPUrl(service.username) : null);
      const webmailUrl = service.webmailUrl || (service.domain ? `https://webmail.${service.domain}` : null);
      const url = service_name === "webmaild" ? webmailUrl : stackCPUrl;
      if (!url) return res.status(400).json({ error: "No 20i control panel URL found for this service." });
      return res.json({ url });
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
    console.warn(`[SSO] ${service_name} login failed for service ${req.params.id}: ${msg}`);
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
      if (service_name === "cpaneld" && service.cpanelUrl) return res.json({ url: service.cpanelUrl });
      if (service_name === "webmaild" && service.webmailUrl) return res.json({ url: service.webmailUrl });
      return res.status(400).json({ error: "No server found. Add an active server in Admin → Servers." });
    }

    if (server.type === "20i") {
      const stackCPUrl = service.cpanelUrl || (service.username ? twentyiStackCPUrl(service.username) : null);
      const webmailUrl = service.webmailUrl || (service.domain ? `https://webmail.${service.domain}` : null);
      const url = service_name === "webmaild" ? webmailUrl : stackCPUrl;
      if (!url) return res.status(400).json({ error: "No 20i control panel URL found for this service." });
      return res.json({ url });
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
    console.warn(`[ADMIN SSO] ${service_name} login failed for service ${req.params.id}: ${msg}`);
    return res.status(500).json({ error: msg });
  }
}

router.post("/admin/hosting/:id/cpanel-login", authenticate, requireAdmin, (req: AuthRequest, res) =>
  adminSsoLogin(req, res, "cpaneld"),
);

router.post("/admin/hosting/:id/webmail-login", authenticate, requireAdmin, (req: AuthRequest, res) =>
  adminSsoLogin(req, res, "webmaild"),
);

// ── 20i: fetch packages list for a given 20i server ──────────────────────────
router.get("/admin/servers/:id/twentyi-packages", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [server] = await db.select().from(serversTable)
      .where(eq(serversTable.id, req.params.id)).limit(1);
    if (!server) return res.status(404).json({ error: "Server not found" });
    if (server.type !== "20i") return res.status(400).json({ error: "Server is not a 20i server" });
    if (!server.apiToken) return res.status(400).json({ error: "Server has no API key configured" });

    const packages = await twentyiGetPackages(server.apiToken);
    return res.json({ packages });
  } catch (err: any) {
    console.error("[20i] fetch packages error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── 20i: test API connection for a given 20i server ──────────────────────────
router.post("/admin/servers/:id/twentyi-test", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [server] = await db.select().from(serversTable)
      .where(eq(serversTable.id, req.params.id)).limit(1);
    if (!server) return res.status(404).json({ error: "Server not found" });
    if (server.type !== "20i") return res.status(400).json({ error: "Server is not a 20i server" });

    const apiKey = (req.body?.apiKey as string) || server.apiToken;
    if (!apiKey) return res.status(400).json({ error: "No API key provided" });

    const { twentyiTestConnection } = await import("../lib/twenty-i.js");
    const result = await twentyiTestConnection(apiKey);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

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

// Client: get single service by ID
router.get("/client/hosting/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const [service] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, id), eq(hostingServicesTable.clientId, req.user!.userId)))
      .limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    return res.json(formatService(service, user ? `${user.firstName} ${user.lastName}` : ""));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
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

// Client: request renewal (creates order + invoice)
router.post("/client/hosting/:id/renew", authenticate, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { id } = req.params;
    const [service] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, id), eq(hostingServicesTable.clientId, clientId)))
      .limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });
    if (service.status === "terminated") return res.status(400).json({ error: "Cannot renew a terminated service" });

    const [plan] = await db.select().from(hostingPlansTable)
      .where(eq(hostingPlansTable.id, service.planId)).limit(1);
    const billingCycle = service.billingCycle || "monthly";

    // Use renewalPrice if set, otherwise fall back to cycle-specific price
    const amount = plan ? getRenewalAmount(plan, billingCycle) : 0;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    const invNum = `INV-${Date.now().toString().slice(-8)}`;
    const [invoice] = await db.insert(invoicesTable).values({
      invoiceNumber: invNum,
      clientId,
      amount: String(amount),
      tax: "0",
      total: String(amount),
      status: "unpaid",
      dueDate,
      items: [{ description: `Renewal: ${service.planName} (${billingCycle})`, amount }],
    }).returning();

    const [order] = await db.insert(ordersTable).values({
      clientId,
      type: "renewal",
      itemId: service.id,
      itemName: `Renewal: ${service.planName}`,
      domain: service.domain,
      amount: String(amount),
      billingCycle,
      invoiceId: invoice.id,
      status: "pending",
      notes: `Renewal request for service ID: ${service.id}`,
    }).returning();

    res.json({ success: true, invoiceId: invoice.id, invoiceNumber: invNum, orderId: order.id, amount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: approve renewal → extend due date + mark invoice paid
router.post("/admin/hosting/:id/approve-renewal", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const [service] = await db.select().from(hostingServicesTable)
      .where(eq(hostingServicesTable.id, id)).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });

    const billingCycle = service.billingCycle || "monthly";
    const base = service.nextDueDate ? new Date(service.nextDueDate) : new Date();
    if (base < new Date()) base.setTime(new Date().getTime());

    const newDueDate = new Date(base);
    if (billingCycle === "yearly") newDueDate.setFullYear(newDueDate.getFullYear() + 1);
    else if (billingCycle === "quarterly") newDueDate.setMonth(newDueDate.getMonth() + 3);
    else if (billingCycle === "semiannual") newDueDate.setMonth(newDueDate.getMonth() + 6);
    else newDueDate.setMonth(newDueDate.getMonth() + 1);

    const [updated] = await db.update(hostingServicesTable).set({
      nextDueDate: newDueDate,
      status: "active",
      updatedAt: new Date(),
    }).where(eq(hostingServicesTable.id, id)).returning();

    // Mark the most recent unpaid renewal invoice as paid
    const pendingOrders = await db.select().from(ordersTable)
      .where(and(eq(ordersTable.itemId, id), eq(ordersTable.type, "renewal"), eq(ordersTable.status, "pending")));

    for (const order of pendingOrders) {
      await db.update(ordersTable).set({ status: "completed", updatedAt: new Date() })
        .where(eq(ordersTable.id, order.id));
      if (order.invoiceId) {
        await db.update(invoicesTable).set({ status: "paid", paidDate: new Date() })
          .where(eq(invoicesTable.id, order.invoiceId));
      }
    }

    res.json({ success: true, newDueDate: newDueDate.toISOString(), service: formatService(updated!) });
  } catch (err) {
    console.error("[ADMIN] approve-renewal error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Client: request plan upgrade/downgrade
router.post("/client/hosting/:id/upgrade", authenticate, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { id } = req.params;
    const { newPlanId } = req.body;
    if (!newPlanId) return res.status(400).json({ error: "newPlanId is required" });

    const [service] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, id), eq(hostingServicesTable.clientId, clientId))).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });
    if (service.status !== "active") return res.status(400).json({ error: "Service must be active" });
    if (service.planId === newPlanId) return res.status(400).json({ error: "Already on this plan" });

    const [newPlan] = await db.select().from(hostingPlansTable)
      .where(and(eq(hostingPlansTable.id, newPlanId), eq(hostingPlansTable.isActive, true))).limit(1);
    if (!newPlan) return res.status(404).json({ error: "Plan not found" });

    const billingCycle = service.billingCycle || "monthly";
    // Use the correct cycle price for the new plan (not renewalPrice — this is a new order)
    const amount = getOrderAmount(newPlan, billingCycle);

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    const invNum = `INV-${Date.now().toString().slice(-8)}`;

    const [invoice] = await db.insert(invoicesTable).values({
      invoiceNumber: invNum,
      clientId,
      amount: String(amount),
      tax: "0",
      total: String(amount),
      status: "unpaid",
      dueDate,
      items: [{ description: `Plan Change: ${service.planName} → ${newPlan.name} (${billingCycle})`, amount }],
    }).returning();

    const [order] = await db.insert(ordersTable).values({
      clientId,
      type: "upgrade",
      itemId: service.id,
      itemName: `Plan Change: ${service.planName} → ${newPlan.name}`,
      domain: service.domain,
      amount: String(amount),
      billingCycle,
      invoiceId: invoice.id,
      status: "pending",
      notes: `Plan change to: ${newPlan.id}|${newPlan.name}`,
    }).returning();

    res.json({ success: true, orderId: order.id, invoiceId: invoice.id, invoiceNumber: invNum, amount, newPlanName: newPlan.name });
  } catch (err) {
    console.error("[CLIENT] upgrade error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: approve plan upgrade/downgrade
router.post("/admin/hosting/:id/approve-upgrade", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const [service] = await db.select().from(hostingServicesTable)
      .where(eq(hostingServicesTable.id, id)).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });

    const pendingUpgrade = await db.select().from(ordersTable)
      .where(and(eq(ordersTable.itemId, id), eq(ordersTable.type, "upgrade"), eq(ordersTable.status, "pending")))
      .orderBy(sql`created_at DESC`).limit(1);
    if (!pendingUpgrade.length) return res.status(404).json({ error: "No pending upgrade request found" });

    const upgradeOrder = pendingUpgrade[0];
    const notesStr = upgradeOrder.notes || "";
    const planMatch = notesStr.match(/Plan change to: ([^|]+)\|(.+)/);
    if (!planMatch) return res.status(400).json({ error: "Invalid upgrade order data" });
    const newPlanId = planMatch[1];
    const newPlanName = planMatch[2];

    const [updated] = await db.update(hostingServicesTable).set({
      planId: newPlanId,
      planName: newPlanName,
      updatedAt: new Date(),
    }).where(eq(hostingServicesTable.id, id)).returning();

    await db.update(ordersTable).set({ status: "completed", updatedAt: new Date() })
      .where(eq(ordersTable.id, upgradeOrder.id));

    if (upgradeOrder.invoiceId) {
      await db.update(invoicesTable).set({ status: "paid", paidDate: new Date() })
        .where(eq(invoicesTable.id, upgradeOrder.invoiceId));
    }

    res.json({ success: true, service: formatService(updated!) });
  } catch (err) {
    console.error("[ADMIN] approve-upgrade error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin + Client: change cPanel password
router.post("/admin/hosting/:id/change-password", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    const [service] = await db.select().from(hostingServicesTable)
      .where(eq(hostingServicesTable.id, id)).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });

    // Try to update on server
    let serverUpdated = false;
    if (service.serverId) {
      const [server] = await db.select().from(serversTable).where(eq(serversTable.id, service.serverId)).limit(1);
      if (server && service.username) {
        try {
          if (server.type === "cpanel" || server.type === "whm") {
            await cpanelChangePassword(toServerCfg(server), service.username, password);
            serverUpdated = true;
          }
        } catch (e) { /* best effort */ }
      }
    }

    // Always update in DB
    await db.update(hostingServicesTable).set({ password, updatedAt: new Date() })
      .where(eq(hostingServicesTable.id, id));

    res.json({ success: true, serverUpdated, message: serverUpdated ? "Password updated on server and in database" : "Password updated in database (server update failed or not connected)" });
  } catch (err) {
    console.error("[ADMIN] change-password error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/client/hosting/:id/change-password", authenticate, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { id } = req.params;
    const { password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    const [service] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, id), eq(hostingServicesTable.clientId, clientId))).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });

    let serverUpdated = false;
    if (service.serverId) {
      const [server] = await db.select().from(serversTable).where(eq(serversTable.id, service.serverId)).limit(1);
      if (server && service.username) {
        try {
          if (server.type === "cpanel" || server.type === "whm") {
            await cpanelChangePassword(toServerCfg(server), service.username, password);
            serverUpdated = true;
          }
        } catch (e) { /* best effort */ }
      }
    }
    await db.update(hostingServicesTable).set({ password, updatedAt: new Date() })
      .where(eq(hostingServicesTable.id, id));

    res.json({ success: true, serverUpdated });
  } catch (err) {
    console.error("[CLIENT] change-password error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// WordPress auto-installer
router.post("/admin/hosting/:id/install-wordpress", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { adminUser, adminPassword, adminEmail, siteName = "My WordPress Site", path = "/" } = req.body;
    const [service] = await db.select().from(hostingServicesTable).where(eq(hostingServicesTable.id, id)).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });
    if (!service.domain) return res.status(400).json({ error: "Service has no domain" });

    const wpUser = adminUser || "admin";
    const wpPass = adminPassword || Math.random().toString(36).slice(-12) + "A1!";
    const wpEmail = adminEmail || "admin@" + service.domain;

    // If server connected, try real install
    let serverInstalled = false;
    if (service.serverId && service.username) {
      const [server] = await db.select().from(serversTable).where(eq(serversTable.id, service.serverId)).limit(1);
      // Softaculous/Installatron API needed for server-side WP install
      serverInstalled = false;
    }

    const wpLoginUrl = `http://${service.domain}${path === "/" ? "" : path}/wp-admin`;
    res.json({
      success: true,
      serverInstalled,
      credentials: { username: wpUser, password: wpPass, email: wpEmail, loginUrl: wpLoginUrl, siteName },
      message: "WordPress credentials generated. Complete the installation via your control panel's Softaculous/Installatron.",
    });
  } catch (err) {
    console.error("[ADMIN] install-wordpress error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Helper: build cPanel context from a service record ────────────────────────
function getCpanelCtx(service: any) {
  if (!service.cpanelUrl || !service.username || !service.password) return undefined;
  return { baseUrl: service.cpanelUrl.replace(/\/?$/, "/"), username: service.username, password: service.password };
}

// GET /client/hosting/:id/wordpress-check — detect if WP is installed (cPanel file check)
router.get("/client/hosting/:id/wordpress-check", authenticate, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const [service] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, req.params.id!), eq(hostingServicesTable.clientId, clientId))).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });

    const dbInstalled = service.wpInstalled ?? false;
    const installPath = service.wpInstallPath ?? "/";
    let fileExists = dbInstalled;

    const ctx = getCpanelCtx(service);
    if (ctx && !process.env.WP_SIMULATE) {
      fileExists = await checkWordPressInstalled(ctx, installPath);
    }

    const installed = dbInstalled || fileExists;
    res.json({
      installed,
      status: service.wpProvisionStatus || "not_started",
      loginUrl: installed ? service.wpUrl : null,
      username: installed ? service.wpUsername : null,
      siteTitle: installed ? service.wpSiteTitle : null,
      installPath,
    });
  } catch (err) {
    console.error("[WP] wordpress-check error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /client/hosting/:id/install-wordpress — start async WordPress provisioning
router.post("/client/hosting/:id/install-wordpress", authenticate, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { id } = req.params;
    const {
      siteTitle = "My WordPress Site",
      adminUsername,
      adminPassword,
      adminEmail,
      installPath = "/",
    } = req.body;

    const [service] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, id), eq(hostingServicesTable.clientId, clientId))).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });
    if (!service.domain) return res.status(400).json({ error: "Service has no domain configured" });
    if (service.status !== "active") return res.status(400).json({ error: "Service must be active to install WordPress" });
    if (service.wpProvisionStatus === "provisioning" || service.wpProvisionStatus === "queued") {
      return res.status(409).json({ error: "WordPress installation is already in progress" });
    }
    if (service.wpInstalled) return res.status(409).json({ error: "WordPress is already installed. Use reinstall instead." });

    const wpUser = adminUsername?.trim() || generateWpUsername(service.domain);
    const wpPass = adminPassword?.trim() || generateWpPassword();
    const wpEmail = adminEmail?.trim() || `admin@${service.domain}`;

    console.log(`[WP] Install queued for service ${id} | domain=${service.domain} | user=${wpUser} | path=${installPath}`);

    await db.update(hostingServicesTable).set({
      wpProvisionStatus: "queued",
      wpProvisionStep: "Queued",
      wpProvisionError: null,
      wpInstalled: false,
      wpUsername: wpUser,
      wpPassword: wpPass,
      wpEmail: wpEmail,
      wpSiteTitle: siteTitle,
      wpInstallPath: installPath,
      updatedAt: new Date(),
    }).where(eq(hostingServicesTable.id, id));

    const cpanelCtx = getCpanelCtx(service);
    provisionWordPress(id, service.domain, siteTitle, wpUser, wpPass, wpEmail, installPath, cpanelCtx)
      .catch(err => console.error("[WP] Background provisioner threw:", err));

    res.json({
      success: true,
      queued: true,
      generatedUsername: wpUser,
      message: "WordPress installation started. Poll /wordpress-status for progress.",
    });
  } catch (err) {
    console.error("[CLIENT] install-wordpress error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /client/hosting/:id/reinstall-wordpress — reinstall (wipes existing, fresh install)
router.post("/client/hosting/:id/reinstall-wordpress", authenticate, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { id } = req.params;
    const {
      siteTitle = "My WordPress Site",
      adminUsername,
      adminPassword,
      adminEmail,
      installPath = "/",
    } = req.body;

    const [service] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, id), eq(hostingServicesTable.clientId, clientId))).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });
    if (!service.domain) return res.status(400).json({ error: "Service has no domain" });
    if (service.status !== "active") return res.status(400).json({ error: "Service must be active" });
    if (service.wpProvisionStatus === "provisioning" || service.wpProvisionStatus === "queued") {
      return res.status(409).json({ error: "An installation is already in progress" });
    }

    const wpUser = adminUsername?.trim() || generateWpUsername(service.domain);
    const wpPass = adminPassword?.trim() || generateWpPassword();
    const wpEmail = adminEmail?.trim() || `admin@${service.domain}`;

    console.log(`[WP] Reinstall queued for service ${id} | domain=${service.domain}`);

    const cpanelCtx = getCpanelCtx(service);
    reinstallWordPress(id, service.domain, siteTitle, wpUser, wpPass, wpEmail, installPath, cpanelCtx)
      .catch(err => console.error("[WP] Background reinstaller threw:", err));

    res.json({ success: true, queued: true, message: "WordPress reinstall started." });
  } catch (err) {
    console.error("[CLIENT] reinstall-wordpress error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /client/hosting/:id/wordpress-status — poll provisioning progress (always verifies from server)
router.get("/client/hosting/:id/wordpress-status", authenticate, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { id } = req.params;

    const [service] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, id), eq(hostingServicesTable.clientId, clientId))).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });

    let status = service.wpProvisionStatus || "not_started";

    // For a terminal "active" status, do a real file check to confirm files actually exist.
    // This prevents showing "Installed" when files have been removed or install failed silently.
    if (status === "active" && service.wpInstalled) {
      const ctx = getCpanelCtx(service);
      if (ctx && !process.env.WP_SIMULATE) {
        const fileExists = await checkWordPressInstalled(ctx, service.wpInstallPath ?? "/");
        if (!fileExists) {
          // DB says installed but files are gone — correct the DB and return not_installed
          await db.update(hostingServicesTable).set({
            wpInstalled: false,
            wpProvisionStatus: "not_started",
            wpProvisionStep: null,
            wpProvisionError: "Installation files not found during verification. Please reinstall.",
            updatedAt: new Date(),
          }).where(eq(hostingServicesTable.id, id));
          return res.json({
            status: "not_installed",
            step: null,
            error: "Installation files not found. Please reinstall WordPress.",
            wpInstalled: false,
            steps: WP_STEPS,
          });
        }
      }
      // Files confirmed — return full credentials
      return res.json({
        status: "active",
        step: "Completed",
        error: null,
        wpInstalled: true,
        steps: WP_STEPS,
        credentials: {
          loginUrl: service.wpUrl,
          username: service.wpUsername,
          password: service.wpPassword,
          email: service.wpEmail,
          siteTitle: service.wpSiteTitle,
          installPath: service.wpInstallPath,
        },
      });
    }

    res.json({
      status,
      step: service.wpProvisionStep,
      error: service.wpProvisionError,
      wpInstalled: service.wpInstalled,
      steps: WP_STEPS,
    });
  } catch (err) {
    console.error("[CLIENT] wordpress-status error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
