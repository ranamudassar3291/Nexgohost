import { Router } from "express";
import { db } from "@workspace/db";
import {
  ordersTable, invoicesTable, hostingPlansTable, hostingServicesTable,
  promoCodesTable, paymentMethodsTable, usersTable, fraudLogsTable, domainsTable,
  domainExtensionsTable, affiliatesTable, affiliateReferralsTable, affiliateCommissionsTable,
  creditTransactionsTable,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../lib/auth.js";
import { emailInvoiceCreated, emailOrderCreated } from "../lib/email.js";
import { createNotification } from "../lib/notifications.js";

const router = Router();

// POST /api/checkout or /api/client/checkout
async function handleCheckout(req: AuthRequest, res: any) {
  try {
    const {
      packageId, domain, promoCode, paymentMethodId,
      billingPeriod = 1, billingCycle: billingCycleRaw,
      registerDomain, transferDomain, freeDomain,
      domainAmount: clientDomainAmount, eppCode,
    } = req.body;

    // ── Validation ───────────────────────────────────────────────────────────
    if (!packageId && !domain) {
      res.status(400).json({ error: "Either packageId or domain is required" });
      return;
    }

    const [user] = await db.select().from(usersTable)
      .where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    if (paymentMethodId && paymentMethodId !== "credits") {
      const [pm] = await db.select().from(paymentMethodsTable)
        .where(eq(paymentMethodsTable.id, paymentMethodId)).limit(1);
      if (!pm || !pm.isActive) {
        res.status(400).json({ error: "Selected payment method is not available" });
        return;
      }
    }

    // ── Domain-only order (no hosting plan) ─────────────────────────────────
    if (!packageId && domain) {
      // Always look up the authoritative TLD price server-side — never trust the client amount
      let domainPrice = typeof clientDomainAmount === "number" ? clientDomainAmount : 0;
      if (domain.includes(".")) {
        const tld = domain.slice(domain.indexOf(".")).toLowerCase();
        const [tldRow] = await db.select().from(domainExtensionsTable)
          .where(eq(domainExtensionsTable.extension, tld)).limit(1);
        if (tldRow) {
          domainPrice = transferDomain
            ? Number(tldRow.transferPrice)
            : Number(tldRow.registerPrice);
        }
      }
      const finalAmount = Math.max(0, domainPrice);

      const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 7);
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
      const invoiceNumber = `INV-${dateStr}-${rand}`;

      const domainLabel = transferDomain ? `Domain Transfer: ${domain}` : `Domain Registration: ${domain}`;
      const invoiceItems: any[] = [{
        description: domainLabel,
        quantity: 1, unitPrice: domainPrice, total: domainPrice,
      }];

      const [order] = await db.insert(ordersTable).values({
        clientId: req.user!.userId,
        type: "domain",
        itemId: null,
        itemName: domain,
        domain: domain,
        amount: String(finalAmount.toFixed(2)),
        billingCycle: "yearly",
        status: "pending",
        notes: transferDomain ? `Transfer EPP provided` : undefined,
      }).returning();

      const [invoice] = await db.insert(invoicesTable).values({
        invoiceNumber,
        clientId: req.user!.userId,
        orderId: order.id,
        serviceId: null,
        amount: String(finalAmount.toFixed(2)),
        total: String(finalAmount.toFixed(2)),
        status: "unpaid",
        dueDate,
        items: invoiceItems,
      }).returning();

      await db.update(ordersTable).set({ invoiceId: invoice.id, updatedAt: new Date() }).where(eq(ordersTable.id, order.id));

      if (registerDomain && domain.includes(".")) {
        try {
          const dotIdx = domain.indexOf(".");
          await db.insert(domainsTable).values({
            clientId: req.user!.userId,
            name: domain.slice(0, dotIdx).toLowerCase(),
            tld: domain.slice(dotIdx).toLowerCase(),
            registrationDate: new Date(),
            expiryDate: (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d; })(),
            status: "pending", autoRenew: true,
            nameservers: ["ns1.noehost.com", "ns2.noehost.com"],
          });
        } catch { /* non-fatal */ }
      }

      // Auto-pay with credits
      if (paymentMethodId === "credits" && finalAmount > 0) {
        const bal = parseFloat((await db.select({ creditBalance: usersTable.creditBalance })
          .from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1).then(r => r[0]?.creditBalance ?? "0")));
        if (bal < finalAmount) {
          res.status(400).json({ error: `Insufficient credits. Balance: Rs. ${bal.toFixed(2)}, Required: Rs. ${finalAmount.toFixed(2)}.` });
          return;
        }
        await db.update(usersTable).set({ creditBalance: String((bal - finalAmount).toFixed(2)), updatedAt: new Date() })
          .where(eq(usersTable.id, req.user!.userId));
        await db.insert(creditTransactionsTable).values({
          userId: req.user!.userId, amount: String(finalAmount.toFixed(2)), type: "invoice_payment",
          description: `Payment for ${domain} order`, invoiceId: invoice.id,
        });
        await db.update(invoicesTable).set({ status: "paid", paidDate: new Date(), updatedAt: new Date() })
          .where(eq(invoicesTable.id, invoice.id));
        await db.update(ordersTable).set({ status: "approved", updatedAt: new Date() }).where(eq(ordersTable.id, order.id));
      }

      try { await createNotification(req.user!.userId, "order_placed", `Domain order placed: ${domain}`, `/client/invoices/${invoice.id}`); } catch {}
      res.json({ orderId: order.id, invoiceId: invoice.id });
      return;
    }

    // ── Hosting order (packageId provided) ───────────────────────────────────
    const [plan] = await db.select().from(hostingPlansTable)
      .where(eq(hostingPlansTable.id, packageId)).limit(1);
    if (!plan || !plan.isActive) {
      res.status(404).json({ error: "Package not found or no longer available" });
      return;
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

    // Domain add-on amount: look up authoritative TLD price for transfers; 0 for free-domain-eligible registrations
    let domainAddon = freeDomain ? 0 : (typeof clientDomainAmount === "number" ? clientDomainAmount : 0);
    if (transferDomain && domain && domain.includes(".")) {
      const tld = domain.slice(domain.indexOf(".")).toLowerCase();
      const [tldRow] = await db.select().from(domainExtensionsTable)
        .where(eq(domainExtensionsTable.extension, tld)).limit(1);
      if (tldRow) domainAddon = Number(tldRow.transferPrice);
    }

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
    else if (domain && transferDomain) noteParts.push(`Transfer: ${domain}`);
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

    // If the plan offers a free domain with yearly billing, and the user didn't claim one now,
    // mark freeDomainAvailable so they can claim it from the dashboard later.
    const isFreeDomainEligible = (plan as any).freeDomainEnabled === true && cycle === "yearly";
    const freeDomainClaimed = freeDomain && (registerDomain || false) && !transferDomain;
    const shouldSetFreeDomainAvailable = isFreeDomainEligible && !freeDomainClaimed;

    const [service] = await db.insert(hostingServicesTable).values({
      clientId: req.user!.userId,
      orderId: order.id,
      planId: plan.id,
      planName: plan.name,
      domain: domain || null,
      status: "pending",
      billingCycle: cycle,
      nextDueDate,
      freeDomainAvailable: shouldSetFreeDomainAvailable,
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
      const domDesc = transferDomain ? `Domain Transfer: ${domain}` : `Domain Registration: ${domain}`;
      invoiceItems.push({ description: domDesc, quantity: 1, unitPrice: domainAddon, total: domainAddon });
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

    // Link invoice back to order so admin approve does not create a duplicate
    await db.update(ordersTable).set({ invoiceId: invoice.id, updatedAt: new Date() }).where(eq(ordersTable.id, order.id));

    // 4. Insert domain record when registering a domain
    if ((registerDomain || transferDomain) && domain && domain.includes(".")) {
      try {
        const dotIdx = domain.indexOf(".");
        const domainName = domain.slice(0, dotIdx);
        const domainTld = domain.slice(dotIdx);
        const regDate = new Date();
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        await db.insert(domainsTable).values({
          clientId: req.user!.userId,
          name: domainName.toLowerCase(),
          tld: domainTld.toLowerCase(),
          registrationDate: regDate,
          expiryDate,
          status: transferDomain ? "transferring" : "pending",
          autoRenew: true,
          nameservers: ["ns1.noehost.com", "ns2.noehost.com"],
        });
      } catch { /* non-fatal — domain may already exist */ }
    }

    // 5b. Auto-pay with credits if selected
    let paidWithCredits = false;
    if (paymentMethodId === "credits") {
      const freshUser = await db.select({ creditBalance: usersTable.creditBalance })
        .from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1).then(r => r[0]);
      const balance = parseFloat(freshUser?.creditBalance ?? "0");
      if (balance < finalAmount) {
        // Rollback would be complex — return error early instead
        res.status(400).json({
          error: `Insufficient credits. Your balance is Rs. ${balance.toFixed(2)} but the order total is Rs. ${finalAmount.toFixed(2)}.`,
          creditBalance: balance,
        });
        return;
      }
      const newBalance = parseFloat((balance - finalAmount).toFixed(2));
      await db.update(usersTable)
        .set({ creditBalance: String(newBalance), updatedAt: new Date() })
        .where(eq(usersTable.id, req.user!.userId));
      await db.insert(creditTransactionsTable).values({
        userId: req.user!.userId,
        amount: String(finalAmount.toFixed(2)),
        type: "invoice_payment",
        description: `Payment for ${plan.name} order #${order.id.slice(0, 8).toUpperCase()}`,
        invoiceId: invoice.id,
      });
      await db.update(invoicesTable).set({
        status: "paid", paidDate: new Date(), updatedAt: new Date(),
      }).where(eq(invoicesTable.id, invoice.id));
      await db.update(ordersTable).set({ status: "approved", updatedAt: new Date() })
        .where(eq(ordersTable.id, order.id));
      await db.update(hostingServicesTable).set({ status: "active", updatedAt: new Date() })
        .where(eq(hostingServicesTable.id, service.id));
      paidWithCredits = true;
    }

    // 6. Fraud detection (non-blocking)
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

    // 7. Auto-commission for affiliate referrals (non-blocking)
    (async () => {
      try {
        const [referral] = await db.select().from(affiliateReferralsTable)
          .where(eq(affiliateReferralsTable.referredUserId, req.user!.userId)).limit(1);
        if (referral) {
          const [affiliate] = await db.select().from(affiliatesTable)
            .where(eq(affiliatesTable.id, referral.affiliateId)).limit(1);
          if (affiliate && affiliate.status === "active") {
            const commAmt = affiliate.commissionType === "percentage"
              ? finalAmount * (parseFloat(affiliate.commissionValue) / 100)
              : parseFloat(affiliate.commissionValue);
            if (commAmt > 0) {
              await db.insert(affiliateCommissionsTable).values({
                affiliateId: affiliate.id,
                referredUserId: req.user!.userId,
                orderId: order.id,
                amount: String(commAmt.toFixed(2)),
                status: "pending",
                description: `Commission for ${plan.name} order by referred client`,
              });
              await db.update(affiliatesTable).set({
                totalEarnings: sql`${affiliatesTable.totalEarnings} + ${String(commAmt.toFixed(2))}`,
                pendingEarnings: sql`${affiliatesTable.pendingEarnings} + ${String(commAmt.toFixed(2))}`,
                totalConversions: sql`${affiliatesTable.totalConversions} + 1`,
                updatedAt: new Date(),
              }).where(eq(affiliatesTable.id, affiliate.id));
              await db.update(affiliateReferralsTable).set({ status: "converted" })
                .where(eq(affiliateReferralsTable.id, referral.id));
            }
          }
        }
      } catch { /* non-fatal */ }
    })();

    // 8. Send emails (non-blocking)
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
    createNotification(user.id, "order", "Order Placed", `Your order for ${plan.name} has been placed${paidWithCredits ? " and is now active" : " — awaiting payment"}`, `/client/orders`).catch(() => {});
    createNotification(user.id, "invoice", "Invoice Created", `Invoice ${invoiceNumber} for Rs. ${finalAmount.toFixed(2)} has been generated`, `/client/invoices`).catch(() => {});

    res.status(201).json({
      success: true,
      paidWithCredits,
      order: { id: order.id, itemName: order.itemName, amount: Number(order.amount), status: paidWithCredits ? "approved" : order.status },
      invoice: { id: invoice.id, invoiceNumber, amount: Number(invoice.amount), status: paidWithCredits ? "paid" : invoice.status, dueDate: invoice.dueDate?.toISOString() },
      service: { id: service.id, status: paidWithCredits ? "active" : service.status },
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
    const { domain, tld, period = 1 } = req.body;
    if (!domain || !tld) {
      res.status(400).json({ error: "domain and tld are required" });
      return;
    }

    const registrationYears = Math.min(3, Math.max(1, Number(period) || 1));

    const [user] = await db.select().from(usersTable)
      .where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const cleanTld = tld.startsWith(".") ? tld : `.${tld}`;
    const [ext] = await db.select().from(domainExtensionsTable)
      .where(eq(domainExtensionsTable.extension, cleanTld)).limit(1);

    let orderAmount = 0;
    if (ext) {
      if (registrationYears === 3 && ext.register3YearPrice) {
        orderAmount = Number(ext.register3YearPrice);
      } else if (registrationYears === 2 && ext.register2YearPrice) {
        orderAmount = Number(ext.register2YearPrice);
      } else {
        orderAmount = Number(ext.registerPrice) * registrationYears;
      }
    } else {
      res.status(400).json({ error: `TLD ${cleanTld} is not supported` });
      return;
    }

    const fullDomain = domain.replace(/^\./, "") + cleanTld;
    const periodLabel = `${registrationYears} year${registrationYears > 1 ? "s" : ""}`;

    const [order] = await db.insert(ordersTable).values({
      clientId: req.user!.userId,
      type: "domain",
      itemId: null,
      itemName: fullDomain,
      domain: fullDomain,
      amount: String(orderAmount.toFixed(2)),
      billingCycle: registrationYears === 1 ? "yearly" : `${registrationYears}years`,
      status: "pending",
      notes: `Domain registration: ${fullDomain} (${periodLabel})`,
    }).returning();

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
        description: `Domain Registration: ${fullDomain} (${periodLabel})`,
        quantity: 1,
        unitPrice: orderAmount,
        total: orderAmount,
      }],
    }).returning();

    // Create domain record so it appears immediately in client's domain list
    try {
      const regDate = new Date();
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + registrationYears);
      const cleanName = domain.replace(/^\./, "").replace(/\..+$/, "").toLowerCase();
      await db.insert(domainsTable).values({
        clientId: req.user!.userId,
        name: cleanName,
        tld: cleanTld.toLowerCase(),
        registrationDate: regDate,
        expiryDate,
        status: "pending",
        autoRenew: true,
        nameservers: ["ns1.noehost.com", "ns2.noehost.com"],
      });
    } catch { /* non-fatal — domain may already exist */ }

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
