import { Router } from "express";
import { db } from "@workspace/db";
import {
  ordersTable, invoicesTable, hostingPlansTable, hostingServicesTable,
  promoCodesTable, paymentMethodsTable, usersTable, fraudLogsTable, domainsTable,
  domainExtensionsTable, affiliatesTable, affiliateReferralsTable, affiliateCommissionsTable,
  creditTransactionsTable, affiliateGroupCommissionsTable, vpsPlansTable,
  domainTransfersTable,
} from "@workspace/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../lib/auth.js";
import { emailInvoiceCreated, emailOrderCreated, emailDomainRegistered, emailDomainTransferInitiated } from "../lib/email.js";
import { generateInvoicePdf } from "../lib/invoicePdf.js";
import { createNotification } from "../lib/notifications.js";
import { sendWhatsAppAlert } from "../lib/whatsapp.js";

const router = Router();

// POST /api/checkout or /api/client/checkout
async function handleCheckout(req: AuthRequest, res: any) {
  try {
    const {
      packageId, domain, promoCode, paymentMethodId,
      billingPeriod = 1, billingCycle: billingCycleRaw,
      registerDomain, transferDomain, freeDomain,
      domainAmount: clientDomainAmount, eppCode,
      nameservers: clientNameservers,
      applyCredits: applyCreditsRaw,
    } = req.body;
    // applyCredits: true = deduct whatever wallet balance is available (partial or full)
    // paymentMethodId === "credits" = full wallet payment (error if insufficient)
    const applyCredits = applyCreditsRaw === true || applyCreditsRaw === "true";
    const resolvedNs: string[] = (Array.isArray(clientNameservers) && clientNameservers.length >= 2)
      ? clientNameservers.map((n: string) => n.trim().toLowerCase()).filter(Boolean)
      : ["ns1.noehost.com", "ns2.noehost.com"];

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
          const dName = domain.slice(0, dotIdx).toLowerCase();
          const dTld  = domain.slice(dotIdx).toLowerCase();
          const expiryDate = new Date(); expiryDate.setFullYear(expiryDate.getFullYear() + 1);
          // Free/zero-amount domain → activate immediately; paid domain → pending until invoice paid
          const domainStatus = finalAmount === 0 ? "active" : "pending";

          // Exact match guard — never use LIKE/partial matching for domain uniqueness
          const [domainAlreadyExists] = await db
            .select({ id: domainsTable.id, status: domainsTable.status })
            .from(domainsTable)
            .where(and(eq(domainsTable.name, dName), eq(domainsTable.tld, dTld)))
            .limit(1);

          if (domainAlreadyExists) {
            // Update existing record to active if this is a free domain
            if (finalAmount === 0) {
              await db.update(domainsTable).set({
                status: "active", expiryDate, nextDueDate: expiryDate,
                lockStatus: "unlocked", updatedAt: new Date(),
              }).where(eq(domainsTable.id, domainAlreadyExists.id));
            }
          } else {
            await db.insert(domainsTable).values({
              clientId: req.user!.userId,
              name: dName,
              tld: dTld,
              registrationDate: new Date(),
              expiryDate,
              nextDueDate: expiryDate,
              lockStatus: finalAmount === 0 ? "unlocked" : "locked",
              status: domainStatus, autoRenew: true,
              nameservers: resolvedNs,
            });
          }

          // Zero-amount free domain: auto-pay invoice and approve order immediately
          if (finalAmount === 0) {
            await db.update(invoicesTable).set({ status: "paid", paidDate: new Date(), updatedAt: new Date() })
              .where(eq(invoicesTable.id, invoice.id));
            await db.update(ordersTable).set({ status: "approved", updatedAt: new Date() })
              .where(eq(ordersTable.id, order.id));
          }
        } catch { /* non-fatal */ }
      }

      // Create domain transfer record when transferring a domain
      if (transferDomain && domain.includes(".") && eppCode) {
        try {
          const dotIdx = domain.indexOf(".");
          const domainName = domain.slice(0, dotIdx).toLowerCase();
          const domainTld = domain.slice(dotIdx).toLowerCase();
          const [domainEntry] = await db.insert(domainsTable).values({
            clientId: req.user!.userId,
            name: domainName,
            tld: domainTld,
            registrar: "Transfer Pending",
            status: "pending_transfer" as any,
            autoRenew: true,
            nameservers: ["ns1.noehost.com", "ns2.noehost.com"],
          }).onConflictDoNothing().returning();

          const [transfer] = await db.insert(domainTransfersTable).values({
            clientId: req.user!.userId,
            domainName: domain.toLowerCase(),
            epp: eppCode.trim(),
            status: "validating",
            validationMessage: "Domain transfer request submitted via order checkout.",
            price: String(finalAmount.toFixed(2)),
            orderId: order.id,
            invoiceId: invoice.id,
          }).returning();

          if (domainEntry && transfer) {
            await db.update(domainsTable)
              .set({ transferId: transfer.id, updatedAt: new Date() })
              .where(eq(domainsTable.id, domainEntry.id));
          }

          const invoiceNumber = invoice.invoiceNumber;
          emailDomainTransferInitiated(user.email, {
            clientName: `${user.firstName} ${user.lastName}`,
            domain: domain.toLowerCase(),
            transferPrice: finalAmount.toFixed(2),
            invoiceNumber,
          }).catch(console.warn);
        } catch (err) { console.warn("[CHECKOUT TRANSFER RECORD]", err); }
      }

      // Auto-pay with credits (full or partial)
      if ((paymentMethodId === "credits" || applyCredits) && finalAmount > 0) {
        const bal = parseFloat((await db.select({ creditBalance: usersTable.creditBalance })
          .from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1).then(r => r[0]?.creditBalance ?? "0")));
        if (paymentMethodId === "credits" && bal < finalAmount) {
          res.status(400).json({ error: `Insufficient credits. Balance: Rs. ${bal.toFixed(2)}, Required: Rs. ${finalAmount.toFixed(2)}.` });
          return;
        }
        const deducted = parseFloat(Math.min(bal, finalAmount).toFixed(2));
        const remaining = parseFloat((finalAmount - deducted).toFixed(2));
        if (deducted > 0) {
          await db.update(usersTable).set({ creditBalance: String((bal - deducted).toFixed(2)), updatedAt: new Date() })
            .where(eq(usersTable.id, req.user!.userId));
          await db.insert(creditTransactionsTable).values({
            userId: req.user!.userId, amount: String(deducted.toFixed(2)), type: "invoice_payment",
            description: `Wallet payment for ${domain} order`, invoiceId: invoice.id,
          });
          // Update invoice: reduce amount owed to remaining
          await db.update(invoicesTable).set({ amount: String(remaining.toFixed(2)), updatedAt: new Date() })
            .where(eq(invoicesTable.id, invoice.id));
        }
        if (remaining === 0) {
          await db.update(invoicesTable).set({ status: "paid", paidDate: new Date(), updatedAt: new Date() })
            .where(eq(invoicesTable.id, invoice.id));
          await db.update(ordersTable).set({ status: "approved", updatedAt: new Date() }).where(eq(ordersTable.id, order.id));
        }
      }

      try { await createNotification(req.user!.userId, "order_placed", `Domain order placed: ${domain}`, `/client/invoices/${invoice.id}`); } catch {}
      res.json({ orderId: order.id, invoiceId: invoice.id, walletApplied: applyCredits || paymentMethodId === "credits" });
      return;
    }

    // ── VPS order ─────────────────────────────────────────────────────────────
    const vpsPlanId    = req.body.vpsPlanId;
    const vpsOsTemplate   = req.body.vpsOsTemplate ?? null;
    const vpsLocation     = req.body.vpsLocation ?? null;
    const vpsHostname     = req.body.vpsHostname ?? null;
    const vpsRootUser     = req.body.vpsRootUser ?? "root";
    const vpsRootPassword = req.body.vpsRootPassword ?? null;
    const vpsImageId      = req.body.vpsImageId ?? null;
    const vpsAutoRenew    = req.body.vpsAutoRenew !== false;
    const vpsWeeklyBackups = req.body.vpsWeeklyBackups === true;

    if (vpsPlanId) {
      const [vpsPlan] = await db.select().from(vpsPlansTable)
        .where(eq(vpsPlansTable.id, vpsPlanId)).limit(1);
      if (!vpsPlan || !vpsPlan.isActive) {
        res.status(404).json({ error: "VPS plan not found or unavailable" });
        return;
      }

      const cycle: string = billingCycleRaw || "monthly";
      let vpsAmount: number;
      if (cycle === "quarterly" && (vpsPlan as any).quarterlyPrice) {
        vpsAmount = Number((vpsPlan as any).quarterlyPrice);
      } else if (cycle === "semiannual" && (vpsPlan as any).semiannualPrice) {
        vpsAmount = Number((vpsPlan as any).semiannualPrice);
      } else if (cycle === "yearly" && vpsPlan.yearlyPrice) {
        vpsAmount = Number(vpsPlan.yearlyPrice);
      } else if (cycle === "biennial" && (vpsPlan as any).biennialPrice) {
        vpsAmount = Number((vpsPlan as any).biennialPrice);
      } else {
        vpsAmount = Number(vpsPlan.price);
      }

      // Promo code
      let vpsDiscount = 0;
      if (promoCode) {
        const [promo] = await db.select().from(promoCodesTable)
          .where(eq(promoCodesTable.code, promoCode.toUpperCase())).limit(1);
        if (promo && promo.isActive && (promo.usageCount < (promo.maxUses ?? Infinity))) {
          vpsDiscount = Math.round(vpsAmount * (Number(promo.discountPercent) / 100) * 100) / 100;
        }
      }
      const finalVpsAmount = Math.max(0, vpsAmount - vpsDiscount);

      // Credits pre-check (full-credits mode only)
      if (paymentMethodId === "credits" && finalVpsAmount > 0) {
        const bal = parseFloat((await db.select({ creditBalance: usersTable.creditBalance })
          .from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1).then(r => r[0]?.creditBalance ?? "0")));
        if (bal < finalVpsAmount) {
          res.status(400).json({ error: `Insufficient credits. Balance: Rs. ${bal.toFixed(2)}, Required: Rs. ${finalVpsAmount.toFixed(2)}.` });
          return;
        }
      }

      const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 7);
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
      const invoiceNumber = `INV-${dateStr}-${rand}`;

      const [order] = await db.insert(ordersTable).values({
        clientId: req.user!.userId,
        type: "hosting",
        itemId: vpsPlan.id,
        itemName: vpsPlan.name,
        amount: String(finalVpsAmount.toFixed(2)),
        billingCycle: cycle,
        status: "pending",
        notes: `VPS Order | OS: ${vpsOsTemplate ?? "any"} | DC: ${vpsLocation ?? "any"}`,
      }).returning();

      const [invoice] = await db.insert(invoicesTable).values({
        invoiceNumber,
        clientId: req.user!.userId,
        orderId: order.id,
        serviceId: null,
        amount: String(finalVpsAmount.toFixed(2)),
        total: String(finalVpsAmount.toFixed(2)),
        status: "unpaid",
        dueDate,
        items: [{ description: `VPS Hosting: ${vpsPlan.name} (${cycle})`, quantity: 1, unitPrice: vpsAmount, total: finalVpsAmount }],
      }).returning();

      await db.update(ordersTable).set({ invoiceId: invoice.id, updatedAt: new Date() }).where(eq(ordersTable.id, order.id));

      const [service] = await db.insert(hostingServicesTable).values({
        clientId: req.user!.userId,
        orderId: order.id,
        planId: vpsPlan.id,
        planName: vpsPlan.name,
        status: "pending",
        billingCycle: cycle,
        serviceType: "vps",
        vpsPlanId: vpsPlan.id,
        vpsOsTemplate: vpsOsTemplate,
        vpsLocation: vpsLocation,
        vpsHostname: vpsHostname,
        vpsRootUser: vpsRootUser,
        vpsRootPassword: vpsRootPassword,
        vpsImageId: vpsImageId,
        vpsAutoRenew: vpsAutoRenew,
        vpsWeeklyBackups: vpsWeeklyBackups,
        vpsProvisionStatus: "not_started",
        startDate: new Date(),
        expiryDate: (() => {
          const d = new Date();
          if (cycle === "quarterly") d.setMonth(d.getMonth() + 3);
          else if (cycle === "semiannual") d.setMonth(d.getMonth() + 6);
          else if (cycle === "yearly") d.setFullYear(d.getFullYear() + 1);
          else if (cycle === "biennial") d.setFullYear(d.getFullYear() + 2);
          else d.setMonth(d.getMonth() + 1);
          return d;
        })(),
      }).returning();

      await db.update(invoicesTable).set({ serviceId: service.id, updatedAt: new Date() }).where(eq(invoicesTable.id, invoice.id));

      // Auto-pay with credits (full or partial)
      if ((paymentMethodId === "credits" || applyCredits) && finalVpsAmount > 0) {
        const bal = parseFloat((await db.select({ creditBalance: usersTable.creditBalance })
          .from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1).then(r => r[0]?.creditBalance ?? "0")));
        const deducted = parseFloat(Math.min(bal, finalVpsAmount).toFixed(2));
        const remaining = parseFloat((finalVpsAmount - deducted).toFixed(2));
        if (deducted > 0) {
          await db.update(usersTable).set({ creditBalance: String((bal - deducted).toFixed(2)), updatedAt: new Date() })
            .where(eq(usersTable.id, req.user!.userId));
          await db.insert(creditTransactionsTable).values({
            userId: req.user!.userId, amount: String(deducted.toFixed(2)), type: "invoice_payment",
            description: `Wallet payment for VPS order: ${vpsPlan.name}`, invoiceId: invoice.id,
          });
          await db.update(invoicesTable).set({ amount: String(remaining.toFixed(2)), updatedAt: new Date() })
            .where(eq(invoicesTable.id, invoice.id));
        }
        if (remaining === 0) {
          await db.update(invoicesTable).set({ status: "paid", paidDate: new Date(), updatedAt: new Date() })
            .where(eq(invoicesTable.id, invoice.id));
          await db.update(ordersTable).set({ status: "approved", updatedAt: new Date() }).where(eq(ordersTable.id, order.id));
        }
      }

      try { await createNotification(req.user!.userId, "order_placed", `VPS order placed: ${vpsPlan.name}`, `/client/invoices/${invoice.id}`); } catch {}
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

    // Free domain TLD enforcement — all 3 conditions must pass:
    // 1. Plan has freeDomainEnabled
    // 2. Billing cycle is yearly
    // 3. TLD is in the plan's freeDomainTlds list OR in DEFAULT_FREE_TLDS (fallback) OR has isFreeWithHosting=true in DB
    const DEFAULT_FREE_TLDS = [".com", ".net", ".org", ".pk", ".net.pk", ".org.pk", ".co"];
    let effectiveFreeDomain = freeDomain;
    if (effectiveFreeDomain && !(plan as any).freeDomainEnabled) effectiveFreeDomain = false;
    if (effectiveFreeDomain && cycle !== "yearly") effectiveFreeDomain = false;
    if (effectiveFreeDomain && domain && registerDomain && !transferDomain) {
      const domTld = domain.includes(".") ? domain.slice(domain.indexOf(".")).toLowerCase() : "";
      const planFreeTlds: string[] = (plan as any).freeDomainTlds ?? [];
      if (planFreeTlds.length > 0) {
        if (!planFreeTlds.includes(domTld)) effectiveFreeDomain = false;
      } else {
        if (!DEFAULT_FREE_TLDS.includes(domTld)) {
          const [tldRow] = await db.select({ isFree: domainExtensionsTable.isFreeWithHosting })
            .from(domainExtensionsTable)
            .where(eq(domainExtensionsTable.extension, domTld)).limit(1);
          if (!tldRow?.isFree) effectiveFreeDomain = false;
        }
      }
    }

    // Domain add-on amount: look up authoritative TLD price for transfers; 0 for free-domain-eligible registrations
    let domainAddon = effectiveFreeDomain ? 0 : (typeof clientDomainAmount === "number" ? clientDomainAmount : 0);
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
        // Group scope check
        const applicableGroupId = (promo as any).applicableGroupId;
        const groupOk = !applicableGroupId || applicableGroupId === plan.groupId;
        // Domain TLD scope check (only if code is domain-scoped and there's a domain)
        const applicableDomainTld = (promo as any).applicableDomainTld;
        const domainTld = domain && domain.includes(".") ? domain.slice(domain.indexOf(".")).toLowerCase() : null;
        const tldOk = !applicableDomainTld || !domainTld || applicableDomainTld.toLowerCase() === domainTld;
        if (limitOk && notExpired && groupOk && tldOk) {
          const discountType = (promo as any).discountType ?? "percent";
          if (discountType === "fixed") {
            discountAmount = Math.min(Number((promo as any).fixedAmount ?? 0), baseAmount);
          } else {
            discountAmount = baseAmount * (promo.discountPercent / 100);
          }
          const displayDiscount = discountType === "fixed"
            ? `Rs. ${discountAmount.toFixed(0)}`
            : `-${promo.discountPercent}%`;
          promoDetails = { code: promo.code, discountPercent: promo.discountPercent, discountType, discountAmount: Number(discountAmount.toFixed(2)), displayDiscount } as any;
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
    if (effectiveFreeDomain && domain) noteParts.push(`Free domain: ${domain}`);
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
    const freeDomainClaimed = effectiveFreeDomain && (registerDomain || false) && !transferDomain;
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
    if (effectiveFreeDomain && domain) {
      invoiceItems.push({
        description: `Domain Registration: ${domain} (FREE with yearly plan)`,
        quantity: 1,
        unitPrice: 0,
        total: 0,
      });
    }
    if (promoDetails) {
      const pd = promoDetails as any;
      const discLabel = pd.discountType === "fixed"
        ? `Rs. ${Number(pd.discountAmount ?? discountAmount).toFixed(0)} OFF`
        : `-${pd.discountPercent}%`;
      invoiceItems.push({
        description: `Promo code: ${promoDetails.code} (${discLabel})`,
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

    // 4. Insert domain record when registering or transferring a domain
    if ((registerDomain || transferDomain) && domain && domain.includes(".")) {
      try {
        const dotIdx = domain.indexOf(".");
        const domainName = domain.slice(0, dotIdx);
        const domainTld = domain.slice(dotIdx);
        const regDate = new Date();
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);

        if (transferDomain && eppCode) {
          // Create domain with pending_transfer status and create a transfer record
          const [domainEntry] = await db.insert(domainsTable).values({
            clientId: req.user!.userId,
            name: domainName.toLowerCase(),
            tld: domainTld.toLowerCase(),
            registrar: "Transfer Pending",
            status: "pending_transfer" as any,
            autoRenew: true,
            nameservers: ["ns1.noehost.com", "ns2.noehost.com"],
          }).onConflictDoNothing().returning();

          const [transfer] = await db.insert(domainTransfersTable).values({
            clientId: req.user!.userId,
            domainName: domain.toLowerCase(),
            epp: eppCode.trim(),
            status: "validating",
            validationMessage: "Domain transfer request submitted via hosting order checkout.",
            price: String(domainAddon.toFixed(2)),
            orderId: order.id,
            invoiceId: invoice.id,
          }).returning();

          if (domainEntry && transfer) {
            await db.update(domainsTable)
              .set({ transferId: transfer.id, updatedAt: new Date() })
              .where(eq(domainsTable.id, domainEntry.id));
          }

          emailDomainTransferInitiated(user.email, {
            clientName: `${user.firstName} ${user.lastName}`,
            domain: domain.toLowerCase(),
            transferPrice: domainAddon.toFixed(2),
            invoiceNumber: invoice.invoiceNumber,
          }).catch(console.warn);
        } else if (registerDomain) {
          await db.insert(domainsTable).values({
            clientId: req.user!.userId,
            name: domainName.toLowerCase(),
            tld: domainTld.toLowerCase(),
            registrationDate: regDate,
            expiryDate,
            status: "pending",
            autoRenew: true,
            nameservers: resolvedNs,
          });
        }
      } catch (err) { console.warn("[CHECKOUT DOMAIN RECORD]", err); }
    }

    // 5b. Auto-pay with credits (full or partial wallet)
    let paidWithCredits = false;
    if ((paymentMethodId === "credits" || applyCredits) && finalAmount > 0) {
      const freshUser = await db.select({ creditBalance: usersTable.creditBalance })
        .from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1).then(r => r[0]);
      const balance = parseFloat(freshUser?.creditBalance ?? "0");
      if (paymentMethodId === "credits" && balance < finalAmount) {
        res.status(400).json({
          error: `Insufficient credits. Your balance is Rs. ${balance.toFixed(2)} but the order total is Rs. ${finalAmount.toFixed(2)}.`,
          creditBalance: balance,
        });
        return;
      }
      const deducted = parseFloat(Math.min(balance, finalAmount).toFixed(2));
      const remaining = parseFloat((finalAmount - deducted).toFixed(2));
      if (deducted > 0) {
        await db.update(usersTable)
          .set({ creditBalance: String((balance - deducted).toFixed(2)), updatedAt: new Date() })
          .where(eq(usersTable.id, req.user!.userId));
        await db.insert(creditTransactionsTable).values({
          userId: req.user!.userId,
          amount: String(deducted.toFixed(2)),
          type: "invoice_payment",
          description: `Wallet payment for ${plan.name} order #${order.id.slice(0, 8).toUpperCase()}`,
          invoiceId: invoice.id,
        });
        // Reduce invoice amount owed to remainder
        await db.update(invoicesTable).set({ amount: String(remaining.toFixed(2)), updatedAt: new Date() })
          .where(eq(invoicesTable.id, invoice.id));
      }
      if (remaining === 0) {
        await db.update(invoicesTable).set({
          status: "paid", paidDate: new Date(), updatedAt: new Date(),
        }).where(eq(invoicesTable.id, invoice.id));
        await db.update(ordersTable).set({ status: "approved", updatedAt: new Date() })
          .where(eq(ordersTable.id, order.id));
        await db.update(hostingServicesTable).set({ status: "active", updatedAt: new Date() })
          .where(eq(hostingServicesTable.id, service.id));
        paidWithCredits = true;
      }
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
            // Check for per-group commission rate first, fallback to affiliate personal rate
            let commType = affiliate.commissionType;
            let commValue = parseFloat(affiliate.commissionValue);

            if (plan?.groupId) {
              const [groupComm] = await db.select().from(affiliateGroupCommissionsTable)
                .where(eq(affiliateGroupCommissionsTable.groupId, plan.groupId)).limit(1);
              if (groupComm && groupComm.isActive) {
                commType = groupComm.commissionType;
                commValue = parseFloat(groupComm.commissionValue);
              }
            }

            const commAmt = commType === "percentage"
              ? finalAmount * (commValue / 100)
              : commValue;

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
    (async () => {
      try {
        const pdfItems = [{ description: plan.name + (domain ? ` — ${domain}` : ""), quantity: 1, unitPrice: finalAmount, total: finalAmount }];
        const pdfBuf = await generateInvoicePdf({
          invoiceNumber, status: paidWithCredits ? "paid" : "unpaid",
          createdAt: new Date().toISOString(), dueDate: dueDate.toISOString(),
          paidDate: paidWithCredits ? new Date().toISOString() : null,
          clientName: `${user.firstName} ${user.lastName}`, clientEmail: user.email,
          amount: finalAmount, tax: 0, total: finalAmount, items: pdfItems,
        }).catch(() => undefined);
        emailInvoiceCreated(user.email, {
          clientName: `${user.firstName} ${user.lastName}`,
          invoiceId: invoice.id,
          invoiceNumber,
          amount: `Rs. ${finalAmount.toFixed(2)}`,
          dueDate: dueFormatted,
          invoicePdf: pdfBuf,
        }, { clientId: user.id, referenceId: invoice.id }).catch(console.warn);
      } catch { /* non-fatal */ }
    })();
    emailOrderCreated(user.email, {
      clientName: `${user.firstName} ${user.lastName}`,
      serviceName: plan.name,
      domain: domain || "To be configured",
      orderId: order.id.slice(0, 8).toUpperCase(),
    }).catch(console.warn);
    createNotification(user.id, "order", "Order Placed", `Your order for ${plan.name} has been placed${paidWithCredits ? " and is now active" : " — awaiting payment"}`, `/client/orders`).catch(() => {});
    createNotification(user.id, "invoice", "Invoice Created", `Invoice ${invoiceNumber} for Rs. ${finalAmount.toFixed(2)} has been generated`, `/client/invoices`).catch(() => {});

    // WhatsApp alert — non-blocking
    const adminPanelUrl = process.env.ADMIN_PANEL_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "noehost.com"}`;
    sendWhatsAppAlert("new_order",
      `📦 *New Order Received — Noehost*\n\n` +
      `👤 Client: ${user.firstName} ${user.lastName}\n` +
      `📧 Email: ${user.email}\n` +
      `🛒 Service: ${plan.name}${domain ? ` (${domain})` : ""}\n` +
      `💰 Amount: PKR ${finalAmount.toLocaleString()}\n` +
      `🏷️ Type: hosting\n\n` +
      `🔗 View Order:\n${adminPanelUrl}/admin/orders/${order.id}\n\n` +
      `_${new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}_`
    ).catch(() => {});

    res.status(201).json({
      success: true,
      paidWithCredits,
      order: { id: order.id, itemName: order.itemName, amount: Number(order.amount), status: paidWithCredits ? "approved" : order.status },
      invoice: { id: invoice.id, invoiceNumber, amount: Number(invoice.amount), status: paidWithCredits ? "paid" : invoice.status, dueDate: invoice.dueDate?.toISOString() },
      service: { id: service.id, status: paidWithCredits ? "active" : service.status },
      summary: {
        packageName: plan.name,
        domain: domain || null,
        freeDomain: effectiveFreeDomain && domain ? true : false,
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
    const { domain, tld, period = 1, nameservers: _ns, promoCode, paymentMethodId } = req.body;
    const resolvedNs: string[] = (Array.isArray(_ns) && _ns.length >= 2)
      ? _ns.map((n: string) => n.trim().toLowerCase()).filter(Boolean)
      : ["ns1.noehost.com", "ns2.noehost.com"];
    if (!domain || !tld) {
      res.status(400).json({ error: "domain and tld are required" });
      return;
    }

    const registrationYears = Math.min(3, Math.max(1, Number(period) || 1));

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

    // Apply promo code if provided
    let discountAmount = 0;
    let promoDetails: { code: string; discountPercent: number; discountType: string } | null = null;
    if (promoCode) {
      const [promo] = await db.select().from(promoCodesTable)
        .where(eq(promoCodesTable.code, promoCode.toUpperCase())).limit(1);
      if (promo && promo.isActive) {
        const limitOk = promo.usageLimit === null || promo.usedCount < promo.usageLimit;
        const notExpired = !promo.expiresAt || new Date() <= promo.expiresAt;
        const applicableTo = (promo as any).applicableTo ?? "all";
        const scopeOk = applicableTo === "all" || applicableTo === "domain";
        const applicableDomainTld = (promo as any).applicableDomainTld;
        const tldOk = !applicableDomainTld || applicableDomainTld.toLowerCase() === cleanTld.toLowerCase();
        if (limitOk && notExpired && scopeOk && tldOk) {
          const discountType = (promo as any).discountType ?? "percent";
          if (discountType === "fixed") {
            discountAmount = Math.min(Number((promo as any).fixedAmount ?? 0), orderAmount);
          } else {
            discountAmount = orderAmount * (promo.discountPercent / 100);
          }
          promoDetails = { code: promo.code, discountPercent: promo.discountPercent, discountType };
          await db.update(promoCodesTable)
            .set({ usedCount: promo.usedCount + 1 })
            .where(eq(promoCodesTable.id, promo.id));
        }
      }
    }

    const finalAmount = Math.max(0, orderAmount - discountAmount);
    const fullDomain = domain.replace(/^\./, "") + cleanTld;
    const periodLabel = `${registrationYears} year${registrationYears > 1 ? "s" : ""}`;

    const noteParts = [`Domain registration: ${fullDomain} (${periodLabel})`];
    if (promoDetails) noteParts.push(`Promo: ${promoDetails.code} (-${promoDetails.discountPercent}%)`);
    if (paymentMethodId) noteParts.push(`Payment: ${paymentMethodId}`);

    const [order] = await db.insert(ordersTable).values({
      clientId: req.user!.userId,
      type: "domain",
      itemId: null,
      itemName: fullDomain,
      domain: fullDomain,
      amount: String(finalAmount.toFixed(2)),
      billingCycle: registrationYears === 1 ? "yearly" : `${registrationYears}years`,
      status: "pending",
      notes: noteParts.join(", "),
    }).returning();

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    const invoiceNumber = `INV-${dateStr}-${rand}`;

    const invoiceItems: any[] = [{
      description: `Domain Registration: ${fullDomain} (${periodLabel})`,
      quantity: 1,
      unitPrice: orderAmount,
      total: orderAmount,
    }];
    if (discountAmount > 0 && promoDetails) {
      invoiceItems.push({
        description: `Promo Code: ${promoDetails.code}`,
        quantity: 1,
        unitPrice: -discountAmount,
        total: -discountAmount,
      });
    }

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
        nameservers: resolvedNs,
      });
    } catch { /* non-fatal — domain may already exist */ }

    // Domain registration email (non-blocking)
    const expiryFormatted = new Date(Date.now() + registrationYears * 365 * 24 * 60 * 60 * 1000)
      .toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" });
    emailDomainRegistered(user.email, {
      clientName: `${user.firstName} ${user.lastName}`,
      domain: fullDomain,
      expiryDate: expiryFormatted,
    }, { clientId: user.id, referenceId: order.id }).catch(console.warn);

    res.status(201).json({
      success: true,
      order: { id: order.id, domain: fullDomain, amount: finalAmount, status: order.status },
      invoice: { id: invoice.id, invoiceNumber, amount: finalAmount, status: invoice.status, dueDate: invoice.dueDate?.toISOString() },
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
