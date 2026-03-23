import { db } from "@workspace/db";
import {
  hostingServicesTable, invoicesTable, domainsTable, usersTable,
  cronLogsTable, emailLogsTable, hostingPlansTable, notificationsTable,
} from "@workspace/db/schema";
import { eq, lte, sql, and, gte } from "drizzle-orm";
import { suspendHostingAccount, unsuspendHostingAccount } from "./provision.js";

async function notify(userId: string, type: "invoice" | "domain" | "system", title: string, message: string, link?: string) {
  try {
    await db.insert(notificationsTable).values({ userId, type, title, message, link: link || null });
  } catch { /* non-fatal */ }
}

async function logCron(task: string, status: "success" | "failed" | "skipped", message?: string) {
  try {
    await db.insert(cronLogsTable).values({ task, status, message: message || null });
  } catch { /* non-fatal */ }
}

async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const [latest] = await db.select({ num: invoicesTable.invoiceNumber })
    .from(invoicesTable).orderBy(sql`created_at DESC`).limit(1);
  let seq = 1;
  if (latest?.num) {
    const parts = latest.num.split("-");
    const last = parseInt(parts[parts.length - 1] || "0", 10);
    seq = isNaN(last) ? 1 : last + 1;
  }
  return `INV-${year}-${String(seq).padStart(4, "0")}`;
}

async function logEmail(clientId: string, email: string, emailType: string, subject: string, referenceId?: string) {
  try {
    await db.insert(emailLogsTable).values({ clientId, email, emailType, subject, referenceId: referenceId || null });
  } catch { /* non-fatal */ }
}

// ─── Task 1: Auto-generate invoices for services due today ───────────────────
export async function runBillingCron(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    const dueServices = await db.select().from(hostingServicesTable)
      .where(and(
        eq(hostingServicesTable.status, "active"),
        eq(hostingServicesTable.autoRenew, true),
        gte(hostingServicesTable.nextDueDate, today),
        lte(hostingServicesTable.nextDueDate, tomorrow),
      ));

    let invoicesCreated = 0;

    for (const service of dueServices) {
      const existingInvoice = await db.select().from(invoicesTable)
        .where(and(
          eq(invoicesTable.serviceId, service.id),
          eq(invoicesTable.status, "unpaid"),
        )).limit(1);

      if (existingInvoice.length > 0) continue;

      const [plan] = await db.select().from(hostingPlansTable).where(eq(hostingPlansTable.id, service.planId)).limit(1);
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, service.clientId)).limit(1);
      if (!user) continue;

      const invoiceNumber = await generateInvoiceNumber();
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + 7);

      const nextDueDate = new Date(service.nextDueDate || today);
      if (service.billingCycle === "yearly") {
        nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
      } else {
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      }

      // Use actual plan price; fall back to "0.00" only if no plan found
      const amount = service.billingCycle === "yearly"
        ? (plan?.yearlyPrice ?? plan?.price ?? "0.00").toString()
        : (plan?.price ?? "0.00").toString();

      await db.insert(invoicesTable).values({
        invoiceNumber,
        clientId: service.clientId,
        serviceId: service.id,
        amount,
        tax: "0",
        total: amount,
        status: "unpaid",
        dueDate,
        items: [{ description: `${service.planName} - Renewal`, amount }],
      });

      await db.update(hostingServicesTable)
        .set({ nextDueDate, updatedAt: new Date() })
        .where(eq(hostingServicesTable.id, service.id));

      await logEmail(service.clientId, user.email, "invoice_generated", `Invoice ${invoiceNumber} – Service Renewal`, service.id);
      notify(service.clientId, "invoice", "Invoice Generated", `Invoice ${invoiceNumber} for ${service.planName} renewal — Rs. ${amount}`, `/client/invoices`).catch(() => {});

      invoicesCreated++;
    }

    await logCron("billing:invoice_generation", "success", `Created ${invoicesCreated} invoice(s) for ${dueServices.length} due service(s)`);
  } catch (err: any) {
    await logCron("billing:invoice_generation", "failed", err.message);
    console.error("[CRON] billing:invoice_generation error:", err.message);
  }
}

