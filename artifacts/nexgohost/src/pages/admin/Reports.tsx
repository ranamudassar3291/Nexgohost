import { useQuery } from "@tanstack/react-query";
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, Users,
  Server, Globe, ShoppingCart, FileText, Loader2, ArrowUpRight,
} from "lucide-react";

async function apiFetch(url: string) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

interface DashboardData {
  stats: { totalRevenue: number; totalClients: number; activeHosting: number; activeDomains: number; openTickets: number; pendingOrders: number };
  recentInvoices: Array<{ id: string; invoiceNumber: string; clientName: string; amount: string; status: string; createdAt: string }>;
}

const METRIC_COLORS = [
  "from-violet-500/20 to-violet-500/5 border-violet-500/20 text-violet-400",
  "from-blue-500/20 to-blue-500/5 border-blue-500/20 text-blue-400",
  "from-green-500/20 to-green-500/5 border-green-500/20 text-green-400",
  "from-orange-500/20 to-orange-500/5 border-orange-500/20 text-orange-400",
  "from-pink-500/20 to-pink-500/5 border-pink-500/20 text-pink-400",
  "from-cyan-500/20 to-cyan-500/5 border-cyan-500/20 text-cyan-400",
];

export default function AdminReports() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["admin-reports"],
    queryFn: () => apiFetch("/api/admin/dashboard"),
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const stats = data?.stats ?? { totalRevenue: 0, totalClients: 0, activeHosting: 0, activeDomains: 0, openTickets: 0, pendingOrders: 0 };
  const invoices = data?.recentInvoices ?? [];

  const metrics = [
    { label: "Total Revenue", value: `$${Number(stats.totalRevenue).toFixed(2)}`, icon: DollarSign, trend: "+12%", up: true },
    { label: "Total Clients", value: stats.totalClients, icon: Users, trend: "+5%", up: true },
    { label: "Active Hosting", value: stats.activeHosting, icon: Server, trend: "+3%", up: true },
    { label: "Active Domains", value: stats.activeDomains, icon: Globe, trend: "0%", up: true },
    { label: "Open Tickets", value: stats.openTickets, icon: FileText, trend: "-8%", up: false },
    { label: "Pending Orders", value: stats.pendingOrders, icon: ShoppingCart, trend: "+2%", up: true },
  ];

  const paidInvoices = invoices.filter(i => i.status === "paid");
  const unpaidInvoices = invoices.filter(i => i.status === "unpaid");
  const paidRevenue = paidInvoices.reduce((s, i) => s + Number(i.amount), 0);
  const unpaidRevenue = unpaidInvoices.reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-display font-bold text-foreground">Reports</h2>
        <p className="text-muted-foreground mt-1">Business overview and key performance metrics.</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {metrics.map((m, i) => {
          const Icon = m.icon;
          const Trend = m.up ? TrendingUp : TrendingDown;
          return (
            <div key={m.label} className={`bg-gradient-to-b ${METRIC_COLORS[i]} border rounded-2xl p-4`}>
              <div className="flex items-center justify-between mb-2">
                <Icon size={18} className="opacity-70" />
                <span className={`text-xs font-medium flex items-center gap-0.5 ${m.up ? "text-green-400" : "text-red-400"}`}>
                  <Trend size={11} /> {m.trend}
                </span>
              </div>
              <div className="text-2xl font-bold text-foreground">{m.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{m.label}</div>
            </div>
          );
        })}
      </div>

      {/* Revenue breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 size={18} className="text-primary" />
            <h3 className="font-semibold text-foreground">Revenue Breakdown</h3>
          </div>
          <div className="space-y-4">
            {[
              { label: "Collected (Paid)", amount: paidRevenue, pct: stats.totalRevenue ? (paidRevenue / stats.totalRevenue) * 100 : 0, color: "bg-green-500" },
              { label: "Outstanding (Unpaid)", amount: unpaidRevenue, pct: stats.totalRevenue ? (unpaidRevenue / stats.totalRevenue) * 100 : 0, color: "bg-yellow-500" },
            ].map(({ label, amount, pct, color }) => (
              <div key={label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">${amount.toFixed(2)}</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-border flex justify-between text-sm">
            <span className="text-muted-foreground">Total Invoiced</span>
            <span className="font-bold text-foreground">${(paidRevenue + unpaidRevenue).toFixed(2)}</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <FileText size={18} className="text-primary" />
            <h3 className="font-semibold text-foreground">Recent Invoices</h3>
          </div>
          {invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No invoices yet.</div>
          ) : (
            <div className="space-y-2">
              {invoices.slice(0, 8).map(inv => (
                <div key={inv.id} className="flex items-center justify-between py-1.5">
                  <div>
                    <div className="text-sm font-mono text-primary text-xs">{inv.invoiceNumber}</div>
                    <div className="text-xs text-muted-foreground">{inv.clientName}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">${Number(inv.amount).toFixed(2)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      inv.status === "paid" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                      inv.status === "unpaid" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                      "bg-red-500/10 text-red-400 border-red-500/20"
                    }`}>{inv.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Invoice status summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Paid Invoices", value: paidInvoices.length, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
          { label: "Unpaid Invoices", value: unpaidInvoices.length, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
          { label: "Total Invoices", value: invoices.length, color: "text-foreground", bg: "bg-secondary/50 border-border" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} border rounded-xl p-4 text-center`}>
            <div className={`text-3xl font-bold ${color}`}>{value}</div>
            <div className="text-sm text-muted-foreground mt-1">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
