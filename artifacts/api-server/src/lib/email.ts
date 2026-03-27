import { getAppUrl, getClientUrl } from "./app-url.js";

/**
 * Email Service — renders templates and sends via SMTP (nodemailer)
 * Falls back to console logging if SMTP is not configured.
 *
 * Variable syntax:
 *   {{variable_name}}  — recommended (matches Hostinger-style templates)
 *   {variable_name}    — also supported for legacy plain-text templates
 *
 * Features:
 *   - Encryption support: none / ssl / tls
 *   - From name support (smtp_from_name)
 *   - Email logging to email_logs table
 *   - Retry logic: 3 attempts, 2s delay between attempts
 *   - 10s connection timeout
 */
import nodemailer from "nodemailer";
import { db } from "@workspace/db";
import { emailTemplatesTable, settingsTable, emailLogsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

/**
 * Render template variables. Supports both {{variable}} and {variable} syntax.
 * Double-brace is checked first to avoid partial matches.
 */
function renderTemplate(template: string, vars: Record<string, string>): string {
  return template
    .replace(/\{\{([a-z_]+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
    .replace(/\{([a-z_]+)\}/g,     (_, key) => vars[key] ?? `{${key}}`);
}

/** Strip HTML tags for plain-text fallback */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  fromName: string;
  encryption: "none" | "ssl" | "tls";
  mailerType: "smtp" | "php_mail";
}

let _smtpConfig: SmtpConfig | null = null;
let _smtpLoadedAt = 0;
const CACHE_TTL_MS = 30_000; // re-read DB at most every 30s

/** Load SMTP settings from the DB settings table. Cached for 30s. */
async function getSmtpConfig(): Promise<SmtpConfig> {
  const now = Date.now();
  if (_smtpConfig && now - _smtpLoadedAt < CACHE_TTL_MS) return _smtpConfig;

  const map: Record<string, string> = {};
  try {
    const rows = await db.select().from(settingsTable);
    for (const r of rows) {
      if (r.key && r.value !== null && r.value !== undefined) map[r.key] = r.value;
    }
  } catch {
    // DB not ready yet — fall through and use env vars / defaults
  }

  _smtpConfig = {
    host:        map["smtp_host"]      || process.env.SMTP_HOST || "",
    port:        Number(map["smtp_port"] || process.env.SMTP_PORT || "587"),
    user:        map["smtp_user"]      || process.env.SMTP_USER || "",
    pass:        map["smtp_pass"]      || process.env.SMTP_PASS || "",
    from:        map["smtp_from"]      || process.env.SMTP_FROM || `noreply@${new URL(getAppUrl()).hostname}`,
    fromName:    map["smtp_from_name"] || process.env.SMTP_FROM_NAME || "Noehost",
    encryption:  (map["smtp_encryption"] || "tls") as SmtpConfig["encryption"],
    mailerType:  (map["mailer_type"]     || "smtp") as SmtpConfig["mailerType"],
  };
  _smtpLoadedAt = now;
  return _smtpConfig;
}

/** Force-clear the config cache so next send re-reads from DB. */
export function clearSmtpCache(): void {
  _smtpConfig = null;
  _smtpLoadedAt = 0;
}

/** Legacy shim: still used by callers that expected loadSmtpFromDb() */
export async function loadSmtpFromDb(): Promise<void> {
  await getSmtpConfig();
}

function buildTransportOptions(cfg: SmtpConfig): nodemailer.TransportOptions {
  const base = {
    host: cfg.host,
    port: cfg.port,
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 10_000,
    greetingTimeout:   10_000,
    socketTimeout:     10_000,
  } as any;

  if (cfg.encryption === "ssl") {
    base.secure = true;
  } else if (cfg.encryption === "tls") {
    base.secure = false;
    base.requireTLS = true;
  } else {
    base.secure = false;
  }

  return base;
}

function createTransport(cfg: SmtpConfig): nodemailer.Transporter | null {
  if (!cfg.host || !cfg.user) return null;
  return nodemailer.createTransport(buildTransportOptions(cfg));
}

function buildFromAddress(cfg: SmtpConfig): string {
  const name = cfg.fromName || "Noehost";
  const addr = cfg.from || (process.env.SMTP_FROM ?? `noreply@${new URL(getAppUrl()).hostname}`);
  return `${name} <${addr}>`;
}

async function writeLog(opts: {
  email: string;
  emailType: string;
  subject: string;
  status: "success" | "failed";
  errorMessage?: string;
  clientId?: string;
  referenceId?: string;
}): Promise<void> {
  try {
    await db.insert(emailLogsTable).values({
      email: opts.email,
      emailType: opts.emailType,
      subject: opts.subject,
      status: opts.status,
      errorMessage: opts.errorMessage ?? null,
      clientId: opts.clientId ?? null,
      referenceId: opts.referenceId ?? null,
    });
  } catch {
    // Log failures are non-fatal
  }
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

/** Attempt to send once. Returns true on success, throws on failure. */
async function trySend(
  transport: nodemailer.Transporter,
  mail: { from: string; to: string; subject: string; html: string; text: string; attachments?: EmailAttachment[] },
): Promise<void> {
  await transport.sendMail(mail);
}

/**
 * Low-level email send — raw subject + html body, no template lookup.
 * Retries up to 3 times with a 2s delay between attempts.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  emailType?: string;
  clientId?: string;
  referenceId?: string;
  attachments?: EmailAttachment[];
}): Promise<{ sent: boolean; message: string }> {
  const cfg = await getSmtpConfig();
  const transport = createTransport(cfg);
  const emailType = opts.emailType || "system";

  if (!transport) {
    console.log(`\n[EMAIL LOG] ─────────────────────────────────────────`);
    console.log(`[EMAIL] To: ${opts.to}`);
    console.log(`[EMAIL] Subject: ${opts.subject}`);
    console.log(`[EMAIL] (SMTP not configured — email not sent, logged only)`);
    console.log(`[EMAIL] ─────────────────────────────────────────────\n`);
    await writeLog({ email: opts.to, emailType, subject: opts.subject, status: "failed", errorMessage: "SMTP not configured" });
    return { sent: false, message: "SMTP not configured — email logged to console" };
  }

  const text = stripHtml(opts.html);
  const from = buildFromAddress(cfg);
  const mail: any = { from, to: opts.to, subject: opts.subject, html: opts.html, text };
  if (opts.attachments && opts.attachments.length > 0) {
    mail.attachments = opts.attachments.map(a => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    }));
  }

  const MAX_ATTEMPTS = 3;
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await trySend(transport, mail);
      console.log(`[EMAIL] Sent "${opts.subject}" to ${opts.to} (attempt ${attempt})`);
      await writeLog({ email: opts.to, emailType, subject: opts.subject, status: "success", clientId: opts.clientId, referenceId: opts.referenceId });
      return { sent: true, message: "Email sent" };
    } catch (err: any) {
      lastError = err.message || String(err);
      console.warn(`[EMAIL] Attempt ${attempt}/${MAX_ATTEMPTS} failed for "${opts.subject}" to ${opts.to}: ${lastError}`);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 2_000));
      }
    }
  }

  console.error(`[EMAIL] All attempts exhausted for "${opts.subject}" to ${opts.to}`);
  await writeLog({ email: opts.to, emailType, subject: opts.subject, status: "failed", errorMessage: lastError, clientId: opts.clientId, referenceId: opts.referenceId });
  return { sent: false, message: lastError };
}

export async function sendTemplatedEmail(
  slug: string,
  to: string,
  variables: Record<string, string>,
  meta?: { clientId?: string; referenceId?: string },
  attachments?: EmailAttachment[],
): Promise<{ sent: boolean; message: string }> {
  try {
    const [template] = await db
      .select()
      .from(emailTemplatesTable)
      .where(eq(emailTemplatesTable.slug, slug))
      .limit(1);

    if (!template) {
      console.warn(`[EMAIL] Template not found: ${slug}`);
      return { sent: false, message: `Template "${slug}" not found` };
    }

    if (!template.isActive) {
      console.info(`[EMAIL] Template disabled: ${slug}`);
      return { sent: false, message: `Template "${slug}" is disabled` };
    }

    const subject = renderTemplate(template.subject, variables);
    const body    = renderTemplate(template.body, variables);

    // Detect if body is HTML (starts with a tag) or plain text
    const isHtml = body.trimStart().startsWith("<");
    const html = isHtml ? body : body.replace(/\n/g, "<br>");

    return sendEmail({
      to,
      subject,
      html,
      emailType: slug,
      clientId: meta?.clientId,
      referenceId: meta?.referenceId,
      attachments,
    });
  } catch (err: any) {
    console.error(`[EMAIL] Failed to send "${slug}" to ${to}:`, err.message);
    return { sent: false, message: err.message };
  }
}

// ─── Convenience helpers ──────────────────────────────────────────────────────
const COMPANY = "Noehost";

/**
 * Send email verification code.
 * Uses the "email-verification" template from the DB so admins can customise it.
 */
export async function emailVerificationCode(
  to: string,
  clientName: string,
  code: string,
  meta?: { clientId?: string; referenceId?: string },
) {
  return sendTemplatedEmail("email-verification", to, {
    client_name: clientName,
    verification_code: code,
    company_name: COMPANY,
  }, meta);
}

export async function emailInvoiceCreated(to: string, vars: {
  clientName: string; invoiceId: string; amount: string; dueDate: string; clientAreaUrl?: string;
  invoicePdf?: Buffer; invoiceNumber?: string;
}, meta?: { clientId?: string; referenceId?: string }) {
  const attachments: EmailAttachment[] = [];
  if (vars.invoicePdf) {
    attachments.push({
      filename: `Noehost-Invoice-${vars.invoiceNumber ?? vars.invoiceId}.pdf`,
      content: vars.invoicePdf,
      contentType: "application/pdf",
    });
  }
  return sendTemplatedEmail("invoice-created", to, {
    company_name: COMPANY,
    client_area_url: vars.clientAreaUrl || getClientUrl(),
    client_name: vars.clientName,
    invoice_id: vars.invoiceId,
    invoice_number: vars.invoiceNumber ?? vars.invoiceId,
    amount: vars.amount,
    due_date: vars.dueDate,
    view_invoice_url: `${vars.clientAreaUrl || getClientUrl()}/invoices/${vars.invoiceId}`,
  }, meta, attachments.length > 0 ? attachments : undefined);
}

export async function emailInvoicePaid(to: string, vars: {
  clientName: string; invoiceId: string; amount: string; paymentDate: string;
  invoicePdf?: Buffer; invoiceNumber?: string;
}, invoice?: any) {
  const attachments: EmailAttachment[] = [];
  if (vars.invoicePdf) {
    attachments.push({
      filename: `Noehost-Invoice-${vars.invoiceNumber ?? vars.invoiceId}-PAID.pdf`,
      content: vars.invoicePdf,
      contentType: "application/pdf",
    });
  }
  return sendTemplatedEmail("invoice-paid", to, {
    company_name: COMPANY,
    client_name: vars.clientName,
    invoice_id: vars.invoiceId,
    invoice_number: vars.invoiceNumber ?? vars.invoiceId,
    amount: vars.amount,
    payment_date: vars.paymentDate,
    view_invoice_url: `${getClientUrl()}/invoices/${vars.invoiceId}`,
  }, undefined, attachments.length > 0 ? attachments : undefined);
}

export async function emailHostingCreated(
  to: string,
  vars: {
    clientName: string; domain: string; username: string; password?: string;
    cpanelUrl: string; ns1: string; ns2: string; webmailUrl?: string;
  },
  meta?: { clientId?: string; referenceId?: string },
) {
  return sendTemplatedEmail("hosting-created", to, {
    company_name: COMPANY,
    client_name: vars.clientName,
    domain: vars.domain,
    username: vars.username,
    password: vars.password || "(use your original password)",
    cpanel_url: vars.cpanelUrl,
    ns1: vars.ns1,
    ns2: vars.ns2,
    webmail_url: vars.webmailUrl || `https://${vars.domain}/webmail`,
  }, meta);
}

export async function emailOrderCreated(to: string, vars: {
  clientName: string; serviceName: string; domain: string; orderId: string;
}) {
  return sendTemplatedEmail("order-created", to, {
    company_name: COMPANY,
    client_name: vars.clientName,
    service_name: vars.serviceName,
    domain: vars.domain,
    order_id: vars.orderId,
  });
}

export async function emailServiceSuspended(to: string, vars: {
  clientName: string; domain: string; reason: string; clientAreaUrl?: string;
}) {
  return sendTemplatedEmail("service-suspended", to, {
    company_name: COMPANY,
    client_name: vars.clientName,
    domain: vars.domain,
    reason: vars.reason,
    client_area_url: vars.clientAreaUrl || getClientUrl(),
  });
}

export async function emailGeneric(to: string, subject: string, clientName: string, message: string) {
  return sendTemplatedEmail("welcome", to, {
    company_name: COMPANY, client_name: clientName, subject, message,
    custom_message: message,
  });
}

export async function emailCancellationConfirmed(to: string, vars: {
  clientName: string; domain: string; serviceName: string; cancelDate: string;
}) {
  return sendTemplatedEmail("service-cancelled", to, {
    company_name: COMPANY,
    client_name: vars.clientName,
    domain: vars.domain,
    service_name: vars.serviceName,
    cancel_date: vars.cancelDate,
  });
}

export async function emailWelcome(
  to: string,
  vars: { clientName: string; dashboardUrl?: string },
  meta?: { clientId?: string },
) {
  return sendTemplatedEmail("welcome", to, {
    company_name: COMPANY,
    client_name: vars.clientName,
    dashboard_url: vars.dashboardUrl || `${getClientUrl()}/dashboard`,
  }, meta);
}

export async function emailDomainRegistered(
  to: string,
  vars: { clientName: string; domain: string; registrationDate?: string; nextDueDate?: string; expiryDate: string; ns1?: string; ns2?: string; dnsUrl?: string },
  meta?: { clientId?: string; referenceId?: string },
) {
  return sendTemplatedEmail("domain-registered", to, {
    company_name: COMPANY,
    client_name: vars.clientName,
    domain: vars.domain,
    registration_date: vars.registrationDate || new Date().toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" }),
    next_due_date: vars.nextDueDate || vars.expiryDate,
    expiry_date: vars.expiryDate,
    ns1: vars.ns1 || `ns1.${new URL(getAppUrl()).hostname}`,
    ns2: vars.ns2 || `ns2.${new URL(getAppUrl()).hostname}`,
    dns_url: vars.dnsUrl || `${getClientUrl()}/domains`,
  }, meta);
}

export async function emailDomainExpiryWarning(
  to: string,
  vars: { clientName: string; domainName: string; expiryDate: string; daysRemaining: number; renewalPrice: string; renewUrl?: string },
  meta?: { clientId?: string; referenceId?: string },
) {
  return sendTemplatedEmail("domain-expiry-warning", to, {
    company_name: COMPANY,
    client_name: vars.clientName,
    domain_name: vars.domainName,
    expiry_date: vars.expiryDate,
    days_remaining: String(vars.daysRemaining),
    renewal_price: vars.renewalPrice,
    renew_url: vars.renewUrl || `${getClientUrl()}/domains`,
  }, meta);
}

export async function emailTerminationWarning(
  to: string,
  vars: { clientName: string; domain: string; serviceName: string; terminationDate: string; invoiceId: string; amount: string },
  meta?: { clientId?: string; referenceId?: string },
) {
  return sendTemplatedEmail("service-termination-warning", to, {
    company_name: COMPANY,
    client_name: vars.clientName,
    domain: vars.domain,
    service_name: vars.serviceName,
    termination_date: vars.terminationDate,
    invoice_id: vars.invoiceId,
    amount: vars.amount,
  }, meta);
}

export async function emailServiceTerminated(
  to: string,
  vars: { clientName: string; domain: string; serviceName: string; terminationDate: string },
  meta?: { clientId?: string; referenceId?: string },
) {
  return sendTemplatedEmail("service-terminated", to, {
    company_name: COMPANY,
    client_name: vars.clientName,
    domain: vars.domain,
    service_name: vars.serviceName,
    termination_date: vars.terminationDate,
  }, meta);
}

export async function emailRefundProcessed(
  to: string,
  vars: { clientName: string; refundAmount: string; invoiceId: string; refundDate: string; paymentMethod: string },
  meta?: { clientId?: string; referenceId?: string },
) {
  return sendTemplatedEmail("refund-processed", to, {
    company_name: COMPANY,
    client_name: vars.clientName,
    refund_amount: vars.refundAmount,
    invoice_id: vars.invoiceId,
    refund_date: vars.refundDate,
    payment_method: vars.paymentMethod,
  }, meta);
}

export async function emailPasswordReset(
  to: string,
  vars: { clientName: string; resetLink: string },
) {
  return sendTemplatedEmail("password-reset", to, {
    company_name: COMPANY,
    client_name: vars.clientName,
    reset_link: vars.resetLink,
  });
}

export async function emailResellerHostingCreated(
  to: string,
  vars: {
    clientName: string;
    username: string;
    password: string;
    whmUrl: string;
    cpanelUrl: string;
    maxAccounts: string;
    diskSpace: string;
    bandwidth: string;
    serverIp: string;
    ns1: string;
    ns2: string;
  },
  meta?: { clientId?: string; referenceId?: string },
) {
  return sendTemplatedEmail("reseller-hosting-created", to, {
    company_name: COMPANY,
    client_name: vars.clientName,
    username: vars.username,
    password: vars.password,
    whm_url: vars.whmUrl,
    cpanel_url: vars.cpanelUrl,
    max_accounts: vars.maxAccounts,
    disk_space: vars.diskSpace,
    bandwidth: vars.bandwidth,
    server_ip: vars.serverIp,
    ns1: vars.ns1,
    ns2: vars.ns2,
  }, meta);
}

export async function emailVpsCreated(
  to: string,
  vars: {
    clientName: string;
    serverIp: string;
    sshPort: string;
    rootPassword: string;
    serverHostname: string;
    os: string;
    cpuCores: string;
    ram: string;
    diskSpace: string;
    bandwidth: string;
    vpsPanelUrl?: string;
  },
  meta?: { clientId?: string; referenceId?: string },
) {
  return sendTemplatedEmail("vps-created", to, {
    company_name: COMPANY,
    client_name: vars.clientName,
    server_ip: vars.serverIp,
    ssh_port: vars.sshPort,
    root_password: vars.rootPassword,
    server_hostname: vars.serverHostname,
    os: vars.os,
    cpu_cores: vars.cpuCores,
    ram: vars.ram,
    disk_space: vars.diskSpace,
    bandwidth: vars.bandwidth,
    vps_panel_url: vars.vpsPanelUrl || `${getClientUrl()}/vps`,
  }, meta);
}

export async function emailHostingRenewalReminder(
  to: string,
  vars: {
    clientName: string;
    serviceName: string;
    domainOrIp: string;
    dueDate: string;
    invoiceId: string;
    invoiceNumber: string;
    amount: string;
    paymentUrl?: string;
  },
  meta?: { clientId?: string; referenceId?: string },
) {
  return sendTemplatedEmail("hosting-renewal-reminder", to, {
    company_name: COMPANY,
    client_name: vars.clientName,
    service_name: vars.serviceName,
    domain_or_ip: vars.domainOrIp,
    due_date: vars.dueDate,
    invoice_id: vars.invoiceId,
    invoice_number: vars.invoiceNumber,
    amount: vars.amount,
    payment_url: vars.paymentUrl || `${getClientUrl()}/invoices`,
  }, meta);
}

export async function emailDomainRenewalReminder(
  to: string,
  vars: {
    clientName: string;
    domainName: string;
    expiryDate: string;
    renewalPrice: string;
    renewUrl?: string;
  },
  meta?: { clientId?: string; referenceId?: string },
) {
  return sendTemplatedEmail("domain-renewal-reminder", to, {
    company_name: COMPANY,
    client_name: vars.clientName,
    domain_name: vars.domainName,
    expiry_date: vars.expiryDate,
    renewal_price: vars.renewalPrice,
    renew_url: vars.renewUrl || `${getClientUrl()}/domains`,
  }, meta);
}

export async function emailWordPressInstalled(
  to: string,
  vars: {
    clientName: string;
    domain: string;
    siteUrl: string;
    wpAdminUrl: string;
    wpUsername: string;
    wpPassword: string;
    wpVersion?: string;
  },
  meta?: { clientId?: string; referenceId?: string },
) {
  return sendTemplatedEmail("wordpress-installed", to, {
    company_name: COMPANY,
    client_name: vars.clientName,
    domain: vars.domain,
    site_url: vars.siteUrl,
    wp_admin_url: vars.wpAdminUrl,
    wp_username: vars.wpUsername,
    wp_password: vars.wpPassword,
    wp_version: vars.wpVersion || "6.7",
  }, meta);
}

/**
 * Send "Your Service is Now Active!" email to the client after Safepay auto-activation.
 * Tries the "service-activated" DB template first; falls back to rich inline HTML.
 * ONLY called for auto-payment gateways (Safepay/Stripe) — never for manual methods.
 */
export async function emailServiceActivated(
  to: string,
  vars: {
    clientName: string;
    invoiceNumber: string;
    domain: string;
    cpanelUrl?: string;
    dashboardUrl?: string;
  },
  meta?: { clientId?: string; referenceId?: string },
): Promise<{ sent: boolean; message: string }> {
  // 1. Try the customisable DB template
  const dbResult = await sendTemplatedEmail("service-activated", to, {
    company_name: COMPANY,
    client_name: vars.clientName,
    invoice_number: vars.invoiceNumber,
    domain: vars.domain,
    cpanel_url: vars.cpanelUrl || "",
    dashboard_url: vars.dashboardUrl || `${getClientUrl()}/dashboard`,
  }, meta);
  if (dbResult.sent) return dbResult;

  // 2. Inline HTML fallback (works even if the DB template hasn't been created yet)
  const dashUrl = vars.dashboardUrl || `${getClientUrl()}/dashboard`;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:40px;text-align:center">
      <div style="font-size:48px;margin-bottom:12px">🚀</div>
      <h1 style="color:#fff;margin:0;font-size:26px;font-weight:700">Your Service is Now Active!</h1>
      <p style="color:rgba(255,255,255,.85);margin:8px 0 0;font-size:15px">${COMPANY}</p>
    </div>
    <div style="padding:40px">
      <p style="margin:0 0 16px;color:#374151;font-size:15px">Dear <strong>${vars.clientName}</strong>,</p>
      <p style="margin:0 0 20px;color:#374151;font-size:15px">
        We have successfully received your payment via Safepay for Invoice
        <strong>#${vars.invoiceNumber}</strong>. Your hosting/domain service is now
        <span style="color:#16a34a;font-weight:700">Active</span>.
      </p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px 24px;margin:24px 0">
        <p style="margin:0 0 10px;color:#166534;font-weight:700;font-size:14px">✅ Service Details</p>
        <p style="margin:0 0 6px;color:#374151;font-size:14px"><strong>Domain / Service:</strong> ${vars.domain}</p>
        <p style="margin:0 0 6px;color:#374151;font-size:14px"><strong>Invoice #:</strong> ${vars.invoiceNumber}</p>
        <p style="margin:0;color:#374151;font-size:14px"><strong>Status:</strong> <span style="color:#16a34a;font-weight:700">Active ✓</span></p>
      </div>
      <p style="margin:0 0 24px;color:#374151;font-size:15px">
        You can login to your dashboard to manage your services, view DNS records,
        access cPanel, and more.
      </p>
      <div style="text-align:center;margin:32px 0">
        <a href="${dashUrl}" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:600;font-size:15px;display:inline-block">
          Manage My Services →
        </a>
      </div>
      <p style="margin:32px 0 0;color:#6b7280;font-size:14px;text-align:center">
        Thank you for choosing <strong>${COMPANY}</strong>! 🎉
      </p>
    </div>
    <div style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center">
      <p style="margin:0;color:#9ca3af;font-size:13px">
        © ${new Date().getFullYear()} ${COMPANY}. All rights reserved.
      </p>
    </div>
  </div>
</body></html>`;

  return sendEmail({
    to,
    subject: `🚀 Your Service is Now Active! - ${COMPANY}`,
    html,
    emailType: "service-activated",
    clientId: meta?.clientId,
    referenceId: meta?.referenceId,
  });
}

/**
 * Send an alert email to the admin when a Safepay auto-activation fires.
 * Gives the admin a full summary of the sale so they can track new business.
 */
export async function emailAdminSaleAlert(
  to: string,
  vars: {
    clientName: string;
    clientEmail: string;
    invoiceNumber: string;
    amount: string;
    domain: string;
    serviceType: string;
    paymentRef: string;
    adminPanelUrl?: string;
  },
): Promise<{ sent: boolean; message: string }> {
  const adminUrl = vars.adminPanelUrl || `${getAppUrl()}/admin/invoices`;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#059669,#047857);padding:32px 40px;text-align:center">
      <div style="font-size:40px;margin-bottom:8px">⚡</div>
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">New Auto-Activation via Safepay</h1>
      <p style="color:rgba(255,255,255,.85);margin:6px 0 0;font-size:13px">${COMPANY} — Admin Alert</p>
    </div>
    <div style="padding:36px 40px">
      <p style="margin:0 0 20px;color:#374151;font-size:14px">
        A new order has been <strong>automatically activated</strong> via Safepay.
        No manual action is required — the service is live.
      </p>
      <table style="width:100%;border-collapse:collapse">
        <tr style="border-bottom:1px solid #f3f4f6">
          <td style="padding:10px 0;color:#6b7280;font-size:13px;width:38%">Client</td>
          <td style="padding:10px 0;color:#111827;font-size:14px;font-weight:600">${vars.clientName}</td>
        </tr>
        <tr style="border-bottom:1px solid #f3f4f6">
          <td style="padding:10px 0;color:#6b7280;font-size:13px">Email</td>
          <td style="padding:10px 0;color:#111827;font-size:13px">${vars.clientEmail}</td>
        </tr>
        <tr style="border-bottom:1px solid #f3f4f6">
          <td style="padding:10px 0;color:#6b7280;font-size:13px">Invoice #</td>
          <td style="padding:10px 0;color:#111827;font-size:14px;font-weight:600">${vars.invoiceNumber}</td>
        </tr>
        <tr style="border-bottom:1px solid #f3f4f6">
          <td style="padding:10px 0;color:#6b7280;font-size:13px">Amount Received</td>
          <td style="padding:10px 0;color:#059669;font-size:16px;font-weight:700">${vars.amount}</td>
        </tr>
        <tr style="border-bottom:1px solid #f3f4f6">
          <td style="padding:10px 0;color:#6b7280;font-size:13px">Domain / Service</td>
          <td style="padding:10px 0;color:#111827;font-size:13px">${vars.domain}</td>
        </tr>
        <tr style="border-bottom:1px solid #f3f4f6">
          <td style="padding:10px 0;color:#6b7280;font-size:13px">Service Type</td>
          <td style="padding:10px 0;color:#111827;font-size:13px">${vars.serviceType}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#6b7280;font-size:13px">Safepay Ref</td>
          <td style="padding:10px 0;color:#111827;font-size:12px;font-family:monospace;word-break:break-all">${vars.paymentRef}</td>
        </tr>
      </table>
      <div style="text-align:center;margin:28px 0 0">
        <a href="${adminUrl}" style="background:linear-gradient(135deg,#059669,#047857);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;display:inline-block">
          View in Admin Panel →
        </a>
      </div>
    </div>
    <div style="background:#f9fafb;padding:16px 40px;border-top:1px solid #e5e7eb;text-align:center">
      <p style="margin:0;color:#9ca3af;font-size:12px">
        This is an automated alert from ${COMPANY} — no reply needed.
      </p>
    </div>
  </div>
</body></html>`;

  return sendEmail({
    to,
    subject: `⚡ New Sale: ${vars.clientName} — Invoice #${vars.invoiceNumber} (${vars.amount})`,
    html,
    emailType: "admin-sale-alert",
  });
}

export async function emailDomainTransferInitiated(
  to: string,
  vars: { clientName: string; domain: string; transferPrice: string; invoiceNumber: string },
  meta?: { clientId?: string; referenceId?: string },
) {
  return emailGeneric(
    to,
    `Domain Transfer Request Received — ${vars.domain}`,
    vars.clientName,
    `Your domain transfer request for <strong>${vars.domain}</strong> has been received and is under review.<br/><br/>` +
    `<strong>Domain:</strong> ${vars.domain}<br/>` +
    `<strong>Transfer Fee:</strong> Rs. ${vars.transferPrice}<br/>` +
    `<strong>Invoice #:</strong> ${vars.invoiceNumber}<br/>` +
    `<strong>Status:</strong> Pending Review<br/><br/>` +
    `<strong>What happens next?</strong><br/>` +
    `1. Our team will verify your EPP/Auth code with the current registrar.<br/>` +
    `2. Once approved, the transfer process begins (5–7 business days).<br/>` +
    `3. You will receive a confirmation email when the transfer is approved.<br/><br/>` +
    `Please ensure your domain remains <strong>unlocked</strong> at your current registrar and your <strong>WHOIS email is accessible</strong> to accept the transfer authorization request.<br/><br/>` +
    `You can track your transfer status in the <a href="${getClientUrl()}/domains">Client Portal</a>.`,
  );
}

export async function emailDomainTransferApproved(
  to: string,
  vars: { clientName: string; domain: string; adminNotes?: string },
  meta?: { clientId?: string; referenceId?: string },
) {
  return emailGeneric(
    to,
    `Domain Transfer Approved — ${vars.domain}`,
    vars.clientName,
    `Great news! Your domain transfer request for <strong>${vars.domain}</strong> has been <strong>approved</strong> and the transfer is now in progress.<br/><br/>` +
    `<strong>Domain:</strong> ${vars.domain}<br/>` +
    `<strong>Status:</strong> Transfer In Progress<br/>` +
    (vars.adminNotes ? `<strong>Notes:</strong> ${vars.adminNotes}<br/>` : ``) +
    `<br/><strong>Important:</strong><br/>` +
    `• Your current registrar will send a transfer authorization email — please <strong>approve it promptly</strong>.<br/>` +
    `• Keep your domain <strong>unlocked</strong> throughout the process.<br/>` +
    `• The transfer typically completes within <strong>5–7 business days</strong> once the authorization is confirmed.<br/><br/>` +
    `You will receive another email when the transfer is complete.<br/><br/>` +
    `Track your domain in the <a href="${getClientUrl()}/domains">Client Portal</a>.`,
  );
}

export async function emailDomainTransferCompleted(
  to: string,
  vars: { clientName: string; domain: string; expiryDate?: string },
  meta?: { clientId?: string; referenceId?: string },
) {
  return emailGeneric(
    to,
    `Domain Transfer Complete — ${vars.domain}`,
    vars.clientName,
    `Congratulations! Your domain <strong>${vars.domain}</strong> has been successfully transferred to Noehost.<br/><br/>` +
    `<strong>Domain:</strong> ${vars.domain}<br/>` +
    `<strong>Status:</strong> Active<br/>` +
    (vars.expiryDate ? `<strong>Expiry Date:</strong> ${vars.expiryDate}<br/>` : ``) +
    `<br/>You can now manage your domain — update nameservers, configure DNS, enable privacy protection — all from your <a href="${getClientUrl()}/domains">Client Portal</a>.<br/><br/>` +
    `Thank you for choosing Noehost!`,
  );
}

export async function emailDomainTransferRejected(
  to: string,
  vars: { clientName: string; domain: string; reason?: string },
  meta?: { clientId?: string; referenceId?: string },
) {
  return emailGeneric(
    to,
    `Domain Transfer Request Rejected — ${vars.domain}`,
    vars.clientName,
    `Unfortunately, your domain transfer request for <strong>${vars.domain}</strong> has been <strong>rejected</strong>.<br/><br/>` +
    `<strong>Domain:</strong> ${vars.domain}<br/>` +
    (vars.reason ? `<strong>Reason:</strong> ${vars.reason}<br/><br/>` : `<br/>`) +
    `<strong>Common reasons for rejection:</strong><br/>` +
    `• Domain is still locked at the current registrar<br/>` +
    `• Invalid or expired EPP/Auth code<br/>` +
    `• Domain is less than 60 days old<br/>` +
    `• WHOIS privacy blocking verification<br/><br/>` +
    `To retry, please resolve the issue and submit a new transfer request from your <a href="${getClientUrl()}/domains/transfer">Client Portal</a>.<br/><br/>` +
    `If you have questions, please contact our support team.`,
  );
}
