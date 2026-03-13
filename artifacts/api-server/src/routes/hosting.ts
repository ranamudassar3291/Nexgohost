import { Router } from "express";
import { db } from "@workspace/db";
import { hostingPlansTable, hostingServicesTable, usersTable, domainsTable, invoicesTable, ticketsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { provisionHostingService } from "../lib/provision.js";
import { emailServiceSuspended } from "../lib/email.js";

const router = Router();

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

// Admin: suspend hosting
router.post("/admin/hosting/:id/suspend", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [updated] = await db.update(hostingServicesTable)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(eq(hostingServicesTable.id, req.params.id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatService(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: unsuspend hosting
router.post("/admin/hosting/:id/unsuspend", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [updated] = await db.update(hostingServicesTable)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(hostingServicesTable.id, req.params.id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatService(updated));
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Admin: terminate hosting
router.post("/admin/hosting/:id/terminate", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [updated] = await db.update(hostingServicesTable)
      .set({ status: "terminated", updatedAt: new Date() })
      .where(eq(hostingServicesTable.id, req.params.id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatService(updated));
  } catch (err) {
    console.error(err);
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

// Admin: approve cancellation
router.post("/admin/hosting/:id/cancel", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [updated] = await db.update(hostingServicesTable)
      .set({ status: "terminated", cancelRequested: false, updatedAt: new Date() })
      .where(eq(hostingServicesTable.id, req.params.id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatService(updated));
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Client: get my hosting
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
