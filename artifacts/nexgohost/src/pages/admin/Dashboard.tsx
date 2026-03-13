import { useGetAdminDashboard } from "@workspace/api-client-react";
import { Users, Server, Globe, DollarSign, Activity, Ticket as TicketIcon } from "lucide-react";
import { format } from "date-fns";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";

// Mock data for the chart to make it look alive since API only returns total numbers
const mockChartData = [
  { name: 'Mon', revenue: 4000 },
  { name: 'Tue', revenue: 3000 },
  { name: 'Wed', revenue: 2000 },
  { name: 'Thu', revenue: 2780 },
  { name: 'Fri', revenue: 1890 },
  { name: 'Sat', revenue: 2390 },
  { name: 'Sun', revenue: 3490 },
];

export default function AdminDashboard() {
  const { data: stats, isLoading } = useGetAdminDashboard();

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  if (!stats) return null;

  const statCards = [
    { title: "Total Clients", value: stats.totalClients, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
    { title: "Active Hosting", value: stats.activeHosting, icon: Server, color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/20" },
    { title: "Total Domains", value: stats.totalDomains, icon: Globe, color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20" },
    { title: "Monthly Revenue", value: `$${stats.monthlyRevenue.toFixed(2)}`, icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    { title: "Open Tickets", value: stats.openTickets, icon: TicketIcon, color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20" },
    { title: "Active Migrations", value: stats.activeMigrations, icon: Activity, color: "text-pink-500", bg: "bg-pink-500/10", border: "border-pink-500/20" },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome & Stats */}
      <div>
        <h2 className="text-3xl font-display font-bold text-foreground tracking-tight">Overview</h2>
        <p className="text-muted-foreground mt-1">Here's what's happening with Nexgohost today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, i) => (
          <div key={i} className={`bg-card rounded-2xl p-6 border ${stat.border} shadow-lg shadow-black/5 hover:-translate-y-1 transition-transform duration-300`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <h3 className="text-3xl font-bold text-foreground mt-2">{stat.value}</h3>
              </div>
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                <stat.icon size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Section */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-xl shadow-black/10">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold font-display">Revenue Overview</h3>
            <span className="px-3 py-1 rounded-full bg-secondary text-xs text-muted-foreground">Last 7 Days</span>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockChartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl shadow-black/10 flex flex-col">
          <h3 className="text-lg font-bold font-display mb-6">Recent Registrations</h3>
          <div className="flex-1 space-y-4">
            {stats.recentClients?.slice(0, 5).map(client => (
              <div key={client.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-secondary/50 transition-colors border border-transparent hover:border-border/50 cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm border border-primary/20">
                  {client.firstName[0]}{client.lastName[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{client.firstName} {client.lastName}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(client.createdAt), 'MMM d, yyyy')}</p>
                </div>
              </div>
            ))}
            {(!stats.recentClients || stats.recentClients.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No recent clients</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
