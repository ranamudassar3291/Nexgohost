import { useState } from "react";
import { useGetAllInvoices, useCreateInvoice, useMarkInvoicePaid, useGetClients } from "@workspace/api-client-react";
import { FileText, Plus, CheckCircle, Search, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  unpaid: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  paid: "bg-green-500/10 text-green-400 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  overdue: "bg-red-600/10 text-red-500 border-red-600/20",
};

export default function AdminInvoices() {
  const { data: invoices = [], isLoading, refetch } = useGetAllInvoices();
  const markPaid = useMarkInvoicePaid();
  const { toast } = useToast();
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

  const totalRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0);
  const pendingRevenue = invoices.filter(i => i.status === "unpaid").reduce((s, i) => s + i.total, 0);

  if (isLoading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Invoices</h2>
          <p className="text-muted-foreground mt-1">Manage billing and invoices</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-sm text-muted-foreground">Total Revenue</p>
          <p className="text-2xl font-bold text-green-400 mt-1">${totalRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-sm text-muted-foreground">Pending Revenue</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">${pendingRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-sm text-muted-foreground">Total Invoices</p>
          <p className="text-2xl font-bold text-foreground mt-1">{invoices.length}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 bg-card border-border" placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {["all", "unpaid", "paid", "overdue"].map(f => (
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
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Invoice #</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Client</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Amount</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Status</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Due Date</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(inv => (
              <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-6 py-4 text-sm font-mono text-primary">{inv.invoiceNumber}</td>
                <td className="px-6 py-4 text-sm font-medium text-foreground">{inv.clientName}</td>
                <td className="px-6 py-4 text-sm font-semibold text-foreground">${inv.total.toFixed(2)}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border capitalize ${statusColors[inv.status]}`}>{inv.status}</span>
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{format(new Date(inv.dueDate), "MMM d, yyyy")}</td>
                <td className="px-6 py-4">
                  {inv.status === "unpaid" && (
                    <Button size="sm" className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleMarkPaid(inv.id)}>
                      <CheckCircle className="w-3 h-3 mr-1" /> Mark Paid
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">No invoices found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
