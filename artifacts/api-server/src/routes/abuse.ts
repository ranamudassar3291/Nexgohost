import { Router } from "express";
import { db } from "@workspace/db";
import {
  abuseReportsTable, abuseActionsTable,
  hostingServicesTable, usersTable, ticketsTable, ticketMessagesTable, serversTable,
} from "@workspace/db/schema";
import { eq, desc, sql, and, or, count } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { sendEmail } from "../lib/email.js";
import { cpanelSuspend, cpanelUnsuspend } from "../lib/cpanel.js";
import { createNotification } from "../lib/notifications.js";
import { emitActivity } from "../lib/activity.js";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildReportNumber(): string {
  return `ABU-${Date.now()}`;
}

async function logAction(
  reportId: string,
  actionType: string,
  actionNote: string,
  performedBy: string,
  performedByEmail?: string,
) {
  try {
    await db.insert(abuseActionsTable).values({
      reportId,
      actionType,
      actionNote,
      performedBy,
      performedByEmail: performedByEmail ?? null,
    });
  } catch { /* non-fatal */ }
}

/** Very lightweight AI-style keyword analysis */
function analyzeEvidence(evidence: string, abuseType: string): { isValid: boolean; notes: string } {
  const text = evidence.toLowerCase();
  const spamSignals = ["spam", "unsolicited", "bulk mail", "phishing", "scam", "fraudulent", "malware", "ransomware", "botnet", "ddos", "flood", "attack", "illegal", "hack", "exploit", "copyright", "dmca", "infringing"];
  const falsePositiveSignals = ["newsletter", "opt-in", "subscribed", "permission", "double opt", "unsubscribe"];

  const hitSpam = spamSignals.filter(s => text.includes(s)).length;
  const hitFalse = falsePositiveSignals.filter(s => text.includes(s)).length;
  const typeBoost = ["phishing", "malware", "ddos", "copyright"].includes(abuseType) ? 2 : 0;

  const score = hitSpam + typeBoost - hitFalse;
  const isValid = score >= 1;

  const signals = spamSignals.filter(s => text.includes(s));
  const notes = isValid
    ? `Automated analysis flagged ${signals.length} abuse signal(s): ${signals.slice(0, 5).join(", ")}. Manual review recommended.`
    : `Automated analysis found ${hitFalse} legitimate opt-in signal(s) and only ${hitSpam} abuse signal(s). May be a false positive. Manual review recommended.`;

  return { isValid, notes };
}

