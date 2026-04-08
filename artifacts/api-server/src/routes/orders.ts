import { Router } from "express";
import { db } from "@workspace/db";
import { sendWhatsAppAlert, sendToClientPhone } from "../lib/whatsapp.js";
import {
  ordersTable, usersTable, hostingPlansTable, hostingServicesTable,
  invoicesTable, serversTable, domainsTable,
} from "@workspace/db/schema";
import { eq, sql, desc, ilike, or, and, inArray } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { provisionHostingService } from "../lib/provision.js";
import { emailDomainRegistered } from "../lib/email.js";

const router = Router();

async function generateInvoiceNumber(): Promise<string> {
  await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS inv_seq START WITH 2001`);
  const result = await db.execute(sql`SELECT nextval('inv_seq') AS seq`);
  const seq = Number((result.rows[0] as any).seq);
  return `NOE-${String(seq).padStart(5, "0")}`;
}

function formatOrder(
  o: typeof ordersTable.$inferSelect,
  clientName?: string,
  service?: { cpanelUrl: string | null; webmailUrl: string | null; status: string; id: string } | null,
  planServerGroupId?: string | null,
) {
  return {
    id: o.id,
    clientId: o.clientId,
    clientName: clientName || "",
    type: o.type,
    itemId: o.itemId ?? null,
    itemName: o.itemName,
    domain: o.domain ?? null,
    amount: Number(o.amount),
    billingCycle: o.billingCycle ?? "monthly",
    dueDate: o.dueDate?.toISOString() ?? null,
    moduleType: o.moduleType ?? "none",
    modulePlanId: o.modulePlanId ?? null,
    modulePlanName: o.modulePlanName ?? null,
    moduleServerId: o.moduleServerId ?? null,
    moduleServerGroupId: planServerGroupId ?? null,
    paymentStatus: o.paymentStatus ?? "unpaid",
    invoiceId: o.invoiceId ?? null,
    status: o.status,
    notes: o.notes,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt?.toISOString() ?? o.createdAt.toISOString(),
    // Service quick-access
    serviceId: service?.id ?? null,
    serviceStatus: service?.status ?? null,
    cpanelUrl: service?.cpanelUrl ?? null,
    webmailUrl: service?.webmailUrl ?? null,
  };
}

async function findServiceForOrder(order: typeof ordersTable.$inferSelect) {
  if (order.type !== "hosting") return null;
  // Primary: look up by orderId for accurate 1-to-1 mapping
  const byOrderId = await db.select().from(hostingServicesTable)
    .where(eq(hostingServicesTable.orderId, order.id)).limit(1);
  if (byOrderId.length > 0) return byOrderId[0];
  // Fallback: for legacy records without orderId, use clientId+domain exact match
  if (!order.itemId) return null;
  const byDomain = order.domain
    ? await db.select().from(hostingServicesTable)
        .where(eq(hostingServicesTable.clientId, order.clientId)).then(
          rows => rows.find(s => s.domain === order.domain && s.orderId === null) ?? null
        )
    : null;
  return byDomain;
}

async function createInvoiceForOrder(order: typeof ordersTable.$inferSelect, clientName: string) {
  const invoiceNumber = await generateInvoiceNumber();
  const dueDate = order.dueDate || (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d; })();
  const billingLabel = (order.billingCycle === "yearly") ? "Annual" : "Monthly";
  const [invoice] = await db.insert(invoicesTable).values({
    invoiceNumber,
    clientId: order.clientId,
    orderId: order.id,
    amount: order.amount,
    tax: "0",
    total: order.amount,
    status: "unpaid",
    dueDate,
    items: [{
      description: `${order.itemName} — ${billingLabel} Hosting Plan${order.modulePlanName ? ` (${order.modulePlanName})` : ""}`,
      quantity: 1,
      unitPrice: Number(order.amount),
      total: Number(order.amount),
    }],
  }).returning();
  // Link invoice back to order
  await db.update(ordersTable).set({ invoiceId: invoice.id, updatedAt: new Date() }).where(eq(ordersTable.id, order.id));
  return invoice;
}

// Client: get my orders
router.get("/orders", authenticate, async (req: AuthRequest, res) => {
  try {
    const orders = await db.select().from(ordersTable)
      .where(eq(ordersTable.clientId, req.user!.userId)).orderBy(sql`created_at DESC`);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    res.json(orders.map(o => formatOrder(o, user ? `${user.firstName} ${user.lastName}` : "")));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Client: create order
router.post("/orders", authenticate, async (req: AuthRequest, res) => {
  try {
    const { type, itemId, notes } = req.body;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    let itemName = "Order";
    let amount = 0;

    if (type === "hosting" && itemId) {
      const [plan] = await db.select().from(hostingPlansTable).where(eq(hostingPlansTable.id, itemId)).limit(1);
      if (plan) { itemName = plan.name; amount = Number(plan.price); }
    } else if (type === "domain") {
      itemName = itemId || "Domain registration";
      amount = 12.99;
    }

    const [order] = await db.insert(ordersTable).values({
      clientId: req.user!.userId,
      type,
      itemId,
      itemName,
      amount: String(amount),
      status: "pending",
      notes,
    }).returning();

    res.status(201).json(formatOrder(order, `${user.firstName} ${user.lastName}`));

    // WhatsApp alert to admin (non-blocking)
    const adminUrl = process.env.ADMIN_PANEL_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "noehost.com"}`;
    sendWhatsAppAlert("new_order",
      `📦 *New Order Received — Noehost*\n\n` +
      `👤 Client: ${user.firstName} ${user.lastName}\n` +
      `📧 Email: ${user.email}\n` +
      `🛒 Service: ${itemName}\n` +
      `💰 Amount: PKR ${Number(amount).toLocaleString()}\n` +
      `🏷️ Type: ${type}\n\n` +
      `🔗 View Order:\n${adminUrl}/admin/orders/${order.id}\n\n` +
      `_${new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}_`
    ).catch(() => {});

    // WhatsApp confirmation to client (non-blocking)
    if (user.phone) {
      const clientName = user.firstName ? user.firstName.trim() : "there";
      sendToClientPhone(
        user.phone,
        `🎉 *Order Received — Noehost*\n\n` +
        `Hi ${clientName}!\n\n` +
        `Your order *#${order.id.slice(0, 8).toUpperCase()}* has been received successfully!\n\n` +
        `📦 Service: ${itemName}\n` +
        `💰 Amount: PKR ${Number(amount).toLocaleString()}\n\n` +
        `Our team is processing your order and will activate your service shortly.\n\n` +
        `📧 Questions? support@noehost.com\n\n` +
        `_Noehost Team_ 🚀`,
        "client_notification"
      ).catch(() => {});
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: get all orders
router.get("/admin/orders", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1")));
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || "50"))));
    const search = String(req.query.search || "").trim();
    const statusFilter = String(req.query.status || "all");
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions: any[] = [];
    if (statusFilter !== "all") conditions.push(eq(ordersTable.status, statusFilter as any));
    if (search) conditions.push(or(
      ilike(ordersTable.itemName, `%${search}%`),
      ilike(ordersTable.domain, `%${search}%`),
      ilike(ordersTable.notes, `%${search}%`),
    )!);

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` })
      .from(ordersTable).where(whereClause);

    const orders = await db.select().from(ordersTable)
      .where(whereClause)
      .orderBy(desc(ordersTable.createdAt))
      .limit(limit).offset(offset);

    const plans = await db.select({
      id: hostingPlansTable.id,
      moduleServerGroupId: hostingPlansTable.moduleServerGroupId,
    }).from(hostingPlansTable);
    const planMap = new Map(plans.map(p => [p.id, p]));

    // Batch-fetch users
    const clientIds = [...new Set(orders.map(o => o.clientId))];
    const users = clientIds.length > 0
      ? await db.select().from(usersTable).where(inArray(usersTable.id, clientIds))
      : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    const result = await Promise.all(orders.map(async (o) => {
      const user = userMap.get(o.clientId);
      const service = await findServiceForOrder(o);
      const plan = o.itemId ? planMap.get(o.itemId) : null;
      return formatOrder(o, user ? `${user.firstName} ${user.lastName}` : "", service, plan?.moduleServerGroupId ?? null);
    }));

    res.json({ data: result, total: count, page, limit, totalPages: Math.ceil(count / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: get single order
router.get("/admin/orders/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, req.params.id)).limit(1);
    if (!order) { res.status(404).json({ error: "Not found" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, order.clientId)).limit(1);
    res.json(formatOrder(order, user ? `${user.firstName} ${user.lastName}` : ""));
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Admin: create order manually
router.post("/admin/orders", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const {
      clientId, type, itemId, itemName, amount, notes, status,
      billingCycle, dueDate, moduleType, modulePlanId, modulePlanName,
      moduleServerId, paymentStatus, domain, generateInvoice,
    } = req.body;

    if (!clientId || !type || !itemName || amount === undefined) {
      res.status(400).json({ error: "clientId, type, itemName, amount are required" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, clientId)).limit(1);
    if (!user) { res.status(404).json({ error: "Client not found" }); return; }

    const [order] = await db.insert(ordersTable).values({
      clientId,
      type: type || "hosting",
      itemId: itemId || null,
      itemName,
      domain: domain || null,
      amount: String(Number(amount).toFixed(2)),
      billingCycle: billingCycle || "monthly",
      dueDate: dueDate ? new Date(dueDate) : null,
      moduleType: moduleType || "none",
      modulePlanId: modulePlanId || null,
      modulePlanName: modulePlanName || null,
      moduleServerId: moduleServerId || null,
      paymentStatus: paymentStatus || "unpaid",
      status: status || "pending",
      notes: notes || null,
    }).returning();

    const clientName = `${user.firstName} ${user.lastName}`;
    let invoice = null;

    // Auto-generate invoice if requested
    if (generateInvoice) {
      invoice = await createInvoiceForOrder(order, clientName);
      // If payment status is "paid", mark invoice paid
      if (paymentStatus === "paid") {
        await db.update(invoicesTable).set({ status: "paid", paidDate: new Date(), updatedAt: new Date() })
          .where(eq(invoicesTable.id, invoice.id));
        await db.update(ordersTable).set({ status: "approved", updatedAt: new Date() })
          .where(eq(ordersTable.id, order.id));
      }
    }

    // Re-fetch updated order
    const [finalOrder] = await db.select().from(ordersTable).where(eq(ordersTable.id, order.id)).limit(1);
    res.status(201).json({
      order: formatOrder(finalOrder, clientName),
      invoice: invoice ? { id: invoice.id, invoiceNumber: invoice.invoiceNumber, total: Number(invoice.total), status: invoice.status } : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: generate invoice for an order
router.post("/admin/orders/:id/generate-invoice", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, req.params.id)).limit(1);
    if (!order) { res.status(404).json({ error: "Not found" }); return; }

    // Check if invoice already exists
    if (order.invoiceId) {
      const [existing] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, order.invoiceId)).limit(1);
      if (existing) {
        res.json({ message: "Invoice already exists", invoiceId: existing.id, invoiceNumber: existing.invoiceNumber });
        return;
      }
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, order.clientId)).limit(1);
    const clientName = user ? `${user.firstName} ${user.lastName}` : "";
    const invoice = await createInvoiceForOrder(order, clientName);

    res.status(201).json({
      message: "Invoice generated",
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      total: Number(invoice.total),
      status: invoice.status,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Shared domain activation logic (orders context)
// invoiceDueDate: the invoice's due date (service renewal date = domain expiry for exact 365-day sync)
async function activateDomainOrderLocal(order: any, invoiceDueDate?: Date | null): Promise<void> {
  const fullDomain = (order.domain || order.itemName || "").toLowerCase().trim();
  const dotIdx = fullDomain.indexOf(".");
  const domainName = dotIdx > 0 ? fullDomain.substring(0, dotIdx) : fullDomain;
  const tld = dotIdx > 0 ? fullDomain.substring(dotIdx) : ".com";
  if (!domainName) return;

  const now = new Date();
  // 365-Day Rule: use invoice due date as master expiry for exact sync
  const expiryDate = (invoiceDueDate && !isNaN(new Date(invoiceDueDate).getTime()))
    ? new Date(invoiceDueDate)
    : (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d; })();

  // Exact match — no LIKE/partial matching
  const [existing] = await db.select().from(domainsTable)
    .where(and(eq(domainsTable.name, domainName), eq(domainsTable.tld, tld))).limit(1);

  if (existing) {
    await db.update(domainsTable).set({
      status: "active",
      expiryDate,
      nextDueDate: expiryDate,
      lockStatus: "unlocked",        // Remove transfer lock when domain is approved
      registrationDate: existing.registrationDate ?? now,
      updatedAt: now,
    }).where(eq(domainsTable.id, existing.id));
  } else {
    await db.insert(domainsTable).values({
      clientId: order.clientId,
      name: domainName,
      tld,
      status: "active",
      expiryDate,
      nextDueDate: expiryDate,
      lockStatus: "unlocked",
      registrationDate: now,
      autoRenew: true,
      nameservers: ["ns1.noehost.com", "ns2.noehost.com"],
    });
  }
  console.log(`[DOMAIN] Activated ${domainName}${tld} — expiry ${expiryDate.toISOString().slice(0, 10)} — order ${order.id}`);
}

// Admin: approve order → create service + invoice if needed
router.post("/admin/orders/:id/approve", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    // Optional: admin pre-selects a server at approval time (stored for use at activation)
    const { serverId: approveServerId } = req.body || {};

    const updateFields: any = { status: "approved", updatedAt: new Date() };
    if (approveServerId) updateFields.moduleServerId = approveServerId;

    const [updated] = await db.update(ordersTable)
      .set(updateFields)
      .where(eq(ordersTable.id, req.params.id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated.clientId)).limit(1);
    const clientName = user ? `${user.firstName} ${user.lastName}` : "";

    // Domain order: auto-activate the domain immediately on approve
    if (updated.type === "domain") {
      try {
        // Look up invoice due date for exact 365-day expiry sync
        let invDueDate: Date | null = null;
        if (updated.invoiceId) {
          const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, updated.invoiceId)).limit(1);
          if (inv) {
            invDueDate = inv.dueDate ?? null;
            // Mark zero-amount or unpaid invoices as paid
            if (Number(inv.total) === 0 || inv.status !== "paid") {
              await db.update(invoicesTable)
                .set({ status: "paid", paidDate: new Date(), updatedAt: new Date() })
                .where(eq(invoicesTable.id, inv.id));
            }
          }
        }
        await activateDomainOrderLocal(updated, invDueDate);

        // Send domain registration confirmation email (non-blocking)
        if (user) {
          const fullDomain = (updated.domain || updated.itemName || "").toLowerCase().trim();
          const now = new Date();
          const expiryDate = (invDueDate && !isNaN(new Date(invDueDate).getTime()))
            ? new Date(invDueDate)
            : (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d; })();
          const fmtDate = (d: Date) => d.toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" });
          emailDomainRegistered(user.email, {
            clientName: `${user.firstName} ${user.lastName ?? ""}`.trim(),
            domain: fullDomain,
            registrationDate: fmtDate(now),
            expiryDate: fmtDate(expiryDate),
            nextDueDate: fmtDate(expiryDate),
            ns1: "ns1.noehost.com",
            ns2: "ns2.noehost.com",
          }, { clientId: user.id, referenceId: updated.id }).catch(console.warn);
        }
      } catch (domErr: any) {
        console.warn("[ORDER APPROVE] Domain activation error:", domErr.message);
      }
      const [fresh] = await db.select().from(ordersTable).where(eq(ordersTable.id, updated.id)).limit(1);
      res.json({ order: formatOrder(fresh ?? updated, clientName), invoice: null });
      return;
    }

    // Auto-create hosting service if it's a hosting order with a package
    if (updated.type === "hosting" && updated.itemId && !updated.invoiceId) {
      try {
        const [plan] = await db.select().from(hostingPlansTable).where(eq(hostingPlansTable.id, updated.itemId)).limit(1);
        if (plan) {
          // Find server if module assigned
          let serverId: string | null = updated.moduleServerId || null;
          if (!serverId && updated.moduleType && updated.moduleType !== "none") {
            const [server] = await db.select({ id: serversTable.id }).from(serversTable)
              .where(eq(serversTable.type, updated.moduleType as any)).limit(1);
            serverId = server?.id || null;
          }
          const nextDue = new Date();
          const cycleMonths = updated.billingCycle === "yearly" ? 12 : updated.billingCycle === "semiannual" ? 6 : updated.billingCycle === "quarterly" ? 3 : 1;
          nextDue.setMonth(nextDue.getMonth() + cycleMonths);

          await db.insert(hostingServicesTable).values({
            clientId: updated.clientId,
            orderId: updated.id,
            planId: updated.itemId,
            planName: updated.itemName,
            domain: updated.domain || null,
            serverId,
            status: "pending",
            billingCycle: updated.billingCycle || "monthly",
            nextDueDate: updated.dueDate || nextDue,
          });
        }
      } catch (svcErr: any) {
        console.warn("[ORDER APPROVE] Could not create service:", svcErr.message);
      }
    }

    // Generate invoice if none exists
    let invoice = null;
    if (!updated.invoiceId) {
      invoice = await createInvoiceForOrder(updated, clientName);
    }

    res.json({
      order: formatOrder(updated, clientName),
      invoice: invoice ? { id: invoice.id, invoiceNumber: invoice.invoiceNumber } : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: activate order → provision service, mark invoice paid, set due dates
router.post("/admin/orders/:id/activate", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, req.params.id)).limit(1);
    if (!order) { res.status(404).json({ error: "Not found" }); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, order.clientId)).limit(1);
    const clientName = user ? `${user.firstName} ${user.lastName}` : "";

    // Accept admin-provided credentials and optional server/plan selection
    const { username: overrideUsername, password: overridePassword, serverId: overrideServerId, modulePlanId: overrideModulePlanId } = req.body || {};

    let provisionResult = null;
    let serviceId: string | null = null;

    // Find or create the hosting service — always use orderId for 1-to-1 mapping
    if (order.type === "hosting") {
      // Step 1: Look up service by orderId (accurate, no ambiguity)
      const [existingByOrder] = await db.select().from(hostingServicesTable)
        .where(eq(hostingServicesTable.orderId, order.id)).limit(1);

      if (existingByOrder) {
        serviceId = existingByOrder.id;
      } else if (order.itemId) {
        // No service linked to this order — create a fresh one
        const months = order.billingCycle === "yearly" ? 12
          : order.billingCycle === "quarterly" ? 3
          : order.billingCycle === "semiannual" ? 6 : 1;
        const nextDue = new Date();
        nextDue.setMonth(nextDue.getMonth() + months);
        const [newService] = await db.insert(hostingServicesTable).values({
          clientId: order.clientId,
          orderId: order.id,
          planId: order.itemId,
          planName: order.itemName,
          domain: order.domain || null,
          serverId: order.moduleServerId || null,
          status: "pending" as any,
          billingCycle: order.billingCycle || "monthly",
          nextDueDate: order.dueDate || nextDue,
        }).returning();
        serviceId = newService.id;
      }

      // Provision the service with optional admin credentials
      if (serviceId) {
        provisionResult = await provisionHostingService(serviceId, {
          username: overrideUsername || undefined,
          password: overridePassword || undefined,
          serverId: overrideServerId || undefined,
          // Use order's modulePlanId if set (admin override), else provision.ts uses plan's value
          modulePlanId: overrideModulePlanId || order.modulePlanId || undefined,
        });
        // Hard failures (missing required params, server config incomplete) → stop and surface error
        if (!provisionResult.success && !provisionResult.whmError) {
          res.status(400).json({ error: provisionResult.message });
          return;
        }
        // WHM/module errors are hard failures — service stays "pending", return error to admin
        // The admin must fix the issue (e.g. IP whitelist) and retry activation
        if (provisionResult.whmError) {
          console.warn("[ACTIVATE] WHM error (hard failure — service stays pending):", provisionResult.whmError);
          res.status(400).json({ error: `Hosting account could not be created: ${provisionResult.whmError}` });
          return;
        }
      }
    }

    // Activate the associated domain record when hosting is provisioned
    // (covers free-domain bundles and hosting+domain combo orders)
    if (order.domain && order.type === "hosting") {
      try {
        await activateDomainOrderLocal(order);
      } catch (domErr: any) {
        console.warn("[ACTIVATE] Domain activation error (non-fatal):", domErr.message);
      }
    }

    // Mark invoice as paid
    let invoiceId = order.invoiceId;
    if (!invoiceId) {
      const invoice = await createInvoiceForOrder(order, clientName);
      invoiceId = invoice.id;
    }
    await db.update(invoicesTable).set({ status: "paid", paidDate: new Date(), updatedAt: new Date() })
      .where(eq(invoicesTable.id, invoiceId!));

    // Update order
    const [updated] = await db.update(ordersTable).set({
      status: "approved",
      paymentStatus: "paid",
      invoiceId,
      updatedAt: new Date(),
    }).where(eq(ordersTable.id, order.id)).returning();

    // Fetch the service + server for response
    const service = serviceId
      ? await db.select().from(hostingServicesTable).where(eq(hostingServicesTable.id, serviceId)).limit(1).then(r => r[0])
      : null;
    const serverRecord = service?.serverId
      ? await db.select().from(serversTable).where(eq(serversTable.id, service.serverId)).limit(1).then(r => r[0])
      : null;

    res.json({
      order: formatOrder(updated, clientName),
      provision: provisionResult,
      whmError: provisionResult?.whmError || null,
      service: service ? {
        id: service.id,
        status: service.status,
        username: service.username,
        password: provisionResult?.credentials?.password || null,
        cpanelUrl: service.cpanelUrl,
        webmailUrl: service.webmailUrl,
        domain: service.domain,
        serverName: serverRecord?.name || null,
        serverHostname: serverRecord?.hostname || null,
      } : null,
      invoicePaid: true,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: cancel order
router.post("/admin/orders/:id/cancel", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [updated] = await db.update(ordersTable)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(ordersTable.id, req.params.id)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated.clientId)).limit(1);
    res.json(formatOrder(updated, user ? `${user.firstName} ${user.lastName}` : ""));
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Admin: suspend order
router.post("/admin/orders/:id/suspend", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [updated] = await db.update(ordersTable)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(eq(ordersTable.id, req.params.id)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated.clientId)).limit(1);
    res.json(formatOrder(updated, user ? `${user.firstName} ${user.lastName}` : ""));
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Admin: mark fraud
router.post("/admin/orders/:id/fraud", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [updated] = await db.update(ordersTable)
      .set({ status: "fraud", updatedAt: new Date() })
      .where(eq(ordersTable.id, req.params.id)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated.clientId)).limit(1);
    res.json(formatOrder(updated, user ? `${user.firstName} ${user.lastName}` : ""));
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Admin: terminate order
router.post("/admin/orders/:id/terminate", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [updated] = await db.update(ordersTable)
      .set({ status: "terminated", updatedAt: new Date() })
      .where(eq(ordersTable.id, req.params.id)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated.clientId)).limit(1);
    res.json(formatOrder(updated, user ? `${user.firstName} ${user.lastName}` : ""));
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Admin: activate domain order → create domain record and set active
router.post("/admin/orders/:id/activate-domain", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, req.params.id)).limit(1);
    if (!order) { res.status(404).json({ error: "Not found" }); return; }
    if (order.type !== "domain") { res.status(400).json({ error: "Not a domain order" }); return; }

    // Parse domain name and TLD from order
    const fullDomain = order.domain || order.itemName || "";
    const dotIdx = fullDomain.indexOf(".");
    const domainName = dotIdx > 0 ? fullDomain.substring(0, dotIdx) : fullDomain;
    const tld = dotIdx > 0 ? fullDomain.substring(dotIdx) : ".com";

    // Exact match on name AND tld — never use LIKE/partial matching for domain uniqueness
    const [alreadyExists] = await db.select().from(domainsTable)
      .where(and(
        eq(domainsTable.name, domainName),
        eq(domainsTable.tld, tld),
      )).limit(1);

    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    let domain;
    if (alreadyExists) {
      [domain] = await db.update(domainsTable)
        .set({ status: "active", expiryDate, nextDueDate: expiryDate, lockStatus: "unlocked", updatedAt: new Date() })
        .where(eq(domainsTable.id, alreadyExists.id))
        .returning();
    } else {
      [domain] = await db.insert(domainsTable).values({
        clientId: order.clientId,
        name: domainName,
        tld,
        status: "active",
        expiryDate,
        nextDueDate: expiryDate,
        registrationDate: new Date(),
        autoRenew: true,
        nameservers: ["ns1.noehost.com", "ns2.noehost.com"],
      }).returning();
    }

    // Mark order as approved
    const [updated] = await db.update(ordersTable)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(ordersTable.id, req.params.id))
      .returning();

    // Mark invoice as paid if exists (use correct column: paidDate)
    if (order.invoiceId) {
      await db.update(invoicesTable)
        .set({ status: "paid", paidDate: new Date(), updatedAt: new Date() })
        .where(eq(invoicesTable.id, order.invoiceId));
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, order.clientId)).limit(1);
    res.json({
      order: formatOrder(updated, user ? `${user.firstName} ${user.lastName}` : ""),
      domain: { id: domain.id, name: domain.name, tld: domain.tld, status: domain.status },
    });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Admin: refund order → cancel order and mark invoice as refunded
router.post("/admin/orders/:id/refund", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, req.params.id)).limit(1);
    if (!order) { res.status(404).json({ error: "Not found" }); return; }

    const [updated] = await db.update(ordersTable)
      .set({ status: "cancelled", notes: (order.notes ? order.notes + " | " : "") + "Refunded by admin", updatedAt: new Date() })
      .where(eq(ordersTable.id, req.params.id))
      .returning();

    // Mark invoice as refunded if exists
    if (order.invoiceId) {
      await db.update(invoicesTable)
        .set({ status: "refunded" } as any)
        .where(eq(invoicesTable.id, order.invoiceId));
    }

    // Suspend hosting service if exists
    if (order.type === "hosting") {
      await db.update(hostingServicesTable)
        .set({ status: "suspended" } as any)
        .where(eq(hostingServicesTable.clientId, order.clientId));
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, order.clientId)).limit(1);
    res.json(formatOrder(updated, user ? `${user.firstName} ${user.lastName}` : ""));
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Admin: update order status (generic)
router.put("/admin/orders/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { status, notes, billingCycle, dueDate, paymentStatus } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    if (billingCycle) updates.billingCycle = billingCycle;
    if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;
    if (paymentStatus) updates.paymentStatus = paymentStatus;
    const [updated] = await db.update(ordersTable).set(updates).where(eq(ordersTable.id, req.params.id)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated.clientId)).limit(1);
    res.json(formatOrder(updated, user ? `${user.firstName} ${user.lastName}` : ""));
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Admin: delete order
router.delete("/admin/orders/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [deleted] = await db.delete(ordersTable).where(eq(ordersTable.id, req.params.id)).returning();
    if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true, id: req.params.id });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

export default router;
