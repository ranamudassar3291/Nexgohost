import { Router } from "express";
import { db } from "@workspace/db";
import { emailTemplatesTable } from "@workspace/db/schema";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { eq, inArray } from "drizzle-orm";
import { sendEmail } from "../lib/email.js";

const router = Router();

// ─── Shared Layout ────────────────────────────────────────────────────────────
// Purple + white Hostinger-style wrapper used by every template.
// Content is injected into the white card body.

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Noehost</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Inter,'Helvetica Neue',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:40px 16px">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

        <!-- ── HEADER ─────────────────────────────────────────────────── -->
        <tr>
          <td style="background:#701AFE;padding:26px 40px;text-align:center">
            <span style="font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px">Noehost</span>
          </td>
        </tr>

        <!-- ── BODY ──────────────────────────────────────────────────── -->
        <tr>
          <td style="padding:40px 40px 32px;color:#222222;font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.7">
            ${content}
          </td>
        </tr>

        <!-- ── FOOTER ────────────────────────────────────────────────── -->
        <tr>
          <td style="background:#f9f9f9;border-top:1px solid #eeeeee;padding:28px 40px;text-align:center">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="padding-bottom:16px">
                  <!-- Twitter/X -->
                  <a href="https://twitter.com/noehost" style="display:inline-block;margin:0 5px;width:34px;height:34px;background:#701AFE;border-radius:50%;text-align:center;line-height:34px;text-decoration:none;font-family:Arial;font-size:14px;font-weight:700;color:#ffffff">X</a>
                  <!-- Facebook -->
                  <a href="https://facebook.com/noehost" style="display:inline-block;margin:0 5px;width:34px;height:34px;background:#701AFE;border-radius:50%;text-align:center;line-height:34px;text-decoration:none;font-family:Arial;font-size:15px;font-weight:700;color:#ffffff">f</a>
                  <!-- LinkedIn -->
                  <a href="https://linkedin.com/company/noehost" style="display:inline-block;margin:0 5px;width:34px;height:34px;background:#701AFE;border-radius:50%;text-align:center;line-height:34px;text-decoration:none;font-family:Arial;font-size:12px;font-weight:700;color:#ffffff">in</a>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <p style="margin:0 0 8px;color:#aaaaaa;font-size:12px;font-family:Inter,Arial,sans-serif">© 2026 Noehost. All rights reserved.</p>
                  <p style="margin:0;font-size:12px;font-family:Inter,Arial,sans-serif">
                    <a href="https://noehost.com/unsubscribe" style="color:#aaaaaa;text-decoration:underline">Unsubscribe</a>
                    <span style="color:#dddddd;margin:0 6px">&middot;</span>
                    <a href="https://noehost.com/privacy" style="color:#aaaaaa;text-decoration:underline">Privacy Policy</a>
                    <span style="color:#dddddd;margin:0 6px">&middot;</span>
                    <a href="https://noehost.com/client" style="color:#aaaaaa;text-decoration:underline">Client Area</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// Reusable CTA button (table-based for email client compatibility)
function btn(label: string, url: string): string {
  return `
<table cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 0">
  <tr>
    <td align="center" style="background:#701AFE;border-radius:8px">
      <a href="${url}" style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;font-family:Inter,'Helvetica Neue',Arial,sans-serif;letter-spacing:0.1px">${label}</a>
    </td>
  </tr>
</table>`;
}

// Details table (key-value rows)
function detailsTable(rows: string[]): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f6ff;border:1px solid #e5deff;border-radius:10px;margin:24px 0">
  ${rows.join("\n")}
</table>`;
}

function detailRow(label: string, value: string, first = false): string {
  const border = first ? "" : "border-top:1px solid #eeeeee;";
  return `<tr>
    <td style="padding:12px 20px;color:#777777;font-size:13px;font-family:Inter,Arial,sans-serif;${border}">${label}</td>
    <td style="padding:12px 20px;font-weight:600;color:#222222;font-size:13px;text-align:right;font-family:Inter,Arial,sans-serif;${border}">${value}</td>
  </tr>`;
}

// Orange/red warning box
function alertBox(icon: string, title: string, subtitle?: string): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff5f5;border:1px solid #fecaca;border-radius:10px;margin-bottom:24px">
  <tr>
    <td align="center" style="padding:24px 20px">
      <p style="margin:0 0 6px;font-size:30px">${icon}</p>
      <p style="margin:0 0 2px;font-size:18px;font-weight:700;color:#c53030;font-family:Inter,Arial,sans-serif">${title}</p>
      ${subtitle ? `<p style="margin:6px 0 0;font-size:13px;color:#9b2c2c;font-family:Inter,Arial,sans-serif">${subtitle}</p>` : ""}
    </td>
  </tr>
</table>`;
}

