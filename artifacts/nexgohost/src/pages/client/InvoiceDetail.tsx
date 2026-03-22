import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Download, CreditCard, CheckCircle, Clock, XCircle, Printer, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useCurrency } from "@/context/CurrencyProvider";

interface InvoiceItem { description: string; quantity: number; unitPrice: number; total: number; }
interface Invoice {
  id: string; invoiceNumber: string; clientId: string; clientName: string;
  amount: number; tax: number; total: number; status: string;
  dueDate: string; paidDate?: string; items: InvoiceItem[]; createdAt: string;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Request failed"); }
  return res.json();
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  paid:      { label: "Paid",      icon: CheckCircle, color: "bg-green-500/10 text-green-400 border-green-500/20" },
  unpaid:    { label: "Unpaid",    icon: Clock,       color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  cancelled: { label: "Cancelled", icon: XCircle,     color: "bg-red-500/10 text-red-400 border-red-500/20" },
  refunded:  { label: "Refunded",  icon: ArrowLeft,   color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
};

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { formatPrice } = useCurrency();

  const { data: invoice, isLoading } = useQuery<Invoice>({
    queryKey: ["invoice", id],
    queryFn: () => apiFetch(`/api/my/invoices/${id}`),
    enabled: !!id,
  });

  const handlePay = async () => {
    try {
      await apiFetch(`/api/invoices/${id}/pay`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["client-invoices"] });
      toast({ title: "Payment recorded", description: "Invoice marked as paid." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) return (
    <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
  );

  if (!invoice) return (
    <div className="text-center py-12">
      <p className="text-muted-foreground">Invoice not found.</p>
      <Button variant="outline" className="mt-4" onClick={() => setLocation("/client/invoices")}>Back to Invoices</Button>
    </div>
  );

  const statusCfg = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.unpaid;
  const StatusIcon = statusCfg.icon;
  const isPaid = invoice.status === "paid";

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/client/invoices")} className="gap-2">
          <ArrowLeft size={16} /> Back to Invoices
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
            <Printer size={15} /> Print
          </Button>
          {!isPaid && invoice.status !== "cancelled" && (
            <Button size="sm" onClick={handlePay} className="bg-primary hover:bg-primary/90 gap-2">
              <CreditCard size={15} /> Pay Now
            </Button>
          )}
        </div>
      </div>

      {/* Invoice Card */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden print:border-none print:shadow-none">
        
        {/* Header */}
        <div className="bg-primary/5 border-b border-border p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px]" />
          <div className="relative flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                  <Building2 size={20} className="text-white" />
                </div>
                <div>
                  <div className="font-bold text-foreground text-lg">Nexgohost</div>
                  <div className="text-xs text-muted-foreground">Professional Hosting Solutions</div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground space-y-0.5">
                <p>billing@nexgohost.com</p>
                <p>support@nexgohost.com</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-foreground">INVOICE</div>
              <div className="text-primary font-semibold text-lg mt-1">#{invoice.invoiceNumber}</div>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border mt-2 ${statusCfg.color}`}>
                <StatusIcon size={12} />
                {statusCfg.label}
              </div>
            </div>
          </div>
        </div>

        {/* Meta info */}
        <div className="grid grid-cols-3 divide-x divide-border/50 border-b border-border">
          {[
            { label: "Invoice Date", value: format(new Date(invoice.createdAt), "MMM d, yyyy") },
            { label: "Due Date", value: format(new Date(invoice.dueDate), "MMM d, yyyy") },
            { label: "Paid Date", value: isPaid && invoice.paidDate ? format(new Date(invoice.paidDate), "MMM d, yyyy") : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="p-5 text-center">
              <div className="text-xs text-muted-foreground mb-1">{label}</div>
              <div className="font-medium text-foreground">{value}</div>
            </div>
          ))}
        </div>

        {/* Bill To */}
        <div className="p-6 border-b border-border/50">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Bill To</div>
          <div className="font-semibold text-foreground">{invoice.clientName || "Client"}</div>
        </div>

        {/* Line Items */}
        <div className="p-6">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-2 text-sm font-medium text-muted-foreground">Description</th>
                <th className="text-center py-2 text-sm font-medium text-muted-foreground">Qty</th>
                <th className="text-right py-2 text-sm font-medium text-muted-foreground">Unit Price</th>
                <th className="text-right py-2 text-sm font-medium text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.items || []).length > 0 ? (invoice.items || []).map((item, i) => (
                <tr key={i} className="border-b border-border/30">
                  <td className="py-3 text-sm text-foreground">{item.description}</td>
                  <td className="py-3 text-sm text-center text-muted-foreground">{item.quantity}</td>
                  <td className="py-3 text-sm text-right text-muted-foreground">{formatPrice(Number(item.unitPrice))}</td>
                  <td className="py-3 text-sm text-right font-medium text-foreground">{formatPrice(Number(item.total))}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground text-sm">No line items</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t border-border/50 p-6">
          <div className="ml-auto max-w-xs space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPrice(Number(invoice.amount))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatPrice(Number(invoice.tax || 0))}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t border-border/50 pt-2">
              <span>Total</span>
              <span className="text-primary">{formatPrice(Number(invoice.total))}</span>
            </div>
          </div>
        </div>

        {/* Payment Instructions */}
        {!isPaid && invoice.status !== "cancelled" && (
          <div className="border-t border-border/50 p-6 bg-secondary/20">
            <div className="text-sm font-medium text-foreground mb-3">Payment Instructions</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  title: "Bank Transfer",
                  icon: "🏦",
                  details: ["Account: Nexgohost Ltd", "IBAN: PK00ABCD0000000000001234", "Ref: " + invoice.invoiceNumber],
                },
                {
                  title: "PayPal",
                  icon: "🅿️",
                  details: ["billing@nexgohost.com", `Amount: ${formatPrice(Number(invoice.total))}`, "Include invoice number"],
                },
                {
                  title: "Manual",
                  icon: "✍️",
                  details: ["Contact support", "We'll mark as paid", "after verification"],
                },
              ].map(method => (
                <div key={method.title} className="bg-card border border-border/50 rounded-xl p-3">
                  <div className="text-base mb-1">{method.icon}</div>
                  <div className="text-xs font-semibold text-foreground mb-1">{method.title}</div>
                  {method.details.map((d, i) => <div key={i} className="text-xs text-muted-foreground">{d}</div>)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-border/50 p-5 text-center text-xs text-muted-foreground">
          Thank you for your business! Questions? Contact billing@nexgohost.com | nexgohost.com
        </div>
      </div>
    </motion.div>
  );
}
