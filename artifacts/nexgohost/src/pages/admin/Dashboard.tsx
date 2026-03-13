import { useGetAdminDashboard } from "@workspace/api-client-react";
import { Users, Server, Globe, DollarSign, Activity, Ticket as TicketIcon, ShieldAlert, AlertCircle, Mail, PauseCircle, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { AreaChart, Area, Tooltip, ResponsiveContainer } from "recharts";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const mockChartData = [
  { name: 'Mon', revenue: 4000 },
  { name: 'Tue', revenue: 3000 },
  { name: 'Wed', revenue: 2000 },
  { name: 'Thu', revenue: 2780 },
  { name: 'Fri', revenue: 1890 },
  { name: 'Sat', revenue: 2390 },
  { name: 'Sun', revenue: 3490 },
];

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Request failed"); }
  return res.json();
}

export default function AdminDashboard() {
  const { data: stats, isLoading } = useGetAdminDashboard();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [runningCron, setRunningCron] = useState(false);

  const handleRunCron = async () => {
    setRunningCron(true);
    try {
      await apiFetch("/api/admin/cron/run", { method: "POST" });
      toast({ title: "Cron tasks triggered", description: "All automation tasks are now running." });
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] }), 3000);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setRunningCron(false); }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  if (!stats) return null;

  const s = stats as any;

  const statCards = [
    { title: "Total Clients", value: s.totalClients ?? 0, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
    { title: "Total Services", value: s.totalServices ?? 0, icon: Server, color: "text-indigo-500", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
    { title: "Active Hosting", value: s.activeHosting ?? 0, icon: Server, color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/20" },
    { title: "Suspended", value: s.suspendedHosting ?? 0, icon: PauseCircle, color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20" },
    { title: "Total Domains", value: s.totalDomains ?? 0, icon: Globe, color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20" },
    { title: "Invoices Due", value: s.invoicesDue ?? 0, icon: AlertCircle, color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
    { title: "Fraud Orders", value: s.fraudOrders ?? 0, icon: ShieldAlert, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" },
    { title: "Emails Sent", value: s.emailsSent ?? 0, icon: Mail, color: "text-teal-500", bg: "bg-teal-500/10", border: "border-teal-500/20" },
    { title: "Monthly Revenue", value: `$${(s.monthlyRevenue ?? 0).toFixed(2)}`, icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    { title: "Open Tickets", value: s.openTickets ?? 0, icon: TicketIcon, color: "text-pink-500", bg: "bg-pink-500/10", border: "border-pink-500/20" },
    { title: "Active Migrations", value: s.activeMigrations ?? 0, icon: Activity, color: "text-cyan-500", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground tracking-tight">Overview</h2>
          <p className="text-muted-foreground mt-1">Here's what's happening with Nexgohost today.</p>
        </div>
        <button
          onClick={handleRunCron}
          disabled={runningCron}
          className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-sm font-medium transition-all disabled:opacity-60"
        >
          <RefreshCw size={15} className={runningCron ? "animate-spin" : ""} />
          {runningCron ? "Running..." : "Run Automation Now"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <div key={i} className={`bg-card rounded-2xl p-5 border ${stat.border} shadow-lg shadow-black/5 hover:-translate-y-1 transition-transform duration-300`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.title}</p>
                <h3 className="text-2xl font-bold text-foreground mt-1.5">{stat.value}</h3>
              </div>
              <div className={`p-2.5 rounded-xl ${stat.bg} ${stat.color}`}>
                <stat.icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-xl shadow-black/10">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold font-display">Revenue Overview</h3>
            <span className="px-3 py-1 rounded-full bg-secondary text-xs text-muted-foreground">Last 7 Days</span>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockChartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} itemStyle={{ color: 'hsl(var(--foreground))' }} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl shadow-black/10 flex flex-col">
          <h3 className="text-lg font-bold font-display mb-4">Recent Registrations</h3>
          <div className="flex-1 space-y-3">
            {s.recentClients?.slice(0, 5).map((client: any) => (
              <div key={client.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/50 transition-colors">
                <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm border border-primary/20">
                  {client.firstName[0]}{client.lastName[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{client.firstName} {client.lastName}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(client.createdAt), 'MMM d, yyyy')}</p>
                </div>
              </div>
            ))}
            {(!s.recentClients || s.recentClients.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No recent clients</p>
            )}
          </div>
        </div>
      </div>

      {s.recentCronLogs?.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl shadow-black/10">
          <h3 className="text-lg font-bold font-display mb-4">Automation Logs</h3>
          <div className="space-y-2">
            {s.recentCronLogs.slice(0, 8).map((log: any) => (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/30 border border-border/50">
                {log.status === "success"
                  ? <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
                  : log.status === "failed"
                  ? <XCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                  : <RefreshCw size={14} className="text-muted-foreground mt-0.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-mono text-primary truncate">{log.task}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{format(new Date(log.executedAt), 'MMM d, HH:mm')}</span>
                  </div>
                  {log.message && <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.message}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {s.recentOrders?.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl shadow-black/10">
          <h3 className="text-lg font-bold font-display mb-4">Recent Orders</h3>
          <div className="space-y-2">
            {s.recentOrders.slice(0, 5).map((order: any) => (
              <div key={order.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/50">
                <div>
                  <p className="text-sm font-medium text-foreground">{order.itemName}</p>
                  <p className="text-xs text-muted-foreground">{order.clientName} · {format(new Date(order.createdAt), 'MMM d, yyyy')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-foreground">${Number(order.amount).toFixed(2)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                    order.status === "active" ? "bg-green-500/10 text-green-400 border-green-500/20"
                    : order.status === "pending" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                    : order.status === "fraud" ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : "bg-secondary text-muted-foreground border-border"
                  }`}>{order.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
