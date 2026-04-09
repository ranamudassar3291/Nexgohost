import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  CheckCircle, XCircle, Search, Plus, FileText,
  ChevronDown, Loader2, AlertTriangle, StopCircle,
  Terminal, Mail, Zap, Server, Globe, RotateCcw, Trash2, Edit2, X, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useCurrency } from "@/context/CurrencyProvider";

interface Order {
  id: string; clientId: string; clientName: string;
  type: string; itemId: string | null; itemName: string;
  domain: string | null; amount: number;
  billingCycle: string; dueDate: string | null;
  moduleType: string; modulePlanId: string | null; modulePlanName: string | null;
  moduleServerId: string | null; moduleServerGroupId: string | null;
  paymentStatus: string; invoiceId: string | null;
  status: string; notes: string | null; createdAt: string; updatedAt: string;
  serviceId: string | null; serviceStatus: string | null;
  cpanelUrl: string | null; webmailUrl: string | null;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

const statusColors: Record<string, string> = {
  pending:    "bg-amber-50 text-amber-700 border-amber-200",
  approved:   "bg-green-500/10 text-green-400 border-green-500/20",
  completed:  "bg-blue-500/10 text-blue-400 border-blue-500/20",
  cancelled:  "bg-red-50 text-red-600 border-red-200",
  suspended:  "bg-amber-50 text-amber-700 border-amber-200",
  fraud:      "bg-purple-50 text-purple-700 border-purple-200",
  terminated: "bg-red-800/10 text-red-600 border-red-800/20",
};

const paymentColors: Record<string, string> = {
  paid:   "bg-green-500/10 text-green-400 border-green-500/20",
  unpaid: "bg-amber-50 text-amber-700 border-amber-200",
};

const MODULE_COLORS: Record<string, string> = {
  cpanel:      "bg-amber-50 text-amber-700 border-amber-200",
  "20i":       "bg-blue-500/10 text-blue-400 border-blue-500/20",
  directadmin: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  plesk:       "bg-purple-50 text-purple-700 border-purple-200",
  none:        "bg-secondary/50 text-muted-foreground border-border",
};

const filterTabs = ["all", "pending", "approved", "suspended", "cancelled", "fraud", "terminated"];

interface ServerOption {
  id: string;
  name: string;
  hostname: string;
  type: string;
  isDefault: boolean;
  groupId: string | null;
}

interface ActivateResult {
  orderId: string;
  service: {
    id?: string;
    cpanelUrl: string | null;
    webmailUrl: string | null;
    username: string | null;
    password: string | null;
    domain: string | null;
    serverName: string | null;
    serverHostname: string | null;
  } | null;
  whmError: string | null;
}

interface PackageType {
  id: string;
  label: string;
  platform: string;
}

interface PreActivateModal {
  orderId: string;
  domain: string;
  clientName: string;
  itemName: string;
  moduleType: string;
  modulePlanName: string | null;
  /** From the plan's moduleServerGroupId — used to filter server dropdown */
  moduleServerGroupId: string | null;
  username: string;
  password: string;
  /** Admin-selected server ID (empty = auto-select) */
  serverId: string;
  /** 20i package type ID to use for provisioning */
  packageTypeId: string;
  /** Pre-existing modulePlanId from the order (already configured) */
  existingModulePlanId: string | null;
}

function generatePassword() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  return Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function generateUsername(domain: string) {
  return (domain.split(".")[0] || "user").replace(/[^a-z0-9]/gi, "").toLowerCase().substring(0, 8) || "user";
}

interface EditOrderModal {
  id: string;
  itemName: string;
  status: string;
  dueDate: string;
  billingCycle: string;
  paymentStatus: string;
  notes: string;
}

interface DomainActivateModal {
  orderId: string;
  domain: string;
  clientName: string;
}

interface ApproveModal {
  orderId: string;
  domain: string;
  clientName: string;
  itemName: string;
  moduleType: string;
  moduleServerGroupId: string | null;
  /** Admin-selected server ID (empty = auto-select) */
  serverId: string;
}

interface Registrar {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  isDefault: boolean;
}

export default function AdminOrders() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { formatPrice } = useCurrency();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [paged, setPaged] = useState<{ data: Order[]; total: number; page: number; totalPages: number } | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [activateResult, setActivateResult] = useState<ActivateResult | null>(null);
  const [preActivate, setPreActivate] = useState<PreActivateModal | null>(null);
  const [ssoLoadingId, setSsoLoadingId] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<EditOrderModal | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [allServers, setAllServers] = useState<ServerOption[]>([]);
  const [domainActivateModal, setDomainActivateModal] = useState<DomainActivateModal | null>(null);
  const [selectedRegistrarId, setSelectedRegistrarId] = useState<string>("");
  const [domainActivating, setDomainActivating] = useState(false);
  const [approveModal, setApproveModal] = useState<ApproveModal | null>(null);
  const [approveLoading, setApproveLoading] = useState(false);
  const [twentyiPackageTypes, setTwentyiPackageTypes] = useState<PackageType[]>([]);
  const [loadingPackageTypes, setLoadingPackageTypes] = useState(false);