/** Build professional HTML abuse warning email */
function buildAbuseWarningHtml(opts: {
  companyName: string;
  brandColor: string;
  logoUrl: string;
  clientName: string;
  domain: string;
  abuseType: string;
  reportNumber: string;
  deadline: string;
  supportUrl: string;
  websiteUrl: string;
}): string {
  const typeLabel = opts.abuseType.charAt(0).toUpperCase() + opts.abuseType.slice(1);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Abuse Warning — Action Required</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <!-- Header -->
      <tr><td style="background:${opts.brandColor};padding:32px 40px;text-align:center;">
        ${opts.logoUrl ? `<img src="${opts.logoUrl}" alt="${opts.companyName}" style="height:40px;margin-bottom:16px;display:block;margin-left:auto;margin-right:auto;">` : ""}
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">${opts.companyName}</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Hosting Management Platform</p>
      </td></tr>
      <!-- Alert Banner -->
      <tr><td style="background:#fff3cd;border-left:4px solid #f59e0b;padding:16px 40px;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="padding-right:12px;vertical-align:middle;font-size:24px;">⚠️</td>
          <td style="vertical-align:middle;">
            <p style="margin:0;color:#92400e;font-size:14px;font-weight:700;">Abuse Complaint — Immediate Action Required</p>
            <p style="margin:4px 0 0;color:#b45309;font-size:12px;">Report #${opts.reportNumber} · Type: ${typeLabel}</p>
          </td>
        </tr></table>
      </td></tr>
      <!-- Body -->
      <tr><td style="padding:36px 40px;">
        <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">Dear <strong>${opts.clientName}</strong>,</p>
        <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
          We have received a formal abuse complaint concerning your hosting service for the domain <strong>${opts.domain}</strong>.
          The complaint has been categorized as <strong>${typeLabel}</strong>.
        </p>
        <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
          This is a <strong>warning notice</strong>. No action has been taken on your service yet.
          However, we require you to investigate and resolve this complaint within <strong>48 hours</strong>.
        </p>
        <!-- Timeline Box -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin:0 0 24px;">
          <tr><td style="padding:20px 24px;">
            <p style="margin:0 0 12px;color:#111827;font-size:14px;font-weight:700;">⏰ Enforcement Timeline</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="50%" style="padding:8px 0;border-bottom:1px solid #e5e7eb;">
                  <span style="color:#6b7280;font-size:12px;display:block;">Report Number</span>
                  <span style="color:#111827;font-size:14px;font-weight:600;">${opts.reportNumber}</span>
                </td>
                <td width="50%" style="padding:8px 0;border-bottom:1px solid #e5e7eb;">
                  <span style="color:#6b7280;font-size:12px;display:block;">Abuse Type</span>
                  <span style="color:#111827;font-size:14px;font-weight:600;">${typeLabel}</span>
                </td>
              </tr>
              <tr>
                <td width="50%" style="padding:8px 0;">
                  <span style="color:#6b7280;font-size:12px;display:block;">Affected Domain</span>
                  <span style="color:#111827;font-size:14px;font-weight:600;">${opts.domain}</span>
                </td>
                <td width="50%" style="padding:8px 0;">
                  <span style="color:#6b7280;font-size:12px;display:block;">Response Deadline</span>
                  <span style="color:#dc2626;font-size:14px;font-weight:700;">${opts.deadline}</span>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
        <!-- Steps -->
        <p style="margin:0 0 12px;color:#111827;font-size:14px;font-weight:700;">Required Actions:</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${["Immediately stop the reported activity on your server.", "Remove any offending content, scripts, or configurations.", "Reply to your abuse support ticket explaining the steps taken.", "If you believe this is a false report, provide evidence in your ticket response."].map((step, i) => `
          <tr>
            <td width="32" style="vertical-align:top;padding:6px 0;">
              <span style="display:inline-block;background:${opts.brandColor};color:#fff;border-radius:50%;width:22px;height:22px;font-size:12px;font-weight:700;text-align:center;line-height:22px;">${i + 1}</span>
            </td>
            <td style="padding:6px 0 6px 10px;color:#374151;font-size:14px;line-height:1.5;">${step}</td>
          </tr>`).join("")}
        </table>
        <!-- Warning -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin:24px 0;">
          <tr><td style="padding:16px 20px;">
            <p style="margin:0;color:#991b1b;font-size:13px;line-height:1.6;">
              🚫 <strong>Failure to respond</strong> by the deadline may result in immediate suspension of your hosting service without further notice.
            </p>
          </td></tr>
        </table>
        <!-- CTA -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;text-align:center;">
          <tr><td>
            <a href="${opts.supportUrl}" style="display:inline-block;background:${opts.brandColor};color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:700;letter-spacing:0.2px;">
              Respond to Abuse Ticket
            </a>
          </td></tr>
        </table>
        <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
          If you have any questions, please reply to this email or open a support ticket immediately.
        </p>
      </td></tr>
      <!-- Footer -->
      <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center;">
        <p style="margin:0 0 8px;color:#6b7280;font-size:12px;">
          This is an automated abuse notification from <strong>${opts.companyName}</strong>.
        </p>
        <p style="margin:0;color:#9ca3af;font-size:11px;">
          © ${new Date().getFullYear()} ${opts.companyName} · <a href="${opts.websiteUrl}" style="color:#9ca3af;">${opts.websiteUrl}</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** Build professional HTML abuse suspension email */
function buildAbuseSuspensionHtml(opts: {
  companyName: string;
  brandColor: string;
  logoUrl: string;
  clientName: string;
  domain: string;
  abuseType: string;
  reportNumber: string;
  reason: string;
  supportUrl: string;
  websiteUrl: string;
}): string {
  const typeLabel = opts.abuseType.charAt(0).toUpperCase() + opts.abuseType.slice(1);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Service Suspended — Abuse Policy Violation</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <!-- Header -->
      <tr><td style="background:#dc2626;padding:32px 40px;text-align:center;">
        ${opts.logoUrl ? `<img src="${opts.logoUrl}" alt="${opts.companyName}" style="height:40px;margin-bottom:16px;display:block;margin-left:auto;margin-right:auto;">` : ""}
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${opts.companyName}</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Hosting Management Platform</p>
      </td></tr>
      <!-- Alert Banner -->
      <tr><td style="background:#fee2e2;border-left:4px solid #dc2626;padding:16px 40px;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="padding-right:12px;vertical-align:middle;font-size:24px;">🚫</td>
          <td style="vertical-align:middle;">
            <p style="margin:0;color:#991b1b;font-size:14px;font-weight:700;">Service Suspended — Abuse Policy Violation</p>
            <p style="margin:4px 0 0;color:#b91c1c;font-size:12px;">Report #${opts.reportNumber} · Type: ${typeLabel}</p>
          </td>
        </tr></table>
      </td></tr>
      <!-- Body -->
      <tr><td style="padding:36px 40px;">
        <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">Dear <strong>${opts.clientName}</strong>,</p>
        <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
          Your hosting service for <strong>${opts.domain}</strong> has been <strong style="color:#dc2626;">suspended</strong> due to a verified abuse complaint.
        </p>
        <!-- Details Box -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin:0 0 24px;">
          <tr><td style="padding:20px 24px;">
            <p style="margin:0 0 12px;color:#111827;font-size:14px;font-weight:700;">📋 Suspension Details</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:6px 0;border-bottom:1px solid #e5e7eb;">
                <span style="color:#6b7280;font-size:12px;">Report Number:</span>
                <span style="color:#111827;font-size:14px;font-weight:600;float:right;">${opts.reportNumber}</span>
              </td></tr>
              <tr><td style="padding:6px 0;border-bottom:1px solid #e5e7eb;">
                <span style="color:#6b7280;font-size:12px;">Abuse Type:</span>
                <span style="color:#111827;font-size:14px;font-weight:600;float:right;">${typeLabel}</span>
              </td></tr>
              <tr><td style="padding:6px 0;border-bottom:1px solid #e5e7eb;">
                <span style="color:#6b7280;font-size:12px;">Affected Domain:</span>
                <span style="color:#111827;font-size:14px;font-weight:600;float:right;">${opts.domain}</span>
              </td></tr>
              <tr><td style="padding:6px 0;">
                <span style="color:#6b7280;font-size:12px;">Reason:</span>
                <span style="color:#dc2626;font-size:13px;font-weight:600;display:block;margin-top:4px;">${opts.reason}</span>
              </td></tr>
            </table>
          </td></tr>
        </table>
        <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
          To appeal this suspension or request reinstatement, please open a support ticket immediately with the following information:
        </p>
        <ul style="margin:0 0 24px;padding-left:20px;color:#374151;font-size:14px;line-height:2;">
          <li>A description of steps you have taken to resolve the abuse issue</li>
          <li>Evidence that the activity has been stopped</li>
          <li>Any relevant context that may explain the complaint</li>
        </ul>
        <!-- CTA -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;text-align:center;">
          <tr><td>
            <a href="${opts.supportUrl}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:700;">
              Open Appeal Ticket
            </a>
          </td></tr>
        </table>
        <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
          Our abuse team reviews all appeals within 24–48 hours. We take these matters seriously to maintain a safe hosting environment.
        </p>
      </td></tr>
      <!-- Footer -->
      <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center;">
        <p style="margin:0 0 8px;color:#6b7280;font-size:12px;">
          This is an automated suspension notification from <strong>${opts.companyName}</strong>.
        </p>
        <p style="margin:0;color:#9ca3af;font-size:11px;">
          © ${new Date().getFullYear()} ${opts.companyName} · <a href="${opts.websiteUrl}" style="color:#9ca3af;">${opts.websiteUrl}</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

async function getBranding() {
  const { settingsTable } = await import("@workspace/db/schema");
  const { getAppUrl, getClientUrl } = await import("../lib/app-url.js");
  try {
    const rows = await db.select().from(settingsTable);
    const map: Record<string, string> = {};
    for (const r of rows) if (r.key && r.value) map[r.key] = r.value;
    const appUrl = getAppUrl();
    const clientUrl = getClientUrl();
    const logoPath = map["branding_logo"] ?? null;
    return {
      companyName: map["site_name"] || map["smtp_from_name"] || "Noehost",
      brandColor: map["brand_primary_color"] || "#701AFE",
      logoUrl: logoPath ? `${appUrl}${logoPath}` : "",
      supportUrl: `${clientUrl}/tickets/new`,
      websiteUrl: map["brand_website"] || "https://noehost.com",
    };
  } catch {
    return { companyName: "Noehost", brandColor: "#701AFE", logoUrl: "", supportUrl: "/client/tickets/new", websiteUrl: "https://noehost.com" };
  }
}

// ─── Public: Submit abuse report ──────────────────────────────────────────────

router.post("/abuse/report", async (req, res) => {
  try {
    const { reporterEmail, reporterName, reporterOrg, abuseType, targetDomain, targetIp, evidenceLogs } = req.body;

    if (!reporterEmail || !evidenceLogs) {
      res.status(400).json({ error: "Reporter email and evidence logs are required." });
      return;
    }
    if (evidenceLogs.length < 30) {
      res.status(400).json({ error: "Evidence logs are too short. Please provide detailed information." });
      return;
    }

    const validTypes = ["spam", "phishing", "malware", "ddos", "copyright", "harassment", "other"];
    const type = validTypes.includes(abuseType) ? abuseType : "other";

    const reportNumber = buildReportNumber();

    // Auto-link to service if domain is provided
    let serviceId: string | null = null;
    let clientId: string | null = null;
    if (targetDomain) {
      const [svc] = await db.select().from(hostingServicesTable)
        .where(eq(hostingServicesTable.domain, targetDomain.toLowerCase().trim()))
        .limit(1);
      if (svc) { serviceId = svc.id; clientId = svc.clientId; }
    }

    const [report] = await db.insert(abuseReportsTable).values({
      reportNumber,
      reporterEmail: reporterEmail.trim(),
      reporterName: reporterName?.trim() || null,
      reporterOrg: reporterOrg?.trim() || null,
      abuseType: type as any,
      targetDomain: targetDomain?.trim() || null,
      targetIp: targetIp?.trim() || null,
      evidenceLogs: evidenceLogs.trim(),
      serviceId,
      clientId,
      status: "pending",
    }).returning();

    await logAction(report.id, "report_submitted", `Report submitted by ${reporterEmail}`, "public", reporterEmail);

    res.status(201).json({
      success: true,
      reportNumber: report.reportNumber,
      message: "Your abuse report has been received. We will investigate within 24–48 hours.",
    });
  } catch (err: any) {
    console.error("[ABUSE] Submit error:", err);
    res.status(500).json({ error: "Server error. Please try again." });
  }
});

// ─── Admin: List all reports ───────────────────────────────────────────────────

router.get("/admin/abuse", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const status = req.query.status as string | undefined;
    const limit = Math.min(parseInt(String(req.query.limit || "100")), 500);

    let query = db.select().from(abuseReportsTable).orderBy(desc(abuseReportsTable.createdAt)).$dynamic();
    if (status && status !== "all") {
      query = query.where(eq(abuseReportsTable.status, status as any));
    }
    const reports = await query.limit(limit);

    const enriched = await Promise.all(reports.map(async (r) => {
      let clientName = "";
      let domain = r.targetDomain || "";
      if (r.clientId) {
        const [u] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
          .from(usersTable).where(eq(usersTable.id, r.clientId)).limit(1);
        if (u) clientName = `${u.firstName} ${u.lastName}`.trim();
      }
      if (r.serviceId && !domain) {
        const [svc] = await db.select({ domain: hostingServicesTable.domain })
          .from(hostingServicesTable).where(eq(hostingServicesTable.id, r.serviceId)).limit(1);
        if (svc?.domain) domain = svc.domain;
      }
      return { ...r, clientName, domain };
    }));

    res.json(enriched);
  } catch (err) {
    console.error("[ABUSE] List error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Admin: Stats ─────────────────────────────────────────────────────────────

router.get("/admin/abuse/stats", authenticate, requireAdmin, async (_req, res) => {
  try {
    const [total] = await db.select({ count: sql<number>`count(*)` }).from(abuseReportsTable);
    const [pending] = await db.select({ count: sql<number>`count(*)` }).from(abuseReportsTable).where(eq(abuseReportsTable.status, "pending"));
    const [warnSent] = await db.select({ count: sql<number>`count(*)` }).from(abuseReportsTable).where(eq(abuseReportsTable.status, "warning_sent"));
    const [suspended] = await db.select({ count: sql<number>`count(*)` }).from(abuseReportsTable).where(eq(abuseReportsTable.status, "suspended"));
    const [resolved] = await db.select({ count: sql<number>`count(*)` }).from(abuseReportsTable).where(eq(abuseReportsTable.status, "resolved"));
    const [dismissed] = await db.select({ count: sql<number>`count(*)` }).from(abuseReportsTable).where(eq(abuseReportsTable.status, "dismissed"));

    res.json({
      total: Number(total?.count ?? 0),
      pending: Number(pending?.count ?? 0),
      warning_sent: Number(warnSent?.count ?? 0),
      suspended: Number(suspended?.count ?? 0),
      resolved: Number(resolved?.count ?? 0),
      dismissed: Number(dismissed?.count ?? 0),
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Admin: Get single report ─────────────────────────────────────────────────

router.get("/admin/abuse/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [report] = await db.select().from(abuseReportsTable)
      .where(eq(abuseReportsTable.id, req.params.id)).limit(1);
    if (!report) { res.status(404).json({ error: "Report not found" }); return; }

    const actions = await db.select().from(abuseActionsTable)
      .where(eq(abuseActionsTable.reportId, report.id))
      .orderBy(desc(abuseActionsTable.createdAt));

    let clientName = "";
    let clientEmail = "";
    let serviceDomain = report.targetDomain || "";

    if (report.clientId) {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, report.clientId)).limit(1);
      if (u) { clientName = `${u.firstName} ${u.lastName}`.trim(); clientEmail = u.email; }
    }
    if (report.serviceId && !serviceDomain) {
      const [svc] = await db.select({ domain: hostingServicesTable.domain })
        .from(hostingServicesTable).where(eq(hostingServicesTable.id, report.serviceId)).limit(1);
      if (svc?.domain) serviceDomain = svc.domain;
    }

    res.json({ ...report, actions, clientName, clientEmail, domain: serviceDomain });
  } catch (err) {
    console.error("[ABUSE] Get error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Admin: Analyze report ────────────────────────────────────────────────────

router.post("/admin/abuse/:id/analyze", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [report] = await db.select().from(abuseReportsTable)
      .where(eq(abuseReportsTable.id, req.params.id)).limit(1);
    if (!report) { res.status(404).json({ error: "Report not found" }); return; }

    const { isValid, notes } = analyzeEvidence(report.evidenceLogs, report.abuseType);

    const [updated] = await db.update(abuseReportsTable)
      .set({ status: "analyzing", isValid, analysisNotes: notes, updatedAt: new Date() })
      .where(eq(abuseReportsTable.id, report.id))
      .returning();

    await logAction(report.id, "analyzed", `AI analysis: ${isValid ? "VALID" : "LIKELY FALSE POSITIVE"} — ${notes}`, req.user!.userId, req.user!.email);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Admin: Send warning email + auto-create ticket ──────────────────────────

router.post("/admin/abuse/:id/warn", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [report] = await db.select().from(abuseReportsTable)
      .where(eq(abuseReportsTable.id, req.params.id)).limit(1);
    if (!report) { res.status(404).json({ error: "Report not found" }); return; }

    if (!report.clientId && !report.serviceId) {
      res.status(400).json({ error: "Cannot send warning: no client linked to this report. Link a service first." });
      return;
    }

    const [user] = await db.select().from(usersTable)
      .where(eq(usersTable.id, report.clientId!)).limit(1);
    if (!user) { res.status(400).json({ error: "Client not found" }); return; }

    const domain = report.targetDomain || "your hosting service";
    const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const deadlineStr = deadline.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

    const branding = await getBranding();
    const html = buildAbuseWarningHtml({
      ...branding,
      clientName: `${user.firstName} ${user.lastName}`,
      domain,
      abuseType: report.abuseType,
      reportNumber: report.reportNumber,
      deadline: deadlineStr,
    });

    await sendEmail({
      to: user.email,
      subject: `[${branding.companyName}] Abuse Warning — Action Required Within 48 Hours (${report.reportNumber})`,
      html,
      emailType: "abuse_warning",
      clientId: user.id,
      referenceId: report.id,
    });

    // Create High Priority Abuse ticket
    const ticketNumber = `ABU-TKT-${Date.now()}`;
    const [ticket] = await db.insert(ticketsTable).values({
      ticketNumber,
      clientId: user.id,
      subject: `Abuse Report — ${report.abuseType.toUpperCase()} — ${domain}`,
      status: "open",
      priority: "urgent",
      department: "Abuse",
      messagesCount: 1,
      lastReply: new Date(),
    }).returning();

    await db.insert(ticketMessagesTable).values({
      ticketId: ticket.id,
      senderId: "abuse-system",
      senderName: `${branding.companyName} Abuse Team`,
      senderRole: "admin",
      message: `Dear ${user.firstName} ${user.lastName},\n\nWe have received an abuse complaint (Report #${report.reportNumber}) concerning your hosting service for ${domain}.\n\nAbuse Type: ${report.abuseType.toUpperCase()}\nDeadline: ${deadlineStr}\n\nPlease reply to this ticket with the steps you have taken to resolve this issue within 48 hours. Failure to respond may result in immediate suspension of your service.\n\n— ${branding.companyName} Abuse Team`,
      attachments: [],
    });

    const [updated] = await db.update(abuseReportsTable)
      .set({
        status: "warning_sent",
        warningEmailSentAt: new Date(),
        warningDeadline: deadline,
        ticketId: ticket.id,
        notifiedClientAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(abuseReportsTable.id, report.id))
      .returning();

    await createNotification(user.id, "security", "Abuse Warning Issued", `An abuse complaint (${report.reportNumber}) has been filed against your service. Please review your support ticket.`, `/client/tickets/${ticket.id}`);
    await logAction(report.id, "warning_sent", `Warning email sent to ${user.email}. Ticket ${ticketNumber} created. Deadline: ${deadlineStr}`, req.user!.userId, req.user!.email);
    await emitActivity({ userId: req.user!.userId, userEmail: req.user!.email ?? "", userName: req.user!.userId, action: `Sent abuse warning for report ${report.reportNumber} to ${user.email}`, meta: { type: "abuse_warning", reportId: report.id } });

    res.json({ ...updated, ticketId: ticket.id, ticketNumber });
  } catch (err: any) {
    console.error("[ABUSE] Warn error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Admin: Suspend service ───────────────────────────────────────────────────

router.post("/admin/abuse/:id/suspend", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { reason } = req.body;
    const [report] = await db.select().from(abuseReportsTable)
      .where(eq(abuseReportsTable.id, req.params.id)).limit(1);
    if (!report) { res.status(404).json({ error: "Report not found" }); return; }

    let cpanelResult = "No cPanel service linked";
    if (report.serviceId) {
      const [svc] = await db.select().from(hostingServicesTable)
        .where(eq(hostingServicesTable.id, report.serviceId)).limit(1);
      if (svc?.username && svc?.serverId) {
        const [server] = await db.select().from(serversTable).where(eq(serversTable.id, svc.serverId)).limit(1);
        if (server) {
          try {
            const { decryptField } = await import("../lib/fieldCrypto.js");
            const svr = { host: server.ipAddress, port: 2087, username: server.username || "root", apiToken: server.apiToken ? decryptField(server.apiToken) : "", ssl: true };
            await cpanelSuspend(svr as any, svc.username, reason || `Abuse policy violation — Report ${report.reportNumber}`);
            await db.update(hostingServicesTable).set({ status: "suspended", updatedAt: new Date() } as any).where(eq(hostingServicesTable.id, svc.id));
            cpanelResult = "Service suspended via WHM";
          } catch (e: any) {
            cpanelResult = `WHM error: ${e.message}`;
            console.error("[ABUSE] WHM suspend failed:", e.message);
          }
        }
      }
    }

    // Send suspension email to client
    if (report.clientId) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, report.clientId)).limit(1);
      if (user) {
        const branding = await getBranding();
        const domain = report.targetDomain || "your hosting service";
        const html = buildAbuseSuspensionHtml({
          ...branding,
          clientName: `${user.firstName} ${user.lastName}`,
          domain,
          abuseType: report.abuseType,
          reportNumber: report.reportNumber,
          reason: reason || "Abuse policy violation — deadline exceeded without resolution",
        });
        await sendEmail({
          to: user.email,
          subject: `[${branding.companyName}] Service Suspended — Abuse Policy Violation (${report.reportNumber})`,
          html,
          emailType: "abuse_suspension",
          clientId: user.id,
          referenceId: report.id,
        });
        await createNotification(user.id, "security", "Service Suspended — Abuse", `Your service has been suspended due to an abuse complaint (${report.reportNumber}).`, `/client/tickets`);
      }
    }

    const [updated] = await db.update(abuseReportsTable)
      .set({ status: "suspended", suspendedAt: new Date(), updatedAt: new Date() })
      .where(eq(abuseReportsTable.id, report.id))
      .returning();

    await logAction(report.id, "suspended", `${cpanelResult}. Reason: ${reason || "Abuse policy violation"}`, req.user!.userId, req.user!.email);
    await emitActivity({ userId: req.user!.userId, userEmail: req.user!.email ?? "", userName: req.user!.userId, action: `Suspended service for abuse report ${report.reportNumber}`, meta: { type: "abuse_suspend", reportId: report.id } });

    res.json(updated);
  } catch (err: any) {
    console.error("[ABUSE] Suspend error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Admin: Resolve + Unsuspend ───────────────────────────────────────────────

router.post("/admin/abuse/:id/resolve", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { note } = req.body;
    const [report] = await db.select().from(abuseReportsTable)
      .where(eq(abuseReportsTable.id, req.params.id)).limit(1);
    if (!report) { res.status(404).json({ error: "Report not found" }); return; }

    let cpanelResult = "No service to unsuspend";
    if (report.serviceId && report.status === "suspended") {
      const [svc] = await db.select().from(hostingServicesTable)
        .where(eq(hostingServicesTable.id, report.serviceId)).limit(1);
      if (svc?.username && svc?.serverId) {
        const [server] = await db.select().from(serversTable).where(eq(serversTable.id, svc.serverId)).limit(1);
        if (server) {
          try {
            const { decryptField } = await import("../lib/fieldCrypto.js");
            const svr = { host: server.ipAddress, port: 2087, username: server.username || "root", apiToken: server.apiToken ? decryptField(server.apiToken) : "", ssl: true };
            await cpanelUnsuspend(svr as any, svc.username);
            await db.update(hostingServicesTable).set({ status: "active", updatedAt: new Date() } as any).where(eq(hostingServicesTable.id, svc.id));
            cpanelResult = "Service unsuspended via WHM";
          } catch (e: any) {
            cpanelResult = `WHM unsuspend error: ${e.message}`;
          }
        }
      }
    }

    if (report.clientId) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, report.clientId)).limit(1);
      if (user) {
        await createNotification(user.id, "security", "Abuse Case Resolved", `Your abuse report (${report.reportNumber}) has been resolved. Your service is now active.`, `/client/hosting`);
      }
    }

    const [updated] = await db.update(abuseReportsTable)
      .set({ status: "resolved", resolvedAt: new Date(), resolvedBy: req.user!.userId, resolvedNote: note || null, updatedAt: new Date() })
      .where(eq(abuseReportsTable.id, report.id))
      .returning();

    await logAction(report.id, "resolved", `${cpanelResult}. Note: ${note || ""}`, req.user!.userId, req.user!.email);
    await emitActivity({ userId: req.user!.userId, userEmail: req.user!.email ?? "", userName: req.user!.userId, action: `Resolved abuse report ${report.reportNumber}`, meta: { type: "abuse_resolve", reportId: report.id } });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Admin: Dismiss ───────────────────────────────────────────────────────────

router.post("/admin/abuse/:id/dismiss", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { reason } = req.body;
    const [report] = await db.select().from(abuseReportsTable)
      .where(eq(abuseReportsTable.id, req.params.id)).limit(1);
    if (!report) { res.status(404).json({ error: "Report not found" }); return; }

    const [updated] = await db.update(abuseReportsTable)
      .set({ status: "dismissed", dismissedAt: new Date(), dismissedBy: req.user!.userId, dismissReason: reason || null, isValid: false, updatedAt: new Date() })
      .where(eq(abuseReportsTable.id, report.id))
      .returning();

    await logAction(report.id, "dismissed", `Dismissed as ${reason || "false positive"}`, req.user!.userId, req.user!.email);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Admin: Link service to report ───────────────────────────────────────────

router.post("/admin/abuse/:id/link-service", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { serviceId } = req.body;
    if (!serviceId) { res.status(400).json({ error: "serviceId required" }); return; }

    const [svc] = await db.select().from(hostingServicesTable).where(eq(hostingServicesTable.id, serviceId)).limit(1);
    if (!svc) { res.status(404).json({ error: "Service not found" }); return; }

    const [updated] = await db.update(abuseReportsTable)
      .set({ serviceId: svc.id, clientId: svc.clientId, targetDomain: svc.domain || undefined, updatedAt: new Date() })
      .where(eq(abuseReportsTable.id, req.params.id))
      .returning();

    await logAction(req.params.id, "service_linked", `Linked to service ${serviceId} (${svc.domain})`, req.user!.userId, req.user!.email);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Admin: Get all services (for linking dropdown) ───────────────────────────

router.get("/admin/abuse-services-search", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const q = String(req.query.q || "");
    let services;
    if (q.length >= 2) {
      services = await db.select({
        id: hostingServicesTable.id,
        domain: hostingServicesTable.domain,
        clientId: hostingServicesTable.clientId,
        status: hostingServicesTable.status,
        username: hostingServicesTable.username,
      }).from(hostingServicesTable)
        .where(sql`${hostingServicesTable.domain} ILIKE ${"%" + q + "%"}`)
        .limit(20);
    } else {
      services = await db.select({
        id: hostingServicesTable.id,
        domain: hostingServicesTable.domain,
        clientId: hostingServicesTable.clientId,
        status: hostingServicesTable.status,
        username: hostingServicesTable.username,
      }).from(hostingServicesTable).limit(20);
    }
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Cron: Auto-enforce deadline exceeded reports ─────────────────────────────

export async function runAbuseEnforcementCron(): Promise<void> {
  try {
    const now = new Date();
    const overdueReports = await db.select().from(abuseReportsTable)
      .where(
        and(
          eq(abuseReportsTable.status, "warning_sent"),
          sql`${abuseReportsTable.warningDeadline} < ${now}`,
        )
      );

    if (overdueReports.length === 0) return;
    console.log(`[CRON][ABUSE] Found ${overdueReports.length} overdue abuse report(s) to auto-enforce`);

    for (const report of overdueReports) {
      try {
        let cpanelResult = "No service linked";
        if (report.serviceId) {
          const [svc] = await db.select().from(hostingServicesTable)
            .where(eq(hostingServicesTable.id, report.serviceId)).limit(1);
          if (svc?.username && svc?.serverId) {
            const [server] = await db.select().from(serversTable).where(eq(serversTable.id, svc.serverId)).limit(1);
            if (server) {
              try {
                const { decryptField } = await import("./fieldCrypto.js");
                const svr = { host: server.ipAddress, port: 2087, username: server.username || "root", apiToken: server.apiToken ? decryptField(server.apiToken) : "", ssl: true };
                await cpanelSuspend(svr as any, svc.username, `Auto-suspended: abuse warning deadline exceeded (Report ${report.reportNumber})`);
                await db.update(hostingServicesTable).set({ status: "suspended", updatedAt: new Date() } as any).where(eq(hostingServicesTable.id, svc.id));
                cpanelResult = "Auto-suspended via WHM";
              } catch (e: any) {
                cpanelResult = `WHM error: ${e.message}`;
              }
            }
          }
        }

        if (report.clientId) {
          const [user] = await db.select().from(usersTable).where(eq(usersTable.id, report.clientId)).limit(1);
          if (user) {
            const branding = await getBranding();
            const domain = report.targetDomain || "your hosting service";
            const html = buildAbuseSuspensionHtml({
              ...branding,
              clientName: `${user.firstName} ${user.lastName}`,
              domain,
              abuseType: report.abuseType,
              reportNumber: report.reportNumber,
              reason: "Warning deadline exceeded — automatic enforcement triggered",
            });
            await sendEmail({
              to: user.email,
              subject: `[${branding.companyName}] Service Auto-Suspended — Abuse Policy (${report.reportNumber})`,
              html,
              emailType: "abuse_auto_suspension",
              clientId: user.id,
              referenceId: report.id,
            });
            await createNotification(user.id, "security", "Service Auto-Suspended", `Your service was automatically suspended after the abuse warning deadline expired (${report.reportNumber}).`, `/client/tickets`);
          }
        }

        await db.update(abuseReportsTable)
          .set({ status: "suspended", suspendedAt: now, autoSuspended: true, updatedAt: now })
          .where(eq(abuseReportsTable.id, report.id));

        await logAction(report.id, "auto_suspended", `${cpanelResult}. Deadline exceeded, auto-enforcement triggered.`, "system-cron");
        console.log(`[CRON][ABUSE] Auto-suspended report ${report.reportNumber}: ${cpanelResult}`);
      } catch (e: any) {
        console.error(`[CRON][ABUSE] Failed to auto-suspend ${report.reportNumber}:`, e.message);
      }
    }
  } catch (err: any) {
    console.error("[CRON][ABUSE] Enforcement cron error:", err.message);
  }
}

export default router;
