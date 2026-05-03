import { Router } from "express";
import { db } from "@workspace/db";
import {
  abuseReportsTable, abuseActionsTable, abuseReputationTable, abuseEvidenceTable,
  hostingServicesTable, usersTable, ticketsTable, ticketMessagesTable, serversTable,
} from "@workspace/db/schema";
import { eq, desc, sql, and, count, sum, max, ne } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { sendEmail } from "../lib/email.js";
import { cpanelSuspend, cpanelUnsuspend } from "../lib/cpanel.js";
import { createNotification } from "../lib/notifications.js";
import { emitActivity } from "../lib/activity.js";

const router = Router();

// ─── Constants ─────────────────────────────────────────────────────────────────

const TRUSTED_ORGS: Record<string, number> = {
  "spamhaus": 55, "google": 50, "microsoft": 50, "cloudflare": 45,
  "abuse.ch": 50, "phishtank": 45, "surbl": 40, "barracuda": 35,
  "spamcop": 35, "sorbs": 30, "uceprotect": 25, "stopforumspam": 30,
  "mxtoolbox": 20, "noehost": 15,
};

const TYPE_BASE_SCORES: Record<string, number> = {
  child_safety: 100, phishing: 85, malware: 80, ddos: 70,
  dmca: 60, spam: 40, copyright: 55, harassment: 45, other: 20,
};

const INSTANT_SUSPEND_TYPES = ["child_safety", "phishing"];
const RESOLUTION_KEYWORDS = [
  "removed malware", "deleted script", "fixed", "cleaned", "resolved",
  "removed the file", "disabled", "patched", "secured", "shut down",
  "terminated", "deleted", "stopped", "eliminated",
];

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
      reportId, actionType, actionNote, performedBy,
      performedByEmail: performedByEmail ?? null,
    });
  } catch { /* non-fatal */ }
}

// ─── Threat Scoring Engine ────────────────────────────────────────────────────

interface ThreatScoreResult {
  score: number;
  classification: "low" | "medium" | "high" | "critical";
  sourceCredibility: string;
  notes: string;
  instantSuspend: boolean;
}

async function computeThreatScore(
  reporterEmail: string,
  reporterOrg: string | null | undefined,
  abuseType: string,
  evidenceLogs: string,
  clientId: string | null | undefined,
): Promise<ThreatScoreResult> {
  let score = TYPE_BASE_SCORES[abuseType] ?? 20;
  const scoreParts: string[] = [`Base (${abuseType}): +${score}`];
  let credibilityLabel = "Unknown Reporter";

  // Source credibility boost
  const orgLower = (reporterOrg || "").toLowerCase();
  const emailDomain = reporterEmail.split("@")[1]?.toLowerCase() ?? "";
  let credBoost = 0;
  for (const [org, boost] of Object.entries(TRUSTED_ORGS)) {
    if (orgLower.includes(org) || emailDomain.includes(org)) {
      credBoost = boost;
      credibilityLabel = `Trusted: ${reporterOrg || emailDomain}`;
      scoreParts.push(`Source credibility (${org}): +${boost}`);
      break;
    }
  }
  score += credBoost;
  if (credBoost === 0) credibilityLabel = "General Reporter";

  // Evidence keyword boost
  const text = evidenceLogs.toLowerCase();
  const abuseSignals = ["spam", "phishing", "malware", "hack", "botnet", "ddos", "exploit", "illegal", "ransomware", "infringing"].filter(s => text.includes(s));
  if (abuseSignals.length > 0) {
    const evBoost = Math.min(abuseSignals.length * 3, 15);
    score += evBoost;
    scoreParts.push(`Evidence signals (${abuseSignals.length}): +${evBoost}`);
  }

  // Repeat offender boost from reputation table
  if (clientId) {
    const [rep] = await db.select().from(abuseReputationTable)
      .where(eq(abuseReputationTable.clientId, clientId)).limit(1);
    if (rep) {
      const historyBoost = Math.min((rep.totalReports ?? 0) * 5, 20);
      if (historyBoost > 0) {
        score += historyBoost;
        scoreParts.push(`Repeat offender (${rep.totalReports} reports): +${historyBoost}`);
      }
      if (rep.isPermanentlyBanned) {
        score = 100;
        scoreParts.push("Permanently banned client: forced 100");
      }
    }
  }

  // Cap at 100
  score = Math.min(100, Math.max(1, score));

  const classification: ThreatScoreResult["classification"] =
    score >= 90 ? "critical" : score >= 65 ? "high" : score >= 40 ? "medium" : "low";

  const instantSuspend = INSTANT_SUSPEND_TYPES.includes(abuseType) || score >= 90;

  return {
    score,
    classification,
    sourceCredibility: credibilityLabel,
    notes: `Threat Score: ${score}/100 (${classification.toUpperCase()}). Factors: ${scoreParts.join(" | ")}`,
    instantSuspend,
  };
}

// ─── Reputation Updater ───────────────────────────────────────────────────────

async function updateReputation(clientId: string, clientEmail: string, threatScore: number, isValid: boolean) {
  try {
    const [existing] = await db.select().from(abuseReputationTable)
      .where(eq(abuseReputationTable.clientId, clientId)).limit(1);

    if (existing) {
      const newTotal = (existing.totalReports ?? 0) + 1;
      const newValid = (existing.validReports ?? 0) + (isValid ? 1 : 0);
      const newSum = (existing.threatScoreSum ?? 0) + threatScore;
      const newAvg = Math.round(newSum / newTotal);
      const newMax = Math.max(existing.maxThreatScore ?? 0, threatScore);
      await db.update(abuseReputationTable).set({
        totalReports: newTotal,
        validReports: newValid,
        threatScoreSum: newSum,
        avgThreatScore: newAvg,
        maxThreatScore: newMax,
        lastReportAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(abuseReputationTable.clientId, clientId));
    } else {
      await db.insert(abuseReputationTable).values({
        id: crypto.randomUUID(),
        clientId,
        clientEmail,
        totalReports: 1,
        validReports: isValid ? 1 : 0,
        threatScoreSum: threatScore,
        avgThreatScore: threatScore,
        maxThreatScore: threatScore,
        lastReportAt: new Date(),
      });
    }
  } catch (e: any) {
    console.error("[SENTINEL] Reputation update failed:", e.message);
  }
}

// ─── WHM Suspend Helper ───────────────────────────────────────────────────────

async function performCpanelSuspend(serviceId: string, reason: string): Promise<string> {
  const [svc] = await db.select().from(hostingServicesTable)
    .where(eq(hostingServicesTable.id, serviceId)).limit(1);
  if (!svc?.username || !svc?.serverId) return "No cPanel service linked";
  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, svc.serverId)).limit(1);
  if (!server) return "Server not found";
  try {
    const { decryptField } = await import("../lib/fieldCrypto.js");
    const svr = { host: server.ipAddress, port: 2087, username: server.username || "root", apiToken: server.apiToken ? decryptField(server.apiToken) : "", ssl: true };
    await cpanelSuspend(svr as any, svc.username, reason);
    await db.update(hostingServicesTable).set({ status: "suspended", updatedAt: new Date() } as any).where(eq(hostingServicesTable.id, svc.id));
    return "Service suspended via WHM";
  } catch (e: any) {
    console.error("[SENTINEL] WHM suspend failed:", e.message);
    return `WHM error: ${e.message}`;
  }
}

