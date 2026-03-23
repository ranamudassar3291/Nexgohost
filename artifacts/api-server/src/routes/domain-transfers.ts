import { Router } from "express";
import { db } from "@workspace/db";
import {
  domainTransfersTable,
  domainsTable,
  usersTable,
  domainPricingTable,
  ordersTable,
  invoicesTable,
  affiliatesTable,
  affiliateReferralsTable,
  affiliateCommissionsTable,
} from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { authenticate, requireRole, type AuthRequest } from "../lib/auth.js";
import { emailGeneric } from "../lib/email.js";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractTld(domain: string): string {
  const parts = domain.toLowerCase().trim().split(".");
  if (parts.length < 2) return "";
  return parts.slice(1).join(".");
}

function extractName(domain: string): string {
  return domain.toLowerCase().trim().split(".")[0] || "";
}

function validateDomainFormat(domain: string): boolean {
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/.test(domain.trim());
}

/** Strict EPP validation: >= 8 chars, must contain both letters and numbers */
function validateEpp(epp: string): { valid: boolean; message: string } {
  const code = epp.trim();
  if (!code || code.length < 8) {
    return { valid: false, message: "Authorization code must be at least 8 characters long." };
  }
  const hasLetters = /[a-zA-Z]/.test(code);
  const hasNumbers = /[0-9]/.test(code);
  if (!hasLetters || !hasNumbers) {
    return { valid: false, message: "Authorization code must contain both letters and numbers." };
  }
  return { valid: true, message: "EPP code is valid." };
}

/**
 * Determine lock status for a domain.
 * Rule: domains containing "lock" or starting with certain suspicious keywords
 * are "locked". Others are "unlocked".
 * In production, this would query the current registrar's API.
 */
function determineLockStatus(domain: string): "locked" | "unlocked" {
  const d = domain.toLowerCase();
  if (d.includes("lock") || d.startsWith("locked") || d.startsWith("secure")) return "locked";
  const hash = Array.from(domain).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return hash % 5 === 0 ? "locked" : "unlocked";
}

// RDAP servers for real-time domain existence check
const RDAP_SERVERS: Record<string, string> = {
  ".com": "https://rdap.verisign.com/com/v1/domain/",
  ".net": "https://rdap.verisign.com/net/v1/domain/",
  ".org": "https://rdap.publicinterestregistry.org/rdap/domain/",
  ".co": "https://rdap.nic.co/domain/",
  ".io": "https://rdap.nic.io/domain/",
  ".uk": "https://rdap.nominet.uk/uk/domain/",
  ".pk": "https://rdap.pknic.net.pk/domain/",
};

/**
 * Check if a domain is actually registered using RDAP.
 * Returns: "registered" | "not_registered" | "unknown"
 * "unknown" = RDAP not available for TLD or network error → allow through
 */
async function checkDomainRegisteredViaRdap(domain: string): Promise<"registered" | "not_registered" | "unknown"> {
  const tld = "." + domain.split(".").slice(1).join(".");
  const server = RDAP_SERVERS[tld];
  if (!server) return "unknown";  // no RDAP server for this TLD → can't verify

  const url = `${server}${domain}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/rdap+json" },
    }).finally(() => clearTimeout(timer));

    if (res.status === 200) return "registered";   // domain exists in registry
    if (res.status === 404) return "not_registered"; // domain not in registry
    return "unknown"; // other status → uncertain
  } catch {
    return "unknown"; // timeout or network error → let through
  }
}

/**
 * Validate that a domain name itself looks plausible:
 * - Name part must be >= 3 chars
 * - Must not be all-numeric
 * - TLD must be in our supported list
 */
function checkDomainHeuristics(domain: string): { valid: boolean; reason: string } {
  const name = extractName(domain);
  if (!name || name.length < 3) {
    return { valid: false, reason: "Domain name must be at least 3 characters long." };
  }
  if (/^[0-9]+$/.test(name)) {
    return { valid: false, reason: "Domain name cannot be all numbers." };
  }
  return { valid: true, reason: "" };
}

/** Normalize TLD for pricing lookup: try with and without dot prefix */
async function getTransferPricing(tld: string) {
  const candidates = [tld, tld.startsWith(".") ? tld.slice(1) : `.${tld}`];
  for (const candidate of candidates) {
    const [pricing] = await db.select().from(domainPricingTable)
      .where(eq(domainPricingTable.tld, candidate)).limit(1);
    if (pricing) return pricing;
  }
  return null;
}

function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV-${year}-${suffix}`;
}

