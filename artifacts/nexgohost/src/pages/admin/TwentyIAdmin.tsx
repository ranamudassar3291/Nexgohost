import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Server, Users, Globe, Plus, Trash2, ExternalLink, RefreshCw, AlertTriangle,
  CheckCircle, XCircle, Loader2, ChevronDown, Search, Shield, ArrowRightLeft,
  Ticket, Send, Eye, Zap, Clock, RotateCcw, UserPlus, Link2, Ban, Play,
} from "lucide-react";

// ─── API helper ───────────────────────────────────────────────────────────────

async function apiFetch(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ─── Reusable UI primitives ───────────────────────────────────────────────────

function Spinner() {
  return <Loader2 size={16} className="animate-spin" />;
}

function Badge({ label, color }: { label: string; color: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    suspended: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    terminated: "bg-red-500/10 text-red-500 border-red-500/20",
    open: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    in_progress: "bg-violet-500/10 text-violet-500 border-violet-500/20",
    completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    failed: "bg-red-500/10 text-red-500 border-red-500/20",
    closed: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    unknown: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  };
  const cls = map[color] ?? map[label.toLowerCase()] ?? "bg-gray-500/10 text-gray-400 border-gray-500/20";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {label}
    </span>
  );
}

function ConfirmModal({ title, description, onConfirm, onCancel, loading }: {
  title: string; description: string; onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-border text-sm hover:bg-secondary/60 transition-colors">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium disabled:opacity-50 transition-colors">
            {loading ? <Spinner /> : <Trash2 size={14} />}
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function PrimaryBtn({ onClick, disabled, children, small }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 font-medium bg-primary/5 border border-primary/20 text-primary hover:bg-primary/10 transition-colors rounded-xl disabled:opacity-40 disabled:cursor-not-allowed ${small ? "text-xs px-2.5 py-1.5" : "text-sm px-3 py-2"}`}
    >
      {children}
    </button>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-card border border-border rounded-2xl ${className ?? "p-6"}`}>{children}</div>;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview",     label: "Overview",     icon: Server },
  { id: "stack-users",  label: "StackUsers",   icon: Users },
  { id: "sites",        label: "Hosting Sites",icon: Globe },
  { id: "provision",    label: "Provision",    icon: Plus },
  { id: "migrations",   label: "Migrations",   icon: ArrowRightLeft },
  { id: "tickets",      label: "Tickets",      icon: Ticket },
] as const;

type TabId = typeof TABS[number]["id"];

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ server, lastSync, onSync, syncing }: {
  server: any; lastSync: string | null; onSync: () => void; syncing: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${server?.connected ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
              {server?.connected ? <CheckCircle size={18} className="text-emerald-500" /> : <XCircle size={18} className="text-red-500" />}
            </div>
            <div>
              <p className="font-medium text-foreground">{server?.name ?? "20i Server"}</p>
              <p className="text-sm text-muted-foreground">
                {server?.connected ? "Connected via 20i Reseller API" : (server?.error ?? "Not configured")}
              </p>
            </div>
          </div>
          <PrimaryBtn onClick={onSync} disabled={syncing}>
            {syncing ? <Spinner /> : <RefreshCw size={14} />}
            {syncing ? "Syncing…" : "Sync Now"}
          </PrimaryBtn>
        </div>
        {server?.connected && (
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">API Status</p>
              <p className="font-medium text-emerald-500 mt-0.5">Active</p>
            </div>
            <div>
              <p className="text-muted-foreground">Nameservers</p>
              <p className="font-medium text-foreground mt-0.5 text-xs">{server.ns1 ?? "ns1.20i.com"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Last Synced</p>
              <p className="font-medium text-foreground mt-0.5">{lastSync ? new Date(lastSync).toLocaleTimeString() : "Never"}</p>
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Auto-sync interval", value: "Every 5 minutes", icon: Clock },
          { label: "API endpoint", value: "api.20i.com", icon: Zap },
          { label: "Confirmation guard", value: "Enabled on all actions", icon: Shield },
        ].map(item => (
          <Card key={item.label} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <item.icon size={14} className="text-primary" />
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
            <p className="text-sm font-medium text-foreground">{item.value}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── StackUsers Tab ───────────────────────────────────────────────────────────

function StackUsersTab({ apiKey }: { apiKey?: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", name: "" });
  const [confirm, setConfirm] = useState<{ userId: string; name: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["20i-stack-users"],
    queryFn: () => apiFetch("/api/admin/twenty-i/stack-users"),
    refetchInterval: 5 * 60 * 1000,
  });

  const filtered = (users as any[]).filter((u: any) =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.name?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreate() {
    if (!createForm.email || !createForm.name) return;
    setCreating(true);
    try {
      await apiFetch("/api/admin/twenty-i/stack-users", { method: "POST", body: JSON.stringify(createForm) });
      toast({ title: "StackUser created" });
      qc.invalidateQueries({ queryKey: ["20i-stack-users"] });
      setShowCreate(false);
      setCreateForm({ email: "", name: "" });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!confirm) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/admin/twenty-i/stack-users/${confirm.userId}`, { method: "DELETE" });
      toast({ title: "StackUser deleted" });
      qc.invalidateQueries({ queryKey: ["20i-stack-users"] });
      setConfirm(null);
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {confirm && (
        <ConfirmModal
          title="Delete StackUser"
          description={`This will permanently delete "${confirm.name}" from 20i. Their assigned sites will still exist but won't have a user. This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
          loading={deleting}
        />
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary/40"
            placeholder="Search by email or name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <PrimaryBtn onClick={() => setShowCreate(!showCreate)}>
          <UserPlus size={14} />
          New StackUser
        </PrimaryBtn>
      </div>

      {showCreate && (
        <Card className="p-4">
          <p className="text-sm font-medium mb-3">Create StackUser</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input className="px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40" placeholder="Full name" value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} />
            <input type="email" className="px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40" placeholder="Email address" value={createForm.email} onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-3 py-2 text-sm rounded-xl border border-border hover:bg-secondary/60 transition-colors">Cancel</button>
            <PrimaryBtn onClick={handleCreate} disabled={creating || !createForm.email || !createForm.name}>
              {creating ? <Spinner /> : <Plus size={14} />}
              Create
            </PrimaryBtn>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {users.length === 0 ? "No StackUsers found on this 20i account." : "No matches for your search."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-medium">Name</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-medium">Email</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-medium">User ID</th>
                <th className="px-4 py-3 text-right text-xs text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u: any) => (
                <tr key={u.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{u.name || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{u.id}</td>
                  <td className="px-4 py-3 flex justify-end gap-1.5">
                    <PrimaryBtn small onClick={() => setConfirm({ userId: u.id, name: u.name || u.email })}>
                      <Trash2 size={12} />
                      Delete
                    </PrimaryBtn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ─── Hosting Sites Tab ────────────────────────────────────────────────────────

function SitesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<{ siteId: string; domain: string; action: "suspend" | "terminate" } | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);
  const [assignModal, setAssignModal] = useState<{ siteId: string; domain: string } | null>(null);
  const [assignUserId, setAssignUserId] = useState("");

  const { data: sites = [], isLoading } = useQuery({
    queryKey: ["20i-sites"],
    queryFn: () => apiFetch("/api/admin/twenty-i/sites"),
    refetchInterval: 5 * 60 * 1000,
  });
  const { data: stackUsers = [] } = useQuery({
    queryKey: ["20i-stack-users"],
    queryFn: () => apiFetch("/api/admin/twenty-i/stack-users"),
  });

  const filtered = (sites as any[]).filter((s: any) =>
    s.domain?.toLowerCase().includes(search.toLowerCase()) ||
    s.id?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAction(siteId: string, action: "suspend" | "unsuspend" | "terminate") {
    setActioning(siteId + action);
    try {
      if (action === "suspend") await apiFetch(`/api/admin/twenty-i/sites/${siteId}/suspend`, { method: "POST" });
      else if (action === "unsuspend") await apiFetch(`/api/admin/twenty-i/sites/${siteId}/unsuspend`, { method: "POST" });
      else await apiFetch(`/api/admin/twenty-i/sites/${siteId}`, { method: "DELETE" });
      toast({ title: `Site ${action}d successfully` });
      qc.invalidateQueries({ queryKey: ["20i-sites"] });
      setConfirm(null);
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setActioning(null);
    }
  }

  async function handleSSO(siteId: string) {
    setActioning(siteId + "sso");
    try {
      const data = await apiFetch(`/api/admin/twenty-i/sites/${siteId}/sso`);
      if (data.url) window.open(data.url, "_blank");
    } catch (e: any) {
      toast({ title: "SSO Failed", description: e.message, variant: "destructive" });
    } finally {
      setActioning(null);
    }
  }

  async function handleAssign() {
    if (!assignModal || !assignUserId) return;
    setActioning(assignModal.siteId + "assign");
    try {
      await apiFetch(`/api/admin/twenty-i/sites/${assignModal.siteId}/assign`, {
        method: "POST",
        body: JSON.stringify({ stackUserId: assignUserId }),
      });
      toast({ title: "Site assigned to StackUser" });
      qc.invalidateQueries({ queryKey: ["20i-sites"] });
      setAssignModal(null);
      setAssignUserId("");
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setActioning(null);
    }
  }

  return (
    <div className="space-y-4">
      {confirm && (
        <ConfirmModal
          title={confirm.action === "terminate" ? "Terminate Site" : "Suspend Site"}
          description={confirm.action === "terminate"
            ? `Permanently delete "${confirm.domain}" from 20i. All data will be lost. This cannot be undone.`
            : `Suspend "${confirm.domain}". The site will go offline. You can unsuspend it later.`}
          onConfirm={() => handleAction(confirm.siteId, confirm.action)}
          onCancel={() => setConfirm(null)}
          loading={!!actioning}
        />
      )}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="font-semibold mb-1">Assign Site to StackUser</h3>
            <p className="text-sm text-muted-foreground mb-4">Assign <strong>{assignModal.domain}</strong> to a StackUser so they can manage it in StackCP.</p>
            <select
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 mb-4"
              value={assignUserId}
              onChange={e => setAssignUserId(e.target.value)}
            >
              <option value="">— Select StackUser —</option>
              {(stackUsers as any[]).map((u: any) => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setAssignModal(null); setAssignUserId(""); }} className="px-3 py-2 text-sm rounded-xl border border-border hover:bg-secondary/60 transition-colors">Cancel</button>
              <PrimaryBtn onClick={handleAssign} disabled={!assignUserId || !!actioning}>
                {actioning ? <Spinner /> : <Link2 size={14} />}
                Assign
              </PrimaryBtn>
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary/40"
          placeholder="Search by domain or site ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No hosting sites found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-medium">Domain</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-medium">Site ID</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-medium">Status</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-medium">Package</th>
                <th className="px-4 py-3 text-right text-xs text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s: any) => {
                const isSuspended = s.status === "suspended";
                return (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{s.domain || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{s.id}</td>
                    <td className="px-4 py-3"><Badge label={s.status} color={s.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{s.package || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 justify-end flex-wrap">
                        <PrimaryBtn small onClick={() => handleSSO(s.id)} disabled={actioning === s.id + "sso"}>
                          {actioning === s.id + "sso" ? <Spinner /> : <ExternalLink size={12} />}
                          StackCP
                        </PrimaryBtn>
                        <PrimaryBtn small onClick={() => setAssignModal({ siteId: s.id, domain: s.domain })}>
                          <Link2 size={12} />
                          Assign
                        </PrimaryBtn>
                        {isSuspended ? (
                          <PrimaryBtn small onClick={() => handleAction(s.id, "unsuspend")} disabled={actioning === s.id + "unsuspend"}>
                            {actioning === s.id + "unsuspend" ? <Spinner /> : <Play size={12} />}
                            Enable
                          </PrimaryBtn>
                        ) : (
                          <PrimaryBtn small onClick={() => setConfirm({ siteId: s.id, domain: s.domain, action: "suspend" })}>
                            <Ban size={12} />
                            Suspend
                          </PrimaryBtn>
                        )}
                        <button
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-500 hover:bg-red-500/10 transition-colors"
                          onClick={() => setConfirm({ siteId: s.id, domain: s.domain, action: "terminate" })}
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ─── Provision Tab ────────────────────────────────────────────────────────────

function ProvisionTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ domain: "", packageId: "", clientId: "", stackUserId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const { data: packages = [] } = useQuery({
    queryKey: ["20i-packages"],
    queryFn: () => apiFetch("/api/admin/twenty-i/packages"),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["20i-clients"],
    queryFn: () => apiFetch("/api/admin/twenty-i/clients"),
  });
  const { data: stackUsers = [] } = useQuery({
    queryKey: ["20i-stack-users"],
    queryFn: () => apiFetch("/api/admin/twenty-i/stack-users"),
  });

  async function handleSubmit() {
    if (!form.domain || !form.clientId) return;
    setSubmitting(true);
    setResult(null);
    try {
      const data = await apiFetch("/api/admin/twenty-i/provision", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setResult(data);
      toast({ title: "Hosting provisioned successfully!" });
      qc.invalidateQueries({ queryKey: ["20i-sites"] });
      setForm({ domain: "", packageId: "", clientId: "", stackUserId: "" });
    } catch (e: any) {
      toast({ title: "Provisioning failed", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <h3 className="font-semibold text-foreground mb-4">Create Hosting Account on 20i</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Domain Name *</label>
            <input
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
              placeholder="e.g. example.com"
              value={form.domain}
              onChange={e => setForm(p => ({ ...p, domain: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">20i Package (optional)</label>
            <select
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
              value={form.packageId}
              onChange={e => setForm(p => ({ ...p, packageId: e.target.value }))}
            >
              <option value="">— Default package —</option>
              {(packages as any[]).map((pkg: any) => (
                <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Assign to Client *</label>
            <select
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
              value={form.clientId}
              onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))}
            >
              <option value="">— Select client —</option>
              {(clients as any[]).map((c: any) => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.email})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Assign to StackUser (optional)</label>
            <select
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
              value={form.stackUserId}
              onChange={e => setForm(p => ({ ...p, stackUserId: e.target.value }))}
            >
              <option value="">— No StackUser —</option>
              {(stackUsers as any[]).map((u: any) => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </select>
          </div>
          <PrimaryBtn onClick={handleSubmit} disabled={submitting || !form.domain || !form.clientId}>
            {submitting ? <Spinner /> : <Zap size={14} />}
            {submitting ? "Provisioning…" : "Provision Hosting"}
          </PrimaryBtn>
        </div>
      </Card>

      {result && (
        <Card className="p-4 border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center gap-2 text-emerald-600 font-medium mb-2">
            <CheckCircle size={16} />
            Hosting Created Successfully
          </div>
          <div className="text-sm space-y-1 text-muted-foreground">
            <p>Site ID: <span className="font-mono text-foreground">{result.siteId}</span></p>
            {result.cpanelUrl && (
              <p>StackCP URL: <a href={result.cpanelUrl} target="_blank" rel="noreferrer" className="text-primary underline">{result.cpanelUrl}</a></p>
            )}
            <p>Service ID in panel: <span className="font-mono text-foreground text-xs">{result.serviceId}</span></p>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Migrations Tab ───────────────────────────────────────────────────────────

function MigrationsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ domain: "", sourceType: "cpanel", host: "", username: "", password: "", siteId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState<string | null>(null);

  const { data: migrations = [], isLoading, refetch } = useQuery({
    queryKey: ["20i-migrations"],
    queryFn: () => apiFetch("/api/admin/twenty-i/migrations"),
    refetchInterval: polling ? 8000 : false,
  });

  async function handleStart() {
    if (!form.domain || !form.host || !form.username || !form.password) return;
    setSubmitting(true);
    try {
      const result = await apiFetch("/api/admin/twenty-i/migrations", { method: "POST", body: JSON.stringify(form) });
      toast({ title: "Migration started!", description: `Migration ID: ${result.id}` });
      setPolling(result.id);
      qc.invalidateQueries({ queryKey: ["20i-migrations"] });
      setForm({ domain: "", sourceType: "cpanel", host: "", username: "", password: "", siteId: "" });
    } catch (e: any) {
      toast({ title: "Failed to start migration", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const statusColor = (s: string) =>
    s === "completed" ? "bg-emerald-500" : s === "failed" ? "bg-red-500" : s === "in_progress" ? "bg-primary" : "bg-amber-500";

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold mb-4">Start New Migration</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Domain *</label>
            <input className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40" placeholder="example.com" value={form.domain} onChange={e => setForm(p => ({ ...p, domain: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Source Type *</label>
            <select className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40" value={form.sourceType} onChange={e => setForm(p => ({ ...p, sourceType: e.target.value }))}>
              <option value="cpanel">cPanel</option>
              <option value="plesk">Plesk</option>
              <option value="directadmin">DirectAdmin</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Source Host *</label>
            <input className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40" placeholder="e.g. server1.host.com" value={form.host} onChange={e => setForm(p => ({ ...p, host: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Username *</label>
            <input className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40" placeholder="cPanel username" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Password *</label>
            <input type="password" className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40" placeholder="cPanel password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Target Site ID (optional)</label>
            <input className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40" placeholder="20i site ID" value={form.siteId} onChange={e => setForm(p => ({ ...p, siteId: e.target.value }))} />
          </div>
        </div>
        <div className="mt-4">
          <PrimaryBtn onClick={handleStart} disabled={submitting || !form.domain || !form.host || !form.username || !form.password}>
            {submitting ? <Spinner /> : <ArrowRightLeft size={14} />}
            {submitting ? "Starting…" : "Start Migration"}
          </PrimaryBtn>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="font-medium text-foreground">Migration History</h3>
        <PrimaryBtn small onClick={() => refetch()}>
          <RefreshCw size={12} />
          Refresh
        </PrimaryBtn>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (migrations as any[]).length === 0 ? (
        <Card className="text-center py-10 text-muted-foreground text-sm">No migrations found.</Card>
      ) : (
        <div className="space-y-3">
          {(migrations as any[]).map((m: any) => (
            <Card key={m.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-medium text-foreground">{m.domain}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">ID: {m.id} · {m.sourceType || "Unknown source"}</p>
                </div>
                <Badge label={m.status} color={m.status} />
              </div>
              {m.status === "in_progress" && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Progress</span>
                    <span>{m.progress ?? 0}%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full ${statusColor(m.status)} transition-all`} style={{ width: `${m.progress ?? 0}%` }} />
                  </div>
                </div>
              )}
              {m.status === "completed" && (
                <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-full" />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tickets Tab ──────────────────────────────────────────────────────────────

function TicketsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const [reply, setReply] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newTicket, setNewTicket] = useState({ subject: "", body: "", priority: "normal" });
  const [submitting, setSubmitting] = useState(false);
  const [replying, setReplying] = useState(false);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["20i-tickets"],
    queryFn: () => apiFetch("/api/admin/twenty-i/tickets"),
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: ticketDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ["20i-ticket", selected?.id],
    queryFn: () => apiFetch(`/api/admin/twenty-i/tickets/${selected?.id}`),
    enabled: !!selected?.id,
  });

  async function handleCreate() {
    if (!newTicket.subject || !newTicket.body) return;
    setSubmitting(true);
    try {
      const result = await apiFetch("/api/admin/twenty-i/tickets", { method: "POST", body: JSON.stringify(newTicket) });
      toast({ title: "Ticket created!", description: `Ticket ID: ${result.id}` });
      qc.invalidateQueries({ queryKey: ["20i-tickets"] });
      setShowCreate(false);
      setNewTicket({ subject: "", body: "", priority: "normal" });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReply() {
    if (!reply || !selected) return;
    setReplying(true);
    try {
      await apiFetch(`/api/admin/twenty-i/tickets/${selected.id}/reply`, { method: "POST", body: JSON.stringify({ body: reply }) });
      toast({ title: "Reply sent" });
      qc.invalidateQueries({ queryKey: ["20i-ticket", selected.id] });
      setReply("");
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setReplying(false);
    }
  }

  if (selected) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelected(null)} className="text-sm text-primary hover:underline flex items-center gap-1">
          ← Back to tickets
        </button>
        <Card>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">{(ticketDetail as any)?.subject ?? selected.subject}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Ticket #{selected.id}</p>
            </div>
            <Badge label={(ticketDetail as any)?.status ?? selected.status} color={(ticketDetail as any)?.status ?? selected.status} />
          </div>
          {loadingDetail ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            <div className="space-y-3 mb-4">
              {((ticketDetail as any)?.messages ?? []).map((msg: any, i: number) => (
                <div key={i} className={`p-3 rounded-xl text-sm ${msg.from === "Support" ? "bg-primary/5 border border-primary/10" : "bg-secondary/40"}`}>
                  <p className="text-xs text-muted-foreground mb-1 font-medium">{msg.from} · {msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ""}</p>
                  <p className="text-foreground whitespace-pre-wrap">{msg.body}</p>
                </div>
              ))}
              {!((ticketDetail as any)?.messages?.length) && <p className="text-sm text-muted-foreground">No messages loaded.</p>}
            </div>
          )}
          <div className="border-t border-border pt-4">
            <label className="text-xs text-muted-foreground mb-1.5 block">Your Reply</label>
            <textarea
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
              rows={3}
              placeholder="Type your reply to 20i Support…"
              value={reply}
              onChange={e => setReply(e.target.value)}
            />
            <div className="flex justify-end mt-2">
              <PrimaryBtn onClick={handleReply} disabled={replying || !reply}>
                {replying ? <Spinner /> : <Send size={14} />}
                Send Reply
              </PrimaryBtn>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{(tickets as any[]).length} ticket(s) from 20i Support</p>
        <PrimaryBtn onClick={() => setShowCreate(!showCreate)}>
          <Plus size={14} />
          New Ticket
        </PrimaryBtn>
      </div>

      {showCreate && (
        <Card className="p-4">
          <h3 className="font-medium mb-3">Create 20i Support Ticket</h3>
          <div className="space-y-3">
            <input className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40" placeholder="Subject" value={newTicket.subject} onChange={e => setNewTicket(p => ({ ...p, subject: e.target.value }))} />
            <textarea className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none" rows={4} placeholder="Describe the issue…" value={newTicket.body} onChange={e => setNewTicket(p => ({ ...p, body: e.target.value }))} />
            <select className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40" value={newTicket.priority} onChange={e => setNewTicket(p => ({ ...p, priority: e.target.value }))}>
              <option value="low">Low Priority</option>
              <option value="normal">Normal Priority</option>
              <option value="high">High Priority</option>
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-3 py-2 text-sm rounded-xl border border-border hover:bg-secondary/60 transition-colors">Cancel</button>
              <PrimaryBtn onClick={handleCreate} disabled={submitting || !newTicket.subject || !newTicket.body}>
                {submitting ? <Spinner /> : <Send size={14} />}
                Submit Ticket
              </PrimaryBtn>
            </div>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (tickets as any[]).length === 0 ? (
        <Card className="text-center py-10 text-muted-foreground text-sm">No tickets found.</Card>
      ) : (
        <div className="space-y-2">
          {(tickets as any[]).map((t: any) => (
            <Card key={t.id} className="p-4 cursor-pointer hover:bg-secondary/20 transition-colors" onClick={() => setSelected(t)}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{t.subject}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">#{t.id} · {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ""}</p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Badge label={t.status ?? "open"} color={t.status ?? "open"} />
                  <Eye size={14} className="text-muted-foreground" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TwentyIAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: server } = useQuery({
    queryKey: ["20i-server"],
    queryFn: () => apiFetch("/api/admin/twenty-i/server"),
    refetchInterval: 30000,
  });

  async function doSync() {
    setSyncing(true);
    try {
      const result = await apiFetch("/api/admin/twenty-i/sync", { method: "POST" });
      setLastSync(result.syncedAt ?? new Date().toISOString());
      qc.invalidateQueries({ queryKey: ["20i-sites"] });
      toast({ title: `Synced ${result.synced ?? 0} of ${result.total ?? 0} sites` });
    } catch (e: any) {
      toast({ title: "Sync failed", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  // Auto-sync every 5 minutes
  useEffect(() => {
    syncIntervalRef.current = setInterval(doSync, 5 * 60 * 1000);
    return () => { if (syncIntervalRef.current) clearInterval(syncIntervalRef.current); };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">20i Management Center</h2>
          <p className="text-muted-foreground text-sm mt-1">Complete 20i Reseller API control — StackUsers, hosting, migrations, and support.</p>
        </div>
        {lastSync && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card border border-border px-3 py-1.5 rounded-xl">
            <Clock size={12} />
            Last synced: {new Date(lastSync).toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Tab nav */}
      <div className="flex flex-wrap gap-1 bg-secondary/40 p-1 rounded-2xl w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-card text-foreground shadow-sm border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview"    && <OverviewTab server={server} lastSync={lastSync} onSync={doSync} syncing={syncing} />}
      {activeTab === "stack-users" && <StackUsersTab apiKey={server?.hasApiToken} />}
      {activeTab === "sites"       && <SitesTab />}
      {activeTab === "provision"   && <ProvisionTab />}
      {activeTab === "migrations"  && <MigrationsTab />}
      {activeTab === "tickets"     && <TicketsTab />}
    </div>
  );
}
