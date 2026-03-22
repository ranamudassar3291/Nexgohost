import { useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Download, CreditCard, CheckCircle, Clock, XCircle, Printer, Building2, Send, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useCurrency } from "@/context/CurrencyProvider";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

interface InvoiceItem { description: string; quantity: number; unitPrice: number; total: number; }
interface Invoice {
  id: string; invoiceNumber: string; clientId: string; clientName: string;
  amount: number; tax: number; total: number; status: string;
  dueDate: string; paidDate?: string;
  paymentRef?: string | null; paymentGatewayId?: string | null; paymentNotes?: string | null;
  items: InvoiceItem[]; createdAt: string;
}
interface PaymentMethod {
  id: string; name: string; type: string; description: string | null;
  publicSettings: Record<string, string | undefined>;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  paid:            { label: "Paid",            icon: CheckCircle, color: "bg-green-500/10 text-green-400 border-green-500/20" },
  unpaid:          { label: "Unpaid",          icon: Clock,       color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  payment_pending: { label: "Payment Pending", icon: Clock,       color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  cancelled:       { label: "Cancelled",       icon: XCircle,     color: "bg-red-500/10 text-red-400 border-red-500/20" },
  overdue:         { label: "Overdue",         icon: AlertCircle, color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  refunded:        { label: "Refunded",        icon: ArrowLeft,   color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
};

const TYPE_ICONS: Record<string, string> = {
  jazzcash: "📱", easypaisa: "💚", bank_transfer: "🏦",
  paypal: "🅿️", stripe: "💳", crypto: "₿", manual: "✍️",
};

function PaymentInstructions({ method }: { method: PaymentMethod }) {
  const s = method.publicSettings ?? {};
  const hasSettings = Object.values(s).some(v => v);

  if (!hasSettings) {
    return <p className="text-xs text-muted-foreground">Contact support for payment details.</p>;
  }

  const rows: { label: string; value: string }[] = [];
  if (s.bankName)      rows.push({ label: "Bank",           value: s.bankName });
  if (s.accountTitle)  rows.push({ label: "Account Title",  value: s.accountTitle });
  if (s.accountNumber) rows.push({ label: "Account No.",    value: s.accountNumber });
  if (s.iban)          rows.push({ label: "IBAN",           value: s.iban });
  if (s.swiftCode)     rows.push({ label: "SWIFT",          value: s.swiftCode });
  if (s.mobileNumber)  rows.push({ label: "Mobile No.",     value: s.mobileNumber });
  if (s.paypalEmail)   rows.push({ label: "PayPal Email",   value: s.paypalEmail });
  if (s.walletAddress) rows.push({ label: "Wallet",         value: s.walletAddress });
  if (s.cryptoType)    rows.push({ label: "Coin",           value: s.cryptoType });
  if (s.instructions)  rows.push({ label: "Instructions",   value: s.instructions });

  return (
    <div className="space-y-1.5">
      {rows.map(r => (
        <div key={r.label} className="flex items-start justify-between gap-4 text-xs">
          <span className="text-muted-foreground shrink-0">{r.label}</span>
          <span className="font-medium text-foreground text-right break-all">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const paymentRef = useRef<HTMLDivElement>(null);
  const { formatPrice } = useCurrency();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedGateway, setSelectedGateway] = useState<string>("");
  const [txRef, setTxRef] = useState("");
  const [txNotes, setTxNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: invoice, isLoading } = useQuery<Invoice>({
    queryKey: ["invoice", id],
    queryFn: () => apiFetch(`/api/my/invoices/${id}`),
    enabled: !!id,
  });

  const { data: paymentMethods = [] } = useQuery<PaymentMethod[]>({
    queryKey: ["payment-methods"],
    queryFn: () => apiFetch("/api/payment-methods"),
  });

  const scrollToPayment = () => paymentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGateway || !txRef.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/my/invoices/${id}/submit-payment`, {
        method: "POST",
        body: JSON.stringify({ paymentRef: txRef.trim(), paymentGatewayId: selectedGateway, paymentNotes: txNotes.trim() || undefined }),
      });
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      toast({ title: "Payment submitted!", description: "We'll verify and confirm your payment shortly." });
      setTxRef(""); setTxNotes(""); setSelectedGateway("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
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
  const isPaymentPending = invoice.status === "payment_pending";
  const canPay = ["unpaid", "overdue"].includes(invoice.status);

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
          {canPay && (
            <Button size="sm" onClick={scrollToPayment} className="bg-primary hover:bg-primary/90 gap-2">
              <CreditCard size={15} /> Pay Now
            </Button>
          )}
        </div>
      </div>

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
            { label: "Due Date",     value: format(new Date(invoice.dueDate), "MMM d, yyyy") },
            { label: "Paid Date",    value: isPaid && invoice.paidDate ? format(new Date(invoice.paidDate), "MMM d, yyyy") : "—" },
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
                <tr><td colSpan={4} className="py-6 text-center text-muted-foreground text-sm">No line items</td></tr>
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

        {/* Payment Pending Notice */}
        {isPaymentPending && (
          <div className="border-t border-blue-500/20 p-6 bg-blue-500/5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                <Clock size={18} className="text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-foreground text-sm">Payment Under Review</p>
                <p className="text-xs text-muted-foreground mt-0.5">Your payment reference has been submitted and is being verified by our team.</p>
                {invoice.paymentRef && (
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex gap-2">
                      <span className="text-muted-foreground">Reference:</span>
                      <span className="font-mono font-medium text-foreground">{invoice.paymentRef}</span>
                    </div>
                    {invoice.paymentNotes && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground">Notes:</span>
                        <span className="text-foreground">{invoice.paymentNotes}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Payment Section (unpaid/overdue) */}
        {canPay && paymentMethods.length > 0 && (
          <div ref={paymentRef} className="border-t border-border/50 p-6 bg-secondary/20 space-y-5">
            <div>
              <div className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                <CreditCard size={16} className="text-primary" /> Payment Instructions
              </div>
              <p className="text-xs text-muted-foreground">
                Pay <span className="font-bold text-foreground">{formatPrice(Number(invoice.total))}</span> using one of the gateways below, then submit your transaction reference.
                Use invoice <span className="font-mono font-semibold text-foreground">#{invoice.invoiceNumber}</span> as your payment description.
              </p>
            </div>

            {/* Gateway cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {paymentMethods.map(pm => (
                <div
                  key={pm.id}
                  onClick={() => setSelectedGateway(selectedGateway === pm.id ? "" : pm.id)}
                  className={`bg-card border rounded-xl p-4 cursor-pointer transition-all ${selectedGateway === pm.id ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40"}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{TYPE_ICONS[pm.type] ?? "💳"}</span>
                    <span className="text-sm font-semibold text-foreground">{pm.name}</span>
                    {selectedGateway === pm.id && <CheckCircle size={14} className="ml-auto text-primary" />}
                  </div>
                  <PaymentInstructions method={pm} />
                </div>
              ))}
            </div>

            {/* Submit payment form */}
            <AnimatePresence>
              {selectedGateway && (
                <motion.form
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  onSubmit={handleSubmitPayment}
                  className="bg-card border border-primary/20 rounded-xl p-4 space-y-3"
                >
                  <p className="text-sm font-medium text-foreground">Submit Payment Confirmation</p>
                  <p className="text-xs text-muted-foreground">After transferring, enter your transaction ID or receipt number below so our team can verify your payment.</p>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground/70">Transaction ID / Receipt Number *</label>
                    <Input
                      value={txRef}
                      onChange={e => setTxRef(e.target.value)}
                      placeholder="e.g. JC-1234567890 or TXN#XXXXX"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground/70">Additional Notes (optional)</label>
                    <Input
                      value={txNotes}
                      onChange={e => setTxNotes(e.target.value)}
                      placeholder="e.g. Sent from 03XX-XXXXXXX at 3:45 PM"
                    />
                  </div>
                  <Button type="submit" disabled={submitting || !txRef.trim()} className="w-full gap-2">
                    {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    Confirm Payment
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>

            {paymentMethods.length === 0 && (
              <div className="bg-card border border-border/50 rounded-xl p-4 text-sm text-muted-foreground">
                Please contact our support team at <span className="text-foreground font-medium">billing@nexgohost.com</span> to arrange your payment.
              </div>
            )}
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
