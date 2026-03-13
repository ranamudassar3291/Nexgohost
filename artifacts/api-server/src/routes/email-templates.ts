import { Router } from "express";
import { db } from "@workspace/db";
import { emailTemplatesTable } from "@workspace/db/schema";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { eq } from "drizzle-orm";

const router = Router();

const DEFAULT_TEMPLATES = [
  {
    name: "Invoice Created", slug: "invoice-created",
    subject: "Invoice #{invoice_id} — {company_name}",
    body: `Hi {client_name},\n\nA new invoice has been generated for your account.\n\nInvoice #: {invoice_id}\nAmount Due: {amount}\nDue Date: {due_date}\n\nPlease log in to your client area to view and pay this invoice.\n{client_area_url}\n\nThank you for your business.\n— {company_name} Team`,
    variables: ["{client_name}", "{invoice_id}", "{amount}", "{due_date}", "{client_area_url}", "{company_name}"],
  },
  {
    name: "Invoice Payment Confirmation", slug: "invoice-paid",
    subject: "Payment Received — Invoice #{invoice_id}",
    body: `Hi {client_name},\n\nWe have received your payment for Invoice #{invoice_id}.\n\nAmount Paid: {amount}\nPayment Date: {payment_date}\n\nThank you! Your services are now active.\n— {company_name} Team`,
    variables: ["{client_name}", "{invoice_id}", "{amount}", "{payment_date}", "{company_name}"],
  },
  {
    name: "New Order Confirmation", slug: "order-created",
    subject: "Order Confirmed — {service_name}",
    body: `Hi {client_name},\n\nThank you for your order! We are setting up your account.\n\nService: {service_name}\nDomain: {domain}\nOrder #: {order_id}\n\nYou will receive login details once your hosting account is ready.\n— {company_name} Team`,
    variables: ["{client_name}", "{service_name}", "{domain}", "{order_id}", "{company_name}"],
  },
  {
    name: "Hosting Account Created", slug: "hosting-created",
    subject: "Your Hosting Account is Ready — {domain}",
    body: `Hi {client_name},\n\nYour hosting account has been successfully created!\n\n--- ACCOUNT DETAILS ---\nDomain: {domain}\nUsername: {username}\nPassword: {password}\ncPanel URL: {cpanel_url}\n\n--- NAMESERVERS ---\nNS1: {ns1}\nNS2: {ns2}\n\n--- WEBMAIL ---\nWebmail: {webmail_url}\n\n— {company_name} Team`,
    variables: ["{client_name}", "{domain}", "{username}", "{password}", "{cpanel_url}", "{ns1}", "{ns2}", "{webmail_url}", "{company_name}"],
  },
  {
    name: "Password Reset", slug: "password-reset",
    subject: "Password Reset Request",
    body: `Hi {client_name},\n\nWe received a request to reset your password.\n\nClick the link below (expires in 24 hours):\n{reset_link}\n\nIf you did not request this, please ignore this email.\n— {company_name} Team`,
    variables: ["{client_name}", "{reset_link}", "{company_name}"],
  },
  {
    name: "Support Ticket Reply", slug: "ticket-reply",
    subject: "Re: [{ticket_number}] {ticket_subject}",
    body: `Hi {client_name},\n\nA new reply has been added to your support ticket.\n\nTicket #: {ticket_number}\nSubject: {ticket_subject}\nDepartment: {department}\n\nReply:\n{reply_body}\n\nView & reply: {ticket_url}\n— {company_name} Support Team`,
    variables: ["{client_name}", "{ticket_number}", "{ticket_subject}", "{department}", "{reply_body}", "{ticket_url}", "{company_name}"],
  },
  {
    name: "Service Suspended", slug: "service-suspended",
    subject: "Service Suspended — {domain}",
    body: `Hi {client_name},\n\nYour hosting service for {domain} has been suspended.\n\nReason: {reason}\n\nTo reactivate, please pay outstanding invoices or contact support.\n{client_area_url}\n— {company_name} Team`,
    variables: ["{client_name}", "{domain}", "{reason}", "{client_area_url}", "{company_name}"],
  },
  {
    name: "Cancellation Confirmation", slug: "service-cancelled",
    subject: "Cancellation Processed — {domain}",
    body: `Hi {client_name},\n\nYour cancellation request for {domain} has been processed.\n\nService: {service_name}\nCancellation Date: {cancel_date}\n\nWe're sorry to see you go. You're welcome back anytime!\n— {company_name} Team`,
    variables: ["{client_name}", "{domain}", "{service_name}", "{cancel_date}", "{company_name}"],
  },
];

router.get("/admin/email-templates", authenticate, requireAdmin, async (_req, res) => {
  try {
    let templates = await db.select().from(emailTemplatesTable).orderBy(emailTemplatesTable.createdAt);
    if (templates.length === 0) {
      await db.insert(emailTemplatesTable).values(DEFAULT_TEMPLATES);
      templates = await db.select().from(emailTemplatesTable).orderBy(emailTemplatesTable.createdAt);
    }
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

export default router;
