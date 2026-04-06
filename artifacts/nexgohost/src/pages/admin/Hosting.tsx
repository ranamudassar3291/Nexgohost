import { useState, useEffect, useCallback } from "react";
import { Server, Database, Activity, Search, HardDrive, XCircle, PauseCircle, PlayCircle, Trash2, AlertTriangle, Zap, LinkIcon, KeyRound, Eye, EyeOff, X, RefreshCw, ArrowUpCircle, CheckCircle, RotateCcw, Loader2, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useCurrency } from "@/context/CurrencyProvider";

interface HostingService {
  id: string; clientId: string; clientName: string; planName: string;
  domain: string | null; username: string | null; serverIp: string | null;
  status: string; billingCycle: string | null; nextDueDate: string | null;
  sslStatus: string; diskUsed: string | null; bandwidthUsed: string | null;
  cancelRequested: boolean; cancelReason: string | null; createdAt: string;
  twentyIPackageId?: string | null; stackUserId?: string | null;
}

interface PaginatedHosting {
  data: HostingService[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PendingOrder {
  id: string; type: string; itemId: string | null; itemName: string;
  domain: string | null; amount: number; billingCycle: string | null;
  status: string; clientId: string; createdAt: string;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Request failed"); }
  return res.json();
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debouncedValue;
}

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-600 border-green-500/20",
  suspended: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  terminated: "bg-red-50 text-red-600 border-red-200",
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
};

const LIMIT = 50;

export default function AdminHosting() {
  const [activeTab, setActiveTab] = useState<"services" | "plans">("services");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [linkingServers, setLinkingServers] = useState(false);
  const [syncingUsage, setSyncingUsage] = useState<string | null>(null);
  const [ssoLoadingId, setSsoLoadingId] = useState<string | null>(null);
  const [changePwModal, setChangePwModal] = useState<{ id: string; domain: string | null } | null>(null);
  const [changePwValue, setChangePwValue] = useState("");
  const [showChangePw, setShowChangePw] = useState(false);
  const [changePwLoading, setChangePwLoading] = useState(false);
  const [suspendModal, setSuspendModal] = useState<{ id: string; domain: string | null } | null>(null);
  const [suspendReason, setSuspendReason] = useState("Overdue Payment");
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const queryClient = useQueryClient();

  const search = useDebounce(searchInput, 400);

  // Reset to page 1 whenever search or status changes
  const handleSearchChange = useCallback((val: string) => {
    setSearchInput(val);
    setPage(1);
  }, []);
  const handleStatusChange = useCallback((val: string) => {
    setStatusFilter(val);
    setPage(1);
  }, []);

  const hostingQueryKey = ["admin-hosting", page, search, statusFilter];
  const { data: hostingResp, isLoading: isLoadingServices } = useQuery<PaginatedHosting>({
    queryKey: hostingQueryKey,
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        status: statusFilter,
        ...(search ? { search } : {}),
      });
      return apiFetch(`/api/admin/hosting?${params}`);
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const services: HostingService[] = hostingResp?.data ?? [];
  const total = hostingResp?.total ?? 0;
  const totalPages = hostingResp?.totalPages ?? 1;

  const { data: plans = [], isLoading: isLoadingPlans } = useQuery<any[]>({
    queryKey: ["admin-packages"],
    queryFn: () => apiFetch("/api/admin/packages"),
  });

  const { data: pendingOrdersResp } = useQuery<{ data: PendingOrder[] }>({
    queryKey: ["admin-orders-pending"],
    queryFn: () => apiFetch("/api/admin/orders?status=pending&limit=200"),
    refetchInterval: 30000,
  });
  const allOrders = pendingOrdersResp?.data ?? [];
  const pendingRenewals = allOrders.filter(o => o.type === "renewal");
  const pendingUpgrades = allOrders.filter(o => o.type === "upgrade");

  const cancelRequests = services.filter(s => s.cancelRequested);

  const handleSyncUsage = async (id: string, domain: string | null) => {
    setSyncingUsage(id);
    try {
      const result = await apiFetch(`/api/admin/hosting/${id}/sync-usage`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["admin-hosting"] });
      toast({ title: "Usage Synced", description: result.message || `Live usage updated for ${domain || id}` });
    } catch (err: any) {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    } finally { setSyncingUsage(null); }
  };

