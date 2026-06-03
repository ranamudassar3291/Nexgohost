import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Plus, Pencil, Trash2, Save, X, HardDrive, Users,
  Package, Loader2, CheckCircle, AlertCircle,
  Star, ToggleLeft, ToggleRight, Globe, RefreshCw, BarChart3,
  ChevronDown, Server, Zap, Check, AlertTriangle, Wifi, WifiOff,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const API = "/api";

function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token") || localStorage.getItem("noehost_token") || "";
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts?.headers ?? {}),
    },
  }).then(async (r) => {
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Request failed");
    return d;
  });
}

interface EmailPackage {
  id: string; name: string; max_storage_gb: number; max_mailboxes: number;
  price: number; yearly_price: number | null; remote_package_id: string | null; is_popular: boolean;
}

interface EmailOrder {
  id: string; domain_name: string; status: string; package_name: string;
  client_name: string; client_email: string; mailbox_count: number;
  created_at: string; billing_cycle: string; amount_paid: number; remote_hosting_id: string | null;
}

interface EmailServer {
  id: string; name: string; hostname: string; status: string;
  api_connected: boolean; server_ip: string | null; connection_status_detail: string | null;
}

interface TwentyIPkg {
  id: string; name: string;
  storage_gb?: number | null; max_mailboxes?: number | null;
}

const EMPTY_FORM: Partial<EmailPackage> = {
  name: "", max_storage_gb: 10, max_mailboxes: 5, price: 0, yearly_price: null, remote_package_id: "", is_popular: false,
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  pending_payment: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  pending_dns: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  suspended: "bg-red-500/10 text-red-400 border-red-500/20",
};

