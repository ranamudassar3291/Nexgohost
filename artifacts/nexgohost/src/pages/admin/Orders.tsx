import { useState } from "react";
import { useGetAllOrders, useApproveOrder, useCancelOrder } from "@workspace/api-client-react";
import { ShoppingCart, CheckCircle, XCircle, Clock, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  approved: "bg-green-500/10 text-green-400 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  completed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

export default function AdminOrders() {
  const { data: orders = [], isLoading, refetch } = useGetAllOrders();
  const approveOrder = useApproveOrder();
  const cancelOrder = useCancelOrder();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = orders.filter(o => {
    const matchSearch = o.clientName?.toLowerCase().includes(search.toLowerCase()) || o.itemName.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || o.status === filter;
    return matchSearch && matchFilter;
  });

  const handleApprove = (id: string) => {
    approveOrder.mutate({ id }, {
      onSuccess: () => { toast({ title: "Order approved" }); refetch(); },
      onError: () => toast({ title: "Failed to approve", variant: "destructive" }),
    });
  };

  const handleCancel = (id: string) => {
    cancelOrder.mutate({ id }, {
      onSuccess: () => { toast({ title: "Order cancelled" }); refetch(); },
      onError: () => toast({ title: "Failed to cancel", variant: "destructive" }),
    });
  };

  if (isLoading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Orders</h2>
          <p className="text-muted-foreground mt-1">Manage client orders and requests</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{orders.filter(o => o.status === "pending").length} pending</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 bg-card border-border" placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {["all", "pending", "approved", "cancelled"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 text-sm rounded-lg border capitalize transition-all ${filter === f ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Client</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Item</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Type</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Amount</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Status</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Date</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(order => (
              <tr key={order.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-foreground">{order.clientName}</td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{order.itemName}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground capitalize">{order.type}</span>
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-foreground">${order.amount.toFixed(2)}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border capitalize ${statusColors[order.status]}`}>{order.status}</span>
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{format(new Date(order.createdAt), "MMM d, yyyy")}</td>
                <td className="px-6 py-4">
                  {order.status === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="default" className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleApprove(order.id)}>
                        <CheckCircle className="w-3 h-3 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" className="h-7 px-3 text-xs" onClick={() => handleCancel(order.id)}>
                        <XCircle className="w-3 h-3 mr-1" /> Cancel
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">No orders found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
