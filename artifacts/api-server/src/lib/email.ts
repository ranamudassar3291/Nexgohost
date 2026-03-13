/**
 * Email Service — renders templates and sends via SMTP (nodemailer)
 * Falls back to console logging if SMTP is not configured.
 */
import nodemailer from "nodemailer";
import { db } from "@workspace/db";
import { emailTemplatesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([a-z_]+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

function createTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
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
    const body = renderTemplate(template.body, variables);

    const transport = createTransport();
    const from = process.env.SMTP_FROM || "noreply@nexgohost.com";

    if (!transport) {
      // Log to console when SMTP is not configured (dev mode)
      console.log(`\n[EMAIL LOG] ─────────────────────────────────────────`);
      console.log(`[EMAIL] Template: ${slug}`);
      console.log(`[EMAIL] To: ${to}`);
      console.log(`[EMAIL] Subject: ${subject}`);
      console.log(`[EMAIL] Body:\n${body}`);
      console.log(`[EMAIL] ─────────────────────────────────────────────\n`);
      return { sent: true, message: "Logged (SMTP not configured)" };
    }

    await transport.sendMail({ from, to, subject, text: body, html: body.replace(/\n/g, "<br>") });
    console.log(`[EMAIL] Sent "${slug}" to ${to}`);
    return { sent: true, message: "Email sent" };
  } catch (err: any) {
    console.error(`[EMAIL] Failed to send "${slug}" to ${to}:`, err.message);
    return { sent: false, message: err.message };
  }
}

// Convenience helpers for each system event
const COMPANY = "Nexgohost";

export async function emailInvoiceCreated(to: string, vars: {
  clientName: string; invoiceId: string; amount: string; dueDate: string; clientAreaUrl?: string;
}) {
  return sendTemplatedEmail("invoice-created", to, {
    company_name: COMPANY,
    client_area_url: vars.clientAreaUrl || "https://nexgohost.com/client",
    ...vars,
  });
}

export async function emailInvoicePaid(to: string, vars: {
  clientName: string; invoiceId: string; amount: string; paymentDate: string;
}) {
  return sendTemplatedEmail("invoice-paid", to, {
    company_name: COMPANY, payment_date: vars.paymentDate, ...vars,
  });
}

export async function emailHostingCreated(to: string, vars: {
  clientName: string; domain: string; username: string; password: string;
  cpanelUrl: string; ns1: string; ns2: string; webmailUrl?: string;
}) {
  return sendTemplatedEmail("hosting-created", to, {
    company_name: COMPANY,
    webmail_url: vars.webmailUrl || `https://${vars.domain}/webmail`,
    ...vars,
  });
}

export async function emailOrderCreated(to: string, vars: {
  clientName: string; serviceName: string; domain: string; orderId: string;
}) {
  return sendTemplatedEmail("order-created", to, { company_name: COMPANY, ...vars });
}

export async function emailServiceSuspended(to: string, vars: {
  clientName: string; domain: string; reason: string; clientAreaUrl?: string;
}) {
  return sendTemplatedEmail("service-suspended", to, {
    company_name: COMPANY,
    client_area_url: vars.clientAreaUrl || "https://nexgohost.com/client",
    ...vars,
  });
}

export async function emailVerificationCode(to: string, clientName: string, code: string) {
  return sendEmail({
    to,
    subject: `${COMPANY} — Your Verification Code`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#0f0a1f;color:#fff;border-radius:12px">
      <h2 style="color:#a855f7;margin-bottom:8px">${COMPANY}</h2>
      <p style="color:#ccc">Hi ${clientName},</p>
      <p style="color:#ccc">Your email verification code is:</p>
      <div style="font-size:36px;font-weight:bold;letter-spacing:12px;color:#fff;background:#1e1033;border:1px solid #6d28d9;border-radius:8px;padding:16px 24px;margin:16px 0;text-align:center">${code}</div>
      <p style="color:#999;font-size:13px">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
    </div>`,
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
    company_name: COMPANY, service_name: vars.serviceName, cancel_date: vars.cancelDate, ...vars,
  });
}
