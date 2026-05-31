import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Plus, Pencil, Trash2, Save, X, HardDrive, Users,
  DollarSign, Package, Loader2, CheckCircle, AlertCircle,
  Star, ToggleLeft, ToggleRight, Globe, RefreshCw, Eye, BarChart3,
  ChevronDown, Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const API = "/api";

function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
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
  id: string;
  name: string;
  max_storage_gb: number;
  max_mailboxes: number;
  price: number;
  yearly_price: number | null;
  remote_package_id: string | null;
  is_popular: boolean;
}

interface EmailOrder {
  id: string;
  domain_name: string;
  status: string;
  package_name: string;
  client_name: string;
  client_email: string;
  mailbox_count: number;
  created_at: string;
  billing_cycle: string;
  amount_paid: number;
}

const EMPTY_FORM: Partial<EmailPackage> = {
  name: "",
  max_storage_gb: 10,
  max_mailboxes: 5,
  price: 0,
  yearly_price: null,
  remote_package_id: "",
  is_popular: false,
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  pending_dns: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  suspended: "bg-red-500/10 text-red-400 border-red-500/20",
};

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
  const [templates, setTemplates] = useState<{ id: string; name: string; storage_gb: number | null; max_mailboxes: number | null }[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const loadPackages = () =>
    apiFetch(`${API}/admin/email-packages`).then(setPackages).catch(() => {});
  const loadOrders = () =>
    apiFetch(`${API}/admin/email-orders`).then(setOrders).catch(() => {});

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
    { label: "Total Packages", value: packages.length, icon: Package, color: "text-indigo-400" },
    { label: "Active Orders", value: orders.filter(o => o.status === "active").length, icon: CheckCircle, color: "text-emerald-400" },
    { label: "Pending DNS", value: orders.filter(o => o.status === "pending_dns").length, icon: Globe, color: "text-amber-400" },
    { label: "Total Mailboxes", value: orders.reduce((s, o) => s + Number(o.mailbox_count ?? 0), 0), icon: Mail, color: "text-violet-400" },
  ];

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
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <s.icon className={`w-8 h-8 ${s.color}`} />
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
            {t === "packages" ? "Email Packages" : "Client Orders"}
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
                      <div className="text-xs text-muted-foreground mb-1">Monthly Price</div>
                      <div className="text-sm font-medium text-foreground">PKR {Number(pkg.price).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Yearly Price</div>
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
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-left">
                    {["Domain", "Client", "Package", "Billing", "Mailboxes", "Status", "Actions"].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No email orders yet</td></tr>
                  )}
                  {orders.map(order => (
                    <tr key={order.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{order.domain_name}</td>
                      <td className="px-4 py-3">
                        <div className="text-foreground">{order.client_name}</div>
                        <div className="text-xs text-muted-foreground">{order.client_email}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{order.package_name}</td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{order.billing_cycle}</td>
                      <td className="px-4 py-3 text-center">{order.mailbox_count}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full border font-medium ${STATUS_COLORS[order.status] ?? "bg-muted text-muted-foreground border-border"}`}>
                          {order.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="text-xs bg-muted border border-border rounded px-2 py-1 text-foreground"
                          value={order.status}
                          onChange={e => handleStatusChange(order.id, e.target.value)}>
                          <option value="pending_dns">Pending DNS</option>
                          <option value="active">Active</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Create/Edit Form Modal ── */}
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
                    <Server className="w-3.5 h-3.5" /> Link to Provider Package Template
                  </label>
                  {templatesLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading templates from provider…
                    </div>
                  ) : templates.length > 0 ? (
                    <div className="space-y-2">
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
                        <option value="">— None (manual configuration) —</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground">Selecting a template auto-fills storage &amp; mailbox limits. Internal only — not shown to clients.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Input placeholder="e.g. pkg_abc123 (optional)"
                        value={form.remote_package_id ?? ""}
                        onChange={e => setForm(f => ({ ...f, remote_package_id: e.target.value }))} />
                      <p className="text-xs text-muted-foreground">No provider templates found — enter ID manually if needed. Internal reference only.</p>
                    </div>
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

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <h3 className="font-bold text-foreground mb-2">Delete Package?</h3>
              <p className="text-sm text-muted-foreground mb-5">This cannot be undone. Existing orders using this package will not be affected.</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setDeleteId(null)} className="flex-1">Cancel</Button>
                <Button onClick={() => handleDelete(deleteId!)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white">Delete</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