// Green success box
function successBox(icon: string, title: string, subtitle?: string): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fff4;border:1px solid #9ae6b4;border-radius:10px;margin-bottom:24px">
  <tr>
    <td align="center" style="padding:24px 20px">
      <p style="margin:0 0 6px;font-size:30px">${icon}</p>
      <p style="margin:0 0 2px;font-size:18px;font-weight:700;color:#276749;font-family:Inter,Arial,sans-serif">${title}</p>
      ${subtitle ? `<p style="margin:6px 0 0;font-size:13px;color:#276749;font-family:Inter,Arial,sans-serif">${subtitle}</p>` : ""}
    </td>
  </tr>
</table>`;
}

// Monospace code box (verification codes, credentials)
function codeBox(label: string, value: string): string {
  return `
<table cellpadding="0" cellspacing="0" border="0" style="margin:28px auto">
  <tr>
    <td align="center" style="background:#f8f6ff;border:2px solid #701AFE;border-radius:12px;padding:20px 48px">
      <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#701AFE;text-transform:uppercase;letter-spacing:2px;font-family:Inter,Arial,sans-serif">${label}</p>
      <p style="margin:0;font-size:38px;font-weight:700;letter-spacing:10px;color:#222222;font-family:'Courier New',monospace">${value}</p>
    </td>
  </tr>
</table>`;
}

// ─── DEFAULT TEMPLATES ────────────────────────────────────────────────────────

const DEFAULT_TEMPLATES = [
  // ── 1. Email Verification ─────────────────────────────────────────────────
  {
    name: "Email Verification",
    slug: "email-verification",
    subject: "Verify your email address — Noehost",
    body: layout(`
<h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#222222">Verify your email</h2>
<p style="margin:0 0 16px;color:#555555">Hi {{client_name}},</p>
<p style="margin:0 0 8px;color:#555555">Thank you for creating a Noehost account. To complete your registration, enter the verification code below. This code expires in <strong>10 minutes</strong>.</p>
${codeBox("Your Verification Code", "{{verification_code}}")}
<p style="color:#888888;font-size:13px;margin:24px 0 0">If you did not create this account, you can safely ignore this email — no action is needed.</p>
`),
    variables: ["{{client_name}}", "{{verification_code}}"],
  },

  // ── 2. Welcome ────────────────────────────────────────────────────────────
  {
    name: "Welcome to Noehost",
    slug: "welcome",
    subject: "Welcome to Noehost, {{client_name}}!",
    body: layout(`
${successBox("🎉", "Welcome to Noehost!", "Your account is ready")}
<p style="margin:0 0 16px;color:#555555">Hi {{client_name}},</p>
<p style="margin:0 0 16px;color:#555555">We're thrilled to have you on board. Your Noehost account is all set up and ready to go. Here's what you can do from your dashboard:</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px">
  <tr>
    <td style="padding:10px 0;border-bottom:1px solid #eeeeee">
      <span style="display:inline-block;width:28px;height:28px;background:#f0ebff;border-radius:6px;text-align:center;line-height:28px;font-size:14px;margin-right:12px;vertical-align:middle">🌐</span>
      <span style="color:#222222;font-size:14px;font-family:Inter,Arial,sans-serif;vertical-align:middle">Manage your hosting services and domains</span>
    </td>
  </tr>
  <tr>
    <td style="padding:10px 0;border-bottom:1px solid #eeeeee">
      <span style="display:inline-block;width:28px;height:28px;background:#f0ebff;border-radius:6px;text-align:center;line-height:28px;font-size:14px;margin-right:12px;vertical-align:middle">📄</span>
      <span style="color:#222222;font-size:14px;font-family:Inter,Arial,sans-serif;vertical-align:middle">View and pay invoices instantly</span>
    </td>
  </tr>
  <tr>
    <td style="padding:10px 0">
      <span style="display:inline-block;width:28px;height:28px;background:#f0ebff;border-radius:6px;text-align:center;line-height:28px;font-size:14px;margin-right:12px;vertical-align:middle">🛡️</span>
      <span style="color:#222222;font-size:14px;font-family:Inter,Arial,sans-serif;vertical-align:middle">Get 24/7 expert support whenever you need it</span>
    </td>
  </tr>
