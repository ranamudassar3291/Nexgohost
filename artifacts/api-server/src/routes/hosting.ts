import path from "path";
import { Router } from "express";
import { cachedFetch, cacheClear } from "../lib/cache.js";
import { decryptField } from "../lib/fieldCrypto.js";
import { db } from "@workspace/db";
import { hostingPlansTable, hostingServicesTable, usersTable, domainsTable, invoicesTable, ticketsTable, serversTable, serverLogsTable, ordersTable, promoCodesTable } from "@workspace/db/schema";
import { eq, sql, and, isNull, isNotNull, inArray, ilike, desc, count, or } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { provisionHostingService } from "../lib/provision.js";
import { emailServiceSuspended, emailHostingCreated, emailServiceTerminated } from "../lib/email.js";
import { cpanelCreateUserSession, probeCpanelPaths, cpanelSuspend, cpanelUnsuspend, cpanelTerminate, cpanelInstallSSL, cpanelChangePassword, cpanelUapi, cpanelGetAccountInfo, cpanelGetLiveUsage, cpanelGetSoftaculousInstallUrl, cpanelGetWpAdminUrl, cpanelFileExists, cpanelGetSoftaculousInsid, cpanelFullBackup, cpanelDbDump } from "../lib/cpanel.js";
import { twentyiSuspend, twentyiUnsuspend, twentyiDelete, twentyiInstallSSL, twentyiGetPackages, twentyiStackCPUrl, twentyiGetSSOUrl } from "../lib/twenty-i.js";
import { provisionWordPress, reinstallWordPress, checkWordPressInstalled, isMysqlReachable, generateWpUsername, generateWpPassword, WP_STEPS } from "../lib/wordpress-provisioner.js";
import { hostingBackupsTable } from "@workspace/db/schema";
import { execAsync as _execAsync } from "../lib/shell.js";

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

function formatService(
  s: typeof hostingServicesTable.$inferSelect,
  clientName?: string,
  manage?: { canManage: boolean; manageLockReason: string | null },
) {
  return {
    id: s.id,
    clientId: s.clientId,
    clientName: clientName || "",
    canManage: manage?.canManage ?? true,
    manageLockReason: manage?.manageLockReason ?? null,
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
    freeDomainAvailable: s.freeDomainAvailable ?? false,
    twentyIPackageId: s.twentyIPackageId,
    createdAt: s.createdAt.toISOString(),
  };
}

// ── Service management lock helper ────────────────────────────────────────────
/**
 * Returns whether a hosting service can be managed by the client right now.
 * Blocked when: status is not active, due date is >1 day overdue, or there's an unpaid invoice.
 */
async function canManageHostingService(
  service: typeof hostingServicesTable.$inferSelect,
): Promise<{ canManage: boolean; manageLockReason: string | null }> {
  const BLOCKED_STATUSES = new Set(["pending", "suspended", "terminated", "pending_termination", "cancelled"]);
  if (BLOCKED_STATUSES.has(service.status as string)) {
    return { canManage: false, manageLockReason: `Management disabled. Service is ${service.status}. Please pay your invoice or contact support.` };
  }
  if (service.nextDueDate) {
    const msOverdue = Date.now() - new Date(service.nextDueDate).getTime();
    if (msOverdue > 24 * 60 * 60 * 1000) {
      return { canManage: false, manageLockReason: "Management disabled. Service renewal is overdue by more than 1 day. Please renew to restore access." };
    }
  }
  // Check for unpaid invoice linked to this service via orders
  const [unpaidInvoice] = await db
    .select({ id: invoicesTable.id })
    .from(invoicesTable)
    .innerJoin(ordersTable, eq(ordersTable.id, invoicesTable.orderId))
    .where(and(eq(ordersTable.itemId, service.id), eq(invoicesTable.status, "unpaid")))
    .limit(1);
  if (unpaidInvoice) {
    return { canManage: false, manageLockReason: "Management disabled. Please pay your unpaid invoice to restore access." };
  }
  return { canManage: true, manageLockReason: null };
}

/**
 * Batch-compute manageability for multiple services (avoids N+1 for the list endpoint).
 */
