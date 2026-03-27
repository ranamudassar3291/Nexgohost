import { Router } from "express";
import { db } from "@workspace/db";
import { domainsTable, domainPricingTable, domainExtensionsTable, usersTable, ordersTable, invoicesTable, affiliatesTable, affiliateReferralsTable, affiliateCommissionsTable, dnsRecordsTable, promoCodesTable } from "@workspace/db/schema";
import { eq, sql, and, asc } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";

const router = Router();

const RDAP_SERVERS: Record<string, string> = {
  ".com": "https://rdap.verisign.com/com/v1/domain/",
  ".net": "https://rdap.verisign.com/net/v1/domain/",
  ".org": "https://rdap.publicinterestregistry.org/rdap/domain/",
  ".co":  "https://rdap.nic.co/domain/",
  ".io":  "https://rdap.nic.io/domain/",
  ".uk":  "https://rdap.nominet.uk/uk/domain/",
};

async function checkRdapAvailability(name: string, tld: string): Promise<"available" | "taken" | "unknown"> {
  const server = RDAP_SERVERS[tld];
  if (!server) return "unknown";

  const fullDomain = `${name}${tld}`;
  const url = `${server}${fullDomain}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/rdap+json" },
    }).finally(() => clearTimeout(timer));

    if (res.status === 200) return "taken";
    if (res.status === 404) return "available";
    return "unknown";
  } catch {
    return "unknown";
  }
}

function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV-${year}-${rand}`;
}

const REGISTRATION_LOCK_DAYS = 60;

function calcRegistrationLock(registrationDate: Date | null | undefined, lockOverrideByAdmin: boolean | null) {
  if (!registrationDate) return { isIn60DayLock: false, registrationAgeDays: 999, daysRemainingInLock: 0 };
  const now = Date.now();
  const regTime = new Date(registrationDate).getTime();
  const registrationAgeDays = Math.floor((now - regTime) / (1000 * 60 * 60 * 24));
  const isIn60DayLock = !lockOverrideByAdmin && registrationAgeDays < REGISTRATION_LOCK_DAYS;
  const daysRemainingInLock = isIn60DayLock ? REGISTRATION_LOCK_DAYS - registrationAgeDays : 0;
  return { isIn60DayLock, registrationAgeDays, daysRemainingInLock };
}

function generateEppCode(domainId: string): string {
  const crypto = require("crypto");
  const seed = `epp-${domainId}-${Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 30))}`;
  const hash = crypto.createHash("sha256").update(seed).digest("hex");
  return `${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}`.toUpperCase();
}

function formatDomain(d: typeof domainsTable.$inferSelect, clientName?: string) {
  const { isIn60DayLock, registrationAgeDays, daysRemainingInLock } = calcRegistrationLock(d.registrationDate, d.lockOverrideByAdmin);
  return {
    id: d.id,
    clientId: d.clientId,
    clientName: clientName || "",
    name: d.name,
    tld: d.tld,
    registrar: d.registrar || "",
    registrationDate: d.registrationDate?.toISOString(),
    expiryDate: d.expiryDate?.toISOString(),
    nextDueDate: d.nextDueDate?.toISOString(),
    status: d.status,
    autoRenew: d.autoRenew,
    nameservers: d.nameservers || [],
    lockStatus: d.lockStatus ?? "locked",
    eppCode: d.lockStatus === "unlocked" ? (d.eppCode ?? null) : null,
    lastLockChange: d.lastLockChange?.toISOString() ?? null,
    lockOverrideByAdmin: d.lockOverrideByAdmin ?? false,
    isIn60DayLock,
    registrationAgeDays,
    daysRemainingInLock,
    moduleServerId: (d as any).moduleServerId ?? null,
  };
}

