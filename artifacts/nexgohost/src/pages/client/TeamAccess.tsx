import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users2, KeyRound, ShieldCheck, Plus, Trash2, Copy, Check,
  RefreshCw, Loader2, Link2, Globe, Clock, CheckCircle2, Eye,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ───────────────────────────────────────────────────────────────────
interface TeamMember { id: string; email: string; name: string; role: string; status: string; created_at: string; }
interface MagicLink { id: string; token: string; label: string; expires_at: string; used_at: string | null; used_ip: string | null; created_at: string; }
interface AccessLog { id: string; actor_email: string; actor_role: string; ip_address: string; action: string; user_agent: string | null; created_at: string; }

// ─── Constants ───────────────────────────────────────────────────────────────
const ROLE_META: Record<string, { label: string; color: string; desc: string }> = {
  support_only: { label: "Support Only", color: "#0EA5E9", desc: "Can open & reply to support tickets" },
  billing_only: { label: "Billing Only", color: "#8B5CF6", desc: "Can view invoices and billing info" },
  developer:    { label: "Developer",    color: "#10B981", desc: "Can access hosting files & databases" },
  full_access:  { label: "Full Access",  color: "#F59E0B", desc: "Full read/write access to account" },
};

// ─── Utility ─────────────────────────────────────────────────────────────────
function authHeaders() {
  const t = localStorage.getItem("token") || localStorage.getItem("noehost_token") || "";
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
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handle}
      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-secondary/60 hover:bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
      {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ─── Role Badge ───────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const m = ROLE_META[role] ?? { label: role, color: "#6B7280" };
  return (
    <span
      className="px-2.5 py-0.5 rounded-full text-[11px] font-bold"
      style={{ color: m.color, backgroundColor: m.color + "22" }}>
      {m.label}
    </span>
  );
}

// ─── Skeleton Rows ────────────────────────────────────────────────────────────
function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="divide-y divide-border/40">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3.5 px-5 py-3.5">
          <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

