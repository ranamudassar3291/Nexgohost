import { Router } from "express";
import { db } from "@workspace/db";
import {
  ordersTable, invoicesTable, hostingPlansTable,
  promoCodesTable, paymentMethodsTable, usersTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../lib/auth.js";

const router = Router();

// POST /api/client/checkout
// Body: { packageId, promoCode?, paymentMethodId, billingPeriod? }
// Creates an order (pending) and invoice (unpaid), returns invoice details.
router.post("/client/checkout", authenticate, async (req: AuthRequest, res) => {
  try {
    const { packageId, promoCode, paymentMethodId, billingPeriod = 1 } = req.body;

    if (!packageId) {
      res.status(400).json({ error: "packageId is required" });
      return;
    }

    // Fetch the package
    const [plan] = await db.select().from(hostingPlansTable)
      .where(eq(hostingPlansTable.id, packageId))
      .limit(1);
    if (!plan || !plan.isActive) {
      res.status(404).json({ error: "Package not found or no longer available" });
      return;
    }

    // Fetch user info
    const [user] = await db.select().from(usersTable)
      .where(eq(usersTable.id, req.user!.userId))
      .limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    // Validate payment method if provided
    if (paymentMethodId) {
      const [pm] = await db.select().from(paymentMethodsTable)
        .where(eq(paymentMethodsTable.id, paymentMethodId))
        .limit(1);
      if (!pm || !pm.isActive) {
        res.status(400).json({ error: "Selected payment method is not available" });
        return;
      }
    }

    // Calculate amount
    const baseAmount = Number(plan.price) * (billingPeriod || 1);
    let discountAmount = 0;
    let promoDetails: { code: string; discountPercent: number } | null = null;

    if (promoCode) {
      const [promo] = await db.select().from(promoCodesTable)
        .where(eq(promoCodesTable.code, promoCode.toUpperCase()))
        .limit(1);

      if (promo && promo.isActive) {
        const limitOk = promo.usageLimit === null || promo.usedCount < promo.usageLimit;
        const notExpired = !promo.expiresAt || new Date() <= promo.expiresAt;
        if (limitOk && notExpired) {
          discountAmount = baseAmount * (promo.discountPercent / 100);
          promoDetails = { code: promo.code, discountPercent: promo.discountPercent };
          // Increment usage count
          await db.update(promoCodesTable)
            .set({ usedCount: promo.usedCount + 1 })
            .where(eq(promoCodesTable.id, promo.id));
        }
      }
    }

    const finalAmount = Math.max(0, baseAmount - discountAmount);

    // Build order notes
    const notes = [
      promoDetails ? `Promo: ${promoDetails.code} (-${promoDetails.discountPercent}%)` : null,
      billingPeriod > 1 ? `Billing period: ${billingPeriod} months` : null,
    ].filter(Boolean).join(", ");

    // Create order
    const [order] = await db.insert(ordersTable).values({
      clientId: req.user!.userId,
      type: "hosting",
      itemId: plan.id,
      itemName: plan.name,
      amount: String(finalAmount.toFixed(2)),
      status: "pending",
      notes: notes || null,
    }).returning();

    // Create invoice (due in 7 days)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    // Generate unique invoice number: INV-YYYYMMDD-XXXXXXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    const invoiceNumber = `INV-${dateStr}-${rand}`;

    const [invoice] = await db.insert(invoicesTable).values({
      invoiceNumber,
      clientId: req.user!.userId,
      amount: String(finalAmount.toFixed(2)),
      total: String(finalAmount.toFixed(2)),
      status: "unpaid",
      dueDate,
      items: [{
        description: `${plan.name} Hosting${billingPeriod > 1 ? ` (${billingPeriod} months)` : ""}`,
        amount: finalAmount,
      }],
    }).returning();

    res.status(201).json({
      success: true,
      order: {
        id: order.id,
        itemName: order.itemName,
        amount: Number(order.amount),
        status: order.status,
      },
      invoice: {
        id: invoice.id,
        amount: Number(invoice.amount),
        status: invoice.status,
        dueDate: invoice.dueDate?.toISOString(),
      },
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
