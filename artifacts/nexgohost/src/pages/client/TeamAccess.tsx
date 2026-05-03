import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users2, KeyRound, ShieldCheck, Plus, Trash2, Copy, Check,
  RefreshCw, Loader2, Link2, Globe, Clock, UserCog, AlertTriangle,
  CheckCircle2, XCircle, Eye, ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ───────────────────────────────────────────────────────────────────
interface TeamMember { id: string; email: string; name: string; role: string; status: string; created_at: string; }
interface MagicLink { id: string; token: string; label: string; expires_at: string; used_at: string | null; used_ip: string | null; created_at: string; }
interface AccessLog { id: string; actor_email: string; actor_role: string; ip_address: string; action: string; user_agent: string | null; created_at: string; }

// ─── Constants ───────────────────────────────────────────────────────────────
const ROLE_META: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  support_only:  { label: "Support Only",  color: "#0EA5E9", bg: "#E0F2FE", desc: "Can open & reply to support tickets" },
  billing_only:  { label: "Billing Only",  color: "#8B5CF6", bg: "#EDE9FE", desc: "Can view invoices and billing info" },
  developer:     { label: "Developer",     color: "#10B981", bg: "#ECFDF5", desc: "Can access hosting files & databases" },
  full_access:   { label: "Full Access",   color: "#F59E0B", bg: "#FFFBEB", desc: "Full read/write access to account" },
};

// ─── Utility ─────────────────────────────────────────────────────────────────
function authHeaders() {
  const t = localStorage.getItem("token");
  return { Authorization: `Bearer ${t}`, "Content-Type": "application/json" };
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatExpiry(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  if (diff < 0) return { label: "Expired", expired: true };
  if (diff < 3600) return { label: `${Math.floor(diff / 60)}m left`, expired: false };
  if (diff < 86400) return { label: `${Math.floor(diff / 3600)}h left`, expired: false };
  return { label: `${Math.floor(diff / 86400)}d left`, expired: false };
}

function buildLink(token: string) {
  return `${window.location.origin}/api/team/verify/${token}`;
}

// ─── Copy Button ─────────────────────────────────────────────────────────────
function CopyBtn({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handle} className={className}
      style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#F9FAFB", cursor: "pointer", fontSize: 12, color: "#374151" }}>
      {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ─── Role Badge ───────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const m = ROLE_META[role] ?? { label: role, color: "#6B7280", bg: "#F3F4F6" };
  return (
    <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, color: m.color, background: m.bg }}>
      {m.label}
    </span>
  );
}

