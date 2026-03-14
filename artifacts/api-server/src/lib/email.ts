/**
 * Email Service — renders templates and sends via SMTP (nodemailer)
 * Falls back to console logging if SMTP is not configured.
 *
 * Variable syntax:
 *   {{variable_name}}  — recommended (matches Hostinger-style templates)
 *   {variable_name}    — also supported for legacy plain-text templates
 */
import nodemailer from "nodemailer";
import { db } from "@workspace/db";
import { emailTemplatesTable, settingsTable } from "@workspace/db/schema";
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

/** Load SMTP settings from the DB settings table into process.env */
async function loadSmtpFromDb(): Promise<void> {
  try {
    const rows = await db.select().from(settingsTable);
    const map: Record<string, string> = {};
    for (const r of rows) {
      if (r.key && r.value !== null && r.value !== undefined) map[r.key] = r.value;
    }
    if (map["smtp_host"]) process.env.SMTP_HOST = map["smtp_host"];
    if (map["smtp_port"]) process.env.SMTP_PORT = map["smtp_port"];
    if (map["smtp_user"]) process.env.SMTP_USER = map["smtp_user"];
    if (map["smtp_pass"]) process.env.SMTP_PASS = map["smtp_pass"];
    if (map["smtp_from"]) process.env.SMTP_FROM = map["smtp_from"];
  } catch {
    // DB not ready yet — fall through and use env vars directly
  }
}

function createTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER) {
    return null;
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT ? Number(SMTP_PORT) : 587,
    secure: SMTP_PORT === "465",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

/**
 * Low-level email send — raw subject + html body, no template lookup.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; message: string }> {
  try {
    await loadSmtpFromDb();

    const transport = createTransport();
    const from = process.env.SMTP_FROM || "noreply@nexgohost.com";

    if (!transport) {
      console.log(`\n[EMAIL LOG] ─────────────────────────────────────────`);
      console.log(`[EMAIL] To: ${opts.to}`);
      console.log(`[EMAIL] Subject: ${opts.subject}`);
      console.log(`[EMAIL] (SMTP not configured — email not sent, logged only)`);
      console.log(`[EMAIL] ─────────────────────────────────────────────\n`);
      return { sent: false, message: "SMTP not configured — email logged to console" };
    }

    const text = stripHtml(opts.html);
    await transport.sendMail({ from, to: opts.to, subject: opts.subject, html: opts.html, text });
    console.log(`[EMAIL] Sent "${opts.subject}" to ${opts.to}`);
    return { sent: true, message: "Email sent" };
  } catch (err: any) {
    console.error(`[EMAIL] Failed to send to ${opts.to}:`, err.message);
    return { sent: false, message: err.message };
  }
}

export async function sendTemplatedEmail(
  slug: string,
  to: string,
  variables: Record<string, string>,
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
    const text = isHtml ? stripHtml(body) : body;

    await loadSmtpFromDb();
    const transport = createTransport();
    const from = process.env.SMTP_FROM || "noreply@nexgohost.com";

    if (!transport) {
      console.log(`\n[EMAIL LOG] ─────────────────────────────────────────`);
      console.log(`[EMAIL] Template: ${slug}`);
      console.log(`[EMAIL] To: ${to}`);
      console.log(`[EMAIL] Subject: ${subject}`);
      console.log(`[EMAIL] Body (preview):\n${text.substring(0, 300)}${text.length > 300 ? "…" : ""}`);
      console.log(`[EMAIL] ─────────────────────────────────────────────\n`);
      return { sent: true, message: "Logged (SMTP not configured)" };
    }

    await transport.sendMail({ from, to, subject, html, text });
    console.log(`[EMAIL] Sent "${slug}" to ${to}`);
    return { sent: true, message: "Email sent" };
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
