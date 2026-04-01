import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Server, Users, Globe, Plus, Trash2, ExternalLink, RefreshCw, AlertTriangle,
  CheckCircle, XCircle, Loader2, Search, Shield, ArrowRightLeft,
  Ticket, Send, Eye, Zap, Clock, UserPlus, Link2, Ban, Play,
  Database, FileText, Wifi, Globe2, ChevronRight, type LucideIcon,
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

function Spinner({ size = 16 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin" />;
}

function Badge({ label, color }: { label: string; color: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    suspended: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    terminated: "bg-red-500/10 text-red-500 border-red-500/20",
    open: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    in_progress: "bg-primary/10 text-primary border-primary/20",
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
            {loading ? <Spinner size={14} /> : <Trash2 size={14} />}
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function PrimaryBtn({ onClick, disabled, children, small, type = "button" }: {
  onClick?: () => void; disabled?: boolean; children: React.ReactNode; small?: boolean; type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 font-medium bg-primary/5 border border-primary/20 text-primary hover:bg-primary/10 transition-colors rounded-xl disabled:opacity-40 disabled:cursor-not-allowed ${small ? "text-xs px-2.5 py-1.5" : "text-sm px-3 py-2"}`}
    >
      {children}
    </button>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-card border border-border rounded-2xl shadow-sm ${className ?? "p-6"}`}>{children}</div>;
}

/**
 * Shown instead of red/amber error boxes when a 20i auth failure happens.
 * Lets the admin auto-sync the current IP to the 20i whitelist in one click.
 */
function IpBlockedBanner({ message, onSynced }: { message?: string; onSynced?: () => void }) {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/admin/twenty-i/whitelist/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await res.json();
      setResult(data);
      if (data.success) {
        toast({ title: `✓ IP ${data.outboundIp} added to 20i whitelist`, description: "Refreshing data…" });
        setTimeout(() => onSynced?.(), 1500);
      } else if (data.error === "chicken_and_egg") {
        // Expected — explain it clearly
      } else {
        toast({ title: "Sync failed", description: data.error ?? data.message, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Network error", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-4 py-3.5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Shield size={14} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">IP Not Whitelisted in 20i</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {message ?? "The server's outbound IP is blocked by 20i. Click below to auto-add the current IP."}
            </p>
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="shrink-0 flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-semibold disabled:opacity-50 shadow-sm whitespace-nowrap"
        >
          {syncing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
          {syncing ? "Syncing…" : "IP Changed? Sync with 20i"}
        </button>
      </div>

      {/* Sync result */}
      {result && (
        <div className={`border-t px-4 py-3 text-xs ${result.success ? "border-emerald-500/20 bg-emerald-500/5" : "border-primary/10 bg-primary/3"}`}>
          {result.success ? (
            <div className="flex items-center gap-2 text-emerald-600 font-medium">
              <CheckCircle size={12} />
              IP <span className="font-mono">{result.outboundIp}</span> successfully added to 20i whitelist.
              {result.currentList?.length > 0 && (
                <span className="text-muted-foreground ml-1">({result.currentList.length} IPs total)</span>
              )}
            </div>
          ) : result.error === "chicken_and_egg" ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-primary font-semibold">
                <AlertTriangle size={12} />
                Current IP <span className="font-mono">{result.outboundIp}</span> is blocked — cannot self-whitelist via API
              </div>
              <p className="text-muted-foreground leading-relaxed">
                20i blocks the API itself when your IP is not whitelisted (catch-22). You must manually add{" "}
                <span className="font-mono font-semibold text-foreground">{result.outboundIp}</span>{" "}
                once at{" "}
                <a
                  href="https://my.20i.com/reseller/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-primary"
                >
                  my.20i.com → Reseller API → IP Whitelist
                </a>
                , then return here to use auto-sync for future IP changes.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-primary font-medium">
              <XCircle size={12} />
              Sync failed: {result.error ?? result.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InputField({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-xs text-muted-foreground font-medium block">{label}</label>}
      <input
        className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 transition-shadow"
        {...props}
      />
    </div>
  );
}

function SelectField({ label, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-xs text-muted-foreground font-medium block">{label}</label>}
      <select
        className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 transition-shadow"
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview",     label: "Overview",      icon: Server },
  { id: "stack-users",  label: "StackUsers",    icon: Users },
  { id: "sites",        label: "Hosting Sites", icon: Globe },
  { id: "provision",    label: "Provision",     icon: Plus },
  { id: "migrations",   label: "Migrations",    icon: ArrowRightLeft },
  { id: "tickets",      label: "Tickets",       icon: Ticket },
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
              <p className="font-semibold text-foreground">{server?.name ?? "20i Server"}</p>
              <p className="text-sm text-muted-foreground">
                {server?.connected ? "Connected via 20i Reseller API" : (server?.error ?? "Not configured")}
              </p>
            </div>
          </div>
          <PrimaryBtn onClick={onSync} disabled={syncing}>
            {syncing ? <Spinner size={14} /> : <RefreshCw size={14} />}
            {syncing ? "Syncing…" : "Sync Now"}
          </PrimaryBtn>
        </div>
        {server?.connected && (
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">API Status</p>
              <p className="font-medium text-emerald-500 mt-1">Active</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Nameservers</p>
              <p className="font-medium text-foreground mt-1 text-xs">{server.ns1 ?? "ns1.20i.com"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last Synced</p>
              <p className="font-medium text-foreground mt-1">{lastSync ? new Date(lastSync).toLocaleTimeString() : "Never"}</p>
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
              <item.icon size={13} className="text-primary" />
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

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ["20i-stack-users"],
    queryFn: () => apiFetch("/api/admin/twenty-i/stack-users"),
    refetchInterval: 5 * 60 * 1000,
  });

  const filtered = (users as any[]).filter((u: any) =>
    !search ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.id?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreate() {
    if (!createForm.email || !createForm.name) return;
    setCreating(true);
    try {
      await apiFetch("/api/admin/twenty-i/stack-users", { method: "POST", body: JSON.stringify(createForm) });
      toast({ title: "StackUser created successfully" });
      qc.invalidateQueries({ queryKey: ["20i-stack-users"] });
      setShowCreate(false);
      setCreateForm({ email: "", name: "" });
    } catch (e: any) {
      toast({ title: "Failed to create", description: e.message, variant: "destructive" });
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
      toast({ title: "Failed to delete", description: e.message, variant: "destructive" });
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
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary/40 transition-shadow"
            placeholder="Search by name, email, or ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <PrimaryBtn onClick={() => refetch()} small>
          <RefreshCw size={12} />
          Refresh
        </PrimaryBtn>
        <PrimaryBtn onClick={() => setShowCreate(!showCreate)}>
          <UserPlus size={14} />
          New StackUser
        </PrimaryBtn>
      </div>

      {showCreate && (
        <Card className="p-5">
          <p className="text-sm font-semibold mb-4 text-foreground">Create New StackUser</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <InputField
              placeholder="Full name"
              value={createForm.name}
              onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))}
            />
            <InputField
              type="email"
              placeholder="Email address"
              value={createForm.email}
              onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-3 py-2 text-sm rounded-xl border border-border hover:bg-secondary/60 transition-colors">Cancel</button>
            <PrimaryBtn onClick={handleCreate} disabled={creating || !createForm.email || !createForm.name}>
              {creating ? <Spinner size={14} /> : <Plus size={14} />}
              {creating ? "Creating…" : "Create StackUser"}
            </PrimaryBtn>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {(users as any[]).length === 0 ? "No StackUsers found on this 20i account." : "No matches for your search."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/20">
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-semibold">Name</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-semibold">Email</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-semibold">User ID</th>
                <th className="px-4 py-3 text-right text-xs text-muted-foreground font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u: any) => (
                <tr key={u.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{u.name || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{u.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-500 hover:bg-red-500/10 transition-colors"
                        onClick={() => setConfirm({ userId: u.id, name: u.name || u.email })}
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </div>
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

  const { data: sites = [], isLoading, isError: sitesError, error: sitesErr, refetch } = useQuery({
    queryKey: ["20i-sites"],
    queryFn: async () => {
      const data = await apiFetch("/api/admin/twenty-i/sites");
      if (data?.error === "auth_failed") throw new Error(data.message);
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 5 * 60 * 1000,
    retry: false,
  });
  const { data: stackUsers = [] } = useQuery({
    queryKey: ["20i-stack-users"],
    queryFn: () => apiFetch("/api/admin/twenty-i/stack-users"),
  });

  const filtered = (sites as any[]).filter((s: any) =>
    !search ||
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
      toast({ title: "Action failed", description: e.message, variant: "destructive" });
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
      toast({ title: "Assignment failed", description: e.message, variant: "destructive" });
    } finally {
      setActioning(null);
    }
  }

  return (
    <div className="space-y-4">
      {sitesError && (
        <IpBlockedBanner
          message={(sitesErr as any)?.message ?? "Could not load sites — 20i returned a 401 auth error."}
          onSynced={refetch}
        />
      )}
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
            <SelectField value={assignUserId} onChange={e => setAssignUserId(e.target.value)}>
              <option value="">— Select StackUser —</option>
              {(stackUsers as any[]).map((u: any) => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </SelectField>
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => { setAssignModal(null); setAssignUserId(""); }} className="px-3 py-2 text-sm rounded-xl border border-border hover:bg-secondary/60 transition-colors">Cancel</button>
              <PrimaryBtn onClick={handleAssign} disabled={!assignUserId || !!actioning}>
                {actioning ? <Spinner size={14} /> : <Link2 size={14} />}
                Assign
              </PrimaryBtn>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary/40 transition-shadow"
            placeholder="Search by domain or site ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <PrimaryBtn small onClick={() => refetch()}>
          <RefreshCw size={12} />
          Refresh
        </PrimaryBtn>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No hosting sites found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/20">
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-semibold">Domain</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-semibold">Site ID</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-semibold">Status</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-semibold">Package</th>
                <th className="px-4 py-3 text-right text-xs text-muted-foreground font-semibold">Actions</th>
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
                          {actioning === s.id + "sso" ? <Spinner size={12} /> : <ExternalLink size={12} />}
                          StackCP
                        </PrimaryBtn>
                        <PrimaryBtn small onClick={() => setAssignModal({ siteId: s.id, domain: s.domain })}>
                          <Link2 size={12} />
                          Assign
                        </PrimaryBtn>
                        {isSuspended ? (
                          <PrimaryBtn small onClick={() => handleAction(s.id, "unsuspend")} disabled={actioning === s.id + "unsuspend"}>
                            {actioning === s.id + "unsuspend" ? <Spinner size={12} /> : <Play size={12} />}
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

type ProvisionStep = "idle" | "user" | "hosting" | "saving" | "done" | "error";

const PROVISION_STEPS = [
  { id: "user",    label: "StackUser",          desc: "Verifying / creating StackUser account on 20i",     icon: Users },
  { id: "hosting", label: "Provisioning",        desc: "Creating hosting package on 20i reseller account",  icon: Globe },
  { id: "saving",  label: "Saving to NoePanel",  desc: "Registering service, syncing DNS & credentials",    icon: Database },
];

function ProvisionTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ domain: "", packageId: "", clientId: "", stackUserId: "" });
  const [step, setStep] = useState<ProvisionStep>("idle");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const stepTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const { data: packages = [], isLoading: loadingPkgs } = useQuery({
    queryKey: ["20i-packages"],
    queryFn: () => apiFetch("/api/admin/twenty-i/packages"),
    staleTime: 5 * 60 * 1000,
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["20i-clients"],
    queryFn: () => apiFetch("/api/admin/twenty-i/clients"),
  });
  const { data: stackUsers = [] } = useQuery({
    queryKey: ["20i-stack-users"],
    queryFn: () => apiFetch("/api/admin/twenty-i/stack-users"),
  });

  function clearTimers() {
    stepTimersRef.current.forEach(t => clearTimeout(t));
    stepTimersRef.current = [];
  }

  async function handleSubmit() {
    if (!form.domain || !form.clientId) return;
    clearTimers();
    setStep("user");
    setResult(null);
    setError(null);

    // Advance to step 2 after 1.2s
    const t1 = setTimeout(() => setStep("hosting"), 1200);
    stepTimersRef.current.push(t1);

    try {
      const data = await apiFetch("/api/admin/twenty-i/provision", {
        method: "POST",
        body: JSON.stringify(form),
      });

      clearTimers();
      setStep("saving");

      // Brief "saving" pause for UX
      const t2 = setTimeout(() => {
        setStep("done");
        setResult(data);
        toast({ title: "Hosting provisioned successfully!" });
        qc.invalidateQueries({ queryKey: ["20i-sites"] });
        setForm({ domain: "", packageId: "", clientId: "", stackUserId: "" });
      }, 600);
      stepTimersRef.current.push(t2);
    } catch (e: any) {
      clearTimers();
      setStep("error");
      setError(e.message);
      toast({ title: "Provisioning failed", description: e.message, variant: "destructive" });
    }
  }

  const activeStepIdx = step === "user" ? 0 : step === "hosting" ? 1 : step === "saving" ? 2 : -1;
  const isSubmitting = step === "user" || step === "hosting" || step === "saving";

  return (
    <div className="space-y-5 max-w-2xl">
      <Card>
        <h3 className="font-semibold text-foreground mb-1">Create Hosting Account on 20i</h3>
        <p className="text-sm text-muted-foreground mb-5">Provision a new hosting account directly from NoePanel. Package list fetched live from your 20i reseller account.</p>
        <div className="space-y-3">
          <InputField
            label="Domain Name *"
            placeholder="e.g. example.com"
            value={form.domain}
            onChange={e => setForm(p => ({ ...p, domain: e.target.value }))}
            disabled={isSubmitting}
          />
          <SelectField
            label={`20i Package${loadingPkgs ? " (loading…)" : ""}`}
            value={form.packageId}
            onChange={e => setForm(p => ({ ...p, packageId: e.target.value }))}
            disabled={isSubmitting}
          >
            <option value="">— Default package —</option>
            {(packages as any[]).map((pkg: any) => (
              <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
            ))}
          </SelectField>
          <SelectField
            label="Assign to Client *"
            value={form.clientId}
            onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))}
            disabled={isSubmitting}
          >
            <option value="">— Select client —</option>
            {(clients as any[]).map((c: any) => (
              <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.email})</option>
            ))}
          </SelectField>
          <SelectField
            label="Assign to StackUser (optional)"
            value={form.stackUserId}
            onChange={e => setForm(p => ({ ...p, stackUserId: e.target.value }))}
            disabled={isSubmitting}
          >
            <option value="">— No StackUser —</option>
            {(stackUsers as any[]).map((u: any) => (
              <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
            ))}
          </SelectField>
          <PrimaryBtn onClick={handleSubmit} disabled={isSubmitting || !form.domain || !form.clientId}>
            {isSubmitting ? <Spinner size={14} /> : <Zap size={14} />}
            {isSubmitting ? "Provisioning…" : "Create Account"}
          </PrimaryBtn>
        </div>
      </Card>

      {/* Step-by-step progress */}
      {step !== "idle" && step !== "done" && (
        <Card className="p-5">
          <p className="text-sm font-semibold text-foreground mb-4">
            {step === "error" ? "Provisioning Failed" : "Provisioning in Progress…"}
          </p>
          <div className="space-y-3">
            {PROVISION_STEPS.map((s, idx) => {
              const isDone = step === "error" ? false : activeStepIdx > idx;
              const isActive = step === "error" ? false : activeStepIdx === idx;
              const isFailed = step === "error" && activeStepIdx === idx;
              return (
                <div key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  isDone ? "border-emerald-500/20 bg-emerald-500/5"
                  : isActive ? "border-primary/20 bg-primary/5"
                  : isFailed ? "border-red-500/20 bg-red-500/5"
                  : "border-border/50 opacity-40"
                }`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isDone ? "bg-emerald-500/10"
                    : isActive ? "bg-primary/10"
                    : isFailed ? "bg-red-500/10"
                    : "bg-secondary"
                  }`}>
                    {isDone ? <CheckCircle size={14} className="text-emerald-500" />
                    : isActive ? <Spinner size={14} />
                    : isFailed ? <XCircle size={14} className="text-red-500" />
                    : <ChevronRight size={13} className="text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isDone ? "text-emerald-600" : isActive ? "text-primary" : isFailed ? "text-red-500" : "text-muted-foreground"}`}>
                      Step {idx + 1}: {s.label}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{s.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {step === "error" && error && (
            <div className="mt-3 p-3 rounded-xl border border-primary/20 bg-primary/5 text-xs text-primary">
              {error}
            </div>
          )}
        </Card>
      )}

      {/* Success result */}
      {step === "done" && result && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle size={16} className="text-emerald-500" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Hosting Created Successfully</p>
              <p className="text-xs text-muted-foreground">All 3 steps completed</p>
            </div>
          </div>
          <div className="space-y-2 text-sm border-t border-border pt-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Site ID</span>
              <span className="font-mono text-foreground text-xs">{result.siteId}</span>
            </div>
            {result.cpanelUrl && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">StackCP URL</span>
                <a href={result.cpanelUrl} target="_blank" rel="noreferrer" className="text-primary text-xs underline flex items-center gap-1">
                  Open <ExternalLink size={11} />
                </a>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Service ID</span>
              <span className="font-mono text-foreground text-xs">{result.serviceId}</span>
            </div>
          </div>
          <button onClick={() => setStep("idle")} className="mt-4 w-full text-center text-xs text-primary hover:underline">
            Provision another account
          </button>
        </Card>
      )}
    </div>
  );
}

// ─── Migrations Tab ───────────────────────────────────────────────────────────

const MIGRATION_STATUS_STEPS: Record<string, { label: string; icon: LucideIcon; desc: string }> = {
  queued:      { label: "Queued",              icon: Clock,         desc: "Waiting for migration slot…" },
  connecting:  { label: "Connecting",          icon: Wifi,          desc: "Connecting to source server…" },
  transferring:{ label: "Transferring Files",  icon: FileText,      desc: "Copying files from source host…" },
  db_import:   { label: "Importing Database",  icon: Database,      desc: "Importing MySQL/MariaDB databases…" },
  dns:         { label: "Configuring DNS",     icon: Globe2,        desc: "Updating DNS records & propagation…" },
  verifying:   { label: "Verifying",           icon: CheckCircle,   desc: "Checking file integrity & health…" },
  in_progress: { label: "In Progress",         icon: ArrowRightLeft, desc: "Migration running on 20i servers…" },
  completed:   { label: "Completed",           icon: CheckCircle,   desc: "Migration finished successfully" },
  failed:      { label: "Failed",              icon: XCircle,       desc: "Migration encountered an error" },
};

function progressToStep(progress: number): string {
  if (progress < 10) return "connecting";
  if (progress < 30) return "transferring";
  if (progress < 55) return "db_import";
  if (progress < 70) return "dns";
  if (progress < 90) return "verifying";
  return "in_progress";
}

function MigrationsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ domain: "", sourceType: "cpanel", host: "", username: "", password: "", siteId: "" });
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);

  const { data: migrations = [], isLoading, isError: migrationsError, error: migrationsErr, refetch } = useQuery({
    queryKey: ["20i-migrations"],
    queryFn: async () => {
      const data = await apiFetch("/api/admin/twenty-i/migrations");
      if (data?.error === "auth_failed") throw new Error(data.message);
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: polling ? 6000 : false,
    retry: false,
  });

  // Enable polling if any migration is in progress
  useEffect(() => {
    const hasActive = (migrations as any[]).some((m: any) => m.status === "in_progress" || m.status === "queued");
    setPolling(hasActive);
  }, [migrations]);

  async function handleStart() {
    if (!form.domain || !form.host || !form.username || !form.password) return;
    setSubmitting(true);
    try {
      const result = await apiFetch("/api/admin/twenty-i/migrations", { method: "POST", body: JSON.stringify(form) });
      toast({ title: "Migration started!", description: `ID: ${result.id}` });
      setPolling(true);
      qc.invalidateQueries({ queryKey: ["20i-migrations"] });
      setForm({ domain: "", sourceType: "cpanel", host: "", username: "", password: "", siteId: "" });
    } catch (e: any) {
      toast({ title: "Failed to start migration", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {migrationsError && (
        <IpBlockedBanner
          message={(migrationsErr as any)?.message ?? "Could not load migrations — 20i returned a 401 auth error."}
          onSynced={refetch}
        />
      )}
      <Card>
        <h3 className="font-semibold text-foreground mb-1">Start New Migration</h3>
        <p className="text-sm text-muted-foreground mb-4">Enter source server credentials. 20i will transfer files, databases, and DNS automatically.</p>
        <div className="grid grid-cols-2 gap-3">
          <InputField label="Target Domain *" placeholder="example.com" value={form.domain} onChange={e => setForm(p => ({ ...p, domain: e.target.value }))} />
          <SelectField label="Source Panel Type *" value={form.sourceType} onChange={e => setForm(p => ({ ...p, sourceType: e.target.value }))}>
            <option value="cpanel">cPanel / WHM</option>
            <option value="plesk">Plesk</option>
            <option value="directadmin">DirectAdmin</option>
            <option value="other">Other</option>
          </SelectField>
          <InputField label="Source Host / IP *" placeholder="server1.example.com" value={form.host} onChange={e => setForm(p => ({ ...p, host: e.target.value }))} />
          <InputField label="Username *" placeholder="cPanel / panel username" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} />
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium block">Password *</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                className="w-full px-3 py-2 pr-10 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 transition-shadow"
                placeholder="Panel password"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPass(v => !v)}>
                <Eye size={13} />
              </button>
            </div>
          </div>
          <InputField label="Target Site ID (optional)" placeholder="20i site ID" value={form.siteId} onChange={e => setForm(p => ({ ...p, siteId: e.target.value }))} />
        </div>
        <div className="mt-4">
          <PrimaryBtn onClick={handleStart} disabled={submitting || !form.domain || !form.host || !form.username || !form.password}>
            {submitting ? <Spinner size={14} /> : <ArrowRightLeft size={14} />}
            {submitting ? "Starting…" : "Start Migration"}
          </PrimaryBtn>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">Migration History</h3>
          {polling && <span className="flex items-center gap-1 text-xs text-primary"><span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />Live</span>}
        </div>
        <PrimaryBtn small onClick={() => refetch()}>
          <RefreshCw size={12} />
          Refresh
        </PrimaryBtn>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (migrations as any[]).length === 0 ? (
        <Card className="text-center py-10 text-muted-foreground text-sm">No migrations found. Start one above.</Card>
      ) : (
        <div className="space-y-3">
          {(migrations as any[]).map((m: any) => {
            const progress = m.progress ?? 0;
            const resolvedStatus = m.status === "in_progress" ? progressToStep(progress) : m.status;
            const stepInfo = MIGRATION_STATUS_STEPS[resolvedStatus] ?? MIGRATION_STATUS_STEPS["in_progress"];
            const StepIcon = stepInfo.icon;
            const isActive = m.status === "in_progress" || m.status === "queued";
            const isDone = m.status === "completed";
            const isFailed = m.status === "failed";

            return (
              <Card key={m.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isDone ? "bg-emerald-500/10" : isFailed ? "bg-red-500/10" : "bg-primary/10"}`}>
                      {isActive
                        ? <Spinner size={14} />
                        : <StepIcon size={14} className={isDone ? "text-emerald-500" : isFailed ? "text-red-500" : "text-primary"} />}
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">{m.domain}</p>
                      <p className="text-xs text-muted-foreground">ID: {m.id} · {m.sourceType || "Unknown source"}</p>
                    </div>
                  </div>
                  <Badge label={m.status} color={m.status} />
                </div>

                {/* Progress bar */}
                <div className="mt-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                    <span className={`font-medium ${isActive ? "text-primary" : isDone ? "text-emerald-500" : isFailed ? "text-red-500" : ""}`}>
                      {stepInfo.label}
                    </span>
                    <span>{isDone ? "100" : progress}%</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${isDone ? "bg-emerald-500" : isFailed ? "bg-red-500" : "bg-primary"} ${isActive ? "animate-pulse" : ""}`}
                      style={{ width: `${isDone ? 100 : progress}%` }}
                    />
                  </div>
                  {isActive && (
                    <p className="text-xs text-muted-foreground mt-1.5">{stepInfo.desc}</p>
                  )}
                </div>
              </Card>
            );
          })}
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
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newTicket, setNewTicket] = useState({ subject: "", body: "", priority: "normal" });
  const [submitting, setSubmitting] = useState(false);
  const [replying, setReplying] = useState(false);

  const { data: tickets = [], isLoading, refetch } = useQuery({
    queryKey: ["20i-tickets"],
    queryFn: () => apiFetch("/api/admin/twenty-i/tickets"),
    refetchInterval: 3 * 60 * 1000,
  });

  const { data: ticketDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ["20i-ticket", selected?.id],
    queryFn: () => apiFetch(`/api/admin/twenty-i/tickets/${selected?.id}`),
    enabled: !!selected?.id,
  });

  const filtered = (tickets as any[]).filter((t: any) =>
    !search ||
    t.subject?.toLowerCase().includes(search.toLowerCase()) ||
    String(t.id).includes(search)
  );

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
      toast({ title: "Reply sent to 20i Support" });
      qc.invalidateQueries({ queryKey: ["20i-ticket", selected.id] });
      setReply("");
    } catch (e: any) {
      toast({ title: "Failed to send reply", description: e.message, variant: "destructive" });
    } finally {
      setReplying(false);
    }
  }

  if (selected) {
    return (
      <div className="space-y-4">
        <button onClick={() => { setSelected(null); setReply(""); }} className="text-sm text-primary hover:underline flex items-center gap-1">
          ← Back to tickets
        </button>
        <Card>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">{(ticketDetail as any)?.subject ?? selected.subject}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Ticket #{selected.id} · 20i Support</p>
            </div>
            <Badge label={(ticketDetail as any)?.status ?? selected.status} color={(ticketDetail as any)?.status ?? selected.status} />
          </div>
          {loadingDetail ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            <div className="space-y-2.5 mb-4">
              {((ticketDetail as any)?.messages ?? []).map((msg: any, i: number) => (
                <div key={i} className={`p-3.5 rounded-xl text-sm ${msg.from === "Support" ? "bg-primary/5 border border-primary/10" : "bg-secondary/40 border border-border/40"}`}>
                  <p className="text-xs text-muted-foreground mb-1.5 font-semibold">{msg.from} · {msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ""}</p>
                  <p className="text-foreground whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                </div>
              ))}
              {!((ticketDetail as any)?.messages?.length) && <p className="text-sm text-muted-foreground py-4 text-center">No messages loaded.</p>}
            </div>
          )}
          <div className="border-t border-border pt-4">
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Your Reply to 20i Support</label>
            <textarea
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none transition-shadow"
              rows={4}
              placeholder="Type your reply…"
              value={reply}
              onChange={e => setReply(e.target.value)}
            />
            <div className="flex justify-end mt-2">
              <PrimaryBtn onClick={handleReply} disabled={replying || !reply}>
                {replying ? <Spinner size={14} /> : <Send size={14} />}
                {replying ? "Sending…" : "Send Reply"}
              </PrimaryBtn>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary/40 transition-shadow"
            placeholder="Search by subject or ticket ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <PrimaryBtn small onClick={() => refetch()}>
          <RefreshCw size={12} />
          Refresh
        </PrimaryBtn>
        <PrimaryBtn onClick={() => setShowCreate(!showCreate)}>
          <Plus size={14} />
          New Ticket
        </PrimaryBtn>
      </div>

      {showCreate && (
        <Card className="p-5">
          <h3 className="font-semibold mb-4 text-foreground">Create 20i Support Ticket</h3>
          <div className="space-y-3">
            <InputField placeholder="Subject" value={newTicket.subject} onChange={e => setNewTicket(p => ({ ...p, subject: e.target.value }))} />
            <textarea
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none transition-shadow"
              rows={4}
              placeholder="Describe the issue in detail…"
              value={newTicket.body}
              onChange={e => setNewTicket(p => ({ ...p, body: e.target.value }))}
            />
            <SelectField value={newTicket.priority} onChange={e => setNewTicket(p => ({ ...p, priority: e.target.value }))}>
              <option value="low">Low Priority</option>
              <option value="normal">Normal Priority</option>
              <option value="high">High Priority</option>
            </SelectField>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-3 py-2 text-sm rounded-xl border border-border hover:bg-secondary/60 transition-colors">Cancel</button>
              <PrimaryBtn onClick={handleCreate} disabled={submitting || !newTicket.subject || !newTicket.body}>
                {submitting ? <Spinner size={14} /> : <Send size={14} />}
                {submitting ? "Submitting…" : "Submit Ticket"}
              </PrimaryBtn>
            </div>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-10 text-muted-foreground text-sm">
          {(tickets as any[]).length === 0 ? "No tickets found from 20i Support." : "No matches for your search."}
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((t: any) => (
            <Card
              key={t.id}
              className="p-4 cursor-pointer hover:bg-secondary/20 transition-colors hover:border-primary/20"
              onClick={() => setSelected(t)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{t.subject}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    #{t.id} · {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "Unknown date"}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  <Badge label={t.status ?? "open"} color={t.status ?? "open"} />
                  <Eye size={13} className="text-muted-foreground" />
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

  // Live diagnostic state
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagResult, setDiagResult] = useState<any | null>(null);
  const [showDiag, setShowDiag] = useState(false);

  async function runDiagnostic() {
    setDiagRunning(true);
    setDiagResult(null);
    try {
      const result = await apiFetch("/api/admin/twenty-i/diagnostic");
      setDiagResult(result);
      setShowDiag(true);
    } catch (e: any) {
      setDiagResult({ ok: false, error: "exception", message: e.message });
      setShowDiag(true);
    } finally {
      setDiagRunning(false);
    }
  }

  // Whitelist panel state
  const [wlLoading, setWlLoading] = useState(false);
  const [wlData, setWlData] = useState<any | null>(null);
  const [wlSyncing, setWlSyncing] = useState(false);
  const [showWl, setShowWl] = useState(false);

  async function loadWhitelist() {
    setWlLoading(true);
    try {
      const data = await apiFetch("/api/admin/twenty-i/whitelist");
      setWlData(data);
      setShowWl(true);
    } catch (e: any) {
      toast({ title: "Could not load whitelist", description: e.message, variant: "destructive" });
    } finally {
      setWlLoading(false);
    }
  }

  async function syncWhitelist() {
    setWlSyncing(true);
    try {
      const data = await apiFetch("/api/admin/twenty-i/whitelist/sync", { method: "POST" });
      setWlData((prev: any) => prev ? { ...prev, ...data } : data);
      if (data.success) {
        toast({ title: `✓ IP ${data.outboundIp} added to 20i whitelist` });
        // Refresh whitelist info
        const fresh = await apiFetch("/api/admin/twenty-i/whitelist");
        setWlData(fresh);
        qc.invalidateQueries({ queryKey: ["20i-sites"] });
        qc.invalidateQueries({ queryKey: ["20i-migrations"] });
      } else if (data.error === "chicken_and_egg") {
        toast({
          title: "Manual step required",
          description: `Add ${data.outboundIp} at my.20i.com → Reseller API → IP Whitelist`,
        });
      } else {
        toast({ title: "Sync failed", description: data.error ?? data.message, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Sync error", description: e.message, variant: "destructive" });
    } finally {
      setWlSyncing(false);
    }
  }

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

  useEffect(() => {
    syncIntervalRef.current = setInterval(doSync, 5 * 60 * 1000);
    return () => { if (syncIntervalRef.current) clearInterval(syncIntervalRef.current); };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">NoePanel — 20i Management</h2>
          <p className="text-muted-foreground text-sm mt-1">StackUsers, hosting provisioning, migrations, and live support — all from NoePanel.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {lastSync && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card border border-border px-3 py-1.5 rounded-xl shadow-sm">
              <Clock size={11} />
              Synced {new Date(lastSync).toLocaleTimeString()}
            </div>
          )}
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border shadow-sm ${server?.connected ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600" : "bg-red-500/5 border-red-500/20 text-red-500"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${server?.connected ? "bg-emerald-500" : "bg-red-500"}`} />
            {server?.connected ? "API Connected" : "API Offline"}
          </div>
          <button
            onClick={runDiagnostic}
            disabled={diagRunning}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors font-medium shadow-sm disabled:opacity-50"
          >
            {diagRunning ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
            {diagRunning ? "Diagnosing…" : "Run Diagnostic"}
          </button>
          <button
            onClick={showWl ? () => setShowWl(false) : loadWhitelist}
            disabled={wlLoading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-primary/40 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-semibold shadow-sm disabled:opacity-50"
          >
            {wlLoading ? <Loader2 size={11} className="animate-spin" /> : <Shield size={11} />}
            {wlLoading ? "Loading…" : "Update 20i Whitelist"}
          </button>
        </div>
      </div>

      {/* Live Diagnostic Panel */}
      {showDiag && diagResult && (
        <div className={`rounded-2xl border overflow-hidden ${diagResult.ok ? "border-emerald-500/20 bg-emerald-500/5" : "border-primary/20 bg-primary/5"}`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-primary/10">
            <div className="flex items-center gap-2 font-semibold text-sm">
              {diagResult.ok
                ? <CheckCircle size={14} className="text-emerald-500" />
                : <XCircle size={14} className="text-primary" />}
              <span className={diagResult.ok ? "text-emerald-600" : "text-primary"}>
                {diagResult.ok ? "20i API Connected Successfully" : "20i API Connection Failed"}
              </span>
            </div>
            <button onClick={() => setShowDiag(false)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
          </div>
          <div className="divide-y divide-primary/10 text-xs font-mono">
            {diagResult.hint && (
              <div className="px-4 py-2.5 bg-amber-500/5 border-b border-amber-500/15">
                <span className="text-amber-600 font-sans font-semibold">⚠ Action needed: </span>
                <span className="text-foreground/80 font-sans">{diagResult.hint}</span>
              </div>
            )}
            {[
              ["Server", diagResult.serverName ?? "—"],
              ["Outbound IP", diagResult.debug?.outboundIp
                ? `${diagResult.debug.outboundIp}${diagResult.debug.proxyActive ? ` (proxy: ${diagResult.debug.proxyUrl ?? "active"})` : " (direct — must be whitelisted in 20i)"}`
                : "—"],
              ["Authorization", diagResult.debug?.authFormat ?? "—"],
              ["Key", `${diagResult.debug?.keyLength ?? "?"} chars · first: ${diagResult.debug?.keyFirst4 ?? "?"}… last: …${diagResult.debug?.keyLast4 ?? "?"}${diagResult.debug?.keyHasHiddenChars ? " ⚠ hidden chars were stripped" : ""}`],
              ["Response", `HTTP ${diagResult.debug?.responseStatus ?? "ERR"} in ${diagResult.debug?.durationMs ?? "?"}ms`],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-3 px-4 py-2">
                <span className="text-muted-foreground w-28 shrink-0 font-sans">{label}</span>
                <span className="text-foreground/80 break-all">{value}</span>
              </div>
            ))}
            <div className="px-4 py-2.5">
              <span className="text-muted-foreground font-sans block mb-1">Raw 20i Response</span>
              <pre className="text-foreground/70 whitespace-pre-wrap break-all leading-relaxed">
                {diagResult.debug?.responseBody ?? diagResult.message ?? "No response body"}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Whitelist Panel */}
      {showWl && wlData && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-primary/10">
            <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
              <Shield size={14} className="text-primary" />
              20i IP Whitelist Manager
            </div>
            <button onClick={() => setShowWl(false)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
          </div>

          {/* Current IP status */}
          <div className="px-4 py-3.5 flex items-center justify-between flex-wrap gap-3 border-b border-primary/10">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Current Outbound IP (this server)</p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-foreground">{wlData.outboundIp}</span>
                {wlData.serverConfigured && (
                  wlData.isWhitelisted
                    ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">✓ Whitelisted</span>
                    : <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">Not whitelisted</span>
                )}
                {wlData.proxy?.enabled && (
                  <span className="text-[10px] text-muted-foreground bg-secondary/60 border border-border/40 rounded px-1.5">via proxy</span>
                )}
              </div>
              {wlData.fetchError && (
                <p className="text-xs text-muted-foreground mt-1">
                  Could not read current whitelist from 20i (likely IP blocked) — whitelist entries not shown.
                </p>
              )}
            </div>
            <button
              onClick={syncWhitelist}
              disabled={wlSyncing}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-semibold disabled:opacity-50 shadow-sm"
            >
              {wlSyncing ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
              {wlSyncing ? "Adding to whitelist…" : "Add Current IP to Whitelist"}
            </button>
          </div>

          {/* Existing whitelist entries */}
          {wlData.currentList?.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground mb-2 font-medium">Currently Whitelisted IPs ({wlData.currentList.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {wlData.currentList.map((ip: string) => (
                  <span
                    key={ip}
                    className={`font-mono text-xs px-2.5 py-1 rounded-lg border ${ip === wlData.outboundIp ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 font-semibold" : "bg-secondary/50 border-border/50 text-muted-foreground"}`}
                  >
                    {ip}{ip === wlData.outboundIp && " ← current"}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Chicken-and-egg notice when IP not yet whitelisted */}
          {!wlData.isWhitelisted && wlData.serverConfigured && (
            <div className="px-4 py-3 border-t border-primary/10 bg-secondary/20">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">First-time setup:</strong> If the current IP has never been whitelisted, clicking "Add Current IP" will return a 401 (catch-22 — the API itself is blocked). You must add{" "}
                <span className="font-mono font-semibold text-foreground">{wlData.outboundIp}</span>{" "}
                once manually at{" "}
                <a href="https://my.20i.com/reseller/api" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  my.20i.com → Reseller API → IP Whitelist
                </a>
                . After that, this button will work for future IP changes automatically.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab nav */}
      <div className="flex flex-wrap gap-1 bg-secondary/40 p-1 rounded-2xl w-fit border border-border/40">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-card text-foreground shadow-sm border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon size={13} />
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