async function bulkCanManageHostingServices(
  services: (typeof hostingServicesTable.$inferSelect)[],
): Promise<Map<string, { canManage: boolean; manageLockReason: string | null }>> {
  const BLOCKED_STATUSES = new Set(["pending", "suspended", "terminated", "pending_termination", "cancelled"]);
  const result = new Map<string, { canManage: boolean; manageLockReason: string | null }>();

  // Determine status-blocked services up front
  const activeServices = services.filter(s => !BLOCKED_STATUSES.has(s.status as string));
  for (const s of services) {
    if (BLOCKED_STATUSES.has(s.status as string)) {
      result.set(s.id, { canManage: false, manageLockReason: `Management disabled. Service is ${s.status}. Please pay your invoice or contact support.` });
    }
  }

  // Check due date for non-blocked services
  const dueDateBlocked = new Set<string>();
  for (const s of activeServices) {
    if (s.nextDueDate) {
      const msOverdue = Date.now() - new Date(s.nextDueDate).getTime();
      if (msOverdue > 24 * 60 * 60 * 1000) {
        result.set(s.id, { canManage: false, manageLockReason: "Management disabled. Service renewal is overdue by more than 1 day. Please renew to restore access." });
        dueDateBlocked.add(s.id);
      }
    }
  }

  // Check unpaid invoices for remaining services in one query
  const remainingIds = activeServices.filter(s => !dueDateBlocked.has(s.id)).map(s => s.id);
  if (remainingIds.length > 0) {
    const unpaidRows = await db
      .select({ itemId: ordersTable.itemId })
      .from(invoicesTable)
      .innerJoin(ordersTable, eq(ordersTable.id, invoicesTable.orderId))
      .where(and(inArray(ordersTable.itemId, remainingIds), eq(invoicesTable.status, "unpaid")));
    const unpaidServiceIds = new Set(unpaidRows.map(r => r.itemId).filter(Boolean));
    for (const s of activeServices) {
      if (!result.has(s.id)) {
        if (unpaidServiceIds.has(s.id)) {
          result.set(s.id, { canManage: false, manageLockReason: "Management disabled. Please pay your unpaid invoice to restore access." });
        } else {
          result.set(s.id, { canManage: true, manageLockReason: null });
        }
      }
    }
  }

  return result;
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
router.get("/admin/hosting", authenticate, requireAdmin, async (req, res) => {
  try {
    const page    = Math.max(1, parseInt(String((req as any).query.page  || "1"), 10));
    const limit   = Math.min(200, Math.max(1, parseInt(String((req as any).query.limit || "50"), 10)));
    const offset  = (page - 1) * limit;
    const search  = String((req as any).query.search || "").trim();
    const status  = String((req as any).query.status || "all").trim();

    // Build where conditions in raw SQL for cross-table search without a JOIN
    const whereConditions: any[] = [];
    if (status !== "all") whereConditions.push(eq(hostingServicesTable.status, status));
    if (search) {
      whereConditions.push(
        or(
          ilike(hostingServicesTable.domain, `%${search}%`),
          ilike(hostingServicesTable.planName, `%${search}%`),
          ilike(hostingServicesTable.username, `%${search}%`),
        )
      );
    }

    const where = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const [rows, totalResult] = await Promise.all([
      db.select().from(hostingServicesTable)
        .where(where)
        .orderBy(desc(hostingServicesTable.createdAt))
        .limit(limit).offset(offset),
      db.select({ cnt: count() }).from(hostingServicesTable).where(where),
    ]);

    const total = Number(totalResult[0]?.cnt ?? 0);
    const totalPages = Math.ceil(total / limit);

    // Batch-load users for this page only
    const clientIds = [...new Set(rows.map(r => r.clientId).filter(Boolean))];
    const users = clientIds.length
      ? await db.select().from(usersTable).where(inArray(usersTable.id, clientIds as string[]))
      : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    const data = rows.map(s => {
      const user = userMap.get(s.clientId ?? "");
      return {
        ...formatService(s, user ? `${user.firstName} ${user.lastName}` : ""),
        stackUserId: user?.stackUserId ?? null,
      };
    });

    res.json({ data, total, page, limit, totalPages });
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
          await twentyiSuspend(decryptField(server.apiToken ?? ""), service.username);
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
          await twentyiUnsuspend(decryptField(server.apiToken ?? ""), service.username);
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
          await twentyiDelete(decryptField(server.apiToken ?? ""), service.username);
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

    // Termination email (non-blocking)
    const [serviceUser] = await db.select().from(usersTable).where(eq(usersTable.id, service.clientId!)).limit(1);
    if (serviceUser) {
      emailServiceTerminated(serviceUser.email, {
        clientName: `${serviceUser.firstName} ${serviceUser.lastName}`,
        domain: service.domain || service.username || "your service",
        serviceName: service.planName || "Hosting Service",
        terminationDate: new Date().toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" }),
      }, { clientId: serviceUser.id, referenceId: service.id }).catch(console.warn);
    }

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
    const allowed = ["status", "cancelRequested", "nextDueDate", "billingCycle", "sslStatus", "username", "domain", "serverId", "serverIp", "cpanelUrl", "webmailUrl", "amount", "startDate", "expiryDate", "freeDomainAvailable"];
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
      ns1: server?.ns1 || "ns1.noehost.com",
      ns2: server?.ns2 || "ns2.noehost.com",
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
          await twentyiDelete(decryptField(server.apiToken ?? ""), service.username);
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
      await twentyiInstallSSL(decryptField(server.apiToken ?? ""), service.username, service.domain);
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
          await twentyiInstallSSL(decryptField(server.apiToken ?? ""), service.username, service.domain);
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
    // Universal management lock check
    const { canManage, manageLockReason } = await canManageHostingService(service);
    if (!canManage) {
      return res.status(403).json({ error: manageLockReason || "Management is currently disabled for this service." });
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
      if (service_name === "webmaild") {
        const webmailUrl = service.webmailUrl || (service.domain ? `https://webmail.${service.domain}` : null);
        if (!webmailUrl) return res.status(400).json({ error: "No webmail URL for this service." });
        return res.json({ url: webmailUrl });
      }
      if (!server.apiToken) {
        const fallback = service.cpanelUrl || twentyiStackCPUrl();
        return res.json({ url: fallback });
      }
      // Fetch stackUserId for SSO — prefer per-user loginToken
      const [svcUser] = await db.select({ stackUserId: usersTable.stackUserId })
        .from(usersTable).where(eq(usersTable.id, service.clientId ?? "")).limit(1);
      const stackUserId = svcUser?.stackUserId ?? null;
      const ssoResult = await twentyiGetSSOUrl(decryptField(server.apiToken ?? ""), service.username, stackUserId);
      if (ssoResult.ssoAvailable && ssoResult.url) return res.json({ url: ssoResult.url });
      const fallback = service.cpanelUrl || twentyiStackCPUrl();
      return res.json({ url: fallback, ssoAvailable: false });
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

// ── SSO Deep-Link Launch ───────────────────────────────────────────────────────
// Paths are relative to the cpsess session root, supporting both paper_lantern and Jupiter themes.
// Jupiter (cPanel >= 96) maps paper_lantern paths automatically via redirect.
const CPANEL_DEEP_LINKS: Record<string, { service: "cpaneld" | "webmaild"; paths: string[] }> = {
  cpanel:      { service: "cpaneld",  paths: ["/"] },
  filemanager: { service: "cpaneld",  paths: ["/frontend/paper_lantern/filemanager/index.html", "/frontend/jupiter/filemanager/index.html"] },
  databases:   { service: "cpaneld",  paths: ["/frontend/paper_lantern/sql/index.html", "/frontend/paper_lantern/sql/phpMyAdmin.html", "/frontend/jupiter/mysql/index.html"] },
  php:         { service: "cpaneld",  paths: ["/frontend/paper_lantern/multiphp_manager/index.html", "/frontend/paper_lantern/php_config/index.html", "/frontend/jupiter/php_config/index.html"] },
  cronjobs:    { service: "cpaneld",  paths: ["/frontend/paper_lantern/cron/index.html", "/frontend/jupiter/cron/index.html"] },
  email:       { service: "cpaneld",  paths: ["/frontend/paper_lantern/mail/accounts.html", "/frontend/paper_lantern/mail/index.html", "/frontend/jupiter/email/index.html"] },
  webmail:     { service: "webmaild", paths: ["/"] },
};

/** Extract the base cPanel session URL (strips everything after /cpsessXXXXXX) */
function extractCpanelBase(sessionUrl: string): string {
  const m = sessionUrl.match(/^(https?:\/\/[^\/]+(?::\d+)?\/cpsess[A-Za-z0-9]+)/);
  return m ? m[1] : sessionUrl.replace(/\/+$/, "");
}

router.post("/client/hosting/:id/sso-launch", authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const target: string = (req.body as any)?.target || "cpanel";
    const link = CPANEL_DEEP_LINKS[target] ?? CPANEL_DEEP_LINKS.cpanel;

    const [service] = await db.select().from(hostingServicesTable)
      .where(eq(hostingServicesTable.id, id)).limit(1);
    if (!service || service.clientId !== req.user!.userId) {
      return res.status(404).json({ error: "Service not found" });
    }
    const { canManage, manageLockReason } = await canManageHostingService(service);
    if (!canManage) {
      return res.status(403).json({ error: manageLockReason || "Management is currently disabled for this service." });
    }
    if (!service.username) {
      return res.status(400).json({ error: "No cPanel username linked to this service. Please contact support." });
    }

    const server = await resolveServerForService(service);
    if (!server) {
      const fallback = link.service === "webmaild" ? service.webmailUrl : service.cpanelUrl;
      if (fallback) return res.json({ url: fallback });
      return res.status(400).json({ error: "No server found. Contact support or add an active server in Admin → Servers." });
    }

    // 20i (StackCP): generate a temporary one-click SSO autologin URL
    if (server.type === "20i") {
      if (link.service === "webmaild") {
        const webmailUrl = service.webmailUrl || (service.domain ? `https://webmail.${service.domain}` : null);
        if (!webmailUrl) return res.status(400).json({ error: "No webmail URL found for this service." });
        return res.json({ url: webmailUrl });
      }
      if (!service.username || !server.apiToken) {
        const fallback = service.cpanelUrl || twentyiStackCPUrl();
        if (fallback) return res.json({ url: fallback });
        return res.status(400).json({ error: "No 20i site ID linked to this service. Please contact support." });
      }
      // Fetch the client's stackUserId (preferred SSO method — per-user loginToken)
      const [svcUser] = await db.select({ stackUserId: usersTable.stackUserId })
        .from(usersTable).where(eq(usersTable.id, service.clientId ?? "")).limit(1);
      const stackUserId = svcUser?.stackUserId ?? null;
      // Generate a fresh autologin URL — tries stackUser loginToken first, falls back to package userToken
      const ssoResult = await twentyiGetSSOUrl(decryptField(server.apiToken ?? ""), service.username, stackUserId);
      console.log(`[SSO-LAUNCH] 20i SSO siteId=${service.username} stackUser=${stackUserId ?? "none"} → ${JSON.stringify(ssoResult)}`);
      if (ssoResult.ssoAvailable && ssoResult.url) {
        return res.json({ url: ssoResult.url });
      }
      const fallback = service.cpanelUrl || twentyiStackCPUrl();
      return res.json({ url: fallback, ssoAvailable: false });
    }

    const serverCfg = {
      hostname: server.hostname,
      port: server.apiPort || 2087,
      username: server.apiUsername || "root",
      apiToken: server.apiToken!,
    };

    // Run path probe + session generation in parallel to minimise latency
    const cpanelPort = server.apiPort ? server.apiPort - 4 : 2083; // WHM is 2087, cPanel is 2083
    const [sessionUrl, validPath] = await Promise.all([
      cpanelCreateUserSession(serverCfg, service.username, link.service),
      link.paths[0] === "/" ? Promise.resolve("/") : probeCpanelPaths(server.hostname, cpanelPort, link.paths, 4000),
    ]);

    const primaryPath = validPath ?? "/";

    let deepUrl: string;
    if (primaryPath === "/") {
      deepUrl = sessionUrl;
    } else if (sessionUrl.includes("/login/?session=") || sessionUrl.includes("/login?session=")) {
      deepUrl = sessionUrl + "&goto_uri=" + encodeURIComponent(primaryPath);
    } else {
      const baseUrl = extractCpanelBase(sessionUrl);
      deepUrl = baseUrl + primaryPath;
    }

    console.log(`[SSO-LAUNCH] target=${target} user=${service.username} probed=${validPath ?? "none"} deepUrl=${deepUrl}`);

    return res.json({ url: deepUrl, fallbackUrl: sessionUrl, target });
  } catch (err: any) {
    const msg: string = err.message || "SSO launch failed";
    console.warn(`[SSO-LAUNCH] ${(req.body as any)?.target} failed for service ${req.params.id}: ${msg}`);
    // Return 400 instead of 500 so the frontend shows a clean toast (not a browser 404)
    return res.status(400).json({ error: `Unable to connect to server. ${msg}` });
  }
});

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
      if (service_name === "webmaild") {
        const webmailUrl = service.webmailUrl || (service.domain ? `https://webmail.${service.domain}` : null);
        if (!webmailUrl) return res.status(400).json({ error: "No webmail URL for this service." });
        return res.json({ url: webmailUrl });
      }
      if (!server.apiToken) {
        const fallback = service.cpanelUrl || twentyiStackCPUrl();
        return res.json({ url: fallback });
      }
      // Fetch stackUserId for SSO — prefer per-user loginToken
      const [svcUser] = await db.select({ stackUserId: usersTable.stackUserId })
        .from(usersTable).where(eq(usersTable.id, service.clientId ?? "")).limit(1);
      const stackUserId = svcUser?.stackUserId ?? null;
      const ssoResult = await twentyiGetSSOUrl(decryptField(server.apiToken ?? ""), service.username, stackUserId);
      if (ssoResult.ssoAvailable && ssoResult.url) return res.json({ url: ssoResult.url });
      const fallback = service.cpanelUrl || twentyiStackCPUrl();
      return res.json({ url: fallback, ssoAvailable: false });
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

    const apiKey = decryptField(server.apiToken ?? "");
    const cacheKey = `20i:packages:${server.id}`;
    const packages = await cachedFetch(cacheKey, () => twentyiGetPackages(apiKey), 10 * 60 * 1000);
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

    const apiKey = (req.body?.apiKey as string) || decryptField(server.apiToken ?? "");
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
    const manageMap = await bulkCanManageHostingServices(services);
    res.json(services.map(s => formatService(s, user ? `${user.firstName} ${user.lastName}` : "", manageMap.get(s.id))));
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
    const manage = await canManageHostingService(service);
    return res.json(formatService(service, user ? `${user.firstName} ${user.lastName}` : "", manage));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Client: get free domain info for a service (allowed TLDs, plan name)
router.get("/client/hosting/:id/free-domain-info", authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const [service] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, id), eq(hostingServicesTable.clientId, req.user!.userId)))
      .limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });
    if (!service.freeDomainAvailable) return res.status(400).json({ error: "No free domain available for this service" });

    const [plan] = service.planId
      ? await db.select().from(hostingPlansTable).where(eq(hostingPlansTable.id, service.planId)).limit(1)
      : [null];

    const allowedTlds: string[] = (plan?.freeDomainTlds && plan.freeDomainTlds.length > 0)
      ? plan.freeDomainTlds.map(t => t.startsWith(".") ? t : `.${t}`)
      : [".com", ".net", ".org"];

    return res.json({
      serviceId: service.id,
      planName: service.planName,
      allowedTlds,
      freeDomainAvailable: service.freeDomainAvailable,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Client: register & claim the free domain for a service
router.post("/client/hosting/:id/claim-free-domain", authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { domain } = req.body as { domain: string };

    if (!domain || !domain.includes(".")) {
      return res.status(400).json({ error: "A valid domain name is required (e.g. mybusiness.com)" });
    }

    const [service] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, id), eq(hostingServicesTable.clientId, req.user!.userId)))
      .limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });
    if (!service.freeDomainAvailable) {
      return res.status(400).json({ error: "No free domain available for this service" });
    }

    const dotIdx = domain.indexOf(".");
    const dName = domain.slice(0, dotIdx).toLowerCase().trim();
    const dTld  = domain.slice(dotIdx).toLowerCase().trim();

    if (!dName || !dTld) {
      return res.status(400).json({ error: "Invalid domain format" });
    }

    // Validate TLD is in the plan's allowed list
    const [plan] = service.planId
      ? await db.select().from(hostingPlansTable).where(eq(hostingPlansTable.id, service.planId)).limit(1)
      : [null];

    const allowedTlds: string[] = (plan?.freeDomainTlds && plan.freeDomainTlds.length > 0)
      ? plan.freeDomainTlds.map(t => (t.startsWith(".") ? t : `.${t}`).toLowerCase())
      : [".com", ".net", ".org"];

    if (!allowedTlds.includes(dTld)) {
      return res.status(400).json({ error: `TLD "${dTld}" is not eligible for a free domain on this plan. Allowed: ${allowedTlds.join(", ")}` });
    }

    // Ensure domain isn't already registered in our system
    const [existing] = await db.select({ id: domainsTable.id })
      .from(domainsTable)
      .where(and(eq(domainsTable.name, dName), eq(domainsTable.tld, dTld)))
      .limit(1);
    if (existing) {
      return res.status(409).json({ error: "This domain is already registered in our system." });
    }

    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    // Create domain record
    const [newDomain] = await db.insert(domainsTable).values({
      clientId: req.user!.userId,
      name: dName,
      tld: dTld,
      registrar: service.twentyIPackageId ? "20i" : "pending",
      registrationDate: new Date(),
      expiryDate,
      nextDueDate: expiryDate,
      status: "pending_activation",
      lockStatus: "unlocked",
      autoRenew: true,
      isFreeDomain: true,
      nameservers: [],
    }).returning();

    // Link domain to service + clear free domain flag
    await db.update(hostingServicesTable)
      .set({
        freeDomainAvailable: false,
        freeDomainId: newDomain.id,
        ...(service.domain ? {} : { domain: `${dName}${dTld}` }),
        updatedAt: new Date(),
      })
      .where(eq(hostingServicesTable.id, id));

    return res.json({
      ok: true,
      domainId: newDomain.id,
      domain: `${dName}${dTld}`,
      message: "Domain successfully claimed! It will be activated within a few minutes.",
    });
  } catch (err) {
    console.error("[CLAIM-FREE-DOMAIN]", err);
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

// Client: request renewal (creates order + invoice; supports promo code)
router.post("/client/hosting/:id/renew", authenticate, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { id } = req.params;
    const { promoCode } = req.body || {};
    const [service] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, id), eq(hostingServicesTable.clientId, clientId)))
      .limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });
    if (service.status === "terminated") return res.status(400).json({ error: "Cannot renew a terminated service" });

    const [plan] = await db.select().from(hostingPlansTable)
      .where(eq(hostingPlansTable.id, service.planId)).limit(1);
    const billingCycle = service.billingCycle || "monthly";

    const baseAmount = plan ? getRenewalAmount(plan, billingCycle) : 0;
    let amount = baseAmount;
    let discountAmount = 0;
    let appliedPromo: string | null = null;

    // Apply promo code if provided
    if (promoCode) {
      const [promo] = await db.select().from(promoCodesTable)
        .where(eq(promoCodesTable.code, promoCode.toUpperCase())).limit(1);
      if (
        promo && promo.isActive &&
        (!promo.usageLimit || promo.usedCount < promo.usageLimit) &&
        (!promo.expiresAt || new Date() < promo.expiresAt)
      ) {
        const at = (promo as any).applicableTo ?? "all";
        if (at === "all" || at === "hosting") {
          discountAmount = Number((amount * promo.discountPercent / 100).toFixed(2));
          amount = Math.max(0, Number((amount - discountAmount).toFixed(2)));
          appliedPromo = promo.code;
          await db.update(promoCodesTable).set({ usedCount: promo.usedCount + 1 }).where(eq(promoCodesTable.id, promo.id));
        }
      }
    }

    console.log("RENEW DEBUG:", { service: service.planName, domain: service.domain, baseAmount, discount: discountAmount, finalAmount: amount, promo: appliedPromo });

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
      items: [
        { description: `Renewal: ${service.planName} (${billingCycle})`, quantity: 1, unitPrice: baseAmount, total: baseAmount },
        ...(discountAmount > 0 ? [{ description: `Promo: ${appliedPromo}`, quantity: 1, unitPrice: -discountAmount, total: -discountAmount }] : []),
      ],
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
      notes: `Renewal for service ${service.id}${appliedPromo ? ` (promo: ${appliedPromo})` : ""}`,
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
    const { canManage, manageLockReason } = await canManageHostingService(service);
    if (!canManage) return res.status(403).json({ error: manageLockReason || "Management is currently disabled for this service." });

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