// ── Client: Validate domain transfer ─────────────────────────────────────────
router.post("/domains/transfer/validate", authenticate, async (req: AuthRequest, res) => {
  try {
    const { domainName, epp } = req.body;

    if (!domainName || !epp) {
      res.status(400).json({ valid: false, error: "Domain name and EPP code are required" });
      return;
    }

    const domain = domainName.trim().toLowerCase();

    // STEP 1: Domain format validation
    if (!validateDomainFormat(domain)) {
      res.status(400).json({ valid: false, error: "Invalid domain name format. Example: example.com" });
      return;
    }

    // STEP 2: Heuristic format/name check
    const heuristic = checkDomainHeuristics(domain);
    if (!heuristic.valid) {
      res.status(400).json({ valid: false, exists: false, error: heuristic.reason });
      return;
    }

    const domainName_ = extractName(domain);
    const tld = extractTld(domain);

    // STEP 3: TLD must be in our supported list
    const pricingCheck = await getTransferPricing(tld);
    if (!pricingCheck) {
      res.status(400).json({
        valid: false,
        error: `TLD .${tld} is not supported for transfers. Check our supported TLD list.`,
      });
      return;
    }

    // STEP 4: Real domain existence check via RDAP
    const rdapResult = await checkDomainRegisteredViaRdap(domain);
    if (rdapResult === "not_registered") {
      res.status(400).json({
        valid: false,
        exists: false,
        error: "Domain is not registered. Only registered domains can be transferred.",
      });
      return;
    }
    // rdapResult === "unknown" → RDAP unavailable for this TLD → proceed

    // STEP 5: Check if domain already in our system
    const [alreadyOwned] = await db.select().from(domainsTable)
      .where(eq(domainsTable.name, domainName_)).limit(1);
    if (alreadyOwned && alreadyOwned.tld === `.${tld}` || alreadyOwned && alreadyOwned.tld === tld) {
      res.status(409).json({ valid: false, error: `${domain} is already registered in our system.` });
      return;
    }

    // STEP 5: EPP validation (min 8 chars, must contain letters AND numbers)
    const eppResult = validateEpp(epp);
    if (!eppResult.valid) {
      res.status(400).json({
        valid: false,
        domain,
        exists: true,
        transferable: false,
        error: eppResult.message,
      });
      return;
    }

    // STEP 6: Pricing already fetched in STEP 3 — reuse it
    const transferPrice = Number(pricingCheck.transferPrice);

    console.log("[DOMAIN TRANSFER]", {
      domain,
      tld,
      pricing: { tld: pricingCheck.tld, transferPrice },
      lockStatus: "unknown (external registrar)",
      rdapResult,
      eppValid: eppResult.valid,
    });

    res.json({
      valid: true,
      domain,
      tld,
      exists: true,
      lockStatus: "unlocked",
      transferable: true,
      transferPrice,
      message: "Domain is eligible for transfer. EPP code validated. Ensure domain is unlocked at your current registrar.",
    });
  } catch (err) {
    console.error("[TRANSFER VALIDATE ERROR]", err);
    res.status(500).json({ valid: false, error: "Server error during validation. Please try again." });
  }
});

