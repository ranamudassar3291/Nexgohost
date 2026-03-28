import { getAppUrl } from "./app-url.js";
import { db } from "@workspace/db";
import {
  hostingServicesTable, invoicesTable, domainsTable, usersTable,
  cronLogsTable, emailLogsTable, hostingPlansTable, notificationsTable,
  hostingBackupsTable, domainPricingTable,
  cartSessionsTable, promoCodesTable, cartItemsTable,
} from "@workspace/db/schema";
import { eq, lte, sql, and, gte, lt, desc, isNull, ne, notInArray } from "drizzle-orm";
import { convertAndFormat } from "./currency-format.js";
import { suspendHostingAccount, unsuspendHostingAccount } from "./provision.js";
import { execAsync } from "./shell.js";
import { isMysqlReachable } from "./wordpress-provisioner.js";
import {
  emailServiceSuspended, emailHostingRenewalReminder,
  emailDomainRenewalReminder, emailDomainExpiryWarning,
  emailServiceTerminated, emailTerminationWarning,
  emailDomainStatusAlert,
  sendEmail,
} from "./email.js";
import { sendWhatsAppAlert } from "./whatsapp.js";

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

// ─── Task 1: Auto-generate invoices 14 days before service due date ──────────
export async function runBillingCron(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Window: services due between 14 and 15 days from now
  const fourteenDays = new Date(today);
  fourteenDays.setDate(fourteenDays.getDate() + 14);
  const fifteenDays = new Date(today);
  fifteenDays.setDate(fifteenDays.getDate() + 15);

  try {
    const dueServices = await db.select().from(hostingServicesTable)
      .where(and(
        eq(hostingServicesTable.status, "active"),
        eq(hostingServicesTable.autoRenew, true),
        gte(hostingServicesTable.nextDueDate, fourteenDays),
        lte(hostingServicesTable.nextDueDate, fifteenDays),
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
        try {
          await emailServiceSuspended(user.email, {
            clientName: user.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user.email,
            domain: service.domain ?? service.planName,
            serviceName: service.planName,
            invoiceId: invoice.id,
          }, { clientId: service.clientId, referenceId: service.id });
        } catch { /* non-fatal */ }
      }

      suspended++;
    }

    await logCron("billing:auto_suspend", "success", `Suspended ${suspended} overdue service(s)`);
  } catch (err: any) {
    await logCron("billing:auto_suspend", "failed", err.message);
    console.error("[CRON] billing:auto_suspend error:", err.message);
  }
}

// ─── Task 3: Hosting/VPS Renewal Reminder (7 days before due) ────────────────
export async function runHostingRenewalReminderCron(): Promise<void> {
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  sevenDaysFromNow.setHours(23, 59, 59, 999);
  const sixDaysFromNow = new Date();
  sixDaysFromNow.setDate(sixDaysFromNow.getDate() + 6);

  try {
    // Services due in exactly 7 days (between 6 and 7 days from now)
    const dueServices = await db.select().from(hostingServicesTable)
      .where(and(
        eq(hostingServicesTable.status, "active"),
        gte(hostingServicesTable.nextDueDate, sixDaysFromNow),
        lte(hostingServicesTable.nextDueDate, sevenDaysFromNow),
      ));

    let sent = 0;

    for (const service of dueServices) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, service.clientId)).limit(1);
      if (!user) continue;

      // Avoid duplicate reminder for same service/cycle
      const alreadySent = await db.select().from(emailLogsTable)
        .where(and(
          eq(emailLogsTable.referenceId, service.id),
          eq(emailLogsTable.emailType, "hosting_renewal_reminder_7d"),
        )).limit(1);

      if (alreadySent.length > 0) continue;

      // Find unpaid invoice for this service
      const [invoice] = await db.select().from(invoicesTable)
        .where(and(
          eq(invoicesTable.serviceId, service.id),
          eq(invoicesTable.status, "unpaid"),
        )).limit(1);

      const clientName = user.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user.email;
      const domainOrIp = service.domain ?? service.serverIp ?? service.planName;
      const dueDateStr = service.nextDueDate
        ? new Date(service.nextDueDate).toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" })
        : "Upcoming";

      const [plan] = await db.select().from(hostingPlansTable).where(eq(hostingPlansTable.id, service.planId)).limit(1);
      const amount = service.billingCycle === "yearly"
        ? (plan?.yearlyPrice ?? plan?.price ?? "0")
        : (plan?.price ?? "0");
      const amountStr = convertAndFormat(
        Number(amount),
        invoice?.currencyCode,
        invoice?.currencySymbol,
        invoice?.currencyRate,
      );

      try {
        await emailHostingRenewalReminder(user.email, {
          clientName,
          serviceName: service.planName,
          domainOrIp,
          dueDate: dueDateStr,
          invoiceId: invoice?.id ?? "",
          invoiceNumber: invoice?.invoiceNumber ?? "Pending",
          amount: amountStr,
        }, { clientId: service.clientId, referenceId: service.id });

        await logEmail(service.clientId, user.email, "hosting_renewal_reminder_7d",
          `Service ${service.planName} renewal reminder – due in 7 days`, service.id);

        notify(service.clientId, "invoice", "Service Renewal Reminder",
          `${service.planName} is due in 7 days. Pay ${amountStr} to keep your service active.`,
          `/client/invoices`).catch(() => {});

        sent++;
      } catch { /* non-fatal */ }
    }

    await logCron("emails:hosting_renewal_reminder", "success", `Sent ${sent} hosting/VPS renewal reminder(s)`);
  } catch (err: any) {
    await logCron("emails:hosting_renewal_reminder", "failed", err.message);
    console.error("[CRON] emails:hosting_renewal_reminder error:", err.message);
  }
}