// ─── GET /client/hosting/:id/usage — real cPanel disk & bandwidth via WHM accountsummary ───
router.get("/client/hosting/:id/usage", authenticate, async (req: AuthRequest, res) => {
  function fmtMB(mb: number): string {
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${Math.round(mb)} MB`;
  }

  try {
    const clientId = req.user!.userId;
    const { id } = req.params;
    const [service] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, id), eq(hostingServicesTable.clientId, clientId))).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });

    if (!service.serverId || !service.username) {
      return res.json({ source: "none", diskUsed: null, diskPct: 0, bwUsed: null, bwPct: 0, diskUnlimited: false, bwUnlimited: false });
    }

    const [server] = await db.select().from(serversTable).where(eq(serversTable.id, service.serverId)).limit(1);
    if (!server || (server.type !== "cpanel" && server.type !== "whm")) {
      return res.json({ source: "none", diskUsed: null, diskPct: 0, bwUsed: null, bwPct: 0, diskUnlimited: false, bwUnlimited: false });
    }

    const serverCfg = toServerCfg(server);
    const {
      diskUsedMB, diskLimitMB, diskUnlimited,
      bwUsedMB, bwLimitMB, bwUnlimited,
    } = await cpanelGetLiveUsage(serverCfg, service.username);

    // Percentage: 0 if limit is unlimited OR limit is 0
    const diskPct = (!diskUnlimited && diskLimitMB > 0) ? Math.min(100, Math.round((diskUsedMB / diskLimitMB) * 100)) : 0;
    const bwPct   = (!bwUnlimited   && bwLimitMB   > 0) ? Math.min(100, Math.round((bwUsedMB   / bwLimitMB)   * 100)) : 0;

    // Also persist snapshot to the service record for offline display
    const diskUsedFmt = fmtMB(diskUsedMB);
    const bwUsedFmt   = fmtMB(bwUsedMB);
    db.update(hostingServicesTable).set({
      diskUsed: diskUsedFmt,
      bandwidthUsed: bwUsedFmt,
      updatedAt: new Date(),
    }).where(eq(hostingServicesTable.id, id)).catch(() => {});

    res.json({
      source: "cpanel",
      diskUsed: diskUsedFmt,
      diskLimit: diskUnlimited ? "Unlimited" : fmtMB(diskLimitMB),
      diskPct,
      diskUnlimited,
      bwUsed: bwUsedFmt,
      bwLimit: bwUnlimited ? "Unlimited" : fmtMB(bwLimitMB),
      bwPct,
      bwUnlimited,
    });
  } catch (err: any) {
    console.warn("[CLIENT] usage fetch error (non-fatal):", err.message);
    // Try to return last-known values from DB on error
    try {
      const [service] = await db.select({ diskUsed: hostingServicesTable.diskUsed, bandwidthUsed: hostingServicesTable.bandwidthUsed })
        .from(hostingServicesTable).where(eq(hostingServicesTable.id, req.params.id)).limit(1);
      if (service?.diskUsed) {
        return res.json({ source: "cached", diskUsed: service.diskUsed, diskPct: 0, bwUsed: service.bandwidthUsed, bwPct: 0, diskUnlimited: false, bwUnlimited: false });
      }
    } catch { /* ignore */ }
    res.json({ source: "error", diskUsed: null, diskPct: 0, bwUsed: null, bwPct: 0, diskUnlimited: false, bwUnlimited: false });
  }
});

// WordPress auto-installer (admin-triggered)
router.post("/admin/hosting/:id/install-wordpress", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { adminUser, adminPassword, adminEmail, siteName = "My WordPress Site", installPath = "/" } = req.body;
    const [service] = await db.select().from(hostingServicesTable).where(eq(hostingServicesTable.id, id)).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });
    if (!service.domain) return res.status(400).json({ error: "Service has no domain" });
    if (service.wpProvisionStatus === "provisioning" || service.wpProvisionStatus === "queued") {
      return res.status(409).json({ error: "WordPress installation is already in progress" });
    }

    const wpUser = adminUser?.trim() || generateWpUsername(service.domain);
    const wpPass = adminPassword?.trim() || generateWpPassword();
    const wpEmail = adminEmail?.trim() || `admin@${service.domain}`;

    await db.update(hostingServicesTable).set({
      wpProvisionStatus: "queued",
      wpProvisionStep: "Queued",
      wpProvisionError: null,
      wpInstalled: false,
      wpUsername: wpUser,
      wpPassword: wpPass,
      wpEmail: wpEmail,
      wpSiteTitle: siteName,
      wpInstallPath: installPath,
      updatedAt: new Date(),
    }).where(eq(hostingServicesTable.id, id));

    provisionWordPress(id, service.domain, siteName, wpUser, wpPass, wpEmail, installPath)
      .catch(err => console.error("[WP] Admin provisioner threw:", err));

    const wpLoginUrl = `https://${service.domain}${installPath === "/" ? "" : installPath}/wp-admin`;
    res.json({
      success: true,
      queued: true,
      credentials: { username: wpUser, password: wpPass, email: wpEmail, loginUrl: wpLoginUrl, siteName },
      message: "WordPress installation started on VPS. Poll /client/hosting/:id/wordpress-status for progress.",
    });
  } catch (err) {
    console.error("[ADMIN] install-wordpress error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /client/hosting/:id/wordpress-check — detect if WP is installed (filesystem check)
router.get("/client/hosting/:id/wordpress-check", authenticate, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const [service] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, req.params.id!), eq(hostingServicesTable.clientId, clientId))).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });

    const installPath = service.wpInstallPath ?? "/";
    const dbInstalled = service.wpInstalled ?? false;
    const fileExists = service.domain
      ? await checkWordPressInstalled(service.domain, installPath)
      : dbInstalled;

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

