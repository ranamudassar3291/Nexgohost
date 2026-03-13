import { useState } from "react";
import { useLocation } from "wouter";
import { useGetAllOrders, useApproveOrder, useCancelOrder } from "@workspace/api-client-react";
import { ShoppingCart, CheckCircle, XCircle, Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  pending:    "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  approved:   "bg-green-500/10 text-green-400 border-green-500/20",
  completed:  "bg-blue-500/10 text-blue-400 border-blue-500/20",
  cancelled:  "bg-red-500/10 text-red-400 border-red-500/20",
  suspended:  "bg-orange-500/10 text-orange-400 border-orange-500/20",
  fraud:      "bg-purple-500/10 text-purple-400 border-purple-500/20",
  terminated: "bg-red-800/10 text-red-600 border-red-800/20",
};

const filterTabs = ["all", "pending", "approved", "suspended", "cancelled", "fraud", "terminated"];

export default function AdminOrders() {
  const [, setLocation] = useLocation();
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

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/admin/orders/${id}/${newStatus}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      toast({ title: `Order marked as ${newStatus}` });
      refetch();
    } catch {
      toast({ title: `Failed to update order`, variant: "destructive" });
    }
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
          <Button onClick={() => setLocation("/admin/orders/add")} className="bg-primary hover:bg-primary/90 h-10 rounded-xl">
            <Plus size={16} className="mr-2" /> Create Order
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 bg-card border-border" placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)} />
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
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border capitalize ${statusColors[order.status] || "bg-secondary text-secondary-foreground border-border"}`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{format(new Date(order.createdAt), "MMM d, yyyy")}</td>
                <td className="px-6 py-4">
                  <div className="flex gap-1.5 flex-wrap">
                    {order.status === "pending" && (
                      <>
                        <Button size="sm" className="h-7 px-2.5 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleApprove(order.id)}>
                          <CheckCircle className="w-3 h-3 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" className="h-7 px-2.5 text-xs" onClick={() => handleCancel(order.id)}>
                          <XCircle className="w-3 h-3 mr-1" /> Cancel
                        </Button>
                      </>
                    )}
                    {order.status === "approved" && (
                      <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => handleStatusChange(order.id, "suspend")}>
                        Suspend
                      </Button>
                    )}
                    {order.status === "suspended" && (
                      <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => handleApprove(order.id)}>
                        Unsuspend
                      </Button>
                    )}
                    {["pending", "approved", "suspended"].includes(order.status) && (
                      <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => handleStatusChange(order.id, "terminate")}>
                        Terminate
                      </Button>
                    )}
                  </div>
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
