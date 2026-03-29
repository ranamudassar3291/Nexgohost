import { Router } from "express";
import { db } from "@workspace/db";
import { sendWhatsAppAlert, sendToClientPhone } from "../lib/whatsapp.js";
import { invoicesTable, transactionsTable, usersTable, ordersTable, creditTransactionsTable, domainsTable, hostingServicesTable, affiliateCommissionsTable, affiliatesTable } from "@workspace/db/schema";
import { eq, sql, desc, ilike, or, and, inArray } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { emailInvoicePaid } from "../lib/email.js";
import { provisionHostingService } from "../lib/provision.js";
import { generateInvoicePdf } from "../lib/invoicePdf.js";

const router = Router();

function isUnpaidStatus(status: string | null | undefined): boolean {
  return ["unpaid", "overdue"].includes(status ?? "");
}

// Shared domain activation logic — used by mark-paid, approve, and zero-amount checkout
// invoiceDueDate: the invoice's due date (service renewal date = domain expiry date for exact sync)
async function activateDomainOrder(order: any, invoiceNumber?: string, invoiceDueDate?: Date | null): Promise<void> {
  const fullDomain = (order.domain || order.itemName || "").toLowerCase().trim();
  const dotIdx = fullDomain.indexOf(".");
  const domainName = dotIdx > 0 ? fullDomain.substring(0, dotIdx) : fullDomain;
  const tld = dotIdx > 0 ? fullDomain.substring(dotIdx) : ".com";
  if (!domainName) return;

  const now = new Date();
  // 365-Day Rule: use invoice due date as the master expiry for exact sync across domain + hosting + invoice
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
      lockStatus: "unlocked",          // Remove transfer lock when invoice is paid
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

  // Approve the order
  await db.update(ordersTable).set({ status: "approved", updatedAt: now })
    .where(eq(ordersTable.id, order.id));

  console.log(`[DOMAIN] Activated ${domainName}${tld} — expiry ${expiryDate.toISOString().slice(0, 10)} — order ${order.id}${invoiceNumber ? ` (invoice ${invoiceNumber})` : ""}`);
}

async function processRenewalOrder(order: typeof ordersTable.$inferSelect) {
  if (order.type !== "renewal" || !order.itemId) return;
  const [domain] = await db.select().from(domainsTable).where(eq(domainsTable.id, order.itemId)).limit(1);
  if (!domain) return;
  const current = domain.expiryDate ? new Date(domain.expiryDate) : new Date();
  const extended = new Date(current);
  extended.setFullYear(extended.getFullYear() + 1);
  await db.update(domainsTable)
    .set({ expiryDate: extended.toISOString().split("T")[0], status: "active", updatedAt: new Date() })
    .where(eq(domainsTable.id, domain.id));
  await db.update(ordersTable)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(ordersTable.id, order.id));
  console.log(`[RENEWAL] Domain ${domain.name}${domain.tld} renewed → new expiry ${extended.toISOString().split("T")[0]}`);
}

let invoiceCounter = 1000;