// ── List all cPanel domains + docroots for the domain dropdown ────────────────
// Uses DomainInfo::domains_data UAPI call; falls back to just the primary domain.
router.get("/client/hosting/:id/domains", authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user!.userId;

    const [service] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, id), eq(hostingServicesTable.clientId, clientId))).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });
    if (!service.username) return res.status(400).json({ error: "No cPanel username linked to this service." });

    const server = await resolveServerForService(service);
    if (!server || !server.apiToken) {
      return res.json({ domains: [{ domain: service.domain, docroot: `/home/${service.username}/public_html`, type: "main" }] });
    }

    const serverCfg = { hostname: server.hostname, port: server.apiPort || 2087, username: server.apiUsername || "root", apiToken: server.apiToken! };

    try {
      const data = await cpanelUapi(serverCfg, service.username, "DomainInfo", "domains_data", {});
      const list: any[] = Array.isArray(data) ? data : (data?.domains_data ?? data?.data ?? []);
      if (list.length > 0) {
        const domains = list.map((d: any) => ({
          domain:  d.domain,
          docroot: d.docroot ?? d.document_root ?? `/home/${service.username}/public_html`,
          type:    d.type ?? "addon",
        }));
        return res.json({ domains });
      }
    } catch (uapiErr: any) {
      console.warn(`[DOMAINS] DomainInfo::domains_data failed: ${uapiErr.message} — falling back`);
    }

    // Fallback: list_domains gives sub/addon/parked domain names without docroots
    try {
      const data = await cpanelUapi(serverCfg, service.username, "DomainInfo", "list_domains", {});
      const mainDomain  = data?.main_domain  ?? service.domain;
      const subDomains: string[]   = data?.sub_domains   ?? [];
      const addonDomains: string[] = data?.addon_domains  ?? [];

      const domains = [
        { domain: mainDomain, docroot: `/home/${service.username}/public_html`, type: "main" },
        ...subDomains.map((d: string) => {
          // Subdomain prefix is the part before the root domain
          const prefix = d.replace(`.${mainDomain}`, "").replace(`.${service.domain}`, "");
          return { domain: d, docroot: `/home/${service.username}/public_html/${prefix}`, type: "sub" };
        }),
        ...addonDomains.map((d: string) => ({
          domain: d, docroot: `/home/${service.username}/public_html`, type: "addon",
        })),
      ];
      return res.json({ domains });
    } catch (listErr: any) {
      console.warn(`[DOMAINS] list_domains failed: ${listErr.message}`);
    }

    // Final fallback: just the primary domain
    return res.json({ domains: [{ domain: service.domain, docroot: `/home/${service.username}/public_html`, type: "main" }] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to list domains" });
  }
});

// ── Guided Install: generate Softaculous WordPress URL (opens in new tab) ─────
// Prefers the bypass-login URL (no session needed, never expires).
// Falls back to WHM session-based URL only if no password is stored.
router.post("/client/hosting/:id/wp-softaculous-url", authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user!.userId;

    const [service] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, id), eq(hostingServicesTable.clientId, clientId))).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });
    if (!service.username) return res.status(400).json({ error: "No cPanel username linked to this service." });

    const server = await resolveServerForService(service);
    if (!server) return res.status(400).json({ error: "No cPanel server found. Contact support." });

    const { domain: targetDomain } = req.body as { domain?: string };
    const useDomain = targetDomain || service.domain;

    // ── FIRST: bypass-login URL — no session, no expiry, works even without WHM API token ──
    if (service.password) {
      const gotoUri = `softaculous/index.php?act=software&soft=26&softdomain=${encodeURIComponent(useDomain)}`;
      const url = `https://${server.hostname}:2083/login/?user=${encodeURIComponent(service.username)}&pass=${encodeURIComponent(service.password)}&goto_uri=${encodeURIComponent(gotoUri)}`;
      console.log(`[WP-SOFTACULOUS-URL] Bypass-login URL for service ${id} domain=${useDomain}`);
      return res.json({ url });
    }

    // ── FALLBACK: WHM session URL (requires API token, URL may expire) ──
    if (!server.apiToken) {
      const base = service.cpanelUrl ?? `https://${server.hostname}:2083`;
      console.warn(`[WP-SOFTACULOUS-URL] No password or API token — returning base cPanel URL for service ${id}`);
      return res.json({ url: base, fallback: true });
    }
    const serverCfg = { hostname: server.hostname, port: server.apiPort || 2087, username: server.apiUsername || "root", apiToken: server.apiToken! };
    const url = await cpanelGetSoftaculousInstallUrl(serverCfg, service.username, useDomain);
    console.log(`[WP-SOFTACULOUS-URL] Session URL for service ${id} domain=${useDomain}`);
    return res.json({ url });
  } catch (err: any) {
    const msg = err.message || "Failed to generate Softaculous URL";
    console.error(`[WP-SOFTACULOUS-URL] ${msg}`);
    return res.status(500).json({ error: msg });
  }
});

// ── Detect WordPress installation via Fileman::stat on port 2083 ─────────────
// Uses cPanel direct API (Basic Auth with user:password) so it works even when
// WHM UAPI proxy returns "No data returned from cPanel Service".
// NEVER returns 500 — always returns { installed: false } on any API failure.
router.post("/client/hosting/:id/wp-detect", authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const clientId = req.user!.userId;
  const { domain: targetDomain } = req.body as { domain?: string };

  // Resolve service
  const [service] = await db.select().from(hostingServicesTable)
    .where(and(eq(hostingServicesTable.id, id), eq(hostingServicesTable.clientId, clientId))).limit(1);
  if (!service) return res.status(404).json({ error: "Service not found" });
  if (!service.username) return res.json({ installed: false, error: "No cPanel username configured." });

  const server = await resolveServerForService(service);
  if (!server) return res.json({ installed: false, error: "No cPanel server configured." });

  // Derive the docroot for the selected domain
  const checkDomain  = targetDomain || service.domain;
  const isMainDomain = checkDomain === service.domain;
  let docroot = `/home/${service.username}/public_html`;
  if (!isMainDomain) {
    const prefix = checkDomain.replace(`.${service.domain}`, "");
    if (prefix && prefix !== checkDomain) {
      docroot = `/home/${service.username}/public_html/${prefix}`;
    }
  }
  const wpConfigPath = `${docroot}/wp-config.php`;

  // ── Strategy 1: cPanel direct API (port 2083, Basic Auth) ─────────────────
  if (service.password) {
    const installed = await cpanelFileExists(server.hostname, service.username, service.password, wpConfigPath);
    console.log(`[WP-DETECT] Fileman::stat (direct) — ${wpConfigPath} found: ${installed}`);
    if (installed) {
      await db.update(hostingServicesTable).set({
        wpInstalled:       true,
        wpProvisionStatus: "active",
        wpProvisionStep:   "Completed",
        wpProvisionError:  null,
        wpUrl:             `https://${checkDomain}/wp-admin`,
        wpInstallPath:     "/",
        wpProvisionedAt:   new Date(),
        updatedAt:         new Date(),
      }).where(eq(hostingServicesTable.id, id));
      console.log(`[WP-DETECT] Marked active for service ${id} (${checkDomain})`);
    }
    return res.json({ installed, checkedPath: wpConfigPath, domain: checkDomain });
  }

  // ── Strategy 2: WHM UAPI proxy (Fileman::list_files) ──────────────────────
  if (server.apiToken) {
    try {
      const serverCfg = { hostname: server.hostname, port: server.apiPort || 2087, username: server.apiUsername || "root", apiToken: server.apiToken! };
      const data = await cpanelUapi(serverCfg, service.username, "Fileman", "list_files", { dir: docroot, include_mime: "0" });
      const files: any[] = Array.isArray(data) ? data : (data?.files ?? []);
      const installed = files.some((f: any) => f.file === "wp-config.php" || f.name === "wp-config.php" || f.path === "wp-config.php");
      console.log(`[WP-DETECT] WHM Fileman::list_files — ${files.length} files, wp-config.php found: ${installed}`);
      if (installed) {
        await db.update(hostingServicesTable).set({
          wpInstalled:       true,
          wpProvisionStatus: "active",
          wpProvisionStep:   "Completed",
          wpProvisionError:  null,
          wpUrl:             `https://${checkDomain}/wp-admin`,
          wpInstallPath:     "/",
          wpProvisionedAt:   new Date(),
          updatedAt:         new Date(),
        }).where(eq(hostingServicesTable.id, id));
      }
      return res.json({ installed, checkedPath: wpConfigPath, domain: checkDomain });
    } catch (e: any) {
      console.warn(`[WP-DETECT] WHM Fileman fallback failed: ${e.message} — returning installed:false`);
    }
  }

  // ── All strategies exhausted — return false (never 500) ───────────────────
  return res.json({ installed: false, checkedPath: wpConfigPath, domain: checkDomain });
});

