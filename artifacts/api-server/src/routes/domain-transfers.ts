import { Router } from "express";
import { db } from "@workspace/db";
import {
  domainTransfersTable,
  domainsTable,
  usersTable,
  domainExtensionsTable,
  ordersTable,
  invoicesTable,
  affiliatesTable,
  affiliateReferralsTable,
  affiliateCommissionsTable,
  promoCodesTable,
} from "@workspace/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { authenticate, requireRole, type AuthRequest } from "../lib/auth.js";
import {
  emailDomainTransferInitiated,
  emailDomainTransferApproved,
  emailDomainTransferCompleted,
  emailDomainTransferRejected,
} from "../lib/email.js";

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
 * Validate domain heuristics:
 * - Name part must be >= 3 chars
 * - Must not be all-numeric
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

// RDAP servers for TLD existence + lock status check
const RDAP_SERVERS: Record<string, string> = {
  ".com": "https://rdap.verisign.com/com/v1/domain/",
  ".net": "https://rdap.verisign.com/net/v1/domain/",
  ".org": "https://rdap.publicinterestregistry.org/rdap/domain/",
  ".co": "https://rdap.nic.co/domain/",
  ".io": "https://rdap.nic.io/domain/",
  ".uk": "https://rdap.nominet.uk/uk/domain/",
  ".pk": "https://rdap.pknic.net.pk/domain/",
  ".info": "https://rdap.afilias.info/rdap/v1/domain/",
  ".biz": "https://rdap.nic.biz/domain/",
  ".us": "https://rdap.nic.us/rdap/v1/domain/",
  ".in": "https://rdap.registry.in/domain/",
};

interface RdapResult {
  registrationStatus: "registered" | "not_registered" | "unknown";
  lockStatus: "locked" | "unlocked" | "unknown";
  statusCodes: string[];
}

/**
 * Real RDAP check: domain existence + transfer lock status.
 * Reads RDAP `status` array — "client transfer prohibited" = locked.
 */
