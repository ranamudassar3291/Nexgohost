import { Router } from "express";
import { db } from "@workspace/db";
import { invoicesTable, transactionsTable, usersTable, ordersTable, creditTransactionsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { emailInvoicePaid } from "../lib/email.js";
import { provisionHostingService } from "../lib/provision.js";

const router = Router();

let invoiceCounter = 1000;

function formatInvoice(i: typeof invoicesTable.$inferSelect, clientName?: string) {
  return {
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    clientId: i.clientId,
    clientName: clientName || "",
    amount: Number(i.amount),
    tax: Number(i.tax),
    total: Number(i.total),
    status: i.status,
    dueDate: i.dueDate.toISOString(),
    paidDate: i.paidDate?.toISOString(),
    paymentRef: i.paymentRef,
    paymentGatewayId: i.paymentGatewayId,
    paymentNotes: i.paymentNotes,
    items: i.items as Array<{ description: string; quantity: number; unitPrice: number; total: number }>,
    createdAt: i.createdAt.toISOString(),
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

// Admin: get all invoices
router.get("/admin/invoices", authenticate, requireAdmin, async (_req, res) => {
  try {
    const invoices = await db.select().from(invoicesTable).orderBy(sql`created_at DESC`);
    const result = await Promise.all(invoices.map(async (i) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, i.clientId)).limit(1);
      return formatInvoice(i, user ? `${user.firstName} ${user.lastName}` : "");
    }));
    res.json(result);
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
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated.clientId)).limit(1);
    res.json(formatInvoice(updated, user ? `${user.firstName} ${user.lastName}` : ""));
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

    // Provision hosting if applicable
    try {
      const [order] = updated.orderId
        ? await db.select().from(ordersTable).where(eq(ordersTable.id, updated.orderId!)).limit(1)
        : [];
      if (order?.type === "hosting") {
        await provisionHostingService(order, updated);
      }
    } catch { /* non-blocking */ }

    // Send paid email
    try {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      if (u) await emailInvoicePaid(u.email, `${u.firstName} ${u.lastName}`, formatInvoice(updated));
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

export default router;
