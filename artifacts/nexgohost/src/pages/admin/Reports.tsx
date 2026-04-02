import { useQuery } from "@tanstack/react-query";
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, Users,
  Server, Globe, ShoppingCart, FileText, Loader2,
} from "lucide-react";
import { useCurrency } from "@/context/CurrencyProvider";

async function apiFetch(url: string) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

interface DashboardData {
  totalRevenue: number;
  totalClients: number;
  activeHosting: number;
  totalDomains: number;
  openTickets: number;
  pendingOrders: number;
  monthlyRevenue: number;
  recentOrders: Array<{ id: string; itemName: string; clientName: string; amount: number; status: string; createdAt: string }>;
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
  const { formatPrice } = useCurrency();

  const { data: raw, isLoading } = useQuery<DashboardData>({
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

  const stats = raw ?? { totalRevenue: 0, totalClients: 0, activeHosting: 0, totalDomains: 0, openTickets: 0, pendingOrders: 0, monthlyRevenue: 0, recentOrders: [] };
  const orders = stats.recentOrders ?? [];

  const metrics = [
    { label: "Total Revenue",   value: formatPrice(Number(stats.totalRevenue)),   icon: DollarSign, trend: "+12%", up: true },
    { label: "Monthly Revenue", value: formatPrice(Number(stats.monthlyRevenue)),  icon: TrendingUp, trend: "this month", up: true },
    { label: "Total Clients",   value: stats.totalClients,   icon: Users,      trend: "+5%", up: true },
    { label: "Active Hosting",  value: stats.activeHosting,  icon: Server,     trend: "+3%", up: true },
    { label: "Open Tickets",    value: stats.openTickets,    icon: FileText,   trend: "-8%", up: false },
    { label: "Pending Orders",  value: stats.pendingOrders,  icon: ShoppingCart, trend: "+2%", up: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-display font-bold text-foreground">Reports</h2>
        <p className="text-muted-foreground mt-1">Business overview and key performance metrics.</p>
      </div>

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
              <div className="text-xl font-bold text-foreground">{m.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{m.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 size={18} className="text-primary" />
            <h3 className="font-semibold text-foreground">Revenue Summary</h3>
          </div>
          <div className="space-y-5">
            {[
              { label: "Total Collected", value: formatPrice(Number(stats.totalRevenue)), color: "bg-violet-500", icon: DollarSign, iconColor: "text-violet-400" },
              { label: "This Month",      value: formatPrice(Number(stats.monthlyRevenue)), color: "bg-green-500", icon: TrendingUp, iconColor: "text-green-400" },
            ].map(item => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-secondary flex items-center justify-center`}>
                      <Icon size={16} className={item.iconColor} />
                    </div>
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">{item.value}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <ShoppingCart size={18} className="text-primary" />
            <h3 className="font-semibold text-foreground">Recent Orders</h3>
          </div>
          {orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No orders yet.</div>
          ) : (
            <div className="space-y-2">
              {orders.slice(0, 6).map(order => (
                <div key={order.id} className="flex items-center justify-between py-1.5">
                  <div>
                    <div className="text-sm font-medium text-foreground truncate max-w-[160px]">{order.itemName}</div>
                    <div className="text-xs text-muted-foreground">{order.clientName}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{formatPrice(Number(order.amount))}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      order.status === "approved" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                      order.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200" :
                      "bg-red-50 text-red-600 border-red-200"
                    }`}>{order.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active Services", value: stats.activeHosting,  color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20" },
          { label: "Registered Domains",  value: stats.totalDomains,   color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
          { label: "Total Clients",    value: stats.totalClients,   color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} border rounded-2xl p-5 text-center`}>
            <div className={`text-4xl font-bold ${color}`}>{value}</div>
            <div className="text-sm text-muted-foreground mt-1">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