  const handleAdminSSO = async (s: HostingService) => {
    setSsoLoadingId(s.id);
    try {
      const result = await apiFetch(`/api/admin/hosting/${s.id}/cpanel-login`, { method: "POST" });
      if (result?.url) window.open(result.url, "_blank", "noopener,noreferrer");
      else toast({ title: "SSO unavailable", description: "No login URL returned for this service.", variant: "destructive" });
    } catch (err: any) {
      toast({ title: "SSO failed", description: err.message, variant: "destructive" });
    } finally { setSsoLoadingId(null); }
  };

  const handleChangePassword = async () => {
    if (!changePwModal) return;
    if (changePwValue.length < 8) {
      toast({ title: "Error", description: "Password must be at least 8 characters", variant: "destructive" }); return;
    }
    setChangePwLoading(true);
    try {
      await apiFetch(`/api/admin/hosting/${changePwModal.id}/change-password`, {
        method: "POST", body: JSON.stringify({ password: changePwValue }),
      });
      toast({ title: "Password Changed", description: `Password updated for ${changePwModal.domain || "service"}` });
      setChangePwModal(null); setChangePwValue(""); setShowChangePw(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setChangePwLoading(false); }
  };

  const action = async (id: string, endpoint: string, label: string, body?: Record<string, unknown>) => {
    try {
      const result = await apiFetch(`/api/admin/hosting/${id}/${endpoint}`, { method: "POST", body: body ? JSON.stringify(body) : undefined });
      queryClient.invalidateQueries({ queryKey: ["admin-hosting"] });
      toast({ title: `Service ${label}` });
      if (result.credentials) {
        toast({
          title: "Credentials Created",
          description: `Username: ${result.credentials.username} | Password: ${result.credentials.password}`,
        });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const linkAllServers = async () => {
    setLinkingServers(true);
    try {
      const result = await apiFetch("/api/admin/hosting/link-all-servers", { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["admin-hosting"] });
      toast({ title: "Services linked", description: result.message });
    } catch (err: any) {
      toast({ title: "Link failed", description: err.message, variant: "destructive" });
    } finally { setLinkingServers(false); }
  };

  return (
    <div className="space-y-6">
      {/* Suspend Reason Modal */}
      {suspendModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-border rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold flex items-center gap-2 text-foreground"><PauseCircle size={18} className="text-orange-400" /> Suspend Service</h2>
              <button onClick={() => setSuspendModal(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Suspending <strong className="text-foreground">{suspendModal.domain || "this service"}</strong>.
                Select a reason — this will be logged and included in the client notification.
              </p>
              <div className="space-y-2">
                {["Overdue Payment", "High Resource Usage", "TOS Violation"].map(reason => (
                  <label key={reason} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-secondary/50 cursor-pointer transition-colors has-[:checked]:border-orange-500/50 has-[:checked]:bg-orange-500/5">
                    <input type="radio" name="suspendReason" value={reason} checked={suspendReason === reason} onChange={() => setSuspendReason(reason)} className="accent-orange-500" />
                    <span className="text-sm font-medium text-foreground">{reason}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-3">
                <Button onClick={() => { action(suspendModal.id, "suspend", "suspended", { reason: suspendReason }); setSuspendModal(null); }}
                  className="flex-1 gap-2 bg-orange-500 hover:bg-orange-600 text-white">
                  <PauseCircle size={16} /> Suspend Service
                </Button>
                <Button variant="outline" onClick={() => setSuspendModal(null)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {changePwModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-border rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold flex items-center gap-2 text-foreground"><KeyRound size={18} className="text-primary" /> Change cPanel Password</h2>
              <Button variant="ghost" size="icon" onClick={() => { setChangePwModal(null); setChangePwValue(""); setShowChangePw(false); }}>
                <X size={18} />
              </Button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Update password for <strong className="text-foreground">{changePwModal.domain || "this service"}</strong>. Minimum 8 characters.
              </p>
              <div className="relative">
                <Input
                  type={showChangePw ? "text" : "password"}
                  placeholder="New password"
                  value={changePwValue}
                  onChange={e => setChangePwValue((e.target as HTMLInputElement).value)}
                  className="pr-10"
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowChangePw(v => !v)}>
                  {showChangePw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <div className="flex gap-3">
                <Button onClick={handleChangePassword} disabled={changePwLoading || changePwValue.length < 8} className="flex-1 gap-2">
                  {changePwLoading && <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full inline-block" />}
                  Update Password
                </Button>
                <Button variant="outline" onClick={() => { setChangePwModal(null); setChangePwValue(""); setShowChangePw(false); }}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Hosting Manager</h2>
          <p className="text-muted-foreground mt-1">Manage active services and hosting plans. {total > 0 && <span className="text-primary font-medium">{total.toLocaleString()} total services</span>}</p>
        </div>
        <div className="flex items-center gap-3">
          {cancelRequests.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-600">
              <AlertTriangle size={14} />
              {cancelRequests.length} cancellation{cancelRequests.length > 1 ? "s" : ""} (this page)
            </div>
          )}
          <Button variant="outline" size="sm" onClick={linkAllServers} disabled={linkingServers}
            className="gap-2 border-violet-500/30 text-violet-600 hover:bg-violet-500/10">
            <LinkIcon size={14} className={linkingServers ? "animate-pulse" : ""} />
            {linkingServers ? "Linking..." : "Link All Services"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-secondary/40 border border-border rounded-xl p-1.5 flex gap-1 w-fit">
        {(["services", "plans"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all capitalize ${activeTab === tab ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-white"}`}>
            {tab === "services" ? <Server size={16} /> : <Database size={16} />}
            {tab === "services" ? "Active Services" : "Hosting Plans"}
          </button>
        ))}
      </div>

      {activeTab === "services" && (
        <div className="space-y-4">
          {/* Cancel requests banner */}
          {cancelRequests.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 space-y-2">
              <h3 className="text-sm font-semibold text-red-600 flex items-center gap-2"><AlertTriangle size={14} /> Pending Cancellation Requests</h3>
              {cancelRequests.map(s => (
                <div key={s.id} className="flex items-center justify-between py-2 border-t border-red-500/10">
                  <div>
                    <span className="text-sm font-medium text-foreground">{s.domain || s.planName}</span>
                    <span className="text-xs text-muted-foreground ml-2">({s.clientName}) — Reason: {s.cancelReason}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 bg-red-500 hover:bg-red-600 text-white" onClick={() => action(s.id, "cancel", "cancelled")}>
                      Approve Cancellation
                    </Button>
                    <Button size="sm" variant="outline" className="h-7" onClick={() => {
                      apiFetch(`/api/admin/hosting/${s.id}`, { method: "PUT", body: JSON.stringify({ cancelRequested: false }) })
                        .then(() => { queryClient.invalidateQueries({ queryKey: ["admin-hosting"] }); toast({ title: "Request dismissed" }); })
                        .catch(err => toast({ title: "Error", description: err.message, variant: "destructive" }));
                    }}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pending Renewal Requests */}
          {pendingRenewals.length > 0 && (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 space-y-2">
              <h3 className="text-sm font-semibold text-blue-600 flex items-center gap-2"><RefreshCw size={14} /> Pending Renewal Requests ({pendingRenewals.length})</h3>
              {pendingRenewals.map(order => {
                const relatedService = services.find(s => s.id === order.itemId);
                return (
                  <div key={order.id} className="flex items-center justify-between py-2 border-t border-blue-500/10">
                    <div>
                      <span className="text-sm font-medium text-foreground">{order.itemName}</span>
                      {order.domain && <span className="text-xs text-muted-foreground ml-2">({order.domain})</span>}
                      <div className="text-xs text-muted-foreground">
                        {formatPrice(order.amount)} · {order.billingCycle} · Submitted {format(new Date(order.createdAt), "MMM d")}
                        {relatedService && <span className="ml-2">· Due: {relatedService.nextDueDate ? format(new Date(relatedService.nextDueDate), "MMM d, yyyy") : "—"}</span>}
                      </div>
                    </div>
                    <Button size="sm" className="h-7 bg-blue-600 hover:bg-blue-700 text-white gap-1"
                      onClick={async () => {
                        if (!order.itemId) return;
                        try {
                          const result = await apiFetch(`/api/admin/hosting/${order.itemId}/approve-renewal`, { method: "POST" });
                          queryClient.invalidateQueries({ queryKey: ["admin-hosting"] });
                          queryClient.invalidateQueries({ queryKey: ["admin-orders-pending"] });
                          toast({ title: "Renewal Approved", description: `Next due date: ${result.newDueDate ? format(new Date(result.newDueDate), "MMM d, yyyy") : "extended"}` });
                        } catch (err: any) {
                          toast({ title: "Error", description: err.message, variant: "destructive" });
                        }
                      }}>
                      <CheckCircle size={12} /> Approve Renewal
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pending Upgrade Requests */}
          {pendingUpgrades.length > 0 && (
            <div className="bg-violet-500/5 border border-violet-500/20 rounded-2xl p-4 space-y-2">
              <h3 className="text-sm font-semibold text-violet-600 flex items-center gap-2"><ArrowUpCircle size={14} /> Pending Plan Change Requests ({pendingUpgrades.length})</h3>
              {pendingUpgrades.map(order => (
                <div key={order.id} className="flex items-center justify-between py-2 border-t border-violet-500/10">
                  <div>
                    <span className="text-sm font-medium text-foreground">{order.itemName}</span>
                    {order.domain && <span className="text-xs text-muted-foreground ml-2">({order.domain})</span>}
                    <div className="text-xs text-muted-foreground">
                      {formatPrice(order.amount)} · Submitted {format(new Date(order.createdAt), "MMM d")}
                    </div>
                  </div>
                  <Button size="sm" className="h-7 bg-violet-600 hover:bg-violet-700 text-white gap-1"
                    onClick={async () => {
                      if (!order.itemId) return;
                      try {
                        await apiFetch(`/api/admin/hosting/${order.itemId}/approve-upgrade`, { method: "POST" });
                        queryClient.invalidateQueries({ queryKey: ["admin-hosting"] });
                        queryClient.invalidateQueries({ queryKey: ["admin-orders-pending"] });
                        toast({ title: "Plan Change Approved", description: "Service plan has been updated." });
                      } catch (err: any) {
                        toast({ title: "Error", description: err.message, variant: "destructive" });
                      }
                    }}>
                    <CheckCircle size={12} /> Approve Plan Change
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Search + filter bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9 bg-white border-border" placeholder="Search domain or plan..." value={searchInput} onChange={e => handleSearchChange((e.target as HTMLInputElement).value)} />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {["all", "active", "suspended", "terminated", "pending"].map(s => (
                <button key={s} onClick={() => handleStatusChange(s)}
                  className={`px-3 py-1.5 text-xs rounded-lg border capitalize transition-all ${statusFilter === s ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground hover:bg-white"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-border rounded-2xl overflow-hidden overflow-x-auto shadow-sm">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/20">
                  <th className="p-4 font-medium text-muted-foreground">Domain / Server</th>
                  <th className="p-4 font-medium text-muted-foreground">Client</th>
                  <th className="p-4 font-medium text-muted-foreground">Plan</th>
                  <th className="p-4 font-medium text-muted-foreground">Next Due</th>
                  <th className="p-4 font-medium text-muted-foreground">Status</th>
                  <th className="p-4 font-medium text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingServices ? (
                  <tr><td colSpan={6} className="p-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                      <span className="text-xs">Loading services…</span>
                    </div>
                  </td></tr>
                ) : services.length === 0 ? (
                  <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">
                    <XCircle size={28} className="mx-auto mb-2 opacity-30" />
                    No services found{search ? ` for "${search}"` : ""}.
                  </td></tr>
                ) : services.map(s => (
                  <tr key={s.id} className={`border-b border-border/50 hover:bg-violet-50/40 transition-colors ${s.cancelRequested ? "bg-red-50/40" : ""}`}>
                    <td className="p-4 min-w-[180px]">
                      <div className="font-semibold text-foreground">{s.domain || "—"}</div>
                      <div className="text-xs text-muted-foreground">{s.serverIp || "No server linked"}</div>
                      {s.username && (
                        <div className="text-xs text-violet-500/80 font-mono mt-0.5">
                          <span className="text-muted-foreground">id: </span>{s.username}
                        </div>
                      )}
                      {s.cancelRequested && (
                        <div className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                          <AlertTriangle size={10} /> Cancel requested
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-muted-foreground whitespace-nowrap">{s.clientName}</td>
                    <td className="p-4">
                      <div className="font-medium text-foreground">{s.planName}</div>
                      <div className="text-xs text-muted-foreground capitalize">{s.billingCycle || "monthly"}</div>
                    </td>
                    <td className="p-4 text-muted-foreground text-xs whitespace-nowrap">
                      {s.nextDueDate ? format(new Date(s.nextDueDate), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${statusColors[s.status] || "bg-secondary border-border text-muted-foreground"}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 justify-end flex-wrap">
                        {/* SSO login */}
                        {s.status === "active" && s.username && (
                          <Button size="sm" variant="outline"
                            className="h-7 px-2.5 text-xs gap-1 text-violet-600 border-violet-500/30 hover:bg-violet-500/10"
                            onClick={() => handleAdminSSO(s)}
                            disabled={ssoLoadingId === s.id}
                            title="Open control panel (SSO)"
                          >
                            {ssoLoadingId === s.id ? <Loader2 size={13} className="animate-spin" /> : <ExternalLink size={13} />}
                            Login
                          </Button>
                        )}
                        {s.status === "active" && (
                          <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1 text-orange-500 border-orange-500/30 hover:bg-orange-500/10"
                            onClick={() => { setSuspendReason("Overdue Payment"); setSuspendModal({ id: s.id, domain: s.domain }); }}>
                            <PauseCircle size={13} /> Suspend
                          </Button>
                        )}
                        {s.status === "suspended" && (
                          <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1 text-green-600 border-green-500/30 hover:bg-green-500/10"
                            onClick={() => action(s.id, "unsuspend", "unsuspended")}>
                            <PlayCircle size={13} /> Unsuspend
                          </Button>
                        )}
                        {s.status === "pending" && (
                          <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1 text-blue-600 border-blue-500/30 hover:bg-blue-500/10"
                            onClick={() => action(s.id, "provision", "provisioned")}>
                            <Zap size={13} /> Create Account
                          </Button>
                        )}
                        {s.status !== "terminated" && (
                          <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1 text-red-500 border-red-500/30 hover:bg-red-500/10"
                            onClick={() => { if (confirm(`Terminate service for ${s.domain}? This is irreversible.`)) action(s.id, "terminate", "terminated"); }}>
                            <Trash2 size={13} /> Terminate
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1"
                          onClick={() => { setChangePwModal({ id: s.id, domain: s.domain }); setChangePwValue(""); }}>
                          <KeyRound size={13} /> Password
                        </Button>
                        {s.status === "active" && (
                          <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1 text-blue-500 border-blue-500/30 hover:bg-blue-500/10"
                            onClick={() => handleSyncUsage(s.id, s.domain)} disabled={syncingUsage === s.id}>
                            {syncingUsage === s.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Sync
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} &middot; {total.toLocaleString()} total service{total !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-8 gap-1" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                  <ChevronLeft size={14} /> Previous
                </Button>
                {/* Page number bubbles — show up to 7 */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 7) {
                      pageNum = i + 1;
                    } else if (page <= 4) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 3) {
                      pageNum = totalPages - 6 + i;
                    } else {
                      pageNum = page - 3 + i;
                    }
                    return (
                      <button key={pageNum} onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 text-xs rounded-lg transition-all ${page === pageNum ? "bg-primary text-white" : "border border-border text-muted-foreground hover:bg-secondary/60"}`}>
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <Button size="sm" variant="outline" className="h-8 gap-1" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                  Next <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "plans" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {isLoadingPlans ? (
            <div className="col-span-3 p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            </div>
          ) : plans.filter(p => p.isActive).map(plan => (
            <div key={plan.id} className="bg-white border border-border rounded-2xl p-6 hover:border-primary/50 transition-colors shadow-sm">
              <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-3xl font-bold text-foreground">{formatPrice(plan.price)}</span>
                <span className="text-muted-foreground mb-1">/mo</span>
                {plan.yearlyPrice && <span className="ml-2 text-sm text-muted-foreground">({formatPrice(plan.yearlyPrice)}/yr)</span>}
              </div>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center gap-2 text-sm text-foreground/80"><HardDrive size={14} className="text-primary" /> {plan.diskSpace}</li>
                <li className="flex items-center gap-2 text-sm text-foreground/80"><Activity size={14} className="text-primary" /> {plan.bandwidth} Bandwidth</li>
                <li className="flex items-center gap-2 text-sm text-foreground/80"><Database size={14} className="text-primary" /> {plan.databases} MySQL DBs</li>
              </ul>
              {plan.module && plan.module !== "none" && (
                <div className="mt-3 px-2 py-1 bg-primary/10 text-primary text-xs rounded-lg inline-block capitalize">{plan.module}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