</table>
${btn("Go to My Dashboard", "{{dashboard_url}}")}
<p style="color:#888888;font-size:13px;margin:28px 0 0;text-align:center">Need help? <a href="https://noehost.com/client/tickets" style="color:#701AFE;text-decoration:none">Open a support ticket</a> and our team will be happy to assist.</p>
`),
    variables: ["{{client_name}}", "{{dashboard_url}}"],
  },

  // ── 3. Invoice Created ────────────────────────────────────────────────────
  {
    name: "Invoice Generated",
    slug: "invoice-created",
    subject: "New Invoice #{{invoice_id}} — Payment Due {{due_date}}",
    body: layout(`
<h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#222222">New Invoice Generated</h2>
<p style="margin:0 0 16px;color:#555555">Hi {{client_name}},</p>
<p style="margin:0 0 8px;color:#555555">A new invoice has been created for your account. Please review the details below and complete payment before the due date to avoid any service interruption.</p>
${detailsTable([
  detailRow("Invoice Number", "#{{invoice_id}}", true),
  detailRow("Amount Due", `<span style="color:#701AFE;font-size:15px">{{amount}}</span>`, false),
  detailRow("Due Date", `<span style="color:#e53e3e">{{due_date}}</span>`, false),
])}
${btn("View &amp; Pay Invoice", "{{client_area_url}}")}
<p style="color:#888888;font-size:13px;margin:24px 0 0;text-align:center">If you have any questions about this invoice, please <a href="https://noehost.com/client/tickets" style="color:#701AFE;text-decoration:none">contact our billing team</a>.</p>
`),
    variables: ["{{client_name}}", "{{invoice_id}}", "{{amount}}", "{{due_date}}", "{{client_area_url}}"],
  },

  // ── 4. Invoice Paid ───────────────────────────────────────────────────────
  {
    name: "Payment Confirmation",
    slug: "invoice-paid",
    subject: "Payment Confirmed — Invoice #{{invoice_id}}",
    body: layout(`
${successBox("✅", "Payment Received", "Thank you for your payment!")}
<p style="margin:0 0 16px;color:#555555">Hi {{client_name}},</p>
<p style="margin:0 0 8px;color:#555555">We've successfully received your payment. Here's your receipt for your records:</p>
${detailsTable([
  detailRow("Invoice Number", "#{{invoice_id}}", true),
  detailRow("Amount Paid", `<span style="color:#276749;font-size:15px;font-weight:700">{{amount}}</span>`, false),
  detailRow("Payment Date", "{{payment_date}}", false),
  detailRow("Status", `<span style="color:#276749;font-weight:700">&#10003; Paid</span>`, false),
])}
${btn("View Receipt", "https://noehost.com/client/invoices")}
<p style="color:#888888;font-size:13px;margin:24px 0 0;text-align:center">Your services are now active and running. If you have any questions, we're always here to help.</p>
`),
    variables: ["{{client_name}}", "{{invoice_id}}", "{{amount}}", "{{payment_date}}"],
  },

  // ── 5. Order Confirmed ────────────────────────────────────────────────────
  {
    name: "Order Confirmation",
    slug: "order-created",
    subject: "Order Confirmed — {{service_name}} is being set up",
    body: layout(`
<h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#222222">Order Confirmed!</h2>
<p style="margin:0 0 16px;color:#555555">Hi {{client_name}},</p>
<p style="margin:0 0 8px;color:#555555">Thank you for your order! We've received it and our team is setting up your service. You'll receive a separate email with your login credentials once everything is ready.</p>
${detailsTable([
  detailRow("Order Number", "#{{order_id}}", true),
  detailRow("Service", "{{service_name}}", false),
  detailRow("Domain", `<span style="color:#701AFE">{{domain}}</span>`, false),
  detailRow("Status", `<span style="color:#d97706;font-weight:700">&#8987; Setting Up</span>`, false),
])}
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f6ff;border-radius:10px;padding:16px 20px;margin:4px 0 0">
  <tr>
    <td style="color:#555555;font-size:13px;font-family:Inter,Arial,sans-serif">
      <strong style="color:#701AFE">⚡ What happens next?</strong><br>
      Our system will automatically provision your hosting account. You'll receive your cPanel credentials and nameservers within minutes.
    </td>
  </tr>