// ─── Add Member Modal ─────────────────────────────────────────────────────────
function AddMemberModal({ onClose, onSave }: { onClose: () => void; onSave: (data: any) => void }) {
  const [form, setForm] = useState({ email: "", name: "", role: "developer" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.email || !form.name) { setError("Please fill in both name and email address."); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/my/team", { method: "POST", headers: authHeaders(), body: JSON.stringify(form) });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "We couldn't add this member. Please check the details and try again."); setLoading(false); return; }
      onSave(d);
    } catch { setError("Connection error — please check your internet and try again."); setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-2xl p-7 w-full max-w-sm shadow-2xl">
        <h3 className="text-[17px] font-black text-foreground mb-1">Add Team Member</h3>
        <p className="text-sm text-muted-foreground mb-5">They'll be logged each time they access your account.</p>

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-2.5 mb-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1.5">Full Name</label>
            <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Ali Hassan"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1.5">Email Address</label>
            <input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="developer@company.com"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1.5">Permission Level</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(ROLE_META).map(([k, m]) => (
                <button key={k} onClick={() => set("role", k)}
                  className="p-3 rounded-xl border-2 text-left transition-all cursor-pointer"
                  style={{
                    borderColor: form.role === k ? m.color : "hsl(var(--border))",
                    backgroundColor: form.role === k ? m.color + "18" : "transparent",
                  }}>
                  <span className="text-xs font-bold block" style={{ color: m.color }}>{m.label}</span>
                  <span className="text-[11px] text-muted-foreground">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2.5 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border bg-secondary/60 hover:bg-secondary text-foreground font-semibold text-sm cursor-pointer transition-colors">
            Cancel
          </button>
          <button onClick={submit} disabled={loading}
            className="flex-[2] py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm cursor-pointer transition-opacity flex items-center justify-center gap-1.5 disabled:opacity-70">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {loading ? "Adding…" : "Add Member"}
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
  const { data: linksData, isLoading: linksLoading } = useQuery<{ links: MagicLink[] }>({
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

  const members = membersData?.members ?? [];
  const links   = linksData?.links    ?? [];
  const logs    = logsData?.logs      ?? [];

  const tabs = [
    { id: "members", label: "Team Members", icon: Users2,     count: members.length },
    { id: "links",   label: "Magic Links",  icon: Link2,      count: links.length },
    { id: "logs",    label: "Access Logs",  icon: ShieldCheck, count: logs.length },
  ] as const;

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Users2 size={18} className="text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-foreground leading-tight">Secure Team Access</h1>
          <p className="text-sm text-muted-foreground">Manage who can access your account — all activity is logged.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-secondary/60 border border-border/60 rounded-2xl p-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
              tab === t.id
                ? "bg-card border-border/60 text-primary shadow-sm"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon size={13} />
            {t.label}
            {t.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-black ${
                tab === t.id ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
              }`}>
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
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
                <span className="text-sm font-bold text-foreground">
                  {members.length} {members.length === 1 ? "member" : "members"}
                </span>
                <button onClick={() => setShowAdd(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm cursor-pointer transition-colors">
                  <Plus size={13} /> Add Member
                </button>
              </div>

              {membersLoading ? (
                <SkeletonRows count={3} />
              ) : members.length === 0 ? (
                <div className="py-12 px-5 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Users2 size={24} className="text-primary/40" />
                  </div>
                  <p className="font-bold text-foreground mb-1">No team members yet</p>
                  <p className="text-sm text-muted-foreground">Add a developer or manager to collaborate safely.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {members.map(m => (
                    <div key={m.id} className="flex items-center gap-3.5 px-5 py-3.5">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-black text-primary">{m.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.email}</p>
                      </div>
                      {roleEditing === m.id ? (
                        <div className="flex gap-1.5 flex-wrap">
                          {Object.entries(ROLE_META).map(([k, meta]) => (
                            <button key={k} onClick={() => updateRole(m.id, k)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold border-2 cursor-pointer transition-all"
                              style={{ borderColor: meta.color, color: meta.color, backgroundColor: meta.color + "18" }}>
                              {meta.label}
                            </button>
                          ))}
                          <button onClick={() => setRoleEditing(null)}
                            className="px-2.5 py-1 rounded-lg border border-border text-muted-foreground text-[11px] cursor-pointer hover:bg-secondary transition-colors">
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setRoleEditing(m.id)} className="cursor-pointer bg-transparent border-none p-0">
                          <RoleBadge role={m.role} />
                        </button>
                      )}
                      <span className="text-[11px] text-muted-foreground/60 whitespace-nowrap hidden sm:block">
                        {timeAgo(m.created_at)}
                      </span>
                      <button onClick={() => removeMember(m.id)}
                        className="p-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 cursor-pointer flex items-center transition-colors"
                        title="Remove member">
                        <Trash2 size={13} className="text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Permission legend */}
            <div className="mt-4 bg-card border border-border/60 rounded-2xl px-5 py-4">
              <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest mb-3">Permission Levels</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(ROLE_META).map(([k, m]) => (
                  <div key={k} className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: m.color }} />
                    <div>
                      <p className="text-xs font-bold" style={{ color: m.color }}>{m.label}</p>
                      <p className="text-[11px] text-muted-foreground">{m.desc}</p>
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
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">Secure Access Links</p>
                  <p className="text-xs text-muted-foreground">Send a time-limited link to a developer. Expires in 24 hours.</p>
                </div>
                <button onClick={() => setShowLinkModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm cursor-pointer transition-colors shrink-0">
                  <KeyRound size={13} /> Generate Link
                </button>
              </div>

              {newLink && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  className="m-4 bg-green-500/5 border border-green-500/25 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 size={15} className="text-green-500" />
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">Link Generated — Copy it now!</span>
                    <span className="ml-auto text-xs text-muted-foreground">Expires in 24h</span>
                  </div>
                  <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
                    <Globe size={12} className="text-green-500 shrink-0" />
                    <code className="flex-1 text-[11px] text-foreground font-mono truncate">{buildLink(newLink.token)}</code>
                    <CopyBtn text={buildLink(newLink.token)} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    This link is logged when opened — the IP address appears in Access Logs.
                  </p>
                </motion.div>
              )}

              {linksLoading ? (
                <SkeletonRows count={2} />
              ) : links.length === 0 ? (
                <div className="py-12 px-5 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Link2 size={24} className="text-primary/40" />
                  </div>
                  <p className="font-bold text-foreground mb-1">No active links</p>
                  <p className="text-sm text-muted-foreground">Generate a secure link to grant temporary access to a developer.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {links.map(lnk => {
                    const expiry = formatExpiry(lnk.expires_at);
                    return (
                      <div key={lnk.id} className={`px-5 py-3.5 transition-opacity ${expiry.expired ? "opacity-50" : ""}`}>
                        <div className="flex items-center gap-3 mb-1.5">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${expiry.expired ? "bg-secondary" : "bg-primary/10"}`}>
                            <KeyRound size={13} className={expiry.expired ? "text-muted-foreground" : "text-primary"} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-foreground">{lnk.label}</p>
                            <p className="text-xs text-muted-foreground">Created {timeAgo(lnk.created_at)}</p>
                          </div>
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                            expiry.expired
                              ? "bg-secondary text-muted-foreground"
                              : lnk.used_at
                              ? "bg-green-500/10 text-green-600 dark:text-green-400"
                              : "bg-primary/10 text-primary"
                          }`}>
                            {expiry.expired ? "Expired" : lnk.used_at ? "Used" : expiry.label}
                          </span>
                          {!expiry.expired && <CopyBtn text={buildLink(lnk.token)} />}
                          <button onClick={() => revokeLink(lnk.id)}
                            className="p-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 cursor-pointer flex items-center transition-colors">
                            <Trash2 size={12} className="text-destructive" />
                          </button>
                        </div>
                        {lnk.used_at && (
                          <div className="ml-11 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Eye size={10} />
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
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
                <div>
                  <p className="text-sm font-bold text-foreground">Security Logs</p>
                  <p className="text-xs text-muted-foreground">Every team action is recorded with IP and timestamp.</p>
                </div>
                <button onClick={() => refetchLogs()}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground font-semibold text-xs cursor-pointer transition-colors">
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>

              {logsLoading ? (
                <div className="divide-y divide-border/40">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3.5 px-5 py-4">
                      <Skeleton className="w-2 h-2 rounded-full mt-2 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-40" />
                        <Skeleton className="h-3 w-56" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : logs.length === 0 ? (
                <div className="py-12 px-5 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                    <ShieldCheck size={24} className="text-green-400" />
                  </div>
                  <p className="font-bold text-foreground mb-1">No activity yet</p>
                  <p className="text-sm text-muted-foreground">Access events will appear here as your team uses the account.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {logs.map(log => {
                    const isOwner = log.actor_role === "owner";
                    const isDev   = log.actor_role === "developer";
                    const dotColor = isOwner ? "#6B46C1" : isDev ? "#10B981" : "#F59E0B";
                    return (
                      <div key={log.id} className="flex items-start gap-3.5 px-5 py-3.5">
                        <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ backgroundColor: dotColor }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="text-sm font-semibold text-foreground">{log.actor_email}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{ color: dotColor, backgroundColor: dotColor + "22" }}>
                              {isOwner ? "Owner" : isDev ? "Developer" : log.actor_role}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{log.action}</p>
                          <div className="flex items-center gap-2.5 flex-wrap mt-0.5">
                            {log.ip_address && (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Globe size={10} /> {log.ip_address}
                              </span>
                            )}
                            <span className="text-muted-foreground/40 text-[11px]">·</span>
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl p-7 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <KeyRound size={18} className="text-primary" />
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">Generate Secure Link</h3>
                <p className="text-xs text-muted-foreground">Expires in 24 hours · IP logged on open</p>
              </div>
            </div>
            <label className="text-xs font-bold text-muted-foreground block mb-1.5">Link Label</label>
            <input
              value={linkLabel}
              onChange={e => setLinkLabel(e.target.value)}
              placeholder="e.g. Developer Access — Sprint 12"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm outline-none focus:border-primary/60 transition-all mb-5" />
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 mb-5">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                <strong>Security notice:</strong> Anyone with this link can access your account with developer-level read access. The IP address is logged when the link is opened.
              </p>
            </div>
            <div className="flex gap-2.5">
              <button onClick={() => setShowLinkModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-border bg-secondary/60 hover:bg-secondary text-foreground font-semibold text-sm cursor-pointer transition-colors">
                Cancel
              </button>
              <button onClick={generateLink} disabled={linkLoading}
                className="flex-[2] py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-70 transition-opacity">
                {linkLoading ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                {linkLoading ? "Generating…" : "Generate Link"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
