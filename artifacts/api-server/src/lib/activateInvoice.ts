/**
 * Shared post-payment activation logic.
 * Called by Safepay webhook (and can be used by future auto-payment gateways).
 * NEVER called for manual/bank-transfer/jazzcash-manual payments — those require admin approval.
 */
import { db } from "@workspace/db";
import {
  invoicesTable, ordersTable, domainsTable, hostingServicesTable,
  transactionsTable, affiliateCommissionsTable, affiliatesTable,
  usersTable, creditTransactionsTable,
} from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { provisionHostingService } from "./provision.js";
import { emailInvoicePaid } from "./email.js";
import { generateInvoicePdf } from "./invoicePdf.js";

// ─── Domain renewal helper ─────────────────────────────────────────────────────
async function processRenewalOrder(order: typeof ordersTable.$inferSelect) {
  if (order.type !== "renewal" || !order.itemId) return;
  const [domain] = await db.select().from(domainsTable)
    .where(eq(domainsTable.id, order.itemId)).limit(1);
  if (!domain) return;
  const current = domain.expiryDate ? new Date(domain.expiryDate) : new Date();
  const extended = new Date(current);
  extended.setFullYear(extended.getFullYear() + 1);
  await db.update(domainsTable)
    .set({ expiryDate: extended.toISOString().split("T")[0], status: "active", updatedAt: new Date() })
    .where(eq(domainsTable.id, domain.id));
  await db.update(ordersTable)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(ordersTable.id, order.id));
  console.log(`[RENEWAL] Domain ${domain.name}${domain.tld} renewed → expiry ${extended.toISOString().split("T")[0]}`);
}

// ─── Domain new-order activation helper ────────────────────────────────────────
async function activateDomainOrder(order: any, invoiceNumber?: string, invoiceDueDate?: Date | null) {
  const fullDomain = (order.domain || order.itemName || "").toLowerCase().trim();
  const dotIdx = fullDomain.indexOf(".");
  const domainName = dotIdx > 0 ? fullDomain.substring(0, dotIdx) : fullDomain;
  const tld = dotIdx > 0 ? fullDomain.substring(dotIdx) : ".com";
  if (!domainName) return;

  const now = new Date();
  const expiryDate = (invoiceDueDate && !isNaN(new Date(invoiceDueDate).getTime()))
    ? new Date(invoiceDueDate)
    : (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d; })();

  const [existing] = await db.select().from(domainsTable)
    .where(and(eq(domainsTable.name, domainName), eq(domainsTable.tld, tld))).limit(1);

  if (existing) {
    await db.update(domainsTable).set({
      status: "active", expiryDate, nextDueDate: expiryDate,
      lockStatus: "unlocked", registrationDate: existing.registrationDate ?? now, updatedAt: now,
    }).where(eq(domainsTable.id, existing.id));
  } else {
    await db.insert(domainsTable).values({
      clientId: order.clientId, name: domainName, tld, status: "active",
      expiryDate, nextDueDate: expiryDate, registrationDate: now, lockStatus: "unlocked",
    });
  }
  await db.update(ordersTable).set({ status: "approved", updatedAt: now })
    .where(eq(ordersTable.id, order.id));
  console.log(`[DOMAIN] ${domainName}${tld} activated (invoice: ${invoiceNumber ?? "—"})`);
}

// ─── Invoice format helper ─────────────────────────────────────────────────────
function formatInvoice(i: typeof invoicesTable.$inferSelect) {
  const rawItems = (i.items ?? []) as Array<any>;
  const items = rawItems.map((item: any) => ({
    description: item.description ?? "Service",
    quantity: item.quantity ?? 1,
    unitPrice: item.unitPrice ?? item.amount ?? Number(i.amount ?? 0),
    total: item.total ?? item.amount ?? Number(i.amount ?? 0),
  }));
  return {
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    clientId: i.clientId,
    amount: Number(i.amount ?? 0),
    tax: Number(i.tax ?? 0),
    total: Number(i.total ?? 0),
    status: i.status,
    dueDate: i.dueDate,
    paidDate: i.paidDate,
    paymentRef: i.paymentRef,
    invoiceType: i.invoiceType,
    items,
  };
}

// ─── Main exported function ────────────────────────────────────────────────────
/**
 * processInvoicePaid — marks an invoice as paid and runs all downstream
 * activation side-effects: service provisioning, affiliate commission credits,
 * and the paid email notification.
 *
 * @param invoiceId      DB ID of the invoice to mark paid
 * @param transactionRef Payment reference / Safepay tracker token
 * @param paymentNotes   Optional notes
 */