</table>
${btn("Track Your Order", "https://noehost.com/client/orders")}
`),
    variables: ["{{client_name}}", "{{service_name}}", "{{domain}}", "{{order_id}}"],
  },

  // ── 6. Hosting Created ────────────────────────────────────────────────────
  {
    name: "Hosting Account Ready",
    slug: "hosting-created",
    subject: "🚀 Your hosting for {{domain}} is ready!",
    body: layout(`
<h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#222222">Your Hosting is Live!</h2>
<p style="margin:0 0 16px;color:#555555">Hi {{client_name}},</p>
<p style="margin:0 0 8px;color:#555555">Great news — your hosting account for <strong style="color:#222222">{{domain}}</strong> has been successfully activated. Here are your account details. Keep these safe!</p>

<p style="margin:16px 0 8px;font-size:13px;font-weight:600;color:#701AFE;text-transform:uppercase;letter-spacing:1px">&#128272; Login Credentials</p>
${detailsTable([
  detailRow("Domain", "{{domain}}", true),
  detailRow("Username", `<span style="font-family:'Courier New',monospace;color:#701AFE">{{username}}</span>`, false),
  detailRow("Password", `<span style="font-family:'Courier New',monospace;color:#701AFE">{{password}}</span>`, false),
  detailRow("cPanel URL", `<a href="{{cpanel_url}}" style="color:#701AFE;text-decoration:none;font-family:'Courier New',monospace">{{cpanel_url}}</a>`, false),
  detailRow("Webmail", `<a href="{{webmail_url}}" style="color:#701AFE;text-decoration:none">{{webmail_url}}</a>`, false),
])}

<p style="margin:16px 0 8px;font-size:13px;font-weight:600;color:#e07b00;text-transform:uppercase;letter-spacing:1px">&#127758; Nameservers (update at your registrar)</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbf0;border:1px solid #fde68a;border-radius:10px;margin-bottom:24px">
  <tr>
    <td style="padding:12px 20px;color:#777777;font-size:13px">Primary</td>
    <td style="padding:12px 20px;font-weight:600;color:#222222;font-size:13px;text-align:right;font-family:'Courier New',monospace">{{ns1}}</td>
  </tr>
  <tr>
    <td style="padding:12px 20px;color:#777777;font-size:13px;border-top:1px solid #fde68a">Secondary</td>
    <td style="padding:12px 20px;font-weight:600;color:#222222;font-size:13px;text-align:right;border-top:1px solid #fde68a;font-family:'Courier New',monospace">{{ns2}}</td>
  </tr>
</table>
<p style="color:#888888;font-size:12px;margin:0 0 20px">DNS propagation can take 24–48 hours. Your site will be live once propagation is complete.</p>
${btn("Open cPanel", "{{cpanel_url}}")}
`),
    variables: ["{{client_name}}", "{{domain}}", "{{username}}", "{{password}}", "{{cpanel_url}}", "{{ns1}}", "{{ns2}}", "{{webmail_url}}"],
  },

  // ── 7. Domain Registered ─────────────────────────────────────────────────
  {
    name: "Domain Registration Successful",
    slug: "domain-registered",
    subject: "🎉 Congratulations! {{domain}} is yours",
    body: layout(`
${successBox("🌐", "Your domain is registered!", "{{domain}}")}
<p style="margin:0 0 16px;color:#555555">Hi {{client_name}},</p>
<p style="margin:0 0 8px;color:#555555">Congratulations! Your domain <strong style="color:#701AFE">{{domain}}</strong> has been successfully registered and is now yours.</p>
${detailsTable([
  detailRow("Domain Name", `<span style="color:#701AFE;font-weight:700">{{domain}}</span>`, true),
  detailRow("Expiry Date", "{{expiry_date}}", false),
  detailRow("Status", `<span style="color:#276749;font-weight:700">&#10003; Active</span>`, false),
])}
<p style="margin:8px 0 16px;color:#555555">You can manage your DNS records, set up email forwarding, and configure your domain settings from your client area:</p>
${btn("Manage DNS Settings", "{{dns_url}}")}
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f6ff;border-radius:10px;margin:24px 0 0">
  <tr>
    <td style="padding:16px 20px;color:#555555;font-size:13px;font-family:Inter,Arial,sans-serif">
      <strong style="color:#701AFE">💡 Tip:</strong> Point your domain to your hosting by updating the nameservers, or use our DNS editor to add A, CNAME, or MX records directly.
    </td>
  </tr>