// ── Get WordPress admin URL — Softaculous bypass-login SSO or direct ────────
// Tries Softaculous sign_as (one-click) using the bypass-login URL + insid.
// Falls back to direct /wp-admin via bypass-login. Never returns 500.
router.post("/client/hosting/:id/wp-admin-url", authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user!.userId;

    const [service] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, id), eq(hostingServicesTable.clientId, clientId))).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });
    if (!service.username) return res.status(400).json({ error: "No cPanel username linked to this service." });

    const { domain: targetDomain } = req.body as { domain?: string };
    const lookupDomain = targetDomain || service.domain;
    const server = await resolveServerForService(service);

    // Helper: build bypass-login URL for any goto_uri
    const bypassLogin = (gotoUri: string) =>
      `https://${server!.hostname}:2083/login/?user=${encodeURIComponent(service.username!)}&pass=${encodeURIComponent(service.password!)}&goto_uri=${encodeURIComponent(gotoUri)}`;

    // ── If password is available, use bypass-login approach ──────────────────
    if (service.password && server) {
      // Try to get the Softaculous insid for SSO
      if (server.apiToken) {
        const serverCfg = { hostname: server.hostname, port: server.apiPort || 2087, username: server.apiUsername || "root", apiToken: server.apiToken! };
        const insid = await cpanelGetSoftaculousInsid(serverCfg, service.username, lookupDomain);
        if (insid) {
          const url = bypassLogin(`softaculous/index.php?act=sign_as&insid=${insid}`);
          console.log(`[WP-ADMIN-URL] Softaculous SSO bypass-login for service ${id} insid=${insid}`);
          return res.json({ url, method: "softaculous_sso" });
        }
      }
      // Fallback: direct wp-admin via bypass-login
      const url = bypassLogin(`${lookupDomain}/wp-admin/`);
      console.log(`[WP-ADMIN-URL] Direct /wp-admin bypass-login for service ${id}`);
      return res.json({ url, method: "direct" });
    }

    // ── No password stored — fall back to session-based SSO ──────────────────
    if (server?.apiToken) {
      const fallbackUrl = service.wpUrl || `https://${lookupDomain}/wp-admin`;
      const serverCfg = { hostname: server.hostname, port: server.apiPort || 2087, username: server.apiUsername || "root", apiToken: server.apiToken! };
      const result = await cpanelGetWpAdminUrl(serverCfg, service.username, lookupDomain, fallbackUrl);
      console.log(`[WP-ADMIN-URL] ${result.method} session URL for service ${id} domain=${lookupDomain}`);
      return res.json(result);
    }

    return res.json({ url: `https://${lookupDomain}/wp-admin`, method: "direct" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to get admin URL" });
  }
});

// ── Sitejet Builder SSO URL ────────────────────────────────────────────────
// Generates a one-click login URL directly to the cPanel Sitejet Builder.
// Accepts optional { domain } in the body so the builder opens for a specific domain.
router.post("/client/hosting/:id/sitejet-url", authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user!.userId;
    const { domain: targetDomain } = req.body as { domain?: string };

    const [service] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, id), eq(hostingServicesTable.clientId, clientId))).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });
    if (!service.username) return res.status(400).json({ error: "No cPanel username linked to this service." });

    const server = await resolveServerForService(service);
    if (!server) return res.status(400).json({ error: "No cPanel server found. Contact support." });

    const useDomain = targetDomain || service.domain;

    // ── FIRST: bypass-login URL — no session, no expiry, works even without WHM API token ──
    if (service.password) {
      const gotoUri = `sitejet/index.html`;
      const url = `https://${server.hostname}:2083/login/?user=${encodeURIComponent(service.username)}&pass=${encodeURIComponent(service.password)}&goto_uri=${encodeURIComponent(gotoUri)}`;
      console.log(`[SITEJET-URL] Bypass-login URL for service ${id} domain=${useDomain}`);
      return res.json({ url });
    }

    // ── FALLBACK: WHM session-based URL (requires API token, URL may expire) ──
    if (!server.apiToken) {
      const base = service.cpanelUrl ?? `https://${server.hostname}:2083`;
      console.warn(`[SITEJET-URL] No password or API token — returning base cPanel URL for service ${id}`);
      return res.json({ url: `${base}/frontend/paper_lantern/sitejet/index.html`, fallback: true });
    }
    const serverCfg = { hostname: server.hostname, port: server.apiPort || 2087, username: server.apiUsername || "root", apiToken: server.apiToken! };
    try {
      const loginUrl = await cpanelCreateUserSession(serverCfg, service.username, "cpaneld");
      const match = loginUrl.match(/(cpsess[A-Za-z0-9]+)/);
      if (!match) throw new Error("Could not extract cpsess token from cPanel login URL.");
      const cpsess = match[1];
      const url = `https://${server.hostname}:2083/${cpsess}/sitejet/index.html`;
      console.log(`[SITEJET-URL] Session URL for service ${id}`);
      return res.json({ url });
    } catch (sessionErr: any) {
      console.error(`[SITEJET-URL] Session creation failed: ${sessionErr.message}`);
      const base = service.cpanelUrl ?? `https://${server.hostname}:2083`;
      return res.json({ url: `${base}/frontend/paper_lantern/sitejet/index.html`, fallback: true });
    }
  } catch (err: any) {
    const msg = err.message || "Failed to generate Sitejet URL";
    console.error(`[SITEJET-URL] ${msg}`);
    return res.status(500).json({ error: msg });
  }
});