function toISO(d: any): string | undefined {
  if (!d) return undefined;
  if (d instanceof Date) return d.toISOString();
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function formatInvoice(i: any, clientName?: string) {
  const rawItems = (i.items ?? []) as Array<any>;
  const items = rawItems.map((item: any) => ({
    description: item.description ?? "Hosting Service",
    quantity: item.quantity ?? 1,
    unitPrice: item.unitPrice ?? item.amount ?? Number(i.amount ?? 0),
    total: item.total ?? item.amount ?? Number(i.amount ?? 0),
  }));
  const paymentNotes = i.paymentNotes ?? i.payment_notes;
  const isRefundPending = typeof paymentNotes === "string" && paymentNotes.startsWith("REFUND_REQUEST:");
  return {
    id: i.id,
    invoiceNumber: i.invoiceNumber ?? i.invoice_number,
    clientId: i.clientId ?? i.client_id,
    clientName: clientName || "",
    amount: Number(i.amount ?? 0),
    tax: Number(i.tax ?? 0),
    total: Number(i.total ?? 0),
    status: i.status,
    displayStatus: isRefundPending && i.status === "paid" ? "refund_pending" : i.status,
    dueDate: toISO(i.dueDate ?? i.due_date) ?? new Date().toISOString(),
    paidDate: toISO(i.paidDate ?? i.paid_date),
    paymentRef: i.paymentRef ?? i.payment_ref,
    paymentGatewayId: i.paymentGatewayId ?? i.payment_gateway_id,
    paymentNotes,
    invoiceType: i.invoiceType ?? i.invoice_type,
    currencyCode: i.currencyCode ?? i.currency_code ?? "PKR",
    currencySymbol: i.currencySymbol ?? i.currency_symbol ?? "Rs.",
    currencyRate: Number(i.currencyRate ?? i.currency_rate ?? 1),
    items,
    createdAt: toISO(i.createdAt ?? i.created_at) ?? new Date().toISOString(),
  };
}

// Client: get single invoice
router.get("/my/invoices/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const [invoice] = await db.select().from(invoicesTable)
      .where(eq(invoicesTable.id, req.params.id)).limit(1);
    if (!invoice) { res.status(404).json({ error: "Not found" }); return; }
    if (invoice.clientId !== req.user!.userId) { res.status(403).json({ error: "Forbidden" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    res.json(formatInvoice(invoice, user ? `${user.firstName} ${user.lastName}` : ""));
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Client: submit payment reference for an unpaid invoice
router.post("/my/invoices/:id/submit-payment", authenticate, async (req: AuthRequest, res) => {
  try {
    const [invoice] = await db.select().from(invoicesTable)
      .where(eq(invoicesTable.id, req.params.id)).limit(1);
    if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
    if (invoice.clientId !== req.user!.userId) { res.status(403).json({ error: "Forbidden" }); return; }
    if (!["unpaid", "overdue"].includes(invoice.status)) {
      res.status(400).json({ error: "Invoice is not unpaid" }); return;
    }
    const { paymentRef, paymentGatewayId, paymentNotes } = req.body || {};
    if (!paymentRef || !paymentGatewayId) {
      res.status(400).json({ error: "paymentRef and paymentGatewayId are required" }); return;
    }
    const [updated] = await db.update(invoicesTable)
      .set({
        status: "payment_pending",
        paymentRef: String(paymentRef).trim(),
        paymentGatewayId: String(paymentGatewayId),
        paymentNotes: paymentNotes ? String(paymentNotes).trim() : null,
        updatedAt: new Date(),
      })
      .where(eq(invoicesTable.id, req.params.id))
      .returning();
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    res.json(formatInvoice(updated, user ? `${user.firstName} ${user.lastName}` : ""));

    // WhatsApp alert (non-blocking)
    const adminUrl = process.env.ADMIN_PANEL_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "noehost.com"}`;
    sendWhatsAppAlert("payment_proof",
      `💰 *Payment Submitted — Noehost*\n\n` +
      `👤 Client: ${user ? `${user.firstName} ${user.lastName}` : "Unknown"}\n` +
      `📧 Email: ${user?.email ?? "—"}\n` +
      `🧾 Invoice: ${invoice.invoiceNumber}\n` +
      `💵 Amount: PKR ${Number(invoice.amount).toLocaleString()}\n` +
      `🏦 Transaction Ref: ${paymentRef}\n` +
      (paymentNotes ? `📱 Sender Info: ${paymentNotes}\n` : "") +
      `\n🔗 View Invoice:\n${adminUrl}/admin/invoices/${invoice.id}\n\n` +
      `⚠️ *Please verify and mark as paid.*\n` +
      `_${new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}_`
    ).catch(() => {});

  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Client: get my invoices
router.get("/invoices", authenticate, async (req: AuthRequest, res) => {
  try {
    const invoices = await db.select().from(invoicesTable).where(eq(invoicesTable.clientId, req.user!.userId)).orderBy(sql`created_at DESC`);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    res.json(invoices.map(i => formatInvoice(i, user ? `${user.firstName} ${user.lastName}` : "")));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Client: request a refund (within 30 days of payment)
router.post("/invoices/:id/refund-request", authenticate, async (req: AuthRequest, res) => {
  try {
    const { reason } = req.body || {};
    if (!reason || !String(reason).trim()) {
      res.status(400).json({ error: "A reason is required for the refund request." }); return;
    }

    const [invoice] = await db.select().from(invoicesTable)
      .where(eq(invoicesTable.id, req.params.id)).limit(1);
    if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
    if (invoice.clientId !== req.user!.userId) { res.status(403).json({ error: "Forbidden" }); return; }
    if (invoice.status !== "paid") {
      res.status(400).json({ error: "Only paid invoices can be refunded." }); return;
    }

    // Check 30-day refund window
    const paidAt = invoice.paidDate ?? invoice.createdAt;
    const daysSincePaid = Math.floor((Date.now() - new Date(paidAt).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSincePaid > 30) {
      res.status(400).json({ error: "Refund window has expired. Refunds are only available within 30 days of payment." }); return;
    }

    // Check if refund already requested
    if (typeof invoice.paymentNotes === "string" && invoice.paymentNotes.startsWith("REFUND_REQUEST:")) {
      res.status(400).json({ error: "A refund request has already been submitted for this invoice." }); return;
    }

    const refundNote = `REFUND_REQUEST: ${String(reason).trim()}`;
    const [updated] = await db.update(invoicesTable)
      .set({ paymentNotes: refundNote, updatedAt: new Date() })
      .where(eq(invoicesTable.id, req.params.id))
      .returning();

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    res.json(formatInvoice(updated, user ? `${user.firstName} ${user.lastName}` : ""));

    // WhatsApp admin alert (non-blocking)
    sendWhatsAppAlert("refund_request",
      `🔄 *Refund Request — Noehost*\n\n` +
      `👤 Client: ${user ? `${user.firstName} ${user.lastName}` : "Unknown"}\n` +
      `📧 Email: ${user?.email ?? "—"}\n` +
      `🧾 Invoice: ${invoice.invoiceNumber}\n` +
      `💵 Amount: ${invoice.currencySymbol ?? "Rs."}${Number(invoice.total).toLocaleString()}\n` +
      `📝 Reason: ${reason}\n\n` +
      `_Please review and process the refund._`
    ).catch(() => {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: get all invoices
router.get("/admin/invoices", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1")));
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || "50"))));
    const search = String(req.query.search || "").trim();
    const statusFilter = String(req.query.status || "all");
    const clientId = String(req.query.clientId || "").trim();
    const offset = (page - 1) * limit;

    // Build query — if search looks like a client name, JOIN users
    let filterSql = sql`1=1`;
    if (statusFilter !== "all") filterSql = sql`${filterSql} AND i.status = ${statusFilter}`;
    if (clientId) filterSql = sql`${filterSql} AND i.client_id = ${clientId}`;
    if (search) {
      filterSql = sql`${filterSql} AND (
        i.invoice_number ILIKE ${'%' + search + '%'}
        OR i.payment_notes ILIKE ${'%' + search + '%'}
        OR i.client_id IN (
          SELECT id FROM users 
          WHERE role='client' AND (
            first_name ILIKE ${'%' + search + '%'} OR
            last_name ILIKE ${'%' + search + '%'} OR
            email ILIKE ${'%' + search + '%'} OR
            (first_name || ' ' || last_name) ILIKE ${'%' + search + '%'}
          )
        )
      )`;
    }

    const countResult = await db.execute(sql`SELECT COUNT(*)::int as total FROM invoices i WHERE ${filterSql}`);
    const countRows: any[] = (countResult as any).rows ?? (countResult as any);
    const total = Number(countRows[0]?.total ?? 0);

    const invoiceResult = await db.execute(
      sql`SELECT i.* FROM invoices i WHERE ${filterSql} ORDER BY i.created_at DESC LIMIT ${limit} OFFSET ${offset}`
    );
    const invoiceRows: any[] = (invoiceResult as any).rows ?? (invoiceResult as any);

    const clientIds = [...new Set(invoiceRows.map((i: any) => i.client_id).filter(Boolean))];
    const users = clientIds.length > 0
      ? await db.select().from(usersTable).where(inArray(usersTable.id, clientIds as string[]))
      : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    const result = invoiceRows.map((row: any) => {
      const clientId = row.client_id ?? row.clientId;
      const user = userMap.get(clientId);
      return formatInvoice(row, user ? `${user.firstName} ${user.lastName}` : "");
    });

    res.json({ data: result, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: create invoice
router.post("/admin/invoices", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { clientId, items, dueDate, tax = 0 } = req.body;
    const amount = items.reduce((sum: number, item: { total: number }) => sum + item.total, 0);
    const total = amount + tax;
    invoiceCounter++;
    const invoiceNumber = `INV-${Date.now()}-${invoiceCounter}`;

    const [invoice] = await db.insert(invoicesTable).values({
      invoiceNumber,
      clientId,
      amount: String(amount),
      tax: String(tax),
      total: String(total),
      status: "unpaid",
      dueDate: new Date(dueDate),
      items: items,
    }).returning();

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, clientId)).limit(1);
    res.status(201).json(formatInvoice(invoice, user ? `${user.firstName} ${user.lastName}` : ""));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: cancel invoice
router.post("/admin/invoices/:id/cancel", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [updated] = await db.update(invoicesTable)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(invoicesTable.id, req.params.id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated.clientId)).limit(1);
    res.json(formatInvoice(updated, user ? `${user.firstName} ${user.lastName}` : ""));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: mark invoice paid
router.post("/admin/invoices/:id/mark-paid", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [updated] = await db.update(invoicesTable)
      .set({ status: "paid", paidDate: new Date(), updatedAt: new Date() })
      .where(eq(invoicesTable.id, req.params.id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }

    // Auto-credit wallet if this is an "Account Deposit" invoice
    try {
      const items = (updated.items ?? []) as Array<{ description: string; total: number }>;
      const isDeposit =
        (updated as any).invoiceType === "deposit" ||
        items.some(it =>
          it.description === "Account Deposit" ||
          it.description === "Account Credit Deposit" ||
          it.description?.toLowerCase().includes("deposit")
        );
      if (isDeposit) {
        const depositAmt = parseFloat(updated.total);
        const [u] = await db.select({ creditBalance: usersTable.creditBalance })
          .from(usersTable).where(eq(usersTable.id, updated.clientId)).limit(1);
        const newBal = (parseFloat(u?.creditBalance ?? "0") + depositAmt).toFixed(2);
        await db.update(usersTable)
          .set({ creditBalance: newBal, updatedAt: new Date() })
          .where(eq(usersTable.id, updated.clientId));
        await db.insert(creditTransactionsTable).values({
          userId: updated.clientId,
          amount: String(depositAmt),
          type: "admin_add",
          description: `Wallet top-up — invoice ${updated.invoiceNumber}`,
          invoiceId: updated.id,
          performedBy: req.user!.userId,
        });
        console.log(`[WALLET] Credited Rs. ${depositAmt} to user ${updated.clientId} from deposit invoice ${updated.invoiceNumber}`);
      }
    } catch (e) { console.error("[WALLET] deposit credit error:", e); }

    // Handle downstream: renewal order → extend domain expiry, hosting → provision, domain → activate
    try {
      const [order] = updated.orderId
        ? await db.select().from(ordersTable).where(eq(ordersTable.id, updated.orderId!)).limit(1)
        : [];
      if (order?.type === "renewal") await processRenewalOrder(order);
      else if (order?.type === "hosting") {
        const [svc] = await db.select().from(hostingServicesTable)
          .where(eq(hostingServicesTable.orderId, order.id)).limit(1);
        if (svc) {
          if (svc.serviceType === "vps") {
            // VPS Provisioning Module: mark service as active + record provision timestamp
            await db.update(hostingServicesTable).set({
              status: "active",
              vpsProvisionStatus: "provisioned",
              vpsProvisionedAt: new Date(),
              vpsProvisionNotes: `Activated on invoice ${updated.invoiceNumber} — awaiting hypervisor sync`,
              updatedAt: new Date(),
            } as any).where(eq(hostingServicesTable.id, svc.id));
            await db.update(ordersTable).set({ status: "approved", updatedAt: new Date() })
              .where(eq(ordersTable.id, order.id));
            console.log(`[VPS] Service ${svc.id} activated for invoice ${updated.invoiceNumber}`);
          } else {
            await provisionHostingService(svc.id);
          }
        }
      } else if (order?.type === "domain") {
        // Domain Activation Module: pass invoice due date for exact 365-day expiry sync
        await activateDomainOrder(order, updated.invoiceNumber, updated.dueDate ?? null);
      }
    } catch (e) { console.error("[PROVISION] mark-paid downstream error:", e); /* non-blocking */ }

    // Renewal invoice (serviceId set, no orderId) — update service nextDueDate from payment date
    try {
      if (updated.serviceId && !updated.orderId) {
        const [svc] = await db.select({
          id: hostingServicesTable.id,
          billingCycle: hostingServicesTable.billingCycle,
        }).from(hostingServicesTable)
          .where(eq(hostingServicesTable.id, updated.serviceId)).limit(1);

        if (svc) {
          const paidDate = new Date();
          const newNextDueDate = new Date(paidDate);
          if (svc.billingCycle === "yearly") {
            newNextDueDate.setFullYear(newNextDueDate.getFullYear() + 1);
          } else {
            newNextDueDate.setMonth(newNextDueDate.getMonth() + 1);
          }
          newNextDueDate.setHours(0, 0, 0, 0);

          await db.update(hostingServicesTable)
            .set({ nextDueDate: newNextDueDate, status: "active", updatedAt: new Date() })
            .where(eq(hostingServicesTable.id, svc.id));

          console.log(`[RENEWAL] Service ${svc.id} next due updated to ${newNextDueDate.toISOString().slice(0, 10)}`);
        }
      }
    } catch (e) { console.error("[RENEWAL] nextDueDate update error:", e); }

    // Auto-approve & credit affiliate commission when order invoice is paid
    try {
      if (updated.orderId) {
        const [pendingComm] = await db.select().from(affiliateCommissionsTable)
          .where(and(eq(affiliateCommissionsTable.orderId, updated.orderId), eq(affiliateCommissionsTable.status, "pending")))
          .limit(1);
        if (pendingComm) {
          await db.update(affiliateCommissionsTable)
            .set({ status: "approved", paidAt: new Date() })
            .where(eq(affiliateCommissionsTable.id, pendingComm.id));

          const [affiliate] = await db.select({ userId: affiliatesTable.userId })
            .from(affiliatesTable).where(eq(affiliatesTable.id, pendingComm.affiliateId)).limit(1);
          if (affiliate) {
            await db.update(usersTable)
              .set({ creditBalance: sql`COALESCE(${usersTable.creditBalance}::numeric, 0) + ${pendingComm.amount}::numeric`, updatedAt: new Date() })
              .where(eq(usersTable.id, affiliate.userId));
            await db.insert(creditTransactionsTable).values({
              userId: affiliate.userId,
              amount: pendingComm.amount,
              type: "affiliate_payout",
              description: `Affiliate commission — invoice ${updated.invoiceNumber}`,
              performedBy: req.user!.userId,
            });
            await db.update(affiliatesTable)
              .set({
                pendingEarnings: sql`GREATEST(0, ${affiliatesTable.pendingEarnings}::numeric - ${pendingComm.amount}::numeric)`,
                paidEarnings: sql`${affiliatesTable.paidEarnings}::numeric + ${pendingComm.amount}::numeric`,
                updatedAt: new Date(),
              })
              .where(eq(affiliatesTable.id, pendingComm.affiliateId));
            console.log(`[AFFILIATE] Credited Rs. ${pendingComm.amount} to affiliate ${pendingComm.affiliateId} for invoice ${updated.invoiceNumber}`);
          }
        }
      }
    } catch (e) { console.error("[AFFILIATE] commission auto-credit error:", e); }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated.clientId)).limit(1);
    res.json(formatInvoice(updated, user ? `${user.firstName} ${user.lastName}` : ""));

    // WhatsApp invoice-paid notification to client (non-blocking)
    if (user?.phone) {
      const currencySymbol = (updated as any).currencySymbol || "Rs.";
      const totalDisplay = `${currencySymbol}${parseFloat(updated.total).toLocaleString("en-PK")}`;
      sendToClientPhone(
        user.phone,
        `✅ *Invoice Paid — Noehost*\n\n` +
        `Hi ${user.firstName},\n\n` +
        `Your invoice *${updated.invoiceNumber}* has been marked as paid.\n\n` +
        `💰 Amount: ${totalDisplay}\n` +
        `📅 Paid on: ${new Date().toLocaleDateString("en-PK")}\n\n` +
        `Thank you for your payment! Your service will be activated shortly.\n\n` +
        `_Noehost Team_ 🚀`,
        "invoice_paid"
      ).catch(() => {});
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Client: submit payment notification (does NOT mark invoice as paid — admin must verify and mark paid)
router.post("/invoices/:id/pay", authenticate, async (req: AuthRequest, res) => {
  try {
    const { method = "manual" } = req.body;
    const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, req.params.id)).limit(1);
    if (!invoice) { res.status(404).json({ error: "Not found" }); return; }
    if (invoice.clientId !== req.user!.userId) { res.status(403).json({ error: "Forbidden" }); return; }
    if (invoice.status === "paid") { res.json({ success: true, message: "Already paid" }); return; }

    // Record a pending transaction — admin must verify and mark the invoice paid
    const transactionRef = `NOTIFY-${Date.now()}`;
    const [tx] = await db.insert(transactionsTable).values({
      clientId: req.user!.userId,
      invoiceId: invoice.id,
      amount: invoice.total,
      method,
      status: "pending",
      transactionRef,
    }).returning();

    console.log(`[PAYMENT NOTIFY] Client ${req.user!.userId} submitted payment notification for invoice ${invoice.invoiceNumber} (tx: ${tx.id})`);

    res.json({
      success: true,
      transactionId: tx.id,
      message: "Payment notification submitted. Our team will verify and activate your service.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Client: create a wallet deposit invoice (Add Funds)
router.post("/my/invoices/deposit", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { amount } = req.body || {};
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 100 || amt > 100000) {
      res.status(400).json({ error: "Amount must be between 100 and 100,000" }); return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    invoiceCounter++;
    const invoiceNumber = `DEP-${Date.now()}-${invoiceCounter}`;
    const due = new Date(); due.setDate(due.getDate() + 7);
    const items = [{ description: "Account Deposit", quantity: 1, unitPrice: amt, total: amt }];
    const [invoice] = await db.insert(invoicesTable).values({
      invoiceNumber,
      clientId: userId,
      amount: String(amt),
      tax: "0",
      total: String(amt),
      status: "unpaid",
      dueDate: due,
      items,
    }).returning();

    res.status(201).json(formatInvoice(invoice, `${user.firstName} ${user.lastName}`));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get transactions
router.get("/payments/transactions", authenticate, async (req: AuthRequest, res) => {
  try {
    let transactions;
    if (req.user!.role === "admin") {
      transactions = await db.select().from(transactionsTable).orderBy(sql`created_at DESC`);
    } else {
      transactions = await db.select().from(transactionsTable).where(eq(transactionsTable.clientId, req.user!.userId)).orderBy(sql`created_at DESC`);
    }
    const result = await Promise.all(transactions.map(async (t) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, t.clientId)).limit(1);
      return {
        id: t.id,
        clientId: t.clientId,
        clientName: user ? `${user.firstName} ${user.lastName}` : "",
        invoiceId: t.invoiceId,
        amount: Number(t.amount),
        method: t.method,
        status: t.status,
        transactionRef: t.transactionRef,
        createdAt: t.createdAt.toISOString(),
      };
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Client: pay invoice with account credits
router.post("/my/invoices/:id/pay-with-credits", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const [invoice] = await db.select().from(invoicesTable)
      .where(eq(invoicesTable.id, req.params.id)).limit(1);
    if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
    if (invoice.clientId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }
    if (invoice.status !== "unpaid") {
      res.status(400).json({ error: `Invoice cannot be paid — current status is ${invoice.status}` }); return;
    }

    const invoiceTotal = parseFloat(invoice.total);
    const [user] = await db.select({ creditBalance: usersTable.creditBalance })
      .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const balance = parseFloat(user.creditBalance ?? "0");
    if (balance < invoiceTotal) {
      res.status(400).json({
        error: `Insufficient credits. Your balance is Rs. ${balance.toFixed(2)} but invoice total is Rs. ${invoiceTotal.toFixed(2)}.`,
        creditBalance: balance,
      }); return;
    }

    const newBalance = parseFloat((balance - invoiceTotal).toFixed(2));

    // Deduct credits
    await db.update(usersTable)
      .set({ creditBalance: String(newBalance), updatedAt: new Date() })
      .where(eq(usersTable.id, userId));

    // Record credit transaction
    await db.insert(creditTransactionsTable).values({
      userId,
      amount: String(invoiceTotal),
      type: "invoice_payment",
      description: `Payment for invoice ${invoice.invoiceNumber}`,
      invoiceId: invoice.id,
      performedBy: userId,
    });

    // Mark invoice paid
    const [updated] = await db.update(invoicesTable)
      .set({
        status: "paid",
        paidDate: new Date(),
        paymentRef: `CREDIT-${Date.now()}`,
        paymentNotes: "Paid with account credits",
        updatedAt: new Date(),
      })
      .where(eq(invoicesTable.id, invoice.id))
      .returning();

    console.log(`[CREDITS] Invoice ${invoice.invoiceNumber} paid with credits by ${userId}. New balance: Rs. ${newBalance}`);

    // Provision hosting or process renewal if applicable
    try {
      const [order] = updated.orderId
        ? await db.select().from(ordersTable).where(eq(ordersTable.id, updated.orderId!)).limit(1)
        : [];
      if (order?.type === "renewal") await processRenewalOrder(order);
      else if (order?.type === "hosting") {
        const [svc] = await db.select().from(hostingServicesTable)
          .where(eq(hostingServicesTable.orderId, order.id)).limit(1);
        if (svc) await provisionHostingService(svc.id);
      }
    } catch { /* non-blocking */ }

    // Send paid email with PDF attachment
    try {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      if (u) {
        const inv = formatInvoice(updated, `${u.firstName} ${u.lastName}`);
        let pdfBuf: Buffer | undefined;
        try {
          pdfBuf = await generateInvoicePdf({
            invoiceNumber: inv.invoiceNumber, status: "paid",
            createdAt: inv.createdAt, dueDate: inv.dueDate, paidDate: inv.paidDate,
            clientName: `${u.firstName} ${u.lastName}`, clientEmail: u.email,
            amount: inv.amount, tax: inv.tax, total: inv.total, items: inv.items,
            paymentRef: inv.paymentRef, paymentNotes: inv.paymentNotes,
            currencyCode: (updated as any).currencyCode ?? "PKR",
            currencySymbol: (updated as any).currencySymbol ?? "Rs.",
            currencyRate: Number((updated as any).currencyRate ?? 1),
          });
        } catch { /* PDF generation failure is non-fatal */ }
        await emailInvoicePaid(u.email, {
          clientName: `${u.firstName} ${u.lastName}`,
          invoiceId: updated.id,
          invoiceNumber: inv.invoiceNumber,
          amount: `Rs. ${Number(updated.total).toFixed(2)}`,
          paymentDate: new Date().toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" }),
          invoicePdf: pdfBuf,
        });
      }
    } catch { /* non-blocking */ }

    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    res.json({
      ...formatInvoice(updated, u ? `${u.firstName} ${u.lastName}` : ""),
      creditBalance: String(newBalance),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Stripe payment intent (placeholder)
router.post("/payments/stripe/create-intent", authenticate, async (req: AuthRequest, res) => {
  try {
    const { invoiceId, amount } = req.body;
    const paymentIntentId = `pi_${Date.now()}`;
    res.json({
      clientSecret: `${paymentIntentId}_secret_${Math.random().toString(36).slice(2)}`,
      paymentIntentId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: edit invoice (status, dates, notes, amount)
router.put("/admin/invoices/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { status, dueDate, paidDate, paymentNotes, paymentRef, amount, total } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;
    if (paidDate !== undefined) updates.paidDate = paidDate ? new Date(paidDate) : null;
    if (paymentNotes !== undefined) updates.paymentNotes = paymentNotes;
    if (paymentRef !== undefined) updates.paymentRef = paymentRef;
    if (amount !== undefined) updates.amount = String(amount);
    if (total !== undefined) updates.total = String(total);
    const [updated] = await db.update(invoicesTable).set(updates).where(eq(invoicesTable.id, req.params.id)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated.clientId)).limit(1);
    res.json(formatInvoice(updated, user ? `${user.firstName} ${user.lastName}` : ""));
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Admin: delete invoice
router.delete("/admin/invoices/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [deleted] = await db.delete(invoicesTable).where(eq(invoicesTable.id, req.params.id)).returning();
    if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true, id: req.params.id });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// ── PDF Download: Client ───────────────────────────────────────────────────────
router.get("/my/invoices/:id/pdf", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const [invoice] = await db.select().from(invoicesTable)
      .where(and(eq(invoicesTable.id, req.params.id), eq(invoicesTable.clientId, userId)))
      .limit(1);
    if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const clientName = user ? `${user.firstName} ${user.lastName}` : "Client";
    const clientEmail = user?.email ?? "";
    const rawItems = (invoice.items ?? []) as Array<any>;
    const items = rawItems.map((it: any) => ({
      description: it.description ?? "Service",
      quantity: it.quantity ?? 1,
      unitPrice: Number(it.unitPrice ?? it.amount ?? invoice.amount ?? 0),
      total: Number(it.total ?? it.amount ?? invoice.amount ?? 0),
    }));
    // Include user's account credit so it appears as a deduction on the PDF
    const creditApplied = isUnpaidStatus(invoice.status)
      ? Math.min(parseFloat(user?.creditBalance ?? "0"), Number(invoice.total ?? 0))
      : 0;
    const pdf = await generateInvoicePdf({
      invoiceNumber: invoice.invoiceNumber ?? invoice.id,
      status: invoice.status ?? "unpaid",
      createdAt: invoice.createdAt?.toISOString() ?? new Date().toISOString(),
      dueDate: invoice.dueDate?.toISOString() ?? new Date().toISOString(),
      paidDate: invoice.paidDate?.toISOString() ?? null,
      clientName,
      clientEmail,
      amount: Number(invoice.amount ?? 0),
      tax: Number(invoice.tax ?? 0),
      total: Number(invoice.total ?? 0),
      creditApplied,
      items,
      paymentRef: invoice.paymentRef ?? null,
      paymentNotes: invoice.paymentNotes ?? null,
      currencyCode: (invoice as any).currencyCode ?? "PKR",
      currencySymbol: (invoice as any).currencySymbol ?? "Rs.",
      currencyRate: Number((invoice as any).currencyRate ?? 1),
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Noehost-Invoice-${invoice.invoiceNumber ?? invoice.id}.pdf"`);
    res.setHeader("Content-Length", pdf.length);
    res.end(pdf);
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// ── PDF Download: Admin ────────────────────────────────────────────────────────
router.get("/admin/invoices/:id/pdf", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, req.params.id)).limit(1);
    if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, invoice.clientId)).limit(1);
    const clientName = user ? `${user.firstName} ${user.lastName}` : "Client";
    const clientEmail = user?.email ?? "";
    const rawItems = (invoice.items ?? []) as Array<any>;
    const items = rawItems.map((it: any) => ({
      description: it.description ?? "Service",
      quantity: it.quantity ?? 1,
      unitPrice: Number(it.unitPrice ?? it.amount ?? invoice.amount ?? 0),
      total: Number(it.total ?? it.amount ?? invoice.amount ?? 0),
    }));
    const pdf = await generateInvoicePdf({
      invoiceNumber: invoice.invoiceNumber ?? invoice.id,
      status: invoice.status ?? "unpaid",
      createdAt: invoice.createdAt?.toISOString() ?? new Date().toISOString(),
      dueDate: invoice.dueDate?.toISOString() ?? new Date().toISOString(),
      paidDate: invoice.paidDate?.toISOString() ?? null,
      clientName,
      clientEmail,
      amount: Number(invoice.amount ?? 0),
      tax: Number(invoice.tax ?? 0),
      total: Number(invoice.total ?? 0),
      items,
      paymentRef: invoice.paymentRef ?? null,
      paymentNotes: invoice.paymentNotes ?? null,
      currencyCode: (invoice as any).currencyCode ?? "PKR",
      currencySymbol: (invoice as any).currencySymbol ?? "Rs.",
      currencyRate: Number((invoice as any).currencyRate ?? 1),
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Noehost-Invoice-${invoice.invoiceNumber ?? invoice.id}.pdf"`);
    res.setHeader("Content-Length", pdf.length);
    res.end(pdf);
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

export default router;
