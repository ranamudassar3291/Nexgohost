import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, hostingServicesTable, domainsTable, ordersTable, invoicesTable, ticketsTable, migrationsTable, transactionsTable } from "@workspace/db/schema";
import { eq, count, sum, sql } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";

const router = Router();

router.get("/admin/dashboard", authenticate, requireAdmin, async (_req, res) => {
  try {
    const [{ totalClients }] = await db.select({ totalClients: count() }).from(usersTable).where(eq(usersTable.role, "client"));
    const [{ activeHosting }] = await db.select({ activeHosting: count() }).from(hostingServicesTable).where(eq(hostingServicesTable.status, "active"));
    const [{ totalDomains }] = await db.select({ totalDomains: count() }).from(domainsTable);
    const [{ pendingOrders }] = await db.select({ pendingOrders: count() }).from(ordersTable).where(eq(ordersTable.status, "pending"));
    const [{ openTickets }] = await db.select({ openTickets: count() }).from(ticketsTable).where(sql`status IN ('open', 'pending')`);
    const [{ activeMigrations }] = await db.select({ activeMigrations: count() }).from(migrationsTable).where(sql`status IN ('pending', 'in_progress')`);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const paidInvoices = await db.select({ total: sum(invoicesTable.total) }).from(invoicesTable).where(eq(invoicesTable.status, "paid"));
    const monthlyPaid = await db.select({ total: sum(invoicesTable.total) }).from(invoicesTable)
      .where(sql`status = 'paid' AND paid_date >= ${monthStart}`);

    const totalRevenue = Number(paidInvoices[0]?.total || 0);
    const monthlyRevenue = Number(monthlyPaid[0]?.total || 0);

    const recentOrders = await db.select().from(ordersTable).orderBy(sql`created_at DESC`).limit(5);
    const recentClients = await db.select().from(usersTable).where(eq(usersTable.role, "client")).orderBy(sql`created_at DESC`).limit(5);

    const formattedOrders = await Promise.all(recentOrders.map(async (o) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, o.clientId)).limit(1);
      return {
        id: o.id,
        clientId: o.clientId,
        clientName: user ? `${user.firstName} ${user.lastName}` : "",
        type: o.type,
        itemName: o.itemName,
        amount: Number(o.amount),
        status: o.status,
        notes: o.notes,
        createdAt: o.createdAt.toISOString(),
      };
    }));

    res.json({
      totalClients: Number(totalClients),
      activeHosting: Number(activeHosting),
      totalDomains: Number(totalDomains),
      pendingOrders: Number(pendingOrders),
      monthlyRevenue,
      totalRevenue,
      openTickets: Number(openTickets),
      activeMigrations: Number(activeMigrations),
      recentOrders: formattedOrders,
      recentClients: recentClients.map(u => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        company: u.company,
        phone: u.phone,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt.toISOString(),
        servicesCount: 0,
        domainsCount: 0,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
