import { useGetClientDashboard, useGetMe } from "@workspace/api-client-react";
import { Server, Globe, FileText, Ticket, ShoppingCart, Clock, CheckCircle2, DollarSign } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

interface Order {
  id: string; itemName: string; amount: number; billingCycle: string;
  status: string; paymentStatus: string; createdAt: string; type: string; domain: string | null;
}

async function apiFetch(url: string) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

const orderStatusColors: Record<string, string> = {
  pending:   "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  approved:  "bg-green-500/10 text-green-400 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  suspended: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

export default function ClientDashboard() {
  const { data: stats, isLoading } = useGetClientDashboard();
  const { data: user } = useGetMe();
  const [, navigate] = useLocation();

  const { data: recentOrders = [] } = useQuery<Order[]>({
    queryKey: ["my-orders-dashboard"],
    queryFn: () => apiFetch("/api/orders").then(d => (d || []).slice(0, 5)),
  });

  if (isLoading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (!stats) return null;

  const cards = [
    { title: "Active Services", value: stats.activeServices, icon: Server, link: "/client/hosting", color: "text-blue-400" },
    { title: "Domains", value: stats.activeDomains, icon: Globe, link: "/client/domains", color: "text-purple-400" },
    { title: "Unpaid Invoices", value: stats.unpaidInvoices, icon: FileText, link: "/client/invoices", color: "text-red-400", highlight: stats.unpaidInvoices > 0 },
    { title: "Open Tickets", value: stats.openTickets, icon: Ticket, link: "/client/tickets", color: "text-orange-400" },
  ];

  const pendingOrders = recentOrders.filter(o => o.status === "pending").length;

  return (
    <div className="space-y-8">
      {/* Hero banner */}
      <div className="bg-gradient-to-r from-primary/20 via-purple-600/10 to-transparent border border-primary/10 rounded-3xl p-8 relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[80px]" />
        <div className="relative z-10">
          <h2 className="text-3xl font-display font-bold text-foreground">Welcome back, {user?.firstName}!</h2>
          <p className="text-muted-foreground mt-2 text-lg">Manage your digital infrastructure securely.</p>
          {pendingOrders > 0 && (
            <div className="mt-3 flex items-center gap-2 text-yellow-400 text-sm">
              <Clock size={15} />
              <span>You have {pendingOrders} pending order{pendingOrders > 1 ? "s" : ""} awaiting approval</span>
            </div>
          )}
          <div className="mt-6 flex gap-4">
            <Button asChild className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
              <Link href="/client/hosting">View Services</Link>
            </Button>
            <Button asChild variant="outline" className="bg-card/50 backdrop-blur border-border/50">
              <Link href="/client/tickets">Open Ticket</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <Link key={i} href={card.link}>
            <div className={`bg-card border ${card.highlight ? "border-red-500/30 shadow-red-500/10" : "border-border"} rounded-2xl p-6 shadow-lg shadow-black/5 hover:-translate-y-1 transition-all duration-300 group cursor-pointer`}>
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl bg-secondary/50 border border-border group-hover:bg-secondary transition-colors ${card.color}`}>
                  <card.icon size={24} />
                </div>
              </div>
              <h3 className="text-3xl font-bold text-foreground">{card.value}</h3>
              <p className="text-sm font-medium text-muted-foreground mt-1">{card.title}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Orders + Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Orders */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg shadow-black/5 flex flex-col">
          <div className="p-5 border-b border-border flex justify-between items-center bg-secondary/30">
            <div className="flex items-center gap-2">
              <ShoppingCart size={16} className="text-primary" />
              <h3 className="font-display font-bold text-lg">Recent Orders</h3>
            </div>
            <Link href="/client/hosting" className="text-xs text-primary hover:underline">View Services</Link>
          </div>
          <div className="p-0 flex-1">
            {recentOrders.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <ShoppingCart size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No orders yet</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <tbody>
                  {recentOrders.map(order => (
                    <tr key={order.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/20">
                      <td className="p-4">
                        <p className="font-medium text-foreground text-sm truncate max-w-[160px]">{order.itemName}</p>
                        {order.domain && <p className="text-xs font-mono text-muted-foreground">{order.domain}</p>}
                        <p className="text-xs text-muted-foreground capitalize mt-0.5">{order.type} · {order.billingCycle}</p>
                      </td>
                      <td className="p-4 text-sm font-semibold text-foreground whitespace-nowrap">${Number(order.amount).toFixed(2)}</td>
                      <td className="p-4 text-right">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-medium border capitalize ${orderStatusColors[order.status] || "bg-secondary text-secondary-foreground border-border"}`}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg shadow-black/5 flex flex-col">
          <div className="p-5 border-b border-border flex justify-between items-center bg-secondary/30">
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-emerald-400" />
              <h3 className="font-display font-bold text-lg">Recent Invoices</h3>
            </div>
            <Link href="/client/invoices" className="text-xs text-primary hover:underline">View All</Link>
          </div>
          <div className="p-0 flex-1">
            {!stats.recentInvoices?.length ? (
              <div className="p-8 text-center text-muted-foreground">
                <FileText size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No recent invoices</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <tbody>
                  {stats.recentInvoices.map(inv => (
                    <tr key={inv.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/20 cursor-pointer"
                      onClick={() => navigate("/client/invoices")}>
                      <td className="p-4 font-mono font-medium text-sm text-foreground">{inv.invoiceNumber}</td>
                      <td className="p-4 text-sm font-semibold">${Number(inv.total).toFixed(2)}</td>
                      <td className="p-4 text-right">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${inv.status === "unpaid" ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Recent Support Tickets */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg shadow-black/5">
        <div className="p-5 border-b border-border flex justify-between items-center bg-secondary/30">
          <div className="flex items-center gap-2">
            <Ticket size={16} className="text-orange-400" />
            <h3 className="font-display font-bold text-lg">Recent Support Tickets</h3>
          </div>
          <Link href="/client/tickets" className="text-xs text-primary hover:underline">View All</Link>
        </div>
        <div className="p-0">
          <table className="w-full text-left">
            <tbody>
              {stats.recentTickets?.map(ticket => (
                <tr key={ticket.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/20 cursor-pointer"
                  onClick={() => navigate(`/client/tickets/${ticket.id}`)}>
                  <td className="p-4">
                    <p className="font-medium text-foreground truncate max-w-[300px]">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground">#{ticket.ticketNumber}</p>
                  </td>
                  <td className="p-4 text-right">
                    <span className="px-2 py-1 bg-secondary rounded text-xs font-medium text-muted-foreground border border-border">
                      {ticket.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!stats.recentTickets?.length && (
                <tr><td colSpan={2} className="p-8 text-center text-muted-foreground">No open tickets</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
