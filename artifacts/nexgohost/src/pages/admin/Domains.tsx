import { useState } from "react";
import { Globe, Search, RefreshCw, Plus, Pencil, Trash2, X, DollarSign, Zap, Loader2, Calendar, Lock, ShieldCheck, AlertTriangle, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

const DOMAIN_CYCLE_OPTIONS = [
  { label: "1 Year", years: 1 },
  { label: "2 Years", years: 2 },
  { label: "3 Years", years: 3 },
];

function addYearsToDate(baseIso: string, years: number): string {
  const base = baseIso ? new Date(baseIso + "T00:00:00") : new Date();
  base.setFullYear(base.getFullYear() + years);
  return base.toISOString().split("T")[0];
}

function fmtDateShort(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

interface Domain {
  id: string; clientId: string; clientName: string;
  name: string; tld: string; registrar: string;
  registrationDate?: string; expiryDate?: string; nextDueDate?: string;
  status: string; autoRenew: boolean; nameservers: string[];
  moduleServerId?: string | null;
  lockStatus?: string | null;
  eppCode?: string | null;
  lockOverrideByAdmin?: boolean;
  isIn60DayLock?: boolean;
  daysRemainingInLock?: number;
  lastLockChange?: string | null;
}

interface Client { id: string; firstName: string; lastName: string; email: string; }

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-400 border-green-500/20",
  expired: "bg-red-500/10 text-red-400 border-red-500/20",
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  transferred: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  suspended: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  cancelled: "bg-red-800/10 text-red-600 border-red-800/20",
  grace_period: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  redemption_period: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  pending_delete: "bg-red-700/10 text-red-500 border-red-700/20",
  client_hold: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

const STATUS_OPTIONS = ["active", "pending", "expired", "suspended", "transferred", "cancelled", "grace_period", "redemption_period", "pending_delete", "client_hold"];

const LIFECYCLE_OVERRIDE_OPTIONS = [
  { value: "active", label: "Active", color: "text-green-400" },
  { value: "grace_period", label: "Grace Period", color: "text-purple-400" },
  { value: "redemption_period", label: "Redemption Period", color: "text-amber-400" },
  { value: "client_hold", label: "Client Hold", color: "text-slate-400" },
  { value: "pending_delete", label: "Pending Delete", color: "text-red-500" },
];

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Request failed"); }
  return res.json();
}

const EMPTY_FORM = { clientId: "", name: "", tld: ".com", registrar: "", registrationDate: "", expiryDate: "", nextDueDate: "", status: "active", autoRenew: true, moduleServerId: "", nameservers: "ns1.noehost.com\nns2.noehost.com" };

export default function AdminDomains() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editDomain, setEditDomain] = useState<Domain | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [lockOverrideId, setLockOverrideId] = useState<string | null>(null);
  const [lockResults, setLockResults] = useState<Record<string, { lockStatus: string; eppCode?: string | null; lockOverrideByAdmin?: boolean }>>({});
  const [lifecycleOverrideId, setLifecycleOverrideId] = useState<string | null>(null);
  const [lifecycleDropdown, setLifecycleDropdown] = useState<string | null>(null);

  const { data: domains = [], isLoading } = useQuery<Domain[]>({
    queryKey: ["admin-domains"],
    queryFn: () => apiFetch("/api/admin/domains"),
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["admin-clients-simple"],
    queryFn: () => apiFetch("/api/admin/clients?limit=100").then((r: any) => r.clients || r),
  });

  const filtered = domains.filter(d => {
    const matchSearch = (d.name + d.tld).toLowerCase().includes(search.toLowerCase()) ||
      d.clientName?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const parseNs = (raw: string) => raw.split("\n").map(s => s.trim().toLowerCase()).filter(Boolean);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId || !form.name || !form.tld) {
      toast({ title: "Error", description: "Client, name, and TLD are required", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const { nameservers: rawNs, ...rest } = form;
      await apiFetch("/api/admin/domains", { method: "POST", body: JSON.stringify({ ...rest, nameservers: parseNs(rawNs) }) });
      queryClient.invalidateQueries({ queryKey: ["admin-domains"] });
      toast({ title: "Domain added" });
      setShowAddModal(false); setForm(EMPTY_FORM);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDomain) return;
    setSaving(true);
    try {
      const { nameservers: rawNs, ...rest } = form;
      await apiFetch(`/api/admin/domains/${editDomain.id}`, { method: "PUT", body: JSON.stringify({ ...rest, nameservers: parseNs(rawNs) }) });
      queryClient.invalidateQueries({ queryKey: ["admin-domains"] });
      toast({ title: "Domain updated" });
      setEditDomain(null); setForm(EMPTY_FORM);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string, domainName: string) => {
    if (!confirm(`Delete domain "${domainName}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/admin/domains/${id}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["admin-domains"] });
      toast({ title: "Domain deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleRenew = async (id: string) => {
    try {
      await apiFetch(`/api/admin/domains/${id}/renew`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["admin-domains"] });
      toast({ title: "Domain renewed" });
    } catch {
      toast({ title: "Failed to renew", variant: "destructive" });
    }
  };

  const handleSyncModule = async (id: string) => {
    setSyncingId(id);
    try {
      const data = await apiFetch(`/api/admin/domains/${id}/sync-module`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["admin-domains"] });
      toast({
        title: data.success ? "Module synced" : "Sync unavailable",
        description: data.message || (data.success ? "Nameservers updated from module" : "Could not connect to module"),
        variant: data.success ? "default" : "destructive",
      });
    } catch (err: any) {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    } finally { setSyncingId(null); }
  };

  const handleLockOverride = async (domain: Domain) => {
    const currentLock = lockResults[domain.id]?.lockStatus ?? domain.lockStatus ?? "locked";
    const nextLock = currentLock === "locked" ? "unlocked" : "locked";
    setLockOverrideId(domain.id);
    try {
      const data = await apiFetch(`/api/admin/domains/${domain.id}/lock-override`, {
        method: "PUT",
        body: JSON.stringify({ lockStatus: nextLock, override: true }),
      });
      setLockResults(prev => ({ ...prev, [domain.id]: { lockStatus: data.lockStatus, eppCode: data.eppCode, lockOverrideByAdmin: data.lockOverrideByAdmin } }));
      toast({
        title: `Lock ${data.lockStatus === "locked" ? "enabled" : "disabled"} (Admin Override)`,
        description: `${domain.name}${domain.tld}${data.lockStatus === "unlocked" && data.eppCode ? ` — EPP: ${data.eppCode}` : ""}`,
      });
    } catch (err: any) {
      toast({ title: "Lock override failed", description: err.message, variant: "destructive" });
    } finally { setLockOverrideId(null); }
  };

  const handleLifecycleOverride = async (domainId: string, targetStatus: string) => {
    setLifecycleOverrideId(domainId);
    setLifecycleDropdown(null);
    try {
      await apiFetch(`/api/admin/domains/${domainId}/lifecycle-override`, {
        method: "PATCH",
        body: JSON.stringify({ status: targetStatus }),
      });
      queryClient.invalidateQueries({ queryKey: ["admin-domains"] });
      toast({ title: `Lifecycle override applied`, description: `Status set to ${targetStatus.replace(/_/g, " ")}` });
    } catch (err: any) {
      toast({ title: "Override failed", description: err.message, variant: "destructive" });
    } finally { setLifecycleOverrideId(null); }
  };

  const openEdit = (d: Domain) => {
    setEditDomain(d);
    setForm({
      clientId: d.clientId, name: d.name, tld: d.tld, registrar: d.registrar || "",
      registrationDate: d.registrationDate ? d.registrationDate.slice(0, 10) : "",
      expiryDate: d.expiryDate ? d.expiryDate.slice(0, 10) : "",
      nextDueDate: d.nextDueDate ? d.nextDueDate.slice(0, 10) : "",
      status: d.status, autoRenew: d.autoRenew, moduleServerId: d.moduleServerId || "",
      nameservers: (d.nameservers || []).join("\n") || "ns1.noehost.com\nns2.noehost.com",
    });
  };

  const DomainForm = ({ onSubmit, title, isEdit }: { onSubmit: (e: React.FormEvent) => void; title: string; isEdit?: boolean }) => (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-semibold text-lg text-foreground">{title}</h2>
          <Button variant="ghost" size="icon" onClick={() => { setShowAddModal(false); setEditDomain(null); setForm(EMPTY_FORM); }}>
            <X size={18} />
          </Button>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">Client *</label>
            <select value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
              className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">Select client...</option>
              {clients.map((c: Client) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.email})</option>)}
            </select>
          </div>
          {!isEdit && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Domain Name *</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="example" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">TLD *</label>
                <Input value={form.tld} onChange={e => setForm(f => ({ ...f, tld: e.target.value }))} placeholder=".com" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Registrar</label>
              <Input value={form.registrar} onChange={e => setForm(f => ({ ...f, registrar: e.target.value }))} placeholder="GoDaddy, Namecheap..." />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                {STATUS_OPTIONS.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Registration Date</label>
              <Input type="date" value={form.registrationDate}
                onChange={e => setForm(f => ({ ...f, registrationDate: e.target.value }))} />
              {form.registrationDate && (
                <p className="text-xs text-muted-foreground">{fmtDateShort(form.registrationDate)}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80">Domain Cycle</label>
              <div className="flex gap-2 flex-wrap">
                {DOMAIN_CYCLE_OPTIONS.map(opt => {
                  const expiry = addYearsToDate(form.registrationDate, opt.years);
                  const active = form.expiryDate === expiry && form.nextDueDate === expiry;
                  return (
                    <button key={opt.years} type="button"
                      onClick={() => setForm(f => ({ ...f, expiryDate: expiry, nextDueDate: expiry }))}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${active ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400" : "border-border text-muted-foreground hover:border-emerald-500/30 hover:text-emerald-400"}`}>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {form.expiryDate && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Calendar size={11} className="text-emerald-400" />
                  Expires & due: <span className="text-emerald-400 font-medium">{fmtDateShort(form.expiryDate)}</span>
                </p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">Nameservers</label>
            <textarea
              value={form.nameservers}
              onChange={e => setForm(f => ({ ...f, nameservers: e.target.value }))}
              placeholder={"ns1.noehost.com\nns2.noehost.com"}
              rows={4}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
            <p className="text-xs text-muted-foreground">One nameserver per line. Default: ns1.noehost.com, ns2.noehost.com</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">Module Server ID (20i/cPanel)</label>
            <Input value={form.moduleServerId} onChange={e => setForm(f => ({ ...f, moduleServerId: e.target.value }))}
              placeholder="Optional — server ID for API sync" className="font-mono text-sm" />
            <p className="text-xs text-muted-foreground">Link to a server for automatic nameserver sync via the Sync button</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-foreground/80">Auto Renew</label>
            <button type="button" onClick={() => setForm(f => ({ ...f, autoRenew: !f.autoRenew }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.autoRenew ? "bg-primary" : "bg-muted"}`}>
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.autoRenew ? "translate-x-6" : "translate-x-1"}`} />
            </button>
            <span className="text-sm text-muted-foreground">{form.autoRenew ? "Enabled" : "Disabled"}</span>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving ? "Saving..." : (isEdit ? "Save Changes" : "Add Domain")}
            </Button>
            <Button type="button" variant="outline" onClick={() => { setShowAddModal(false); setEditDomain(null); setForm(EMPTY_FORM); }}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );

  if (isLoading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      {showAddModal && <DomainForm onSubmit={handleAdd} title="Add Domain" />}
      {editDomain && <DomainForm onSubmit={handleEdit} title={`Edit: ${editDomain.name}${editDomain.tld}`} isEdit />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Domain Management</h2>
          <p className="text-muted-foreground mt-1">Manage client domains and registrations</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="bg-primary hover:bg-primary/90 h-10 rounded-xl whitespace-nowrap">
          <Plus size={16} className="mr-2" /> Add Domain
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 bg-card border-border" placeholder="Search domains or clients..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["all", ...STATUS_OPTIONS].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-lg border capitalize transition-all ${statusFilter === s ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Domain</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Client</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Registrar</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Nameservers</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Status</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Expiry</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Next Due</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Auto Renew</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Transfer Lock</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(domain => (
              <tr key={domain.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-6 py-4 text-sm font-semibold text-foreground">{domain.name}{domain.tld}</td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{domain.clientName}</td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{domain.registrar || "—"}</td>
                <td className="px-6 py-4">
                  {domain.nameservers && domain.nameservers.length > 0
                    ? <div className="space-y-0.5">{domain.nameservers.map((ns, i) => (
                        <p key={i} className="text-xs font-mono text-muted-foreground">{ns}</p>
                      ))}</div>
                    : <span className="text-xs text-muted-foreground/50">—</span>
                  }
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border capitalize ${statusColors[domain.status] || "bg-secondary border-border text-muted-foreground"}`}>
                    {domain.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">
                  {domain.expiryDate ? format(new Date(domain.expiryDate), "MMM d, yyyy") : "—"}
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">
                  {domain.nextDueDate ? format(new Date(domain.nextDueDate), "MMM d, yyyy") : "—"}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${domain.autoRenew ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-400"}`}>
                    {domain.autoRenew ? "Yes" : "No"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {(() => {
                    const effLock = lockResults[domain.id]?.lockStatus ?? domain.lockStatus ?? "locked";
                    const effOverride = lockResults[domain.id]?.lockOverrideByAdmin ?? domain.lockOverrideByAdmin ?? false;
                    const effIn60Day = domain.isIn60DayLock && !effOverride;
                    return (
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                          effLock === "unlocked"
                            ? "bg-green-500/10 text-green-400 border-green-500/20"
                            : effIn60Day
                              ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                              : "bg-red-500/10 text-red-400 border-red-500/20"
                        }`}>
                          {effLock === "unlocked"
                            ? <><ShieldCheck className="w-3 h-3" /> Unlocked</>
                            : effIn60Day
                              ? <><Lock className="w-3 h-3" /> 60-Day ({domain.daysRemainingInLock}d)</>
                              : <><Lock className="w-3 h-3" /> Locked</>
                          }
                        </span>
                        {effOverride && <span className="text-xs text-green-400 font-medium">Admin override</span>}
                      </div>
                    );
                  })()}
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-1.5 flex-wrap">
                    <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1" onClick={() => handleRenew(domain.id)}>
                      <RefreshCw className="w-3 h-3" /> Renew
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1" onClick={() => openEdit(domain)}>
                      <Pencil className="w-3 h-3" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1 text-blue-400 border-blue-400/30 hover:bg-blue-400/10"
                      disabled={syncingId === domain.id}
                      onClick={() => handleSyncModule(domain.id)}>
                      {syncingId === domain.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                      Sync
                    </Button>
                    <Button size="sm" variant="outline"
                      className={`h-7 px-2.5 text-xs gap-1 ${
                        (lockResults[domain.id]?.lockStatus ?? domain.lockStatus ?? "locked") === "unlocked"
                          ? "text-red-400 border-red-400/30 hover:bg-red-400/10"
                          : "text-green-400 border-green-400/30 hover:bg-green-400/10"
                      }`}
                      disabled={lockOverrideId === domain.id}
                      onClick={() => handleLockOverride(domain)}
                      title="Admin override: bypass 60-day rule"
                    >
                      {lockOverrideId === domain.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : (lockResults[domain.id]?.lockStatus ?? domain.lockStatus ?? "locked") === "unlocked"
                          ? <Lock className="w-3 h-3" />
                          : <ShieldCheck className="w-3 h-3" />
                      }
                      {(lockResults[domain.id]?.lockStatus ?? domain.lockStatus ?? "locked") === "unlocked" ? "Lock" : "Unlock"}
                    </Button>
                    <div className="relative">
                      <Button
                        size="sm" variant="outline"
                        className="h-7 px-2.5 text-xs gap-1 text-violet-400 border-violet-500/30 hover:bg-violet-500/10"
                        disabled={lifecycleOverrideId === domain.id}
                        onClick={() => setLifecycleDropdown(prev => prev === domain.id ? null : domain.id)}
                        title="Set lifecycle status override"
                      >
                        {lifecycleOverrideId === domain.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <AlertTriangle className="w-3 h-3" />
                        }
                        Lifecycle <ChevronDown className="w-3 h-3" />
                      </Button>
                      {lifecycleDropdown === domain.id && (
                        <div className="absolute right-0 top-8 z-50 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[160px]">
                          {LIFECYCLE_OVERRIDE_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-secondary transition-colors ${opt.color}`}
                              onClick={() => handleLifecycleOverride(domain.id, opt.value)}
                            >
                              {opt.label}
                            </button>
                          ))}
                          <button
                            className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:bg-secondary transition-colors"
                            onClick={() => setLifecycleDropdown(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                    <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => handleDelete(domain.id, domain.name + domain.tld)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="px-6 py-12 text-center text-muted-foreground">No domains found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