// ─── Branding ─────────────────────────────────────────────────────────────────

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
      clientUrl,
    };
  } catch {
    return { companyName: "Noehost", brandColor: "#701AFE", logoUrl: "", supportUrl: "/client/tickets/new", websiteUrl: "https://noehost.com", clientUrl: "" };
  }
}

// ─── Email Templates ──────────────────────────────────────────────────────────

function buildEmailBase(opts: { companyName: string; brandColor: string; logoUrl: string; websiteUrl: string; headerBg?: string; bannerIcon: string; bannerTitle: string; bannerSub: string; bannerBg: string; bannerBorder: string; bannerTextColor: string; body: string; footer?: string; }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${opts.bannerTitle}</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
      <tr><td style="background:${opts.headerBg || opts.brandColor};padding:28px 40px;text-align:center;">
        ${opts.logoUrl ? `<img src="${opts.logoUrl}" alt="${opts.companyName}" style="height:38px;display:block;margin:0 auto 12px;">` : ""}
        <h1 style="margin:0;color:#fff;font-size:21px;font-weight:700;">${opts.companyName}</h1>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:12px;">Hosting Security & Compliance</p>
      </td></tr>
      <tr><td style="background:${opts.bannerBg};border-left:4px solid ${opts.bannerBorder};padding:14px 40px;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="padding-right:12px;vertical-align:middle;font-size:22px;">${opts.bannerIcon}</td>
          <td><p style="margin:0;color:${opts.bannerTextColor};font-size:14px;font-weight:700;">${opts.bannerTitle}</p>
          <p style="margin:3px 0 0;color:${opts.bannerTextColor};opacity:.8;font-size:12px;">${opts.bannerSub}</p></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:32px 40px;">${opts.body}</td></tr>
      <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
        <p style="margin:0 0 4px;color:#6b7280;font-size:12px;">This is an automated security notification from <strong>${opts.companyName}</strong>.</p>
        <p style="margin:0;color:#9ca3af;font-size:11px;">© ${new Date().getFullYear()} ${opts.companyName} · <a href="${opts.websiteUrl}" style="color:#9ca3af;">${opts.websiteUrl}</a></p>
        ${opts.footer || ""}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function buildAbuseWarningHtml(opts: {
  companyName: string; brandColor: string; logoUrl: string; clientName: string;
  domain: string; abuseType: string; reportNumber: string; deadline: string;
  supportUrl: string; websiteUrl: string; ticketUrl: string;
  threatScore: number; classification: string; isDmca?: boolean;
}): string {
  const typeLabel = opts.abuseType.charAt(0).toUpperCase() + opts.abuseType.slice(1);
  const scoreColor = opts.threatScore >= 80 ? "#dc2626" : opts.threatScore >= 50 ? "#f59e0b" : "#16a34a";
  const classLabel = opts.classification.toUpperCase();

  const body = `
    <p style="margin:0 0 18px;color:#374151;font-size:15px;line-height:1.6;">Dear <strong>${opts.clientName}</strong>,</p>
    <p style="margin:0 0 18px;color:#374151;font-size:15px;line-height:1.6;">
      We have received a formal abuse complaint concerning your hosting service for <strong>${opts.domain}</strong>.
      Our Autonomous Sentinel has classified this as <strong>${typeLabel}</strong> with a Threat Score of
      <strong style="color:${scoreColor};">${opts.threatScore}/100 (${classLabel})</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin:0 0 22px;">
      <tr><td style="padding:18px 22px;">
        <p style="margin:0 0 10px;color:#111827;font-size:13px;font-weight:700;">⏰ Enforcement Timeline</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="50%" style="padding:7px 0;border-bottom:1px solid #e5e7eb;">
              <span style="color:#6b7280;font-size:11px;display:block;">Report #</span>
              <span style="color:#111827;font-size:13px;font-weight:600;font-family:monospace;">${opts.reportNumber}</span>
            </td>
            <td width="50%" style="padding:7px 0;border-bottom:1px solid #e5e7eb;">
              <span style="color:#6b7280;font-size:11px;display:block;">Threat Score</span>
              <span style="color:${scoreColor};font-size:13px;font-weight:700;">${opts.threatScore}/100 — ${classLabel}</span>
            </td>
          </tr>
          <tr>
            <td width="50%" style="padding:7px 0;">
              <span style="color:#6b7280;font-size:11px;display:block;">Affected Domain</span>
              <span style="color:#111827;font-size:13px;font-weight:600;">${opts.domain}</span>
            </td>
            <td width="50%" style="padding:7px 0;">
              <span style="color:#6b7280;font-size:11px;display:block;">Response Deadline</span>
              <span style="color:#dc2626;font-size:13px;font-weight:700;">${opts.deadline}</span>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
    ${opts.isDmca ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #93c5fd;border-radius:8px;margin:0 0 22px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 6px;color:#1d4ed8;font-size:13px;font-weight:700;">⚖️ DMCA / Copyright Notice</p>
        <p style="margin:0;color:#1e40af;font-size:13px;line-height:1.5;">
          This is a DMCA takedown notice. You have <strong>${opts.deadline}</strong> to remove the infringing content.
          You may file a <strong>Counter-Notice</strong> from your client portal if you believe this claim is invalid.
          Failure to act may result in immediate takedown and account suspension.
        </p>
      </td></tr>
    </table>` : ""}
    <p style="margin:0 0 10px;color:#111827;font-size:13px;font-weight:700;">Required Actions:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      ${["Immediately investigate and stop the reported activity.", "Remove any offending content, scripts, or configurations.", "Reply to your abuse ticket explaining steps taken.", "Provide evidence of resolution to avoid service suspension."].map((step, i) => `
      <tr><td width="30" style="vertical-align:top;padding:5px 0;">
        <span style="display:inline-block;background:${opts.brandColor};color:#fff;border-radius:50%;width:20px;height:20px;font-size:11px;font-weight:700;text-align:center;line-height:20px;">${i + 1}</span>
      </td><td style="padding:5px 0 5px 10px;color:#374151;font-size:13px;line-height:1.5;">${step}</td></tr>`).join("")}
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin:0 0 22px;">
      <tr><td style="padding:14px 18px;">
        <p style="margin:0;color:#991b1b;font-size:12px;line-height:1.6;">
          🚫 <strong>Failure to respond</strong> by the deadline may result in immediate suspension. Threat Score ≥ 90 triggers automatic lockdown.
        </p>
      </td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="text-align:center;">
      <tr>
        <td style="padding:0 8px;">
          <a href="${opts.ticketUrl}" style="display:inline-block;background:${opts.brandColor};color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-size:14px;font-weight:700;">
            ✅ Respond to Dispute Ticket
          </a>
        </td>
        <td style="padding:0 8px;">
          <a href="${opts.supportUrl}" style="display:inline-block;background:#6b7280;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-size:14px;font-weight:700;">
            📋 View All Tickets
          </a>
        </td>
      </tr>
    </table>`;

  return buildEmailBase({
    companyName: opts.companyName, brandColor: opts.brandColor, logoUrl: opts.logoUrl, websiteUrl: opts.websiteUrl,
    bannerIcon: "⚠️", bannerTitle: "Abuse Warning — Immediate Action Required",
    bannerSub: `Report #${opts.reportNumber} · ${typeLabel} · Score: ${opts.threatScore}/100`,
    bannerBg: "#fff3cd", bannerBorder: "#f59e0b", bannerTextColor: "#92400e", body,
  });
}