</table>
`),
    variables: ["{{client_name}}", "{{domain}}", "{{expiry_date}}", "{{dns_url}}"],
  },

  // ── 8. Password Reset ─────────────────────────────────────────────────────
  {
    name: "Password Reset",
    slug: "password-reset",
    subject: "Reset your Noehost password",
    body: layout(`
<h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#222222">Reset your password</h2>
<p style="margin:0 0 16px;color:#555555">Hi {{client_name}},</p>
<p style="margin:0 0 8px;color:#555555">We received a request to reset the password for your Noehost account. Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.</p>
${btn("Reset My Password", "{{reset_link}}")}
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0">
  <tr>
    <td style="background:#f8f6ff;border-radius:10px;padding:16px 20px">
      <p style="margin:0 0 4px;font-size:12px;color:#777777;font-family:Inter,Arial,sans-serif">If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="margin:0;font-size:12px;font-family:'Courier New',monospace;word-break:break-all"><a href="{{reset_link}}" style="color:#701AFE;text-decoration:none">{{reset_link}}</a></p>
    </td>
  </tr>
</table>
<p style="color:#e53e3e;font-size:13px;margin:20px 0 0">&#9888; If you did not request a password reset, please ignore this email. Your password will remain unchanged.</p>
`),
    variables: ["{{client_name}}", "{{reset_link}}"],
  },

  // ── 9. Ticket Reply ───────────────────────────────────────────────────────
  {
    name: "Support Ticket Reply",
    slug: "ticket-reply",
    subject: "Re: [#{{ticket_number}}] {{ticket_subject}}",
    body: layout(`
<h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#222222">New Reply to Your Ticket</h2>
<p style="margin:0 0 16px;color:#555555">Hi {{client_name}},</p>
<p style="margin:0 0 8px;color:#555555">Our support team has replied to your ticket. Here's a summary:</p>
${detailsTable([
  detailRow("Ticket #", "{{ticket_number}}", true),
  detailRow("Subject", "{{ticket_subject}}", false),
  detailRow("Department", `<span style="color:#701AFE">{{department}}</span>`, false),
])}
<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#701AFE;text-transform:uppercase;letter-spacing:1px">&#128172; Reply from Noehost Support</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafafa;border-left:4px solid #701AFE;border-radius:0 10px 10px 0;margin-bottom:24px">
  <tr>
    <td style="padding:16px 20px;color:#444444;font-size:14px;font-family:Inter,Arial,sans-serif;line-height:1.7">{{reply_body}}</td>
  </tr>
</table>
${btn("View &amp; Reply to Ticket", "{{ticket_url}}")}
`),
    variables: ["{{client_name}}", "{{ticket_number}}", "{{ticket_subject}}", "{{department}}", "{{reply_body}}", "{{ticket_url}}"],
  },

  // ── 10. Service Suspended ─────────────────────────────────────────────────
  {
    name: "Service Suspended",
    slug: "service-suspended",
    subject: "Action Required: Your service for {{domain}} has been suspended",
    body: layout(`
${alertBox("⚠️", "Service Suspended", "Immediate action required")}
<p style="margin:0 0 16px;color:#555555">Hi {{client_name}},</p>
<p style="margin:0 0 8px;color:#555555">Your hosting service for <strong style="color:#222222">{{domain}}</strong> has been temporarily suspended. Here are the details:</p>
${detailsTable([
  detailRow("Domain", "{{domain}}", true),
  detailRow("Suspension Reason", `<span style="color:#e53e3e">{{reason}}</span>`, false),
  detailRow("Status", `<span style="color:#e53e3e;font-weight:700">&#9888; Suspended</span>`, false),
])}
<p style="margin:8px 0 16px;color:#555555">To reactivate your service, please pay any outstanding invoices or resolve the issue causing the suspension. Your data is safe and will be restored immediately upon reactivation.</p>
${btn("Reactivate My Service", "{{client_area_url}}")}
<p style="color:#888888;font-size:13px;margin:24px 0 0;text-align:center">Need help? <a href="https://noehost.com/client/tickets" style="color:#701AFE;text-decoration:none">Open a support ticket</a> and we'll assist you right away.</p>
`),
    variables: ["{{client_name}}", "{{domain}}", "{{reason}}", "{{client_area_url}}"],
  },

  // ── 11. Service Terminated ────────────────────────────────────────────────
  {
    name: "Service Terminated",
    slug: "service-terminated",
    subject: "Notice: Your service for {{domain}} has been terminated",
    body: layout(`