// ─── Task 2: Auto-suspend overdue hosting (3+ days unpaid) ───────────────────
export async function runSuspendOverdueCron(): Promise<void> {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  threeDaysAgo.setHours(23, 59, 59, 999);

  try {
    const overdueInvoices = await db.select().from(invoicesTable)
      .where(and(
        eq(invoicesTable.status, "unpaid"),
        lte(invoicesTable.dueDate, threeDaysAgo),
      ));

    let suspended = 0;

    for (const invoice of overdueInvoices) {
      if (!invoice.serviceId) continue;

      const [service] = await db.select().from(hostingServicesTable)
        .where(and(
          eq(hostingServicesTable.id, invoice.serviceId),
          eq(hostingServicesTable.status, "active"),
        )).limit(1);

      if (!service) continue;

      try {
        if (service.username) {
          await suspendHostingAccount(service.username, service.serverId, "Overdue Invoice");
        }
      } catch { /* WHM may fail — still update DB */ }

      await db.update(hostingServicesTable)
        .set({ status: "suspended", updatedAt: new Date() })
        .where(eq(hostingServicesTable.id, service.id));

      await db.update(invoicesTable)
        .set({ status: "overdue", updatedAt: new Date() })
        .where(eq(invoicesTable.id, invoice.id));

      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, service.clientId)).limit(1);
      if (user) {
        await logEmail(service.clientId, user.email, "service_suspended", "Your hosting account has been suspended – Overdue Invoice", service.id);
      }

      suspended++;
    }

    await logCron("billing:auto_suspend", "success", `Suspended ${suspended} overdue service(s)`);
  } catch (err: any) {
    await logCron("billing:auto_suspend", "failed", err.message);
    console.error("[CRON] billing:auto_suspend error:", err.message);
  }
}

// ─── Task 3: Auto-domain renewal check (7 days before expiry) ────────────────
export async function runDomainRenewalCron(): Promise<void> {
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  try {
    const expiringDomains = await db.select().from(domainsTable)
      .where(and(
        eq(domainsTable.status, "active"),
        lte(domainsTable.expiryDate, sevenDaysFromNow),
        gte(domainsTable.expiryDate, new Date()),
      ));

    let renewed = 0;
    let reminded = 0;

    for (const domain of expiringDomains) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, domain.clientId)).limit(1);
      if (!user) continue;

      if (domain.autoRenew) {
        const newExpiry = new Date(domain.expiryDate || new Date());
        newExpiry.setFullYear(newExpiry.getFullYear() + 1);
        await db.update(domainsTable)
          .set({ expiryDate: newExpiry, nextDueDate: newExpiry, updatedAt: new Date() })
          .where(eq(domainsTable.id, domain.id));
        await logEmail(domain.clientId, user.email, "domain_renewed", `Domain ${domain.name}.${domain.tld} renewed`, domain.id);
        notify(domain.clientId, "domain", "Domain Renewed", `${domain.name}.${domain.tld} has been auto-renewed for 1 year`, `/client/domains`).catch(() => {});
        renewed++;
      } else {
        await logEmail(domain.clientId, user.email, "domain_expiring", `Your domain ${domain.name}.${domain.tld} expires in 7 days`, domain.id);
        notify(domain.clientId, "domain", "Domain Expiring Soon", `${domain.name}.${domain.tld} expires in 7 days. Enable auto-renew to keep it.`, `/client/domains`).catch(() => {});
        reminded++;
      }
    }

    await logCron("domains:renewal_check", "success", `Renewed: ${renewed}, Reminded: ${reminded} of ${expiringDomains.length} expiring domain(s)`);
  } catch (err: any) {
    await logCron("domains:renewal_check", "failed", err.message);
    console.error("[CRON] domains:renewal_check error:", err.message);
  }
}