function buildAbuseSuspensionHtml(opts: {
  companyName: string; brandColor: string; logoUrl: string; clientName: string;
  domain: string; abuseType: string; reportNumber: string; reason: string;
  supportUrl: string; websiteUrl: string; threatScore?: number; isCritical?: boolean;
}): string {
  const typeLabel = opts.abuseType.charAt(0).toUpperCase() + opts.abuseType.slice(1);
  const body = `
    <p style="margin:0 0 18px;color:#374151;font-size:15px;line-height:1.6;">Dear <strong>${opts.clientName}</strong>,</p>
    <p style="margin:0 0 18px;color:#374151;font-size:15px;line-height:1.6;">
      Your hosting service for <strong>${opts.domain}</strong> has been
      <strong style="color:#dc2626;">${opts.isCritical ? "CRITICAL LOCKDOWN" : "suspended"}</strong>
      due to ${opts.isCritical ? `a Critical Threat Score of <strong>${opts.threatScore}/100</strong>` : "a verified abuse complaint"}.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin:0 0 22px;">
      <tr><td style="padding:18px 22px;">
        <p style="margin:0 0 10px;color:#111827;font-size:13px;font-weight:700;">📋 Suspension Details</p>
        ${[
          ["Report Number", opts.reportNumber, "monospace"],
          ["Abuse Type", typeLabel, ""],
          ["Affected Domain", opts.domain, ""],
          opts.threatScore ? ["Threat Score", `${opts.threatScore}/100 — ${opts.isCritical ? "CRITICAL" : "HIGH"}`, "#dc2626"] : null,
          ["Reason", opts.reason, "#dc2626"],
        ].filter(Boolean).map(([label, value, color]: any) => `
        <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #e5e7eb;">
          <tr><td style="padding:6px 0;"><span style="color:#6b7280;font-size:11px;">${label}:</span>
          <span style="color:${color || "#111827"};font-size:13px;font-weight:600;float:right;${color === "monospace" ? "font-family:monospace;" : ""}">${value}</span></td></tr>
        </table>`).join("")}
      </td></tr>
    </table>
    <p style="margin:0 0 14px;color:#374151;font-size:13px;line-height:1.6;">To appeal this suspension, open a support ticket immediately with:</p>
    <ul style="margin:0 0 22px;padding-left:18px;color:#374151;font-size:13px;line-height:2;">
      <li>Steps taken to resolve the reported abuse</li>
      <li>Evidence that the activity has stopped</li>
      <li>Any context explaining the complaint</li>
    </ul>
    <table width="100%" cellpadding="0" cellspacing="0" style="text-align:center;margin:0 0 16px;">
      <tr><td>
        <a href="${opts.supportUrl}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:13px 36px;border-radius:8px;font-size:14px;font-weight:700;">
          🚨 Open Appeal Ticket
        </a>
      </td></tr>
    </table>
    <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.6;text-align:center;">
      Appeals are reviewed within 24–48 hours. We take these matters seriously to protect all hosted clients.
    </p>`;

  return buildEmailBase({
    companyName: opts.companyName, brandColor: opts.brandColor, logoUrl: opts.logoUrl, websiteUrl: opts.websiteUrl,
    headerBg: "#dc2626",
    bannerIcon: "🚫", bannerTitle: opts.isCritical ? "Critical Lockdown — Immediate Suspension" : "Service Suspended — Abuse Policy Violation",
    bannerSub: `Report #${opts.reportNumber} · ${typeLabel}${opts.threatScore ? ` · Score: ${opts.threatScore}/100` : ""}`,
    bannerBg: "#fee2e2", bannerBorder: "#dc2626", bannerTextColor: "#991b1b", body,
  });
}

