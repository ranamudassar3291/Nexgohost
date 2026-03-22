import { useLocation } from "wouter";
import { FileText, CreditCard, CheckCircle, AlertCircle, Eye, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrency } from "@/context/CurrencyProvider";

interface Invoice {
  id: string; invoiceNumber: string; total: number; amount: number; tax: number;
  status: string; dueDate: string; paidDate?: string; createdAt: string;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Request failed"); }
  return res.json();
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  paid:      { label: "Paid",      color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", icon: CheckCircle },
  unpaid:    { label: "Unpaid",    color: "bg-red-500/10 text-red-400 border-red-500/20", icon: AlertCircle },
  cancelled: { label: "Cancelled", color: "bg-secondary text-muted-foreground border-border", icon: FileText },
  refunded:  { label: "Refunded",  color: "bg-purple-500/10 text-purple-400 border-purple-500/20", icon: CheckCircle },
};

export default function ClientInvoices() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { formatPrice } = useCurrency();

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["client-invoices"],
    queryFn: () => apiFetch("/api/invoices"),
  });

  const handlePay = async (id: string) => {
    try {
      await apiFetch(`/api/invoices/${id}/pay`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["client-invoices"] });
      toast({ title: "Payment Recorded", description: "Invoice marked as paid." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const unpaidCount = invoices.filter(i => i.status === "unpaid").length;
  const totalDue = invoices.filter(i => i.status === "unpaid").reduce((sum, i) => sum + Number(i.total), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Invoices</h2>
          <p className="text-muted-foreground mt-1">View and pay your billing statements.</p>
        </div>
        {unpaidCount > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertCircle size={16} className="text-red-400" />
            <div>
              <div className="text-xs text-muted-foreground">{unpaidCount} invoice{unpaidCount > 1 ? "s" : ""} unpaid</div>
              <div className="text-sm font-semibold text-red-400">{formatPrice(totalDue)} due</div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-secondary/40 border-b border-border">
                  {["Invoice #", "Date", "Due Date", "Total", "Status", "Actions"].map(h => (
                    <th key={h} className={`p-4 font-medium text-muted-foreground text-sm ${h === "Actions" ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      No invoices found.
                    </td>
                  </tr>
                ) : invoices.map(inv => {
                  const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.unpaid;
                  const Icon = cfg.icon;
                  return (
                    <tr key={inv.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors cursor-pointer" onClick={() => setLocation(`/client/invoices/${inv.id}`)}>
                      <td className="p-4 font-bold text-foreground">
                        <div className="flex items-center gap-2">
                          <FileText size={15} className="text-muted-foreground" />
                          {inv.invoiceNumber}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{format(new Date(inv.createdAt), "MMM d, yyyy")}</td>
                      <td className="p-4 text-sm text-muted-foreground">{format(new Date(inv.dueDate), "MMM d, yyyy")}</td>
                      <td className="p-4 font-semibold">{formatPrice(Number(inv.total))}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${cfg.color}`}>
                          <Icon size={12} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2 justify-end">
                          <Button size="sm" variant="outline" className="h-8 px-3 gap-1.5"
                            onClick={() => setLocation(`/client/invoices/${inv.id}`)}>
                            <Eye size={13} /> View
                          </Button>
                          {inv.status === "unpaid" && (
                            <Button size="sm" className="h-8 px-3 bg-primary hover:bg-primary/90 gap-1.5"
                              onClick={() => handlePay(inv.id)}>
                              <CreditCard size={13} /> Pay
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
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
