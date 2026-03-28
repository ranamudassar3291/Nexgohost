import { Router } from "express";
import { db } from "@workspace/db";
import { domainsTable, domainExtensionsTable, usersTable, promoCodesTable } from "@workspace/db/schema";
import { eq, and, lte, gte } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { emailDomain30DayReminder, emailDomain15DayDiscount, emailDomain1DayUrgent } from "../lib/email.js";

const router = Router();

function getRestorationFee(tld: string): number {
  const t = tld.toLowerCase();
  if (t.includes(".pk")) return 5000;
  if (t === ".com" || t === ".net") return 15000;
  return 10000;
}

// GET /admin/domains/upcoming-renewals — domains expiring within 60 days
router.get("/admin/domains/upcoming-renewals", authenticate, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const now = new Date();
    const in60Days = new Date(now);
    in60Days.setDate(in60Days.getDate() + 60);

    const domains = await db.select({
      id: domainsTable.id,
      name: domainsTable.name,
      tld: domainsTable.tld,
      status: domainsTable.status,
      expiryDate: domainsTable.expiryDate,
      clientId: domainsTable.clientId,
      autoRenew: domainsTable.autoRenew,
    }).from(domainsTable)
      .where(and(lte(domainsTable.expiryDate, in60Days), gte(domainsTable.expiryDate, now)));

    const result = await Promise.all(domains.map(async (d) => {
      const [user] = await db.select({
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
      }).from(usersTable).where(eq(usersTable.id, d.clientId)).limit(1);

      const [pricing] = await db.select({ renewalPrice: domainExtensionsTable.renewalPrice })
        .from(domainExtensionsTable)
        .where(eq(domainExtensionsTable.extension, d.tld))
        .limit(1);

      const expiryDate = new Date(d.expiryDate!);
      const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const restorationFee = d.status === "redemption_period" ? getRestorationFee(d.tld) : 0;

      return {
        id: d.id,
        name: d.name,
        tld: d.tld,
        domain: `${d.name}${d.tld}`,
        status: d.status,
        expiryDate: d.expiryDate,
        daysLeft,
        autoRenew: d.autoRenew,
        clientEmail: user?.email ?? "—",
        clientName: user
          ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email
          : "—",
        renewalPrice: pricing ? Number(pricing.renewalPrice) : null,
        totalDue: (pricing ? Number(pricing.renewalPrice) : 0) + restorationFee,
        restorationFee,
      };
    }));

    result.sort((a, b) => a.daysLeft - b.daysLeft);
    res.json({ success: true, domains: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/domains/:id/send-reminder — manually trigger renewal reminder email
router.post("/admin/domains/:id/send-reminder", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [domain] = await db.select().from(domainsTable)
      .where(eq(domainsTable.id, req.params.id)).limit(1);
    if (!domain) { res.status(404).json({ error: "Domain not found" }); return; }

    const [user] = await db.select().from(usersTable)
      .where(eq(usersTable.id, domain.clientId)).limit(1);
    if (!user) { res.status(404).json({ error: "Domain owner not found" }); return; }

    const expiryDate = new Date(domain.expiryDate!);
    const now = new Date();
    const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const domainFqdn = `${domain.name}${domain.tld}`;
    const expiryStr = expiryDate.toLocaleDateString("en-PK", {
      day: "numeric", month: "long", year: "numeric",
    });
    const clientName = user.firstName
      ? `${user.firstName} ${user.lastName ?? ""}`.trim()
      : user.email;
    const renewUrl = `${process.env["CLIENT_URL"] || ""}/domains/${domain.id}`;

    const [pricing] = await db.select({ renewalPrice: domainExtensionsTable.renewalPrice })
      .from(domainExtensionsTable)
      .where(eq(domainExtensionsTable.extension, domain.tld))
      .limit(1);
    const renewalPrice = pricing
      ? `Rs. ${Number(pricing.renewalPrice).toLocaleString()}`
      : "Contact support";
    const renewalPriceRaw = pricing ? Number(pricing.renewalPrice) : 0;

    let emailSent = "none";
    if (daysLeft <= 1) {
      await emailDomain1DayUrgent(
        user.email,
        { clientName, domainName: domainFqdn, expiryDate: expiryStr, renewalPrice, renewUrl },
        { clientId: domain.clientId, referenceId: domain.id },
      );
      emailSent = "1d-urgent";
    } else if (daysLeft <= 15) {
      const couponCode = `RENEW10-${domain.name.toUpperCase().slice(0, 6)}`;
      const discountedStr = renewalPriceRaw > 0
        ? `Rs. ${Math.round(renewalPriceRaw * 0.9).toLocaleString()}`
        : "Contact support";
      try {
        const promoExpiry = new Date();
        promoExpiry.setDate(promoExpiry.getDate() + 15);
        await db.insert(promoCodesTable).values({
          code: couponCode,
          description: `15-day renewal discount for ${domainFqdn}`,
          discountType: "percent",
          discountPercent: 10,
          isActive: true,
          usageLimit: 1,
          expiresAt: promoExpiry,
          applicableTo: "domain",
        } as any).onConflictDoNothing();
      } catch { /* ignore duplicate */ }
      await emailDomain15DayDiscount(
        user.email,
        { clientName, domainName: domainFqdn, expiryDate: expiryStr, renewalPrice, discountedPrice: discountedStr, couponCode, renewUrl },
        { clientId: domain.clientId, referenceId: domain.id },
      );
      emailSent = "15d-discount";
    } else {
      await emailDomain30DayReminder(
        user.email,
        { clientName, domainName: domainFqdn, expiryDate: expiryStr, renewalPrice, renewUrl },
        { clientId: domain.clientId, referenceId: domain.id },
      );
      emailSent = "30d-reminder";
    }

    res.json({ success: true, emailSent, domain: domainFqdn, to: user.email });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
