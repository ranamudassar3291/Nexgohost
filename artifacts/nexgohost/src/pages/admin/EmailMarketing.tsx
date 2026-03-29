import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const BRAND = "#4F46E5";
const API = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` };
}

// ─── Pre-built campaign templates ─────────────────────────────────────────────
const TEMPLATES = [
  {
    id: "promotional",
    name: "🎉 Promotional Offer",
    subject: "Exclusive Offer Just For You — {company_name}",
    html: `<h2 style="color:#4F46E5;margin:0 0 16px">We have a special offer for you! 🎉</h2>
<p>Hi <strong>{client_name}</strong>,</p>
<p>As a valued {company_name} customer, we're excited to share an exclusive deal with you.</p>
<table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;width:100%">
  <tr><td style="background:#f4f0ff;border:2px dashed #4F46E5;border-radius:8px;padding:20px;text-align:center">
    <p style="margin:0 0 4px;font-size:13px;color:#666;text-transform:uppercase;letter-spacing:1px">Limited Time Offer</p>
    <p style="margin:0;font-size:22px;font-weight:800;color:#4F46E5">20% OFF All Hosting Plans</p>
    <p style="margin:8px 0 0;font-size:12px;color:#888">Use code: <strong>SPECIAL20</strong> at checkout</p>
  </td></tr>
</table>
<p style="text-align:center;margin:24px 0">
  <a href="https://noehost.com/client/hosting" style="display:inline-block;background:linear-gradient(135deg,#4F46E5,#6366F1);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:700">Claim Your Discount →</a>
</p>
<p style="font-size:13px;color:#666">This offer expires soon. Don't miss out!</p>`,
  },
  {
    id: "maintenance",
    name: "🔧 Maintenance Alert",
    subject: "Scheduled Maintenance Notice — {company_name}",
    html: `<h2 style="color:#F59E0B;margin:0 0 16px">Scheduled Maintenance 🔧</h2>
<p>Hi <strong>{client_name}</strong>,</p>
<p>We want to inform you about upcoming scheduled maintenance for our infrastructure.</p>
<table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:24px 0;border-collapse:collapse">
  <tr><td style="background:#FEF9C3;border:1px solid #F59E0B;border-radius:8px;padding:16px 20px">
    <p style="margin:0 0 8px;font-weight:700;color:#92400E">📅 Maintenance Window</p>
    <p style="margin:0 0 4px;color:#78350F"><strong>Date:</strong> [Insert Date Here]</p>
    <p style="margin:0 0 4px;color:#78350F"><strong>Time:</strong> [Insert Time Here]</p>
    <p style="margin:0;color:#78350F"><strong>Duration:</strong> Approximately [X] hours</p>
  </td></tr>
</table>
<p>During this time, some services may be temporarily unavailable. We apologize for any inconvenience.</p>
<p>Our team will work to minimize downtime. If you have any questions, please contact our support team.</p>`,
  },
  {
    id: "welcome",
    name: "👋 Welcome & Offer",
    subject: "Welcome to {company_name}! Here's a gift 🎁",
    html: `<h2 style="color:#4F46E5;margin:0 0 16px">Welcome to {company_name}! 🎉</h2>
<p>Hi <strong>{client_name}</strong>,</p>
<p>Thank you for joining {company_name}! We're thrilled to have you as part of our community.</p>
<p>To help you get started, we'd like to offer you a special welcome discount:</p>
<table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;width:100%">
  <tr><td style="background:#f4f0ff;border:2px dashed #4F46E5;border-radius:8px;padding:20px;text-align:center">
    <p style="margin:0 0 4px;font-size:13px;color:#666;text-transform:uppercase;letter-spacing:1px">Welcome Gift</p>
    <p style="margin:0;font-size:24px;font-weight:800;color:#4F46E5">15% OFF Your First Order</p>
    <p style="margin:8px 0 0;font-size:12px;color:#888">Code: <strong>WELCOME15</strong></p>
  </td></tr>
</table>
<p>Explore our hosting plans, domain registration, and much more at your dashboard.</p>
<p style="text-align:center;margin:24px 0">
  <a href="https://noehost.com/client/dashboard" style="display:inline-block;background:linear-gradient(135deg,#4F46E5,#6366F1);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:700">Go to Dashboard →</a>
</p>`,
  },
  {
    id: "announcement",
    name: "📢 General Announcement",
    subject: "Important Update from {company_name}",
    html: `<h2 style="color:#4F46E5;margin:0 0 16px">Important Announcement 📢</h2>
<p>Hi <strong>{client_name}</strong>,</p>
<p>We have an important update to share with you from {company_name}.</p>
<p>[Write your announcement content here. Be clear and concise.]</p>
<p>If you have any questions or need assistance, our support team is always ready to help.</p>
<p style="text-align:center;margin:24px 0">
  <a href="https://noehost.com/client/tickets/new" style="display:inline-block;background:linear-gradient(135deg,#4F46E5,#6366F1);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:700">Contact Support →</a>
</p>`,
  },
  {
    id: "security",
    name: "🔐 Security Notice",
    subject: "Security Notice — Action Required | {company_name}",
    html: `<h2 style="color:#DC2626;margin:0 0 16px">Security Notice 🔐</h2>
<p>Hi <strong>{client_name}</strong>,</p>
<table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 24px">
  <tr><td style="background:#FEE2E2;border:1px solid #DC2626;border-radius:8px;padding:16px 20px">
    <p style="margin:0;font-weight:700;color:#991B1B">⚠️ Important Security Information</p>
  </td></tr>
</table>
<p>We're reaching out regarding your {company_name} account security.</p>
<p>[Describe the security notice or action required here.]</p>
<p>If you did not initiate any of these actions, please contact us immediately via WhatsApp or open a support ticket.</p>
<p style="text-align:center;margin:24px 0">
  <a href="https://noehost.com/client/tickets/new" style="display:inline-block;background:#DC2626;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:700">Report This Now →</a>
</p>`,
  },
  {
    id: "custom",
    name: "✏️ Custom (Write Your Own)",
    subject: "",
    html: "",
  },
];

