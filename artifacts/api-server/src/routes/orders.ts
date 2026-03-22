import { Router } from "express";
import { db } from "@workspace/db";
import {
  ordersTable, usersTable, hostingPlansTable, hostingServicesTable,
  invoicesTable, serversTable, domainsTable,
} from "@workspace/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { provisionHostingService } from "../lib/provision.js";

const router = Router();

async function generateInvoiceNumber(): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV-${dateStr}-${rand}`;
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: get all orders
router.get("/admin/orders", authenticate, requireAdmin, async (_req, res) => {
  try {
    const orders = await db.select().from(ordersTable).orderBy(sql`created_at DESC`);
    // Pre-fetch all plans so we can include moduleServerGroupId without N+1 queries
    const plans = await db.select({
      id: hostingPlansTable.id,
      moduleServerGroupId: hostingPlansTable.moduleServerGroupId,
    }).from(hostingPlansTable);
    const planMap = new Map(plans.map(p => [p.id, p]));

    const result = await Promise.all(orders.map(async (o) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, o.clientId)).limit(1);
      const service = await findServiceForOrder(o);
      const plan = o.itemId ? planMap.get(o.itemId) : null;
      return formatOrder(o, user ? `${user.firstName} ${user.lastName}` : "", service, plan?.moduleServerGroupId ?? null);
    }));
    res.json(result);
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

// Admin: approve order → create service + invoice if needed
router.post("/admin/orders/:id/approve", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [updated] = await db.update(ordersTable)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(ordersTable.id, req.params.id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated.clientId)).limit(1);
    const clientName = user ? `${user.firstName} ${user.lastName}` : "";

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

    // Accept admin-provided credentials and optional server selection
    const { username: overrideUsername, password: overridePassword, serverId: overrideServerId } = req.body || {};

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
        });
        // Hard failures (missing required params, server config incomplete) → stop and surface error
        if (!provisionResult.success && !provisionResult.whmError) {
          res.status(400).json({ error: provisionResult.message });
          return;
        }
        // WHM API errors are soft failures — log but continue (service saved in DB)
        if (provisionResult.whmError) {
          console.warn("[ACTIVATE] WHM error (soft failure):", provisionResult.whmError);
        }
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

    // Create or update domain record
    const existingDomains = await db.select().from(domainsTable)
      .where(eq(domainsTable.clientId, order.clientId)).limit(100);
    const alreadyExists = existingDomains.find(d => d.name === domainName && d.tld === tld);

    let domain;
    if (alreadyExists) {
      [domain] = await db.update(domainsTable)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(domainsTable.id, alreadyExists.id))
        .returning();
    } else {
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      [domain] = await db.insert(domainsTable).values({
        clientId: order.clientId,
        name: domainName,
        tld,
        status: "active",
        expiryDate,
        nextDueDate: expiryDate,
        registrationDate: new Date(),
      }).returning();
    }

    // Mark order as approved (active)
    const [updated] = await db.update(ordersTable)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(ordersTable.id, req.params.id))
      .returning();

    // Mark invoice as paid if exists
    if (order.invoiceId) {
      await db.update(invoicesTable)
        .set({ status: "paid", paidAt: new Date() } as any)
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

export default router;
