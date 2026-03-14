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
    body: `Hi {client_name},\n\nA new invoice has been generated for your account.\n\nInvoice #: {invoice_id}\nAmount Due: {amount}\nDue Date: {due_date}\n\nPlease log in to your client area to view and pay this invoice.\n{client_area_url}\n\nThank you for your business.\n— {company_name} Team`,
    variables: ["{client_name}", "{invoice_id}", "{amount}", "{due_date}", "{client_area_url}", "{company_name}"],
  },
  {
    name: "Invoice Payment Confirmation",
    slug: "invoice-paid",
    subject: "Payment Received — Invoice #{invoice_id}",
    body: `Hi {client_name},\n\nWe have received your payment for Invoice #{invoice_id}.\n\nAmount Paid: {amount}\nPayment Date: {payment_date}\n\nThank you! Your services are now active.\n— {company_name} Team`,
    variables: ["{client_name}", "{invoice_id}", "{amount}", "{payment_date}", "{company_name}"],
  },
  {
    name: "New Order Confirmation",
    slug: "order-created",
    subject: "Order Confirmed — {service_name}",
    body: `Hi {client_name},\n\nThank you for your order! We are setting up your account.\n\nService: {service_name}\nDomain: {domain}\nOrder #: {order_id}\n\nYou will receive login details once your hosting account is ready.\n— {company_name} Team`,
    variables: ["{client_name}", "{service_name}", "{domain}", "{order_id}", "{company_name}"],
  },
  {
    name: "Hosting Account Created",
    slug: "hosting-created",
    subject: "Your Hosting Account is Ready — {domain}",
    body: `Hi {client_name},\n\nYour hosting account has been successfully created!\n\n--- ACCOUNT DETAILS ---\nDomain: {domain}\nUsername: {username}\nPassword: {password}\ncPanel URL: {cpanel_url}\n\n--- NAMESERVERS ---\nNS1: {ns1}\nNS2: {ns2}\n\n--- WEBMAIL ---\nWebmail: {webmail_url}\n\n— {company_name} Team`,
    variables: ["{client_name}", "{domain}", "{username}", "{password}", "{cpanel_url}", "{ns1}", "{ns2}", "{webmail_url}", "{company_name}"],
  },
  {
    name: "Password Reset",
    slug: "password-reset",
    subject: "Password Reset Request",
    body: `Hi {client_name},\n\nWe received a request to reset your password.\n\nClick the link below (expires in 24 hours):\n{reset_link}\n\nIf you did not request this, please ignore this email.\n— {company_name} Team`,
    variables: ["{client_name}", "{reset_link}", "{company_name}"],
  },
  {
    name: "Support Ticket Reply",
    slug: "ticket-reply",
    subject: "Re: [{ticket_number}] {ticket_subject}",
    body: `Hi {client_name},\n\nA new reply has been added to your support ticket.\n\nTicket #: {ticket_number}\nSubject: {ticket_subject}\nDepartment: {department}\n\nReply:\n{reply_body}\n\nView & reply: {ticket_url}\n— {company_name} Support Team`,
    variables: ["{client_name}", "{ticket_number}", "{ticket_subject}", "{department}", "{reply_body}", "{ticket_url}", "{company_name}"],
  },
  {
    name: "Service Suspended",
    slug: "service-suspended",
    subject: "Service Suspended — {domain}",
    body: `Hi {client_name},\n\nYour hosting service for {domain} has been suspended.\n\nReason: {reason}\n\nTo reactivate, please pay outstanding invoices or contact support.\n{client_area_url}\n— {company_name} Team`,
    variables: ["{client_name}", "{domain}", "{reason}", "{client_area_url}", "{company_name}"],
  },
  {
    name: "Cancellation Confirmation",
    slug: "service-cancelled",
    subject: "Cancellation Processed — {domain}",
    body: `Hi {client_name},\n\nYour cancellation request for {domain} has been processed.\n\nService: {service_name}\nCancellation Date: {cancel_date}\n\nWe're sorry to see you go. You're welcome back anytime!\n— {company_name} Team`,
    variables: ["{client_name}", "{domain}", "{service_name}", "{cancel_date}", "{company_name}"],
  },
];

/**
 * Seed any missing default templates (upsert-style).
 * If a template with a given slug already exists, skip it — don't overwrite admin edits.
 * Called at server startup and on every GET /admin/email-templates request.
 */
export async function seedMissingTemplates() {
  const existing = await db.select({ slug: emailTemplatesTable.slug }).from(emailTemplatesTable);
  const existingSlugs = new Set(existing.map(r => r.slug));
  const missing = DEFAULT_TEMPLATES.filter(t => !existingSlugs.has(t.slug));
  if (missing.length > 0) {
    await db.insert(emailTemplatesTable).values(missing);
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