// POST /client/hosting/:id/install-wordpress
// Synchronous controller — awaits every step (DB creation, file extraction, wp-config write)
// before responding. Returns 200 + credentials on success, or the EXACT error on failure.
// The client-side polling loop (/wordpress-status) runs in parallel and drives the progress bar.
router.post("/client/hosting/:id/install-wordpress", authenticate, async (req: AuthRequest, res) => {
  // Extend socket timeout for this route to 5 minutes — WordPress download can take ~60 s on slow VPS
  res.socket?.setTimeout(300_000);

  try {
    const clientId = req.user!.userId;
    const { id } = req.params;
    const {
      siteTitle = "My WordPress Site",
      adminUsername,
      adminPassword,
      adminEmail,
      // Normalise: frontend sends "" for root (softdirectory:""), "/" also means root.
      // Both are treated identically — stored as "/" in the DB for consistency.
      installPath: rawInstallPath,
      cpanelApiToken,
      cpanelPassword,
    } = req.body;
    // Treat both "" and "/" as site root; any other value is a subdirectory path
    const installPath = (!rawInstallPath || rawInstallPath === "/") ? "/" : rawInstallPath;

    console.log(`[WP] Incoming install request for service ${id}:`, {
      siteTitle,
      adminUsername: adminUsername || "(auto-generate)",
      adminPassword: adminPassword ? "****" : "(auto-generate)",
      adminEmail: adminEmail || "(auto-generate)",
      installPath,
      cpanelApiToken: cpanelApiToken ? "provided" : "not provided",
    });

    const [service] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, id), eq(hostingServicesTable.clientId, clientId))).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });
    if (!service.domain) return res.status(400).json({ error: "Service has no domain configured" });
    if (service.status !== "active") return res.status(400).json({ error: "Service must be active to install WordPress" });
    if (service.wpProvisionStatus === "provisioning" || service.wpProvisionStatus === "queued") {
      return res.status(409).json({ error: "WordPress installation is already in progress" });
    }

    // Already installed — return existing credentials immediately
    if (service.wpInstalled && service.wpProvisionStatus === "active") {
      return res.status(409).json({
        error: "WordPress is already installed on this service.",
        alreadyInstalled: true,
        credentials: {
          loginUrl:  service.wpUrl,
          username:  service.wpUsername,
          siteTitle: service.wpSiteTitle,
        },
      });
    }

    // Use the values the client provided — only auto-generate when left blank
    const wpUser  = adminUsername?.trim() || generateWpUsername(service.domain);
    const wpPass  = adminPassword?.trim() || generateWpPassword();
    const wpEmail = adminEmail?.trim()    || `admin@${service.domain}`;

    console.log(`[WP] Install starting for service ${id} | domain=${service.domain} | user=${wpUser} | email=${wpEmail} | path=${installPath}`);

    // Write initial state so the polling endpoint sees "provisioning" immediately
    await db.update(hostingServicesTable).set({
      wpProvisionStatus: "queued",
      wpProvisionStep:   "Queued",
      wpProvisionError:  null,
      wpInstalled:       false,
      wpUsername:        wpUser,
      wpPassword:        wpPass,
      wpEmail:           wpEmail,
      wpSiteTitle:       siteTitle,
      wpInstallPath:     installPath,
      updatedAt:         new Date(),
    }).where(eq(hostingServicesTable.id, id));

    // ── Resolve cPanel server config (if this service is on a cPanel/WHM server) ──
    // Softaculous authenticates via the cPanel-level cpanelPassword or cpanelApiToken
    // (provided by the user in the request body), NOT via the WHM root API token stored
    // in the server record.  So we only require the server hostname here — apiToken is
    // NOT required for Softaculous to work.
    const wpServer = await resolveServerForService(service);
    const cpanelCfg = (wpServer && wpServer.type === "cpanel")
      ? {
          server:         toServerCfg(wpServer),
          cpanelUser:     service.username!,
          cpanelApiToken: cpanelApiToken?.trim()  || undefined,
          cpanelPassword: cpanelPassword?.trim()  || undefined,
        }
      : null;

    if (cpanelCfg) {
      console.log(`[WP] cPanel server resolved: ${wpServer!.hostname} / cPanel user: ${service.username} / auth: ${cpanelApiToken ? "API Token" : cpanelPassword ? "Password" : "none"}`);
    } else {
      console.log(`[WP] No cPanel server — using VPS-direct or simulation path`);
    }

    // ── SYNCHRONOUS PROVISION ─────────────────────────────────────────────────
    // provisionWordPress handles every real action:
    //   Path 1 (cPanel): UAPI DB creation → Softaculous or PHP bootstrapper → verify wp-config.php
    //   Path 2 (VPS):    Pre-flight → mkdir → download → extract → mysql2 DB → wp-config → verify
    //   Path 3 (Dev):    Simulation with step-by-step delays
    // It writes the final status (active | failed) + any error message to the DB
    // before returning.  We then re-read the row to build the response.
    const { insid } = await provisionWordPress(id, service.domain, siteTitle, wpUser, wpPass, wpEmail, installPath, cpanelCfg);

    // Re-read the updated row — provisionWordPress wrote the definitive state
    const [updated] = await db.select().from(hostingServicesTable)
      .where(eq(hostingServicesTable.id, id)).limit(1);

    if (!updated || updated.wpProvisionStatus === "failed") {
      // Return the EXACT error from Softaculous/provisioner — not a generic 500
      const errorMsg = (updated as any)?.wpProvisionError || "Installation failed — no further details available.";
      console.error(`[WP] Install returned failed status for ${id}: ${errorMsg}`);
      return res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }

    // ── All steps succeeded — return credentials ──────────────────────────────
    // insid is the Softaculous Installation ID (if installed via Softaculous).
    // The AI Website Builder button uses this to link directly to the WP admin.
    console.log(`[WP] Install completed successfully for ${id}${insid ? ` (Softaculous insid=${insid})` : ""}`);
    return res.json({
      success: true,
      installed: true,
      credentials: {
        loginUrl:    updated.wpUrl,
        username:    updated.wpUsername,
        password:    updated.wpPassword,
        email:       updated.wpEmail,
        siteTitle:   updated.wpSiteTitle,
        installPath: updated.wpInstallPath,
        dbName:      updated.wpDbName,
        ...(insid && { insid }),    // Softaculous Installation ID — use for AI Builder auto-login
      },
    });

  } catch (err: any) {
    const msg = err?.message || "Unexpected server error during WordPress installation";
    console.error("[CLIENT] install-wordpress unhandled error:", msg);
    return res.status(500).json({ error: msg });
  }
});

// POST /client/hosting/:id/reinstall-wordpress
// Synchronous — drops old DB/files, runs full provision, waits for completion,
// returns credentials on success or the exact error on failure.
router.post("/client/hosting/:id/reinstall-wordpress", authenticate, async (req: AuthRequest, res) => {
  res.socket?.setTimeout(300_000);

  try {
    const clientId = req.user!.userId;
    const { id } = req.params;
    const {
      siteTitle = "My WordPress Site",
      adminUsername,
      adminPassword,
      adminEmail,
      installPath = "/",
      cpanelApiToken: cpanelApiToken2,
      cpanelPassword: cpanelPassword2,
    } = req.body;

    const [service] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, id), eq(hostingServicesTable.clientId, clientId))).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });
    if (!service.domain) return res.status(400).json({ error: "Service has no domain" });
    if (service.status !== "active") return res.status(400).json({ error: "Service must be active" });
    if (service.wpProvisionStatus === "provisioning" || service.wpProvisionStatus === "queued") {
      return res.status(409).json({ error: "An installation is already in progress" });
    }

    const wpUser  = adminUsername?.trim() || generateWpUsername(service.domain);
    const wpPass  = adminPassword?.trim() || generateWpPassword();
    const wpEmail = adminEmail?.trim()    || `admin@${service.domain}`;

    console.log(`[WP] Reinstall starting for service ${id} | domain=${service.domain}`);

    const wpServer2 = await resolveServerForService(service);
    // Same as the install route: WHM apiToken not required — Softaculous uses cpanelPassword
    const cpanelCfg2 = (wpServer2 && wpServer2.type === "cpanel")
      ? {
          server:         toServerCfg(wpServer2),
          cpanelUser:     service.username!,
          cpanelApiToken: cpanelApiToken2?.trim() || undefined,
          cpanelPassword: cpanelPassword2?.trim() || undefined,
        }
      : null;

    // Wipes old DB + files, then runs full synchronous provision
    await reinstallWordPress(id, service.domain, siteTitle, wpUser, wpPass, wpEmail, installPath, cpanelCfg2);

    // Re-read to get the definitive final state
    const [updated] = await db.select().from(hostingServicesTable)
      .where(eq(hostingServicesTable.id, id)).limit(1);

    if (!updated || updated.wpProvisionStatus === "failed") {
      const errorMsg = (updated as any)?.wpProvisionError || "Reinstall failed — no further details available.";
      console.error(`[WP] Reinstall returned failed status for ${id}: ${errorMsg}`);
      return res.status(500).json({ success: false, error: errorMsg });
    }

    return res.json({
      success: true,
      installed: true,
      credentials: {
        loginUrl:    updated.wpUrl,
        username:    updated.wpUsername,
        password:    updated.wpPassword,
        email:       updated.wpEmail,
        siteTitle:   updated.wpSiteTitle,
        installPath: updated.wpInstallPath,
        dbName:      updated.wpDbName,
      },
    });
  } catch (err: any) {
    const msg = err?.message || "Unexpected server error during WordPress reinstall";
    console.error("[CLIENT] reinstall-wordpress unhandled error:", msg);
    return res.status(500).json({ error: msg });
  }
});