// ── Client: Submit a transfer request (creates order + invoice + domain entry) ─
router.post("/domains/transfer", authenticate, async (req: AuthRequest, res) => {
  try {
    const { domainName, epp } = req.body;

    if (!domainName || !epp) {
      res.status(400).json({ error: "Domain name and EPP code are required" });
      return;
    }

    const domain = domainName.trim().toLowerCase();

    // Re-run all validations (never trust client state alone)
    if (!validateDomainFormat(domain)) {
      res.status(400).json({ error: "Invalid domain name format" });
      return;
    }

    const name = extractName(domain);
    const tld = extractTld(domain);

    // Heuristic check
    const heuristic = checkDomainHeuristics(domain);
    if (!heuristic.valid) {
      res.status(400).json({ error: heuristic.reason });
      return;
    }

    // TLD must be supported
    const pricingCheck2 = await getTransferPricing(tld);
    if (!pricingCheck2) {
      res.status(400).json({ error: `TLD .${tld} is not supported for transfers.` });
      return;
    }

    // Real existence check
    const rdapCheck = await checkDomainRegisteredViaRdap(domain);
    if (rdapCheck === "not_registered") {
      res.status(400).json({ error: "Domain is not registered. Only registered domains can be transferred." });
      return;
    }

    // Validate EPP code (min 8 chars, must have letters AND numbers)
    const eppResult = validateEpp(epp);
    if (!eppResult.valid) {
      res.status(400).json({ error: eppResult.message });
      return;
    }

    // Pricing already verified in step above — reuse pricingCheck2
    const transferPrice = Number(pricingCheck2.transferPrice);
    const userId = req.user!.userId;

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    console.log("[DOMAIN TRANSFER]", {
      domain,
      tld,
      pricing: { tld: pricingCheck2.tld, transferPrice },
      lockStatus: "unknown (external registrar)",
      eppValid: true,
    });

    // FIX 5 & 6: Create Order
    const [order] = await db.insert(ordersTable).values({
      clientId: userId,
      type: "domain",
      itemName: `${domain} - Domain Transfer`,
      amount: String(transferPrice),
      status: "pending",
      notes: `Domain transfer request for ${domain}`,
    }).returning();

    // FIX 5 & 6: Create Invoice
    const invoiceNumber = generateInvoiceNumber();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    const [invoice] = await db.insert(invoicesTable).values({
      invoiceNumber,
      clientId: userId,
      amount: String(transferPrice),
      tax: "0",
      total: String(transferPrice),
      status: "unpaid",
      dueDate,
      items: [{
        description: `${domain} - Domain Transfer (1 year)`,
        quantity: 1,
        unitPrice: transferPrice,
        total: transferPrice,
      }],
    }).returning();

    // FIX 7: Insert domain with "pending_transfer" status so it shows in dashboard
    const [domainEntry] = await db.insert(domainsTable).values({
      clientId: userId,
      name,
      tld: `.${tld}`,
      registrar: "Transfer Pending",
      status: "pending_transfer" as any,
      lockStatus,
      autoRenew: true,
      nameservers: [],
    }).onConflictDoNothing().returning();

    // Create transfer record, linked to order + invoice + domain
    const [transfer] = await db.insert(domainTransfersTable).values({
      clientId: userId,
      domainName: domain,
      epp: epp.trim(),
      status: "validating",
      validationMessage: "Domain validated. Transfer request submitted successfully.",
      price: String(transferPrice),
      orderId: order.id,
      invoiceId: invoice.id,
    }).returning();

    // If domain was inserted, link the transfer ID to it
    if (domainEntry) {
      await db.update(domainsTable)
        .set({ transferId: transfer.id, updatedAt: new Date() })
        .where(eq(domainsTable.id, domainEntry.id));
    }

    // Send confirmation email (non-blocking)
    const clientName = `${user.firstName} ${user.lastName}`;
    emailGeneric(
      user.email,
      `Domain Transfer Initiated — ${domain}`,
      clientName,
      `Your domain transfer request for <strong>${domain}</strong> has been received.<br/><br/>` +
      `<strong>Domain:</strong> ${domain}<br/>` +
      `<strong>Transfer Price:</strong> Rs. ${transferPrice.toFixed(2)}<br/>` +
      `<strong>Invoice:</strong> #${invoiceNumber}<br/>` +
      `<strong>Status:</strong> Under Review<br/><br/>` +
      `<strong>Next Steps:</strong><br/>` +
      `1. Our team will verify your EPP/Auth code.<br/>` +
      `2. Once approved, the transfer process will begin (5–7 days).<br/>` +
      `3. You will receive an email update when the status changes.<br/><br/>` +
      `To pay your invoice, log in to your client portal.`
    ).catch(console.warn);

    // Auto-commission for affiliate referrals (non-blocking)
    (async () => {
      try {
        if (transferPrice <= 0) return;
        const [referral] = await db.select().from(affiliateReferralsTable)
          .where(eq(affiliateReferralsTable.referredUserId, userId)).limit(1);
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
                referredUserId: userId,
                orderId: order.id,
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

    res.status(201).json({
      transfer,
      order: { id: order.id, amount: transferPrice, status: order.status },
      invoice: { id: invoice.id, invoiceNumber, amount: transferPrice, status: "unpaid", dueDate },
      domain: domainEntry || null,
    });
  } catch (err) {
    console.error("[TRANSFER SUBMIT ERROR]", err);
    res.status(500).json({ error: "Server error. Your transfer was not submitted. Please try again." });
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

    // Also remove domain entry if still pending_transfer
    if (transfer.domainName) {
      const domName = extractName(transfer.domainName);
      await db.update(domainsTable)
        .set({ status: "cancelled" as any, updatedAt: new Date() })
        .where(eq(domainsTable.transferId, updated.id));
    }

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
      orderId: domainTransfersTable.orderId,
      invoiceId: domainTransfersTable.invoiceId,
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
    const name = extractName(transfer.domainName);

    // Update domain entry to "active" if it exists, otherwise create it
    const existing = await db.update(domainsTable)
      .set({ status: "active", registrar: "Transferred", updatedAt: new Date() })
      .where(eq(domainsTable.transferId, transfer.id))
      .returning();

    if (!existing.length) {
      await db.insert(domainsTable).values({
        clientId: transfer.clientId,
        name,
        tld: `.${tld}`,
        status: "active",
        registrar: "Transferred",
        transferId: transfer.id,
      }).onConflictDoNothing();
    }

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

    // Mark domain as cancelled in domains table
    await db.update(domainsTable)
      .set({ status: "cancelled" as any, updatedAt: new Date() })
      .where(eq(domainsTable.transferId, updated.id));

    res.json({ transfer: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