${alertBox("🗑️", "Service Terminated", "This action is permanent")}
<p style="margin:0 0 16px;color:#555555">Hi {{client_name}},</p>
<p style="margin:0 0 8px;color:#555555">We're writing to inform you that your hosting service for <strong style="color:#222222">{{domain}}</strong> has been permanently terminated.</p>
${detailsTable([
  detailRow("Service", "{{service_name}}", true),
  detailRow("Domain", "{{domain}}", false),
  detailRow("Termination Date", "{{termination_date}}", false),
  detailRow("Status", `<span style="color:#9b2c2c;font-weight:700">&#10005; Terminated</span>`, false),
])}
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff5f5;border:1px solid #feb2b2;border-radius:10px;margin:0 0 20px">
  <tr>
    <td style="padding:16px 20px;color:#742a2a;font-size:13px;font-family:Inter,Arial,sans-serif;line-height:1.7">
      <strong>&#9888; Important:</strong> All associated data, files, databases, and email accounts have been permanently deleted and cannot be recovered.
    </td>
  </tr>
</table>
<p style="margin:0 0 16px;color:#555555">If you believe this termination was in error, or if you'd like to start fresh with a new hosting plan, please contact our support team immediately.</p>
${btn("Contact Support", "https://noehost.com/client/tickets")}
`),
    variables: ["{{client_name}}", "{{domain}}", "{{service_name}}", "{{termination_date}}"],
  },

  // ── 12. Service Cancelled ─────────────────────────────────────────────────
  {
    name: "Cancellation Confirmation",
    slug: "service-cancelled",
    subject: "Cancellation Confirmed — {{domain}}",
    body: layout(`
<h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#222222">Cancellation Confirmed</h2>
<p style="margin:0 0 16px;color:#555555">Hi {{client_name}},</p>
<p style="margin:0 0 8px;color:#555555">We've processed your cancellation request. We're sorry to see you go! Here's a summary:</p>
${detailsTable([
  detailRow("Service", "{{service_name}}", true),
  detailRow("Domain", "{{domain}}", false),
  detailRow("Cancellation Date", "{{cancel_date}}", false),
  detailRow("Status", `<span style="color:#d97706;font-weight:700">&#10003; Cancellation Confirmed</span>`, false),
])}
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f6ff;border-radius:10px;margin:0 0 20px">
  <tr>
    <td style="padding:16px 20px;color:#555555;font-size:13px;font-family:Inter,Arial,sans-serif;line-height:1.7">
      <strong style="color:#701AFE">You're always welcome back!</strong> If you change your mind, you can create a new order anytime from your client area.
    </td>
  </tr>
</table>
${btn("Explore New Plans", "https://noehost.com/client/new-order")}
<p style="color:#888888;font-size:13px;margin:24px 0 0;text-align:center">Thank you for being a Noehost customer. We hope to serve you again in the future.</p>
`),
    variables: ["{{client_name}}", "{{domain}}", "{{service_name}}", "{{cancel_date}}"],
  },

  // ── 13. Refund Processed ─────────────────────────────────────────────────
  {
    name: "Refund Processed",
    slug: "refund-processed",
    subject: "Refund of {{refund_amount}} has been processed",
    body: layout(`
${successBox("💰", "Refund Processed", "Your refund is on its way")}
<p style="margin:0 0 16px;color:#555555">Hi {{client_name}},</p>
<p style="margin:0 0 8px;color:#555555">We've successfully processed your refund. Here are the details:</p>
${detailsTable([
  detailRow("Refund Amount", `<span style="color:#276749;font-size:15px;font-weight:700">{{refund_amount}}</span>`, true),
  detailRow("Related Invoice", "#{{invoice_id}}", false),
  detailRow("Refund Date", "{{refund_date}}", false),
  detailRow("Payment Method", "{{payment_method}}", false),
])}
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fff4;border:1px solid #9ae6b4;border-radius:10px;margin:0 0 20px">
  <tr>
    <td style="padding:16px 20px;color:#276749;font-size:13px;font-family:Inter,Arial,sans-serif;line-height:1.7">
      <strong>&#128336; Processing Time:</strong> Refunds typically appear in your account within 5–10 business days, depending on your payment provider.
    </td>
  </tr>
