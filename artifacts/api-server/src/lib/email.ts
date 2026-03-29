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
    .replace(/\{\{([a-z0-9_]+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
    .replace(/\{([a-z0-9_]+)\}/g,     (_, key) => vars[key] ?? `{${key}}`);
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
    connectionTimeout: 15_000,
    greetingTimeout:   15_000,
    socketTimeout:     15_000,
    // Required for Replit: bypass self-signed / intermediate SSL cert issues
    tls: { rejectUnauthorized: false },
  } as any;

  if (cfg.encryption === "ssl") {
    base.secure = true;
  } else if (cfg.encryption === "tls") {
    base.secure = false;
    base.requireTLS = true;
  } else {
    base.secure = false;
  }

  console.log(`[EMAIL] Transport: ${cfg.host}:${cfg.port} | enc=${cfg.encryption} | user=${cfg.user}`);
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
  presetId?: string;
}): Promise<string | null> {
  try {
    const id = opts.presetId ?? crypto.randomUUID();
    await db.insert(emailLogsTable).values({
      id,
      email: opts.email,
      emailType: opts.emailType,
      subject: opts.subject,
      status: opts.status,
      errorMessage: opts.errorMessage ?? null,
      clientId: opts.clientId ?? null,
      referenceId: opts.referenceId ?? null,
    });
    return id;
  } catch {
    return null;
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
  logId?: string;
}): Promise<{ sent: boolean; message: string; logId?: string | null }> {
  const cfg = await getSmtpConfig();
  const transport = createTransport(cfg);
  const emailType = opts.emailType || "system";

  if (!transport) {
    console.log(`\n[EMAIL LOG] ─────────────────────────────────────────`);
    console.log(`[EMAIL] To: ${opts.to}`);
    console.log(`[EMAIL] Subject: ${opts.subject}`);
    console.log(`[EMAIL] (SMTP not configured — email not sent, logged only)`);
    console.log(`[EMAIL] ─────────────────────────────────────────────\n`);
    const logId = await writeLog({ email: opts.to, emailType, subject: opts.subject, status: "failed", errorMessage: "SMTP not configured", presetId: opts.logId });
    return { sent: false, message: "SMTP not configured — email logged to console", logId };
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
      const logId = await writeLog({ email: opts.to, emailType, subject: opts.subject, status: "success", clientId: opts.clientId, referenceId: opts.referenceId, presetId: opts.logId });
      return { sent: true, message: "Email sent", logId };
    } catch (err: any) {
      lastError = err.message || String(err);
      console.warn(`[EMAIL] Attempt ${attempt}/${MAX_ATTEMPTS} failed for "${opts.subject}" to ${opts.to}: ${lastError}`);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 2_000));
      }
    }
  }

  console.error(`[EMAIL] All attempts exhausted for "${opts.subject}" to ${opts.to}`);
  const failLogId = await writeLog({ email: opts.to, emailType, subject: opts.subject, status: "failed", errorMessage: lastError, clientId: opts.clientId, referenceId: opts.referenceId, presetId: opts.logId });
  return { sent: false, message: lastError, logId: failLogId };
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

/** WhatsApp support footer — appended to all inline client-facing HTML emails */
const WA_FOOTER = `
<div style="background:#f0fff4;border-top:2px solid #25D366;padding:20px 32px;text-align:center;margin-top:32px;border-radius:0 0 10px 10px">
  <p style="margin:0 0 10px;color:#166534;font-size:13px;font-weight:600;font-family:Arial,sans-serif">
    &#128640; Need help? We reply within minutes!
  </p>
  <a href="https://wa.me/923151711821?text=Hello%20Noehost%20Support%2C%20I%20have%20a%20query%20regarding%20my%20service."
     style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:6px;font-size:14px;font-weight:700;font-family:Arial,sans-serif">
    &#128222; Contact Support on WhatsApp
  </a>
</div>`;

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

