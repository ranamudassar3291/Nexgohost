import { Router } from "express";
import { db } from "@workspace/db";
import { hostingPlansTable, hostingServicesTable, usersTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";

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
    serverIp: s.serverIp,
    status: s.status,
    startDate: s.startDate?.toISOString(),
    expiryDate: s.expiryDate?.toISOString(),
    diskUsed: s.diskUsed,
    bandwidthUsed: s.bandwidthUsed,
    cpanelUrl: s.cpanelUrl,
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
    const services = await db.select().from(hostingServicesTable).where(eq(hostingServicesTable.clientId, clientId));
    const domains = await db.select().from(db._.schema!["domainsTable" as never] as never).where(sql`client_id = ${clientId}`).catch(() => []);

    const invoicesMod = await import("@workspace/db");
    const { invoicesTable, domainsTable, ticketsTable } = invoicesMod;

    const invoices = await db.select().from(invoicesTable).where(eq(invoicesTable.clientId, clientId)).orderBy(sql`created_at DESC`).limit(5);
    const tickets = await db.select().from(ticketsTable).where(eq(ticketsTable.clientId, clientId)).orderBy(sql`created_at DESC`).limit(5);
    const allDomains = await db.select().from(domainsTable).where(eq(domainsTable.clientId, clientId));
    const allInvoices = await db.select().from(invoicesTable).where(eq(invoicesTable.clientId, clientId));

    const unpaidInvoices = allInvoices.filter(i => i.status === "unpaid").length;
    const openTickets = tickets.filter(t => t.status === "open" || t.status === "pending").length;

    res.json({
      activeServices: services.filter(s => s.status === "active").length,
      activeDomains: allDomains.filter(d => d.status === "active").length,
      unpaidInvoices,
      openTickets,
      recentInvoices: invoices.map(i => ({
        ...i,
        dueDate: i.dueDate.toISOString(),
        paidDate: i.paidDate?.toISOString(),
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
        clientName: "",
      })),
      recentTickets: tickets.map(t => ({
        ...t,
        lastReply: t.lastReply?.toISOString(),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        clientName: "",
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