</table>
${btn("View Billing History", "https://noehost.com/client/invoices")}
<p style="color:#888888;font-size:13px;margin:24px 0 0;text-align:center">If you have any questions about this refund, please <a href="https://noehost.com/client/tickets" style="color:#701AFE;text-decoration:none">contact our billing team</a>.</p>
`),
    variables: ["{{client_name}}", "{{refund_amount}}", "{{invoice_id}}", "{{refund_date}}", "{{payment_method}}"],
  },
];

// ─── Seeder ───────────────────────────────────────────────────────────────────
/**
 * Insert missing templates and force-update all default templates to the
 * latest design. Admin-created custom templates (slugs not in DEFAULT_TEMPLATES)
 * are never touched.
 */
export async function seedMissingTemplates() {
  const existing = await db
    .select({ slug: emailTemplatesTable.slug, body: emailTemplatesTable.body })
    .from(emailTemplatesTable);
  const existingMap = new Map(existing.map(r => [r.slug, r.body]));

  const toInsert = DEFAULT_TEMPLATES.filter(t => !existingMap.has(t.slug));
  if (toInsert.length > 0) {
    await db.insert(emailTemplatesTable).values(toInsert);
  }

  // Force-update all default templates to the latest design.
  // Only default slugs are touched; admin-created custom templates are skipped.
  const defaultSlugs = new Set(DEFAULT_TEMPLATES.map(t => t.slug));
  for (const t of DEFAULT_TEMPLATES) {
    if (existingMap.has(t.slug)) {
      await db
        .update(emailTemplatesTable)
        .set({ body: t.body, subject: t.subject, name: t.name, variables: t.variables })
        .where(eq(emailTemplatesTable.slug, t.slug));
    }
  }

  console.log(`[TEMPLATES] ${toInsert.length} new template(s) inserted, ${defaultSlugs.size} template(s) refreshed`);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

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

    const samples: Record<string, string> = {
      client_name:       "Alex Johnson",
      verification_code: "847291",
      invoice_id:        "INV-2025-001",
      amount:            "Rs. 2,999.00",
      due_date:          "January 31, 2026",
      payment_date:      "January 15, 2026",
      company_name:      "Noehost",
      domain:            "example.com",
      username:          "alexj001",
      password:          "Secure@Pass1",
      cpanel_url:        "https://server1.noehost.com:2083",
      ns1:               "ns1.noehost.com",
      ns2:               "ns2.noehost.com",
      webmail_url:       "https://server1.noehost.com/webmail",
      service_name:      "Business Hosting Plan",
      order_id:          "ORD-78542",
      reset_link:        "https://noehost.com/reset-password?token=sample-token-123",
      ticket_number:     "TKT-00149",
      ticket_subject:    "Help with DNS configuration",
      department:        "Technical Support",
      reply_body:        "Thank you for contacting Noehost Support. We have reviewed your request and updated your DNS settings. Please allow up to 24 hours for propagation to complete.",
      ticket_url:        "https://noehost.com/client/tickets/TKT-00149",
      client_area_url:   "https://noehost.com/client/invoices",
      reason:            "Overdue invoice (INV-2025-001)",
      cancel_date:       "January 31, 2026",
      termination_date:  "January 31, 2026",
      expiry_date:       "January 15, 2027",
      dns_url:           "https://noehost.com/client/domains",
      dashboard_url:     "https://noehost.com/client/dashboard",
      refund_amount:     "Rs. 999.00",
      refund_date:       "January 15, 2026",
      payment_method:    "Credit Card (Visa ****4242)",
    };

    const rendered = (s: string) => s
      .replace(/\{\{([a-z_]+)\}\}/g, (_, k) => samples[k] ?? `{{${k}}}`)
      .replace(/\{([a-z_]+)\}/g,     (_, k) => samples[k] ?? `{${k}}`);

    const subject = `[TEST] ${rendered(t.subject)}`;
    const body    = rendered(t.body);
    const isHtml  = body.trimStart().startsWith("<") || body.trimStart().startsWith("<!DOCTYPE");
    const html    = isHtml ? body : body.replace(/\n/g, "<br>");

    const result = await sendEmail({ to: testTo, subject, html });
    res.json({ ...result, sentTo: testTo });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

export default router;