// ─── 30-Day Domain Renewal Reminder ("Don't Lose Your Identity") ─────────────
export async function emailDomain30DayReminder(
  to: string,
  vars: { clientName: string; domainName: string; expiryDate: string; renewalPrice: string; renewUrl?: string },
  meta?: { clientId?: string; referenceId?: string },
) {
  const year = new Date().getFullYear();
  const renewUrl = vars.renewUrl || `${getClientUrl()}/domains`;
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0d0d1a;font-family:Inter,'Helvetica Neue',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d1a;padding:40px 16px"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;border:1px solid #2a2a3a">
  <tr><td style="background:linear-gradient(135deg,#701AFE 0%,#9B51E0 100%);padding:36px 40px;text-align:center">
    <p style="margin:0 0 4px;font-size:28px;font-weight:900;color:#fff;letter-spacing:-0.5px">Noehost</p>
    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:1.5px">Domain Registrar</p>
  </td></tr>
  <tr><td style="background:#111128;padding:32px 40px">
    <div style="text-align:center;background:#1a1a2e;border:1px solid #2a2a3a;border-radius:12px;padding:20px;margin-bottom:28px">
      <p style="margin:0 0 4px;font-size:13px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Domain expiring in</p>
      <p style="margin:0;font-size:56px;font-weight:900;color:#701AFE;line-height:1">30</p>
      <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#c084fc">Days</p>
    </div>
    <p style="margin:0 0 16px;font-size:15px;color:#d1d5db;line-height:1.7">Dear <strong style="color:#fff">${vars.clientName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#d1d5db;line-height:1.7">Your domain <strong style="color:#c084fc">${vars.domainName}</strong> is expiring on <strong style="color:#fff">${vars.expiryDate}</strong>. Your online identity, email, and website depend on it — don't let it lapse.</p>
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#1a1a2e;border:1px solid #2a2a3a;border-radius:12px;margin:0 0 28px;overflow:hidden">
      <tr><td style="padding:14px 20px;border-bottom:1px solid #2a2a3a"><span style="font-size:12px;color:#9ca3af">Domain</span></td><td style="padding:14px 20px;border-bottom:1px solid #2a2a3a;text-align:right"><strong style="color:#c084fc">${vars.domainName}</strong></td></tr>
      <tr><td style="padding:14px 20px;border-bottom:1px solid #2a2a3a"><span style="font-size:12px;color:#9ca3af">Expiry Date</span></td><td style="padding:14px 20px;border-bottom:1px solid #2a2a3a;text-align:right"><strong style="color:#f87171">${vars.expiryDate}</strong></td></tr>
      <tr><td style="padding:14px 20px"><span style="font-size:12px;color:#9ca3af">Renewal Price</span></td><td style="padding:14px 20px;text-align:right"><strong style="color:#22c55e">${vars.renewalPrice}</strong></td></tr>
    </table>
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 28px"><tr><td style="text-align:center">
      <a href="${renewUrl}" style="display:inline-block;background:linear-gradient(135deg,#701AFE,#9B51E0,#C084FC);color:#fff;text-decoration:none;padding:16px 44px;border-radius:50px;font-size:16px;font-weight:700">Renew My Domain Now →</a>
    </td></tr></table>
    <hr style="border:none;border-top:1px solid #2a2a3a;margin:0 0 20px">
    <p style="margin:0;font-size:12px;color:#6b7280;text-align:center">© ${year} Noehost. All rights reserved.</p>
  </td></tr>
</table></td></tr></table></body></html>`;
  return sendEmail({ to, subject: `Your domain ${vars.domainName} expires in 30 days`, html, emailType: "domain-30d-reminder", clientId: meta?.clientId, referenceId: meta?.referenceId });
}

// ─── 15-Day Domain Renewal Reminder (Discounted Renewal + Coupon) ─────────────
export async function emailDomain15DayDiscount(
  to: string,
  vars: { clientName: string; domainName: string; expiryDate: string; renewalPrice: string; discountedPrice: string; couponCode: string; renewUrl?: string },
  meta?: { clientId?: string; referenceId?: string },
) {
  const year = new Date().getFullYear();
  const renewUrl = vars.renewUrl || `${getClientUrl()}/domains`;
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0d0d1a;font-family:Inter,'Helvetica Neue',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d1a;padding:40px 16px"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;border:1px solid #2a2a3a">
  <tr><td style="background:#0f5132;padding:10px 40px;text-align:center">
    <p style="margin:0;font-size:12px;font-weight:700;color:#d1fae5;text-transform:uppercase;letter-spacing:2px">🏷 LIMITED TIME — 10% DISCOUNT INSIDE</p>
  </td></tr>
  <tr><td style="background:linear-gradient(135deg,#1a0533 0%,#0d0d1a 100%);padding:36px 40px 28px;border-bottom:1px solid #2a2a3a;text-align:center">
    <p style="margin:0 0 4px;font-size:28px;font-weight:900;color:#fff">Noehost</p>
    <p style="margin:8px 0 0;font-size:20px;font-weight:700;color:#22c55e">Renew ${vars.domainName} &amp; Save 10%!</p>
    <p style="margin:6px 0 0;font-size:13px;color:#9ca3af">Only 15 days left — use your exclusive coupon below</p>
  </td></tr>
  <tr><td style="background:#111128;padding:32px 40px">
    <p style="margin:0 0 20px;font-size:15px;color:#d1d5db;line-height:1.7">Dear <strong style="color:#fff">${vars.clientName}</strong>, as a valued Noehost customer, we're offering you an exclusive <strong style="color:#22c55e">10% discount</strong> to renew before your domain expires.</p>
    <div style="background:linear-gradient(135deg,#052e16,#0d0d1a);border:2px dashed #22c55e;border-radius:12px;padding:20px;text-align:center;margin:0 0 24px">
      <p style="margin:0 0 6px;font-size:11px;color:#86efac;text-transform:uppercase;letter-spacing:2px">Your Exclusive Coupon Code</p>
      <p style="margin:0 0 8px;font-size:28px;font-weight:900;color:#22c55e;letter-spacing:4px;font-family:monospace">${vars.couponCode}</p>
      <p style="margin:0;font-size:12px;color:#4ade80">Valid for 15 days · One-time use · Domain renewals only</p>
    </div>
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#1a1a2e;border:1px solid #2a2a3a;border-radius:12px;margin:0 0 24px;overflow:hidden">
      <tr><td style="padding:14px 20px;border-bottom:1px solid #2a2a3a"><span style="font-size:12px;color:#9ca3af">Domain</span></td><td style="padding:14px 20px;border-bottom:1px solid #2a2a3a;text-align:right"><strong style="color:#c084fc">${vars.domainName}</strong></td></tr>
      <tr><td style="padding:14px 20px;border-bottom:1px solid #2a2a3a"><span style="font-size:12px;color:#9ca3af">Original Price</span></td><td style="padding:14px 20px;border-bottom:1px solid #2a2a3a;text-align:right"><span style="color:#9ca3af;text-decoration:line-through">${vars.renewalPrice}</span></td></tr>
      <tr><td style="padding:14px 20px;border-bottom:1px solid #2a2a3a"><span style="font-size:12px;color:#9ca3af">10% Discount</span></td><td style="padding:14px 20px;border-bottom:1px solid #2a2a3a;text-align:right"><span style="color:#22c55e;font-weight:700">-10%</span></td></tr>
      <tr style="background:#052e16"><td style="padding:14px 20px"><strong style="color:#22c55e">Price With Coupon</strong></td><td style="padding:14px 20px;text-align:right"><strong style="color:#22c55e;font-size:18px">${vars.discountedPrice}</strong></td></tr>
    </table>
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 28px"><tr><td style="text-align:center">
      <a href="${renewUrl}" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#22c55e);color:#fff;text-decoration:none;padding:16px 44px;border-radius:50px;font-size:16px;font-weight:700">🏷 Claim Discount &amp; Renew</a>
    </td></tr></table>
    <hr style="border:none;border-top:1px solid #2a2a3a;margin:0 0 20px">
    <p style="margin:0;font-size:12px;color:#6b7280;text-align:center">© ${year} Noehost. Coupon code: <strong style="color:#22c55e">${vars.couponCode}</strong></p>
  </td></tr>
</table></td></tr></table></body></html>`;
  return sendEmail({ to, subject: `🏷 Renew ${vars.domainName} now and save 10%!`, html, emailType: "domain-15d-discount", clientId: meta?.clientId, referenceId: meta?.referenceId });
}

// ─── 1-Day Domain Renewal Reminder (Final Urgent Warning) ────────────────────
export async function emailDomain1DayUrgent(
  to: string,
  vars: { clientName: string; domainName: string; expiryDate: string; renewalPrice: string; renewUrl?: string },
  meta?: { clientId?: string; referenceId?: string },
) {
  const year = new Date().getFullYear();
  const renewUrl = vars.renewUrl || `${getClientUrl()}/domains`;
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0d0d1a;font-family:Inter,'Helvetica Neue',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d1a;padding:40px 16px"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;border:1px solid #7f1d1d">
  <tr><td style="background:#dc2626;padding:12px 40px;text-align:center">
    <p style="margin:0;font-size:13px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:2px">🚨 URGENT — ACTION REQUIRED IMMEDIATELY</p>
  </td></tr>
  <tr><td style="background:linear-gradient(135deg,#3b0202 0%,#0d0d1a 100%);padding:36px 40px;text-align:center;border-bottom:1px solid #7f1d1d">
    <p style="margin:0 0 4px;font-size:28px;font-weight:900;color:#fff">Noehost</p>
    <div style="background:#3b0202;border:2px solid #dc2626;border-radius:12px;display:inline-block;padding:14px 40px;margin:16px 0 12px">
      <p style="margin:0;font-size:64px;font-weight:900;color:#dc2626;line-height:1">1</p>
      <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:#fca5a5;text-transform:uppercase;letter-spacing:1px">Day Left</p>
    </div>
    <p style="margin:0;font-size:16px;color:#fca5a5;font-weight:600">Your domain expires <strong>TOMORROW</strong></p>
  </td></tr>
  <tr><td style="background:#111128;padding:32px 40px">
    <p style="margin:0 0 16px;font-size:15px;color:#d1d5db;line-height:1.7">Dear <strong style="color:#fff">${vars.clientName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#d1d5db;line-height:1.7">This is your <strong style="color:#f87171">final notice</strong>. Your domain <strong style="color:#fca5a5">${vars.domainName}</strong> expires on <strong style="color:#f87171">${vars.expiryDate}</strong>. If not renewed, your website, emails, and online presence will go offline immediately.</p>
    <div style="background:#3b0202;border:1px solid #7f1d1d;border-radius:10px;padding:16px 20px;margin:0 0 24px">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#f87171">What happens if you don't renew?</p>
      <p style="margin:0;font-size:13px;color:#fca5a5;line-height:1.6">❌ Website goes offline · ❌ Emails stop working · ❌ Domain enters Grace Period (higher fees) · ❌ After 60 days — permanent deletion</p>
    </div>
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#1a1a2e;border:1px solid #7f1d1d;border-radius:12px;margin:0 0 28px;overflow:hidden">
      <tr><td style="padding:14px 20px;border-bottom:1px solid #2a2a3a"><span style="font-size:12px;color:#9ca3af">Domain</span></td><td style="padding:14px 20px;border-bottom:1px solid #2a2a3a;text-align:right"><strong style="color:#fca5a5">${vars.domainName}</strong></td></tr>
      <tr><td style="padding:14px 20px;border-bottom:1px solid #2a2a3a"><span style="font-size:12px;color:#9ca3af">Expires</span></td><td style="padding:14px 20px;border-bottom:1px solid #2a2a3a;text-align:right"><strong style="color:#f87171">${vars.expiryDate}</strong></td></tr>
      <tr><td style="padding:14px 20px"><span style="font-size:12px;color:#9ca3af">Renewal Price</span></td><td style="padding:14px 20px;text-align:right"><strong style="color:#22c55e">${vars.renewalPrice}</strong></td></tr>
    </table>
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 28px"><tr><td style="text-align:center">
      <a href="${renewUrl}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:18px 48px;border-radius:50px;font-size:17px;font-weight:900;letter-spacing:0.3px">🚨 Renew NOW — Last Chance!</a>
    </td></tr></table>
    <hr style="border:none;border-top:1px solid #2a2a3a;margin:0 0 20px">
    <p style="margin:0;font-size:12px;color:#6b7280;text-align:center">© ${year} Noehost. Do not ignore this email.</p>
  </td></tr>
</table></td></tr></table></body></html>`;
  return sendEmail({ to, subject: `URGENT: Your domain ${vars.domainName} expires tomorrow`, html, emailType: "domain-1d-urgent", clientId: meta?.clientId, referenceId: meta?.referenceId });
}

export async function emailDomainStatusAlert(
  to: string,
  vars: {
    clientName: string;
    domainName: string;
    lifecycleStatus: string;
    reason: "expiry" | "policy_violation";
    expiryDate?: string;
    invoiceUrl?: string;
  },
  meta?: { clientId?: string; referenceId?: string },
) {
  const year = new Date().getFullYear();
  const appUrl = getAppUrl();
  const invoiceLink = vars.invoiceUrl || `${appUrl.replace("/api", "")}/client/invoices`;
  const icannFaqUrl = "https://www.icann.org/resources/pages/understanding-deletion-2012-02-25-en";

  const statusLabel = vars.lifecycleStatus === "redemption_period" ? "Redemption Period"
    : vars.lifecycleStatus === "pending_delete" ? "Pending Deletion"
    : vars.lifecycleStatus === "client_hold" ? "Client Hold"
    : vars.lifecycleStatus === "grace_period" ? "Grace Period"
    : vars.lifecycleStatus;

  const reasonLabel = vars.reason === "policy_violation" ? "Policy Violation" : "Non-Renewal / Expiry";
  const urgencyColor = vars.lifecycleStatus === "pending_delete" ? "#ef4444" : vars.lifecycleStatus === "redemption_period" ? "#f59e0b" : "#701AFE";

  const isRedemption = vars.lifecycleStatus === "redemption_period";
  const isPendingDelete = vars.lifecycleStatus === "pending_delete";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0d1a;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d1a;padding:40px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;border:1px solid #2a2a3a">

  <!-- ─── ALERT BANNER ─── -->
  <tr>
    <td style="background:${urgencyColor};padding:10px 40px;text-align:center">
      <p style="margin:0;font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:2px">
        ⚠ IMPORTANT DOMAIN NOTICE — ACTION REQUIRED
      </p>
    </td>
  </tr>

  <!-- ─── HEADER ─── -->
  <tr>
    <td style="background:linear-gradient(135deg,#1a0533 0%,#0d0d1a 100%);padding:36px 40px 28px;border-bottom:1px solid #2a2a3a">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <p style="margin:0 0 4px;font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-0.5px">Noehost</p>
            <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Domain Registrar</p>
          </td>
          <td style="text-align:right;vertical-align:middle">
            <span style="display:inline-block;padding:6px 14px;border-radius:50px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;background:${urgencyColor}20;border:1px solid ${urgencyColor}60;color:${urgencyColor}">
              ${statusLabel}
            </span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ─── BODY ─── -->
  <tr>
    <td style="background:#111128;padding:32px 40px;color:#d1d5db;font-size:15px;line-height:1.8">

      <p style="margin:0 0 20px">Dear <strong style="color:#ffffff">${vars.clientName}</strong>,</p>

      <p style="margin:0 0 20px">
        We are writing to inform you that your domain <strong style="color:#c084fc">${vars.domainName}</strong>
        has entered the <strong style="color:${urgencyColor}">${statusLabel}</strong> stage under ICANN domain lifecycle policy.
      </p>

      <!-- ─── DOMAIN STATUS CARD ─── -->
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 28px;border-radius:12px;overflow:hidden">
        <tr>
          <td style="background:#1a1a2e;border:1px solid #2a2a3a;border-radius:12px;padding:20px">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:6px 0;border-bottom:1px solid #2a2a3a">
                  <span style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px">Domain</span>
                </td>
                <td style="padding:6px 0;text-align:right;border-bottom:1px solid #2a2a3a">
                  <strong style="color:#c084fc;font-size:14px">${vars.domainName}</strong>
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;border-bottom:1px solid #2a2a3a">
                  <span style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px">Current Status</span>
                </td>
                <td style="padding:6px 0;text-align:right;border-bottom:1px solid #2a2a3a">
                  <span style="color:${urgencyColor};font-size:14px;font-weight:700">${statusLabel}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;border-bottom:1px solid #2a2a3a">
                  <span style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px">Reason</span>
                </td>
                <td style="padding:6px 0;text-align:right;border-bottom:1px solid #2a2a3a">
                  <span style="color:#d1d5db;font-size:14px">${reasonLabel}</span>
                </td>
              </tr>
              ${vars.expiryDate ? `<tr>
                <td style="padding:6px 0">
                  <span style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px">Expiry Date</span>
                </td>
                <td style="padding:6px 0;text-align:right">
                  <span style="color:#f87171;font-size:14px;font-weight:600">${vars.expiryDate}</span>
                </td>
              </tr>` : ""}
            </table>
          </td>
        </tr>
      </table>

      ${isRedemption ? `
      <!-- ─── REDEMPTION WARNING ─── -->
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 24px;border-radius:10px;overflow:hidden">
        <tr>
          <td style="background:#422006;border:1px solid #92400e;border-radius:10px;padding:16px 20px">
            <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#fbbf24">⚠ Redemption Period — Higher Restore Fee Applies</p>
            <p style="margin:0;font-size:13px;color:#fcd34d;line-height:1.6">
              Your domain is now in the ICANN Redemption Period. During this phase, a <strong>Domain Restoration Fee</strong> applies in addition to the standard renewal price. Please contact support or pay the updated invoice immediately to restore your domain.
            </p>
          </td>
        </tr>
      </table>` : ""}

      ${isPendingDelete ? `
      <!-- ─── PENDING DELETE WARNING ─── -->
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 24px;border-radius:10px;overflow:hidden">
        <tr>
          <td style="background:#3b0202;border:1px solid #7f1d1d;border-radius:10px;padding:16px 20px">
            <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#f87171">🚨 Critical: Domain Pending Deletion</p>
            <p style="margin:0;font-size:13px;color:#fca5a5;line-height:1.6">
              Your domain is in the final phase before permanent deletion and release. Once deleted, the domain becomes publicly available for registration by anyone. <strong>Contact us immediately</strong> if you wish to attempt recovery.
            </p>
          </td>
        </tr>
      </table>` : ""}

      <p style="margin:0 0 24px;font-size:14px;color:#9ca3af">
        For transparency, this lifecycle management follows the
        <a href="${icannFaqUrl}" style="color:#701AFE;text-decoration:underline">ICANN Domain Deletion Policy</a>.
        We recommend reviewing this policy to understand your options.
      </p>

      <!-- ─── CTA BUTTON ─── -->
      ${!isPendingDelete ? `
      <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;width:100%">
        <tr>
          <td style="text-align:center">
            <a href="${invoiceLink}"
               style="display:inline-block;background:linear-gradient(135deg,#701AFE 0%,#9B51E0 60%,#C084FC 100%);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:50px;font-size:16px;font-weight:700;letter-spacing:0.3px">
              🔒 Secure Your Domain Now
            </a>
          </td>
        </tr>
      </table>` : `
      <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;width:100%">
        <tr>
          <td style="text-align:center">
            <a href="mailto:support@noehost.com"
               style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:50px;font-size:16px;font-weight:700">
              🚨 Contact Support Immediately
            </a>
          </td>
        </tr>
      </table>`}

      <hr style="border:none;border-top:1px solid #2a2a3a;margin:24px 0">
      <p style="margin:0;font-size:12px;color:#6b7280;text-align:center">
        Questions? Contact our support team at <a href="https://wa.me/923151711821" style="color:#701AFE">WhatsApp Support</a> for immediate assistance.
      </p>
    </td>
  </tr>

  <!-- ─── ICANN DISCLAIMER ─── -->
  <tr>
    <td style="background:#0d0d1a;border-top:1px solid #2a2a3a;padding:20px 40px;text-align:center">
      <p style="margin:0 0 8px;font-size:12px;color:#4b5563">
        This notice is issued in accordance with
        <a href="${icannFaqUrl}" style="color:#701AFE">ICANN Domain Lifecycle Standards</a>.
      </p>
      <p style="margin:0;font-size:11px;color:#374151">
        © ${year} Noehost (Registered Reseller). All rights reserved.
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>

</body></html>`;

  return sendEmail({
    to,
    subject: `⚠ Important: Your domain ${vars.domainName} has entered ${statusLabel}`,
    html,
    emailType: "domain-status-alert",
    clientId: meta?.clientId,
    referenceId: meta?.referenceId,
  });
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
    ${WA_FOOTER}
    <div style="background:#f9fafb;padding:16px 40px;border-top:1px solid #e5e7eb;text-align:center">
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
 * Send "Payment Under Review" email for manual payment methods (JazzCash, EasyPaisa, bank transfer, etc.).
 * Tries the "payment-under-review" DB template first; falls back to rich inline HTML.
 * NEVER sends the service-active email — service is activated only after admin approves.
 */
export async function emailPaymentUnderReview(
  to: string,
  vars: {
    clientName: string;
    invoiceNumber: string;
    invoiceId: string;
    serviceName: string;
    domain: string;
    amount: string;
    paymentMethod: string;
  },
  meta?: { clientId?: string; referenceId?: string },
): Promise<{ sent: boolean; message: string }> {
  const viewUrl = `${getClientUrl()}/invoices/${vars.invoiceId}`;

  const dbResult = await sendTemplatedEmail("payment-under-review", to, {
    company_name: COMPANY,
    client_name: vars.clientName,
    invoice_number: vars.invoiceNumber,
    service_name: vars.serviceName,
    domain: vars.domain,
    amount: vars.amount,
    payment_method: vars.paymentMethod,
    view_invoice_url: viewUrl,
  }, meta);
  if (dbResult.sent) return dbResult;

  // Inline HTML fallback
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 40px;text-align:center">
      <div style="font-size:40px;margin-bottom:8px">🔍</div>
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700">Payment Under Review</h1>
      <p style="color:rgba(255,255,255,.85);margin:6px 0 0;font-size:14px">${COMPANY}</p>
    </div>
    <div style="padding:36px 40px">
      <p style="margin:0 0 16px;color:#374151;font-size:15px">Dear <strong>${vars.clientName}</strong>,</p>
      <p style="margin:0 0 20px;color:#374151;font-size:15px">
        Thank you for your order! We have received your payment details for Invoice
        <strong>#${vars.invoiceNumber}</strong> via <strong>${vars.paymentMethod}</strong>.
        Your order is currently <span style="color:#d97706;font-weight:700">Under Review</span>.
      </p>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #d97706;border-radius:8px;padding:16px 20px;margin:20px 0">
        <p style="margin:0 0 10px;color:#92400e;font-weight:700;font-size:14px">📋 Order Details</p>
        <p style="margin:0 0 6px;color:#374151;font-size:13px"><strong>Invoice #:</strong> ${vars.invoiceNumber}</p>
        <p style="margin:0 0 6px;color:#374151;font-size:13px"><strong>Service:</strong> ${vars.serviceName}</p>
        <p style="margin:0 0 6px;color:#374151;font-size:13px"><strong>Domain:</strong> ${vars.domain}</p>
        <p style="margin:0 0 6px;color:#374151;font-size:13px"><strong>Amount:</strong> Rs. ${vars.amount}</p>
        <p style="margin:0 0 6px;color:#374151;font-size:13px"><strong>Payment via:</strong> ${vars.paymentMethod}</p>
        <p style="margin:0;color:#d97706;font-size:13px;font-weight:700"><strong>Status:</strong> ⏳ Pending Review</p>
      </div>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:14px 18px;margin:20px 0;font-size:13px;color:#0369a1">
        <strong>⏰ What happens next?</strong><br>
        1. Our team will verify your payment within 2–24 hours.<br>
        2. Once verified, your service will be activated automatically.<br>
        3. You'll receive a separate email when your service goes live.
      </div>
      <div style="text-align:center;margin:28px 0">
        <a href="${viewUrl}" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;text-decoration:none;padding:13px 32px;border-radius:8px;font-weight:600;font-size:15px;display:inline-block">
          View Invoice →
        </a>
      </div>
    </div>
    ${WA_FOOTER}
    <div style="background:#f9fafb;padding:16px 40px;border-top:1px solid #e5e7eb;text-align:center">
      <p style="margin:0;color:#9ca3af;font-size:12px">© ${new Date().getFullYear()} ${COMPANY}. All rights reserved.</p>
    </div>
  </div>
</body></html>`;

  return sendEmail({
    to,
    subject: `🔍 Payment Under Review — Invoice #${vars.invoiceNumber} — ${COMPANY}`,
    html,
    emailType: "payment-under-review",
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

/**
 * Notify an affiliate when a commission has been credited to their account.
 */
export async function emailAffiliateCommission(
  to: string,
  vars: { clientName: string; commissionAmount: string; orderId: string; creditBalance: string },
  meta?: { clientId?: string; referenceId?: string },
) {
  return sendTemplatedEmail("affiliate-commission", to, {
    client_name: vars.clientName,
    commission_amount: vars.commissionAmount,
    order_id: vars.orderId,
    credit_balance: vars.creditBalance,
    client_area_url: getClientUrl(),
  }, meta);
}

// ── Spaceship Price Jump Alert (Admin) ────────────────────────────────────────
export async function emailSpaceshipPriceAlert(
  to: string,
  vars: {
    domainName: string;
    liveCostUsd: string;
    liveCostPkr: string;
    clientPaidPkr: string;
    thresholdUsd: string;
    usdToPkr: string;
  },
): Promise<{ sent: boolean; message: string }> {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:40px auto;background:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #dc2626">
    <div style="background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);padding:32px 40px;text-align:center">
      <div style="font-size:48px;margin-bottom:8px">🚨</div>
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;letter-spacing:-0.5px">PRICE JUMP DETECTED</h1>
      <p style="color:rgba(255,255,255,.85);margin:6px 0 0;font-size:13px">Spaceship Registration PAUSED — Action Required</p>
    </div>
    <div style="padding:36px 40px">
      <div style="background:#2a0a0a;border:1px solid #dc2626;border-radius:8px;padding:16px 20px;margin-bottom:24px">
        <p style="margin:0;color:#fca5a5;font-size:13px;font-weight:600">⚠ Registration has been automatically paused to protect your profit margin.</p>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <tr style="border-bottom:1px solid #2d2d2d">
          <td style="padding:12px 0;color:#9ca3af;font-size:13px;width:45%">Domain</td>
          <td style="padding:12px 0;color:#fff;font-size:14px;font-weight:700">${vars.domainName}</td>
        </tr>
        <tr style="border-bottom:1px solid #2d2d2d">
          <td style="padding:12px 0;color:#9ca3af;font-size:13px">Live API Cost</td>
          <td style="padding:12px 0;color:#f87171;font-size:16px;font-weight:700">$${vars.liveCostUsd} <span style="color:#6b7280;font-size:13px;font-weight:400">(Rs. ${Number(vars.liveCostPkr).toLocaleString()})</span></td>
        </tr>
        <tr style="border-bottom:1px solid #2d2d2d">
          <td style="padding:12px 0;color:#9ca3af;font-size:13px">Client Paid</td>
          <td style="padding:12px 0;color:#34d399;font-size:14px;font-weight:600">Rs. ${Number(vars.clientPaidPkr).toLocaleString()}</td>
        </tr>
        <tr style="border-bottom:1px solid #2d2d2d">
          <td style="padding:12px 0;color:#9ca3af;font-size:13px">Your Threshold</td>
          <td style="padding:12px 0;color:#fbbf24;font-size:14px;font-weight:600">$${vars.thresholdUsd}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;color:#9ca3af;font-size:13px">Exchange Rate Used</td>
          <td style="padding:12px 0;color:#e5e7eb;font-size:13px">Rs. ${vars.usdToPkr} / USD <span style="color:#6b7280">(incl. Rs.10 buffer)</span></td>
        </tr>
      </table>
      <div style="margin:28px 0 0;text-align:center">
        <p style="color:#6b7280;font-size:12px;margin:0 0 16px">Log in to manually process this domain or update your TLD pricing.</p>
        <a href="${getAppUrl()}/admin/orders" style="background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;display:inline-block">Review in Admin Panel →</a>
      </div>
    </div>
    <div style="background:#111;padding:16px 40px;text-align:center;border-top:1px solid #2d2d2d">
      <p style="margin:0;color:#4b5563;font-size:11px">${COMPANY} Loss-Prevention System • Registration ID has been queued for manual review</p>
    </div>
  </div>
</body></html>`;

  return sendEmail(to, `🚨 Price Jump: ${vars.domainName} costs $${vars.liveCostUsd} — Registration Paused`, html);
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
