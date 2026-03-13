import { Router } from "express";
import { db } from "@workspace/db";
import { domainsTable, domainPricingTable, usersTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";

const router = Router();

function formatDomain(d: typeof domainsTable.$inferSelect, clientName?: string) {
  return {
    id: d.id,
    clientId: d.clientId,
    clientName: clientName || "",
    name: d.name,
    tld: d.tld,
    registrationDate: d.registrationDate?.toISOString(),
    expiryDate: d.expiryDate?.toISOString(),
    status: d.status,
    autoRenew: d.autoRenew,
    nameservers: d.nameservers || [],
  };
}

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

export default router;
