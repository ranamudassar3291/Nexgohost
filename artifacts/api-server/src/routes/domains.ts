import { Router } from "express";
import { db } from "@workspace/db";
import { domainsTable, domainPricingTable, usersTable, ordersTable, invoicesTable } from "@workspace/db/schema";
import { eq, sql, desc } from "drizzle-orm";
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

async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const [latest] = await db
    .select({ num: invoicesTable.invoiceNumber })
    .from(invoicesTable)
    .orderBy(desc(invoicesTable.createdAt))
    .limit(1);

  let seq = 1;
  if (latest?.num) {
    const parts = latest.num.split("-");
    const lastNum = parseInt(parts[parts.length - 1] || "0", 10);
    seq = isNaN(lastNum) ? 1 : lastNum + 1;
  }
  return `INV-${year}-${String(seq).padStart(3, "0")}`;
}

function formatDomain(d: typeof domainsTable.$inferSelect, clientName?: string) {
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

    const pricing = await db.select().from(domainPricingTable).orderBy(domainPricingTable.tld);

    const existingInDb = await db
      .select({ name: domainsTable.name, tld: domainsTable.tld })
      .from(domainsTable)
      .where(eq(domainsTable.name, rawName));

    const takenTldsInDb = new Set(existingInDb.map(d => d.tld));

    const results = await Promise.all(
      pricing.map(async (p) => {
        if (takenTldsInDb.has(p.tld)) {
          return { tld: p.tld, available: false, registrationPrice: Number(p.registrationPrice), renewalPrice: Number(p.renewalPrice) };
        }
        const status = await checkRdapAvailability(rawName, p.tld);
        return {
          tld: p.tld,
          available: status === "available" || status === "unknown",
          rdapStatus: status,
          registrationPrice: Number(p.registrationPrice),
          renewalPrice: Number(p.renewalPrice),
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

    const [existing] = await db
      .select()
      .from(domainsTable)
      .where(eq(domainsTable.name, cleanName))
      .limit(1);

    const takenTld = existing?.tld === cleanTld;
    if (takenTld) {
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
      nameservers: ["ns1.nexgohost.com", "ns2.nexgohost.com"],
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

    const invoiceNumber = await generateInvoiceNumber();
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
      nameservers: ["ns1.nexgohost.com", "ns2.nexgohost.com"],
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
    const { clientId, registrar, expiryDate, nextDueDate, status, autoRenew } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (clientId !== undefined) updates.clientId = clientId;
    if (registrar !== undefined) updates.registrar = registrar;
    if (expiryDate !== undefined) updates.expiryDate = expiryDate ? new Date(expiryDate) : null;
    if (nextDueDate !== undefined) updates.nextDueDate = nextDueDate ? new Date(nextDueDate) : null;
    if (status !== undefined) updates.status = status;
    if (autoRenew !== undefined) updates.autoRenew = autoRenew;
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

export default router;
