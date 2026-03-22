import { Router } from "express";
import { db } from "@workspace/db";
import {
  domainTransfersTable,
  domainsTable,
  usersTable,
  domainPricingTable,
} from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { authenticate, requireRole, type AuthRequest } from "../lib/auth.js";

const router = Router();

function extractTld(domain: string): string {
  const parts = domain.toLowerCase().trim().split(".");
  return parts.length >= 2 ? parts.slice(1).join(".") : "";
}

function validateDomainFormat(domain: string): boolean {
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/.test(domain.trim());
}

function simulateEppValidation(domain: string, epp: string): { valid: boolean; message: string } {
  const lowerDomain = domain.toLowerCase();

  if (lowerDomain.includes("lock")) {
    return { valid: false, message: "Domain is locked. Please unlock the domain at your current registrar before initiating a transfer." };
  }

  if (!epp || epp.trim().length < 6) {
    return { valid: false, message: "Invalid EPP/Auth code. The authorization code must be at least 6 characters." };
  }

  if (/^\d+$/.test(epp.trim())) {
    return { valid: false, message: "Invalid EPP/Auth code. Authorization code cannot be numeric only." };
  }

  return { valid: true, message: "Domain is eligible for transfer. EPP code validated." };
}

// ── Client: Validate domain transfer (before adding to cart) ──────────────────
router.post("/domains/transfer/validate", authenticate, async (req: AuthRequest, res) => {
  try {
    const { domainName, epp } = req.body;
    if (!domainName || !epp) { res.status(400).json({ error: "Domain name and EPP code are required" }); return; }

    const domain = domainName.trim().toLowerCase();

    if (!validateDomainFormat(domain)) {
      res.status(400).json({ valid: false, message: "Invalid domain name format." }); return;
    }

    const tld = extractTld(domain);
    const [pricing] = await db.select().from(domainPricingTable).where(eq(domainPricingTable.tld, tld)).limit(1);
    const transferPrice = pricing?.transferPrice || "10.00";

    const { valid, message } = simulateEppValidation(domain, epp);

    res.json({ valid, message, domain, tld, transferPrice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Client: Create a transfer request ─────────────────────────────────────────
router.post("/domains/transfer", authenticate, async (req: AuthRequest, res) => {
  try {
    const { domainName, epp } = req.body;
    if (!domainName || !epp) { res.status(400).json({ error: "Domain name and EPP code are required" }); return; }

    const domain = domainName.trim().toLowerCase();

    if (!validateDomainFormat(domain)) {
      res.status(400).json({ error: "Invalid domain name format" }); return;
    }

    const { valid, message } = simulateEppValidation(domain, epp);

    const tld = extractTld(domain);
    const [pricing] = await db.select().from(domainPricingTable).where(eq(domainPricingTable.tld, tld)).limit(1);
    const price = pricing?.transferPrice || "10.00";

    const [transfer] = await db.insert(domainTransfersTable).values({
      clientId: req.user!.userId,
      domainName: domain,
      epp: epp.trim(),
      status: valid ? "validating" : "pending",
      validationMessage: message,
      price,
    }).returning();

    res.status(201).json({ transfer, valid, message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Client: List my transfer requests ─────────────────────────────────────────
router.get("/domains/transfers", authenticate, async (req: AuthRequest, res) => {
  try {
    const transfers = await db.select()
      .from(domainTransfersTable)
      .where(eq(domainTransfersTable.clientId, req.user!.userId))
      .orderBy(desc(domainTransfersTable.createdAt));

    res.json({ transfers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: List all transfer requests ─────────────────────────────────────────
router.get("/admin/domain-transfers", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const transfers = await db.select({
      id: domainTransfersTable.id,
      domainName: domainTransfersTable.domainName,
      epp: domainTransfersTable.epp,
      status: domainTransfersTable.status,
      validationMessage: domainTransfersTable.validationMessage,
      adminNotes: domainTransfersTable.adminNotes,
      price: domainTransfersTable.price,
      createdAt: domainTransfersTable.createdAt,
      clientId: domainTransfersTable.clientId,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
    })
      .from(domainTransfersTable)
      .leftJoin(usersTable, eq(domainTransfersTable.clientId, usersTable.id))
      .orderBy(desc(domainTransfersTable.createdAt));

    res.json({ transfers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: Approve a transfer ──────────────────────────────────────────────────
router.put("/admin/domain-transfers/:id/approve", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { adminNotes } = req.body;
    const [transfer] = await db.select().from(domainTransfersTable).where(eq(domainTransfersTable.id, req.params.id!)).limit(1);
    if (!transfer) { res.status(404).json({ error: "Transfer not found" }); return; }

    const [updated] = await db.update(domainTransfersTable)
      .set({ status: "approved", adminNotes: adminNotes || null, updatedAt: new Date() })
      .where(eq(domainTransfersTable.id, req.params.id!))
      .returning();

    const tld = extractTld(transfer.domainName);
    const domainName = transfer.domainName.split(".")[0] || transfer.domainName;

    await db.insert(domainsTable).values({
      clientId: transfer.clientId,
      name: domainName,
      tld,
      status: "active",
      registrar: "Transferred",
    }).onConflictDoNothing();

    res.json({ transfer: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: Reject a transfer ───────────────────────────────────────────────────
router.put("/admin/domain-transfers/:id/reject", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { adminNotes } = req.body;
    const [updated] = await db.update(domainTransfersTable)
      .set({ status: "rejected", adminNotes: adminNotes || null, updatedAt: new Date() })
      .where(eq(domainTransfersTable.id, req.params.id!))
      .returning();

    if (!updated) { res.status(404).json({ error: "Transfer not found" }); return; }
    res.json({ transfer: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
