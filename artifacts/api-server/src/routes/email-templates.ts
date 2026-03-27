import { Router } from "express";
import { db } from "@workspace/db";
import { emailTemplatesTable } from "@workspace/db/schema";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { eq } from "drizzle-orm";
import { sendEmail } from "../lib/email.js";

const router = Router();

// ─── Layout & Helpers ─────────────────────────────────────────────────────────

/**
 * Master layout: white-bg card, centered Noehost logo header,
 * purple accent line, body content, Quick Support section, footer.
 * All email-client safe — uses only inline styles and HTML tables.
 */
function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Noehost</title>
</head>
<body style="margin:0;padding:0;background-color:#f2f2f2;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f2;padding:36px 16px">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e5e5e5">

        <!-- ───── HEADER: white bg, centered logo ───── -->
        <tr>
          <td style="background:#ffffff;padding:32px 40px 20px;text-align:center;border-bottom:3px solid #701AFE">
            <span style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;font-weight:800;color:#701AFE;letter-spacing:-0.5px">Noehost</span>
          </td>
        </tr>

        <!-- ───── BODY ───── -->
        <tr>
          <td style="padding:36px 40px 28px;color:#333333;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.75">
            ${content}
          </td>
        </tr>

        <!-- ───── WHATSAPP SUPPORT ───── -->
        <tr>
          <td style="background:#f0fff4;border-top:2px solid #25D366;padding:22px 40px;text-align:center">
            <p style="margin:0 0 12px;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#166534">
              &#128640; Need help? We reply within minutes!
            </p>
            <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto">
              <tr>
                <td style="padding-right:10px">
                  <a href="https://wa.me/923151711821?text=Hello%20Noehost%20Support%2C%20I%20have%20a%20query%20regarding%20my%20service."
                     style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:6px;font-size:14px;font-weight:700;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:0.2px">
                    &#128222; Contact Support on WhatsApp
                  </a>
                </td>
                <td>
                  <a href="https://noehost.com/client/tickets/new"
                     style="display:inline-block;background:#701AFE;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:6px;font-size:14px;font-weight:700;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">
                    &#127915; Open a Ticket
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ───── FOOTER ───── -->
        <tr>
          <td style="background:#f8f8f8;border-top:1px solid #e5e5e5;padding:24px 40px;text-align:center">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="padding-bottom:14px">
                  <a href="https://twitter.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:13px;font-weight:700">X</a>
                  <a href="https://facebook.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:14px;font-weight:700">f</a>
                  <a href="https://linkedin.com/company/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:11px;font-weight:700">in</a>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:8px">
                  <a href="https://noehost.com/kb" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Knowledge Base</a>
                  <span style="color:#cccccc;margin:0 8px">&middot;</span>
                  <a href="https://noehost.com/client/tickets" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Support</a>
                  <span style="color:#cccccc;margin:0 8px">&middot;</span>
                  <a href="https://noehost.com/unsubscribe" style="color:#999999;text-decoration:underline;font-size:12px;font-family:Inter,Arial,sans-serif">Unsubscribe</a>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:#aaaaaa;font-size:12px;font-family:Inter,Arial,sans-serif">&copy; 2026 Noehost. All rights reserved.</span>
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

/** Large primary CTA button */
function btn(label: string, url: string): string {
  return `
<table cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 4px">
  <tr>
    <td align="center" style="background:#701AFE;border-radius:6px">
      <a href="${url}" style="display:inline-block;padding:15px 44px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:0.2px">${label}</a>
    </td>
  </tr>
</table>`;
}

/** Secondary/outlined CTA button */
function btnOutline(label: string, url: string): string {
  return `
<table cellpadding="0" cellspacing="0" border="0" style="margin:10px auto 4px">
  <tr>
    <td align="center" style="background:#ffffff;border-radius:6px;border:2px solid #701AFE">
      <a href="${url}" style="display:inline-block;padding:12px 36px;color:#701AFE;font-size:14px;font-weight:600;text-decoration:none;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">${label}</a>
    </td>
  </tr>
</table>`;
}

