import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, hostingServicesTable, domainsTable, invoicesTable, ticketsTable, ordersTable } from "@workspace/db/schema";
import { eq, ilike, or, count, sql } from "drizzle-orm";
import { authenticate, requireAdmin, hashPassword, type AuthRequest } from "../lib/auth.js";
import { emailGeneric, emailVerificationCode } from "../lib/email.js";

const router = Router();

function formatUser(user: typeof usersTable.$inferSelect, extras?: { servicesCount?: number; domainsCount?: number }) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    company: user.company,
    phone: user.phone,
    country: (user as any).country ?? null,
    currency: (user as any).currency ?? null,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    servicesCount: extras?.servicesCount ?? 0,
    domainsCount: extras?.domainsCount ?? 0,
  };
}

// Admin: create a new client account
router.post("/admin/clients", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { firstName, lastName, email, password, company, phone } = req.body;
    if (!firstName || !lastName || !email || !password) {
      res.status(400).json({ error: "firstName, lastName, email, and password are required" });
      return;
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }

    const hashed = await hashPassword(password);
    const [user] = await db.insert(usersTable).values({
      firstName, lastName, email,
      passwordHash: hashed,
      company: company || null,
      phone: phone || null,
      role: "client",
      status: "active",
    }).returning();

    res.status(201).json(formatUser(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/admin/clients", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { search, status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    let query = db.select().from(usersTable).where(eq(usersTable.role, "client"));

    const clients = await db.select().from(usersTable)
      .where(
        sql`role = 'client' ${search ? sql`AND (first_name ILIKE ${'%' + search + '%'} OR last_name ILIKE ${'%' + search + '%'} OR email ILIKE ${'%' + search + '%'})` : sql``} ${status ? sql`AND status = ${status}` : sql``}`
      )
      .limit(limitNum)
      .offset(offset);

    const [{ total }] = await db.select({ total: count() }).from(usersTable).where(eq(usersTable.role, "client"));

    const formatted = await Promise.all(clients.map(async (c) => {
      const [{ sc }] = await db.select({ sc: count() }).from(hostingServicesTable).where(eq(hostingServicesTable.clientId, c.id));
      const [{ dc }] = await db.select({ dc: count() }).from(domainsTable).where(eq(domainsTable.clientId, c.id));
      return formatUser(c, { servicesCount: Number(sc), domainsCount: Number(dc) });
    }));

    res.json({ clients: formatted, total: Number(total), page: pageNum, limit: limitNum });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/admin/clients/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.params.id)).limit(1);
    if (!user) { res.status(404).json({ error: "Not found" }); return; }

    const hosting = await db.select().from(hostingServicesTable).where(eq(hostingServicesTable.clientId, user.id));
    const domains = await db.select().from(domainsTable).where(eq(domainsTable.clientId, user.id));
    const invoices = await db.select().from(invoicesTable).where(eq(invoicesTable.clientId, user.id));
    const tickets = await db.select().from(ticketsTable).where(eq(ticketsTable.clientId, user.id));
    const orders = await db.select().from(ordersTable).where(eq(ordersTable.clientId, user.id));

    res.json({
      ...formatUser(user, { servicesCount: hosting.length, domainsCount: domains.length }),
      hosting: hosting.map(h => ({
        ...h,
        startDate: h.startDate?.toISOString(),
        expiryDate: h.expiryDate?.toISOString(),
        createdAt: h.createdAt.toISOString(),
        updatedAt: h.updatedAt.toISOString(),
      })),
      domains: domains.map(d => ({
        ...d,
        registrationDate: d.registrationDate?.toISOString(),
        expiryDate: d.expiryDate?.toISOString(),
        createdAt: d.createdAt.toISOString(),
      })),
      invoices: invoices.map(i => ({
        ...i,
        dueDate: i.dueDate.toISOString(),
        paidDate: i.paidDate?.toISOString(),
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
        invoiceNumber: i.invoiceNumber,
        clientName: `${user.firstName} ${user.lastName}`,
      })),
      tickets: tickets.map(t => ({
        ...t,
        ticketNumber: t.ticketNumber,
        clientName: `${user.firstName} ${user.lastName}`,
        lastReply: t.lastReply?.toISOString(),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      orders: orders.map(o => ({
        ...o,
        amount: o.amount,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/admin/clients/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { firstName, lastName, email, company, phone, status } = req.body;
    const [updated] = await db.update(usersTable)
      .set({ firstName, lastName, email, company, phone, status, updatedAt: new Date() })
      .where(eq(usersTable.id, req.params.id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatUser(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/admin/clients/:id/suspend", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [updated] = await db.update(usersTable)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(eq(usersTable.id, req.params.id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatUser(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/admin/clients/:id/activate", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [updated] = await db.update(usersTable)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(usersTable.id, req.params.id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatUser(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/admin/clients/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    await db.delete(usersTable).where(eq(usersTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: send email to client
router.post("/admin/clients/:id/send-email", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.params.id)).limit(1);
    if (!user) { res.status(404).json({ error: "Client not found" }); return; }
    const { subject = "Message from Noehost", message = "Thank you for being our client." } = req.body;
    await emailGeneric(user.email, subject, `${user.firstName} ${user.lastName}`, message).catch(console.warn);
    res.json({ success: true, message: "Email sent successfully" });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Admin: resend email verification / OTP to a client
router.post("/admin/clients/:id/resend-verification", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.params.id)).limit(1);
    if (!user) { res.status(404).json({ error: "Client not found" }); return; }

    // Generate fresh 6-digit OTP and save with 10-minute expiry
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await db.update(usersTable)
      .set({ verificationCode: otpCode, verificationExpiresAt: otpExpiry, emailVerified: false, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    const result = await emailVerificationCode(user.email, user.firstName || user.email, otpCode, { clientId: user.id });
    if (result.sent) {
      res.json({ success: true, message: `Verification code sent to ${user.email} (expires 10 min)` });
    } else {
      res.status(500).json({ error: `Email failed: ${result.message}` });
    }
  } catch (err: any) {
    console.error("[ADMIN] resend-verification error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post("/admin/clients/:id/reset-password", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) { res.status(400).json({ error: "New password required" }); return; }
    const passwordHash = await hashPassword(newPassword);
    await db.update(usersTable).set({ passwordHash, updatedAt: new Date() }).where(eq(usersTable.id, req.params.id));
    res.json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