// GET /client/hosting/:id/wordpress-status — poll provisioning progress
router.get("/client/hosting/:id/wordpress-status", authenticate, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { id } = req.params;

    const [service] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, id), eq(hostingServicesTable.clientId, clientId))).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });

    const status = service.wpProvisionStatus || "not_started";

    // ── Active + installed: return credentials ───────────────────────────────
    if (status === "active" && service.wpInstalled) {
      // On a real VPS (MySQL reachable), also verify wp-config.php is on disk.
      // In simulation / dev mode (MySQL not reachable), trust the DB — never
      // clear state based on a filesystem check that runs on the wrong machine.
      const onVps = await isMysqlReachable();
      if (onVps && service.domain) {
        const fileExists = await checkWordPressInstalled(service.domain, service.wpInstallPath ?? "/");
        if (!fileExists) {
          // VPS mode: files genuinely missing — reset so user can reinstall
          await db.update(hostingServicesTable).set({
            wpInstalled: false,
            wpProvisionStatus: "not_started",
            wpProvisionStep: null,
            wpProvisionError: "Installation files not found on disk. Please reinstall WordPress.",
            updatedAt: new Date(),
          }).where(eq(hostingServicesTable.id, id));
          return res.json({ status: "not_installed", step: null, error: "Installation files not found. Please reinstall.", wpInstalled: false, steps: WP_STEPS });
        }
      }
      // Return credentials (from DB) — valid for both VPS and simulation mode
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

    // ── In-progress or failed ─────────────────────────────────────────────────
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

// ── BACKUP SYSTEM ─────────────────────────────────────────────────────────────

const BACKUP_DIR = process.env.WP_BACKUP_DIR || path.join(process.cwd(), "uploads/backups");
const WP_BASE_DIR = process.env.WP_BASE_DIR || "/var/www";
const MYSQL_ROOT_USER_FOR_DUMP = process.env.WP_MYSQL_ROOT_USER || "root";
const MYSQL_ROOT_PASS_FOR_DUMP = process.env.WP_MYSQL_ROOT_PASS || "";

// GET /api/client/hosting/:id/backups — list backups for a service
router.get("/client/hosting/:id/backups", authenticate, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { id } = req.params;
    const [service] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, id), eq(hostingServicesTable.clientId, clientId))).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });

    const backups = await db.select().from(hostingBackupsTable)
      .where(eq(hostingBackupsTable.serviceId, id))
      .orderBy(sql`created_at DESC`)
      .limit(20);
    res.json(backups);
  } catch (err) {
    console.error("[BACKUP] list error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/client/hosting/:id/backup — trigger a new manual backup
// Body: { backupType?: "full" | "db_only" }  (default: "full")
router.post("/client/hosting/:id/backup", authenticate, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { id } = req.params;
    const backupType: "full" | "db_only" = req.body?.backupType === "db_only" ? "db_only" : "full";

    const [service] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, id), eq(hostingServicesTable.clientId, clientId))).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });
    if (!service.domain) return res.status(400).json({ error: "Service has no domain configured" });

    const [backup] = await db.insert(hostingBackupsTable).values({
      serviceId: id,
      clientId,
      domain: service.domain,
      status: "running",
      type: backupType,
    }).returning();

    // Auto-cleanup: delete backups older than 24 hours for this service (non-fatal)
    cleanupOldBackups(id).catch(err =>
      console.warn("[BACKUP] Cleanup error (non-fatal):", err.message)
    );

    // Resolve cPanel server if available
    let cpanelServer: ReturnType<typeof toServerCfg> | null = null;
    if (service.serverId && service.username) {
      const [server] = await db.select().from(serversTable).where(eq(serversTable.id, service.serverId)).limit(1);
      if (server && (server.type === "cpanel" || server.type === "whm") && server.apiToken) {
        cpanelServer = toServerCfg(server);
      }
    }

    if (cpanelServer && service.username) {
      // Run cPanel backup via API in background
      runCpanelBackup(backup.id, cpanelServer, service.username, backupType, service.wpDbName ?? null)
        .catch(err => console.error("[BACKUP] cPanel background error:", err));
    } else {
      // Fallback: VPS/simulation backup
      runBackup(backup.id, service.domain, service.wpDbName ?? null).catch(err =>
        console.error("[BACKUP] background error:", err)
      );
    }

    res.json({
      success: true,
      backupId: backup.id,
      backupType,
      message: backupType === "db_only" ? "Database backup started" : "Full backup started",
    });
  } catch (err) {
    console.error("[BACKUP] start error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/client/hosting/:id/backup/:backupId — get backup status
router.get("/client/hosting/:id/backup/:backupId", authenticate, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { id, backupId } = req.params;
    const [service] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, id), eq(hostingServicesTable.clientId, clientId))).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });
    const [backup] = await db.select().from(hostingBackupsTable)
      .where(eq(hostingBackupsTable.id, backupId)).limit(1);
    if (!backup) return res.status(404).json({ error: "Backup not found" });
    res.json(backup);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/client/hosting/:id/backup/:backupId — remove a backup record (and local files)
