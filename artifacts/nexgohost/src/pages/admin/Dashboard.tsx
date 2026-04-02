import { useGetAdminDashboard } from "@workspace/api-client-react";
import { Users, Server, Globe, DollarSign, Activity, Ticket as TicketIcon, ShieldAlert, AlertCircle, Mail, PauseCircle, RefreshCw, CheckCircle, XCircle, TrendingUp, UserPlus, ShoppingCart, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { AreaChart, Area, Tooltip, ResponsiveContainer, XAxis, YAxis, CartesianGrid } from "recharts";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useCurrency } from "@/context/CurrencyProvider";

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Request failed"); }
  return res.json();
}

interface WaLog { id: string; eventType: string; message: string; status: string; sentAt: string; }
interface WaStatus { status: string; phone: string | null; }

const EVENT_LABELS: Record<string, string> = {
  new_order: "New Order", new_ticket: "New Ticket", payment_proof: "Payment Proof", test: "Test", other: "Alert",
};

function WaLiveLog() {
  const { data: waStatus } = useQuery<WaStatus>({
    queryKey: ["dash-wa-status"],
    queryFn: () => apiFetch("/api/admin/whatsapp/status"),
    refetchInterval: 10000,
  });
  const { data: logs = [] } = useQuery<WaLog[]>({
    queryKey: ["dash-wa-logs"],
    queryFn: () => apiFetch("/api/admin/whatsapp/logs?limit=5"),
    refetchInterval: 10000,
  });

  const isConnected = waStatus?.status === "connected";

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <MessageCircle size={15} style={{ color: "#25D366" }} />
          <span className="font-semibold text-foreground text-sm">WhatsApp Live Log</span>
          <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 shadow-[0_0_5px_#22c55e]" : "bg-muted-foreground/30"}`} />
          <span className="text-xs text-muted-foreground">
            {isConnected ? `Connected — +${waStatus?.phone}` : "Not connected"}
          </span>
        </div>
        <a href="/admin/whatsapp" className="text-xs text-primary hover:underline">Configure →</a>
      </div>
      {logs.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          No alerts sent yet · <a href="/admin/whatsapp" className="text-primary hover:underline">Connect WhatsApp</a>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {logs.slice(0, 5).map(log => (
            <div key={log.id} className="px-5 py-2.5 flex items-center gap-3">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${log.status === "sent" ? "bg-emerald-500" : "bg-red-500"}`} />
              <span className="text-xs text-muted-foreground font-medium flex-shrink-0 w-24">{EVENT_LABELS[log.eventType] ?? log.eventType}</span>
              <span className="text-xs text-foreground truncate flex-1">{log.message.split("\n")[0]}</span>
              <span className="text-[10px] text-muted-foreground flex-shrink-0">{format(new Date(log.sentAt), "dd MMM HH:mm")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const { data: stats, isLoading } = useGetAdminDashboard();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { formatPrice } = useCurrency();
  const [runningCron, setRunningCron] = useState(false);

  const handleRunCron = async () => {
    setRunningCron(true);
    try {
      await apiFetch("/api/admin/cron/run", { method: "POST" });
      toast({ title: "Automation triggered", description: "All cron tasks are now running." });
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] }), 3000);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setRunningCron(false); }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!stats) return null;

  const s = stats as any;

  const statCards = [
    { title: "Total Clients",    value: s.totalClients ?? 0,         icon: Users,       color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20",    trend: `+${s.newClientsMonth ?? 0} this month` },
    { title: "Active Hosting",   value: s.activeHosting ?? 0,         icon: Server,      color: "text-green-400",   bg: "bg-green-500/10",   border: "border-green-500/20",   trend: `${s.suspendedHosting ?? 0} suspended` },
    { title: "Total Domains",    value: s.totalDomains ?? 0,          icon: Globe,       color: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/20",  trend: "registered domains" },
    { title: "Monthly Revenue",  value: formatPrice(s.monthlyRevenue ?? 0), icon: DollarSign,  color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", trend: `${formatPrice(s.totalRevenue ?? 0)} lifetime` },
    { title: "Pending Orders",   value: s.pendingOrders ?? 0,         icon: ShoppingCart, color: "text-yellow-400", bg: "bg-yellow-500/10",  border: "border-yellow-500/20",  trend: "awaiting review" },
    { title: "Invoices Due",     value: s.invoicesDue ?? 0,           icon: AlertCircle, color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/20",  trend: "in next 7 days" },
    { title: "Open Tickets",     value: s.openTickets ?? 0,           icon: TicketIcon,  color: "text-pink-400",    bg: "bg-pink-500/10",    border: "border-pink-500/20",    trend: "support tickets" },
    { title: "Emails Sent",      value: s.emailsSent ?? 0,            icon: Mail,        color: "text-teal-400",    bg: "bg-teal-500/10",    border: "border-teal-500/20",    trend: "total sent" },
  ];

  const chartData = (s.revenueByDay ?? []).slice(-14);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-xl">
          <p className="text-xs text-muted-foreground mb-1">{label}</p>
          <p className="text-sm font-bold text-primary">{formatPrice(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground tracking-tight">Overview</h2>
          <p className="text-muted-foreground mt-1">Welcome back — here's what's happening today.</p>
        </div>
        <button
          onClick={handleRunCron}
          disabled={runningCron}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-sm font-medium transition-all disabled:opacity-60"
        >
          <RefreshCw size={15} className={runningCron ? "animate-spin" : ""} />
          {runningCron ? "Running..." : "Run Automation"}
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <div
            key={i}
            className={`bg-card rounded-2xl p-5 border ${stat.border} shadow-lg shadow-black/5 hover:-translate-y-1 transition-all duration-300 group`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2.5 rounded-xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                <stat.icon size={18} />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-foreground">{stat.value}</h3>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">{stat.title}</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">{stat.trend}</p>
          </div>
        ))}
      </div>

      {/* Revenue Chart + Recent Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-xl shadow-black/10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold font-display flex items-center gap-2">
                <TrendingUp size={18} className="text-primary" />
                Revenue Overview
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Last 14 days</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">This Month</p>
              <p className="text-lg font-bold text-primary">{formatPrice(s.monthlyRevenue ?? 0)}</p>
            </div>
          </div>
          <div className="h-[260px] w-full">
            {chartData.length > 0 && chartData.some((d: any) => d.revenue > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatPrice(v).split(".")[0]}
                    width={70}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <TrendingUp size={40} className="opacity-20 mb-3" />
                <p className="text-sm">No revenue data yet for the last 14 days</p>
                <p className="text-xs mt-1 opacity-60">Revenue will appear here as invoices are paid</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl shadow-black/10 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus size={16} className="text-blue-400" />
            <h3 className="text-lg font-bold font-display">Recent Signups</h3>
          </div>
          <div className="flex-1 space-y-2">
            {s.recentClients?.slice(0, 6).map((client: any) => (
              <div key={client.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/50 transition-colors group">
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm border border-primary/20 group-hover:border-primary/40 transition-colors shrink-0">
                  {client.firstName[0]}{client.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{client.firstName} {client.lastName}</p>
                  <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                </div>
                <p className="text-[10px] text-muted-foreground shrink-0">
                  {format(new Date(client.createdAt), "MMM d")}
                </p>
              </div>
            ))}
            {(!s.recentClients || s.recentClients.length === 0) && (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Users size={32} className="opacity-20 mb-2" />
                <p className="text-sm">No clients yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Orders + Automation Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {s.recentOrders?.length > 0 && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl shadow-black/10">
            <div className="p-5 border-b border-border flex items-center gap-2 bg-secondary/30">
              <ShoppingCart size={16} className="text-primary" />
              <h3 className="text-base font-bold font-display">Recent Orders</h3>
            </div>
            <div className="divide-y divide-border/50">
              {s.recentOrders.slice(0, 5).map((order: any) => (
                <div key={order.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary/20 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{order.itemName}</p>
                    <p className="text-xs text-muted-foreground">{order.clientName} · {format(new Date(order.createdAt), "MMM d, yyyy")}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className="text-sm font-bold text-foreground">{formatPrice(Number(order.amount))}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      order.status === "approved" ? "bg-green-500/10 text-green-400 border-green-500/20"
                      : order.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200"
                      : order.status === "fraud" ? "bg-red-50 text-red-600 border-red-200"
                      : "bg-secondary text-muted-foreground border-border"
                    }`}>{order.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {s.recentCronLogs?.length > 0 && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl shadow-black/10">
            <div className="p-5 border-b border-border flex items-center gap-2 bg-secondary/30">
              <Activity size={16} className="text-teal-400" />
              <h3 className="text-base font-bold font-display">Automation Logs</h3>
            </div>
            <div className="divide-y divide-border/50">
              {s.recentCronLogs.slice(0, 5).map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-secondary/20 transition-colors">
                  {log.status === "success"
                    ? <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
                    : log.status === "failed"
                    ? <XCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                    : <RefreshCw size={14} className="text-muted-foreground mt-0.5 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono text-primary truncate">{log.task}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{format(new Date(log.executedAt), "MMM d, HH:mm")}</span>
                    </div>
                    {log.message && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{log.message}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* WhatsApp Live Alert Log */}
      <WaLiveLog />

      {/* Quick Stats Bottom Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Suspended Services", value: s.suspendedHosting ?? 0, icon: PauseCircle, color: "text-orange-400" },
          { label: "Fraud Orders", value: s.fraudOrders ?? 0, icon: ShieldAlert, color: "text-red-400" },
          { label: "Active Migrations", value: s.activeMigrations ?? 0, icon: Activity, color: "text-cyan-400" },
          { label: "New Clients (Month)", value: s.newClientsMonth ?? 0, icon: UserPlus, color: "text-violet-400" },
        ].map((item, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <item.icon size={14} className={item.color} />
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