// ─── Task 4: Domain renewal + expiry warning cron ────────────────────────────
// Sends expiry warnings at 30, 7, and 1 day before expiry.
// Duplicate guard: one email per (domain, emailType) per window.
export async function runDomainRenewalCron(): Promise<void> {
  const now = new Date();
  const thirtyOneDays = new Date(now); thirtyOneDays.setDate(thirtyOneDays.getDate() + 31);

  try {
    const expiringDomains = await db.select().from(domainsTable)
      .where(and(
        eq(domainsTable.status, "active"),
        lte(domainsTable.expiryDate, thirtyOneDays),
        gte(domainsTable.expiryDate, now),
      ));

    let renewed = 0;
    let reminded = 0;

    for (const domain of expiringDomains) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, domain.clientId)).limit(1);
      if (!user) continue;

      const expiryDate = new Date(domain.expiryDate!);
      const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const domainFqdn = `${domain.name}${domain.tld}`;
      const expiryStr = expiryDate.toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" });

      if (domain.autoRenew) {
        // Auto-renew: extend by 1 year when ≤ 1 day remaining
        if (daysRemaining <= 1) {
          const newExpiry = new Date(expiryDate);
          newExpiry.setFullYear(newExpiry.getFullYear() + 1);
          await db.update(domainsTable)
            .set({ expiryDate: newExpiry, nextDueDate: newExpiry, updatedAt: new Date() })
            .where(eq(domainsTable.id, domain.id));
          await logEmail(domain.clientId, user.email, "domain_renewed", `Domain ${domainFqdn} auto-renewed`, domain.id);
          notify(domain.clientId, "domain", "Domain Renewed", `${domainFqdn} has been auto-renewed for 1 year.`, `/client/domains`).catch(() => {});
          renewed++;
        }
        continue; // No reminder needed for auto-renew domains
      }

      // Determine which milestone applies: 30, 7, or 1 day
      let emailType: string | null = null;
      if (daysRemaining <= 1 && daysRemaining >= 0) emailType = "domain_expiring_1d";
      else if (daysRemaining <= 7) emailType = "domain_expiring_7d";
      else if (daysRemaining <= 30) emailType = "domain_expiring_30d";

      if (!emailType) continue;

      // Duplicate guard: only send this milestone once
      const alreadySent = await db.select().from(emailLogsTable)
        .where(and(
          eq(emailLogsTable.referenceId, domain.id),
          eq(emailLogsTable.emailType, emailType),
        )).limit(1);

      if (alreadySent.length > 0) continue;

      // Look up renewal price from domain_pricing table
      let renewalPriceStr = "Contact support";
      try {
        const tldClean = domain.tld.replace(/^\./, "");
        const [pricing] = await db.select().from(domainPricingTable)
          .where(sql`LOWER(tld) = LOWER(${tldClean})`)
          .limit(1);
        if (pricing?.renewalPrice) {
          // Use client's currency from their most recent invoice if available
          const [clientInv] = await db.select({
            currencyCode: invoicesTable.currencyCode,
            currencySymbol: invoicesTable.currencySymbol,
            currencyRate: invoicesTable.currencyRate,
          }).from(invoicesTable)
            .where(eq(invoicesTable.clientId, domain.clientId))
            .orderBy(desc(invoicesTable.createdAt))
            .limit(1);
          renewalPriceStr = convertAndFormat(
            Number(pricing.renewalPrice),
            clientInv?.currencyCode,
            clientInv?.currencySymbol,
            clientInv?.currencyRate,
          );
        }
      } catch { /* non-fatal */ }

      const clientName = user.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user.email;

      try {
        await emailDomainExpiryWarning(user.email, {
          clientName,
          domainName: domainFqdn,
          expiryDate: expiryStr,
          daysRemaining,
          renewalPrice: renewalPriceStr,
        }, { clientId: domain.clientId, referenceId: domain.id });
      } catch { /* non-fatal */ }

      await logEmail(domain.clientId, user.email, emailType, `Domain ${domainFqdn} expires in ${daysRemaining} day(s)`, domain.id);
      notify(domain.clientId, "domain", `Domain Expiring in ${daysRemaining} Day(s)`,
        `${domainFqdn} expires on ${expiryStr}. Renew now to keep it active.`, `/client/domains`).catch(() => {});
      reminded++;
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
      else if (daysUntilDue === -1) emailType = "invoice_overdue_1d";
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

