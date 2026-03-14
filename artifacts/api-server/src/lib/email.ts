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
    from:        map["smtp_from"]      || process.env.SMTP_FROM || "noreply@nexgohost.com",
    fromName:    map["smtp_from_name"] || process.env.SMTP_FROM_NAME || "Nexgohost",
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
  const name = cfg.fromName || "Nexgohost";
  const addr = cfg.from || "noreply@nexgohost.com";
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

/** Attempt to send once. Returns true on success, throws on failure. */
async function trySend(
  transport: nodemailer.Transporter,
  mail: { from: string; to: string; subject: string; html: string; text: string },
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
  const mail  = { from, to: opts.to, subject: opts.subject, html: opts.html, text };

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
    });
  } catch (err: any) {
    console.error(`[EMAIL] Failed to send "${slug}" to ${to}:`, err.message);
    return { sent: false, message: err.message };
  }
}

// ─── Convenience helpers ──────────────────────────────────────────────────────
const COMPANY = "Nexgohost";

/**
 * Send email verification code.
 * Uses the "email-verification" template from the DB so admins can customise it.
 */
export async function emailVerificationCode(to: string, clientName: string, code: string) {
  return sendTemplatedEmail("email-verification", to, {
    client_name: clientName,
    verification_code: code,
    company_name: COMPANY,
  });
}

export async function emailInvoiceCreated(to: string, vars: {
  clientName: string; invoiceId: string; amount: string; dueDate: string; clientAreaUrl?: string;
}) {
  return sendTemplatedEmail("invoice-created", to, {
    company_name: COMPANY,
    client_area_url: vars.clientAreaUrl || "https://nexgohost.com/client",
    client_name: vars.clientName,
    invoice_id: vars.invoiceId,
    amount: vars.amount,
    due_date: vars.dueDate,
  });
}

export async function emailInvoicePaid(to: string, vars: {
  clientName: string; invoiceId: string; amount: string; paymentDate: string;
}) {
  return sendTemplatedEmail("invoice-paid", to, {
    company_name: COMPANY,
    client_name: vars.clientName,
    invoice_id: vars.invoiceId,
    amount: vars.amount,
    payment_date: vars.paymentDate,
  });
}

export async function emailHostingCreated(to: string, vars: {
  clientName: string; domain: string; username: string; password: string;
  cpanelUrl: string; ns1: string; ns2: string; webmailUrl?: string;
}) {
  return sendTemplatedEmail("hosting-created", to, {
    company_name: COMPANY,
    client_name: vars.clientName,
    domain: vars.domain,
    username: vars.username,
    password: vars.password,
    cpanel_url: vars.cpanelUrl,
    ns1: vars.ns1,
    ns2: vars.ns2,
    webmail_url: vars.webmailUrl || `https://${vars.domain}/webmail`,
  });
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
    client_area_url: vars.clientAreaUrl || "https://nexgohost.com/client",
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
