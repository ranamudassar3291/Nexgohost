import { Router } from "express";
import { db } from "@workspace/db";
import { emailTemplatesTable } from "@workspace/db/schema";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { eq, inArray } from "drizzle-orm";
import { sendEmail } from "../lib/email.js";

const router = Router();

const DEFAULT_TEMPLATES = [
  {
    name: "Email Verification",
    slug: "email-verification",
    subject: "Verify Your Email Address",
    body: `<div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:30px">
<div style="max-width:600px;margin:auto;background:white;padding:30px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.06)">

<div style="text-align:center;margin-bottom:24px">
  <h1 style="color:#6c5ce7;font-size:28px;margin:0;letter-spacing:-0.5px">Nexgohost</h1>
</div>

<h2 style="color:#333;font-size:20px;margin-bottom:8px">Verify your email address</h2>

<p style="color:#555;line-height:1.6">Hello {{client_name}},</p>

<p style="color:#555;line-height:1.6">Thank you for creating an account. To complete your registration, please enter the verification code below.</p>

<div style="text-align:center;margin:28px 0">
  <div style="display:inline-block;background:#f5f0ff;border:2px solid #6c5ce7;border-radius:12px;padding:20px 40px">
    <p style="margin:0 0 4px 0;font-size:12px;color:#6c5ce7;text-transform:uppercase;letter-spacing:2px;font-weight:600">Your Code</p>
    <p style="margin:0;font-size:36px;font-weight:bold;letter-spacing:10px;color:#2d2d2d;font-family:monospace">{{verification_code}}</p>
  </div>
</div>

<p style="color:#555;line-height:1.6">This code will expire in <strong>10 minutes</strong>.</p>

<p style="color:#555;line-height:1.6">If you did not create this account, you can safely ignore this email.</p>

<hr style="border:none;border-top:1px solid #eee;margin:24px 0">

<p style="font-size:12px;color:#999;margin:0">This email was sent automatically by the Nexgohost billing system. Please do not reply to this email.</p>

</div>
</div>`,
    variables: ["{{client_name}}", "{{verification_code}}"],
  },
  {
    name: "Invoice Created",
    slug: "invoice-created",
    subject: "Invoice #{invoice_id} — {company_name}",
    body: `<div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:30px">
<div style="max-width:600px;margin:auto;background:white;padding:32px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
<div style="text-align:center;margin-bottom:24px">
  <h1 style="color:#6c5ce7;font-size:26px;margin:0;letter-spacing:-0.5px">{company_name}</h1>
</div>
<h2 style="color:#1a1a2e;font-size:20px;margin-bottom:4px">New Invoice Generated</h2>
<p style="color:#555;line-height:1.7">Hello {client_name},</p>
<p style="color:#555;line-height:1.7">A new invoice has been created for your account. Please review and pay it before the due date to avoid service interruption.</p>
<div style="background:#f9f8ff;border:1px solid #e0d9ff;border-radius:10px;padding:20px;margin:24px 0">
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="color:#888;font-size:13px;padding:6px 0">Invoice Number</td><td style="font-weight:600;color:#1a1a2e;text-align:right">#{invoice_id}</td></tr>
    <tr><td style="color:#888;font-size:13px;padding:6px 0;border-top:1px solid #eee">Amount Due</td><td style="font-weight:700;color:#6c5ce7;font-size:18px;text-align:right;border-top:1px solid #eee">{amount}</td></tr>
    <tr><td style="color:#888;font-size:13px;padding:6px 0;border-top:1px solid #eee">Due Date</td><td style="font-weight:600;color:#e17055;text-align:right;border-top:1px solid #eee">{due_date}</td></tr>
  </table>
</div>
<div style="text-align:center;margin:28px 0">
  <a href="{client_area_url}" style="background:#6c5ce7;color:white;padding:13px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">View &amp; Pay Invoice</a>
</div>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="font-size:12px;color:#aaa;margin:0;text-align:center">This email was sent automatically by {company_name}. Please do not reply.</p>
</div></div>`,
    variables: ["{client_name}", "{invoice_id}", "{amount}", "{due_date}", "{client_area_url}", "{company_name}"],
  },
  {
    name: "Invoice Payment Confirmation",
    slug: "invoice-paid",
    subject: "Payment Received — Invoice #{invoice_id}",
    body: `<div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:30px">
<div style="max-width:600px;margin:auto;background:white;padding:32px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
<div style="text-align:center;margin-bottom:24px">
  <h1 style="color:#6c5ce7;font-size:26px;margin:0">{company_name}</h1>
</div>
<div style="text-align:center;margin-bottom:20px">
  <div style="width:56px;height:56px;background:#d4fce8;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px">
    <span style="color:#00b894;font-size:28px">✓</span>
  </div>
  <h2 style="color:#1a1a2e;font-size:22px;margin:0">Payment Received</h2>
</div>
<p style="color:#555;line-height:1.7">Hello {client_name},</p>
<p style="color:#555;line-height:1.7">We have successfully received your payment. Thank you!</p>
<div style="background:#f0fff8;border:1px solid #b2f0d5;border-radius:10px;padding:20px;margin:24px 0">
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="color:#888;font-size:13px;padding:6px 0">Invoice Number</td><td style="font-weight:600;color:#1a1a2e;text-align:right">#{invoice_id}</td></tr>
    <tr><td style="color:#888;font-size:13px;padding:6px 0;border-top:1px solid #cef5e2">Amount Paid</td><td style="font-weight:700;color:#00b894;font-size:18px;text-align:right;border-top:1px solid #cef5e2">{amount}</td></tr>
    <tr><td style="color:#888;font-size:13px;padding:6px 0;border-top:1px solid #cef5e2">Payment Date</td><td style="font-weight:600;color:#1a1a2e;text-align:right;border-top:1px solid #cef5e2">{payment_date}</td></tr>
  </table>
</div>
<p style="color:#555;line-height:1.7">Your services are now active. If you have any questions, please open a support ticket in your client area.</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="font-size:12px;color:#aaa;margin:0;text-align:center">— {company_name} Team</p>
</div></div>`,
    variables: ["{client_name}", "{invoice_id}", "{amount}", "{payment_date}", "{company_name}"],
  },
  {
    name: "New Order Confirmation",
    slug: "order-created",
    subject: "Order Confirmed — {service_name}",
    body: `<div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:30px">
<div style="max-width:600px;margin:auto;background:white;padding:32px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
<div style="text-align:center;margin-bottom:24px">
  <h1 style="color:#6c5ce7;font-size:26px;margin:0">{company_name}</h1>
</div>
<h2 style="color:#1a1a2e;font-size:20px;margin-bottom:4px">Order Confirmed!</h2>
<p style="color:#555;line-height:1.7">Hello {client_name},</p>
<p style="color:#555;line-height:1.7">Thank you for your order! We are setting up your hosting account and will notify you when it is ready.</p>
<div style="background:#f9f8ff;border:1px solid #e0d9ff;border-radius:10px;padding:20px;margin:24px 0">
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="color:#888;font-size:13px;padding:6px 0">Order Number</td><td style="font-weight:600;color:#1a1a2e;text-align:right">#{order_id}</td></tr>
    <tr><td style="color:#888;font-size:13px;padding:6px 0;border-top:1px solid #eee">Service</td><td style="font-weight:600;color:#1a1a2e;text-align:right;border-top:1px solid #eee">{service_name}</td></tr>
    <tr><td style="color:#888;font-size:13px;padding:6px 0;border-top:1px solid #eee">Domain</td><td style="font-weight:600;color:#6c5ce7;text-align:right;border-top:1px solid #eee">{domain}</td></tr>
  </table>
</div>
<p style="color:#555;line-height:1.7">You will receive your hosting account details (cPanel credentials, nameservers) in a separate email once your account is activated.</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="font-size:12px;color:#aaa;margin:0;text-align:center">— {company_name} Team</p>
</div></div>`,
    variables: ["{client_name}", "{service_name}", "{domain}", "{order_id}", "{company_name}"],
  },
  {
    name: "Hosting Account Created",
    slug: "hosting-created",
    subject: "Your Hosting Account is Ready — {domain}",
    body: `<div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:30px">
<div style="max-width:600px;margin:auto;background:white;padding:32px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
<div style="text-align:center;margin-bottom:24px">
  <h1 style="color:#6c5ce7;font-size:26px;margin:0">{company_name}</h1>
</div>
<div style="text-align:center;margin-bottom:20px">
  <div style="width:56px;height:56px;background:#e8f4fd;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px">
    <span style="font-size:28px">🚀</span>
  </div>
  <h2 style="color:#1a1a2e;font-size:22px;margin:0">Your Hosting is Ready!</h2>
</div>
<p style="color:#555;line-height:1.7">Hello {client_name},</p>
<p style="color:#555;line-height:1.7">Your hosting account for <strong>{domain}</strong> has been successfully created. Here are your account details:</p>
<div style="background:#f9f8ff;border:1px solid #e0d9ff;border-radius:10px;padding:20px;margin:24px 0">
  <p style="margin:0 0 12px;font-weight:700;color:#6c5ce7;font-size:13px;text-transform:uppercase;letter-spacing:1px">Account Details</p>
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="color:#888;font-size:13px;padding:5px 0">Domain</td><td style="font-weight:600;color:#1a1a2e;text-align:right">{domain}</td></tr>
    <tr><td style="color:#888;font-size:13px;padding:5px 0;border-top:1px solid #eee">Username</td><td style="font-family:monospace;font-weight:600;color:#1a1a2e;text-align:right;border-top:1px solid #eee">{username}</td></tr>
    <tr><td style="color:#888;font-size:13px;padding:5px 0;border-top:1px solid #eee">Password</td><td style="font-family:monospace;font-weight:600;color:#6c5ce7;text-align:right;border-top:1px solid #eee">{password}</td></tr>
    <tr><td style="color:#888;font-size:13px;padding:5px 0;border-top:1px solid #eee">cPanel URL</td><td style="text-align:right;border-top:1px solid #eee"><a href="{cpanel_url}" style="color:#6c5ce7">{cpanel_url}</a></td></tr>
  </table>
</div>
<div style="background:#fff8f0;border:1px solid #ffd8b0;border-radius:10px;padding:20px;margin:24px 0">
  <p style="margin:0 0 10px;font-weight:700;color:#e17055;font-size:13px;text-transform:uppercase;letter-spacing:1px">Nameservers</p>
  <p style="margin:4px 0;color:#555;font-family:monospace;font-size:14px">{ns1}</p>
  <p style="margin:4px 0;color:#555;font-family:monospace;font-size:14px">{ns2}</p>
</div>
<p style="color:#555;line-height:1.7;font-size:13px">Please update your domain's nameservers to the values above to point your domain to your hosting account. Propagation may take up to 24–48 hours.</p>
<div style="text-align:center;margin:24px 0">
  <a href="{cpanel_url}" style="background:#6c5ce7;color:white;padding:13px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">Access cPanel</a>
</div>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="font-size:12px;color:#aaa;margin:0;text-align:center">— {company_name} Team</p>
</div></div>`,
    variables: ["{client_name}", "{domain}", "{username}", "{password}", "{cpanel_url}", "{ns1}", "{ns2}", "{webmail_url}", "{company_name}"],
  },
  {
    name: "Password Reset",
    slug: "password-reset",
    subject: "Password Reset Request — {company_name}",
    body: `<div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:30px">
<div style="max-width:600px;margin:auto;background:white;padding:32px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
<div style="text-align:center;margin-bottom:24px">
  <h1 style="color:#6c5ce7;font-size:26px;margin:0">{company_name}</h1>
</div>
<h2 style="color:#1a1a2e;font-size:20px;margin-bottom:4px">Reset Your Password</h2>
<p style="color:#555;line-height:1.7">Hello {client_name},</p>
<p style="color:#555;line-height:1.7">We received a request to reset the password for your account. Click the button below to set a new password. This link expires in <strong>24 hours</strong>.</p>
<div style="text-align:center;margin:28px 0">
  <a href="{reset_link}" style="background:#6c5ce7;color:white;padding:13px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">Reset Password</a>
</div>
<p style="color:#888;font-size:13px;line-height:1.6">If the button doesn't work, copy and paste this link:<br><a href="{reset_link}" style="color:#6c5ce7;word-break:break-all">{reset_link}</a></p>
<p style="color:#e17055;font-size:13px;line-height:1.6">If you did not request a password reset, please ignore this email. Your password will not change.</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="font-size:12px;color:#aaa;margin:0;text-align:center">— {company_name} Team</p>
</div></div>`,
    variables: ["{client_name}", "{reset_link}", "{company_name}"],
  },
  {
    name: "Support Ticket Reply",
    slug: "ticket-reply",
    subject: "Re: [{ticket_number}] {ticket_subject}",
    body: `<div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:30px">
<div style="max-width:600px;margin:auto;background:white;padding:32px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
<div style="text-align:center;margin-bottom:24px">
  <h1 style="color:#6c5ce7;font-size:26px;margin:0">{company_name}</h1>
</div>
<h2 style="color:#1a1a2e;font-size:20px;margin-bottom:4px">New Reply to Your Ticket</h2>
<p style="color:#555;line-height:1.7">Hello {client_name},</p>
<p style="color:#555;line-height:1.7">Our support team has replied to your ticket:</p>
<div style="background:#f9f8ff;border:1px solid #e0d9ff;border-radius:10px;padding:20px;margin:20px 0">
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="color:#888;font-size:13px;padding:5px 0">Ticket #</td><td style="font-weight:600;color:#1a1a2e;text-align:right">{ticket_number}</td></tr>
    <tr><td style="color:#888;font-size:13px;padding:5px 0;border-top:1px solid #eee">Subject</td><td style="font-weight:600;color:#1a1a2e;text-align:right;border-top:1px solid #eee">{ticket_subject}</td></tr>
    <tr><td style="color:#888;font-size:13px;padding:5px 0;border-top:1px solid #eee">Department</td><td style="font-weight:600;color:#6c5ce7;text-align:right;border-top:1px solid #eee">{department}</td></tr>
  </table>
</div>
<div style="background:#fafafa;border-left:4px solid #6c5ce7;border-radius:0 8px 8px 0;padding:16px 20px;margin:20px 0">
  <p style="margin:0;color:#444;line-height:1.7;font-size:14px">{reply_body}</p>
</div>
<div style="text-align:center;margin:24px 0">
  <a href="{ticket_url}" style="background:#6c5ce7;color:white;padding:13px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">View &amp; Reply to Ticket</a>
</div>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="font-size:12px;color:#aaa;margin:0;text-align:center">— {company_name} Support Team</p>
</div></div>`,
    variables: ["{client_name}", "{ticket_number}", "{ticket_subject}", "{department}", "{reply_body}", "{ticket_url}", "{company_name}"],
  },
  {
    name: "Service Suspended",
    slug: "service-suspended",
    subject: "Service Suspended — {domain}",
    body: `<div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:30px">
<div style="max-width:600px;margin:auto;background:white;padding:32px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
<div style="text-align:center;margin-bottom:24px">
  <h1 style="color:#6c5ce7;font-size:26px;margin:0">{company_name}</h1>
</div>
<div style="background:#fff5f5;border:1px solid #fed7d7;border-radius:10px;padding:20px;margin-bottom:24px;text-align:center">
  <p style="font-size:28px;margin:0 0 8px">⚠️</p>
  <h2 style="color:#c53030;font-size:20px;margin:0">Service Suspended</h2>
</div>
<p style="color:#555;line-height:1.7">Hello {client_name},</p>
<p style="color:#555;line-height:1.7">Your hosting service for <strong>{domain}</strong> has been suspended.</p>
<div style="background:#f9f8ff;border:1px solid #e0d9ff;border-radius:10px;padding:20px;margin:20px 0">
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="color:#888;font-size:13px;padding:5px 0">Domain</td><td style="font-weight:600;color:#1a1a2e;text-align:right">{domain}</td></tr>
    <tr><td style="color:#888;font-size:13px;padding:5px 0;border-top:1px solid #eee">Reason</td><td style="font-weight:600;color:#c53030;text-align:right;border-top:1px solid #eee">{reason}</td></tr>
  </table>
</div>
<p style="color:#555;line-height:1.7">To reactivate your service, please pay any outstanding invoices or contact our support team.</p>
<div style="text-align:center;margin:24px 0">
  <a href="{client_area_url}" style="background:#6c5ce7;color:white;padding:13px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">Go to Client Area</a>
</div>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="font-size:12px;color:#aaa;margin:0;text-align:center">— {company_name} Team</p>
</div></div>`,
    variables: ["{client_name}", "{domain}", "{reason}", "{client_area_url}", "{company_name}"],
  },
  {
    name: "Cancellation Confirmation",
    slug: "service-cancelled",
    subject: "Cancellation Processed — {domain}",
    body: `<div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:30px">
<div style="max-width:600px;margin:auto;background:white;padding:32px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
<div style="text-align:center;margin-bottom:24px">
  <h1 style="color:#6c5ce7;font-size:26px;margin:0">{company_name}</h1>
</div>
<h2 style="color:#1a1a2e;font-size:20px;margin-bottom:4px">Cancellation Processed</h2>
<p style="color:#555;line-height:1.7">Hello {client_name},</p>
<p style="color:#555;line-height:1.7">Your cancellation request has been processed. We're sorry to see you go!</p>
<div style="background:#f9f8ff;border:1px solid #e0d9ff;border-radius:10px;padding:20px;margin:20px 0">
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="color:#888;font-size:13px;padding:5px 0">Service</td><td style="font-weight:600;color:#1a1a2e;text-align:right">{service_name}</td></tr>
    <tr><td style="color:#888;font-size:13px;padding:5px 0;border-top:1px solid #eee">Domain</td><td style="font-weight:600;color:#1a1a2e;text-align:right;border-top:1px solid #eee">{domain}</td></tr>
    <tr><td style="color:#888;font-size:13px;padding:5px 0;border-top:1px solid #eee">Cancellation Date</td><td style="font-weight:600;color:#1a1a2e;text-align:right;border-top:1px solid #eee">{cancel_date}</td></tr>
  </table>
</div>
<p style="color:#555;line-height:1.7">You're always welcome back! If you change your mind, please don't hesitate to create a new order or contact our support team.</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="font-size:12px;color:#aaa;margin:0;text-align:center">— {company_name} Team</p>
</div></div>`,
    variables: ["{client_name}", "{domain}", "{service_name}", "{cancel_date}", "{company_name}"],
  },
];

