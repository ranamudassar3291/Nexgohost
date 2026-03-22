import { Router } from "express";
import { db } from "@workspace/db";
import {
  ordersTable, invoicesTable, hostingPlansTable, hostingServicesTable,
  promoCodesTable, paymentMethodsTable, usersTable, fraudLogsTable,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../lib/auth.js";
import { emailInvoiceCreated, emailOrderCreated } from "../lib/email.js";

const router = Router();

// POST /api/checkout or /api/client/checkout
async function handleCheckout(req: AuthRequest, res: any) {
  try {
    const {
      packageId, domain, promoCode, paymentMethodId,
      billingPeriod = 1, billingCycle: billingCycleRaw,
      registerDomain, freeDomain, domainAmount: clientDomainAmount,
    } = req.body;

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
    const cycle: string = billingCycleRaw ||
      (billingPeriod >= 12 ? "yearly" : billingPeriod >= 6 ? "semiannual" : billingPeriod >= 3 ? "quarterly" : "monthly");

    // Compute base amount from correct plan price tier
    let baseAmount: number;
    if (cycle === "yearly" && (plan as any).yearlyPrice) {
      baseAmount = Number((plan as any).yearlyPrice);
    } else if (cycle === "semiannual" && (plan as any).semiannualPrice) {
      baseAmount = Number((plan as any).semiannualPrice);
    } else if (cycle === "quarterly" && (plan as any).quarterlyPrice) {
      baseAmount = Number((plan as any).quarterlyPrice);
    } else {
      const months = billingPeriod || 1;
      baseAmount = Number(plan.price) * (months === 1 ? 1 : months);
    }

    // Domain add-on amount (0 if free domain with yearly)
    const domainAddon = freeDomain ? 0 : (typeof clientDomainAmount === "number" ? clientDomainAmount : 0);

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

    const finalAmount = Math.max(0, baseAmount + domainAddon - discountAmount);

    const noteParts: string[] = [];
    if (promoDetails) noteParts.push(`Promo: ${promoDetails.code} (-${promoDetails.discountPercent}%)`);
    if (cycle !== "monthly") noteParts.push(`Billing: ${cycle}`);
    if (freeDomain && domain) noteParts.push(`Free domain: ${domain}`);
    else if (domain) noteParts.push(`Domain: ${domain}`);
    const notes = noteParts.join(", ");

    // 1. Create order
    const [order] = await db.insert(ordersTable).values({
      clientId: req.user!.userId,
      type: "hosting",
      itemId: plan.id,
      itemName: plan.name,
      domain: domain || null,
      amount: String(finalAmount.toFixed(2)),
      billingCycle: cycle,
      status: "pending",
      notes: notes || null,
    }).returning();

    // 2. Create pending hosting service
    const months = cycle === "yearly" ? 12 : cycle === "semiannual" ? 6 : cycle === "quarterly" ? 3 : 1;
    const nextDueDate = new Date();
    nextDueDate.setMonth(nextDueDate.getMonth() + months);

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

    const invoiceItems: any[] = [
      {
        description: `${plan.name} Hosting (${cycle})`,
        quantity: 1,
        unitPrice: baseAmount,
        total: baseAmount,
      },
    ];
    if (domain && domainAddon > 0) {
      invoiceItems.push({
        description: `Domain Registration: ${domain}`,
        quantity: 1,
        unitPrice: domainAddon,
        total: domainAddon,
      });
    }
    if (freeDomain && domain) {
      invoiceItems.push({
        description: `Domain Registration: ${domain} (FREE with yearly plan)`,
        quantity: 1,
        unitPrice: 0,
        total: 0,
      });
    }
    if (promoDetails) {
      invoiceItems.push({
        description: `Promo code: ${promoDetails.code} (-${promoDetails.discountPercent}%)`,
        quantity: 1,
        unitPrice: -discountAmount,
        total: -discountAmount,
      });
    }

    const [invoice] = await db.insert(invoicesTable).values({
      invoiceNumber,
      clientId: req.user!.userId,
      orderId: order.id,
      serviceId: service.id,
      amount: String(finalAmount.toFixed(2)),
      total: String(finalAmount.toFixed(2)),
      status: "unpaid",
      dueDate,
      items: invoiceItems,
    }).returning();

    // 4. Fraud detection (non-blocking)
    const clientIp = (req.headers["x-forwarded-for"] as string || req.socket?.remoteAddress || "").split(",")[0]?.trim() || "";
    (async () => {
      try {
        const reasons: string[] = [];
        let riskScore = 0;
        if (clientIp) {
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const recentFrauds = await db.select().from(fraudLogsTable)
            .where(sql`ip_address = ${clientIp} AND created_at >= ${oneDayAgo}`);
          if (recentFrauds.length >= 3) {
            reasons.push(`Multiple orders from IP ${clientIp} in 24h`);
            riskScore += 40;
          }
        }
        const DISPOSABLE_DOMAINS = ["mailinator.com", "guerrillamail.com", "tempmail.com", "throwaway.email", "yopmail.com", "sharklasers.com", "trashmail.com", "fakeinbox.com"];
        const emailDomain = user.email.split("@")[1]?.toLowerCase() || "";
        if (DISPOSABLE_DOMAINS.includes(emailDomain)) {
          reasons.push(`Disposable email domain: ${emailDomain}`);
          riskScore += 60;
        }
        if (riskScore > 0) {
          await db.insert(fraudLogsTable).values({
            orderId: order.id,
            clientId: req.user!.userId,
            ipAddress: clientIp || null,
            email: user.email,
            riskScore: String(riskScore),
            reasons,
            status: "flagged",
          });
          if (riskScore >= 50) {
            await db.update(ordersTable).set({ status: "fraud" }).where(eq(ordersTable.id, order.id));
          }
        }
      } catch { /* non-fatal */ }
    })();

    // 5. Send emails (non-blocking)
    const dueFormatted = dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    emailInvoiceCreated(user.email, {
      clientName: `${user.firstName} ${user.lastName}`,
      invoiceId: invoiceNumber,
      amount: `Rs. ${finalAmount.toFixed(2)}`,
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
        domain: domain || null,
        freeDomain: freeDomain && domain ? true : false,
        baseAmount,
        domainAmount: domainAddon,
        discountAmount: Number(discountAmount.toFixed(2)),
        finalAmount: Number(finalAmount.toFixed(2)),
        promo: promoDetails,
        billingCycle: cycle,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

// POST /api/checkout/domain — domain-only order
async function handleDomainCheckout(req: AuthRequest, res: any) {
  try {
    const { domain, tld, amount, paymentMethodId } = req.body;
    if (!domain || !tld) {
      res.status(400).json({ error: "domain and tld are required" });
      return;
    }

    const [user] = await db.select().from(usersTable)
      .where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const fullDomain = domain + tld;
    const orderAmount = Number(amount) || 0;

    // Create domain order
    const [order] = await db.insert(ordersTable).values({
      clientId: req.user!.userId,
      type: "domain",
      itemId: null,
      itemName: fullDomain,
      domain: fullDomain,
      amount: String(orderAmount.toFixed(2)),
      billingCycle: "yearly",
      status: "pending",
      notes: `Domain registration: ${fullDomain}`,
    }).returning();

    // Create invoice
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    const invoiceNumber = `INV-${dateStr}-${rand}`;

    const [invoice] = await db.insert(invoicesTable).values({
      invoiceNumber,
      clientId: req.user!.userId,
      orderId: order.id,
      serviceId: null,
      amount: String(orderAmount.toFixed(2)),
      total: String(orderAmount.toFixed(2)),
      status: "unpaid",
      dueDate,
      items: [{
        description: `Domain Registration: ${fullDomain} (1 year)`,
        quantity: 1,
        unitPrice: orderAmount,
        total: orderAmount,
      }],
    }).returning();

    res.status(201).json({
      success: true,
      order: { id: order.id, domain: fullDomain, amount: orderAmount, status: order.status },
      invoice: { id: invoice.id, invoiceNumber, amount: orderAmount, status: invoice.status, dueDate: invoice.dueDate?.toISOString() },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

router.post("/checkout", authenticate, handleCheckout);
router.post("/client/checkout", authenticate, handleCheckout);
router.post("/checkout/domain", authenticate, handleDomainCheckout);
router.post("/client/checkout/domain", authenticate, handleDomainCheckout);

export default router;
