import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ShoppingCart, CheckCircle, XCircle, Search, Plus, FileText,
  ChevronDown, Loader2, RefreshCw, AlertTriangle, StopCircle,
  Terminal, Mail, Zap, ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Order {
  id: string; clientId: string; clientName: string;
  type: string; itemId: string | null; itemName: string;
  domain: string | null; amount: number;
  billingCycle: string; dueDate: string | null;
  moduleType: string; modulePlanId: string | null; modulePlanName: string | null;
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
  pending:    "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  approved:   "bg-green-500/10 text-green-400 border-green-500/20",
  completed:  "bg-blue-500/10 text-blue-400 border-blue-500/20",
  cancelled:  "bg-red-500/10 text-red-400 border-red-500/20",
  suspended:  "bg-orange-500/10 text-orange-400 border-orange-500/20",
  fraud:      "bg-purple-500/10 text-purple-400 border-purple-500/20",
  terminated: "bg-red-800/10 text-red-600 border-red-800/20",
};

const paymentColors: Record<string, string> = {
  paid:   "bg-green-500/10 text-green-400 border-green-500/20",
  unpaid: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

const MODULE_COLORS: Record<string, string> = {
  cpanel:      "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "20i":       "bg-blue-500/10 text-blue-400 border-blue-500/20",
  directadmin: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  plesk:       "bg-purple-500/10 text-purple-400 border-purple-500/20",
  none:        "bg-secondary/50 text-muted-foreground border-border",
};

const filterTabs = ["all", "pending", "approved", "suspended", "cancelled", "fraud", "terminated"];

interface ActivateResult {
  orderId: string;
  service: { cpanelUrl: string; webmailUrl: string; username: string; domain: string } | null;
}

export default function AdminOrders() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [activateResult, setActivateResult] = useState<ActivateResult | null>(null);

  const { data: orders = [], isLoading, refetch } = useQuery<Order[]>({
    queryKey: ["admin-orders"],
    queryFn: () => apiFetch("/api/admin/orders"),
  });

  const filtered = orders.filter(o => {
    const matchSearch = o.clientName?.toLowerCase().includes(search.toLowerCase()) ||
      o.itemName.toLowerCase().includes(search.toLowerCase()) ||
      (o.domain || "").toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || o.status === filter;
    return matchSearch && matchFilter;
  });

  const doAction = async (id: string, action: string) => {
    setLoadingId(id);
    setOpenMenuId(null);
    try {
      const data = await apiFetch(`/api/admin/orders/${id}/${action}`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      refetch();
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

  const activateOrder = async (id: string) => {
    setLoadingId(id);
    setOpenMenuId(null);
    try {
      const data = await apiFetch(`/api/admin/orders/${id}/activate`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      refetch();
      if (data.service?.cpanelUrl) {
        setActivateResult({ orderId: id, service: data.service });
        toast({ title: "Service Activated!", description: `Account provisioned for ${data.service.domain || "the domain"}` });
      } else {
        toast({ title: "Order Activated", description: data.provision?.message || "Invoice marked paid" });
      }
    } catch (err: any) {
      toast({ title: "Activation failed", description: err.message, variant: "destructive" });
    } finally { setLoadingId(null); }
  };

  const generateInvoice = async (id: string) => {
    setLoadingId(id);
    setOpenMenuId(null);
    try {
      const data = await apiFetch(`/api/admin/orders/${id}/generate-invoice`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      refetch();
      if (data.invoiceNumber) {
        toast({ title: "Invoice generated", description: `Invoice ${data.invoiceNumber} created` });
      } else {
        toast({ title: data.message || "Invoice already exists" });
      }
    } catch (err: any) {
      toast({ title: "Failed to generate invoice", description: err.message, variant: "destructive" });
    } finally { setLoadingId(null); }
  };

  if (isLoading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6" onClick={() => setOpenMenuId(null)}>
      {/* Activate success modal */}
      {activateResult?.service && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setActivateResult(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Zap size={20} className="text-green-400" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-lg">Service Activated!</h3>
                <p className="text-sm text-muted-foreground">{activateResult.service.domain}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="bg-secondary/40 border border-border rounded-xl p-4 space-y-2 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Username</span>
                  <span className="text-foreground font-medium">{activateResult.service.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">cPanel</span>
                  <a href={activateResult.service.cpanelUrl} target="_blank" rel="noreferrer"
                    className="text-primary hover:underline text-xs truncate max-w-[200px]">{activateResult.service.cpanelUrl}</a>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Webmail</span>
                  <a href={activateResult.service.webmailUrl} target="_blank" rel="noreferrer"
                    className="text-primary hover:underline text-xs truncate max-w-[200px]">{activateResult.service.webmailUrl}</a>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">A welcome email with credentials has been sent to the client.</p>
            </div>
            <div className="mt-5 flex gap-3">
              <a href={activateResult.service.cpanelUrl} target="_blank" rel="noreferrer" className="flex-1">
                <Button className="w-full bg-orange-600 hover:bg-orange-700"><Terminal size={14} className="mr-2" /> Open cPanel</Button>
              </a>
              <Button variant="outline" className="flex-1" onClick={() => setActivateResult(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Orders</h2>
          <p className="text-muted-foreground mt-1">Manage client orders and provisioning</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{orders.filter(o => o.status === "pending").length} pending</span>
          <Button onClick={() => setLocation("/admin/orders/add")} className="bg-primary hover:bg-primary/90 h-10 rounded-xl">
            <Plus size={16} className="mr-2" /> Create Order
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 bg-card border-border" placeholder="Search by client, item, or domain..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {filterTabs.map(f => (
            <button key={f} onClick={() => setFilter(f)}
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
                  ${Number(order.amount).toFixed(2)}
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
                {/* Quick Access: cPanel + Webmail for active hosting services */}
                <td className="px-5 py-4">
                  {order.type === "hosting" && order.serviceStatus === "active" && (order.cpanelUrl || order.webmailUrl) ? (
                    <div className="flex flex-col gap-1">
                      {order.cpanelUrl && (
                        <a href={order.cpanelUrl} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-[10px] text-orange-400 hover:text-orange-300 whitespace-nowrap">
                          <Terminal size={11} /> cPanel
                        </a>
                      )}
                      {order.webmailUrl && (
                        <a href={order.webmailUrl} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 whitespace-nowrap">
                          <Mail size={11} /> Webmail
                        </a>
                      )}
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
                          disabled={loadingId === order.id}
                          onClick={() => doAction(order.id, "approve")}>
                          {loadingId === order.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}
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
                        onClick={() => activateOrder(order.id)}>
                        {loadingId === order.id ? <Loader2 size={12} className="animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
                        Activate
                      </Button>
                    )}
                    <div className="relative">
                      <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1"
                        onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === order.id ? null : order.id); }}>
                        More <ChevronDown size={10} />
                      </Button>
                      {openMenuId === order.id && (
                        <div className="absolute right-0 top-8 z-30 w-44 bg-card border border-border rounded-xl shadow-xl py-1 text-sm" onClick={e => e.stopPropagation()}>
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
                          {!order.invoiceId && (
                            <button className="flex items-center gap-2 w-full px-3 py-2 hover:bg-secondary text-left text-primary border-t border-border mt-1"
                              onClick={() => generateInvoice(order.id)}>
                              <FileText size={13} /> Generate Invoice
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={11} className="px-6 py-12 text-center text-muted-foreground">No orders found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
