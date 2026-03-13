import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, hostingServicesTable, domainsTable, ordersTable, invoicesTable, ticketsTable, migrationsTable, fraudLogsTable, cronLogsTable, emailLogsTable } from "@workspace/db/schema";
import { eq, count, sum, sql, and, lte } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";

const router = Router();

router.get("/admin/dashboard", authenticate, requireAdmin, async (_req, res) => {
  try {
    const [{ totalClients }] = await db.select({ totalClients: count() }).from(usersTable).where(eq(usersTable.role, "client"));
    const [{ activeHosting }] = await db.select({ activeHosting: count() }).from(hostingServicesTable).where(eq(hostingServicesTable.status, "active"));
    const [{ suspendedHosting }] = await db.select({ suspendedHosting: count() }).from(hostingServicesTable).where(eq(hostingServicesTable.status, "suspended"));
    const [{ totalServices }] = await db.select({ totalServices: count() }).from(hostingServicesTable);
    const [{ totalDomains }] = await db.select({ totalDomains: count() }).from(domainsTable);
    const [{ pendingOrders }] = await db.select({ pendingOrders: count() }).from(ordersTable).where(eq(ordersTable.status, "pending"));
    const [{ fraudOrders }] = await db.select({ fraudOrders: count() }).from(fraudLogsTable).where(eq(fraudLogsTable.status, "flagged"));
    const [{ openTickets }] = await db.select({ openTickets: count() }).from(ticketsTable).where(sql`status IN ('open', 'pending')`);
    const [{ activeMigrations }] = await db.select({ activeMigrations: count() }).from(migrationsTable).where(sql`status IN ('pending', 'in_progress')`);

    // Invoices due in next 7 days
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const [{ invoicesDue }] = await db.select({ invoicesDue: count() }).from(invoicesTable)
      .where(and(eq(invoicesTable.status, "unpaid"), lte(invoicesTable.dueDate, sevenDaysFromNow)));

    // Cron/automation stats
    const recentCronLogs = await db.select().from(cronLogsTable).orderBy(sql`executed_at DESC`).limit(10);
    const recentEmailLogs = await db.select({ count: count() }).from(emailLogsTable);
    const emailsSent = Number(recentEmailLogs[0]?.count || 0);

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
      totalServices: Number(totalServices),
      activeHosting: Number(activeHosting),
      suspendedHosting: Number(suspendedHosting),
      totalDomains: Number(totalDomains),
      pendingOrders: Number(pendingOrders),
      fraudOrders: Number(fraudOrders),
      invoicesDue: Number(invoicesDue),
      emailsSent,
      monthlyRevenue,
      totalRevenue,
      openTickets: Number(openTickets),
      activeMigrations: Number(activeMigrations),
      recentCronLogs: recentCronLogs.map(l => ({
        id: l.id, task: l.task, status: l.status, message: l.message, executedAt: l.executedAt.toISOString(),
      })),
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