async function checkDomainViaRdap(domain: string): Promise<RdapResult> {
  const tld = "." + domain.split(".").slice(1).join(".");
  const server = RDAP_SERVERS[tld];
  if (!server) return { registrationStatus: "unknown", lockStatus: "unknown", statusCodes: [] };

  const url = `${server}${domain}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/rdap+json" },
    }).finally(() => clearTimeout(timer));

    if (res.status === 404) return { registrationStatus: "not_registered", lockStatus: "unknown", statusCodes: [] };
    if (res.status !== 200) return { registrationStatus: "unknown", lockStatus: "unknown", statusCodes: [] };

    const data: any = await res.json();
    const statusCodes: string[] = Array.isArray(data.status)
      ? data.status.map((s: string) => s.toLowerCase())
      : [];

    const isLocked = statusCodes.some(s =>
      s.includes("client transfer prohibited") ||
      s.includes("server transfer prohibited")
    );

    return {
      registrationStatus: "registered",
      lockStatus: isLocked ? "locked" : "unlocked",
      statusCodes,
    };
  } catch {
    return { registrationStatus: "unknown", lockStatus: "unknown", statusCodes: [] };
  }
}

/**
 * Get transfer pricing from domain_extensions (admin-configured PKR prices).
 * Only returns pricing if transferAllowed = true and status = active.
 */
async function getTransferPricing(tld: string) {
  // Try with dot prefix and without (domain_extensions stores as ".com")
  const candidates = tld.startsWith(".") ? [tld, tld.slice(1)] : [`.${tld}`, tld];
  for (const candidate of candidates) {
    const [ext] = await db.select().from(domainExtensionsTable)
      .where(
        and(
          eq(domainExtensionsTable.extension, candidate),
          eq(domainExtensionsTable.status, "active"),
          eq(domainExtensionsTable.transferAllowed, true),
        )
      ).limit(1);
    if (ext) return ext;
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

    // STEP 2: Heuristic check
    const heuristic = checkDomainHeuristics(domain);
    if (!heuristic.valid) {
      res.status(400).json({ valid: false, exists: false, error: heuristic.reason });
      return;
    }

    const tld = extractTld(domain);

    // STEP 3: TLD must be admin-approved for transfers (transferAllowed = true)
    const pricing = await getTransferPricing(tld);
    if (!pricing) {
      res.status(400).json({
        valid: false,
        error: `TLD .${tld} is not supported for transfers. Please check our supported TLD list or contact support.`,
      });
      return;
    }

    // STEP 4: Real domain existence + lock status via RDAP
    const rdap = await checkDomainViaRdap(domain);
    if (rdap.registrationStatus === "not_registered") {
      res.status(400).json({
        valid: false,
        exists: false,
        error: "Domain is not registered. Only registered domains can be transferred.",
      });
      return;
    }

    // STEP 5: Check if domain already in our system
    const name = extractName(domain);
    const [alreadyOwned] = await db.select().from(domainsTable)
      .where(eq(domainsTable.name, name)).limit(1);
    if (alreadyOwned && (alreadyOwned.tld === `.${tld}` || alreadyOwned.tld === tld)) {
      res.status(409).json({ valid: false, error: `${domain} is already registered in our system.` });
      return;
    }

    // STEP 6: EPP validation (min 8 chars, must contain letters AND numbers)
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

    const transferPrice = Number(pricing.transferPrice);
    const lockStatus = rdap.lockStatus; // "locked" | "unlocked" | "unknown"

    console.log("[DOMAIN TRANSFER VALIDATE]", {
      domain,
      tld,
      transferPrice,
      lockStatus,
      rdapStatus: rdap.statusCodes,
      eppValid: eppResult.valid,
    });

    // If definitely locked, block and inform the client
    if (lockStatus === "locked") {
      res.status(400).json({
        valid: false,
        domain,
        tld,
        exists: true,
        lockStatus: "locked",
        transferable: false,
        error: "Domain transfer lock is currently ENABLED. Please log in to your current registrar, disable the transfer lock (ClientTransferProhibited), and try again.",
      });
      return;
    }

    res.json({
      valid: true,
      domain,
      tld,
      exists: true,
      lockStatus,   // "unlocked" or "unknown"
      transferable: true,
      transferPrice,
      statusCodes: rdap.statusCodes,
      message: lockStatus === "unknown"
        ? "Domain validated. EPP code accepted. Transfer lock status could not be confirmed — please ensure domain is unlocked at your current registrar."
        : "Domain is eligible for transfer. EPP code validated. Domain is unlocked.",
    });
  } catch (err) {
    console.error("[TRANSFER VALIDATE ERROR]", err);
    res.status(500).json({ valid: false, error: "Server error during validation. Please try again." });
  }
});

// ── Client: Submit a transfer request (creates order + invoice + domain entry) ─
router.post("/domains/transfer", authenticate, async (req: AuthRequest, res) => {
  try {
    const { domainName, epp, promoCode, paymentMethodId } = req.body;

    if (!domainName || !epp) {
      res.status(400).json({ error: "Domain name and EPP code are required" });
      return;
    }

    const domain = domainName.trim().toLowerCase();

    if (!validateDomainFormat(domain)) {
      res.status(400).json({ error: "Invalid domain name format" });
      return;
    }

    const name = extractName(domain);
    const tld = extractTld(domain);

    const heuristic = checkDomainHeuristics(domain);
    if (!heuristic.valid) {
      res.status(400).json({ error: heuristic.reason });
      return;
    }

    // TLD must be admin-approved for transfers
    const pricing = await getTransferPricing(tld);
    if (!pricing) {
      res.status(400).json({ error: `TLD .${tld} is not supported for transfers.` });
      return;
    }

    // Real existence + lock check
    const rdap = await checkDomainViaRdap(domain);
    if (rdap.registrationStatus === "not_registered") {
      res.status(400).json({ error: "Domain is not registered. Only registered domains can be transferred." });
      return;
    }
    if (rdap.lockStatus === "locked") {
      res.status(400).json({ error: "Domain transfer lock is ENABLED. Disable the transfer lock at your current registrar before submitting." });
      return;
    }

    const eppResult = validateEpp(epp);
    if (!eppResult.valid) {
      res.status(400).json({ error: eppResult.message });
      return;
    }

    let transferPrice = Number(pricing.transferPrice);
    const lockStatus = rdap.lockStatus; // "unlocked" | "unknown"
    const userId = req.user!.userId;

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    // Apply promo code if provided
    let discountAmount = 0;
    let appliedPromo: string | null = null;
    if (promoCode) {
      const [promo] = await db.select().from(promoCodesTable)
        .where(eq(promoCodesTable.code, promoCode.toUpperCase())).limit(1);
      if (promo && promo.isActive &&
          (!promo.usageLimit || promo.usedCount < promo.usageLimit) &&
          (!promo.expiresAt || new Date() < promo.expiresAt)) {
        const at = (promo as any).applicableTo ?? "all";
        if (at === "all" || at === "domain") {
          discountAmount = Number((transferPrice * Number(promo.discountPercent) / 100).toFixed(2));
          transferPrice = Math.max(0, Number((transferPrice - discountAmount).toFixed(2)));
          appliedPromo = promo.code;
          await db.update(promoCodesTable).set({ usedCount: promo.usedCount + 1 }).where(eq(promoCodesTable.id, promo.id));
        }
      }
    }

    console.log("[DOMAIN TRANSFER SUBMIT]", { domain, tld, transferPrice, discountAmount, lockStatus, eppValid: true, promo: appliedPromo });

    // Create Order
    const [order] = await db.insert(ordersTable).values({
      clientId: userId,
      type: "domain",
      itemName: `${domain} - Domain Transfer`,
      amount: String(transferPrice),
      status: "pending",
      notes: `Domain transfer request for ${domain}${appliedPromo ? ` (promo: ${appliedPromo})` : ""}${paymentMethodId ? ` | Payment: ${paymentMethodId}` : ""}`,
    }).returning();

    // Create Invoice
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
      items: [
        {
          description: `${domain} - Domain Transfer (1 year)`,
          quantity: 1,
          unitPrice: transferPrice,
          total: transferPrice,
        },
        ...(discountAmount > 0 ? [{
          description: `Promo Code (${appliedPromo})`,
          quantity: 1,
          unitPrice: -discountAmount,
          total: -discountAmount,
        }] : []),
      ],
    }).returning();

    // Insert domain with "pending_transfer" status
    const [domainEntry] = await db.insert(domainsTable).values({
      clientId: userId,
      name,
      tld: `.${tld}`,
      registrar: "Transfer Pending",
      status: "pending_transfer" as any,
      lockStatus: lockStatus === "unlocked" ? "unlocked" : "locked",
      autoRenew: true,
      nameservers: [],
    }).onConflictDoNothing().returning();

    // Create transfer record
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

    // Link transfer ID to domain
    if (domainEntry) {
      await db.update(domainsTable)
        .set({ transferId: transfer.id, updatedAt: new Date() })
        .where(eq(domainsTable.id, domainEntry.id));
    }

    // Send proper transfer initiated email
    const clientName = `${user.firstName} ${user.lastName}`;
    emailDomainTransferInitiated(user.email, {
      clientName,
      domain,
      transferPrice: transferPrice.toFixed(2),
      invoiceNumber,
    }).catch(console.warn);

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

    await db.update(domainsTable)
      .set({ status: "cancelled" as any, updatedAt: new Date() })
      .where(eq(domainsTable.transferId, updated.id));

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
router.get("/admin/domain-transfers", authenticate, requireRole("admin"), async (_req: AuthRequest, res) => {
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
      updatedAt: domainTransfersTable.updatedAt,
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
    const [transfer] = await db.select().from(domainTransfersTable)
      .where(eq(domainTransfersTable.id, req.params.id!)).limit(1);
    if (!transfer) { res.status(404).json({ error: "Transfer not found" }); return; }

    const [updated] = await db.update(domainTransfersTable)
      .set({ status: "approved", adminNotes: adminNotes || null, updatedAt: new Date() })
      .where(eq(domainTransfersTable.id, req.params.id!))
      .returning();

    const tld = extractTld(transfer.domainName);
    const name = extractName(transfer.domainName);

    // Update domain to "transferring" status (in-progress, not yet complete)
    const existing = await db.update(domainsTable)
      .set({ status: "transferring" as any, registrar: "Transfer In Progress", updatedAt: new Date() })
      .where(eq(domainsTable.transferId, transfer.id))
      .returning();

    if (!existing.length) {
      await db.insert(domainsTable).values({
        clientId: transfer.clientId,
        name,
        tld: `.${tld}`,
        status: "transferring" as any,
        registrar: "Transfer In Progress",
        transferId: transfer.id,
      }).onConflictDoNothing();
    }

    // Send approval email to client
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, transfer.clientId)).limit(1);
    if (user) {
      emailDomainTransferApproved(user.email, {
        clientName: `${user.firstName} ${user.lastName}`,
        domain: transfer.domainName,
        adminNotes: adminNotes || undefined,
      }).catch(console.warn);
    }

    res.json({ transfer: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: Mark transfer as completed ─────────────────────────────────────────
router.put("/admin/domain-transfers/:id/complete", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { adminNotes, expiryDate } = req.body || {};
    const [transfer] = await db.select().from(domainTransfersTable)
      .where(eq(domainTransfersTable.id, req.params.id!)).limit(1);
    if (!transfer) { res.status(404).json({ error: "Transfer not found" }); return; }

    const [updated] = await db.update(domainTransfersTable)
      .set({ status: "completed", adminNotes: adminNotes || null, updatedAt: new Date() })
      .where(eq(domainTransfersTable.id, req.params.id!))
      .returning();

    const tld = extractTld(transfer.domainName);
    const name = extractName(transfer.domainName);
    const expiry = expiryDate ? new Date(expiryDate) : (() => {
      const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d;
    })();

    // Mark domain as active
    const existing = await db.update(domainsTable)
      .set({
        status: "active",
        registrar: "Noehost",
        expiryDate: expiry,
        nextDueDate: expiry,
        updatedAt: new Date(),
      })
      .where(eq(domainsTable.transferId, transfer.id))
      .returning();

    if (!existing.length) {
      await db.insert(domainsTable).values({
        clientId: transfer.clientId,
        name,
        tld: `.${tld}`,
        status: "active",
        registrar: "Noehost",
        expiryDate: expiry,
        nextDueDate: expiry,
        transferId: transfer.id,
      }).onConflictDoNothing();
    }

    // Also mark the order as completed
    if (transfer.orderId) {
      await db.update(ordersTable)
        .set({ status: "completed", updatedAt: new Date() } as any)
        .where(eq(ordersTable.id, transfer.orderId));
    }

    // Send completion email to client
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, transfer.clientId)).limit(1);
    if (user) {
      emailDomainTransferCompleted(user.email, {
        clientName: `${user.firstName} ${user.lastName}`,
        domain: transfer.domainName,
        expiryDate: expiry.toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" }),
      }).catch(console.warn);
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

    await db.update(domainsTable)
      .set({ status: "cancelled" as any, updatedAt: new Date() })
      .where(eq(domainsTable.transferId, updated.id));

    // Send rejection email to client
    const [transfer] = await db.select().from(domainTransfersTable)
      .where(eq(domainTransfersTable.id, req.params.id!)).limit(1);
    const [user] = await db.select().from(usersTable)
      .where(eq(usersTable.id, updated.clientId)).limit(1);
    if (user) {
      emailDomainTransferRejected(user.email, {
        clientName: `${user.firstName} ${user.lastName}`,
        domain: updated.domainName,
        reason: adminNotes || undefined,
      }).catch(console.warn);
    }

    res.json({ transfer: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
