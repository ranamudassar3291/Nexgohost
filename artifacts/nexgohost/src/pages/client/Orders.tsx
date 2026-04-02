import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ShoppingCart, CheckCircle, XCircle, Clock, PauseCircle,
  Trash2, AlertTriangle, ExternalLink, Plus, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useCurrency } from "@/context/CurrencyProvider";

interface Order {
  id: string; type: string; itemName: string; amount: number;
  status: string; notes: string | null; createdAt: string;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Request failed"); }
  return res.json();
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending:    { label: "Pending",    icon: Clock,         color: "bg-[rgba(251,191,36,0.10)] text-[#FBB824] border-[rgba(251,191,36,0.28)]" },
  approved:   { label: "Active",     icon: CheckCircle,   color: "bg-green-500/10 text-green-400 border-green-500/20" },
  completed:  { label: "Completed",  icon: CheckCircle,   color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  suspended:  { label: "Suspended",  icon: PauseCircle,   color: "bg-[rgba(251,191,36,0.10)] text-[#FBB824] border-[rgba(251,191,36,0.28)]" },
  cancelled:  { label: "Cancelled",  icon: XCircle,       color: "bg-[rgba(255,82,82,0.10)] text-[#FF6B6B] border-[rgba(255,82,82,0.30)]" },
  terminated: { label: "Terminated", icon: Trash2,        color: "bg-red-900/10 text-red-300 border-red-900/20" },
  fraud:      { label: "Fraud",      icon: AlertTriangle, color: "bg-red-500/10 text-red-500 border-red-500/30" },
};

export default function ClientOrders() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["client-orders"],
    queryFn: () => apiFetch("/api/orders"),
  });

  const activeCount = orders.filter(o => o.status === "approved").length;
  const pendingCount = orders.filter(o => o.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">My Orders</h2>
          <p className="text-muted-foreground mt-1">Track your hosting orders and their status.</p>
        </div>
        <Button onClick={() => setLocation("/client/orders/new")} className="bg-primary hover:bg-primary/90 gap-2">
          <Plus size={16} /> New Order
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 sm:grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: "Total Orders", value: orders.length, color: "text-foreground" },
          { label: "Active", value: activeCount, color: "text-green-400" },
          { label: "Pending", value: pendingCount, color: "text-yellow-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              <ShoppingCart size={28} className="text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No orders yet</h3>
            <p className="text-muted-foreground text-sm mt-1 mb-5">Browse our hosting packages to get started.</p>
            <Button onClick={() => setLocation("/client/orders/new")} className="bg-primary hover:bg-primary/90 gap-2">
              <Plus size={15} /> Place First Order
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-secondary/40 border-b border-border">
                  {["Order", "Service", "Amount", "Date", "Status", ""].map((h, i) => (
                    <th key={i} className={`p-4 font-medium text-muted-foreground ${h === "" ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map(order => {
                  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                  const Icon = cfg.icon;
                  return (
                    <motion.tr key={order.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                      <td className="p-4">
                        <div className="font-mono text-xs text-primary"># {order.id.slice(0, 8).toUpperCase()}</div>
                        <div className="text-xs text-muted-foreground capitalize mt-0.5">{order.type}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-foreground">{order.itemName}</div>
                        {order.notes && <div className="text-xs text-muted-foreground mt-0.5">{order.notes}</div>}
                      </td>
                      <td className="p-4 font-semibold">{formatPrice(Number(order.amount))}</td>
                      <td className="p-4 text-muted-foreground">
                        {format(new Date(order.createdAt), "MMM d, yyyy")}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
                          <Icon size={12} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {order.status === "approved" && (
                          <Button variant="outline" size="sm" className="h-7 px-2.5 gap-1.5"
                            onClick={() => setLocation("/client/hosting")}>
                            <ExternalLink size={12} /> View Service
                          </Button>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