// ─── Task 4: Email invoice reminders ─────────────────────────────────────────
export async function runInvoiceRemindersCron(): Promise<void> {
  const now = new Date();

  try {
    const unpaidInvoices = await db.select().from(invoicesTable)
      .where(eq(invoicesTable.status, "unpaid"));

    let sent = 0;

    for (const invoice of unpaidInvoices) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, invoice.clientId)).limit(1);
      if (!user || !invoice.dueDate) continue;

      const daysUntilDue = Math.ceil((invoice.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      let emailType: string | null = null;

      if (daysUntilDue === 7) emailType = "invoice_reminder_7d";
      else if (daysUntilDue === 3) emailType = "invoice_reminder_3d";
      else if (daysUntilDue === 0) emailType = "invoice_due_today";
      else if (daysUntilDue === -3) emailType = "invoice_overdue_3d";

      if (!emailType) continue;

      const alreadySent = await db.select().from(emailLogsTable)
        .where(and(
          eq(emailLogsTable.referenceId, invoice.id),
          eq(emailLogsTable.emailType, emailType),
        )).limit(1);

      if (alreadySent.length > 0) continue;

      const subjects: Record<string, string> = {
        invoice_reminder_7d: `Invoice ${invoice.invoiceNumber} due in 7 days`,
        invoice_reminder_3d: `Invoice ${invoice.invoiceNumber} due in 3 days`,
        invoice_due_today: `Invoice ${invoice.invoiceNumber} is due today`,
        invoice_overdue_3d: `OVERDUE: Invoice ${invoice.invoiceNumber} – Action Required`,
      };

      await logEmail(invoice.clientId, user.email, emailType, subjects[emailType] || emailType, invoice.id);
      sent++;
    }

    await logCron("emails:invoice_reminders", "success", `Sent ${sent} invoice reminder email(s)`);
  } catch (err: any) {
    await logCron("emails:invoice_reminders", "failed", err.message);
    console.error("[CRON] emails:invoice_reminders error:", err.message);
  }
}

// ─── Task 5: Auto-unsuspend services whose invoices are now paid ──────────────
// Runs every 5 min: finds suspended services that have a paid/active invoice,
// calls WHM unsuspendacct, and sets service status back to Active.
export async function runUnsuspendRestoredCron(): Promise<void> {
  try {
    // Find all suspended hosting services that have a paid invoice
    const suspendedServices = await db.select().from(hostingServicesTable)
      .where(eq(hostingServicesTable.status, "suspended"));

    let unsuspended = 0;

    for (const service of suspendedServices) {
      // Look for any paid invoice linked to this service
      const [paidInvoice] = await db.select().from(invoicesTable)
        .where(and(
          eq(invoicesTable.serviceId, service.id),
          eq(invoicesTable.status, "paid"),
        )).limit(1);

      if (!paidInvoice) continue;

      // Also ensure there are no current overdue unpaid invoices for this service
      const [overdueInvoice] = await db.select().from(invoicesTable)
        .where(and(
          eq(invoicesTable.serviceId, service.id),
          eq(invoicesTable.status, "overdue"),
        )).limit(1);

      if (overdueInvoice) continue; // Still has overdue invoices — keep suspended

      // Unsuspend in WHM
      try {
        if (service.username) {
          await unsuspendHostingAccount(service.username, service.serverId);
        }
      } catch (whmErr: any) {
        console.warn(`[CRON] unsuspend WHM error for ${service.username}: ${whmErr.message}`);
        /* WHM may fail — still update DB status */
      }

      await db.update(hostingServicesTable)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(hostingServicesTable.id, service.id));

      const [user] = await db.select().from(usersTable)
        .where(eq(usersTable.id, service.clientId)).limit(1);
      if (user) {
        await logEmail(
          service.clientId,
          user.email,
          "service_unsuspended",
          `Your hosting account ${service.domain || service.planName} has been reactivated`,
          service.id,
        );
      }

      unsuspended++;
    }

    await logCron("billing:auto_unsuspend", "success", `Unsuspended ${unsuspended} service(s)`);
  } catch (err: any) {
    await logCron("billing:auto_unsuspend", "failed", err.message);
    console.error("[CRON] billing:auto_unsuspend error:", err.message);
  }
}

// ─── Master cron runner (runs all tasks) ─────────────────────────────────────
export async function runAllCronTasks(): Promise<void> {
  console.log("[CRON] Running all cron tasks...");
  await Promise.allSettled([
    runBillingCron(),
    runSuspendOverdueCron(),
    runUnsuspendRestoredCron(),
    runDomainRenewalCron(),
    runInvoiceRemindersCron(),
  ]);
  console.log("[CRON] All tasks completed.");
}
