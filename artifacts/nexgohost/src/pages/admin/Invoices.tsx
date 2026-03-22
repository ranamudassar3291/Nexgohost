import { useState } from "react";
import { useLocation } from "wouter";
import { useGetAllInvoices, useMarkInvoicePaid } from "@workspace/api-client-react";
import { Search, CheckCircle, Plus, FileText, TrendingUp, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useCurrency } from "@/context/CurrencyProvider";

const statusColors: Record<string, string> = {
  unpaid:      "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  paid:        "bg-green-500/10 text-green-400 border-green-500/20",
  cancelled:   "bg-red-500/10 text-red-400 border-red-500/20",
  overdue:     "bg-red-600/10 text-red-500 border-red-600/20",
  refunded:    "bg-blue-500/10 text-blue-400 border-blue-500/20",
  collections: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

const filterTabs = ["all", "unpaid", "paid", "overdue", "refunded", "collections", "cancelled"];

export default function AdminInvoices() {
  const [, setLocation] = useLocation();
  const { data: invoices = [], isLoading, refetch } = useGetAllInvoices();
  const markPaid = useMarkInvoicePaid();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = invoices.filter(i => {
    const matchSearch = i.clientName?.toLowerCase().includes(search.toLowerCase()) || i.invoiceNumber.includes(search);
    const matchFilter = filter === "all" || i.status === filter;
    return matchSearch && matchFilter;
  });

  const handleMarkPaid = (id: string) => {
    markPaid.mutate({ id }, {
      onSuccess: () => { toast({ title: "Invoice marked as paid" }); refetch(); },
      onError: () => toast({ title: "Failed", variant: "destructive" }),
    });
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Cancel this invoice?")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/admin/invoices/${id}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { toast({ title: "Invoice cancelled" }); refetch(); }
      else throw new Error();
    } catch { toast({ title: "Failed to cancel", variant: "destructive" }); }
  };

  const totalRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0);
  const pendingRevenue = invoices.filter(i => i.status === "unpaid").reduce((s, i) => s + i.total, 0);
  const overdueCount = invoices.filter(i => i.status === "overdue" || (i.status === "unpaid" && new Date(i.dueDate) < new Date())).length;

  if (isLoading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Invoices</h2>
          <p className="text-muted-foreground mt-1">Manage all billing and invoice records</p>
        </div>
        <Button onClick={() => setLocation("/admin/invoices/add")} className="bg-primary hover:bg-primary/90 h-10 rounded-xl">
          <Plus size={16} className="mr-2" /> Create Invoice
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-green-500/20 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
            <TrendingUp size={20} className="text-green-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Collected Revenue</p>
            <p className="text-2xl font-bold text-green-400">{formatPrice(totalRevenue)}</p>
          </div>
        </div>
        <div className="bg-card border border-yellow-500/20 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0">
            <Clock size={20} className="text-yellow-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pending Revenue</p>
            <p className="text-2xl font-bold text-yellow-400">{formatPrice(pendingRevenue)}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center shrink-0">
            <FileText size={20} className="text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Invoices</p>
            <p className="text-2xl font-bold text-foreground">{invoices.length}
              {overdueCount > 0 && <span className="text-sm font-normal text-red-400 ml-2">({overdueCount} overdue)</span>}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 bg-card border-border" placeholder="Search by client or invoice #..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {filterTabs.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-lg border capitalize transition-all ${filter === f ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              {f}
              {f !== "all" && (
                <span className="ml-1 text-[10px] opacity-60">
                  ({invoices.filter(i => i.status === f).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Invoice #</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Due Date</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <tr key={inv.id} className="border-b border-border/40 hover:bg-secondary/20 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono text-primary">{inv.invoiceNumber}</td>
                  <td className="px-6 py-4 text-sm font-medium text-foreground">{inv.clientName || "—"}</td>
                  <td className="px-6 py-4 text-sm font-bold text-foreground">{formatPrice(Number(inv.total))}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${statusColors[inv.status] || "bg-secondary text-secondary-foreground border-border"}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {inv.dueDate ? format(new Date(inv.dueDate), "MMM d, yyyy") : "—"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1.5">
                      {inv.status === "unpaid" && (
                        <>
                          <Button size="sm" className="h-7 px-2.5 text-xs bg-green-600 hover:bg-green-700 rounded-lg" onClick={() => handleMarkPaid(inv.id)}>
                            <CheckCircle className="w-3 h-3 mr-1" /> Mark Paid
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 rounded-lg" onClick={() => handleCancel(inv.id)}>
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <FileText size={40} className="mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm">No invoices found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