  const { data: registrars = [] } = useQuery<Registrar[]>({
    queryKey: ["admin-registrars-for-orders"],
    queryFn: () => apiFetch("/api/admin/domain-registrars"),
  });

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filter !== "all") params.set("status", filter);
      const data = await apiFetch(`/api/admin/orders?${params}`);
      setPaged(data);
    } catch (err: any) {
      toast({ title: "Failed to load orders", description: err.message, variant: "destructive" });
    } finally { setIsLoading(false); }
  }, [page, debouncedSearch, filter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    apiFetch("/api/admin/servers").then(setAllServers).catch(() => {});
  }, []);

  const orders = paged?.data ?? [];
  const filtered = orders;

  const handleSsoLogin = async (serviceId: string, type: "cpanel" | "webmail") => {
    const key = `${serviceId}-${type}`;
    setSsoLoadingId(key);
    try {
      const endpoint = type === "cpanel"
        ? `/api/admin/hosting/${serviceId}/cpanel-login`
        : `/api/admin/hosting/${serviceId}/webmail-login`;
      const result = await apiFetch(endpoint, { method: "POST" });
      if (result.url) window.open(result.url, "_blank");
    } catch (err: any) {
      toast({ title: `${type === "cpanel" ? "cPanel" : "Webmail"} login failed`, description: err.message, variant: "destructive" });
    } finally {
      setSsoLoadingId(null);
    }
  };

  const openEditOrder = (order: Order) => {
    setOpenMenuId(null);
    setEditModal({
      id: order.id,
      itemName: order.itemName,
      status: order.status,
      dueDate: order.dueDate ? order.dueDate.split("T")[0] : "",
      billingCycle: order.billingCycle,
      paymentStatus: order.paymentStatus,
      notes: order.notes || "",
    });
  };

  const handleEditSave = async () => {
    if (!editModal) return;
    setEditSaving(true);
    try {
      await apiFetch(`/api/admin/orders/${editModal.id}`, {
        method: "PUT",
        body: JSON.stringify({
          status: editModal.status,
          dueDate: editModal.dueDate || null,
          billingCycle: editModal.billingCycle,
          paymentStatus: editModal.paymentStatus,
          notes: editModal.notes,
        }),
      });
      toast({ title: "Order updated" });
      setEditModal(null);
      fetchOrders();
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (err: any) {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    } finally { setEditSaving(false); }
  };

  const handleDeleteOrder = async (id: string) => {
    setOpenMenuId(null);
    if (!confirm("Delete this order permanently? This cannot be undone.")) return;
    setLoadingId(id);
    try {
      await apiFetch(`/api/admin/orders/${id}`, { method: "DELETE" });
      toast({ title: "Order deleted" });
      fetchOrders();
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (err: any) {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    } finally { setLoadingId(null); }
  };

  const doAction = async (id: string, action: string) => {
    setLoadingId(id);
    setOpenMenuId(null);
    try {
      const data = await apiFetch(`/api/admin/orders/${id}/${action}`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      fetchOrders();
      const msgs: Record<string, string> = {
        approve: "Order approved" + (data.invoice ? ` & invoice ${data.invoice.invoiceNumber} generated` : ""),
        cancel: "Order cancelled",
        suspend: "Order suspended",
        terminate: "Order terminated",
        fraud: "Order marked as fraud",
      };
      toast({ title: msgs[action] || `Order ${action}d` });
    } catch (err: any) {
      toast({ title: `Failed to ${action} order`, description: err.message, variant: "destructive" });
    } finally { setLoadingId(null); }
  };

  // Hosting order: open approve modal with server group selection
  const openApproveModal = (order: Order) => {
    setOpenMenuId(null);
    setApproveModal({
      orderId: order.id,
      domain: order.domain || "",
      clientName: order.clientName,
      itemName: order.itemName,
      moduleType: order.moduleType || "none",
      moduleServerGroupId: order.moduleServerGroupId ?? null,
      serverId: "",
    });
  };

  const submitApprove = async () => {
    if (!approveModal) return;
    setApproveLoading(true);
    try {
      const body: Record<string, string> = {};
      if (approveModal.serverId) body.serverId = approveModal.serverId;
      const data = await apiFetch(`/api/admin/orders/${approveModal.orderId}/approve`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      fetchOrders();
      setApproveModal(null);
      toast({ title: "Order approved" + (data.invoice ? ` & invoice ${data.invoice.invoiceNumber} generated` : "") });
    } catch (err: any) {
      toast({ title: "Failed to approve order", description: err.message, variant: "destructive" });
    } finally { setApproveLoading(false); }
  };

  // Domain order: open registrar selection modal
  const openDomainActivateModal = (order: Order) => {
    const defaultReg = registrars.find(r => r.isDefault && r.isActive) ?? registrars.find(r => r.isActive);
    setSelectedRegistrarId(defaultReg?.id ?? "none");
    setDomainActivateModal({ orderId: order.id, domain: order.domain || order.itemName, clientName: order.clientName });
    setOpenMenuId(null);
  };

  const doActivateDomainWithRegistrar = async () => {
    if (!domainActivateModal) return;
    setDomainActivating(true);
    try {
      const data = await apiFetch(`/api/admin/orders/${domainActivateModal.orderId}/activate-domain-registrar`, {
        method: "POST",
        body: JSON.stringify({ registrarId: selectedRegistrarId === "none" ? null : selectedRegistrarId }),
      });
      toast({ title: "Domain Activated!", description: data.message });
      setDomainActivateModal(null);
      fetchOrders();
    } catch (err: any) {
      toast({ title: "Activation failed", description: err.message, variant: "destructive" });
    } finally { setDomainActivating(false); }
  };

  // Step 1: open pre-activation modal with auto-generated credentials
  const openActivateModal = (order: Order) => {
    setOpenMenuId(null);
    const domain = order.domain || "";
    setPreActivate({
      orderId: order.id,
      domain,
      clientName: order.clientName,
      itemName: order.itemName,
      moduleType: order.moduleType || "none",
      modulePlanName: order.modulePlanName || null,
      moduleServerGroupId: order.moduleServerGroupId ?? null,
      username: generateUsername(domain),
      password: generatePassword(),
      serverId: "",
      packageTypeId: order.modulePlanId || "",
      existingModulePlanId: order.modulePlanId || null,
    });

    // For 20i orders, fetch available package types from the configured server
    if (order.moduleType === "20i") {
      setTwentyiPackageTypes([]);
      const serverId = order.moduleServerId;
      if (serverId) {
        setLoadingPackageTypes(true);
        apiFetch(`/api/admin/servers/${serverId}/plans`)
          .then((data: any) => {
            const raw: any[] = Array.isArray(data.plans) ? data.plans : [];
            const plans: PackageType[] = raw.map(p => ({
              id: String(p.id ?? ""),
              label: String(p.label ?? p.name ?? p.id ?? "Unknown"),
              platform: String(p.platform ?? "20i"),
            }));
            setTwentyiPackageTypes(plans);
            // Auto-select first type if order has no modulePlanId
            if (!order.modulePlanId && plans.length > 0) {
              setPreActivate(p => p ? { ...p, packageTypeId: plans[0].id } : p);
            }
          })
          .catch(() => {})
          .finally(() => setLoadingPackageTypes(false));
      } else {
        // No specific server — fetch from first 20i server available
        const first20iServer = allServers.find(s => s.type === "20i");
        if (first20iServer) {
          setLoadingPackageTypes(true);
          apiFetch(`/api/admin/servers/${first20iServer.id}/plans`)
            .then((data: any) => {
              const raw: any[] = Array.isArray(data.plans) ? data.plans : [];
              const plans: PackageType[] = raw.map(p => ({
                id: String(p.id ?? ""),
                label: String(p.label ?? p.name ?? p.id ?? "Unknown"),
                platform: String(p.platform ?? "20i"),
              }));
              setTwentyiPackageTypes(plans);
              if (!order.modulePlanId && plans.length > 0) {
                setPreActivate(p => p ? { ...p, packageTypeId: plans[0].id } : p);
              }
            })
            .catch(() => {})
            .finally(() => setLoadingPackageTypes(false));
        }
      }
    }
  };

  // Step 2: submit activation with credentials
  const submitActivate = async () => {
    if (!preActivate) return;
    setLoadingId(preActivate.orderId);
    try {
      const body: Record<string, string> = {
        username: preActivate.username,
        password: preActivate.password,
      };
      if (preActivate.serverId) body.serverId = preActivate.serverId;
      // Pass the selected 20i package type ID — overrides both order and plan defaults
      if (preActivate.packageTypeId) body.modulePlanId = preActivate.packageTypeId;

      const data = await apiFetch(`/api/admin/orders/${preActivate.orderId}/activate`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      fetchOrders();
      setPreActivate(null);
      setActivateResult({
        orderId: preActivate.orderId,
        service: data.service || null,
        whmError: null,
      });
      toast({ title: "Service Activated!", description: `Account provisioned for ${data.service?.domain || "the domain"}` });
    } catch (err: any) {
      const msg: string = err.message ?? "";
      toast({ title: "Activation failed", description: msg, variant: "destructive" });
    } finally { setLoadingId(null); }
  };

  const generateInvoice = async (id: string) => {
    setLoadingId(id);
    setOpenMenuId(null);
    try {
      const data = await apiFetch(`/api/admin/orders/${id}/generate-invoice`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      fetchOrders();
      if (data.invoiceNumber) {
        toast({ title: "Invoice generated", description: `Invoice ${data.invoiceNumber} created` });
      } else {
        toast({ title: data.message || "Invoice already exists" });
      }
    } catch (err: any) {
      toast({ title: "Failed to generate invoice", description: err.message, variant: "destructive" });
    } finally { setLoadingId(null); }
  };

  return (
    <div className="space-y-6" onClick={() => setOpenMenuId(null)}>

      {/* Domain Registrar Activation Modal */}
      {domainActivateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setDomainActivateModal(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-foreground text-[16px]">Activate Domain</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  <span className="font-mono text-foreground font-medium">{domainActivateModal.domain}</span>
                  {" · "}{domainActivateModal.clientName}
                </p>
              </div>
              <button onClick={() => setDomainActivateModal(null)}
                className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                  Select Domain Registrar
                </label>
                <select
                  value={selectedRegistrarId}
                  onChange={e => setSelectedRegistrarId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-secondary/60 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="none">None / Manual Processing (Email Only)</option>
                  {registrars.filter(r => r.isActive).map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name}{r.isDefault ? " (Default)" : ""}
                    </option>
                  ))}
                </select>
                {registrars.length === 0 && (
                  <p className="text-xs text-amber-500 mt-1.5 flex items-center gap-1">
                    <AlertTriangle size={11} />
                    No registrars configured. Domain will be created manually.
                    <a href="/admin/domain-registrars" className="underline hover:text-amber-400">Configure →</a>
                  </p>
                )}
              </div>

              <div className="p-3 rounded-xl bg-muted/30 border border-border text-xs text-muted-foreground">
                <Globe size={12} className="inline mr-1.5 text-primary" />
                Nameservers will be set to <span className="font-mono text-foreground">ns1.noehost.com</span> and{" "}
                <span className="font-mono text-foreground">ns2.noehost.com</span>.
                Domain record will be marked <span className="text-green-500 font-semibold">Active</span> and
                invoice will be marked <span className="text-green-500 font-semibold">Paid</span>.
              </div>

              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={() => setDomainActivateModal(null)} className="rounded-xl flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={doActivateDomainWithRegistrar}
                  disabled={domainActivating}
                  className="rounded-xl flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                  {domainActivating
                    ? <><Loader2 size={13} className="animate-spin mr-2" /> Activating…</>
                    : <><Globe size={13} className="mr-2" /> Activate Domain</>
                  }
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEditModal(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-foreground text-lg">Edit Order</h3>
                <p className="text-sm text-muted-foreground truncate max-w-[260px]">{editModal.itemName}</p>
              </div>
              <button onClick={() => setEditModal(null)} className="text-muted-foreground hover:text-foreground transition-colors"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Order Status</label>
                  <select value={editModal.status} onChange={e => setEditModal(m => m ? { ...m, status: e.target.value } : m)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/60 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                    {["pending","approved","cancelled","completed","suspended","fraud","terminated"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment</label>
                  <select value={editModal.paymentStatus} onChange={e => setEditModal(m => m ? { ...m, paymentStatus: e.target.value } : m)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/60 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Due Date</label>
                  <Input type="date" value={editModal.dueDate} onChange={e => setEditModal(m => m ? { ...m, dueDate: e.target.value } : m)} className="bg-secondary/60" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Billing Cycle</label>
                  <select value={editModal.billingCycle} onChange={e => setEditModal(m => m ? { ...m, billingCycle: e.target.value } : m)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/60 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                    {["monthly","quarterly","semi_annual","annual","biennially","triennially"].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</label>
                <textarea value={editModal.notes} onChange={e => setEditModal(m => m ? { ...m, notes: e.target.value } : m)}
                  rows={3} placeholder="Add notes..."
                  className="w-full px-3 py-2 rounded-lg bg-secondary/60 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <Button onClick={handleEditSave} disabled={editSaving} className="flex-1 bg-primary hover:bg-primary/90">
                {editSaving ? <Loader2 size={15} className="animate-spin mr-2" /> : null}
                {editSaving ? "Saving…" : "Save Changes"}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setEditModal(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Modal — server group selection for hosting orders */}
      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setApproveModal(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle size={20} className="text-green-400" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-lg">Approve Order</h3>
                <p className="text-sm text-muted-foreground">{approveModal.clientName}</p>
              </div>
            </div>

            <div className="bg-secondary/40 border border-border rounded-xl p-3 mb-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Domain</span>
                <span className="text-foreground font-medium">{approveModal.domain || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Package</span>
                <span className="text-foreground">{approveModal.itemName}</span>
              </div>
            </div>

            {/* Server Group selection */}
            {(() => {
              const groupServers = allServers.filter(s => {
                if (approveModal.moduleType !== "none" && s.type !== approveModal.moduleType) return false;
                if (approveModal.moduleServerGroupId && s.groupId !== approveModal.moduleServerGroupId) return false;
                return true;
              });
              return groupServers.length > 1 ? (
                <div className="space-y-1.5 mb-4">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Server size={12} /> Server Group
                  </label>
                  <select
                    value={approveModal.serverId}
                    onChange={e => setApproveModal(p => p ? { ...p, serverId: e.target.value } : p)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/60 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">Auto-select server</option>
                    {groupServers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.isDefault ? " (default)" : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">Server will be used when activating this order</p>
                </div>
              ) : groupServers.length === 1 ? (
                <div className="flex items-center gap-2 mb-4 px-3 py-2.5 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <CheckCircle size={14} className="text-green-400 shrink-0" />
                  <p className="text-xs text-green-600 dark:text-green-400">Server: {groupServers[0].name}</p>
                </div>
              ) : null;
            })()}

            <div className="mt-5 flex gap-3">
              <Button onClick={submitApprove} disabled={approveLoading}
                className="flex-1 bg-green-600 hover:bg-green-700">
                {approveLoading ? <Loader2 size={15} className="animate-spin mr-2" /> : <CheckCircle size={15} className="mr-2" />}
                {approveLoading ? "Approving…" : "Approve Order"}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setApproveModal(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Activation Modal — credentials form */}
      {preActivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setPreActivate(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Zap size={20} className="text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-lg">Activate Order</h3>
                <p className="text-sm text-muted-foreground">{preActivate.clientName}</p>
              </div>
            </div>

            {/* Order info */}
            <div className="bg-secondary/40 border border-border rounded-xl p-3 mb-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Domain</span>
                <span className="text-foreground font-medium">{preActivate.domain || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Package</span>
                <span className="text-foreground">{preActivate.itemName}</span>
              </div>
              {preActivate.moduleType !== "none" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Module</span>
                  <span className="text-foreground capitalize">{preActivate.moduleType}{preActivate.modulePlanName ? ` / ${preActivate.modulePlanName}` : ""}</span>
                </div>
              )}
            </div>

            {/* 20i Package Type picker */}
            {preActivate.moduleType === "20i" && (
              <div className="space-y-1.5 mb-4">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Zap size={12} /> 20i Hosting Plan
                </label>
                {loadingPackageTypes ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-secondary/40 border border-border rounded-lg">
                    <Loader2 size={13} className="animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Fetching available package types…</span>
                  </div>
                ) : twentyiPackageTypes.length > 0 ? (
                  <select
                    value={preActivate.packageTypeId}
                    onChange={e => setPreActivate(p => p ? { ...p, packageTypeId: e.target.value } : p)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/60 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">Auto-select (use first available)</option>
                    {twentyiPackageTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.label} ({t.platform})</option>
                    ))}
                  </select>
                ) : preActivate.existingModulePlanId ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <CheckCircle size={13} className="text-blue-400 shrink-0" />
                    <p className="text-xs text-blue-400">Using configured plan ID: <code className="font-mono">{preActivate.existingModulePlanId}</code></p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-600 dark:text-amber-400">No package types found — server will auto-select. Configure a 20i server first if activation fails.</p>
                  </div>
                )}
              </div>
            )}

            {/* Server Group selection */}
            {(() => {
              const groupServers = allServers.filter(s => {
                if (preActivate.moduleType !== "none" && s.type !== preActivate.moduleType) return false;
                if (preActivate.moduleServerGroupId && s.groupId !== preActivate.moduleServerGroupId) return false;
                return true;
              });
              return groupServers.length > 1 ? (
                <div className="space-y-1.5 mb-4">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Server size={12} /> Server Group
                  </label>
                  <select
                    value={preActivate.serverId}
                    onChange={e => setPreActivate(p => p ? { ...p, serverId: e.target.value } : p)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/60 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">Auto-select from group</option>
                    {groupServers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.isDefault ? " (default)" : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {preActivate.moduleType === "20i" ? "StackCP account will be linked via email" : "Username and password will be auto-generated"}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-4 px-3 py-2.5 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <CheckCircle size={14} className="text-green-400 shrink-0" />
                  <p className="text-xs text-green-600 dark:text-green-400">
                    {groupServers.length === 1 ? `Server: ${groupServers[0].name}` : "Server will be auto-selected"}
                    {preActivate.moduleType === "20i" ? " — StackCP login via client email" : " — credentials auto-generated"}
                  </p>
                </div>
              );
            })()}

            <div className="mt-5 flex gap-3">
              <Button onClick={submitActivate} disabled={!!loadingId}
                className="flex-1 bg-primary hover:bg-primary/90">
                {loadingId ? <Loader2 size={15} className="animate-spin mr-2" /> : <Zap size={15} className="mr-2" />}
                {loadingId ? "Activating…" : "Activate Order"}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setPreActivate(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Activate success modal */}
      {activateResult && (() => {
        const svc = activateResult.service;
        const svcId = svc?.id ?? null;
        const is20i = !!(svc?.cpanelUrl?.includes("20i") || svc?.cpanelUrl?.includes("stackcp"));
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setActivateResult(null)}>
            <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Zap size={20} className="text-green-400" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-lg">Service Activated!</h3>
                  <p className="text-sm text-muted-foreground">{svc?.domain || "Hosting provisioned"}</p>
                </div>
              </div>

              {svc && (
                <div className="space-y-3">
                  <div className="bg-secondary/40 border border-border rounded-xl p-4 space-y-2 font-mono text-sm">
                    {svc.username && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Username</span>
                        <span className="text-foreground font-medium">{svc.username}</span>
                      </div>
                    )}
                    {svc.password && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Password</span>
                        <span className="text-foreground font-medium">{svc.password}</span>
                      </div>
                    )}
                    {svcId && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">{is20i ? "StackCP" : "cPanel"}</span>
                        <button onClick={() => handleSsoLogin(svcId, "cpanel")}
                          disabled={ssoLoadingId === `${svcId}-cpanel`}
                          className="text-primary hover:underline text-xs">
                          {ssoLoadingId === `${svcId}-cpanel` ? "Connecting..." : `Login to ${is20i ? "StackCP" : "cPanel"} →`}
                        </button>
                      </div>
                    )}
                    {svcId && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Webmail</span>
                        <button onClick={() => handleSsoLogin(svcId, "webmail")}
                          disabled={ssoLoadingId === `${svcId}-webmail`}
                          className="text-primary hover:underline text-xs">
                          {ssoLoadingId === `${svcId}-webmail` ? "Connecting..." : "Login to Webmail →"}
                        </button>
                      </div>
                    )}
                    {svc.serverName && (
                      <div className="flex justify-between items-center border-t border-border/50 pt-2 mt-1">
                        <span className="text-muted-foreground flex items-center gap-1"><Server size={11} /> Server</span>
                        <span className="text-foreground text-xs">{svc.serverName}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">A welcome email with credentials has been sent to the client.</p>
                </div>
              )}

              <div className="mt-5 flex gap-3">
                {svcId && (
                  <Button
                    className="flex-1 bg-orange-600 hover:bg-orange-700"
                    disabled={ssoLoadingId === `${svcId}-cpanel`}
                    onClick={() => handleSsoLogin(svcId, "cpanel")}
                  >
                    <Terminal size={14} className="mr-2" />
                    {ssoLoadingId === `${svcId}-cpanel` ? "Connecting..." : is20i ? "Open StackCP" : "Open cPanel"}
                  </Button>
                )}
                <Button variant="outline" className="flex-1" onClick={() => setActivateResult(null)}>Close</Button>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Orders</h2>
          <p className="text-muted-foreground mt-1">
            {paged ? `${paged.total.toLocaleString()} total orders` : "Manage client orders and provisioning"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isLoading && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
          <Button onClick={() => setLocation("/admin/orders/add")} className="bg-primary hover:bg-primary/90 h-10 rounded-xl whitespace-nowrap">
            <Plus size={16} className="mr-2" /> Create Order
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 bg-card border-border" placeholder="Search by item or domain..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {filterTabs.map(f => (
            <button key={f} onClick={() => { setFilter(f); setPage(1); }}
              className={`px-3 py-1.5 text-xs rounded-lg border capitalize transition-all ${filter === f ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[1000px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item / Domain</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Billing</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Module</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Invoice</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Access</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(order => (
              <tr key={order.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-5 py-4 text-sm font-medium text-foreground whitespace-nowrap">{order.clientName}</td>
                <td className="px-5 py-4">
                  <p className="text-sm font-semibold text-foreground">{order.itemName}</p>
                  {order.domain && <p className="text-xs text-muted-foreground font-mono mt-0.5">{order.domain}</p>}
                  <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-medium bg-secondary border border-border text-secondary-foreground capitalize mt-1">
                    {order.type}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className="text-xs font-medium text-foreground capitalize">{order.billingCycle}</span>
                  {order.dueDate && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">Due: {format(new Date(order.dueDate), "MMM d, yy")}</p>
                  )}
                </td>
                <td className="px-5 py-4">
                  {order.moduleType && order.moduleType !== "none" ? (
                    <div>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${MODULE_COLORS[order.moduleType] || MODULE_COLORS.none}`}>
                        {order.moduleType}
                      </span>
                      {order.modulePlanName && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[100px] truncate" title={order.modulePlanName}>{order.modulePlanName}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                <td className="px-5 py-4 text-sm font-semibold text-foreground whitespace-nowrap">
                  {formatPrice(Number(order.amount))}
                </td>
                <td className="px-5 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border capitalize ${statusColors[order.status] || "bg-secondary text-secondary-foreground border-border"}`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border capitalize ${paymentColors[order.paymentStatus] || "bg-secondary text-secondary-foreground border-border"}`}>
                    {order.paymentStatus || "unpaid"}
                  </span>
                </td>
                <td className="px-5 py-4">
                  {order.invoiceId ? (
                    <button onClick={() => setLocation("/admin/invoices")}
                      className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <FileText size={12} /> View
                    </button>
                  ) : (
                    <button onClick={e => { e.stopPropagation(); generateInvoice(order.id); }}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                      {loadingId === order.id ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                      Generate
                    </button>
                  )}
                </td>
                {/* Quick Access: cPanel + Webmail SSO for active hosting services */}
                <td className="px-5 py-4">
                  {order.type === "hosting" && order.serviceStatus === "active" && order.serviceId ? (
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleSsoLogin(order.serviceId!, "cpanel")}
                        disabled={ssoLoadingId === `${order.serviceId}-cpanel`}
                        className="flex items-center gap-1 text-[10px] text-orange-400 hover:text-orange-300 whitespace-nowrap disabled:opacity-50"
                      >
                        <Terminal size={11} /> {ssoLoadingId === `${order.serviceId}-cpanel` ? "..." : "cPanel"}
                      </button>
                      <button
                        onClick={() => handleSsoLogin(order.serviceId!, "webmail")}
                        disabled={ssoLoadingId === `${order.serviceId}-webmail`}
                        className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 whitespace-nowrap disabled:opacity-50"
                      >
                        <Mail size={11} /> {ssoLoadingId === `${order.serviceId}-webmail` ? "..." : "Webmail"}
                      </button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(order.createdAt), "MMM d, yyyy")}
                </td>
                <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5">
                    {order.status === "pending" && (
                      <>
                        <Button size="sm"
                          className="h-7 px-2.5 text-xs bg-green-600 hover:bg-green-700 whitespace-nowrap"
                          disabled={loadingId === order.id || approveLoading}
                          onClick={() => order.type === "hosting" ? openApproveModal(order) : doAction(order.id, "approve")}>
                          {(loadingId === order.id || approveLoading) ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive" className="h-7 px-2.5 text-xs" onClick={() => doAction(order.id, "cancel")}>
                          <XCircle className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                    {/* Activate button: for hosting orders not yet active */}
                    {order.type === "hosting" && order.serviceStatus !== "active" && order.status !== "cancelled" && order.status !== "terminated" && order.status !== "fraud" && (
                      <Button size="sm"
                        className="h-7 px-2.5 text-xs bg-purple-600 hover:bg-purple-700 whitespace-nowrap"
                        disabled={loadingId === order.id}
                        onClick={() => openActivateModal(order)}>
                        {loadingId === order.id ? <Loader2 size={12} className="animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
                        Activate
                      </Button>
                    )}
                    {/* Domain activate: for domain orders that are approved */}
                    {order.type === "domain" && order.status === "approved" && (
                      <Button size="sm"
                        className="h-7 px-2.5 text-xs bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
                        disabled={loadingId === order.id}
                        onClick={() => openDomainActivateModal(order)}>
                        {loadingId === order.id ? <Loader2 size={12} className="animate-spin" /> : <Globe className="w-3 h-3 mr-1" />}
                        Activate Domain
                      </Button>
                    )}
                    <div className="relative">
                      <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1"
                        onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === order.id ? null : order.id); }}>
                        More <ChevronDown size={10} />
                      </Button>
                      {openMenuId === order.id && (
                        <div className="absolute right-0 top-8 z-30 w-44 bg-card border border-border rounded-xl shadow-xl py-1 text-sm" onClick={e => e.stopPropagation()}>
                          <button className="flex items-center gap-2 w-full px-3 py-2 hover:bg-secondary text-left text-muted-foreground hover:text-foreground"
                            onClick={() => openEditOrder(order)}>
                            <Edit2 size={13} /> Edit Order
                          </button>
                          {order.status === "approved" && (
                            <button className="flex items-center gap-2 w-full px-3 py-2 hover:bg-secondary text-left text-muted-foreground hover:text-foreground"
                              onClick={() => doAction(order.id, "suspend")}>
                              <StopCircle size={13} /> Suspend
                            </button>
                          )}
                          {order.status === "suspended" && (
                            <button className="flex items-center gap-2 w-full px-3 py-2 hover:bg-secondary text-left text-muted-foreground hover:text-foreground"
                              onClick={() => doAction(order.id, "approve")}>
                              <CheckCircle size={13} /> Unsuspend
                            </button>
                          )}
                          <button className="flex items-center gap-2 w-full px-3 py-2 hover:bg-secondary text-left text-yellow-400"
                            onClick={() => doAction(order.id, "fraud")}>
                            <AlertTriangle size={13} /> Mark Fraud
                          </button>
                          <button className="flex items-center gap-2 w-full px-3 py-2 hover:bg-secondary text-left text-destructive"
                            onClick={() => doAction(order.id, "terminate")}>
                            <XCircle size={13} /> Terminate
                          </button>
                          <button className="flex items-center gap-2 w-full px-3 py-2 hover:bg-secondary text-left text-blue-400 border-t border-border mt-1"
                            onClick={() => doAction(order.id, "refund")}>
                            <RotateCcw size={13} /> Refund & Cancel
                          </button>
                          {!order.invoiceId && (
                            <button className="flex items-center gap-2 w-full px-3 py-2 hover:bg-secondary text-left text-primary border-t border-border mt-1"
                              onClick={() => generateInvoice(order.id)}>
                              <FileText size={13} /> Generate Invoice
                            </button>
                          )}
                          <button className="flex items-center gap-2 w-full px-3 py-2 hover:bg-secondary text-left text-red-400 border-t border-border mt-1"
                            onClick={() => handleDeleteOrder(order.id)}>
                            <Trash2 size={13} /> Delete Order
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {isLoading && (
              <tr><td colSpan={11} className="px-6 py-12 text-center">
                <Loader2 size={32} className="animate-spin mx-auto text-primary/50" />
              </td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={11} className="px-6 py-12 text-center text-muted-foreground">No orders found</td></tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {paged && paged.totalPages > 1 && (
          <div className="px-5 py-4 border-t border-border flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {paged.page} of {paged.totalPages} · {paged.total.toLocaleString()} orders
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={14} className="mr-1" /> Prev
              </Button>
              {Array.from({ length: Math.min(5, paged.totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, paged.totalPages - 4));
                const p = start + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${p === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
                    {p}
                  </button>
                );
              })}
              <Button variant="outline" size="sm" disabled={page >= paged.totalPages} onClick={() => setPage(p => p + 1)}>
                Next <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