/**
 * Seed any missing default templates and upgrade plain-text defaults to HTML.
 * Existing templates that already contain HTML (admin-customised) are skipped.
 * Called at server startup and on every GET /admin/email-templates request.
 */
export async function seedMissingTemplates() {
  const existing = await db.select({ slug: emailTemplatesTable.slug, body: emailTemplatesTable.body }).from(emailTemplatesTable);
  const existingMap = new Map(existing.map(r => [r.slug, r.body]));

  const toInsert = DEFAULT_TEMPLATES.filter(t => !existingMap.has(t.slug));
  if (toInsert.length > 0) {
    await db.insert(emailTemplatesTable).values(toInsert);
  }

  // Upgrade plain-text templates to HTML (only if the body doesn't contain HTML)
  for (const t of DEFAULT_TEMPLATES) {
    const existingBody = existingMap.get(t.slug);
    if (existingBody && !existingBody.includes("<div") && t.body.includes("<div")) {
      await db.update(emailTemplatesTable)
        .set({ body: t.body, subject: t.subject, name: t.name })
        .where(eq(emailTemplatesTable.slug, t.slug));
    }
  }
}

router.get("/admin/email-templates", authenticate, requireAdmin, async (_req, res) => {
  try {
    await seedMissingTemplates();
    const templates = await db.select().from(emailTemplatesTable).orderBy(emailTemplatesTable.createdAt);
    res.json(templates);
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

router.get("/admin/email-templates/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const [t] = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.id, req.params.id));
    if (!t) { res.status(404).json({ error: "Not found" }); return; }
    res.json(t);
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

router.post("/admin/email-templates", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, slug, subject, body, variables = [] } = req.body;
    if (!name || !slug || !subject || !body) { res.status(400).json({ error: "name, slug, subject, and body required" }); return; }
    const [t] = await db.insert(emailTemplatesTable).values({ name, slug, subject, body, variables }).returning();
    res.status(201).json(t);
  } catch (err: any) {
    if (err.code === "23505") { res.status(400).json({ error: "Slug already exists" }); return; }
    console.error(err); res.status(500).json({ error: "Server error" });
  }
});

router.put("/admin/email-templates/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, slug, subject, body, variables, isActive } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (slug !== undefined) updates.slug = slug;
    if (subject !== undefined) updates.subject = subject;
    if (body !== undefined) updates.body = body;
    if (variables !== undefined) updates.variables = variables;
    if (isActive !== undefined) updates.isActive = isActive;
    const [t] = await db.update(emailTemplatesTable).set(updates).where(eq(emailTemplatesTable.id, req.params.id)).returning();
    if (!t) { res.status(404).json({ error: "Not found" }); return; }
    res.json(t);
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

router.delete("/admin/email-templates/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    await db.delete(emailTemplatesTable).where(eq(emailTemplatesTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

/**
 * POST /admin/email-templates/:id/test
 * Send a test version of the template to the admin's email.
 */
router.post("/admin/email-templates/:id/test", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [t] = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.id, req.params.id));
    if (!t) { res.status(404).json({ error: "Template not found" }); return; }

    const testTo = req.body.email || req.user!.email;

    // Fill all variables with sample data
    const samples: Record<string, string> = {
      client_name: "John Smith",
      verification_code: "847291",
      invoice_id: "INV-2024-001",
      amount: "$9.99",
      due_date: "Jan 31, 2025",
      payment_date: "Jan 15, 2025",
      company_name: "Nexgohost",
      domain: "example.com",
      username: "jsmith001",
      password: "••••••••",
      cpanel_url: "https://server.nexgohost.com:2083",
      ns1: "ns1.nexgohost.com",
      ns2: "ns2.nexgohost.com",
      webmail_url: "https://server.nexgohost.com/webmail",
      service_name: "Starter Plan",
      order_id: "ORD-12345",
      reset_link: "https://nexgohost.com/reset/sample-link",
      ticket_number: "TKT-001",
      ticket_subject: "Help with DNS",
      department: "Technical",
      reply_body: "Thank you for contacting us...",
      ticket_url: "https://nexgohost.com/tickets/001",
      client_area_url: "https://nexgohost.com/client",
      reason: "Overdue invoice",
      cancel_date: "Jan 31, 2025",
    };

    // Render subject + body with sample data
    const rendered = (s: string) => s
      .replace(/\{\{([a-z_]+)\}\}/g, (_, k) => samples[k] ?? `{{${k}}}`)
      .replace(/\{([a-z_]+)\}/g, (_, k) => samples[k] ?? `{${k}}`);

    const subject = `[TEST] ${rendered(t.subject)}`;
    const body = rendered(t.body);
    const isHtml = body.trimStart().startsWith("<");
    const html = isHtml ? body : body.replace(/\n/g, "<br>");

    const result = await sendEmail({ to: testTo, subject, html });
    res.json({ ...result, sentTo: testTo });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

export default router;