// ─── Add Member Modal ─────────────────────────────────────────────────────────
function AddMemberModal({ onClose, onSave }: { onClose: () => void; onSave: (data: any) => void }) {
  const [form, setForm] = useState({ email: "", name: "", role: "developer" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.email || !form.name) { setError("Email and name are required."); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/my/team", { method: "POST", headers: authHeaders(), body: JSON.stringify(form) });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Failed"); setLoading(false); return; }
      onSave(d);
    } catch { setError("Network error"); setLoading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        style={{ background: "#fff", borderRadius: 20, padding: 28, width: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
        <h3 style={{ fontSize: 17, fontWeight: 800, color: "#111827", marginBottom: 4 }}>Add Team Member</h3>
        <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>They'll be logged when they access your account.</p>

        {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px", marginBottom: 16, color: "#DC2626", fontSize: 13 }}>{error}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>Full Name</label>
            <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Ali Hassan"
              style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>Email Address</label>
            <input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="developer@company.com"
              style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>Permission Level</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {Object.entries(ROLE_META).map(([k, m]) => (
                <button key={k} onClick={() => set("role", k)}
                  style={{ padding: "10px 12px", borderRadius: 12, border: `2px solid ${form.role === k ? m.color : "#E5E7EB"}`, background: form.role === k ? m.bg : "#fff", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: m.color, display: "block" }}>{m.label}</span>
                  <span style={{ fontSize: 11, color: "#6B7280" }}>{m.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 12, border: "1px solid #E5E7EB", background: "#F9FAFB", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>Cancel</button>
          <button onClick={submit} disabled={loading}
            style={{ flex: 2, padding: "10px", borderRadius: 12, border: "none", background: "#4F46E5", color: "#fff", cursor: loading ? "default" : "pointer", fontWeight: 700, fontSize: 14, opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {loading ? "Adding..." : "Add Member"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TeamAccess() {
  const [tab, setTab] = useState<"members" | "links" | "logs">("members");
  const [showAdd, setShowAdd] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkLabel, setLinkLabel] = useState("Developer Access");
  const [linkLoading, setLinkLoading] = useState(false);
  const [newLink, setNewLink] = useState<MagicLink | null>(null);
  const [roleEditing, setRoleEditing] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: membersData, isLoading: membersLoading } = useQuery<{ members: TeamMember[] }>({
    queryKey: ["my-team"],
    queryFn: () => fetch("/api/my/team", { headers: authHeaders() }).then(r => r.json()),
    staleTime: 30_000,
  });
  const { data: linksData, isLoading: linksLoading, refetch: refetchLinks } = useQuery<{ links: MagicLink[] }>({
    queryKey: ["my-team-links"],
    queryFn: () => fetch("/api/my/team/magic-links", { headers: authHeaders() }).then(r => r.json()),
    staleTime: 30_000,
  });
  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery<{ logs: AccessLog[] }>({
    queryKey: ["my-team-logs"],
    queryFn: () => fetch("/api/my/team/access-logs", { headers: authHeaders() }).then(r => r.json()),
    staleTime: 30_000,
  });

  const removeMember = async (id: string) => {
    await fetch(`/api/my/team/${id}`, { method: "DELETE", headers: authHeaders() });
    qc.invalidateQueries({ queryKey: ["my-team"] });
    qc.invalidateQueries({ queryKey: ["my-team-logs"] });
  };

  const updateRole = async (id: string, role: string) => {
    await fetch(`/api/my/team/${id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ role }) });
    qc.invalidateQueries({ queryKey: ["my-team"] });
    qc.invalidateQueries({ queryKey: ["my-team-logs"] });
    setRoleEditing(null);
  };

  const revokeLink = async (id: string) => {
    await fetch(`/api/my/team/magic-link/${id}`, { method: "DELETE", headers: authHeaders() });
    qc.invalidateQueries({ queryKey: ["my-team-links"] });
    qc.invalidateQueries({ queryKey: ["my-team-logs"] });
  };

  const generateLink = async () => {
    setLinkLoading(true);
    const r = await fetch("/api/my/team/magic-link", { method: "POST", headers: authHeaders(), body: JSON.stringify({ label: linkLabel }) });
    const d = await r.json();
    setLinkLoading(false);
    if (d.ok) {
      setNewLink(d);
      qc.invalidateQueries({ queryKey: ["my-team-links"] });
      qc.invalidateQueries({ queryKey: ["my-team-logs"] });
    }
    setShowLinkModal(false);
  };

  const members  = membersData?.members ?? [];
  const links    = linksData?.links    ?? [];
  const logs     = logsData?.logs      ?? [];

  const tabs = [
    { id: "members", label: "Team Members", icon: Users2,    count: members.length },
    { id: "links",   label: "Magic Links",  icon: Link2,     count: links.length },
    { id: "logs",    label: "Access Logs",  icon: ShieldCheck, count: logs.length },
  ] as const;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Users2 size={18} color="#4F46E5" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>Secure Team Access</h1>
            <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>Manage who can access your account — all activity is logged.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#F3F4F6", borderRadius: 14, padding: 4 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "9px 14px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, transition: "all 0.2s",
              background: tab === t.id ? "#fff" : "transparent", color: tab === t.id ? "#4F46E5" : "#6B7280",
              boxShadow: tab === t.id ? "0 1px 6px rgba(0,0,0,0.1)" : "none" }}>
            <t.icon size={14} />
            {t.label}
            {t.count > 0 && (
              <span style={{ padding: "1px 7px", borderRadius: 20, fontSize: 11, fontWeight: 800, background: tab === t.id ? "#EEF2FF" : "#E5E7EB", color: tab === t.id ? "#4F46E5" : "#9CA3AF" }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ── TEAM MEMBERS ── */}
        {tab === "members" && (
          <motion.div key="members" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #E8EAED", overflow: "hidden" }}>
              {/* Toolbar */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                  {members.length} {members.length === 1 ? "member" : "members"}
                </span>
                <button onClick={() => setShowAdd(true)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, border: "none", background: "#4F46E5", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  <Plus size={14} /> Add Member
                </button>
              </div>

              {membersLoading ? (
                <div style={{ padding: 40, display: "flex", justifyContent: "center" }}>
                  <Loader2 size={20} className="animate-spin" color="#C7D2FE" />
                </div>
              ) : members.length === 0 ? (
                <div style={{ padding: "48px 20px", textAlign: "center" }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                    <Users2 size={24} color="#A5B4FC" />
                  </div>
                  <p style={{ fontWeight: 700, color: "#374151", marginBottom: 4 }}>No team members yet</p>
                  <p style={{ fontSize: 13, color: "#9CA3AF" }}>Add a developer or manager to collaborate safely.</p>
                </div>
              ) : (
                <div>
                  {members.map((m, i) => (
                    <div key={m.id}
                      style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 14, borderBottom: i < members.length - 1 ? "1px solid #F9FAFB" : "none" }}>
                      {/* Avatar */}
                      <div style={{ width: 38, height: 38, borderRadius: 12, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: "#4F46E5" }}>{m.name.charAt(0).toUpperCase()}</span>
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</p>
                        <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>{m.email}</p>
                      </div>
                      {/* Role selector */}
                      {roleEditing === m.id ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          {Object.entries(ROLE_META).map(([k, meta]) => (
                            <button key={k} onClick={() => updateRole(m.id, k)}
                              style={{ padding: "4px 10px", borderRadius: 8, border: `1.5px solid ${meta.color}`, background: meta.bg, color: meta.color, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                              {meta.label}
                            </button>
                          ))}
                          <button onClick={() => setRoleEditing(null)} style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#6B7280", fontSize: 11, cursor: "pointer" }}>✕</button>
                        </div>
                      ) : (
                        <button onClick={() => setRoleEditing(m.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                          <RoleBadge role={m.role} />
                        </button>
                      )}
                      {/* Added */}
                      <span style={{ fontSize: 11, color: "#D1D5DB", whiteSpace: "nowrap" }}>{timeAgo(m.created_at)}</span>
                      {/* Remove */}
                      <button onClick={() => removeMember(m.id)}
                        style={{ padding: "6px", borderRadius: 8, border: "none", background: "#FEF2F2", cursor: "pointer", display: "flex", alignItems: "center" }}
                        title="Remove member">
                        <Trash2 size={13} color="#EF4444" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Permission legend */}
            <div style={{ marginTop: 16, background: "#FAFBFF", borderRadius: 14, border: "1px solid #E8EAED", padding: "14px 18px" }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Permission Levels</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
                {Object.entries(ROLE_META).map(([k, m]) => (
                  <div key={k} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: m.color, marginTop: 4, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: m.color, margin: 0 }}>{m.label}</p>
                      <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>{m.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── MAGIC LINKS ── */}
        {tab === "links" && (
          <motion.div key="links" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #E8EAED", overflow: "hidden" }}>
              {/* Toolbar */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Secure Access Links</span>
                  <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>Send a time-limited link to a developer. It expires in 24 hours.</p>
                </div>
                <button onClick={() => setShowLinkModal(true)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, border: "none", background: "#4F46E5", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  <KeyRound size={14} /> Generate Link
                </button>
              </div>

              {/* New link highlight */}
              {newLink && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  style={{ margin: 16, background: "linear-gradient(135deg,#ECFDF5,#D1FAE5)", border: "1px solid #6EE7B7", borderRadius: 14, padding: "16px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <CheckCircle2 size={16} color="#10B981" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#065F46" }}>Link Generated — Copy it now!</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "#6EE7B7" }}>Expires in 24h</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", borderRadius: 10, padding: "9px 12px", border: "1px solid #A7F3D0" }}>
                    <Globe size={12} color="#10B981" />
                    <code style={{ flex: 1, fontSize: 11, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{buildLink(newLink.token)}</code>
                    <CopyBtn text={buildLink(newLink.token)} />
                  </div>
                  <p style={{ fontSize: 11, color: "#6B7280", marginTop: 8 }}>
                    This link is logged when opened — you'll see the IP address in Security Logs.
                  </p>
                </motion.div>
              )}

              {linksLoading ? (
                <div style={{ padding: 40, display: "flex", justifyContent: "center" }}>
                  <Loader2 size={20} className="animate-spin" color="#C7D2FE" />
                </div>
              ) : links.length === 0 ? (
                <div style={{ padding: "48px 20px", textAlign: "center" }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                    <Link2 size={24} color="#A5B4FC" />
                  </div>
                  <p style={{ fontWeight: 700, color: "#374151", marginBottom: 4 }}>No active links</p>
                  <p style={{ fontSize: 13, color: "#9CA3AF" }}>Generate a secure link to grant temporary access to a developer.</p>
                </div>
              ) : (
                <div>
                  {links.map((lnk, i) => {
                    const expiry = formatExpiry(lnk.expires_at);
                    return (
                      <div key={lnk.id}
                        style={{ padding: "14px 20px", borderBottom: i < links.length - 1 ? "1px solid #F9FAFB" : "none", opacity: expiry.expired ? 0.55 : 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 10, background: expiry.expired ? "#F3F4F6" : "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <KeyRound size={14} color={expiry.expired ? "#9CA3AF" : "#4F46E5"} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: 0 }}>{lnk.label}</p>
                            <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>Created {timeAgo(lnk.created_at)}</p>
                          </div>
                          {/* Status pill */}
                          <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                            background: expiry.expired ? "#F3F4F6" : lnk.used_at ? "#ECFDF5" : "#EEF2FF",
                            color: expiry.expired ? "#9CA3AF" : lnk.used_at ? "#059669" : "#4F46E5" }}>
                            {expiry.expired ? "Expired" : lnk.used_at ? "Used" : expiry.label}
                          </span>
                          {/* Copy */}
                          {!expiry.expired && <CopyBtn text={buildLink(lnk.token)} />}
                          {/* Revoke */}
                          <button onClick={() => revokeLink(lnk.id)}
                            style={{ padding: "6px", borderRadius: 8, border: "none", background: "#FEF2F2", cursor: "pointer", display: "flex", alignItems: "center" }}>
                            <Trash2 size={13} color="#EF4444" />
                          </button>
                        </div>
                        {lnk.used_at && (
                          <div style={{ marginLeft: 44, display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6B7280" }}>
                            <Eye size={11} />
                            Opened {timeAgo(lnk.used_at)} from {lnk.used_ip}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── ACCESS LOGS ── */}
        {tab === "logs" && (
          <motion.div key="logs" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #E8EAED", overflow: "hidden" }}>
              {/* Toolbar */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Security Logs</span>
                  <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>Every action on your team is recorded with IP and timestamp.</p>
                </div>
                <button onClick={() => refetchLogs()}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#374151", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>

              {logsLoading ? (
                <div style={{ padding: 40, display: "flex", justifyContent: "center" }}>
                  <Loader2 size={20} className="animate-spin" color="#C7D2FE" />
                </div>
              ) : logs.length === 0 ? (
                <div style={{ padding: "48px 20px", textAlign: "center" }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                    <ShieldCheck size={24} color="#86EFAC" />
                  </div>
                  <p style={{ fontWeight: 700, color: "#374151", marginBottom: 4 }}>No activity yet</p>
                  <p style={{ fontSize: 13, color: "#9CA3AF" }}>Access events will appear here as your team uses the account.</p>
                </div>
              ) : (
                <div>
                  {logs.map((log, i) => {
                    const isOwner = log.actor_role === "owner";
                    const isDev   = log.actor_role === "developer";
                    const dotColor = isOwner ? "#4F46E5" : isDev ? "#10B981" : "#F59E0B";
                    return (
                      <div key={log.id}
                        style={{ padding: "12px 20px", display: "flex", alignItems: "flex-start", gap: 14, borderBottom: i < logs.length - 1 ? "1px solid #F9FAFB" : "none" }}>
                        {/* Dot */}
                        <div style={{ width: 8, height: 8, borderRadius: 4, background: dotColor, flexShrink: 0, marginTop: 6 }} />
                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{log.actor_email}</span>
                            <span style={{ padding: "1px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: isOwner ? "#EEF2FF" : isDev ? "#ECFDF5" : "#FFFBEB", color: dotColor }}>
                              {isOwner ? "Owner" : isDev ? "Developer" : log.actor_role}
                            </span>
                          </div>
                          <p style={{ fontSize: 13, color: "#374151", margin: "2px 0" }}>{log.action}</p>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11, color: "#9CA3AF", display: "flex", alignItems: "center", gap: 3 }}>
                              <Globe size={10} /> {log.ip_address}
                            </span>
                            <span style={{ fontSize: 11, color: "#D1D5DB" }}>·</span>
                            <span style={{ fontSize: 11, color: "#9CA3AF", display: "flex", alignItems: "center", gap: 3 }}>
                              <Clock size={10} /> {timeAgo(log.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add Member Modal ── */}
      {showAdd && (
        <AddMemberModal
          onClose={() => setShowAdd(false)}
          onSave={() => {
            setShowAdd(false);
            qc.invalidateQueries({ queryKey: ["my-team"] });
            qc.invalidateQueries({ queryKey: ["my-team-logs"] });
          }}
        />
      )}

      {/* ── Generate Link Modal ── */}
      {showLinkModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            style={{ background: "#fff", borderRadius: 20, padding: 28, width: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <KeyRound size={18} color="#4F46E5" />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: 0 }}>Generate Secure Link</h3>
                <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>Expires in 24 hours · IP logged on open</p>
              </div>
            </div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>Link Label</label>
            <input value={linkLabel} onChange={e => setLinkLabel(e.target.value)}
              placeholder="e.g. Developer Access — Sprint 12"
              style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 20 }} />
            <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 14px", marginBottom: 20 }}>
              <p style={{ fontSize: 12, color: "#92400E", margin: 0 }}>
                <strong>Security notice:</strong> Anyone with this link can access your account with developer-level read access. The IP address is logged when the link is opened.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowLinkModal(false)} style={{ flex: 1, padding: "10px", borderRadius: 12, border: "1px solid #E5E7EB", background: "#F9FAFB", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>Cancel</button>
              <button onClick={generateLink} disabled={linkLoading}
                style={{ flex: 2, padding: "10px", borderRadius: 12, border: "none", background: "#4F46E5", color: "#fff", cursor: linkLoading ? "default" : "pointer", fontWeight: 700, fontSize: 14, opacity: linkLoading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {linkLoading ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                {linkLoading ? "Generating..." : "Generate Link"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