router.delete("/client/hosting/:id/backup/:backupId", authenticate, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { id, backupId } = req.params;
    const [service] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, id), eq(hostingServicesTable.clientId, clientId))).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });
    const [backup] = await db.select().from(hostingBackupsTable)
      .where(and(eq(hostingBackupsTable.id, backupId), eq(hostingBackupsTable.serviceId, id))).limit(1);
    if (!backup) return res.status(404).json({ error: "Backup not found" });
    // Delete local files if they are local paths (not cPanel home dir paths)
    const isLocalFile = (p: string | null) =>
      p && !p.startsWith("~/") && !p.includes("(simulated)") && !p.includes("home dir") && !p.includes("cpanel_backups");
    if (isLocalFile(backup.filePath)) {
      try { await _execAsync(`rm -f "${backup.filePath}"`); } catch { /* non-fatal */ }
    }
    if (isLocalFile(backup.sqlPath)) {
      try { await _execAsync(`rm -f "${backup.sqlPath}"`); } catch { /* non-fatal */ }
    }
    await db.delete(hostingBackupsTable).where(eq(hostingBackupsTable.id, backupId));
    res.json({ success: true });
  } catch (err) {
    console.error("[BACKUP] delete error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/admin/hosting/:id/backup/:backupId — admin can delete any backup record
router.delete("/admin/hosting/:id/backup/:backupId", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id, backupId } = req.params;
    const [backup] = await db.select().from(hostingBackupsTable)
      .where(and(eq(hostingBackupsTable.id, backupId), eq(hostingBackupsTable.serviceId, id))).limit(1);
    if (!backup) return res.status(404).json({ error: "Backup not found" });
    const isLocalFile = (p: string | null) =>
      p && !p.startsWith("~/") && !p.includes("(simulated)") && !p.includes("home dir") && !p.includes("cpanel_backups");
    if (isLocalFile(backup.filePath)) {
      try { await _execAsync(`rm -f "${backup.filePath}"`); } catch { /* non-fatal */ }
    }
    if (isLocalFile(backup.sqlPath)) {
      try { await _execAsync(`rm -f "${backup.sqlPath}"`); } catch { /* non-fatal */ }
    }
    await db.delete(hostingBackupsTable).where(eq(hostingBackupsTable.id, backupId));
    res.json({ success: true });
  } catch (err) {
    console.error("[BACKUP] admin delete error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/** Core backup logic — runs asynchronously after HTTP response */
async function runBackup(backupId: string, domain: string, dbName: string | null): Promise<void> {
  const ts = Date.now();
  const domainSafe = domain.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${BACKUP_DIR}/${domainSafe}_files_${ts}.tar.gz`;
  const sqlPath  = `${BACKUP_DIR}/${domainSafe}_db_${ts}.sql`;
  const onVps    = await isMysqlReachable();

  console.log(`[BACKUP] Starting backup ${backupId} for ${domain} (onVps=${onVps})`);

  try {
    if (onVps) {
      // Ensure backup directory exists
      await _execAsync(`mkdir -p ${BACKUP_DIR}`);
      console.log(`[BACKUP] mkdir ${BACKUP_DIR}`);

      // STEP 1: Archive web files
      await _execAsync(`tar -czf ${filePath} -C ${WP_BASE_DIR} ${domain}`, { timeout: 300_000 });
      console.log(`[BACKUP] Files archived → ${filePath}`);

      // STEP 2: Dump database (if we have a DB name)
      if (dbName) {
        const passFlag = MYSQL_ROOT_PASS_FOR_DUMP ? `-p'${MYSQL_ROOT_PASS_FOR_DUMP}'` : "";
        await _execAsync(`mysqldump -u ${MYSQL_ROOT_USER_FOR_DUMP} ${passFlag} ${dbName} > ${sqlPath}`, { timeout: 120_000 });
        console.log(`[BACKUP] DB dumped → ${sqlPath}`);
      }

      // STEP 3: Calculate backup size
      let sizeMb: string | null = null;
      try {
        const { stdout } = await _execAsync(`du -sm ${filePath} | cut -f1`);
        sizeMb = stdout.trim() || null;
      } catch { /* non-fatal */ }

      await db.update(hostingBackupsTable).set({
        status: "completed",
        filePath,
        sqlPath: dbName ? sqlPath : null,
        sizeMb,
        completedAt: new Date(),
      }).where(eq(hostingBackupsTable.id, backupId));

      console.log(`[BACKUP] Completed ${backupId} — files: ${filePath}, db: ${sqlPath || "none"}`);
    } else {
      // Simulation mode — no VPS access available
      console.warn(`[BACKUP] Simulation mode: VPS not reachable. Simulating backup for ${domain}.`);
      await new Promise(r => setTimeout(r, 3000));
      await db.update(hostingBackupsTable).set({
        status: "completed",
        filePath: `${BACKUP_DIR}/${domainSafe}_files_${ts}.tar.gz (simulated)`,
        sqlPath: dbName ? `${BACKUP_DIR}/${domainSafe}_db_${ts}.sql (simulated)` : null,
        sizeMb: "12.5",
        completedAt: new Date(),
      }).where(eq(hostingBackupsTable.id, backupId));
      console.log(`[BACKUP] Simulation complete for ${backupId}`);
    }
  } catch (err: any) {
    const msg = err?.message || "Backup failed";
    console.error(`[BACKUP] Error for ${backupId}: ${msg}`);
    await db.update(hostingBackupsTable).set({
      status: "failed",
      errorMessage: msg,
      completedAt: new Date(),
    }).where(eq(hostingBackupsTable.id, backupId));
  }
}

// Export runBackup so cron can use it
export { runBackup };

/** Remove backup records older than 24 hours for a service (non-destructive — DB only) */
async function cleanupOldBackups(serviceId: string): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const deleted = await db.delete(hostingBackupsTable)
    .where(and(
      eq(hostingBackupsTable.serviceId, serviceId),
      sql`created_at < ${cutoff.toISOString()}`,
    )).returning({ id: hostingBackupsTable.id });
  if (deleted.length > 0) {
    console.log(`[BACKUP] Cleaned up ${deleted.length} backup record(s) older than 24h for service ${serviceId}`);
  }
}

/** Run a cPanel backup (full or db_only) via cPanel UAPI */
async function runCpanelBackup(
  backupId: string,
  server: { hostname: string; port: number; username: string; apiToken: string },
  cpanelUser: string,
  backupType: "full" | "db_only",
  dbName: string | null,
): Promise<void> {
  console.log(`[BACKUP] cPanel ${backupType} backup ${backupId} for user ${cpanelUser}`);
  try {
    if (backupType === "db_only") {
      if (!dbName) {
        throw new Error("No database name available for DB-only backup");
      }
      const result = await cpanelDbDump(server, cpanelUser, dbName);
      await db.update(hostingBackupsTable).set({
        // "queued_on_server" = cPanel accepted the DB dump; file appears in ~/cpanel_backups/
        status: result.status === "initiated" ? "queued_on_server" : "failed",
        filePath: `~/cpanel_backups/${result.filename}`,
        errorMessage: result.status !== "initiated" ? result.message : null,
        completedAt: new Date(),
      }).where(eq(hostingBackupsTable.id, backupId));
      console.log(`[BACKUP] cPanel DB dump ${backupId}: ${result.message}`);
    } else {
      const result = await cpanelFullBackup(server, cpanelUser);
      await db.update(hostingBackupsTable).set({
        // "queued_on_server" = cPanel accepted the job; actual file appears in ~/backup-USER-DATE.tar.gz
        status: result.status === "initiated" ? "queued_on_server" : "failed",
        filePath: `~/backup-${cpanelUser}-*.tar.gz`,
        errorMessage: result.status !== "initiated" ? result.message : null,
        completedAt: new Date(),
      }).where(eq(hostingBackupsTable.id, backupId));
      console.log(`[BACKUP] cPanel full backup ${backupId}: ${result.message}`);
    }
  } catch (err: any) {
    const msg = err?.message || "cPanel backup failed";
    console.error(`[BACKUP] cPanel error for ${backupId}: ${msg}`);
    await db.update(hostingBackupsTable).set({
      status: "failed",
      errorMessage: msg,
      completedAt: new Date(),
    }).where(eq(hostingBackupsTable.id, backupId));
  }
}

// ── AI WEBSITE BUILDER ────────────────────────────────────────────────────────

// POST /api/client/hosting/:id/ai-builder — installs WP (if not installed) and
// returns the wp-admin URL so the client can start building
router.post("/client/hosting/:id/ai-builder", authenticate, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { id } = req.params;
    const [service] = await db.select().from(hostingServicesTable)
      .where(and(eq(hostingServicesTable.id, id), eq(hostingServicesTable.clientId, clientId))).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });
    if (!service.domain) return res.status(400).json({ error: "Service has no domain configured" });
    if (service.status !== "active") return res.status(400).json({ error: "Service must be active" });

    // If WordPress already installed → just return admin URL
    if (service.wpInstalled && service.wpProvisionStatus === "active") {
      return res.json({
        success: true,
        alreadyInstalled: true,
        adminUrl: service.wpUrl,
        message: "WordPress is ready. Redirecting to admin panel.",
      });
    }

    // WordPress not installed → trigger install, then redirect to wp-admin
    if (service.wpProvisionStatus === "provisioning" || service.wpProvisionStatus === "queued") {
      return res.json({
        success: true,
        installing: true,
        message: "WordPress installation is already in progress.",
      });
    }

    // Auto-generate credentials for AI builder
    const wpUser  = generateWpUsername(service.domain);
    const wpPass  = generateWpPassword();
    const wpEmail = `admin@${service.domain}`;
    const siteTitle = `${service.domain} — WordPress`;

    await db.update(hostingServicesTable).set({
      wpProvisionStatus: "queued",
      wpProvisionStep: "Queued",
      wpProvisionError: null,
      wpInstalled: false,
      wpUsername: wpUser,
      wpPassword: wpPass,
      wpEmail: wpEmail,
      wpSiteTitle: siteTitle,
      wpInstallPath: "/",
      updatedAt: new Date(),
    }).where(eq(hostingServicesTable.id, id));

    provisionWordPress(id, service.domain, siteTitle, wpUser, wpPass, wpEmail, "/")
      .catch(err => console.error("[AI-BUILDER] WP provision error:", err));

    console.log(`[AI-BUILDER] Triggered WP install for ${id} (${service.domain})`);
    res.json({
      success: true,
      installing: true,
      message: "WordPress is being installed. Poll /wordpress-status for progress.",
    });
  } catch (err) {
    console.error("[AI-BUILDER] error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: create hosting service for a client
router.post("/admin/hosting", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { clientId, planId, planName, domain, billingCycle, startDate, nextDueDate, status, amount } = req.body;
    if (!clientId) { res.status(400).json({ error: "clientId is required" }); return; }
    const [created] = await db.insert(hostingServicesTable).values({
      clientId,
      planId: planId || "custom",
      planName: planName || "Custom Plan",
      domain: domain || null,
      billingCycle: billingCycle || "monthly",
      startDate: startDate ? new Date(startDate) : new Date(),
      nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
      status: status || "active",
      amount: amount != null ? String(amount) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, clientId)).limit(1);
    res.status(201).json(formatService(created, user ? `${user.firstName} ${user.lastName}` : ""));
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Admin: delete hosting service (after termination)
router.delete("/admin/hosting/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [deleted] = await db.delete(hostingServicesTable).where(eq(hostingServicesTable.id, req.params.id)).returning();
    if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true, id: req.params.id });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// ─── GET /api/client/hosting/:id/usage — Disk & Bandwidth usage for client dashboard ─
router.get("/client/hosting/:id/usage", authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const [service] = await db.select().from(hostingServicesTable)
      .where(eq(hostingServicesTable.id, id)).limit(1);
    if (!service) { res.status(404).json({ error: "Service not found" }); return; }
    if (service.clientId !== req.user!.userId && req.user!.role !== "admin") {
      res.status(403).json({ error: "Forbidden" }); return;
    }

    // Parse disk & bandwidth from stored strings (e.g. "250 MB" / "1.5 GB")
    function parseMB(val: string | null | undefined): number {
      if (!val) return 0;
      const num = parseFloat(val);
      if (isNaN(num)) return 0;
      return val.toLowerCase().includes("gb") ? num * 1024 : num;
    }

    // Fetch plan limits
    const [plan] = service.planId
      ? await db.select().from(hostingPlansTable).where(eq(hostingPlansTable.id, service.planId)).limit(1)
      : [null];

    const diskUsedMB  = parseMB((service as any).diskUsed);
    const diskLimitMB = plan ? parseFloat((plan as any).diskSpace ?? "1024") * (((plan as any).diskSpace ?? "").includes("GB") ? 1024 : 1) : 1024;

    const bwUsedMB    = parseMB((service as any).bandwidthUsed);
    const bwLimitMB   = plan ? parseFloat((plan as any).bandwidth ?? "10000") * (((plan as any).bandwidth ?? "").includes("GB") ? 1024 : 1) : 10240;

    function fmtMB(mb: number) {
      if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
      return `${Math.round(mb)} MB`;
    }

    res.json({
      disk: {
        usedMB:   diskUsedMB,
        limitMB:  diskLimitMB,
        usedFmt:  fmtMB(diskUsedMB),
        limitFmt: fmtMB(diskLimitMB),
        pct:      diskLimitMB > 0 ? Math.min(100, Math.round((diskUsedMB / diskLimitMB) * 100)) : 0,
      },
      bandwidth: {
        usedMB:   bwUsedMB,
        limitMB:  bwLimitMB,
        usedFmt:  fmtMB(bwUsedMB),
        limitFmt: fmtMB(bwLimitMB),
        pct:      bwLimitMB > 0 ? Math.min(100, Math.round((bwUsedMB / bwLimitMB) * 100)) : 0,
      },
      updatedAt: (service as any).updatedAt ?? null,
    });
  } catch (err) {
    console.error("[USAGE]", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── POST /admin/hosting/:id/sync-usage — Force-refresh disk/bandwidth from cPanel ─
// Admin-only. Pulls live stats from WHM accountsummary and persists to the service record
// so both admin and client views show up-to-date data immediately.
router.post("/admin/hosting/:id/sync-usage", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  function fmtMB(mb: number): string {
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${Math.round(mb)} MB`;
  }
  try {
    const { id } = req.params;
    const [service] = await db.select().from(hostingServicesTable).where(eq(hostingServicesTable.id, id)).limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });

    if (!service.serverId || !service.username) {
      return res.json({ success: false, message: "No cPanel server configured for this service" });
    }
    const [server] = await db.select().from(serversTable).where(eq(serversTable.id, service.serverId)).limit(1);
    if (!server || (server.type !== "cpanel" && server.type !== "whm") || !server.apiToken) {
      return res.json({ success: false, message: "Service is not on a cPanel/WHM server" });
    }

    const serverCfg = toServerCfg(server);
    const { diskUsedMB, diskLimitMB, diskUnlimited, bwUsedMB, bwLimitMB, bwUnlimited } =
      await cpanelGetLiveUsage(serverCfg, service.username);

    const diskUsedFmt = fmtMB(diskUsedMB);
    const bwUsedFmt = fmtMB(bwUsedMB);

    await db.update(hostingServicesTable).set({
      diskUsed: diskUsedFmt,
      bandwidthUsed: bwUsedFmt,
      updatedAt: new Date(),
    }).where(eq(hostingServicesTable.id, id));

    const diskPct = (!diskUnlimited && diskLimitMB > 0) ? Math.min(100, Math.round((diskUsedMB / diskLimitMB) * 100)) : 0;
    const bwPct   = (!bwUnlimited && bwLimitMB > 0)   ? Math.min(100, Math.round((bwUsedMB   / bwLimitMB)   * 100)) : 0;

    console.log(`[ADMIN] sync-usage for ${service.username} (${id}): disk=${diskUsedFmt}, bw=${bwUsedFmt}`);
    res.json({
      success: true,
      diskUsed: diskUsedFmt,
      diskLimit: diskUnlimited ? "Unlimited" : fmtMB(diskLimitMB),
      diskPct,
      diskUnlimited,
      bwUsed: bwUsedFmt,
      bwLimit: bwUnlimited ? "Unlimited" : fmtMB(bwLimitMB),
      bwPct,
      bwUnlimited,
    });
  } catch (err: any) {
    console.error("[ADMIN] sync-usage error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