function buildDmcaNoticeHtml(opts: {
  companyName: string; brandColor: string; logoUrl: string; clientName: string;
  domain: string; reportNumber: string; deadlineDate: string; supportUrl: string;
  websiteUrl: string; counterNoticeUrl: string;
}): string {
  const body = `
    <p style="margin:0 0 18px;color:#374151;font-size:15px;line-height:1.6;">Dear <strong>${opts.clientName}</strong>,</p>
    <p style="margin:0 0 18px;color:#374151;font-size:15px;line-height:1.6;">
      We have received a <strong>DMCA Takedown Notice</strong> against content hosted on your service for
      <strong>${opts.domain}</strong>. Under the Digital Millennium Copyright Act, we are legally required to act on valid takedown requests.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #93c5fd;border-radius:8px;margin:0 0 22px;">
      <tr><td style="padding:18px 22px;">
        <p style="margin:0 0 10px;color:#1d4ed8;font-size:13px;font-weight:700;">⚖️ DMCA Takedown Clock</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="50%" style="padding:6px 0;border-bottom:1px solid #bfdbfe;">
              <span style="color:#1d4ed8;font-size:11px;display:block;">Report #</span>
              <span style="color:#1e3a8a;font-size:13px;font-weight:700;font-family:monospace;">${opts.reportNumber}</span>
            </td>
            <td width="50%" style="padding:6px 0;border-bottom:1px solid #bfdbfe;">
              <span style="color:#1d4ed8;font-size:11px;display:block;">Takedown Deadline</span>
              <span style="color:#dc2626;font-size:13px;font-weight:700;">${opts.deadlineDate}</span>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
    <p style="margin:0 0 12px;color:#111827;font-size:13px;font-weight:700;">You have two options:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
      <tr>
        <td width="50%" style="padding:12px;background:#fef9c3;border:1px solid #fde68a;border-radius:8px;vertical-align:top;">
          <p style="margin:0 0 6px;color:#854d0e;font-size:13px;font-weight:700;">Option A: Comply</p>
          <p style="margin:0;color:#78350f;font-size:12px;line-height:1.5;">Remove the infringing content before the deadline. Reply to your ticket with proof of removal.</p>
        </td>
        <td width="8px"></td>
        <td width="50%" style="padding:12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;vertical-align:top;">
          <p style="margin:0 0 6px;color:#1d4ed8;font-size:13px;font-weight:700;">Option B: Counter-Notice</p>
          <p style="margin:0;color:#1e40af;font-size:12px;line-height:1.5;">If you believe the claim is invalid, file a DMCA Counter-Notice from your portal before the deadline.</p>
        </td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="text-align:center;">
      <tr>
        <td style="padding:0 6px;">
          <a href="${opts.counterNoticeUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:13px;font-weight:700;">
            ⚖️ File Counter-Notice
          </a>
        </td>
        <td style="padding:0 6px;">
          <a href="${opts.supportUrl}" style="display:inline-block;background:${opts.brandColor};color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:13px;font-weight:700;">
            📋 View Dispute Ticket
          </a>
        </td>
      </tr>
    </table>`;

  return buildEmailBase({
    companyName: opts.companyName, brandColor: opts.brandColor, logoUrl: opts.logoUrl, websiteUrl: opts.websiteUrl,
    headerBg: "#1d4ed8",
    bannerIcon: "⚖️", bannerTitle: "DMCA Takedown Notice — Action Required",
    bannerSub: `Report #${opts.reportNumber} · Deadline: ${opts.deadlineDate}`,
    bannerBg: "#eff6ff", bannerBorder: "#3b82f6", bannerTextColor: "#1d4ed8", body,
  });
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

    const validTypes = ["spam", "phishing", "malware", "ddos", "copyright", "harassment", "dmca", "child_safety", "other"];
    const type = validTypes.includes(abuseType) ? abuseType : "other";
    const reportNumber = buildReportNumber();

    // Auto-link to service
    let serviceId: string | null = null;
    let clientId: string | null = null;
    if (targetDomain) {
      const [svc] = await db.select().from(hostingServicesTable)
        .where(eq(hostingServicesTable.domain, targetDomain.toLowerCase().trim())).limit(1);
      if (svc) { serviceId = svc.id; clientId = svc.clientId; }
    }

    // Compute threat score immediately
    const threat = await computeThreatScore(reporterEmail, reporterOrg, type, evidenceLogs, clientId);

    const isDmca = type === "dmca" || type === "copyright";
    const dmcaDeadline = isDmca ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null;

    const [report] = await db.insert(abuseReportsTable).values({
      reportNumber,
      reporterEmail: reporterEmail.trim(),
      reporterName: reporterName?.trim() || null,
      reporterOrg: reporterOrg?.trim() || null,
      abuseType: type as any,
      targetDomain: targetDomain?.trim() || null,
      targetIp: targetIp?.trim() || null,
      evidenceLogs: evidenceLogs.trim(),
      serviceId, clientId,
      status: "pending",
      threatScore: threat.score,
      classification: threat.classification as any,
      sourceCredibility: threat.sourceCredibility,
      isDmca,
      dmcaDeadlineAt: dmcaDeadline,
      analysisNotes: threat.notes,
      isValid: threat.score >= 40,
    }).returning();

    // Update reputation if client is linked
    if (clientId) {
      const [u] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, clientId)).limit(1);
      await updateReputation(clientId, u?.email ?? "", threat.score, threat.score >= 40);
    }

    await logAction(report.id, "report_submitted", `Report submitted by ${reporterEmail}. Threat Score: ${threat.score}/100 (${threat.classification})`, "public", reporterEmail);

    // Auto-suspend critical threats immediately
    if (threat.instantSuspend && serviceId) {
      const suspendResult = await performCpanelSuspend(serviceId, `AUTO: Critical threat — Score ${threat.score}/100 (${type})`);
      await db.update(abuseReportsTable).set({ status: "critical_lockdown" as any, suspendedAt: new Date(), autoSuspended: true, updatedAt: new Date() }).where(eq(abuseReportsTable.id, report.id));
      await logAction(report.id, "auto_critical_lockdown", `Instant critical lockdown triggered. Score: ${threat.score}/100. ${suspendResult}`, "sentinel-engine");

      // Notify admin
      const branding = await getBranding();
      if (clientId) {
        const [user] = await db.select().from(usersTable).where(eq(usersTable.id, clientId)).limit(1);
        if (user) {
          const domain = targetDomain || "your service";
          const html = buildAbuseSuspensionHtml({ ...branding, clientName: `${user.firstName} ${user.lastName}`, domain, abuseType: type, reportNumber, reason: `Critical threat detected (${type}). Threat Score: ${threat.score}/100.`, threatScore: threat.score, isCritical: true });
          await sendEmail({ to: user.email, subject: `[${branding.companyName}] 🚨 Critical Lockdown — Your Service Has Been Suspended`, html, emailType: "abuse_critical_lockdown", clientId: user.id, referenceId: report.id });
          await createNotification(user.id, "security", "🚨 Critical Lockdown", `Your service has been immediately suspended due to a critical threat (Score: ${threat.score}/100).`, `/client/tickets`);
        }
      }
    }

    res.status(201).json({
      success: true, reportNumber: report.reportNumber,
      threatScore: threat.score, classification: threat.classification,
      message: "Your abuse report has been received. We will investigate within 24–48 hours.",
    });
  } catch (err: any) {
    console.error("[SENTINEL] Submit error:", err);
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
      let clientName = ""; let domain = r.targetDomain || "";
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
    console.error("[SENTINEL] List error:", err);
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
    const [critical] = await db.select({ count: sql<number>`count(*)` }).from(abuseReportsTable).where(eq(abuseReportsTable.status, "critical_lockdown" as any));
    const [resolved] = await db.select({ count: sql<number>`count(*)` }).from(abuseReportsTable).where(eq(abuseReportsTable.status, "resolved"));
    const [dismissed] = await db.select({ count: sql<number>`count(*)` }).from(abuseReportsTable).where(eq(abuseReportsTable.status, "dismissed"));
    const [avgScoreRow] = await db.select({ avg: sql<number>`COALESCE(AVG(threat_score),0)` }).from(abuseReportsTable);

    res.json({
      total: Number(total?.count ?? 0),
      pending: Number(pending?.count ?? 0),
      warning_sent: Number(warnSent?.count ?? 0),
      suspended: Number(suspended?.count ?? 0),
      critical_lockdown: Number(critical?.count ?? 0),
      resolved: Number(resolved?.count ?? 0),
      dismissed: Number(dismissed?.count ?? 0),
      avgThreatScore: Math.round(Number(avgScoreRow?.avg ?? 0)),
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Admin: Network Health Analytics ──────────────────────────────────────────

router.get("/admin/abuse/network-health", authenticate, requireAdmin, async (_req, res) => {
  try {
    // Top 10 bad actors
    const badActors = await db.select().from(abuseReputationTable)
      .orderBy(desc(abuseReputationTable.avgThreatScore))
      .limit(10);

    // Enrich with user details
    const enrichedActors = await Promise.all(badActors.map(async (actor) => {
      const [user] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email })
        .from(usersTable).where(eq(usersTable.id, actor.clientId)).limit(1);
      return {
        ...actor,
        clientName: user ? `${user.firstName} ${user.lastName}`.trim() : "Unknown",
        clientEmail: user?.email ?? actor.clientEmail ?? "",
      };
    }));

    // Abuse by type distribution
    const byType = await db.select({
      abuseType: abuseReportsTable.abuseType,
      count: sql<number>`count(*)`,
      avgScore: sql<number>`COALESCE(AVG(threat_score),0)`,
    }).from(abuseReportsTable).groupBy(abuseReportsTable.abuseType);

    // Most abused IP ranges (top IPs)
    const ipRanges = await db.select({
      ip: abuseReportsTable.targetIp,
      count: sql<number>`count(*)`,
      maxScore: sql<number>`MAX(threat_score)`,
    }).from(abuseReportsTable)
      .where(sql`target_ip IS NOT NULL AND target_ip != ''`)
      .groupBy(abuseReportsTable.targetIp)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    // Most abused domains
    const topDomains = await db.select({
      domain: abuseReportsTable.targetDomain,
      count: sql<number>`count(*)`,
      maxScore: sql<number>`MAX(threat_score)`,
    }).from(abuseReportsTable)
      .where(sql`target_domain IS NOT NULL AND target_domain != ''`)
      .groupBy(abuseReportsTable.targetDomain)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    // Recent high-score reports (score >= 70)
    const highThreat = await db.select().from(abuseReportsTable)
      .where(sql`threat_score >= 70`)
      .orderBy(desc(abuseReportsTable.createdAt))
      .limit(5);

    // Score distribution buckets
    const scoreDistrib = await Promise.all([
      [1, 39, "Low"], [40, 64, "Medium"], [65, 89, "High"], [90, 100, "Critical"],
    ].map(async ([min, max, label]) => {
      const [row] = await db.select({ count: sql<number>`count(*)` }).from(abuseReportsTable)
        .where(sql`threat_score BETWEEN ${min} AND ${max}`);
      return { label, min, max, count: Number(row?.count ?? 0) };
    }));

    // Permanent bans
    const [bannedRow] = await db.select({ count: sql<number>`count(*)` }).from(abuseReputationTable)
      .where(eq(abuseReputationTable.isPermanentlyBanned, true));

    res.json({
      badActors: enrichedActors,
      byType: byType.map(b => ({ type: b.abuseType, count: Number(b.count), avgScore: Math.round(Number(b.avgScore)) })),
      ipRanges: ipRanges.map(i => ({ ip: i.ip, count: Number(i.count), maxScore: Number(i.maxScore) })),
      topDomains: topDomains.map(d => ({ domain: d.domain, count: Number(d.count), maxScore: Number(d.maxScore) })),
      highThreat,
      scoreDistribution: scoreDistrib,
      totalBanned: Number(bannedRow?.count ?? 0),
    });
  } catch (err: any) {
    console.error("[SENTINEL] Network health error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Admin: Get single report ─────────────────────────────────────────────────

router.get("/admin/abuse/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [report] = await db.select().from(abuseReportsTable)
      .where(eq(abuseReportsTable.id, req.params.id)).limit(1);
    if (!report) { res.status(404).json({ error: "Report not found" }); return; }

    const [actions, evidence] = await Promise.all([
      db.select().from(abuseActionsTable).where(eq(abuseActionsTable.reportId, report.id)).orderBy(desc(abuseActionsTable.createdAt)),
      db.select().from(abuseEvidenceTable).where(eq(abuseEvidenceTable.reportId, report.id)).orderBy(abuseEvidenceTable.createdAt),
    ]);

    let clientName = ""; let clientEmail = ""; let serviceDomain = report.targetDomain || "";
    let reputation: any = null;

    if (report.clientId) {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, report.clientId)).limit(1);
      if (u) { clientName = `${u.firstName} ${u.lastName}`.trim(); clientEmail = u.email; }
      const [rep] = await db.select().from(abuseReputationTable).where(eq(abuseReputationTable.clientId, report.clientId)).limit(1);
      if (rep) reputation = rep;
    }
    if (report.serviceId && !serviceDomain) {
      const [svc] = await db.select({ domain: hostingServicesTable.domain })
        .from(hostingServicesTable).where(eq(hostingServicesTable.id, report.serviceId)).limit(1);
      if (svc?.domain) serviceDomain = svc.domain;
    }

    res.json({ ...report, actions, evidence, clientName, clientEmail, domain: serviceDomain, reputation });
  } catch (err) {
    console.error("[SENTINEL] Get error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Admin: Analyze & score report ────────────────────────────────────────────

router.post("/admin/abuse/:id/analyze", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [report] = await db.select().from(abuseReportsTable)
      .where(eq(abuseReportsTable.id, req.params.id)).limit(1);
    if (!report) { res.status(404).json({ error: "Report not found" }); return; }

    const threat = await computeThreatScore(report.reporterEmail, report.reporterOrg, report.abuseType, report.evidenceLogs, report.clientId);

    const [updated] = await db.update(abuseReportsTable)
      .set({ status: "analyzing", isValid: threat.score >= 40, analysisNotes: threat.notes, threatScore: threat.score, classification: threat.classification as any, sourceCredibility: threat.sourceCredibility, updatedAt: new Date() })
      .where(eq(abuseReportsTable.id, report.id))
      .returning();

    await logAction(report.id, "analyzed", `Sentinel Analysis: ${threat.notes}`, req.user!.userId, req.user!.email);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Admin: Add evidence to vault ─────────────────────────────────────────────

router.post("/admin/abuse/:id/evidence", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { fileName, fileUrl, mimeType, description } = req.body;
    const [report] = await db.select({ id: abuseReportsTable.id }).from(abuseReportsTable)
      .where(eq(abuseReportsTable.id, req.params.id)).limit(1);
    if (!report) { res.status(404).json({ error: "Report not found" }); return; }

    const [ev] = await db.insert(abuseEvidenceTable).values({
      id: crypto.randomUUID(), reportId: report.id,
      fileName: fileName || null, fileUrl: fileUrl || null,
      mimeType: mimeType || null, description: description || null,
      uploadedBy: req.user!.email,
    }).returning();

    await logAction(report.id, "evidence_added", `Evidence added: ${fileName || fileUrl || description}`, req.user!.userId, req.user!.email);
    res.status(201).json(ev);
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
    if (!report.clientId) { res.status(400).json({ error: "No client linked to this report." }); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, report.clientId)).limit(1);
    if (!user) { res.status(400).json({ error: "Client not found" }); return; }

    const domain = report.targetDomain || "your hosting service";
    const branding = await getBranding();
    const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const deadlineStr = deadline.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

    // Create ticket first to get the URL
    const ticketNumber = `ABU-TKT-${Date.now()}`;
    const [ticket] = await db.insert(ticketsTable).values({
      ticketNumber, clientId: user.id,
      subject: `Abuse Notice — ${report.abuseType.toUpperCase()} — ${domain} [Score: ${report.threatScore}/100]`,
      status: "open", priority: "urgent", department: "Abuse",
      messagesCount: 1, lastReply: new Date(),
    }).returning();

    const ticketUrl = `${branding.clientUrl}/tickets/${ticket.id}`;

    // Send appropriate email
    let html: string;
    if (report.isDmca) {
      const dmcaDeadline = report.dmcaDeadlineAt || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const dmcaDeadlineStr = dmcaDeadline.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      html = buildDmcaNoticeHtml({ ...branding, clientName: `${user.firstName} ${user.lastName}`, domain, reportNumber: report.reportNumber, deadlineDate: dmcaDeadlineStr, counterNoticeUrl: `${branding.clientUrl}/tickets/${ticket.id}` });
    } else {
      html = buildAbuseWarningHtml({ ...branding, clientName: `${user.firstName} ${user.lastName}`, domain, abuseType: report.abuseType, reportNumber: report.reportNumber, deadline: deadlineStr, ticketUrl, threatScore: report.threatScore ?? 0, classification: report.classification ?? "low", isDmca: false });
    }

    await sendEmail({
      to: user.email,
      subject: `[${branding.companyName}] ${report.isDmca ? "⚖️ DMCA Takedown Notice" : "⚠️ Abuse Warning"} — Action Required (${report.reportNumber})`,
      html, emailType: report.isDmca ? "dmca_notice" : "abuse_warning", clientId: user.id, referenceId: report.id,
    });

    await db.insert(ticketMessagesTable).values({
      ticketId: ticket.id, senderId: "abuse-system",
      senderName: `${branding.companyName} Abuse Team`, senderRole: "admin",
      message: `Dear ${user.firstName} ${user.lastName},\n\nWe have received an abuse complaint (${report.reportNumber}) for your service at ${domain}.\n\n🔴 Threat Score: ${report.threatScore}/100 (${(report.classification ?? "low").toUpperCase()})\n📧 Type: ${report.abuseType.toUpperCase()}\n⏰ Deadline: ${deadlineStr}\n\nPlease reply here with steps taken to resolve this issue within 48 hours.\n\nIf you believe this is a false report, provide evidence in your reply.\n\n— ${branding.companyName} Abuse Team`,
      attachments: [],
    });

    const [updated] = await db.update(abuseReportsTable)
      .set({ status: "warning_sent", warningEmailSentAt: new Date(), warningDeadline: deadline, ticketId: ticket.id, notifiedClientAt: new Date(), updatedAt: new Date() })
      .where(eq(abuseReportsTable.id, report.id))
      .returning();

    await createNotification(user.id, "security", report.isDmca ? "⚖️ DMCA Notice Issued" : "⚠️ Abuse Warning Issued", `Complaint ${report.reportNumber} — Threat Score: ${report.threatScore}/100. Check your ticket.`, `/client/tickets/${ticket.id}`);
    await logAction(report.id, "warning_sent", `Warning sent to ${user.email}. Ticket ${ticketNumber}. Threat: ${report.threatScore}/100.`, req.user!.userId, req.user!.email);
    await emitActivity({ userId: req.user!.userId, userEmail: req.user!.email ?? "", userName: req.user!.userId, action: `Sent abuse warning for ${report.reportNumber} (Score: ${report.threatScore}/100)`, meta: { type: "abuse_warning", reportId: report.id } });

    res.json({ ...updated, ticketId: ticket.id, ticketNumber });
  } catch (err: any) {
    console.error("[SENTINEL] Warn error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Admin: Suspend / Critical Lockdown ───────────────────────────────────────

router.post("/admin/abuse/:id/suspend", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { reason } = req.body;
    const [report] = await db.select().from(abuseReportsTable)
      .where(eq(abuseReportsTable.id, req.params.id)).limit(1);
    if (!report) { res.status(404).json({ error: "Report not found" }); return; }

    const isCritical = (report.threatScore ?? 0) >= 90;
    let cpanelResult = "No cPanel service linked";
    if (report.serviceId) cpanelResult = await performCpanelSuspend(report.serviceId, reason || `Abuse violation — Report ${report.reportNumber}`);

    if (report.clientId) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, report.clientId)).limit(1);
      if (user) {
        const branding = await getBranding();
        const domain = report.targetDomain || "your hosting service";
        const html = buildAbuseSuspensionHtml({ ...branding, clientName: `${user.firstName} ${user.lastName}`, domain, abuseType: report.abuseType, reportNumber: report.reportNumber, reason: reason || "Abuse policy violation", threatScore: report.threatScore ?? 0, isCritical });
        await sendEmail({ to: user.email, subject: `[${branding.companyName}] 🚫 Service ${isCritical ? "Critical Lockdown" : "Suspended"} (${report.reportNumber})`, html, emailType: "abuse_suspension", clientId: user.id, referenceId: report.id });
        await createNotification(user.id, "security", isCritical ? "🚨 Critical Lockdown" : "🚫 Service Suspended", `Your service has been ${isCritical ? "put in critical lockdown" : "suspended"} (Score: ${report.threatScore}/100).`, `/client/tickets`);
      }
    }

    const newStatus = isCritical ? "critical_lockdown" : "suspended";
    const [updated] = await db.update(abuseReportsTable)
      .set({ status: newStatus as any, suspendedAt: new Date(), updatedAt: new Date() })
      .where(eq(abuseReportsTable.id, report.id))
      .returning();

    await logAction(report.id, isCritical ? "critical_lockdown" : "suspended", `${cpanelResult}. Reason: ${reason || "Abuse policy violation"}`, req.user!.userId, req.user!.email);
    await emitActivity({ userId: req.user!.userId, userEmail: req.user!.email ?? "", userName: req.user!.userId, action: `${isCritical ? "Critical lockdown" : "Suspended"} service for ${report.reportNumber}`, meta: { type: "abuse_suspend", reportId: report.id } });

    res.json(updated);
  } catch (err: any) {
    console.error("[SENTINEL] Suspend error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Admin: DMCA Counter-Notice ───────────────────────────────────────────────

router.post("/admin/abuse/:id/counter-notice", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { counterNoticeText, acceptCounterNotice } = req.body;
    const [report] = await db.select().from(abuseReportsTable)
      .where(eq(abuseReportsTable.id, req.params.id)).limit(1);
    if (!report) { res.status(404).json({ error: "Report not found" }); return; }

    const [updated] = await db.update(abuseReportsTable)
      .set({
        counterNoticeAt: new Date(),
        counterNoticeText: counterNoticeText || null,
        status: acceptCounterNotice ? "resolved" : report.status,
        resolvedAt: acceptCounterNotice ? new Date() : null,
        resolvedBy: acceptCounterNotice ? req.user!.userId : null,
        resolvedNote: acceptCounterNotice ? `DMCA Counter-Notice accepted: ${counterNoticeText}` : null,
        updatedAt: new Date(),
      })
      .where(eq(abuseReportsTable.id, report.id))
      .returning();

    await logAction(report.id, "counter_notice", `Counter-notice ${acceptCounterNotice ? "accepted — case resolved" : "filed — under review"}`, req.user!.userId, req.user!.email);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Admin: Permanent Ban ─────────────────────────────────────────────────────

router.post("/admin/abuse/reputation/:clientId/ban", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { banReason } = req.body;
    const { clientId } = req.params;

    const [existing] = await db.select().from(abuseReputationTable).where(eq(abuseReputationTable.clientId, clientId)).limit(1);
    if (existing) {
      await db.update(abuseReputationTable).set({ isPermanentlyBanned: true, banReason: banReason || "Repeat abuse violations", bannedAt: new Date(), bannedBy: req.user!.userId, updatedAt: new Date() }).where(eq(abuseReputationTable.clientId, clientId));
    } else {
      await db.insert(abuseReputationTable).values({ id: crypto.randomUUID(), clientId, isPermanentlyBanned: true, banReason: banReason || "Repeat abuse violations", bannedAt: new Date(), bannedBy: req.user!.userId });
    }

    // Notify client
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, clientId)).limit(1);
    if (user) {
      await createNotification(user.id, "security", "🚨 Account Permanently Banned", "Your account has been permanently banned for repeated abuse violations.", `/client/tickets`);
    }

    await logAction("ban-" + clientId, "permanent_ban", `Client ${clientId} permanently banned. Reason: ${banReason}`, req.user!.userId, req.user!.email);
    res.json({ success: true, clientId, banned: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Admin: Lift Permanent Ban ────────────────────────────────────────────────

router.post("/admin/abuse/reputation/:clientId/unban", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    await db.update(abuseReputationTable).set({ isPermanentlyBanned: false, banReason: null, bannedAt: null, bannedBy: null, updatedAt: new Date() }).where(eq(abuseReputationTable.clientId, clientId));
    res.json({ success: true, clientId, banned: false });
  } catch (err) {
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
    if (report.serviceId && ["suspended", "critical_lockdown"].includes(report.status)) {
      const [svc] = await db.select().from(hostingServicesTable).where(eq(hostingServicesTable.id, report.serviceId)).limit(1);
      if (svc?.username && svc?.serverId) {
        const [server] = await db.select().from(serversTable).where(eq(serversTable.id, svc.serverId)).limit(1);
        if (server) {
          try {
            const { decryptField } = await import("../lib/fieldCrypto.js");
            const svr = { host: server.ipAddress, port: 2087, username: server.username || "root", apiToken: server.apiToken ? decryptField(server.apiToken) : "", ssl: true };
            await cpanelUnsuspend(svr as any, svc.username);
            await db.update(hostingServicesTable).set({ status: "active", updatedAt: new Date() } as any).where(eq(hostingServicesTable.id, svc.id));
            cpanelResult = "Service unsuspended via WHM";
          } catch (e: any) { cpanelResult = `WHM unsuspend error: ${e.message}`; }
        }
      }
    }

    if (report.clientId) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, report.clientId)).limit(1);
      if (user) await createNotification(user.id, "security", "✅ Abuse Case Resolved", `Your abuse report (${report.reportNumber}) has been resolved. Your service is now active.`, `/client/hosting`);
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

    await logAction(report.id, "dismissed", `Dismissed: ${reason || "false positive"}`, req.user!.userId, req.user!.email);
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

// ─── Admin: Service search ────────────────────────────────────────────────────

router.get("/admin/abuse-services-search", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const q = String(req.query.q || "");
    let services;
    if (q.length >= 2) {
      services = await db.select({ id: hostingServicesTable.id, domain: hostingServicesTable.domain, clientId: hostingServicesTable.clientId, status: hostingServicesTable.status, username: hostingServicesTable.username })
        .from(hostingServicesTable).where(sql`${hostingServicesTable.domain} ILIKE ${"%" + q + "%"}`).limit(20);
    } else {
      services = await db.select({ id: hostingServicesTable.id, domain: hostingServicesTable.domain, clientId: hostingServicesTable.clientId, status: hostingServicesTable.status, username: hostingServicesTable.username })
        .from(hostingServicesTable).limit(20);
    }
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Client: File Counter-Notice (DMCA) ──────────────────────────────────────

router.post("/abuse/:reportId/counter-notice", authenticate, async (req: AuthRequest, res) => {
  try {
    const { counterNoticeText } = req.body;
    if (!counterNoticeText || counterNoticeText.length < 50) {
      res.status(400).json({ error: "Counter-notice statement must be at least 50 characters." });
      return;
    }
    const [report] = await db.select().from(abuseReportsTable)
      .where(and(eq(abuseReportsTable.id, req.params.reportId), eq(abuseReportsTable.clientId, req.user!.userId))).limit(1);
    if (!report) { res.status(404).json({ error: "Report not found or not associated with your account." }); return; }
    if (!report.isDmca) { res.status(400).json({ error: "Counter-notices are only applicable to DMCA reports." }); return; }

    await db.update(abuseReportsTable).set({ counterNoticeAt: new Date(), counterNoticeText, updatedAt: new Date() }).where(eq(abuseReportsTable.id, report.id));
    await logAction(report.id, "client_counter_notice", `Client filed counter-notice: ${counterNoticeText.substring(0, 100)}...`, req.user!.userId, req.user!.email);

    res.json({ success: true, message: "Your counter-notice has been filed. Our team will review it within 24–48 hours." });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Admin: Ticket reply keyword detection (update score on resolution) ───────

router.post("/admin/abuse/:id/score-adjust", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { ticketReply, adjustScore } = req.body;
    const [report] = await db.select().from(abuseReportsTable)
      .where(eq(abuseReportsTable.id, req.params.id)).limit(1);
    if (!report) { res.status(404).json({ error: "Report not found" }); return; }

    const replyLower = (ticketReply || "").toLowerCase();
    const hasResolutionKeywords = RESOLUTION_KEYWORDS.some(kw => replyLower.includes(kw));
    let newScore = report.threatScore ?? 0;

    if (hasResolutionKeywords || adjustScore < 0) {
      const delta = adjustScore ?? -15;
      newScore = Math.max(1, Math.min(100, newScore + delta));
    } else if (adjustScore > 0) {
      newScore = Math.min(100, newScore + adjustScore);
    }

    const newClass: any = newScore >= 90 ? "critical" : newScore >= 65 ? "high" : newScore >= 40 ? "medium" : "low";
    const [updated] = await db.update(abuseReportsTable)
      .set({ threatScore: newScore, classification: newClass, updatedAt: new Date() })
      .where(eq(abuseReportsTable.id, report.id))
      .returning();

    const note = hasResolutionKeywords
      ? `Score adjusted from ${report.threatScore} → ${newScore}: Resolution keywords detected in reply.`
      : `Manual score adjustment: ${report.threatScore} → ${newScore}`;
    await logAction(report.id, "score_adjusted", note, req.user!.userId, req.user!.email);
    res.json({ ...updated, hasResolutionKeywords, previousScore: report.threatScore });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Cron: Auto-enforce deadline exceeded reports + high threat auto-suspend ───

export async function runAbuseEnforcementCron(): Promise<void> {
  try {
    const now = new Date();

    // 1. Deadline-exceeded reports
    const overdueReports = await db.select().from(abuseReportsTable)
      .where(and(eq(abuseReportsTable.status, "warning_sent"), sql`${abuseReportsTable.warningDeadline} < ${now}`));

    if (overdueReports.length > 0) {
      console.log(`[CRON][SENTINEL] ${overdueReports.length} overdue abuse report(s) to auto-enforce`);
      for (const report of overdueReports) {
        try {
          const isCritical = (report.threatScore ?? 0) >= 90;
          let cpanelResult = "No service linked";
          if (report.serviceId) cpanelResult = await performCpanelSuspend(report.serviceId, `Auto-suspended: deadline exceeded (Report ${report.reportNumber})`);

          if (report.clientId) {
            const [user] = await db.select().from(usersTable).where(eq(usersTable.id, report.clientId)).limit(1);
            if (user) {
              const branding = await getBranding();
              const domain = report.targetDomain || "your hosting service";
              const html = buildAbuseSuspensionHtml({ ...branding, clientName: `${user.firstName} ${user.lastName}`, domain, abuseType: report.abuseType, reportNumber: report.reportNumber, reason: "Warning deadline exceeded — automatic enforcement triggered", threatScore: report.threatScore ?? 0, isCritical });
              await sendEmail({ to: user.email, subject: `[${branding.companyName}] Service Auto-Suspended — Deadline Exceeded (${report.reportNumber})`, html, emailType: "abuse_auto_suspension", clientId: user.id, referenceId: report.id });
              await createNotification(user.id, "security", "Service Auto-Suspended", `Your service was automatically suspended after the abuse deadline expired (${report.reportNumber}).`, `/client/tickets`);
            }
          }

          await db.update(abuseReportsTable)
            .set({ status: isCritical ? "critical_lockdown" as any : "suspended", suspendedAt: now, autoSuspended: true, updatedAt: now })
            .where(eq(abuseReportsTable.id, report.id));
          await logAction(report.id, "auto_suspended", `${cpanelResult}. Deadline exceeded.`, "system-cron");
          console.log(`[CRON][SENTINEL] Auto-suspended ${report.reportNumber}`);
        } catch (e: any) {
          console.error(`[CRON][SENTINEL] Failed ${report.reportNumber}:`, e.message);
        }
      }
    }

    // 2. DMCA deadline exceeded — flag for admin
    const dmcaOverdue = await db.select().from(abuseReportsTable)
      .where(and(eq(abuseReportsTable.isDmca, true), sql`${abuseReportsTable.dmcaDeadlineAt} < ${now}`, eq(abuseReportsTable.status, "warning_sent")));

    for (const report of dmcaOverdue) {
      await db.update(abuseReportsTable).set({ status: "suspended" as any, suspendedAt: now, updatedAt: now }).where(eq(abuseReportsTable.id, report.id));
      await logAction(report.id, "dmca_auto_takedown", "DMCA deadline exceeded — content auto-flagged for takedown", "system-cron");
      console.log(`[CRON][SENTINEL] DMCA deadline exceeded: ${report.reportNumber}`);
    }
  } catch (err: any) {
    console.error("[CRON][SENTINEL] Enforcement cron error:", err.message);
  }
}

export default router;