// ── Activation Modal ──────────────────────────────────────────────────────────
function ActivationModal({
  order,
  onClose,
  onDone,
}: {
  order: EmailOrder;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [servers, setServers] = useState<EmailServer[]>([]);
  const [serversLoading, setServersLoading] = useState(true);
  const [selectedServer, setSelectedServer] = useState<string>("");

  const [packages, setPackages] = useState<TwentyIPkg[]>([]);
  const [pkgsLoading, setPkgsLoading] = useState(false);
  const [pkgsError, setPkgsError] = useState<string | null>(null);
  const [selectedPkg, setSelectedPkg] = useState<string>("");

  const [activating, setActivating] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; provisioned?: boolean } | null>(null);

  // Load 20i servers on mount
  useEffect(() => {
    apiFetch(`${API}/admin/email-servers`)
      .then(setServers)
      .catch(() => setServers([]))
      .finally(() => setServersLoading(false));
  }, []);

  // Fetch packages when server selected
  async function fetchPackages(serverId: string) {
    if (!serverId) return;
    setPkgsLoading(true);
    setPkgsError(null);
    setPackages([]);
    setSelectedPkg("");
    try {
      const data = await apiFetch(`${API}/admin/email-servers/${serverId}/packages`);
      // twentyiGetPackages returns array of { id, name, storage_gb, max_mailboxes }
      setPackages(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setPkgsError(e.message);
    } finally {
      setPkgsLoading(false);
    }
  }

  function handleServerChange(id: string) {
    setSelectedServer(id);
    fetchPackages(id);
  }

  async function handleActivate() {
    if (!selectedServer) {
      toast({ title: "Please select a server", variant: "destructive" });
      return;
    }
    setActivating(true);
    try {
      const res = await apiFetch(`${API}/admin/email-orders/${order.id}/provision`, {
        method: "POST",
        body: JSON.stringify({
          server_id: selectedServer,
          package_id: selectedPkg || undefined,
        }),
      });
      setResult({ ok: true, message: res.message, provisioned: res.provisioned });
      onDone();
    } catch (e: any) {
      setResult({ ok: false, message: e.message });
    } finally {
      setActivating(false);
    }
  }

  const selServer = servers.find(s => s.id === selectedServer);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && !activating && onClose()}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">

        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-base">Activate Email Order</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{order.domain_name} · {order.package_name}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={activating} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Result state */}
        {result ? (
          <div className="p-6 text-center">
            {result.ok ? (
              <>
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-7 h-7 text-emerald-400" />
                </div>
                <div className="font-bold text-foreground mb-2">{result.provisioned ? "Order Provisioned!" : "Order Activated"}</div>
                <p className="text-sm text-muted-foreground mb-5">{result.message}</p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-7 h-7 text-red-400" />
                </div>
                <div className="font-bold text-red-400 mb-2">Activation Failed</div>
                <p className="text-sm text-muted-foreground mb-5 font-mono text-xs bg-muted rounded p-2">{result.message}</p>
              </>
            )}
            <Button onClick={onClose} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
              <Check className="w-4 h-4" /> Close
            </Button>
          </div>
        ) : (
          <div className="p-6 space-y-5">

            {/* Step 1 — Server */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xs font-bold">1</div>
                <span className="text-sm font-semibold text-foreground">Select Email Server</span>
              </div>

              {serversLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading servers…
                </div>
              ) : servers.length === 0 ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-amber-400 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  No 20i servers found. Add a server in Admin → Servers first.
                </div>
              ) : (
                <div className="space-y-2">
                  {servers.map(srv => (
                    <button key={srv.id}
                      onClick={() => handleServerChange(srv.id)}
                      className={`w-full text-left p-3.5 rounded-xl border-2 transition-all flex items-center gap-3 ${selectedServer === srv.id ? "border-indigo-500 bg-indigo-500/5" : "border-border hover:border-indigo-500/40"}`}>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${srv.api_connected ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                        {srv.api_connected ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground text-sm">{srv.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{srv.hostname} {srv.server_ip ? `· ${srv.server_ip}` : ""}</div>
                      </div>
                      <div className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${srv.api_connected ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                        {srv.api_connected ? "Connected" : "Offline"}
                      </div>
                      {selectedServer === srv.id && <Check className="w-4 h-4 text-indigo-400 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Step 2 — Package (shows after server selected) */}
            {selectedServer && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xs font-bold">2</div>
                  <span className="text-sm font-semibold text-foreground">Select 20i Package</span>
                  {pkgsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                  {!pkgsLoading && packages.length > 0 && (
                    <button onClick={() => fetchPackages(selectedServer)} className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Refresh
                    </button>
                  )}
                </div>

                {pkgsLoading ? (
                  <div className="text-sm text-muted-foreground py-2">Fetching packages from {selServer?.name}…</div>
                ) : pkgsError ? (
                  <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-red-400 text-sm">
                    <div className="font-medium mb-1 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" /> Failed to fetch packages
                    </div>
                    <div className="text-xs font-mono">{pkgsError}</div>
                    <button onClick={() => fetchPackages(selectedServer)} className="mt-2 text-xs underline hover:no-underline">Retry</button>
                  </div>
                ) : packages.length === 0 ? (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border text-muted-foreground text-sm">
                    No packages found on this server. You can still activate manually without a 20i package.
                  </div>
                ) : (
                  <>
                    <select
                      className="w-full text-sm bg-background border border-border rounded-xl px-4 py-3 text-foreground outline-none focus:border-indigo-500 transition-colors"
                      value={selectedPkg}
                      onChange={e => setSelectedPkg(e.target.value)}>
                      <option value="">— Activate without 20i package (manual) —</option>
                      {packages.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.storage_gb ? ` · ${p.storage_gb} GB` : ""}
                          {p.max_mailboxes ? ` · ${p.max_mailboxes} mailboxes` : ""}
                        </option>
                      ))}
                    </select>
                    {selectedPkg && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-indigo-400">
                        <Package className="w-3.5 h-3.5" />
                        {packages.find(p => p.id === selectedPkg)?.name} selected
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Summary */}
            {selectedServer && (
              <div className="p-3.5 rounded-xl bg-muted/50 border border-border">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Activation Summary</div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Domain</span>
                    <span className="font-medium text-foreground">{order.domain_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Server</span>
                    <span className="font-medium text-foreground">{selServer?.name ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">20i Package</span>
                    <span className="font-medium text-foreground">
                      {selectedPkg ? packages.find(p => p.id === selectedPkg)?.name ?? selectedPkg : "Manual activation"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={onClose} disabled={activating} className="flex-1">Cancel</Button>
              <Button
                onClick={handleActivate}
                disabled={!selectedServer || activating}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 gap-2">
                {activating
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Activating…</>
                  : <><Zap className="w-4 h-4" /> Activate Order</>}
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Main NoeMail Component ────────────────────────────────────────────────────
export default function NoeMail() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"packages" | "orders">("packages");
  const [packages, setPackages] = useState<EmailPackage[]>([]);
  const [orders, setOrders] = useState<EmailOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<EmailPackage>>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activatingOrder, setActivatingOrder] = useState<EmailOrder | null>(null);
  const [templates, setTemplates] = useState<{ id: string; name: string; storage_gb: number | null; max_mailboxes: number | null }[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const loadPackages = () => apiFetch(`${API}/admin/email-packages`).then(setPackages).catch(() => {});
  const loadOrders = () => apiFetch(`${API}/admin/email-orders`).then(setOrders).catch(() => {});

  useEffect(() => {
    setLoading(true);
    Promise.all([loadPackages(), loadOrders()]).finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
    setTemplatesLoading(true);
    apiFetch(`${API}/admin/email-packages/20i-templates`)
      .then(d => setTemplates(d.templates ?? []))
      .catch(() => setTemplates([]))
      .finally(() => setTemplatesLoading(false));
  }

  function openEdit(pkg: EmailPackage) {
    setForm({ ...pkg });
    setEditingId(pkg.id);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name || !form.price) {
      toast({ title: "Required fields missing", description: "Name and price are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await apiFetch(`${API}/admin/email-packages/${editingId}`, { method: "PUT", body: JSON.stringify(form) });
        toast({ title: "Package updated" });
      } else {
        await apiFetch(`${API}/admin/email-packages`, { method: "POST", body: JSON.stringify(form) });
        toast({ title: "Package created" });
      }
      setShowForm(false);
      await loadPackages();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiFetch(`${API}/admin/email-packages/${id}`, { method: "DELETE" });
      toast({ title: "Package deleted" });
      setDeleteId(null);
      await loadPackages();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function handleStatusChange(orderId: string, status: string) {
    try {
      await apiFetch(`${API}/admin/email-orders/${orderId}/status`, { method: "PUT", body: JSON.stringify({ status }) });
      toast({ title: "Status updated" });
      await loadOrders();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  const stats = [
    { label: "Total Packages", value: packages.length, icon: Package, color: "text-indigo-400", bg: "bg-indigo-500/10" },
    { label: "Active Orders", value: orders.filter(o => o.status === "active").length, icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Awaiting Payment", value: orders.filter(o => o.status === "pending_payment").length, icon: Globe, color: "text-violet-400", bg: "bg-violet-500/10" },
    { label: "Pending DNS", value: orders.filter(o => o.status === "pending_dns").length, icon: Globe, color: "text-amber-400", bg: "bg-amber-500/10" },
  ];

  const filteredOrders = orders.filter(o => {
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    const matchSearch = !search || o.domain_name.includes(search) || o.client_name?.toLowerCase().includes(search.toLowerCase()) || o.client_email?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <Mail className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">NoeMail</h1>
            <p className="text-sm text-muted-foreground">Business Email Hosting Management</p>
          </div>
        </div>
        {tab === "packages" && (
          <Button onClick={openCreate} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> New Package
          </Button>
        )}
        {tab === "orders" && (
          <Button variant="outline" onClick={loadOrders} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-lg w-fit">
        {(["packages", "orders"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all capitalize ${tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "packages" ? `Email Packages (${packages.length})` : `Client Orders (${orders.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* ── Packages Tab ── */}
          {tab === "packages" && (
            <div className="space-y-3">
              {packages.length === 0 && (
                <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No email packages yet</p>
                  <p className="text-sm mt-1">Click "New Package" to create your first NoeMail tier.</p>
                </div>
              )}
              {packages.map(pkg => (
                <motion.div key={pkg.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Name</div>
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        {pkg.name}
                        {pkg.is_popular && (
                          <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                            <Star className="w-2.5 h-2.5" /> Popular
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Storage</div>
                      <div className="text-sm font-medium text-foreground flex items-center gap-1">
                        <HardDrive className="w-3.5 h-3.5 text-muted-foreground" /> {pkg.max_storage_gb} GB
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Mailboxes</div>
                      <div className="text-sm font-medium text-foreground flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-muted-foreground" /> {pkg.max_mailboxes}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Monthly</div>
                      <div className="text-sm font-medium text-foreground">PKR {Number(pkg.price).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Yearly</div>
                      <div className="text-sm font-medium text-foreground">
                        {pkg.yearly_price ? `PKR ${Number(pkg.yearly_price).toLocaleString()}` : <span className="text-muted-foreground">—</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(pkg)} className="gap-1.5">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDeleteId(pkg.id)}
                      className="gap-1.5 text-red-400 border-red-500/20 hover:bg-red-500/5">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* ── Orders Tab ── */}
          {tab === "orders" && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex gap-3 flex-wrap">
                <input
                  className="flex-1 min-w-48 px-4 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:border-indigo-500"
                  placeholder="Search domain, client name or email…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <select
                  className="px-4 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:border-indigo-500"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}>
                  <option value="all">All Statuses</option>
                  <option value="pending_payment">Pending Payment</option>
                  <option value="pending_dns">Pending DNS</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/30">
                    <tr className="text-left">
                      {["Domain", "Client", "Package", "Billing", "Status", "Provision", "Change Status"].map(h => (
                        <th key={h} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                        {search || statusFilter !== "all" ? "No orders match your filters" : "No email orders yet"}
                      </td></tr>
                    )}
                    {filteredOrders.map(order => {
                      const isFullyProvisioned = order.status === "active" && !!order.remote_hosting_id;
                      return (
                        <motion.tr key={order.id}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">{order.domain_name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {new Date(order.created_at).toLocaleDateString("en-PK")}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-foreground font-medium">{order.client_name}</div>
                            <div className="text-xs text-muted-foreground">{order.client_email}</div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-sm">{order.package_name}</td>
                          <td className="px-4 py-3 capitalize text-muted-foreground text-sm">{order.billing_cycle}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <span className={`text-xs px-2 py-1 rounded-full border font-medium w-fit ${STATUS_COLORS[order.status] ?? "bg-muted text-muted-foreground border-border"}`}>
                                {order.status.replace(/_/g, " ")}
                              </span>
                              {order.remote_hosting_id && (
                                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                                  <Server className="w-2.5 h-2.5" /> {order.remote_hosting_id.slice(0, 14)}…
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {isFullyProvisioned ? (
                              <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
                                <CheckCircle className="w-3.5 h-3.5" /> Provisioned
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => setActivatingOrder(order)}
                                className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-7 px-3">
                                <Zap className="w-3 h-3" /> Activate
                              </Button>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              className="text-xs bg-muted border border-border rounded px-2 py-1 text-foreground outline-none"
                              value={order.status}
                              onChange={e => handleStatusChange(order.id, e.target.value)}>
                              <option value="pending_payment">Pending Payment</option>
                              <option value="pending_dns">Pending DNS</option>
                              <option value="active">Active</option>
                              <option value="suspended">Suspended</option>
                            </select>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Create/Edit Package Modal ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Package className="w-5 h-5 text-indigo-400" />
                  {editingId ? "Edit Package" : "New Email Package"}
                </h2>
                <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Package Name *</label>
                  <Input placeholder="e.g., Business Starter" value={form.name ?? ""}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Storage (GB)</label>
                    <Input type="number" min={1} value={form.max_storage_gb ?? 10}
                      onChange={e => setForm(f => ({ ...f, max_storage_gb: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Max Mailboxes</label>
                    <Input type="number" min={1} value={form.max_mailboxes ?? 5}
                      onChange={e => setForm(f => ({ ...f, max_mailboxes: Number(e.target.value) }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Monthly Price (PKR) *</label>
                    <Input type="number" min={0} value={form.price ?? 0}
                      onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Yearly Price (PKR)</label>
                    <Input type="number" min={0} placeholder="Optional"
                      value={form.yearly_price ?? ""}
                      onChange={e => setForm(f => ({ ...f, yearly_price: e.target.value ? Number(e.target.value) : null }))} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5" /> 20i Package Template (optional)
                  </label>
                  {templatesLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading templates…
                    </div>
                  ) : templates.length > 0 ? (
                    <select
                      className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2.5 text-foreground outline-none focus:border-indigo-500"
                      value={form.remote_package_id ?? ""}
                      onChange={e => {
                        const t = templates.find(t => t.id === e.target.value);
                        setForm(f => ({
                          ...f,
                          remote_package_id: e.target.value,
                          ...(t?.storage_gb ? { max_storage_gb: t.storage_gb } : {}),
                          ...(t?.max_mailboxes ? { max_mailboxes: t.max_mailboxes } : {}),
                        }));
                      }}>
                      <option value="">— No template (manual) —</option>
                      {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  ) : (
                    <Input placeholder="e.g. pkg_abc123 (optional)"
                      value={form.remote_package_id ?? ""}
                      onChange={e => setForm(f => ({ ...f, remote_package_id: e.target.value }))} />
                  )}
                </div>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, is_popular: !f.is_popular }))}
                    className={`flex-shrink-0 transition-colors ${form.is_popular ? "text-indigo-400" : "text-muted-foreground"}`}>
                    {form.is_popular ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                  </button>
                  <div>
                    <div className="text-sm font-medium text-foreground">Mark as Most Popular</div>
                    <div className="text-xs text-muted-foreground">Highlights this tier on the marketing page</div>
                  </div>
                </label>
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancel</Button>
                <Button onClick={handleSave} disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-700 gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingId ? "Save Changes" : "Create Package"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Activation Modal ── */}
      <AnimatePresence>
        {activatingOrder && (
          <ActivationModal
            order={activatingOrder}
            onClose={() => setActivatingOrder(null)}
            onDone={() => { setActivatingOrder(null); loadOrders(); }}
          />
        )}
      </AnimatePresence>

      {/* ── Delete Confirm ── */}
      <AnimatePresence>
        {deleteId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <h3 className="font-bold text-foreground mb-2">Delete Package?</h3>
              <p className="text-sm text-muted-foreground mb-5">This cannot be undone. Existing orders will not be affected.</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setDeleteId(null)} className="flex-1">Cancel</Button>
                <Button onClick={() => handleDelete(deleteId!)} className="flex-1 bg-red-600 hover:bg-red-700 text-white">Delete</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