// ─── Task 6: Daily backup of all active WordPress services ───────────────────
const BACKUP_DIR_CRON = process.env.WP_BACKUP_DIR || "/backups";
const WP_BASE_DIR_CRON = process.env.WP_BASE_DIR || "/var/www";
const MYSQL_ROOT_USER_CRON = process.env.WP_MYSQL_ROOT_USER || "root";
const MYSQL_ROOT_PASS_CRON = process.env.WP_MYSQL_ROOT_PASS || "";

export async function runDailyBackupCron(): Promise<void> {
  try {
    // Only run on VPS — skip silently in dev/sim mode
    const mysqlOk = await isMysqlReachable();
    if (!mysqlOk) {
      await logCron("backup:daily", "skipped", "MySQL not reachable — skipping backup (dev/sim mode)");
      return;
    }

    const services = await db.select().from(hostingServicesTable)
      .where(and(
        eq(hostingServicesTable.status, "active"),
        eq(hostingServicesTable.wpInstalled, true),
      ));

    let backed = 0;
    let failed = 0;

    for (const svc of services) {
      if (!svc.domain) continue;
      const ts = Date.now();
      const domainSafe = svc.domain.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${BACKUP_DIR_CRON}/${domainSafe}_files_${ts}.tar.gz`;
      const sqlPath  = `${BACKUP_DIR_CRON}/${domainSafe}_db_${ts}.sql`;

      const [backupRow] = await db.insert(hostingBackupsTable).values({
        serviceId: svc.id,
        clientId: svc.clientId,
        domain: svc.domain,
        status: "running",
        type: "cron",
      }).returning();

      try {
        await execAsync(`mkdir -p ${BACKUP_DIR_CRON}`);
        await execAsync(`tar -czf ${filePath} -C ${WP_BASE_DIR_CRON} ${svc.domain}`, { timeout: 300_000 });

        if (svc.wpDbName) {
          const passFlag = MYSQL_ROOT_PASS_CRON ? `-p'${MYSQL_ROOT_PASS_CRON}'` : "";
          await execAsync(`mysqldump -u ${MYSQL_ROOT_USER_CRON} ${passFlag} ${svc.wpDbName} > ${sqlPath}`, { timeout: 120_000 });
        }

        let sizeMb: string | null = null;
        try {
          const { stdout } = await execAsync(`du -sm ${filePath} | cut -f1`);
          sizeMb = stdout.trim() || null;
        } catch { /* non-fatal */ }

        await db.update(hostingBackupsTable).set({
          status: "completed",
          filePath,
          sqlPath: svc.wpDbName ? sqlPath : null,
          sizeMb,
          completedAt: new Date(),
        }).where(eq(hostingBackupsTable.id, backupRow.id));

        console.log(`[CRON/BACKUP] ${svc.domain} backed up → ${filePath}`);
        backed++;
      } catch (err: any) {
        await db.update(hostingBackupsTable).set({
          status: "failed",
          errorMessage: err.message,
          completedAt: new Date(),
        }).where(eq(hostingBackupsTable.id, backupRow.id));
        console.error(`[CRON/BACKUP] ${svc.domain} backup failed: ${err.message}`);
        failed++;
      }
    }

    await logCron("backup:daily", "success", `Backed up ${backed} service(s), ${failed} failed`);
  } catch (err: any) {
    await logCron("backup:daily", "failed", err.message);
    console.error("[CRON] backup:daily error:", err.message);
  }
}

// ─── Task 6b: Mark invoices as "overdue" when due date passes ─────────────────
// Runs every 5 min: finds unpaid invoices past due date and marks them overdue.
// Suspension (Task 2) runs separately after 3 days.
export async function runMarkOverdueCron(): Promise<void> {
  const now = new Date();
  try {
    const pastDue = await db.select().from(invoicesTable)
      .where(and(
        eq(invoicesTable.status, "unpaid"),
        lt(invoicesTable.dueDate, now),
      ));

    let marked = 0;
    for (const inv of pastDue) {
      await db.update(invoicesTable)
        .set({ status: "overdue", updatedAt: new Date() })
        .where(eq(invoicesTable.id, inv.id));
      marked++;
    }

    await logCron("billing:mark_overdue", "success", `Marked ${marked} invoice(s) as overdue`);
  } catch (err: any) {
    await logCron("billing:mark_overdue", "failed", err.message);
    console.error("[CRON] billing:mark_overdue error:", err.message);
  }
}

// ─── Task 7: Termination warning + pending-termination approval ───────────────
// 15 days overdue → send termination warning email to client
// 30 days overdue → set service status to "pending_termination" + WhatsApp admin
//                   alert. DOES NOT auto-delete — requires manual admin approval.
export async function runAutoTerminateCron(): Promise<void> {
  const now = new Date();
  const fifteenDaysAgo = new Date(now);
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const adminUrl = process.env.ADMIN_PANEL_URL ?? getAppUrl();

  try {
    const overdueInvoices = await db.select().from(invoicesTable)
      .where(and(
        eq(invoicesTable.status, "overdue"),
        lte(invoicesTable.dueDate, fifteenDaysAgo),
      ));

    let pendingTerminations = 0;
    let warned = 0;

    for (const invoice of overdueInvoices) {
      if (!invoice.serviceId) continue;
      const [service] = await db.select().from(hostingServicesTable)
        .where(eq(hostingServicesTable.id, invoice.serviceId)).limit(1);
      if (!service) continue;

      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, service.clientId)).limit(1);
      const clientName = user ? (user.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user.email) : "Client";

      // 30+ days overdue → flag as "pending_termination" + WhatsApp admin alert
      // SAFETY: NO automatic deletion — admin must manually approve
      if (invoice.dueDate && invoice.dueDate <= thirtyDaysAgo
          && service.status !== "terminated"
          && service.status !== "pending_termination") {

        await db.update(hostingServicesTable)
          .set({ status: "pending_termination" as any, updatedAt: new Date() })
          .where(eq(hostingServicesTable.id, service.id));

        // WhatsApp admin alert — requires manual approval in admin panel
        sendWhatsAppAlert("termination_pending",
          `⚠️ *Pending Termination Alert — Noehost*\n\n` +
          `🔴 Service: ${service.planName}\n` +
          `🌐 Domain: ${service.domain ?? "N/A"}\n` +
          `👤 Client: ${clientName}\n` +
          `📧 Email: ${user?.email ?? "N/A"}\n` +
          `📅 Overdue since: ${invoice.dueDate?.toLocaleDateString("en-PK")}\n\n` +
          `⛔ *Action Required:* Go to Admin Panel to manually approve or cancel termination.\n\n` +
          `🔗 ${adminUrl}/admin/automation\n\n` +
          `_${now.toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}_`
        ).catch(() => {});

        notify(user?.id ?? service.clientId, "system", "⚠️ Service Pending Termination",
          `${service.planName} is 30 days overdue and flagged for termination. Pay now to reactivate.`,
          `/client/invoices`).catch(() => {});

        await logEmail(service.clientId, user?.email ?? "", "termination_pending",
          `Service ${service.planName} flagged for pending termination`, service.id);
        pendingTerminations++;
      }
      // 15–29 days overdue → send warning email (once only)
      else if (invoice.dueDate && invoice.dueDate > thirtyDaysAgo && service.status !== "pending_termination") {
        const alreadyWarned = await db.select().from(emailLogsTable)
          .where(and(
            eq(emailLogsTable.referenceId, invoice.id),
            eq(emailLogsTable.emailType, "service_termination_warning"),
          )).limit(1);
        if (alreadyWarned.length > 0) continue;

        if (user) {
          const terminationDate = new Date(invoice.dueDate.getTime() + 30 * 24 * 60 * 60 * 1000)
            .toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" });
          const [plan] = await db.select().from(hostingPlansTable).where(eq(hostingPlansTable.id, service.planId)).limit(1);
          const amount = service.billingCycle === "yearly"
            ? (plan?.yearlyPrice ?? plan?.price ?? "0") : (plan?.price ?? "0");
          try {
            await emailTerminationWarning(user.email, {
              clientName,
              domain: service.domain ?? service.planName,
              serviceName: service.planName,
              terminationDate,
              invoiceId: invoice.id,
              amount: convertAndFormat(
                Number(amount),
                invoice.currencyCode,
                invoice.currencySymbol,
                invoice.currencyRate,
              ),
            }, { clientId: service.clientId, referenceId: invoice.id });
          } catch { /* non-fatal */ }
          await logEmail(service.clientId, user.email, "service_termination_warning",
            `Termination warning for ${service.planName} — pay now to avoid data loss`, invoice.id);
          notify(service.clientId, "system", "⚠️ Termination Warning",
            `${service.planName} will be flagged for termination on ${terminationDate} unless payment is received.`,
            `/client/invoices`).catch(() => {});
          warned++;
        }
      }
    }

    await logCron("billing:auto_terminate", "success",
      `Pending termination: ${pendingTerminations}, Warnings sent: ${warned}`);
  } catch (err: any) {
    await logCron("billing:auto_terminate", "failed", err.message);
    console.error("[CRON] billing:auto_terminate error:", err.message);
  }
}

// ─── Task 8: VPS power-off for unpaid invoices (7+ days) ─────────────────────
export async function runVpsPowerOffCron(): Promise<void> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  try {
    const overdueInvoices = await db.select().from(invoicesTable)
      .where(and(
        eq(invoicesTable.status, "overdue"),
        lte(invoicesTable.dueDate, sevenDaysAgo),
      ));

    let poweredOff = 0;

    for (const invoice of overdueInvoices) {
      if (!invoice.serviceId) continue;
      const [service] = await db.select().from(hostingServicesTable)
        .where(and(
          eq(hostingServicesTable.id, invoice.serviceId),
          eq(hostingServicesTable.status, "active"),
        )).limit(1);

      if (!service || service.serviceType !== "vps") continue;

      // Mark VPS as suspended / powered off
      await db.update(hostingServicesTable)
        .set({ status: "suspended", updatedAt: new Date() })
        .where(eq(hostingServicesTable.id, service.id));

      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, service.clientId)).limit(1);
      if (user) {
        await logEmail(service.clientId, user.email, "vps_powered_off", `VPS ${service.planName} powered off — invoice overdue`, service.id);
        notify(service.clientId, "system", "VPS Powered Off", `Your VPS ${service.planName} has been powered off due to an overdue invoice. Pay now to reactivate.`, "/clientarea/billing").catch(() => {});
      }
      poweredOff++;
    }

    await logCron("vps:power_off_overdue", "success", `Powered off ${poweredOff} overdue VPS service(s)`);
  } catch (err: any) {
    await logCron("vps:power_off_overdue", "failed", err.message);
    console.error("[CRON] vps:power_off_overdue error:", err.message);
  }
}

// ─── Google Drive nightly backup (3:00 AM PKT = 22:00 UTC) ──────────────────
export async function runGoogleDriveBackupCron(): Promise<void> {
  // Only run between 22:00–22:10 UTC (= 03:00–03:10 AM PKT, UTC+5)
  const now = new Date();
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  if (utcH !== 22 || utcM > 10) return;

  // Skip if a backup already ran successfully today
  const { driveBackupLogsTable: tbl } = await import("@workspace/db/schema");
  const { desc: descOrd } = await import("drizzle-orm");
  const [latest] = await db.select().from(tbl).orderBy(descOrd(tbl.startedAt)).limit(1);
  if (latest?.status === "success") {
    const latestDate = latest.startedAt.toISOString().slice(0, 10);
    const todayDate = now.toISOString().slice(0, 10);
    if (latestDate === todayDate) {
      console.log("[CRON] drive_backup: already completed today, skipping.");
      return;
    }
  }

  console.log("[CRON] drive_backup: starting nightly Google Drive backup…");
  try {
    const { getDriveConnectionStatus, isAutoBackupEnabled, runGoogleDriveBackup } = await import("./drive-backup.js");
    const [connStatus, autoEnabled] = await Promise.all([getDriveConnectionStatus(), isAutoBackupEnabled()]);
    if (!connStatus.connected) {
      console.log("[CRON] drive_backup: Google Drive not connected — skipping.");
      return;
    }
    if (!autoEnabled) {
      console.log("[CRON] drive_backup: Automatic backups disabled by admin — skipping.");
      return;
    }
    await runGoogleDriveBackup("cron");
    await logCron("drive_backup", "success", "Google Drive backup completed successfully");
  } catch (err: any) {
    await logCron("drive_backup", "failed", err.message);
    console.error("[CRON] drive_backup error:", err.message);
  }
}

// ─── Cart Abandonment Recovery ───────────────────────────────────────────────
export async function runCartAbandonmentCron(): Promise<void> {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const abandoned = await db.select({
      id: cartSessionsTable.id,
      userId: cartSessionsTable.userId,
      packageId: cartSessionsTable.packageId,
      packageName: cartSessionsTable.packageName,
      domainName: cartSessionsTable.domainName,
      billingCycle: cartSessionsTable.billingCycle,
      email: usersTable.email,
      firstName: usersTable.firstName,
    }).from(cartSessionsTable)
      .leftJoin(usersTable, eq(cartSessionsTable.userId, usersTable.id))
      .where(and(
        eq(cartSessionsTable.completed, false),
        eq(cartSessionsTable.reminderSent, false),
        lte(cartSessionsTable.abandonedAt, twoHoursAgo),
      ));

    if (abandoned.length === 0) {
      await logCron("cart_abandonment", "skipped", "No abandoned carts found");
      return;
    }

    let count = 0;
    for (const session of abandoned) {
      if (!session.email) continue;

      // Generate unique promo code
      const promoCode = `CART10${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Insert promo code
      await db.insert(promoCodesTable).values({
        code: promoCode,
        description: `Cart abandonment recovery — auto-generated for ${session.email}`,
        discountType: "percent",
        discountPercent: 10,
        isActive: true,
        usageLimit: 1,
        expiresAt,
        applicableTo: "all",
      }).onConflictDoNothing();

      const clientName = session.firstName || "Valued Customer";
      const domain = session.domainName;
      const pkg = session.packageName || "your hosting plan";

      // Look up cart item to build complete dynamic checkout URL
      let checkoutUrl = `${getAppUrl()}/client/cart`;
      if (session.packageId) {
        const cartItems = await db.select().from(cartItemsTable)
          .where(and(
            eq(cartItemsTable.userId, session.userId),
            eq(cartItemsTable.planId, session.packageId),
          )).limit(1);
        const item = cartItems[0];
        const params = new URLSearchParams({
          packageId: session.packageId,
          packageName: session.packageName || "",
          billingCycle: item?.billingCycle || session.billingCycle || "monthly",
          ...(item?.monthlyPrice ? { monthlyPrice: item.monthlyPrice } : {}),
          ...(item?.quarterlyPrice ? { quarterlyPrice: item.quarterlyPrice } : {}),
          ...(item?.semiannualPrice ? { semiannualPrice: item.semiannualPrice } : {}),
          ...(item?.yearlyPrice ? { yearlyPrice: item.yearlyPrice } : {}),
        });
        if (domain) params.set("domainName", domain);
        checkoutUrl = `${getAppUrl()}/client/checkout?${params.toString()}`;
      }

      // Premium HTML recovery email
      const year = new Date().getFullYear();
      const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f0eeff;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0eeff;padding:40px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 8px 40px rgba(112,26,254,0.18)">

  <!-- ─── HERO HEADER ─── -->
  <tr>
    <td style="background:linear-gradient(135deg,#701AFE 0%,#9B51E0 60%,#C084FC 100%);padding:40px 40px 36px;text-align:center">
      <p style="margin:0 0 8px;font-size:32px;font-weight:900;color:#ffffff;letter-spacing:-1px">Noehost</p>
      <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.82);font-weight:500">Your Trusted Hosting Partner</p>
    </td>
  </tr>

  <!-- ─── SHOPPING CART ICON BADGE ─── -->
  <tr>
    <td style="background:#ffffff;padding:0;text-align:center">
      <div style="margin:-22px auto 0;width:52px;height:52px;background:#fff;border-radius:50%;border:3px solid #701AFE;display:inline-flex;align-items:center;justify-content:center;font-size:24px;line-height:52px">
        🛒
      </div>
    </td>
  </tr>

  <!-- ─── BODY ─── -->
  <tr>
    <td style="background:#ffffff;padding:28px 44px 36px;color:#222222;font-size:15px;line-height:1.8">

      <h1 style="margin:0 0 6px;font-size:22px;font-weight:800;color:#1a1a2e;text-align:center">
        ${domain ? `Your domain <span style="color:#701AFE">${domain}</span> is still waiting!` : "Your cart is still waiting for you!"}
      </h1>
      <p style="margin:0 0 24px;font-size:14px;color:#888;text-align:center">We've saved your spot. Don't let it expire.</p>

      <p style="margin:0 0 16px">Hi <strong>${clientName}</strong>,</p>
      <p style="margin:0 0 20px">
        You were so close! You started setting up <strong>${pkg}</strong>${domain ? ` with domain <strong>${domain}</strong>` : ""} but didn't complete your order.
      </p>
      <p style="margin:0 0 28px">
        The great news? <strong>We've saved everything for you</strong> — and we're sweetening the deal with an exclusive 10% discount, just for you.
      </p>

      <!-- ─── ORDER SUMMARY BOX ─── -->
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#f8f4ff;border-radius:10px;margin:0 0 28px;overflow:hidden">
        <tr>
          <td style="background:linear-gradient(135deg,#701AFE,#9B51E0);padding:12px 20px">
            <p style="margin:0;font-size:12px;font-weight:700;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:1px">Your Order Summary</p>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 20px">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size:14px;color:#555;padding-bottom:8px">📦 Plan</td>
                <td style="font-size:14px;font-weight:700;color:#222;text-align:right;padding-bottom:8px">${pkg}</td>
              </tr>
              ${domain ? `<tr>
                <td style="font-size:14px;color:#555;padding-bottom:8px">🌐 Domain</td>
                <td style="font-size:14px;font-weight:700;color:#701AFE;text-align:right;padding-bottom:8px">${domain}</td>
              </tr>` : ""}
              <tr>
                <td style="font-size:14px;color:#555">🎁 Your Discount</td>
                <td style="font-size:14px;font-weight:700;color:#16a34a;text-align:right">10% OFF</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- ─── PROMO CODE BOX ─── -->
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 28px">
        <tr>
          <td style="background:#fffbeb;border:2px dashed #f59e0b;border-radius:10px;padding:20px;text-align:center">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:2px">🎫 Your Exclusive Promo Code</p>
            <p style="margin:8px 0;font-size:34px;font-weight:900;color:#701AFE;letter-spacing:6px;font-family:'Courier New',monospace">${promoCode}</p>
            <p style="margin:0;font-size:13px;color:#78350f">⏰ Expires in <strong>7 days</strong> — one-time use only</p>
          </td>
        </tr>
      </table>

      <!-- ─── CTA BUTTON ─── -->
      <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 28px;width:100%">
        <tr>
          <td style="text-align:center">
            <a href="${checkoutUrl}" style="display:inline-block;background:linear-gradient(135deg,#701AFE 0%,#9B51E0 60%,#C084FC 100%);color:#ffffff;text-decoration:none;padding:16px 48px;border-radius:50px;font-size:17px;font-weight:800;letter-spacing:0.3px;box-shadow:0 4px 20px rgba(112,26,254,0.4)">
              🚀 Complete My Order Now
            </a>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 8px;font-size:13px;color:#888;text-align:center">
        Or copy and paste this link in your browser:
      </p>
      <p style="margin:0 0 24px;font-size:12px;color:#701AFE;text-align:center;word-break:break-all">
        <a href="${checkoutUrl}" style="color:#701AFE">${checkoutUrl}</a>
      </p>

      <hr style="border:none;border-top:1px solid #f0f0f0;margin:24px 0">
      <p style="margin:0;font-size:13px;color:#999;text-align:center">
        Questions? We're always here. <a href="https://wa.me/923151711821" style="color:#701AFE;font-weight:600">Chat with us on WhatsApp</a>
      </p>
    </td>
  </tr>

  <!-- ─── WHATSAPP SUPPORT ─── -->
  <tr>
    <td style="background:#f0fdf4;border-top:2px solid #25D366;padding:20px 44px;text-align:center">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#166534">🚀 Need help? We reply within minutes!</p>
      <a href="https://wa.me/923151711821?text=Hi%20Noehost!%20I%20need%20help%20completing%20my%20order."
         style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:700">
        💬 WhatsApp Support
      </a>
    </td>
  </tr>

  <!-- ─── FOOTER ─── -->
  <tr>
    <td style="background:#1a1a2e;padding:24px 44px;text-align:center">
      <p style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,0.6)">© ${year} Noehost. All rights reserved.</p>
      <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35)">
        You received this email because you started an order on Noehost.
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>

</body></html>`;

      const result = await sendEmail({
        to: session.email,
        subject: `${clientName}, your ${domain ? `domain ${domain}` : pkg} is still waiting! 🎯 Save 10% now`,
        html: emailHtml,
        emailType: "cart-abandonment",
        clientId: session.userId,
        referenceId: session.id,
      });

      if (result.sent) {
        await db.update(cartSessionsTable)
          .set({ reminderSent: true, promoCode, reminderSentAt: new Date() })
          .where(eq(cartSessionsTable.id, session.id));
        count++;
      }
    }

    await logCron("cart_abandonment", "success", `Sent ${count} cart abandonment emails`);
  } catch (err: any) {
    await logCron("cart_abandonment", "failed", err.message);
    console.error("[CRON] cart_abandonment error:", err.message);
  }
}

// ─── Task N+1: Domain Lifecycle Automation (ICANN Standards) ─────────────────
// Grace Period:     Day 0-30  after expiry — domain still renewable at normal price
// Redemption Period: Day 31-60 after expiry — locked, restore fee applies
// Pending Delete:   Day 61-65 after expiry — cannot be renewed, awaiting release
export async function runDomainLifecycleCron(): Promise<void> {
  try {
    const now = new Date();

    // Find all expired domains (by expiry_date) that are not already in terminal states
    const expiredDomains = await db.select({
      id: domainsTable.id,
      clientId: domainsTable.clientId,
      name: domainsTable.name,
      tld: domainsTable.tld,
      status: domainsTable.status,
      expiryDate: domainsTable.expiryDate,
    }).from(domainsTable)
      .where(and(
        lte(domainsTable.expiryDate, now),
        notInArray(domainsTable.status as any, ["cancelled", "transferred", "pending_transfer", "pending_delete"] as any),
      ));

    if (expiredDomains.length === 0) {
      await logCron("domain_lifecycle", "skipped", "No expired domains to process");
      return;
    }

    let updated = 0;
    let emailsSent = 0;

    for (const domain of expiredDomains) {
      if (!domain.expiryDate) continue;
      const daysSinceExpiry = Math.floor((now.getTime() - new Date(domain.expiryDate).getTime()) / 86400000);

      // Determine target lifecycle status
      let targetStatus: "grace_period" | "redemption_period" | "pending_delete" | null = null;
      if (daysSinceExpiry >= 0 && daysSinceExpiry <= 30) {
        targetStatus = "grace_period";
      } else if (daysSinceExpiry > 30 && daysSinceExpiry <= 60) {
        targetStatus = "redemption_period";
      } else if (daysSinceExpiry > 60 && daysSinceExpiry <= 65) {
        targetStatus = "pending_delete";
      } else {
        // > 65 days: domain would be released — leave as-is (admin must manage)
        continue;
      }

      // Only update if status is actually changing
      if (domain.status === targetStatus) continue;

      const previousStatus = domain.status;

      // Update domain status in DB
      await db.update(domainsTable)
        .set({ status: targetStatus as any, updatedAt: new Date() })
        .where(eq(domainsTable.id, domain.id));

      updated++;

      // Fetch user for email/notification
      const [user] = await db.select().from(usersTable)
        .where(eq(usersTable.id, domain.clientId)).limit(1);

      if (!user) continue;

      const domainFull = `${domain.name}${domain.tld}`;
      const clientName = `${user.firstName} ${user.lastName}`.trim() || user.email;
      const expiryStr = domain.expiryDate
        ? new Date(domain.expiryDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
        : undefined;

      // Notify on Redemption Period entry (major lifecycle change requiring action)
      if (targetStatus === "redemption_period" && previousStatus !== "redemption_period") {
        // ─── Create restore fee invoice ───────────────────────────────────────
        // Look up TLD renewal price to estimate restore fee (3x standard renewal)
        try {
          const [tldPricing] = await db.select().from(domainPricingTable)
            .where(eq(domainPricingTable.tld, domain.tld)).limit(1);
          const renewalPrice = tldPricing ? parseFloat(tldPricing.renewalPrice) : 0;
          const restoreMultiplier = 3; // ICANN redemption restore fee = ~3x renewal
          const restoreFee = renewalPrice > 0 ? renewalPrice * restoreMultiplier : 50;

          const invoiceNumber = await generateInvoiceNumber();
          const dueDate = new Date(now);
          dueDate.setDate(dueDate.getDate() + 5); // 5 days to pay restore fee

          await db.insert(invoicesTable).values({
            invoiceNumber,
            clientId: domain.clientId,
            invoiceType: "domain",
            amount: String(restoreFee.toFixed(2)),
            total: String(restoreFee.toFixed(2)),
            dueDate,
            items: [
              {
                name: `Domain Restoration Fee — ${domainFull}`,
                description: `Redemption Period restore fee (ICANN-compliant). Domain ${domainFull} must be restored within 30 days or it will enter Pending Delete.`,
                quantity: 1,
                price: restoreFee,
                total: restoreFee,
              },
            ],
            status: "unpaid",
          });
        } catch (invErr: any) {
          console.warn(`[LIFECYCLE CRON] Failed to create restore fee invoice for ${domainFull}: ${invErr.message}`);
        }

        // ─── Send domain status alert email ────────────────────────────────────
        try {
          await emailDomainStatusAlert(user.email, {
            clientName,
            domainName: domainFull,
            lifecycleStatus: "redemption_period",
            reason: "expiry",
            expiryDate: expiryStr,
          }, { clientId: user.id, referenceId: domain.id });
          emailsSent++;
        } catch { /* non-fatal */ }

        // ─── In-app notification ────────────────────────────────────────────────
        await notify(user.id, "domain", "Domain Entered Redemption Period",
          `${domainFull} has entered the Redemption Period. A restore fee invoice has been created. Contact support immediately.`,
          "/client/domains");

      } else if (targetStatus === "pending_delete" && previousStatus !== "pending_delete") {
        // Alert for pending delete
        try {
          await emailDomainStatusAlert(user.email, {
            clientName,
            domainName: domainFull,
            lifecycleStatus: "pending_delete",
            reason: "expiry",
            expiryDate: expiryStr,
          }, { clientId: user.id, referenceId: domain.id });
          emailsSent++;
        } catch { /* non-fatal */ }

        await notify(user.id, "domain", "Domain Pending Deletion",
          `${domainFull} has entered Pending Delete stage. Contact support immediately — this is the final stage before permanent deletion.`,
          "/client/domains");

      } else if (targetStatus === "grace_period" && previousStatus !== "grace_period"
        && previousStatus !== "redemption_period" && previousStatus !== "pending_delete") {
        // First entry into grace period — in-app only (less urgent)
        await notify(user.id, "domain", "Domain in Grace Period",
          `${domainFull} has expired and entered the Grace Period. Renew now at the standard price to restore it.`,
          "/client/domains");
      }
    }

    await logCron("domain_lifecycle", "success",
      `Processed ${expiredDomains.length} expired domains — ${updated} status updates, ${emailsSent} alert emails sent`);

  } catch (err: any) {
    await logCron("domain_lifecycle", "failed", err.message);
    console.error("[CRON] domain_lifecycle error:", err.message);
  }
}

// ─── Master cron runner (runs all tasks) ─────────────────────────────────────
export async function runAllCronTasks(): Promise<void> {
  console.log("[CRON] Running all cron tasks...");
  await Promise.allSettled([
    runBillingCron(),
    runMarkOverdueCron(),
    runSuspendOverdueCron(),
    runAutoTerminateCron(),
    runUnsuspendRestoredCron(),
    runHostingRenewalReminderCron(),
    runDomainRenewalCron(),
    runInvoiceRemindersCron(),
    runVpsPowerOffCron(),
    runDailyBackupCron(),
    runGoogleDriveBackupCron(),
    runCartAbandonmentCron(),
    runDomainLifecycleCron(),
  ]);
  console.log("[CRON] All tasks completed.");
}
