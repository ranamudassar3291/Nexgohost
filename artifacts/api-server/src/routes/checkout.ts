import { Router } from "express";
import { db } from "@workspace/db";
import {
  ordersTable, invoicesTable, hostingPlansTable, hostingServicesTable,
  promoCodesTable, paymentMethodsTable, usersTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../lib/auth.js";
import { emailInvoiceCreated, emailOrderCreated } from "../lib/email.js";

const router = Router();

// POST /api/client/checkout
// Body: { packageId, domain?, promoCode?, paymentMethodId, billingPeriod? }
// Creates an order (pending) + hosting service (pending) + invoice (unpaid), returns details.
router.post("/client/checkout", authenticate, async (req: AuthRequest, res) => {
  try {
    const { packageId, domain, promoCode, paymentMethodId, billingPeriod = 1 } = req.body;

    if (!packageId) {
      res.status(400).json({ error: "packageId is required" });
      return;
    }

    const [plan] = await db.select().from(hostingPlansTable)
      .where(eq(hostingPlansTable.id, packageId)).limit(1);
    if (!plan || !plan.isActive) {
      res.status(404).json({ error: "Package not found or no longer available" });
      return;
    }

    const [user] = await db.select().from(usersTable)
      .where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    if (paymentMethodId) {
      const [pm] = await db.select().from(paymentMethodsTable)
        .where(eq(paymentMethodsTable.id, paymentMethodId)).limit(1);
      if (!pm || !pm.isActive) {
        res.status(400).json({ error: "Selected payment method is not available" });
        return;
      }
    }

    // Determine billing cycle
    const cycle = billingPeriod >= 12 ? "yearly" : billingPeriod >= 3 ? "quarterly" : "monthly";
    const baseAmount = billingPeriod >= 12 && (plan as any).yearlyPrice
      ? Number((plan as any).yearlyPrice)
      : Number(plan.price) * (billingPeriod || 1);

    let discountAmount = 0;
    let promoDetails: { code: string; discountPercent: number } | null = null;

    if (promoCode) {
      const [promo] = await db.select().from(promoCodesTable)
        .where(eq(promoCodesTable.code, promoCode.toUpperCase())).limit(1);
      if (promo && promo.isActive) {
        const limitOk = promo.usageLimit === null || promo.usedCount < promo.usageLimit;
        const notExpired = !promo.expiresAt || new Date() <= promo.expiresAt;
        if (limitOk && notExpired) {
          discountAmount = baseAmount * (promo.discountPercent / 100);
          promoDetails = { code: promo.code, discountPercent: promo.discountPercent };
          await db.update(promoCodesTable)
            .set({ usedCount: promo.usedCount + 1 })
            .where(eq(promoCodesTable.id, promo.id));
        }
      }
    }

    const finalAmount = Math.max(0, baseAmount - discountAmount);
    const notes = [
      promoDetails ? `Promo: ${promoDetails.code} (-${promoDetails.discountPercent}%)` : null,
      billingPeriod > 1 ? `Billing period: ${billingPeriod} months` : null,
    ].filter(Boolean).join(", ");

    // 1. Create order
    const [order] = await db.insert(ordersTable).values({
      clientId: req.user!.userId,
      type: "hosting",
      itemId: plan.id,
      itemName: plan.name,
      amount: String(finalAmount.toFixed(2)),
      status: "pending",
      notes: notes || null,
    }).returning();

    // 2. Create pending hosting service (provisioned when invoice is paid)
    const nextDueDate = new Date();
    nextDueDate.setMonth(nextDueDate.getMonth() + (billingPeriod || 1));

    const [service] = await db.insert(hostingServicesTable).values({
      clientId: req.user!.userId,
      planId: plan.id,
      planName: plan.name,
      domain: domain || null,
      status: "pending",
      billingCycle: cycle,
      nextDueDate,
    }).returning();

    // 3. Create invoice (due in 7 days)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    const invoiceNumber = `INV-${dateStr}-${rand}`;

    const [invoice] = await db.insert(invoicesTable).values({
      invoiceNumber,
      clientId: req.user!.userId,
      orderId: order.id,
      serviceId: service.id,
      amount: String(finalAmount.toFixed(2)),
      total: String(finalAmount.toFixed(2)),
      status: "unpaid",
      dueDate,
      items: [{
        description: `${plan.name} Hosting${billingPeriod > 1 ? ` (${billingPeriod} months)` : ""}`,
        quantity: 1,
        unitPrice: finalAmount,
        total: finalAmount,
      }],
    }).returning();

    // 4. Send order confirmation + invoice emails (async, don't block response)
    const dueFormatted = dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    emailInvoiceCreated(user.email, {
      clientName: `${user.firstName} ${user.lastName}`,
      invoiceId: invoiceNumber,
      amount: `$${finalAmount.toFixed(2)}`,
      dueDate: dueFormatted,
    }).catch(console.warn);
    emailOrderCreated(user.email, {
      clientName: `${user.firstName} ${user.lastName}`,
      serviceName: plan.name,
      domain: domain || "To be configured",
      orderId: order.id.slice(0, 8).toUpperCase(),
    }).catch(console.warn);

    res.status(201).json({
      success: true,
      order: { id: order.id, itemName: order.itemName, amount: Number(order.amount), status: order.status },
      invoice: { id: invoice.id, invoiceNumber, amount: Number(invoice.amount), status: invoice.status, dueDate: invoice.dueDate?.toISOString() },
      service: { id: service.id, status: service.status },
      summary: {
        packageName: plan.name,
        baseAmount,
        discountAmount: Number(discountAmount.toFixed(2)),
        finalAmount: Number(finalAmount.toFixed(2)),
        promo: promoDetails,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