// Public: get all TLD pricing (used for domain search page)
router.get("/domains/pricing", async (_req, res) => {
  try {
    const pricing = await db.select().from(domainPricingTable).orderBy(domainPricingTable.tld);
    res.json(pricing.map(p => ({
      id: p.id,
      tld: p.tld,
      registrationPrice: Number(p.registrationPrice),
      renewalPrice: Number(p.renewalPrice),
      transferPrice: Number(p.transferPrice),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Authenticated: check domain availability across all supported TLDs
router.get("/domains/availability", authenticate, async (req: AuthRequest, res) => {
  try {
    const { domain } = req.query as { domain?: string };
    if (!domain || typeof domain !== "string") {
      res.status(400).json({ error: "domain query parameter is required" });
      return;
    }

    const rawName = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "").split(".")[0];
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(rawName)) {
      res.status(400).json({ error: "Invalid domain name. Use only letters, numbers, and hyphens." });
      return;
    }

    const pricing = await db.select().from(domainExtensionsTable)
      .where(eq(domainExtensionsTable.status, "active"))
      .orderBy(asc(domainExtensionsTable.sortOrder), asc(domainExtensionsTable.extension));

    const existingInDb = await db
      .select({ name: domainsTable.name, tld: domainsTable.tld })
      .from(domainsTable)
      .where(eq(domainsTable.name, rawName));

    const takenTldsInDb = new Set(existingInDb.map(d => d.tld));

    const results = await Promise.all(
      pricing.map(async (p) => {
        if (takenTldsInDb.has(p.extension)) {
          return {
            tld: p.extension, available: false,
            registrationPrice: Number(p.registerPrice),
            register2YearPrice: p.register2YearPrice ? Number(p.register2YearPrice) : null,
            register3YearPrice: p.register3YearPrice ? Number(p.register3YearPrice) : null,
            renewalPrice: Number(p.renewalPrice),
            renew2YearPrice: p.renew2YearPrice ? Number(p.renew2YearPrice) : null,
            renew3YearPrice: p.renew3YearPrice ? Number(p.renew3YearPrice) : null,
            isFreeWithHosting: p.isFreeWithHosting ?? false,
            showInSuggestions: p.showInSuggestions ?? true,
          };
        }
        const status = await checkRdapAvailability(rawName, p.extension);
        return {
          tld: p.extension,
          available: status === "available" || status === "unknown",
          rdapStatus: status,
          registrationPrice: Number(p.registerPrice),
          register2YearPrice: p.register2YearPrice ? Number(p.register2YearPrice) : null,
          register3YearPrice: p.register3YearPrice ? Number(p.register3YearPrice) : null,
          renewalPrice: Number(p.renewalPrice),
          renew2YearPrice: p.renew2YearPrice ? Number(p.renew2YearPrice) : null,
          renew3YearPrice: p.renew3YearPrice ? Number(p.renew3YearPrice) : null,
          isFreeWithHosting: p.isFreeWithHosting ?? false,
          showInSuggestions: p.showInSuggestions ?? true,
        };
      })
    );

    res.json({ name: rawName, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Client: register a domain (creates domain + order + invoice)
router.post("/domains/register", authenticate, async (req: AuthRequest, res) => {
  try {
    const { name, tld, period = 1 } = req.body as { name: string; tld: string; period?: number };

    if (!name || !tld) {
      res.status(400).json({ error: "name and tld are required" });
      return;
    }

    const cleanName = name.trim().toLowerCase();
    const cleanTld = tld.trim().toLowerCase();

    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(cleanName)) {
      res.status(400).json({ error: "Invalid domain name" });
      return;
    }

    // Exact match on both name AND tld — no partial / LIKE matching
    const [existing] = await db
      .select()
      .from(domainsTable)
      .where(and(eq(domainsTable.name, cleanName), eq(domainsTable.tld, cleanTld)))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: `${cleanName}${cleanTld} is already registered` });
      return;
    }

    const [pricing] = await db
      .select()
      .from(domainPricingTable)
      .where(eq(domainPricingTable.tld, cleanTld))
      .limit(1);

    if (!pricing) {
      res.status(400).json({ error: `TLD ${cleanTld} is not supported` });
      return;
    }

    const registrationPrice = Number(pricing.registrationPrice) * Number(period);

    const rdapStatus = await checkRdapAvailability(cleanName, cleanTld);
    if (rdapStatus === "taken") {
      res.status(409).json({ error: `${cleanName}${cleanTld} is already registered by another registrant` });
      return;
    }

    const regDate = new Date();
    const expiryDate = new Date(regDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + Number(period));

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const [domain] = await db.insert(domainsTable).values({
      clientId: req.user!.userId,
      name: cleanName,
      tld: cleanTld,
      registrationDate: regDate,
      expiryDate,
      status: "active",
      autoRenew: true,
      nameservers: ["ns1.noehost.com", "ns2.noehost.com"],
    }).returning();

    const [order] = await db.insert(ordersTable).values({
      clientId: req.user!.userId,
      type: "domain",
      itemId: domain.id,
      itemName: `${cleanName}${cleanTld} (${period}yr)`,
      amount: String(registrationPrice),
      status: "approved",
      notes: `Domain registration for ${cleanName}${cleanTld}`,
    }).returning();

    const invoiceNumber = generateInvoiceNumber();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    const [invoice] = await db.insert(invoicesTable).values({
      invoiceNumber,
      clientId: req.user!.userId,
      amount: String(registrationPrice),
      tax: "0",
      total: String(registrationPrice),
      status: "unpaid",
      dueDate,
      items: [{ description: `${cleanName}${cleanTld} - Domain Registration (${period} year${Number(period) > 1 ? "s" : ""})`, quantity: 1, unitPrice: registrationPrice, total: registrationPrice }],
    }).returning();

    const clientName = `${user.firstName} ${user.lastName}`;

    // Auto-commission for affiliate referrals on domain registration (non-blocking)
    (async () => {
      try {
        if (registrationPrice <= 0) return;
        const [referral] = await db.select().from(affiliateReferralsTable)
          .where(eq(affiliateReferralsTable.referredUserId, req.user!.userId)).limit(1);
        if (referral) {
          const [affiliate] = await db.select().from(affiliatesTable)
            .where(eq(affiliatesTable.id, referral.affiliateId)).limit(1);
          if (affiliate && affiliate.status === "active") {
            const commAmt = affiliate.commissionType === "percentage"
              ? registrationPrice * (parseFloat(affiliate.commissionValue) / 100)
              : parseFloat(affiliate.commissionValue);
            if (commAmt > 0) {
              await db.insert(affiliateCommissionsTable).values({
                affiliateId: affiliate.id,
                referredUserId: req.user!.userId,
                orderId: order.id,
                amount: String(commAmt.toFixed(2)),
                status: "pending",
                description: `Commission for domain registration: ${cleanName}${cleanTld}`,
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

    res.status(201).json({
      domain: formatDomain(domain, clientName),
      order: {
        id: order.id,
        clientId: order.clientId,
        clientName,
        type: order.type,
        itemName: order.itemName,
        amount: Number(order.amount),
        status: order.status,
        createdAt: order.createdAt.toISOString(),
      },
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientId: invoice.clientId,
        clientName,
        amount: Number(invoice.amount),
        tax: Number(invoice.tax),
        total: Number(invoice.total),
        status: invoice.status,
        dueDate: invoice.dueDate.toISOString(),
        items: invoice.items,
        createdAt: invoice.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Client: update nameservers on own domain
router.put("/domains/:id/nameservers", authenticate, async (req: AuthRequest, res) => {
  try {
    const [domain] = await db.select().from(domainsTable).where(eq(domainsTable.id, req.params.id)).limit(1);
    if (!domain) { res.status(404).json({ error: "Not found" }); return; }
    if (domain.clientId !== req.user!.userId) { res.status(403).json({ error: "Forbidden" }); return; }
    const { nameservers } = req.body;
    if (!Array.isArray(nameservers) || nameservers.length < 2) {
      res.status(400).json({ error: "At least 2 nameservers required" }); return;
    }
    const cleaned = nameservers.map((ns: string) => ns.trim().toLowerCase()).filter(Boolean);
    const [updated] = await db.update(domainsTable).set({ nameservers: cleaned, updatedAt: new Date() })
      .where(eq(domainsTable.id, req.params.id)).returning();
    res.json(formatDomain(updated, ""));
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Client: toggle auto-renew on own domain
router.put("/domains/:id/auto-renew", authenticate, async (req: AuthRequest, res) => {
  try {
    const [domain] = await db.select().from(domainsTable).where(eq(domainsTable.id, req.params.id)).limit(1);
    if (!domain) { res.status(404).json({ error: "Not found" }); return; }
    if (domain.clientId !== req.user!.userId) { res.status(403).json({ error: "Forbidden" }); return; }
    const { autoRenew } = req.body;
    const [updated] = await db.update(domainsTable).set({ autoRenew: autoRenew ?? !domain.autoRenew }).where(eq(domainsTable.id, req.params.id)).returning();
    res.json(formatDomain(updated, ""));
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Client: renew domain — creates order + unpaid invoice using TLD renewal price
router.post("/domains/:id/renew", authenticate, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { promoCode } = req.body || {};
    const [domain] = await db.select().from(domainsTable)
      .where(and(eq(domainsTable.id, req.params.id), eq(domainsTable.clientId, clientId))).limit(1);
    if (!domain) { res.status(404).json({ error: "Domain not found" }); return; }
    if (domain.status === "cancelled" || domain.status === "transferred") {
      res.status(400).json({ error: `Cannot renew a ${domain.status} domain` }); return;
    }

    const tld = domain.tld;
    const [pricing] = await db.select().from(domainExtensionsTable)
      .where(eq(domainExtensionsTable.extension, tld)).limit(1);
    if (!pricing) { res.status(400).json({ error: `No pricing found for ${tld}` }); return; }

    let renewPrice = Number(pricing.renewalPrice);
    let discountAmount = 0;
    let appliedPromo: string | null = null;
    const domainFqdn = `${domain.name}${domain.tld}`;

    // Apply promo code if provided
    if (promoCode) {
      const [promo] = await db.select().from(promoCodesTable)
        .where(eq(promoCodesTable.code, promoCode.toUpperCase())).limit(1);
      if (
        promo && promo.isActive &&
        (!promo.usageLimit || promo.usedCount < promo.usageLimit) &&
        (!promo.expiresAt || new Date() < promo.expiresAt)
      ) {
        const at = (promo as any).applicableTo ?? "all";
        if (at === "all" || at === "domain") {
          discountAmount = Number((renewPrice * promo.discountPercent / 100).toFixed(2));
          renewPrice = Math.max(0, Number((renewPrice - discountAmount).toFixed(2)));
          appliedPromo = promo.code;
          await db.update(promoCodesTable).set({ usedCount: promo.usedCount + 1 }).where(eq(promoCodesTable.id, promo.id));
        }
      }
    }

    console.log("RENEW DEBUG:", { domain: domainFqdn, tld, originalPrice: Number(pricing.renewalPrice), discount: discountAmount, finalPrice: renewPrice, promo: appliedPromo });

    const [order] = await db.insert(ordersTable).values({
      clientId,
      type: "renewal",
      itemId: domain.id,
      itemName: `${domainFqdn} - Domain Renewal (1 year)`,
      amount: String(renewPrice),
      status: "pending",
      notes: `Domain renewal for ${domainFqdn}${appliedPromo ? ` (promo: ${appliedPromo})` : ""}`,
    }).returning();

    const invoiceNumber = generateInvoiceNumber();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    const [invoice] = await db.insert(invoicesTable).values({
      invoiceNumber,
      clientId,
      orderId: order.id,
      amount: String(renewPrice),
      tax: "0",
      total: String(renewPrice),
      status: "unpaid",
      dueDate,
      items: [
        {
          description: `${domainFqdn} - Domain Renewal (1 year)`,
          quantity: 1,
          unitPrice: Number(pricing.renewalPrice),
          total: Number(pricing.renewalPrice),
        },
        ...(discountAmount > 0 ? [{ description: `Promo: ${appliedPromo}`, quantity: 1, unitPrice: -discountAmount, total: -discountAmount }] : []),
      ],
    } as any).returning();

    console.log("RENEW DEBUG:", { domain: domainFqdn, renewPrice, invoiceId: invoice.id, invoiceNumber, promo: appliedPromo });

    res.json({
      success: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: renewPrice,
      domain: domainFqdn,
    });
  } catch (err: any) {
    console.error("[DOMAIN RENEW]", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

// Client: get DNS records for own domain
router.get("/domains/:id/dns", authenticate, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const [domain] = await db.select().from(domainsTable)
      .where(and(eq(domainsTable.id, req.params.id), eq(domainsTable.clientId, clientId))).limit(1);
    if (!domain) { res.status(404).json({ error: "Domain not found" }); return; }
    const records = await db.select().from(dnsRecordsTable)
      .where(eq(dnsRecordsTable.serviceId, domain.id));
    res.json({ success: true, records });
  } catch (err: any) {
    console.error("[DNS]", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

// Client: add DNS record for own domain
router.post("/domains/:id/dns", authenticate, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const [domain] = await db.select().from(domainsTable)
      .where(and(eq(domainsTable.id, req.params.id), eq(domainsTable.clientId, clientId))).limit(1);
    if (!domain) { res.status(404).json({ error: "Domain not found" }); return; }
    if (domain.status === "pending") { res.status(400).json({ error: "Cannot manage DNS for a pending domain" }); return; }

    const { type, name, value, ttl = 3600, priority } = req.body;
    if (!type || !name || !value) { res.status(400).json({ error: "type, name, and value are required" }); return; }

    const [record] = await db.insert(dnsRecordsTable).values({
      serviceId: domain.id,
      domain: `${domain.name}${domain.tld}`,
      type: type.toUpperCase(),
      name,
      value,
      ttl: Number(ttl),
      priority: priority ? Number(priority) : null,
    }).returning();
    res.json({ success: true, record });
  } catch (err: any) {
    console.error("[DNS]", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

// Client: delete DNS record for own domain
router.delete("/domains/:id/dns/:recordId", authenticate, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const [domain] = await db.select().from(domainsTable)
      .where(and(eq(domainsTable.id, req.params.id), eq(domainsTable.clientId, clientId))).limit(1);
    if (!domain) { res.status(404).json({ error: "Domain not found" }); return; }

    await db.delete(dnsRecordsTable)
      .where(and(eq(dnsRecordsTable.id, req.params.recordId), eq(dnsRecordsTable.serviceId, domain.id)));
    res.json({ success: true });
  } catch (err: any) {
    console.error("[DNS]", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

// Client: get my domains
router.get("/domains", authenticate, async (req: AuthRequest, res) => {
  try {
    const domains = await db.select().from(domainsTable).where(eq(domainsTable.clientId, req.user!.userId));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    res.json(domains.map(d => formatDomain(d, user ? `${user.firstName} ${user.lastName}` : "")));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: get all domains
router.get("/admin/domains", authenticate, requireAdmin, async (_req, res) => {
  try {
    const domains = await db.select().from(domainsTable);
    const result = await Promise.all(domains.map(async (d) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, d.clientId)).limit(1);
      return formatDomain(d, user ? `${user.firstName} ${user.lastName}` : "");
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: get domain pricing
router.get("/admin/domains/pricing", authenticate, requireAdmin, async (_req, res) => {
  try {
    const pricing = await db.select().from(domainPricingTable);
    res.json(pricing.map(p => ({
      id: p.id,
      tld: p.tld,
      registrationPrice: Number(p.registrationPrice),
      renewalPrice: Number(p.renewalPrice),
      transferPrice: Number(p.transferPrice),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: set domain pricing
router.post("/admin/domains/pricing", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { tld, registrationPrice, renewalPrice, transferPrice } = req.body;
    const existing = await db.select().from(domainPricingTable).where(eq(domainPricingTable.tld, tld)).limit(1);

    let result;
    if (existing.length > 0) {
      [result] = await db.update(domainPricingTable)
        .set({ registrationPrice: String(registrationPrice), renewalPrice: String(renewalPrice), transferPrice: String(transferPrice || 10), updatedAt: new Date() })
        .where(eq(domainPricingTable.tld, tld))
        .returning();
    } else {
      [result] = await db.insert(domainPricingTable).values({
        tld,
        registrationPrice: String(registrationPrice),
        renewalPrice: String(renewalPrice),
        transferPrice: String(transferPrice || 10),
      }).returning();
    }

    res.json({
      id: result.id,
      tld: result.tld,
      registrationPrice: Number(result.registrationPrice),
      renewalPrice: Number(result.renewalPrice),
      transferPrice: Number(result.transferPrice),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: add domain manually
router.post("/admin/domains", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { clientId, name, tld, registrar, registrationDate, expiryDate, nextDueDate, status = "active", autoRenew = true } = req.body;
    if (!clientId || !name || !tld) { res.status(400).json({ error: "clientId, name, tld are required" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, clientId)).limit(1);
    if (!user) { res.status(404).json({ error: "Client not found" }); return; }
    const [domain] = await db.insert(domainsTable).values({
      clientId,
      name: name.trim().toLowerCase(),
      tld: tld.trim().toLowerCase(),
      registrar: registrar || "",
      registrationDate: registrationDate ? new Date(registrationDate) : new Date(),
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      nextDueDate: nextDueDate ? new Date(nextDueDate) : undefined,
      status,
      autoRenew,
      nameservers: ["ns1.noehost.com", "ns2.noehost.com"],
    }).returning();
    res.status(201).json(formatDomain(domain, `${user.firstName} ${user.lastName}`));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: edit domain
router.put("/admin/domains/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { clientId, registrar, registrationDate, expiryDate, nextDueDate, status, autoRenew, moduleServerId, nameservers, isFreeDomain } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (clientId !== undefined) updates.clientId = clientId;
    if (registrar !== undefined) updates.registrar = registrar;
    if (registrationDate !== undefined) updates.registrationDate = registrationDate ? new Date(registrationDate) : null;
    if (expiryDate !== undefined) updates.expiryDate = expiryDate ? new Date(expiryDate) : null;
    if (nextDueDate !== undefined) updates.nextDueDate = nextDueDate ? new Date(nextDueDate) : null;
    if (status !== undefined) updates.status = status;
    if (autoRenew !== undefined) updates.autoRenew = autoRenew;
    if (moduleServerId !== undefined) updates.moduleServerId = moduleServerId || null;
    if (nameservers !== undefined && Array.isArray(nameservers)) updates.nameservers = nameservers;
    if (isFreeDomain !== undefined) updates.isFreeDomain = Boolean(isFreeDomain);
    const [updated] = await db.update(domainsTable).set(updates).where(eq(domainsTable.id, req.params.id)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated.clientId)).limit(1);
    res.json(formatDomain(updated, user ? `${user.firstName} ${user.lastName}` : ""));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: delete domain
router.delete("/admin/domains/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    await db.delete(domainsTable).where(eq(domainsTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: renew domain
router.post("/admin/domains/:id/renew", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [domain] = await db.select().from(domainsTable).where(eq(domainsTable.id, req.params.id)).limit(1);
    if (!domain) { res.status(404).json({ error: "Not found" }); return; }

    const currentExpiry = domain.expiryDate || new Date();
    const newExpiry = new Date(currentExpiry);
    newExpiry.setFullYear(newExpiry.getFullYear() + 1);

    const [updated] = await db.update(domainsTable)
      .set({ expiryDate: newExpiry, status: "active" })
      .where(eq(domainsTable.id, req.params.id))
      .returning();

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated.clientId)).limit(1);
    res.json(formatDomain(updated, user ? `${user.firstName} ${user.lastName}` : ""));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: 20i domain sync — attempt to sync nameservers/status from 20i API
router.post("/admin/domains/:id/sync-module", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [domain] = await db.select().from(domainsTable).where(eq(domainsTable.id, req.params.id)).limit(1);
    if (!domain) { res.status(404).json({ error: "Not found" }); return; }
    const moduleServerId = (domain as any).moduleServerId;
    if (!moduleServerId) { res.json({ success: false, message: "No module server assigned to this domain" }); return; }

    // Fetch server credentials
    const { serversTable } = await import("@workspace/db/schema");
    const [server] = await db.select().from(serversTable).where(eq(serversTable.id, moduleServerId)).limit(1);
    if (!server) { res.json({ success: false, message: "Module server not found" }); return; }

    if (server.type === "20i" && server.apiToken) {
      try {
        const fetch = (await import("node-fetch")).default;
        const fullDomain = `${domain.name}${domain.tld}`;
        const resp = await (fetch as any)(`https://api.20i.com/domain/${fullDomain}`, {
          headers: { Authorization: `Bearer ${server.apiToken}` },
          signal: AbortSignal.timeout(8000),
        });
        if (resp.ok) {
          const data: any = await resp.json();
          const ns = data?.nameservers || data?.nameServerGroup?.nameServers;
          const updates: Record<string, unknown> = { updatedAt: new Date() };
          if (ns && Array.isArray(ns) && ns.length > 0) {
            updates.nameservers = ns.map((n: any) => typeof n === "string" ? n : n.name || n.host || "");
          }
          const [updated] = await db.update(domainsTable).set(updates).where(eq(domainsTable.id, domain.id)).returning();
          const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated.clientId)).limit(1);
          res.json({ success: true, message: `Synced from 20i API`, domain: formatDomain(updated, user ? `${user.firstName} ${user.lastName}` : "") }); return;
        }
      } catch (_e) { /* fall through */ }
    }
    res.json({ success: false, message: `Could not sync with ${server.type} API — check credentials` });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// Client: toggle transfer lock on own domain (enforces 60-day registration lock)
router.put("/domains/:id/lock", authenticate, async (req: AuthRequest, res) => {
  try {
    const [domain] = await db.select().from(domainsTable).where(eq(domainsTable.id, req.params.id)).limit(1);
    if (!domain) { res.status(404).json({ error: "Domain not found" }); return; }

    const isAdmin = req.user!.role === "admin" || req.user!.adminPermission === "super_admin";
    if (!isAdmin && domain.clientId !== req.user!.userId) {
      res.status(403).json({ error: "Forbidden" }); return;
    }

    const currentLock = domain.lockStatus ?? "locked";
    const targetLock = req.body.lockStatus ?? (currentLock === "locked" ? "unlocked" : "locked");

    // Enforce 60-day rule: clients cannot unlock within the first 60 days
    if (!isAdmin && targetLock === "unlocked") {
      const { isIn60DayLock, daysRemainingInLock } = calcRegistrationLock(domain.registrationDate, domain.lockOverrideByAdmin);
      if (isIn60DayLock) {
        return res.status(403).json({
          error: "60_DAY_LOCK",
          message: `Domain cannot be transferred within 60 days of registration. ${daysRemainingInLock} day(s) remaining.`,
          daysRemaining: daysRemainingInLock,
        });
      }
    }

    // Generate and store EPP code when unlocking (so it's stable and persistent)
    let eppCode = domain.eppCode;
    if (targetLock === "unlocked" && !eppCode) {
      eppCode = generateEppCode(domain.id);
    }
    // Clear EPP code when locking again (security: force new code on next unlock)
    if (targetLock === "locked") {
      eppCode = null;
    }

    await db.update(domainsTable)
      .set({
        lockStatus: targetLock,
        eppCode,
        lastLockChange: new Date(),
        updatedAt: new Date(),
      } as any)
      .where(eq(domainsTable.id, domain.id));

    console.log(`[LOCK] Domain ${domain.name}${domain.tld} → ${targetLock}${isAdmin ? " (admin)" : ""}`);
    res.json({
      lockStatus: targetLock,
      eppCode: targetLock === "unlocked" ? eppCode : null,
      lastLockChange: new Date().toISOString(),
      domain: `${domain.name}${domain.tld}`,
    });
  } catch (err) { console.error("[LOCK]", err); res.status(500).json({ error: "Server error" }); }
});

// Admin: force-override 60-day lock (manual unlock/lock bypass)
router.put("/admin/domains/:id/lock-override", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [domain] = await db.select().from(domainsTable).where(eq(domainsTable.id, req.params.id)).limit(1);
    if (!domain) { res.status(404).json({ error: "Domain not found" }); return; }

    const { lockStatus: targetLock, override } = req.body as { lockStatus?: string; override?: boolean };
    const nextLock = targetLock ?? (domain.lockStatus === "locked" ? "unlocked" : "locked");
    const setOverride = override !== undefined ? override : true;

    let eppCode = domain.eppCode;
    if (nextLock === "unlocked" && !eppCode) {
      eppCode = generateEppCode(domain.id);
    }
    if (nextLock === "locked") {
      eppCode = null;
    }

    await db.update(domainsTable)
      .set({
        lockStatus: nextLock,
        eppCode,
        lastLockChange: new Date(),
        lockOverrideByAdmin: setOverride,
        updatedAt: new Date(),
      } as any)
      .where(eq(domainsTable.id, domain.id));

    console.log(`[ADMIN LOCK OVERRIDE] ${domain.name}${domain.tld} → ${nextLock}, override=${setOverride}`);
    res.json({
      lockStatus: nextLock,
      eppCode: nextLock === "unlocked" ? eppCode : null,
      lockOverrideByAdmin: setOverride,
      lastLockChange: new Date().toISOString(),
      domain: `${domain.name}${domain.tld}`,
    });
  } catch (err) { console.error("[ADMIN LOCK]", err); res.status(500).json({ error: "Server error" }); }
});

// Client: get EPP / auth code for own domain
router.get("/domains/:id/epp", authenticate, async (req: AuthRequest, res) => {
  try {
    const [domain] = await db.select().from(domainsTable).where(eq(domainsTable.id, req.params.id)).limit(1);
    if (!domain) { res.status(404).json({ error: "Domain not found" }); return; }

    const isAdmin = req.user!.role === "admin" || req.user!.adminPermission === "super_admin";
    if (!isAdmin && domain.clientId !== req.user!.userId) {
      res.status(403).json({ error: "Forbidden" }); return;
    }

    if (domain.lockStatus === "locked") {
      return res.status(403).json({
        error: "Transfer lock is enabled. Disable the transfer lock to reveal the EPP code.",
        lockStatus: "locked",
      });
    }

    // Return stored code, generate if missing (e.g. unlock predates this feature)
    let eppCode = domain.eppCode;
    if (!eppCode) {
      eppCode = generateEppCode(domain.id);
      await db.update(domainsTable)
        .set({ eppCode, updatedAt: new Date() } as any)
        .where(eq(domainsTable.id, domain.id));
    }

    res.json({ domainId: domain.id, domain: `${domain.name}${domain.tld}`, eppCode });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

export default router;