/** Structured info table (purple-tinted header + rows) */
function infoTable(title: string, rows: Array<{ label: string; value: string }>): string {
  const rowsHtml = rows.map((r, i) => `
  <tr>
    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;${i > 0 ? "border-top:1px solid #eeeeee" : ""};width:40%">${r.label}</td>
    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;${i > 0 ? "border-top:1px solid #eeeeee" : ""};text-align:right;word-break:break-all">${r.value}</td>
  </tr>`).join("");

  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0d9ff;border-radius:6px;overflow:hidden;margin:20px 0">
  <tr>
    <td colspan="2" style="background:#701AFE;padding:10px 18px">
      <span style="font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1.2px;font-family:Inter,Arial,sans-serif">${title}</span>
    </td>
  </tr>
  ${rowsHtml}
</table>`;
}

/** Credential row — monospace value (for usernames, passwords, IPs) */
function cred(label: string, value: string): { label: string; value: string } {
  return { label, value: `<span style="font-family:'Courier New',Courier,monospace;color:#701AFE">${value}</span>` };
}

/** Monospace OTP code box */
function codeBox(label: string, value: string): string {
  return `
<table cellpadding="0" cellspacing="0" border="0" style="margin:28px auto">
  <tr>
    <td align="center" style="background:#f8f6ff;border:2px solid #701AFE;border-radius:8px;padding:18px 52px">
      <p style="margin:0 0 5px;font-size:11px;font-weight:700;color:#701AFE;text-transform:uppercase;letter-spacing:2px;font-family:Inter,Arial,sans-serif">${label}</p>
      <p style="margin:0;font-size:40px;font-weight:700;letter-spacing:10px;color:#222222;font-family:'Courier New',Courier,monospace">${value}</p>
    </td>
  </tr>
</table>`;
}

/** Urgent banner for suspension/termination */
function urgentBanner(icon: string, heading: string, subtext: string, color = "#d97706"): string {
  const bg = color === "#d97706" ? "#fffbeb" : "#fff7f7";
  const border = color === "#d97706" ? "#fde68a" : "#fecaca";
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bg};border:1px solid ${border};border-left:4px solid ${color};border-radius:4px;margin-bottom:24px">
  <tr>
    <td style="padding:16px 20px">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="font-size:26px;padding-right:14px;vertical-align:middle">${icon}</td>
          <td style="vertical-align:middle">
            <p style="margin:0 0 2px;font-size:15px;font-weight:700;color:${color};font-family:Inter,Arial,sans-serif">${heading}</p>
            <p style="margin:0;font-size:13px;color:#555555;font-family:Inter,Arial,sans-serif">${subtext}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

/** Success banner */
function successBanner(icon: string, heading: string, subtext: string): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fff4;border:1px solid #9ae6b4;border-left:4px solid #38a169;border-radius:4px;margin-bottom:24px">
  <tr>
    <td style="padding:16px 20px">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="font-size:26px;padding-right:14px;vertical-align:middle">${icon}</td>
          <td style="vertical-align:middle">
            <p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#276749;font-family:Inter,Arial,sans-serif">${heading}</p>
            <p style="margin:0;font-size:13px;color:#555555;font-family:Inter,Arial,sans-serif">${subtext}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

/** Info highlight box */
function infoBox(content: string): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f6ff;border:1px solid #e0d9ff;border-left:4px solid #701AFE;border-radius:4px;margin:20px 0">
  <tr>
    <td style="padding:14px 18px;font-size:13px;color:#444444;font-family:Inter,Arial,sans-serif;line-height:1.7">
      ${content}
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
    subject: "Verify your Noehost account",
    body: layout(`
<h2 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#222222;font-family:Inter,Arial,sans-serif">Verify your email address</h2>
<p style="margin:0 0 16px;color:#555555">Hi {{client_name}},</p>
<p style="margin:0 0 4px;color:#333333">Thanks for signing up with Noehost! Please use the verification code below to complete your registration. This code expires in <strong>10 minutes</strong>.</p>
${codeBox("Your Verification Code", "{{verification_code}}")}
<p style="color:#888888;font-size:13px;margin:20px 0 0">If you did not create a Noehost account, you can safely ignore this email.</p>
`),
    variables: ["{{client_name}}", "{{verification_code}}"],
  },

  // ── 2. Welcome ────────────────────────────────────────────────────────────
  {
    name: "Welcome to Noehost",
    slug: "welcome",
    subject: "Welcome to Noehost, {{client_name}}! Your account is ready",
    body: layout(`
${successBanner("🎉", "Welcome to Noehost!", "Your account has been created successfully")}
<p style="margin:0 0 14px;color:#333333">Hi {{client_name}},</p>
<p style="margin:0 0 18px;color:#333333">We're excited to have you on board. Here's what you can manage from your Noehost dashboard:</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px">
  <tr>
    <td style="padding:10px 0;border-bottom:1px solid #f0f0f0">
      <span style="display:inline-block;background:#f0ebff;border-radius:5px;padding:4px 10px;font-size:13px;color:#701AFE;font-weight:600;margin-right:10px">🌐</span>
      <span style="color:#333333;font-size:14px;font-family:Inter,Arial,sans-serif">Shared, Reseller &amp; VPS Hosting</span>
    </td>
  </tr>
  <tr>
    <td style="padding:10px 0;border-bottom:1px solid #f0f0f0">
      <span style="display:inline-block;background:#f0ebff;border-radius:5px;padding:4px 10px;font-size:13px;color:#701AFE;font-weight:600;margin-right:10px">🔒</span>
      <span style="color:#333333;font-size:14px;font-family:Inter,Arial,sans-serif">Domain Registration &amp; DNS Management</span>
    </td>
  </tr>
  <tr>
    <td style="padding:10px 0;border-bottom:1px solid #f0f0f0">
      <span style="display:inline-block;background:#f0ebff;border-radius:5px;padding:4px 10px;font-size:13px;color:#701AFE;font-weight:600;margin-right:10px">📄</span>
      <span style="color:#333333;font-size:14px;font-family:Inter,Arial,sans-serif">Invoices, Payments &amp; Billing (PKR)</span>
    </td>
  </tr>
  <tr>
    <td style="padding:10px 0">
      <span style="display:inline-block;background:#f0ebff;border-radius:5px;padding:4px 10px;font-size:13px;color:#701AFE;font-weight:600;margin-right:10px">🛡️</span>
      <span style="color:#333333;font-size:14px;font-family:Inter,Arial,sans-serif">24/7 Expert Support via Ticket &amp; WhatsApp</span>
    </td>
  </tr>
</table>
${btn("Go to My Dashboard", "{{dashboard_url}}")}
`),
    variables: ["{{client_name}}", "{{dashboard_url}}"],
  },

  // ── 3. Invoice Created ────────────────────────────────────────────────────
  {
    name: "Invoice Generated",
    slug: "invoice-created",
    subject: "Invoice #{{invoice_number}} — Rs. {{amount}} Due on {{due_date}}",
    body: layout(`
<h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#222222;font-family:Inter,Arial,sans-serif">Invoice Ready for Payment</h2>
<p style="margin:0 0 16px;color:#555555;font-size:14px">Dear <strong>{{client_name}}</strong>,</p>
<p style="margin:0 0 16px;color:#444444;font-size:14px;line-height:1.6">A new invoice has been generated for your Noehost account. Please review the details below and complete your payment before the due date to avoid any service interruption.</p>
${infoTable("Invoice Summary", [
  { label: "Invoice Number", value: `<strong style="color:#701AFE">#{{invoice_number}}</strong>` },
  { label: "Amount Due", value: `<span style="color:#701AFE;font-size:16px;font-weight:700">Rs. {{amount}}</span>` },
  { label: "Due Date", value: `<span style="color:#d97706;font-weight:600">{{due_date}}</span>` },
  { label: "Status", value: `<span style="background:#fee2e2;color:#dc2626;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:700">UNPAID</span>` },
])}
${btn("Pay Invoice Now →", "{{client_area_url}}")}
<p style="color:#888888;font-size:12px;margin:16px 0 0;text-align:center">The PDF invoice is attached to this email for your records.<br>Accepted: Bank Transfer · JazzCash · EasyPaisa · Card</p>
`),
    variables: ["{{client_name}}", "{{invoice_id}}", "{{invoice_number}}", "{{amount}}", "{{due_date}}", "{{client_area_url}}"],
  },

  // ── 4. Invoice Paid ───────────────────────────────────────────────────────
  {
    name: "Payment Confirmation",
    slug: "invoice-paid",
    subject: "Payment Confirmed — Invoice #{{invoice_id}} ✓",
    body: layout(`
${successBanner("✅", "Payment Received", "Your invoice has been paid successfully")}
<p style="margin:0 0 14px;color:#333333">Hi {{client_name}},</p>
<p style="margin:0 0 4px;color:#333333">We have successfully received your payment. Here is your receipt for your records:</p>
${infoTable("Payment Receipt", [
  { label: "Invoice Number", value: "#{{invoice_id}}" },
  { label: "Amount Paid", value: `<span style="color:#38a169;font-size:15px;font-weight:700">Rs. {{amount}}</span>` },
  { label: "Payment Date", value: "{{payment_date}}" },
  { label: "Status", value: `<span style="color:#38a169;font-weight:700">&#10003; Paid</span>` },
])}
${btnOutline("Download Receipt", "https://noehost.com/client/invoices")}
<p style="color:#888888;font-size:13px;margin:20px 0 0;text-align:center">Your services are now active. Thank you for choosing Noehost!</p>
`),
    variables: ["{{client_name}}", "{{invoice_id}}", "{{amount}}", "{{payment_date}}"],
  },

  // ── 5. Order Confirmed ────────────────────────────────────────────────────
  {
    name: "Order Confirmation",
    slug: "order-created",
    subject: "Order Confirmed — {{service_name}} is being set up",
    body: layout(`
${successBanner("🛒", "Order Received!", "We're setting up your service now")}
<p style="margin:0 0 14px;color:#333333">Hi {{client_name}},</p>
<p style="margin:0 0 4px;color:#333333">Thank you for your order! Our team is provisioning your service. You will receive a separate email with your full login credentials once the account is activated.</p>
${infoTable("Order Details", [
  { label: "Order Number", value: "#{{order_id}}" },
  { label: "Service", value: "{{service_name}}" },
  { label: "Domain", value: `<span style="color:#701AFE">{{domain}}</span>` },
  { label: "Status", value: `<span style="color:#d97706;font-weight:600">&#8987; Provisioning</span>` },
])}
${infoBox("<strong style='color:#701AFE'>&#9889; What happens next?</strong><br>Your account is being created automatically. Expect your hosting credentials in the next few minutes. Domain propagation may take 24–48 hours after that.")}
${btn("Track Order Status", "https://noehost.com/client/orders")}
`),
    variables: ["{{client_name}}", "{{service_name}}", "{{domain}}", "{{order_id}}"],
  },

  // ── 5a. Payment Under Review (Manual Gateways) ───────────────────────────
  {
    name: "Payment Under Review",
    slug: "payment-under-review",
    subject: "🔍 Payment Received — Your Order is Under Review — {{company_name}}",
    body: layout(`
${urgentBanner("🔍", "Payment Under Review", "Our team will verify and activate your service within 24 hours", "#d97706")}
<p style="margin:0 0 14px;color:#333333">Dear <strong>{{client_name}}</strong>,</p>
<p style="margin:0 0 16px;color:#333333">
  Thank you for your order! We have received your payment details for Invoice
  <strong>#{{invoice_number}}</strong> via <strong>{{payment_method}}</strong>.
  Your order is currently <span style="color:#d97706;font-weight:700">Under Review</span> —
  our team is verifying your payment and will activate your service shortly.
</p>

${infoTable("Order Details", [
  { label: "Invoice #", value: `<strong>#{{invoice_number}}</strong>` },
  { label: "Service", value: "{{service_name}}" },
  { label: "Domain", value: `<span style="color:#701AFE">{{domain}}</span>` },
  { label: "Amount", value: `<span style="color:#701AFE;font-weight:700">Rs. {{amount}}</span>` },
  { label: "Payment Method", value: "{{payment_method}}" },
  { label: "Status", value: `<span style="color:#d97706;font-weight:600">&#8987; Pending Review</span>` },
])}

${infoBox(`<strong>&#128336; What happens next?</strong><br>
1. Our team will verify your payment within <strong>2–24 hours</strong>.<br>
2. Once verified, your service will be activated and you'll receive a separate confirmation email.<br>
3. If payment cannot be confirmed, we will contact you at this email address.`)}

${btn("View Invoice →", "{{view_invoice_url}}")}
`),
    variables: ["{{client_name}}", "{{invoice_number}}", "{{service_name}}", "{{domain}}", "{{amount}}", "{{payment_method}}", "{{view_invoice_url}}", "{{company_name}}"],
  },

  // ── 6. Shared Hosting Activated ───────────────────────────────────────────
  {
    name: "Shared Hosting Activated",
    slug: "hosting-created",
    subject: "🚀 Your Hosting Account is Ready — {{domain}}",
    body: layout(`
${successBanner("🚀", "Your Shared Hosting is Live!", "Your account has been activated and is ready to use")}
<p style="margin:0 0 14px;color:#333333">Hi {{client_name}},</p>
<p style="margin:0 0 4px;color:#333333">Your hosting account for <strong>{{domain}}</strong> is fully set up. Below are your login details — please keep them safe and do not share them with anyone.</p>

${infoTable("Control Panel Credentials", [
  { label: "Domain Name", value: `<span style="color:#701AFE">{{domain}}</span>` },
  cred("cPanel Username", "{{username}}"),
  cred("cPanel Password", "{{password}}"),
  { label: "cPanel URL", value: `<a href="{{cpanel_url}}" style="color:#701AFE;text-decoration:none">{{cpanel_url}}</a>` },
  { label: "Webmail URL", value: `<a href="{{webmail_url}}" style="color:#701AFE;text-decoration:none">{{webmail_url}}</a>` },
])}

${infoTable("Nameservers (Update at Your Domain Registrar)", [
  cred("Primary NS", "{{ns1}}"),
  cred("Secondary NS", "{{ns2}}"),
])}

<p style="margin:0 0 4px;color:#555555;font-size:13px">&#9432; DNS propagation can take 24–48 hours. Your website will go live once propagation is complete.</p>
${btn("Login to cPanel", "{{cpanel_url}}")}
${btnOutline("Manage Hosting", "https://noehost.com/client/hosting")}
`),
    variables: ["{{client_name}}", "{{domain}}", "{{username}}", "{{password}}", "{{cpanel_url}}", "{{ns1}}", "{{ns2}}", "{{webmail_url}}"],
  },

  // ── 7a. Service Activated (Safepay auto-activation) ───────────────────────
  {
    name: "Service Activated — Auto-Activation",
    slug: "service-activated",
    subject: "🚀 Your Service is Now Active! - {{company_name}}",
    body: layout(`
${successBanner("🚀", "Your Service is Now Active!", "Your service has been automatically activated — no action needed")}
<p style="margin:0 0 14px;color:#333333">Dear <strong>{{client_name}}</strong>,</p>
<p style="margin:0 0 16px;color:#333333">
  We have successfully received your payment via Safepay for Invoice
  <strong>#{{invoice_number}}</strong>. Your hosting/domain service is now
  <span style="color:#16a34a;font-weight:700">Active</span>.
</p>

${infoTable("Service Details", [
  { label: "Domain / Service", value: `<strong style="color:#701AFE">{{domain}}</strong>` },
  { label: "Invoice #", value: `<strong>#{{invoice_number}}</strong>` },
  { label: "Status", value: `<span style="color:#16a34a;font-weight:700">&#10003; Active</span>` },
  { label: "Payment Method", value: "Safepay ⚡" },
])}

<p style="margin:0 0 16px;color:#333333">
  You can login to your dashboard to manage your services, view DNS records,
  access cPanel, and more.
</p>
${btn("Manage My Services →", "{{dashboard_url}}")}
<p style="margin:16px 0 0;color:#888888;font-size:13px;text-align:center">
  Thank you for choosing <strong>{{company_name}}</strong>! 🎉
</p>
`),
    variables: ["{{client_name}}", "{{invoice_number}}", "{{domain}}", "{{cpanel_url}}", "{{dashboard_url}}", "{{company_name}}"],
  },

  // ── 7b. Domain Registered ─────────────────────────────────────────────────
  {
    name: "Domain Registration Successful",
    slug: "domain-registered",
    subject: "🎉 Your domain {{domain}} is now registered!",
    body: layout(`
${successBanner("🌐", "Domain Registered Successfully!", "Your domain is now active and under your control")}
<p style="margin:0 0 14px;color:#333333">Hi {{client_name}},</p>
<p style="margin:0 0 4px;color:#333333">Congratulations! Your domain <strong style="color:#701AFE">{{domain}}</strong> has been successfully registered and is now active.</p>

${infoTable("Domain Details", [
  { label: "Domain Name", value: `<strong style="color:#701AFE">{{domain}}</strong>` },
  { label: "Registration Date", value: "{{registration_date}}" },
  { label: "Next Due Date", value: "{{next_due_date}}" },
  { label: "Expiry Date", value: "{{expiry_date}}" },
  { label: "Status", value: `<span style="color:#38a169;font-weight:700">&#10003; Active</span>` },
  { label: "Auto-Renew", value: "Enabled" },
])}

${infoTable("Nameservers", [
  cred("Primary NS", "{{ns1}}"),
  cred("Secondary NS", "{{ns2}}"),
])}

${infoBox("<strong style='color:#701AFE'>&#128161; Next Steps</strong><br>Point your domain to your hosting by setting the nameservers above, or use our DNS Zone Editor to manage A, CNAME, and MX records directly from your client area.")}
${btn("Manage DNS Settings", "{{dns_url}}")}
`),
    variables: ["{{client_name}}", "{{domain}}", "{{registration_date}}", "{{next_due_date}}", "{{expiry_date}}", "{{ns1}}", "{{ns2}}", "{{dns_url}}"],
  },

  // ── 8. Password Reset ─────────────────────────────────────────────────────
  {
    name: "Password Reset",
    slug: "password-reset",
    subject: "Reset your Noehost password",
    body: layout(`
<h2 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#222222;font-family:Inter,Arial,sans-serif">Reset Your Password</h2>
<p style="margin:0 0 14px;color:#555555">Hi {{client_name}},</p>
<p style="margin:0 0 4px;color:#333333">We received a request to reset the password for your Noehost account. Click the button below to create a new password. This link expires in <strong>1 hour</strong>.</p>
${btn("Reset My Password", "{{reset_link}}")}
${infoBox(`<strong>Button not working?</strong> Copy and paste this link into your browser:<br><a href="{{reset_link}}" style="color:#701AFE;text-decoration:none;word-break:break-all;font-size:12px">{{reset_link}}</a>`)}
<p style="color:#e53e3e;font-size:13px;margin:16px 0 0">&#9888; If you did not request a password reset, please ignore this email. Your password will not be changed.</p>
`),
    variables: ["{{client_name}}", "{{reset_link}}"],
  },

  // ── 9. Support Ticket Reply ───────────────────────────────────────────────
  {
    name: "Support Ticket Reply",
    slug: "ticket-reply",
    subject: "Re: [#{{ticket_number}}] {{ticket_subject}}",
    body: layout(`
<h2 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#222222;font-family:Inter,Arial,sans-serif">New Reply to Your Support Ticket</h2>
<p style="margin:0 0 14px;color:#555555">Hi {{client_name}},</p>
<p style="margin:0 0 4px;color:#333333">Our support team has responded to your ticket. Here's a summary:</p>
${infoTable("Ticket Info", [
  { label: "Ticket Number", value: "#{{ticket_number}}" },
  { label: "Subject", value: "{{ticket_subject}}" },
  { label: "Department", value: `<span style="color:#701AFE">{{department}}</span>` },
])}
<p style="margin:4px 0 8px;font-size:13px;font-weight:700;color:#701AFE;text-transform:uppercase;letter-spacing:0.8px;font-family:Inter,Arial,sans-serif">&#128172; Staff Reply</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafafa;border-left:4px solid #701AFE;border-radius:0 6px 6px 0;margin-bottom:20px">
  <tr>
    <td style="padding:16px 20px;color:#333333;font-size:14px;font-family:Inter,Arial,sans-serif;line-height:1.75">{{reply_body}}</td>
  </tr>
</table>
${btn("Reply to Ticket", "{{ticket_url}}")}
`),
    variables: ["{{client_name}}", "{{ticket_number}}", "{{ticket_subject}}", "{{department}}", "{{reply_body}}", "{{ticket_url}}"],
  },

  // ── 10. Service Suspended ─────────────────────────────────────────────────
  {
    name: "Service Suspended",
    slug: "service-suspended",
    subject: "URGENT: Your service for {{domain}} has been suspended",
    body: layout(`
${urgentBanner("⚠️", "Urgent: Service Suspended", "Action is required to restore your service", "#d97706")}
<p style="margin:0 0 14px;color:#333333">Hi {{client_name}},</p>
<p style="margin:0 0 4px;color:#333333">Your hosting service for <strong>{{domain}}</strong> has been temporarily suspended. Your data remains intact and will be restored immediately once the issue is resolved.</p>
${infoTable("Suspension Details", [
  { label: "Domain", value: "{{domain}}" },
  { label: "Reason", value: `<span style="color:#d97706;font-weight:600">{{reason}}</span>` },
  { label: "Status", value: `<span style="color:#d97706;font-weight:700">&#9888; Suspended</span>` },
])}
<p style="margin:4px 0 16px;color:#333333"><strong>To reactivate your service:</strong> please pay any outstanding invoices or contact our support team to resolve the issue.</p>
${btn("Reactivate My Service", "{{client_area_url}}")}
`),
    variables: ["{{client_name}}", "{{domain}}", "{{reason}}", "{{client_area_url}}"],
  },

  // ── 11. Service Terminated ────────────────────────────────────────────────
  {
    name: "Service Terminated",
    slug: "service-terminated",
    subject: "Notice: Your service for {{domain}} has been terminated",
    body: layout(`
${urgentBanner("🗑️", "Notice: Service Terminated", "This is a permanent action — all data has been removed", "#dc2626")}
<p style="margin:0 0 14px;color:#333333">Hi {{client_name}},</p>
<p style="margin:0 0 4px;color:#333333">We are writing to inform you that your hosting service for <strong>{{domain}}</strong> has been permanently terminated as of <strong>{{termination_date}}</strong>.</p>
${infoTable("Termination Details", [
  { label: "Service", value: "{{service_name}}" },
  { label: "Domain", value: "{{domain}}" },
  { label: "Termination Date", value: "{{termination_date}}" },
  { label: "Status", value: `<span style="color:#dc2626;font-weight:700">&#10005; Terminated</span>` },
])}
${infoBox("<strong style='color:#dc2626'>&#9888; Important:</strong> All associated files, databases, email accounts, and configurations have been permanently deleted and cannot be recovered. If you believe this was done in error, please contact support immediately.")}
${btn("Contact Support", "https://noehost.com/client/tickets/new")}
`),
    variables: ["{{client_name}}", "{{domain}}", "{{service_name}}", "{{termination_date}}"],
  },

  // ── 12. Service Cancelled ─────────────────────────────────────────────────
  {
    name: "Cancellation Confirmation",
    slug: "service-cancelled",
    subject: "Cancellation Confirmed — {{service_name}}",
    body: layout(`
<h2 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#222222;font-family:Inter,Arial,sans-serif">Cancellation Confirmed</h2>
<p style="margin:0 0 14px;color:#555555">Hi {{client_name}},</p>
<p style="margin:0 0 4px;color:#333333">We've processed your cancellation request. We're sorry to see you go — if there's anything we could have done better, please let us know.</p>
${infoTable("Cancellation Details", [
  { label: "Service", value: "{{service_name}}" },
  { label: "Domain", value: "{{domain}}" },
  { label: "Cancellation Date", value: "{{cancel_date}}" },
  { label: "Status", value: `<span style="color:#555555;font-weight:600">&#10003; Cancellation Confirmed</span>` },
])}
${infoBox("<strong style='color:#701AFE'>You're always welcome back!</strong><br>If you change your mind, you can place a new order anytime from your client area. We'd love to serve you again.")}
${btn("Explore New Plans", "https://noehost.com/client/new-order")}
`),
    variables: ["{{client_name}}", "{{domain}}", "{{service_name}}", "{{cancel_date}}"],
  },

  // ── 13. Refund Processed ─────────────────────────────────────────────────
  {
    name: "Refund Processed",
    slug: "refund-processed",
    subject: "Refund of Rs. {{refund_amount}} has been processed",
    body: layout(`
${successBanner("💰", "Refund Processed", "Your refund is on its way")}
<p style="margin:0 0 14px;color:#333333">Hi {{client_name}},</p>
<p style="margin:0 0 4px;color:#333333">We have successfully processed your refund. Here are the details:</p>
${infoTable("Refund Details", [
  { label: "Refund Amount", value: `<span style="color:#38a169;font-size:15px;font-weight:700">Rs. {{refund_amount}}</span>` },
  { label: "Related Invoice", value: "#{{invoice_id}}" },
  { label: "Refund Date", value: "{{refund_date}}" },
  { label: "Payment Method", value: "{{payment_method}}" },
])}
${infoBox("<strong>&#128336; Processing Time:</strong> Refunds typically appear in your account within 5–10 business days, depending on your bank or payment provider.")}
${btn("View Billing History", "https://noehost.com/client/invoices")}
`),
    variables: ["{{client_name}}", "{{refund_amount}}", "{{invoice_id}}", "{{refund_date}}", "{{payment_method}}"],
  },

  // ── 14. Reseller Hosting Activated (NEW) ─────────────────────────────────
  {
    name: "Reseller Hosting Activated",
    slug: "reseller-hosting-created",
    subject: "🚀 Your Reseller Hosting Account is Ready — {{domain}}",
    body: layout(`
${successBanner("🏢", "Reseller Hosting Account Live!", "Your WHM control panel is ready to use")}
<p style="margin:0 0 14px;color:#333333">Hi {{client_name}},</p>
<p style="margin:0 0 4px;color:#333333">Your Reseller Hosting account has been provisioned. You now have full WHM access to create and manage hosting accounts for your clients.</p>

${infoTable("WHM Login Details", [
  cred("WHM Username", "{{username}}"),
  cred("WHM Password", "{{password}}"),
  { label: "WHM URL", value: `<a href="{{whm_url}}" style="color:#701AFE;text-decoration:none">{{whm_url}}</a>` },
  { label: "cPanel URL", value: `<a href="{{cpanel_url}}" style="color:#701AFE;text-decoration:none">{{cpanel_url}}</a>` },
])}

${infoTable("Account Resources", [
  { label: "Max Accounts", value: `<strong>{{max_accounts}}</strong> hosting accounts` },
  { label: "Disk Space", value: `<strong>{{disk_space}}</strong>` },
  { label: "Bandwidth", value: `<strong>{{bandwidth}}</strong>` },
  { label: "IP Address", value: `<span style="font-family:'Courier New',monospace;color:#701AFE">{{server_ip}}</span>` },
])}

${infoTable("Nameservers (Point your clients' domains here)", [
  cred("NS1", "{{ns1}}"),
  cred("NS2", "{{ns2}}"),
])}

${infoBox(`<strong style='color:#701AFE'>&#128161; How to create your first client account:</strong><br>
1. Log into WHM at <a href="{{whm_url}}" style="color:#701AFE;text-decoration:none">{{whm_url}}</a><br>
2. Go to <strong>Account Functions → Create a New Account</strong><br>
3. Fill in the domain, username, and password for your client<br>
4. Assign a hosting package and click <strong>Create</strong><br>
Your client will receive their cPanel credentials automatically.`)}
${btn("Login to WHM", "{{whm_url}}")}
`),
    variables: ["{{client_name}}", "{{username}}", "{{password}}", "{{whm_url}}", "{{cpanel_url}}", "{{max_accounts}}", "{{disk_space}}", "{{bandwidth}}", "{{server_ip}}", "{{ns1}}", "{{ns2}}"],
  },

  // ── 15. VPS Server Activated (NEW) ───────────────────────────────────────
  {
    name: "VPS Server Activated",
    slug: "vps-created",
    subject: "🖥️ Your VPS Server is Online — {{server_hostname}}",
    body: layout(`
${successBanner("🖥️", "VPS Server is Online!", "Your dedicated server has been provisioned")}
<p style="margin:0 0 14px;color:#333333">Hi {{client_name}},</p>
<p style="margin:0 0 4px;color:#333333">Your VPS server has been provisioned and is now online. Below are your server credentials. Keep these details secure — do not share them with anyone.</p>

${infoTable("Server Access Details", [
  cred("Dedicated IP Address", "{{server_ip}}"),
  cred("SSH Port", "{{ssh_port}}"),
  cred("Root Username", "root"),
  cred("Root Password", "{{root_password}}"),
  { label: "Hostname", value: `<span style="font-family:'Courier New',monospace;color:#701AFE">{{server_hostname}}</span>` },
  { label: "Operating System", value: "{{os}}" },
])}

${infoTable("Server Resources", [
  { label: "CPU Cores", value: "{{cpu_cores}}" },
  { label: "RAM", value: "{{ram}}" },
  { label: "Disk Space (SSD)", value: "{{disk_space}}" },
  { label: "Monthly Bandwidth", value: "{{bandwidth}}" },
])}

${infoBox(`<strong style='color:#701AFE'>&#128295; How to connect to your VPS:</strong><br>
<strong>Linux/Mac:</strong> Open Terminal and run:<br>
<code style="font-family:'Courier New',monospace;background:#f0ebff;padding:2px 6px;border-radius:3px;font-size:13px">ssh root@{{server_ip}} -p {{ssh_port}}</code><br><br>
<strong>Windows:</strong> Use <a href="https://www.putty.org" style="color:#701AFE;text-decoration:none">PuTTY</a> with IP <code style="font-family:'Courier New',monospace">{{server_ip}}</code> and port <code style="font-family:'Courier New',monospace">{{ssh_port}}</code>.<br><br>
<strong>Reboot/Console:</strong> Log into your client area to access the VPS console, reboot, or reinstall the OS.`)}
${btn("Manage VPS", "{{vps_panel_url}}")}
`),
    variables: ["{{client_name}}", "{{server_ip}}", "{{ssh_port}}", "{{root_password}}", "{{server_hostname}}", "{{os}}", "{{cpu_cores}}", "{{ram}}", "{{disk_space}}", "{{bandwidth}}", "{{vps_panel_url}}"],
  },

  // ── 16. Domain Expiry Warning (30 / 7 / 1 day) ───────────────────────────
  {
    name: "Domain Expiry Warning",
    slug: "domain-expiry-warning",
    subject: "⚠️ Your domain {{domain_name}} expires in {{days_remaining}} day(s) — Renew Now",
    body: layout(`
${urgentBanner("⏳", "Domain Expiring Soon — Action Required", "Renew now to keep your domain and avoid losing it", "#d97706")}
<p style="margin:0 0 14px;color:#333333">Hi {{client_name}},</p>
<p style="margin:0 0 4px;color:#333333">This is a reminder that your domain <strong style="color:#701AFE">{{domain_name}}</strong> is scheduled to expire on <strong>{{expiry_date}}</strong> — that's in just <strong style="color:#d97706">{{days_remaining}} day(s)</strong>.</p>
<p style="margin:12px 0 4px;color:#555555">If you do not renew before the expiry date, your domain will become unavailable and may be released for public registration.</p>

${infoTable("Domain Details", [
  { label: "Domain Name", value: `<strong style="color:#701AFE">{{domain_name}}</strong>` },
  { label: "Expiry Date", value: `<span style="color:#d97706;font-weight:700">{{expiry_date}}</span>` },
  { label: "Days Remaining", value: `<span style="color:#d97706;font-weight:700">{{days_remaining}} day(s)</span>` },
  { label: "Renewal Price", value: "{{renewal_price}}" },
])}

${btn("Renew My Domain Now", "{{renew_url}}")}
${infoBox(`<strong style='color:#d97706'>&#9888; Don't wait!</strong> Domain expiry is irreversible. Once expired, the domain enters a grace/redemption period which costs significantly more to recover. Renew now to avoid any interruption.`)}
`),
    variables: ["{{client_name}}", "{{domain_name}}", "{{expiry_date}}", "{{days_remaining}}", "{{renewal_price}}", "{{renew_url}}"],
  },

  // ── 17. WordPress Installation Success ───────────────────────────────────
  {
    name: "WordPress Installation Successful",
    slug: "wordpress-installed",
    subject: "✅ WordPress Installed on {{domain}} — Ready to Go!",
    body: layout(`
${successBanner("📝", "WordPress is Installed!", "Your site is live and ready to customize")}
<p style="margin:0 0 14px;color:#333333">Hi {{client_name}},</p>
<p style="margin:0 0 4px;color:#333333">WordPress has been successfully installed on your domain <strong style="color:#701AFE">{{domain}}</strong>. You can now log into your WordPress dashboard and start building your website.</p>

${infoTable("WordPress Site Details", [
  { label: "Site URL", value: `<a href="{{site_url}}" style="color:#701AFE;text-decoration:none">{{site_url}}</a>` },
  { label: "WP Admin URL", value: `<a href="{{wp_admin_url}}" style="color:#701AFE;text-decoration:none">{{wp_admin_url}}</a>` },
  cred("Admin Username", "{{wp_username}}"),
  cred("Admin Password", "{{wp_password}}"),
  { label: "WordPress Version", value: "{{wp_version}}" },
])}

${infoBox(`<strong style='color:#701AFE'>&#128161; Getting Started Tips:</strong><br>
1. Log into your admin panel and change your password immediately<br>
2. Go to <strong>Appearance → Themes</strong> to install a theme<br>
3. Install essential plugins: Yoast SEO, WooCommerce, Wordfence Security<br>
4. Go to <strong>Settings → General</strong> to configure your site title and tagline`)}
${btn("View My Website", "{{site_url}}")}
${btnOutline("Go to WP Admin", "{{wp_admin_url}}")}
`),
    variables: ["{{client_name}}", "{{domain}}", "{{site_url}}", "{{wp_admin_url}}", "{{wp_username}}", "{{wp_password}}", "{{wp_version}}"],
  },

];

// ─── Seeder ───────────────────────────────────────────────────────────────────
/**
 * Insert missing default templates and force-refresh all existing default
 * templates to the latest design. Admin-created custom slugs are never touched.
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

  for (const t of DEFAULT_TEMPLATES) {
    if (existingMap.has(t.slug)) {
      await db
        .update(emailTemplatesTable)
        .set({ body: t.body, subject: t.subject, name: t.name, variables: t.variables })
        .where(eq(emailTemplatesTable.slug, t.slug));
    }
  }

  console.log(`[TEMPLATES] ${toInsert.length} new | ${DEFAULT_TEMPLATES.length} refreshed`);
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
      client_name:       "Ali Hassan",
      verification_code: "847291",
      invoice_id:        "INV-2026-001",
      amount:            "2,999.00",
      refund_amount:     "999.00",
      due_date:          "31 January 2026",
      payment_date:      "15 January 2026",
      company_name:      "Noehost",
      domain:            "example.com",
      registration_date: "15 January 2026",
      expiry_date:       "15 January 2027",
      username:          "alihassan01",
      password:          "Secure@Pass1",
      cpanel_url:        "https://server1.noehost.com:2083",
      whm_url:           "https://server1.noehost.com:2087",
      ns1:               "ns1.noehost.com",
      ns2:               "ns2.noehost.com",
      webmail_url:       "https://server1.noehost.com/webmail",
      service_name:      "Business Hosting Plan",
      order_id:          "ORD-78542",
      reset_link:        "https://noehost.com/reset-password?token=sample-token-123",
      ticket_number:     "TKT-00149",
      ticket_subject:    "Help with DNS configuration",
      department:        "Technical Support",
      reply_body:        "Thank you for contacting Noehost Support. We have reviewed your DNS configuration and updated the A records for your domain. Please allow up to 24 hours for full propagation.",
      ticket_url:        "https://noehost.com/client/tickets/TKT-00149",
      client_area_url:   "https://noehost.com/client/invoices",
      reason:            "Overdue invoice (INV-2026-001)",
      cancel_date:       "31 January 2026",
      termination_date:  "31 January 2026",
      dns_url:           "https://noehost.com/client/domains",
      dashboard_url:     "https://noehost.com/client/dashboard",
      refund_date:       "15 January 2026",
      payment_method:    "JazzCash (****4242)",
      // Reseller
      max_accounts:      "50",
      disk_space:        "100 GB SSD",
      bandwidth:         "1 TB",
      server_ip:         "198.51.100.42",
      // VPS
      ssh_port:          "22",
      root_password:     "V@ps3cur3!",
      server_hostname:   "vps1.noehost.com",
      os:                "Ubuntu 22.04 LTS",
      cpu_cores:         "4 vCores",
      ram:               "8 GB DDR4",
      vps_panel_url:     "https://noehost.com/client/vps",
      // WordPress
      site_url:          "https://example.com",
      wp_admin_url:      "https://example.com/wp-admin",
      wp_username:       "admin",
      wp_password:       "WP@Secure1",
      wp_version:        "6.7.1",
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
