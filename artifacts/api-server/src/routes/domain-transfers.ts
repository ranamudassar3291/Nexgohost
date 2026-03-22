import { Router } from "express";
import { db } from "@workspace/db";
import {
  domainTransfersTable,
  domainsTable,
  usersTable,
  domainPricingTable,
  affiliatesTable,
  affiliateReferralsTable,
  affiliateCommissionsTable,
} from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { authenticate, requireRole, type AuthRequest } from "../lib/auth.js";
import { emailGeneric } from "../lib/email.js";

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

    // Send confirmation email (non-blocking)
    (async () => {
      try {
        const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
        if (user) {
          const clientName = `${user.firstName} ${user.lastName}`;
          emailGeneric(
            user.email,
            "Domain Transfer Initiated – " + domain,
            clientName,
            `Your domain transfer request for <strong>${domain}</strong> has been received and is now <strong>${valid ? "under review" : "pending validation"}</strong>.<br/><br/>` +
            `<strong>Domain:</strong> ${domain}<br/>` +
            `<strong>Transfer Price:</strong> Rs. ${price}<br/>` +
            `<strong>Status:</strong> ${valid ? "Validating" : "Pending"}<br/><br/>` +
            `<strong>Next Steps:</strong><br/>` +
            `1. Our team will verify your EPP/Auth code.<br/>` +
            `2. Once approved, the transfer process will begin (typically 5–7 days).<br/>` +
            `3. You will receive an email update when the status changes.<br/><br/>` +
            `If you have any questions, please open a support ticket from your client portal.`
          ).catch(console.warn);
        }
      } catch { /* non-fatal */ }
    })();

    // Auto-commission for affiliate referrals (non-blocking)
    (async () => {
      try {
        const transferPrice = parseFloat(price);
        if (transferPrice <= 0) return;
        const [referral] = await db.select().from(affiliateReferralsTable)
          .where(eq(affiliateReferralsTable.referredUserId, req.user!.userId)).limit(1);
        if (referral) {
          const [affiliate] = await db.select().from(affiliatesTable)
            .where(eq(affiliatesTable.id, referral.affiliateId)).limit(1);
          if (affiliate && affiliate.status === "active") {
            const commAmt = affiliate.commissionType === "percentage"
              ? transferPrice * (parseFloat(affiliate.commissionValue) / 100)
              : parseFloat(affiliate.commissionValue);
            if (commAmt > 0) {
              await db.insert(affiliateCommissionsTable).values({
                affiliateId: affiliate.id,
                referredUserId: req.user!.userId,
                amount: String(commAmt.toFixed(2)),
                status: "pending",
                description: `Commission for domain transfer: ${domain}`,
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

    res.status(201).json({ transfer, valid, message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Client: Cancel a pending/validating transfer ───────────────────────────────
router.put("/domains/transfers/:id/cancel", authenticate, async (req: AuthRequest, res) => {
  try {
    const [transfer] = await db.select().from(domainTransfersTable)
      .where(eq(domainTransfersTable.id, req.params.id!)).limit(1);
    if (!transfer) { res.status(404).json({ error: "Transfer not found" }); return; }
    if (transfer.clientId !== req.user!.userId) { res.status(403).json({ error: "Forbidden" }); return; }
    if (!["pending", "validating"].includes(transfer.status)) {
      res.status(400).json({ error: "Only pending or validating transfers can be cancelled" }); return;
    }
    const [updated] = await db.update(domainTransfersTable)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(domainTransfersTable.id, req.params.id!))
      .returning();
    res.json({ transfer: updated });
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
    const { adminNotes } = req.body || {};
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
    const { adminNotes } = req.body || {};
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
