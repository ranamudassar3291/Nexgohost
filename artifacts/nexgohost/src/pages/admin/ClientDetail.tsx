import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrency } from "@/context/CurrencyProvider";
import {
  ArrowLeft, User, Mail, Building, Phone, Calendar, Server, Globe, FileText,
  MessageSquare, ShoppingCart, Loader2, Edit2, Trash2, PauseCircle, PlayCircle,
  Send, Zap, XCircle, Shield, TrendingUp, TrendingDown, Key, CheckCircle,
  CreditCard, Plus, ExternalLink, AlertTriangle, Wallet, ArrowDownLeft, ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type Tab = "services" | "domains" | "invoices" | "tickets" | "orders";

interface ClientFull {
  id: string; firstName: string; lastName: string; email: string; phone?: string;
  company?: string; country?: string; currency?: string; status: string; createdAt: string;
  hosting: any[]; domains: any[]; invoices: any[]; tickets: any[]; orders: any[];
}

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-500/10 text-green-400 border-green-500/20",
  suspended: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  terminated: "bg-red-500/10 text-red-400 border-red-500/20",
  paid: "bg-green-500/10 text-green-400 border-green-500/20",
  unpaid: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  open: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  answered: "bg-green-500/10 text-green-400 border-green-500/20",
  closed: "bg-secondary text-muted-foreground border-border",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${STATUS_BADGE[status] || "bg-secondary text-muted-foreground border-border"}`}>
      {status}
    </span>
  );
}

export default function AdminClientDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("services");
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});

  const [walletAmt, setWalletAmt] = useState("");
  const [walletType, setWalletType] = useState<"admin_add" | "admin_deduct" | "refund">("admin_add");
  const [walletDesc, setWalletDesc] = useState("");

  const { data: client, isLoading } = useQuery<ClientFull>({
    queryKey: ["admin-client", id],
    queryFn: () => apiFetch(`/api/admin/clients/${id}`),
  });

  const { data: creditData, refetch: refetchCredits } = useQuery<{ creditBalance: string; transactions: any[] }>({
    queryKey: ["admin-client-credits", id],
    queryFn: () => apiFetch(`/api/admin/users/${id}/credits`),
    enabled: !!id,
  });

  const walletMutation = useMutation({
    mutationFn: () => apiFetch(`/api/admin/users/${id}/credits`, {
      method: "POST",
      body: JSON.stringify({ amount: parseFloat(walletAmt), type: walletType, description: walletDesc || undefined }),
    }),
    onSuccess: (res: any) => {
      refetchCredits();
      setWalletAmt(""); setWalletDesc("");
      toast({ title: "Balance updated", description: `New balance: Rs. ${parseFloat(res.creditBalance).toFixed(2)}` });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const action = async (url: string, method = "POST", body?: any) => {
    try {
      const result = await apiFetch(url, { method, body: body ? JSON.stringify(body) : undefined });
      qc.invalidateQueries({ queryKey: ["admin-client", id] });
      qc.invalidateQueries({ queryKey: ["admin-hosting"] });
      toast({ title: "Done", description: result.message || "Action completed." });
      return result;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const saveEdit = async () => {
    await action(`/api/admin/clients/${id}`, "PUT", editData);
    setEditing(false);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (!client) return <div className="p-8 text-center text-muted-foreground">Client not found.</div>;

  const fullName = `${client.firstName} ${client.lastName}`;
  const initials = `${client.firstName[0] ?? ""}${client.lastName[0] ?? ""}`;
  const orders = client.orders ?? [];

  const tabs: { id: Tab; icon: React.ElementType; label: string; count: number }[] = [
    { id: "services", icon: Server,       label: "Services",  count: client.hosting.length },
    { id: "domains",  icon: Globe,        label: "Domains",   count: client.domains.length },
    { id: "invoices", icon: FileText,     label: "Invoices",  count: client.invoices.length },
    { id: "tickets",  icon: MessageSquare, label: "Tickets",  count: client.tickets.length },
    { id: "orders",   icon: ShoppingCart, label: "Orders",    count: orders.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => setLocation("/admin/clients")} className="p-2 rounded-xl bg-secondary text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Client Profile</h2>
          <p className="text-muted-foreground text-sm">{fullName} · {client.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Client Info Card */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-[60px] pointer-events-none" />

            {/* Avatar + Status */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-purple-700 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-primary/20">
                {initials}
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">{fullName}</h3>
                <StatusBadge status={client.status} />
              </div>
            </div>

            {/* Fields (editable) */}
            {editing ? (
              <div className="space-y-3">
                {[["firstName", "First Name"], ["lastName", "Last Name"], ["email", "Email"], ["phone", "Phone"], ["company", "Company"], ["country", "Country"]].map(([k, label]) => (
                  <div key={k}>
                    <label className="text-xs text-muted-foreground">{label}</label>
                    <Input className="mt-1 h-8 text-sm bg-background" value={editData[k] ?? (client as any)[k] ?? ""} onChange={e => setEditData((d: any) => ({ ...d, [k]: e.target.value }))} />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-muted-foreground">Status</label>
                  <select className="w-full mt-1 h-8 px-2 text-sm rounded-md bg-background border border-border" value={editData.status ?? client.status} onChange={e => setEditData((d: any) => ({ ...d, status: e.target.value }))}>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="flex-1 bg-primary" onClick={saveEdit}>Save</Button>
                  <Button size="sm" variant="ghost" className="flex-1" onClick={() => { setEditing(false); setEditData({}); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                {[
                  { icon: Mail,     value: client.email },
                  { icon: Phone,    value: client.phone },
                  { icon: Building, value: client.company },
                  { icon: Globe,    value: client.country },
                  { icon: CreditCard, value: client.currency },
                  { icon: Calendar, value: `Joined ${format(new Date(client.createdAt), "MMM d, yyyy")}` },
                ].filter(r => r.value).map(({ icon: Icon, value }, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-foreground/80">
                    <Icon size={15} className="text-muted-foreground shrink-0" />
                    <span>{value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons */}
            {!editing && (
              <div className="mt-6 pt-5 border-t border-border grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setEditing(true); setEditData({ firstName: client.firstName, lastName: client.lastName, email: client.email, phone: client.phone, company: client.company, country: client.country, status: client.status }); }}>
                  <Edit2 size={13} /> Edit
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                  onClick={() => action(`/api/admin/clients/${id}/send-email`, "POST", { subject: "Message from Noehost", message: "Hello!" })}>
                  <Send size={13} /> Email
                </Button>
                {client.status === "active" ? (
                  <Button size="sm" variant="outline" className="gap-1.5 text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
                    onClick={() => action(`/api/admin/clients/${id}/suspend`, "POST")}>
                    <PauseCircle size={13} /> Suspend
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="gap-1.5 text-green-400 border-green-500/30 hover:bg-green-500/10"
                    onClick={() => action(`/api/admin/clients/${id}/activate`, "POST")}>
                    <PlayCircle size={13} /> Activate
                  </Button>
                )}
                <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => { if (confirm(`Delete ${fullName}? This cannot be undone.`)) action(`/api/admin/clients/${id}`, "DELETE").then(() => setLocation("/admin/clients")); }}>
                  <Trash2 size={13} /> Delete
                </Button>
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Services", value: client.hosting.length, color: "text-blue-400" },
              { label: "Invoices", value: client.invoices.length, color: "text-foreground" },
              { label: "Tickets", value: client.tickets.length, color: "text-orange-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-card border border-border rounded-xl p-3 text-center">
                <div className={`text-xl font-bold ${color}`}>{value}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Wallet / Credit Balance */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Wallet size={15} className="text-primary"/>
                </div>
                <span className="text-sm font-bold text-foreground">Account Wallet</span>
              </div>
              <div className="text-right">
                <p className="text-lg font-extrabold text-primary">
                  {formatPrice(parseFloat(creditData?.creditBalance ?? "0"))}
                </p>
                <p className="text-[10px] text-muted-foreground">Current Balance</p>
              </div>
            </div>

            {/* Adjust balance form */}
            <div className="space-y-2.5 pt-2 border-t border-border/50">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Adjust Balance</p>
              <div className="flex gap-1">
                {(["admin_add", "admin_deduct", "refund"] as const).map(t => (
                  <button key={t} onClick={() => setWalletType(t)}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${walletType === t ? "bg-primary text-white" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                    {t === "admin_add" ? "+ Add" : t === "admin_deduct" ? "− Deduct" : "↩ Refund"}
                  </button>
                ))}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-muted-foreground">Rs.</span>
                <Input value={walletAmt} onChange={e => setWalletAmt(e.target.value)} type="number" min={100} max={100000}
                  placeholder="Amount (100 – 1,00,000)" className="pl-10 h-9 text-sm bg-background"/>
              </div>
              <Input value={walletDesc} onChange={e => setWalletDesc(e.target.value)}
                placeholder="Reason (e.g. Promotional Credit)" className="h-9 text-sm bg-background"/>
              <Button size="sm" className="w-full bg-primary text-white text-xs"
                onClick={() => walletMutation.mutate()}
                disabled={walletMutation.isPending || !walletAmt || parseFloat(walletAmt) < 100}>
                {walletMutation.isPending ? <><Loader2 size={12} className="animate-spin mr-1"/> Processing…</> : "Apply Adjustment"}
              </Button>
            </div>

            {/* Recent credit transactions */}
            {(creditData?.transactions ?? []).length > 0 && (
              <div className="pt-2 border-t border-border/50 space-y-2">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Recent Transactions</p>
                {(creditData?.transactions ?? []).slice(0, 5).map((tx: any) => {
                  const isIn = ["admin_add", "affiliate_payout", "refund"].includes(tx.type);
                  return (
                    <div key={tx.id} className="flex items-center justify-between gap-2 text-[11px]">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{tx.description || tx.type}</p>
                        <p className="text-muted-foreground">{format(new Date(tx.createdAt), "MMM d, h:mm a")}</p>
                      </div>
                      <span className={`font-extrabold shrink-0 ${isIn ? "text-emerald-500" : "text-red-400"}`}>
                        {isIn ? "+" : "−"}Rs. {parseFloat(tx.amount).toFixed(0)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Tabs */}
        <div className="lg:col-span-2 space-y-5">
          {/* Tab bar */}
          <div className="flex gap-1 bg-secondary/50 border border-border rounded-xl p-1 overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelectedService(null); }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${activeTab === tab.id ? "bg-card text-foreground border border-border shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  <Icon size={14} /> {tab.label}
                  {tab.count > 0 && <span className="ml-0.5 bg-primary/10 text-primary rounded-full px-1.5 py-0.5 text-[10px] font-bold">{tab.count}</span>}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="bg-card border border-border rounded-2xl p-6 min-h-[400px]">

            {/* === SERVICES === */}
            {activeTab === "services" && !selectedService && (
              <div className="space-y-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-foreground">Hosting Services</h3>
                  <Button size="sm" className="bg-primary gap-1.5 h-8" onClick={() => setLocation(`/admin/clients/${id}/add-service`)}>
                    <Plus size={13} /> Add Service
                  </Button>
                </div>
                {client.hosting.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">No hosting services assigned.</div>
                ) : client.hosting.map(svc => (
                  <div key={svc.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-secondary/20 hover:border-primary/30 cursor-pointer transition-all group"
                    onClick={() => setSelectedService(svc)}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center"><Server size={18} className="text-muted-foreground" /></div>
                      <div>
                        <div className="font-semibold text-foreground">{svc.planName}</div>
                        <div className="text-xs text-primary font-mono">{svc.domain || "No domain"}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={svc.status} />
                      {svc.cancelRequested && <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-bold">CANCEL REQ</span>}
                      <ExternalLink size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* === SERVICE MANAGEMENT PANEL === */}
            {activeTab === "services" && selectedService && (
              <ServicePanel svc={selectedService} clientId={id!} onBack={() => setSelectedService(null)} onAction={action} />
            )}

            {/* === DOMAINS === */}
            {activeTab === "domains" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-foreground">Domains</h3>
                </div>
                {client.domains.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">No domains registered.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="pb-2 text-muted-foreground font-medium text-xs">Domain</th>
                          <th className="pb-2 text-muted-foreground font-medium text-xs">Status</th>
                          <th className="pb-2 text-muted-foreground font-medium text-xs">Registrar</th>
                          <th className="pb-2 text-muted-foreground font-medium text-xs">Expires</th>
                          <th className="pb-2 text-muted-foreground font-medium text-xs">Auto Renew</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {client.domains.map(d => (
                          <tr key={d.id} className="hover:bg-secondary/20 transition-colors">
                            <td className="py-3 font-mono text-sm font-medium">{d.name}{d.tld}</td>
                            <td className="py-3"><StatusBadge status={d.status} /></td>
                            <td className="py-3 text-muted-foreground text-xs">{d.registrar || "—"}</td>
                            <td className="py-3 text-xs text-muted-foreground">{d.expiryDate ? format(new Date(d.expiryDate), "MMM d, yyyy") : "—"}</td>
                            <td className="py-3">
                              <span className={`text-xs font-medium ${d.autoRenew ? "text-green-400" : "text-red-400"}`}>{d.autoRenew ? "Yes" : "No"}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* === INVOICES === */}
            {activeTab === "invoices" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-foreground">Invoices</h3>
                  <Button size="sm" className="bg-primary gap-1.5 h-8" onClick={() => setLocation("/admin/invoices/add")}>
                    <Plus size={13} /> Create Invoice
                  </Button>
                </div>
                {client.invoices.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">No invoices found.</div>
                ) : client.invoices.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-secondary/20 hover:border-border transition-colors">
                    <div>
                      <div className="font-mono text-xs text-primary">{inv.invoiceNumber}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Due {format(new Date(inv.dueDate), "MMM d, yyyy")}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{formatPrice(Number(inv.total || inv.amount))}</span>
                      <StatusBadge status={inv.status} />
                      {inv.status === "unpaid" && (
                        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1 text-green-400 border-green-500/30 hover:bg-green-500/10"
                          onClick={() => action(`/api/admin/invoices/${inv.id}/pay`, "POST")}>
                          <CheckCircle size={12} /> Mark Paid
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* === TICKETS === */}
            {activeTab === "tickets" && (
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground mb-4">Support Tickets</h3>
                {client.tickets.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">No support tickets.</div>
                ) : client.tickets.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-secondary/20 hover:border-border cursor-pointer transition-colors"
                    onClick={() => setLocation(`/admin/tickets/${t.id}`)}>
                    <div>
                      <div className="font-medium text-foreground">{t.subject}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">#{t.ticketNumber} · {t.department} · {format(new Date(t.createdAt), "MMM d, yyyy")}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={t.status} />
                      <ExternalLink size={14} className="text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* === ORDERS === */}
            {activeTab === "orders" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-foreground">Orders</h3>
                  <Button size="sm" className="bg-primary gap-1.5 h-8" onClick={() => setLocation("/admin/orders/add")}>
                    <Plus size={13} /> Add Order
                  </Button>
                </div>
                {orders.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">No orders found.</div>
                ) : orders.map(o => (
                  <div key={o.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-secondary/20 hover:border-border transition-colors">
                    <div>
                      <div className="font-medium text-foreground">{o.itemName}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 font-mono">#{o.id.slice(0, 8).toUpperCase()} · {format(new Date(o.createdAt), "MMM d, yyyy")}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{formatPrice(Number(o.amount))}</span>
                      <StatusBadge status={o.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Service Management Panel ────────────────────────────────────────────────
function ServicePanel({ svc, clientId, onBack, onAction }: { svc: any; clientId: string; onBack: () => void; onAction: (url: string, method?: string, body?: any) => Promise<any> }) {
  const { toast } = useToast();
  const [ssoLoading, setSsoLoading] = useState<"cpanel" | "webmail" | null>(null);

  const handleSsoLogin = async (type: "cpanel" | "webmail") => {
    setSsoLoading(type);
    try {
      const endpoint = type === "cpanel"
        ? `/api/admin/hosting/${svc.id}/cpanel-login`
        : `/api/admin/hosting/${svc.id}/webmail-login`;
      const result = await apiFetch(endpoint, { method: "POST" });
      if (result.url) window.open(result.url, "_blank");
    } catch (err: any) {
      toast({ title: `${type === "cpanel" ? "cPanel" : "Webmail"} login failed`, description: err.message, variant: "destructive" });
    } finally {
      setSsoLoading(null);
    }
  };

  const btn = (label: string, icon: React.ElementType, colorCls: string, onClick: () => void) => {
    const Icon = icon;
    return (
      <button key={label} onClick={onClick}
        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all hover:opacity-90 ${colorCls}`}>
        <Icon size={15} /> {label}
      </button>
    );
  };

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
        <ArrowLeft size={15} /> Back to services
      </button>

      {/* Service header */}
      <div className="flex items-start justify-between gap-4 mb-6 p-4 bg-secondary/30 rounded-xl border border-border/50">
        <div>
          <h3 className="font-bold text-lg text-foreground">{svc.planName}</h3>
          <div className="text-primary font-mono text-sm mt-0.5">{svc.domain || "No domain"}</div>
        </div>
        <StatusBadge status={svc.status} />
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Server", value: svc.serverHostname || "Default" },
          { label: "Package", value: svc.planName },
          { label: "Billing Cycle", value: svc.billingCycle || "monthly" },
          { label: "Next Due", value: svc.nextDueDate ? format(new Date(svc.nextDueDate), "MMM d, yyyy") : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-background rounded-xl p-3 border border-border/50">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="font-medium text-sm mt-1 truncate">{value}</div>
          </div>
        ))}
      </div>

      {svc.cancelRequested && (
        <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-sm text-red-400">
          <AlertTriangle size={16} /> Cancellation requested: {svc.cancelReason || "No reason given"}
        </div>
      )}

      {/* Action buttons */}
      <div className="mb-4">
        <div className="text-xs font-medium text-muted-foreground mb-2">cPanel / Hosting</div>
        <div className="flex flex-wrap gap-2">
          {btn(
            ssoLoading === "cpanel" ? "Connecting..." : "Login to cPanel",
            ExternalLink,
            svc.status === "active" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-secondary text-muted-foreground border-border opacity-50",
            () => { if (svc.status === "active" && !ssoLoading) handleSsoLogin("cpanel"); },
          )}
          {btn(
            ssoLoading === "webmail" ? "Connecting..." : "Login to Webmail",
            Mail,
            svc.status === "active" ? "bg-violet-500/10 text-violet-400 border-violet-500/20" : "bg-secondary text-muted-foreground border-border opacity-50",
            () => { if (svc.status === "active" && !ssoLoading) handleSsoLogin("webmail"); },
          )}
          {btn("Change Password", Key, "bg-secondary text-foreground border-border", () => {
            const pw = prompt("New password:"); if (pw) onAction(`/api/admin/hosting/${svc.id}/change-password`, "POST", { password: pw });
          })}
          {btn("Activate SSL", Shield, "bg-green-500/10 text-green-400 border-green-500/20", () => onAction(`/api/admin/hosting/${svc.id}/activate-ssl`, "POST"))}
          {svc.status === "active" && btn("Resend Welcome Email", Send, "bg-indigo-500/10 text-indigo-400 border-indigo-500/20", () => onAction(`/api/admin/hosting/${svc.id}/resend-welcome`, "POST"))}
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs font-medium text-muted-foreground mb-2">Account Management</div>
        <div className="flex flex-wrap gap-2">
          {svc.status === "pending" && btn("Create Account", Zap, "bg-blue-500/10 text-blue-400 border-blue-500/20", () => onAction(`/api/admin/hosting/${svc.id}/provision`, "POST"))}
          {btn("Resend Verification Email", Mail, "bg-teal-500/10 text-teal-400 border-teal-500/20", () => onAction(`/api/admin/clients/${clientId}/resend-verification`, "POST"))}
          {svc.status !== "suspended" && svc.status !== "terminated" && btn("Suspend", PauseCircle, "bg-orange-500/10 text-orange-400 border-orange-500/20", () => { if (confirm("Suspend this account?")) onAction(`/api/admin/hosting/${svc.id}/suspend`, "POST"); })}
          {svc.status === "suspended" && btn("Unsuspend", PlayCircle, "bg-green-500/10 text-green-400 border-green-500/20", () => onAction(`/api/admin/hosting/${svc.id}/unsuspend`, "POST"))}
          {svc.status !== "terminated" && btn("Terminate", XCircle, "bg-red-500/10 text-red-400 border-red-500/20", () => { if (confirm("Terminate this account? Irreversible.")) onAction(`/api/admin/hosting/${svc.id}/terminate`, "POST"); })}
        </div>
      </div>

      <div>
        <div className="text-xs font-medium text-muted-foreground mb-2">Plan</div>
        <div className="flex flex-wrap gap-2">
          {btn("Upgrade Plan", TrendingUp, "bg-secondary text-foreground border-border", () => toast({ title: "Upgrade", description: "Go to Packages to change the plan." }))}
          {btn("Downgrade Plan", TrendingDown, "bg-secondary text-foreground border-border", () => toast({ title: "Downgrade", description: "Go to Packages to change the plan." }))}
          {svc.cancelRequested && btn("Approve Cancel", CheckCircle, "bg-red-500/10 text-red-400 border-red-500/20", () => { if (confirm("Approve cancellation?")) onAction(`/api/admin/hosting/${svc.id}/cancel`, "POST"); })}
        </div>
      </div>
    </div>
  );
}