type Client = { id: string; email: string; firstName: string; lastName: string };
type EmailLog = { id: string; email: string; emailType: string; subject: string; status: string; sentAt: string; errorMessage?: string };
type Campaign = { id: string; name: string; subject: string; sentCount: number; failedCount: number; status: string; createdAt: string; sentAt?: string };
type Abandonment = { id: string; userEmail: string; userName: string; packageName: string; domainName: string; completed: boolean; reminderSent: boolean; promoCode?: string; abandonedAt: string };

export default function EmailMarketing() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"send" | "logs" | "campaigns" | "abandonments">("send");

  // ─── Send Campaign state ──────────────────────────────────────────────────
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);
  const [subject, setSubject] = useState(TEMPLATES[0].subject);
  const [htmlBody, setHtmlBody] = useState(TEMPLATES[0].html);
  const [recipientType, setRecipientType] = useState<"all" | "selected">("all");
  const [clientSearch, setClientSearch] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [previewHtml, setPreviewHtml] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [campaignName, setCampaignName] = useState("");

  // ─── Logs state ──────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState("all");
  const [logsPage, setLogsPage] = useState(1);

  // ─── Campaigns state ─────────────────────────────────────────────────────
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);

  // ─── Abandonments state ──────────────────────────────────────────────────
  const [abandonments, setAbandönments] = useState<Abandonment[]>([]);
  const [abandonmentsLoading, setAbandonmentsLoading] = useState(false);

  // ─── Fetch clients ────────────────────────────────────────────────────────
  const fetchClients = useCallback(async (q?: string) => {
    setLoadingClients(true);
    try {
      const url = `${API}/admin/email-marketing/clients${q ? `?search=${encodeURIComponent(q)}` : ""}`;
      const res = await fetch(url, { headers: authHeaders() });
      const data = await res.json();
      setClients(Array.isArray(data) ? data : []);
    } catch { setClients([]); }
    finally { setLoadingClients(false); }
  }, []);

  useEffect(() => {
    if (tab === "send" && recipientType === "selected") fetchClients();
  }, [tab, recipientType]);

  useEffect(() => {
    if (clientSearch.length === 0 || clientSearch.length > 1) {
      fetchClients(clientSearch || undefined);
    }
  }, [clientSearch]);

  // ─── Fetch logs ───────────────────────────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const url = `${API}/admin/email-marketing/logs?page=${logsPage}&limit=50${logFilter !== "all" ? `&emailType=${logFilter}` : ""}`;
      const res = await fetch(url, { headers: authHeaders() });
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch { setLogs([]); }
    finally { setLogsLoading(false); }
  }, [logFilter, logsPage]);

  useEffect(() => {
    if (tab === "logs") fetchLogs();
  }, [tab, logFilter, logsPage]);

  // ─── Fetch campaigns ──────────────────────────────────────────────────────
  const fetchCampaigns = useCallback(async () => {
    setCampaignsLoading(true);
    try {
      const res = await fetch(`${API}/admin/email-marketing/campaigns`, { headers: authHeaders() });
      const data = await res.json();
      setCampaigns(Array.isArray(data) ? data : []);
    } catch { setCampaigns([]); }
    finally { setCampaignsLoading(false); }
  }, []);

  // ─── Fetch abandonments ───────────────────────────────────────────────────
  const fetchAbandonments = useCallback(async () => {
    setAbandonmentsLoading(true);
    try {
      const res = await fetch(`${API}/admin/email-marketing/abandonments`, { headers: authHeaders() });
      const data = await res.json();
      setAbandönments(Array.isArray(data) ? data : []);
    } catch { setAbandönments([]); }
    finally { setAbandonmentsLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === "campaigns") fetchCampaigns();
    if (tab === "abandonments") fetchAbandonments();
  }, [tab]);

  // ─── Template selector ────────────────────────────────────────────────────
  const handleTemplateChange = (templateId: string) => {
    const t = TEMPLATES.find(t => t.id === templateId)!;
    setSelectedTemplate(t);
    setSubject(t.subject);
    setHtmlBody(t.html);
    setShowPreview(false);
  };

  // ─── Preview ──────────────────────────────────────────────────────────────
  const handlePreview = async () => {
    try {
      const res = await fetch(`${API}/admin/email-marketing/preview`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ subject, htmlBody }),
      });
      const data = await res.json();
      setPreviewHtml(data.html || "");
      setShowPreview(true);
    } catch {
      toast({ title: "Preview failed", variant: "destructive" });
    }
  };

  // ─── Send campaign ────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!subject.trim()) { toast({ title: "Subject is required", variant: "destructive" }); return; }
    if (!htmlBody.trim()) { toast({ title: "Email body is required", variant: "destructive" }); return; }
    if (recipientType === "selected" && selectedClients.size === 0) {
      toast({ title: "Select at least one recipient", variant: "destructive" }); return;
    }

    const confirm = window.confirm(
      recipientType === "all"
        ? "Send this campaign to ALL active clients? This cannot be undone."
        : `Send this campaign to ${selectedClients.size} selected client(s)?`
    );
    if (!confirm) return;

    setSending(true);
    try {
      const res = await fetch(`${API}/admin/email-marketing/send`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          name: campaignName || subject,
          subject,
          htmlBody,
          recipientType,
          recipientIds: recipientType === "selected" ? Array.from(selectedClients) : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");

      toast({ title: `Campaign sent to ${data.totalRecipients} recipient(s)!` });
      setSelectedClients(new Set());
      setCampaignName("");
    } catch (err: any) {
      toast({ title: err.message || "Send failed", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const toggleClient = (id: string) => {
    setSelectedClients(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllClients = () => {
    if (selectedClients.size === clients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(clients.map(c => c.id)));
    }
  };

  const TABS = [
    { id: "send", label: "Send Campaign" },
    { id: "logs", label: "Email Logs" },
    { id: "campaigns", label: "Campaign History" },
    { id: "abandonments", label: "Cart Recoveries" },
  ] as const;

  const LOG_TYPES = ["all", "campaign", "cart-abandonment", "invoice-created", "invoice-paid", "order-created", "system"];

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* ─── Header ─── */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 4px", color: "#111" }}>
          Email Marketing
        </h1>
        <p style={{ margin: 0, color: "#666", fontSize: "14px" }}>
          Send bulk campaigns, view email logs, and track cart abandonment recovery
        </p>
      </div>

      {/* ─── Tabs ─── */}
      <div style={{ display: "flex", gap: "4px", borderBottom: "2px solid #f0f0f0", marginBottom: "28px" }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "10px 20px",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? BRAND : "#555",
              borderBottom: `2px solid ${tab === t.id ? BRAND : "transparent"}`,
              marginBottom: "-2px",
              transition: "all 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════ SEND CAMPAIGN TAB ══════════════════════════════════ */}
      {tab === "send" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          {/* Left column */}
          <div>
            {/* Template selector */}
            <div style={{ marginBottom: "20px" }}>
              <label style={labelStyle}>Template</label>
              <select
                value={selectedTemplate.id}
                onChange={e => handleTemplateChange(e.target.value)}
                style={selectStyle}
              >
                {TEMPLATES.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Campaign name */}
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Campaign Name (internal)</label>
              <Input
                value={campaignName}
                onChange={e => setCampaignName(e.target.value)}
                placeholder="e.g. Black Friday 2025"
              />
            </div>

            {/* Subject */}
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Email Subject *</label>
              <Input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Enter email subject..."
              />
            </div>

            {/* HTML body */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Email Body (HTML) *</label>
                <span style={{ fontSize: "11px", color: "#888" }}>
                  Tags: {"{client_name}"} {"{company_name}"} {"{unsubscribe_url}"}
                </span>
              </div>
              <textarea
                value={htmlBody}
                onChange={e => setHtmlBody(e.target.value)}
                rows={16}
                style={{
                  width: "100%",
                  fontFamily: "'Courier New', monospace",
                  fontSize: "13px",
                  border: "1px solid #e5e5e5",
                  borderRadius: "8px",
                  padding: "12px",
                  resize: "vertical",
                  outline: "none",
                  boxSizing: "border-box",
                  background: "#fafafa",
                }}
                placeholder="<h2>Hello {client_name}!</h2><p>Your message here...</p>"
              />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <Button variant="outline" onClick={handlePreview} style={{ flex: 1 }}>
                Preview Email
              </Button>
              <Button
                onClick={handleSend}
                disabled={sending}
                style={{ flex: 1, background: "linear-gradient(135deg,#4F46E5,#6366F1)", color: "#fff" }}
              >
                {sending ? "Sending..." : "Send Campaign"}
              </Button>
            </div>
          </div>

          {/* Right column */}
          <div>
            {/* Recipients */}
            <div style={{ marginBottom: "20px" }}>
              <label style={labelStyle}>Recipients</label>
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                {(["all", "selected"] as const).map(rt => (
                  <button
                    key={rt}
                    onClick={() => setRecipientType(rt)}
                    style={{
                      padding: "8px 20px",
                      borderRadius: "6px",
                      border: `2px solid ${recipientType === rt ? BRAND : "#e5e5e5"}`,
                      background: recipientType === rt ? "#f4f0ff" : "#fff",
                      color: recipientType === rt ? BRAND : "#555",
                      fontWeight: recipientType === rt ? 700 : 500,
                      cursor: "pointer",
                      fontSize: "14px",
                    }}
                  >
                    {rt === "all" ? "All Active Clients" : "Select Clients"}
                  </button>
                ))}
              </div>

              {recipientType === "selected" && (
                <div style={{ border: "1px solid #e5e5e5", borderRadius: "8px", overflow: "hidden" }}>
                  <div style={{ padding: "10px 12px", borderBottom: "1px solid #f0f0f0", background: "#fafafa" }}>
                    <Input
                      value={clientSearch}
                      onChange={e => setClientSearch(e.target.value)}
                      placeholder="Search clients by name or email..."
                      style={{ border: "1px solid #e0e0e0" }}
                    />
                  </div>
                  <div style={{ padding: "8px 12px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "13px", color: "#666" }}>
                      {loadingClients ? "Loading..." : `${clients.length} clients found`}
                    </span>
                    <button onClick={toggleAllClients} style={{ fontSize: "12px", color: BRAND, border: "none", background: "none", cursor: "pointer", fontWeight: 600 }}>
                      {selectedClients.size === clients.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>
                  <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                    {clients.map(c => (
                      <label
                        key={c.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "10px 12px",
                          cursor: "pointer",
                          borderBottom: "1px solid #f5f5f5",
                          background: selectedClients.has(c.id) ? "#f4f0ff" : "#fff",
                          transition: "background 0.1s",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedClients.has(c.id)}
                          onChange={() => toggleClient(c.id)}
                          style={{ accentColor: BRAND }}
                        />
                        <div>
                          <div style={{ fontSize: "14px", fontWeight: 500 }}>{c.firstName} {c.lastName}</div>
                          <div style={{ fontSize: "12px", color: "#888" }}>{c.email}</div>
                        </div>
                      </label>
                    ))}
                    {!loadingClients && clients.length === 0 && (
                      <div style={{ padding: "20px", textAlign: "center", color: "#999", fontSize: "13px" }}>
                        No clients found
                      </div>
                    )}
                  </div>
                  {selectedClients.size > 0 && (
                    <div style={{ padding: "8px 12px", background: "#f4f0ff", borderTop: "1px solid #e5e5e5", fontSize: "13px", color: BRAND, fontWeight: 600 }}>
                      {selectedClients.size} client(s) selected
                    </div>
                  )}
                </div>
              )}

              {recipientType === "all" && (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "12px 16px", fontSize: "13px", color: "#166534" }}>
                  This campaign will be sent to all active clients. Unsubscribed users will be automatically excluded.
                </div>
              )}
            </div>

            {/* Preview */}
            {showPreview && previewHtml && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label style={labelStyle}>Email Preview</label>
                  <button onClick={() => setShowPreview(false)} style={{ fontSize: "12px", color: "#888", border: "none", background: "none", cursor: "pointer" }}>
                    Close
                  </button>
                </div>
                <div style={{ border: "1px solid #e5e5e5", borderRadius: "8px", overflow: "hidden", height: "400px" }}>
                  <iframe
                    srcDoc={previewHtml}
                    style={{ width: "100%", height: "100%", border: "none" }}
                    title="Email Preview"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════ LOGS TAB ══════════════════════════════════ */}
      {tab === "logs" && (
        <div>
          {/* Filter */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            {LOG_TYPES.map(t => (
              <button
                key={t}
                onClick={() => { setLogFilter(t); setLogsPage(1); }}
                style={{
                  padding: "6px 14px",
                  borderRadius: "20px",
                  border: `1px solid ${logFilter === t ? BRAND : "#e5e5e5"}`,
                  background: logFilter === t ? "#f4f0ff" : "#fff",
                  color: logFilter === t ? BRAND : "#555",
                  fontWeight: logFilter === t ? 700 : 500,
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                {t}
              </button>
            ))}
            <button onClick={fetchLogs} style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: "6px", border: "1px solid #e5e5e5", background: "#fff", cursor: "pointer", fontSize: "13px" }}>
              Refresh
            </button>
          </div>

          {logsLoading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#888" }}>Loading logs...</div>
          ) : (
            <div style={{ border: "1px solid #e5e5e5", borderRadius: "10px", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#fafafa", borderBottom: "1px solid #e5e5e5" }}>
                    {["Recipient", "Type", "Subject", "Status", "Sent At"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={log.id} style={{ borderBottom: "1px solid #f5f5f5", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={tdStyle}>{log.email}</td>
                      <td style={tdStyle}>
                        <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600, background: typeColor(log.emailType).bg, color: typeColor(log.emailType).text }}>
                          {log.emailType}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.subject || "—"}</td>
                      <td style={tdStyle}>
                        <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700, background: log.status === "success" ? "#d1fae5" : "#fee2e2", color: log.status === "success" ? "#065f46" : "#991b1b" }}>
                          {log.status}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontSize: "12px", color: "#666" }}>{format(new Date(log.sentAt), "MMM d, yyyy HH:mm")}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: "32px", textAlign: "center", color: "#999" }}>No email logs found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {logs.length >= 50 && (
            <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "16px" }}>
              <Button variant="outline" disabled={logsPage === 1} onClick={() => setLogsPage(p => p - 1)}>Previous</Button>
              <span style={{ padding: "8px 16px", fontSize: "14px", color: "#555" }}>Page {logsPage}</span>
              <Button variant="outline" onClick={() => setLogsPage(p => p + 1)}>Next</Button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════ CAMPAIGNS TAB ══════════════════════════════════ */}
      {tab === "campaigns" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
            <Button variant="outline" onClick={fetchCampaigns}>Refresh</Button>
          </div>
          {campaignsLoading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#888" }}>Loading campaigns...</div>
          ) : (
            <div style={{ border: "1px solid #e5e5e5", borderRadius: "10px", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#fafafa", borderBottom: "1px solid #e5e5e5" }}>
                    {["Campaign Name", "Subject", "Sent", "Failed", "Status", "Date"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c, i) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid #f5f5f5", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{c.name}</td>
                      <td style={{ ...tdStyle, maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.subject}</td>
                      <td style={{ ...tdStyle, color: "#065f46", fontWeight: 700 }}>{c.sentCount}</td>
                      <td style={{ ...tdStyle, color: c.failedCount > 0 ? "#dc2626" : "#999", fontWeight: c.failedCount > 0 ? 700 : 400 }}>{c.failedCount}</td>
                      <td style={tdStyle}>
                        <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700, background: c.status === "sent" ? "#d1fae5" : "#fef9c3", color: c.status === "sent" ? "#065f46" : "#92400e" }}>
                          {c.status}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontSize: "12px", color: "#666" }}>{format(new Date(c.createdAt), "MMM d, yyyy")}</td>
                    </tr>
                  ))}
                  {campaigns.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "#999" }}>No campaigns sent yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════ ABANDONMENTS TAB ══════════════════════════════════ */}
      {tab === "abandonments" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>
              Tracks when logged-in users start checkout but don't complete it. Recovery emails are sent automatically after 2 hours with a unique 10% promo code.
            </p>
            <Button variant="outline" onClick={fetchAbandonments}>Refresh</Button>
          </div>
          {abandonmentsLoading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#888" }}>Loading...</div>
          ) : (
            <div style={{ border: "1px solid #e5e5e5", borderRadius: "10px", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#fafafa", borderBottom: "1px solid #e5e5e5" }}>
                    {["Client", "Package", "Domain", "Promo Code", "Status", "Abandoned At"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {abandonments.map((a, i) => (
                    <tr key={a.id} style={{ borderBottom: "1px solid #f5f5f5", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 500 }}>{a.userName || "—"}</div>
                        <div style={{ fontSize: "12px", color: "#888" }}>{a.userEmail}</div>
                      </td>
                      <td style={{ ...tdStyle, fontSize: "13px" }}>{a.packageName || "—"}</td>
                      <td style={{ ...tdStyle, fontSize: "13px", fontFamily: "monospace" }}>{a.domainName || "—"}</td>
                      <td style={tdStyle}>
                        {a.promoCode
                          ? <span style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: 700, color: BRAND }}>{a.promoCode}</span>
                          : <span style={{ color: "#bbb", fontSize: "13px" }}>—</span>
                        }
                      </td>
                      <td style={tdStyle}>
                        {a.completed ? (
                          <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700, background: "#d1fae5", color: "#065f46" }}>Completed</span>
                        ) : a.reminderSent ? (
                          <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700, background: "#fef9c3", color: "#92400e" }}>Email Sent</span>
                        ) : (
                          <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700, background: "#fee2e2", color: "#991b1b" }}>Abandoned</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, fontSize: "12px", color: "#666" }}>{format(new Date(a.abandonedAt), "MMM d, yyyy HH:mm")}</td>
                    </tr>
                  ))}
                  {abandonments.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "#999" }}>No cart abandonment sessions tracked yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  fontWeight: 600,
  color: "#444",
  marginBottom: "6px",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid #e5e5e5",
  borderRadius: "8px",
  fontSize: "14px",
  outline: "none",
  background: "#fff",
  cursor: "pointer",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: "14px",
  color: "#333",
};

function typeColor(type: string): { bg: string; text: string } {
  switch (type) {
    case "campaign": return { bg: "#f4f0ff", text: "#5b21b6" };
    case "cart-abandonment": return { bg: "#fef3c7", text: "#92400e" };
    case "invoice-created": return { bg: "#eff6ff", text: "#1d4ed8" };
    case "invoice-paid": return { bg: "#d1fae5", text: "#065f46" };
    case "order-created": return { bg: "#e0f2fe", text: "#0369a1" };
    default: return { bg: "#f3f4f6", text: "#374151" };
  }
}