export async function processInvoicePaid(
  invoiceId: string,
  transactionRef: string,
  paymentNotes?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Load the invoice
    const [invoice] = await db.select().from(invoicesTable)
      .where(eq(invoicesTable.id, invoiceId)).limit(1);
    if (!invoice) return { success: false, error: "Invoice not found" };

    // 2. Idempotency — already paid → skip silently
    if (invoice.status === "paid") {
      console.log(`[ACTIVATE] Invoice ${invoice.invoiceNumber} already paid — skipping`);
      return { success: true };
    }

    // 3. Mark invoice paid
    const [updated] = await db.update(invoicesTable)
      .set({
        status: "paid",
        paidDate: new Date(),
        paymentRef: transactionRef,
        paymentNotes: paymentNotes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(invoicesTable.id, invoiceId))
      .returning();

    console.log(`[ACTIVATE] Invoice ${updated.invoiceNumber} marked PAID (ref: ${transactionRef})`);

    // 4. Record Safepay transaction
    try {
      await db.insert(transactionsTable).values({
        clientId: updated.clientId,
        invoiceId: updated.id,
        amount: updated.total,
        method: "safepay",
        status: "success",
        transactionRef,
      });
    } catch (e) { console.error("[ACTIVATE] transaction record error:", e); }

    // 5. Provision / activate services
    try {
      const [order] = updated.orderId
        ? await db.select().from(ordersTable).where(eq(ordersTable.id, updated.orderId!)).limit(1)
        : [];
      if (order?.type === "renewal") {
        await processRenewalOrder(order);
      } else if (order?.type === "hosting") {
        const [svc] = await db.select().from(hostingServicesTable)
          .where(eq(hostingServicesTable.orderId, order.id)).limit(1);
        if (svc) {
          if ((svc as any).serviceType === "vps") {
            await db.update(hostingServicesTable).set({
              status: "active",
              vpsProvisionStatus: "provisioned",
              vpsProvisionedAt: new Date(),
              vpsProvisionNotes: `Activated via Safepay — invoice ${updated.invoiceNumber}`,
              updatedAt: new Date(),
            } as any).where(eq(hostingServicesTable.id, svc.id));
            await db.update(ordersTable).set({ status: "approved", updatedAt: new Date() })
              .where(eq(ordersTable.id, order.id));
            console.log(`[ACTIVATE] VPS service ${svc.id} activated`);
          } else {
            await provisionHostingService(svc.id);
          }
        }
      } else if (order?.type === "domain") {
        await activateDomainOrder(order, updated.invoiceNumber, updated.dueDate ?? null);
      }
    } catch (e) { console.error("[ACTIVATE] provision error (non-fatal):", e); }

    // 6. Auto-credit affiliate commission
    try {
      if (updated.orderId) {
        const [pendingComm] = await db.select().from(affiliateCommissionsTable)
          .where(and(
            eq(affiliateCommissionsTable.orderId, updated.orderId),
            eq(affiliateCommissionsTable.status, "pending"),
          )).limit(1);
        if (pendingComm) {
          await db.update(affiliateCommissionsTable)
            .set({ status: "approved", paidAt: new Date() })
            .where(eq(affiliateCommissionsTable.id, pendingComm.id));
          const [affiliate] = await db.select({ userId: affiliatesTable.userId })
            .from(affiliatesTable).where(eq(affiliatesTable.id, pendingComm.affiliateId)).limit(1);
          if (affiliate) {
            await db.update(usersTable)
              .set({
                creditBalance: sql`COALESCE(${usersTable.creditBalance}::numeric, 0) + ${pendingComm.amount}::numeric`,
                updatedAt: new Date(),
              })
              .where(eq(usersTable.id, affiliate.userId));
            await db.insert(creditTransactionsTable).values({
              userId: affiliate.userId,
              amount: pendingComm.amount,
              type: "affiliate_payout",
              description: `Affiliate commission — invoice ${updated.invoiceNumber}`,
            });
          }
        }
      }
    } catch (e) { console.error("[ACTIVATE] affiliate commission error (non-fatal):", e); }

    // 7. Send paid email with PDF attachment
    try {
      const [u] = await db.select().from(usersTable)
        .where(eq(usersTable.id, updated.clientId)).limit(1);
      if (u) {
        const inv = formatInvoice(updated);
        let pdfBuf: Buffer | undefined;
        try {
          pdfBuf = await generateInvoicePdf({
            invoiceNumber: inv.invoiceNumber,
            status: "paid",
            createdAt: updated.createdAt?.toISOString() ?? new Date().toISOString(),
            dueDate: updated.dueDate?.toISOString() ?? new Date().toISOString(),
            paidDate: updated.paidDate?.toISOString() ?? new Date().toISOString(),
            clientName: `${u.firstName} ${u.lastName}`,
            clientEmail: u.email,
            amount: inv.amount,
            tax: inv.tax,
            total: inv.total,
            items: inv.items,
            paymentRef: inv.paymentRef ?? transactionRef,
            paymentNotes: paymentNotes ?? "Paid via Safepay",
          });
        } catch { /* PDF failure is non-fatal */ }
        await emailInvoicePaid(u.email, {
          clientName: `${u.firstName} ${u.lastName}`,
          invoiceId: updated.id,
          invoiceNumber: inv.invoiceNumber,
          amount: `Rs. ${Number(updated.total).toFixed(2)}`,
          paymentDate: new Date().toLocaleDateString("en-PK", {
            day: "numeric", month: "long", year: "numeric",
          }),
          invoicePdf: pdfBuf,
        });
      }
    } catch (e) { console.error("[ACTIVATE] email error (non-fatal):", e); }

    return { success: true };
  } catch (err) {
    console.error("[ACTIVATE] processInvoicePaid error:", err);
    return { success: false, error: String(err) };
  }
}
