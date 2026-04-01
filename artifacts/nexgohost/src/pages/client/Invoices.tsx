import { useState } from "react";
import { useLocation } from "wouter";
import {
  FileText, CreditCard, CheckCircle, AlertCircle, Eye, Loader2,
  RefreshCcw, Banknote, Download, Clock, ChevronRight, X, RotateCcw,
  Receipt, ArrowDownCircle, Info, Search,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useCurrency } from "@/context/CurrencyProvider";

interface Invoice {
  id: string; invoiceNumber: string; total: number; amount: number; tax: number;
  status: string; displayStatus: string; dueDate: string; paidDate?: string | null;
  createdAt: string; paymentRef?: string; paymentNotes?: string;
  currencyCode: string; currencySymbol: string; currencyRate: number;
  items: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
}

interface Transaction {
  id: string; invoiceId?: string; amount: number; method: string;
  status: string; transactionRef?: string; createdAt: string;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Request failed"); }
  return res.json();
}

type BillingTab = "invoices" | "transactions" | "refunds";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  paid:            { label: "Paid",           color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle },
  unpaid:          { label: "Unpaid",         color: "bg-red-500/10 text-red-400 border-red-500/20", icon: AlertCircle },
  overdue:         { label: "Overdue",        color: "bg-red-600/10 text-red-500 border-red-600/20", icon: AlertCircle },
  payment_pending: { label: "Pending Review", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", icon: Clock },
  cancelled:       { label: "Cancelled",      color: "bg-secondary text-muted-foreground border-border", icon: FileText },
  refunded:        { label: "Refunded",       color: "bg-purple-500/10 text-purple-400 border-purple-500/20", icon: RotateCcw },
  refund_pending:  { label: "Refund Pending", color: "bg-orange-500/10 text-orange-400 border-orange-500/20", icon: RefreshCcw },
};

const METHOD_LABELS: Record<string, string> = {
  safepay: "Safepay",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
  bank_transfer: "Bank Transfer",
  manual: "Manual",
  crypto: "Crypto",
  stripe: "Stripe",
  paypal: "PayPal",
};

const TX_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  success: { color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", label: "Success" },
  failed:  { color: "bg-red-500/10 text-red-400 border-red-500/20",            label: "Failed" },
  pending: { color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",   label: "Pending" },
  refunded:{ color: "bg-purple-500/10 text-purple-400 border-purple-500/20",   label: "Refunded" },
};

function InvAmount({ inv }: { inv: Invoice }) {
  const { formatPrice, currencyCode } = useCurrency();
  // If invoice has its own currency stored, use it; else use live rate
  const hasStoredCurrency = inv.currencyCode && inv.currencyRate && inv.currencyRate !== 1;
  if (hasStoredCurrency && inv.currencyCode !== "PKR") {
    const converted = inv.total * inv.currencyRate;
    return <span>{inv.currencySymbol}{converted.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
  }
  return <span>{formatPrice(inv.total)}</span>;
}

function RefundModal({ invoice, onClose, onSuccess }: { invoice: Invoice; onClose: () => void; onSuccess: () => void }) {
  const [reason, setReason] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => apiFetch(`/api/invoices/${invoice.id}/refund-request`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
    onSuccess: () => {
      toast({ title: "Refund Requested", description: "Your refund request has been submitted. We'll review it within 3-5 business days." });
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const paidAt = invoice.paidDate ? new Date(invoice.paidDate) : null;
  const daysLeft = paidAt ? Math.max(0, 30 - differenceInDays(new Date(), paidAt)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-bold text-foreground">Request Refund</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{invoice.invoiceNumber}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 transition-colors"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Refund eligibility info */}
          <div className="flex items-start gap-3 p-3 bg-orange-500/5 border border-orange-500/20 rounded-xl">
            <Info size={15} className="text-orange-400 mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p className="font-medium text-foreground">30-Day Money-Back Guarantee</p>
              <p>You have <span className="text-orange-400 font-semibold">{daysLeft} day{daysLeft !== 1 ? "s" : ""}</span> remaining in your refund window.</p>
              <p>Refund amount: <span className="font-semibold text-foreground"><InvAmount inv={invoice} /></span></p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Reason for Refund *</label>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Please describe why you are requesting a refund..."
              rows={4}
              className="bg-background resize-none"
            />
          </div>

          <div className="text-xs text-muted-foreground bg-secondary/50 rounded-xl p-3">
            Your request will be reviewed by our billing team within 3–5 business days. If approved, the refund will be processed to your original payment method.
          </div>
        </div>

        <div className="flex gap-2 p-5 pt-0">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!reason.trim() || mutation.isPending}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white gap-2"
          >
            {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            Submit Request
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ClientInvoices() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { formatPrice } = useCurrency();
  const [activeTab, setActiveTab] = useState<BillingTab>("invoices");
  const [refundTarget, setRefundTarget] = useState<Invoice | null>(null);

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["client-invoices"],
    queryFn: () => apiFetch("/api/invoices"),
  });

  const { data: transactions = [], isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ["client-transactions"],
    queryFn: () => apiFetch("/api/payments/transactions"),
    enabled: activeTab === "transactions",
  });

  const [txSearch, setTxSearch] = useState("");
  const filteredTx = txSearch.trim()
    ? transactions.filter(tx =>
        (tx.transactionRef || "").toLowerCase().includes(txSearch.toLowerCase()) ||
        (tx.method || "").toLowerCase().includes(txSearch.toLowerCase()) ||
        String(tx.amount).includes(txSearch) ||
        (tx.status || "").toLowerCase().includes(txSearch.toLowerCase())
      )
    : transactions;

  const handlePay = (id: string) => {
    setLocation(`/client/invoices/${id}`);
  };

  const unpaidCount = invoices.filter(i => i.status === "unpaid" || i.status === "overdue").length;
  const totalDue = invoices.filter(i => ["unpaid", "overdue"].includes(i.status)).reduce((sum, i) => sum + Number(i.total), 0);
  const refundInvoices = invoices.filter(i => i.displayStatus === "refund_pending" || i.status === "refunded");

  function isRefundEligible(inv: Invoice): boolean {
    if (inv.status !== "paid" || inv.displayStatus === "refund_pending") return false;
    const paidAt = inv.paidDate ? new Date(inv.paidDate) : null;
    if (!paidAt) return false;
    return differenceInDays(new Date(), paidAt) <= 30;
  }

  const tabs: Array<{ key: BillingTab; label: string; count?: number }> = [
    { key: "invoices",     label: "Invoices",     count: invoices.length },
    { key: "transactions", label: "Transactions" },
    { key: "refunds",      label: "Refunds",      count: refundInvoices.length || undefined },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Billing</h2>
          <p className="text-muted-foreground mt-1">View invoices, transactions, and manage refunds.</p>
        </div>
        {unpaidCount > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertCircle size={16} className="text-red-400 shrink-0" />
            <div>
              <div className="text-xs text-muted-foreground">{unpaidCount} invoice{unpaidCount > 1 ? "s" : ""} unpaid</div>
              <div className="text-sm font-semibold text-red-400">{formatPrice(totalDue)} due</div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/50 border border-border rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${activeTab === t.key ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === t.key ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Invoices Tab ── */}
      {activeTab === "invoices" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-secondary/40 border-b border-border">
                    {["Invoice", "Date", "Due Date", "Amount", "Status", "Actions"].map(h => (
                      <th key={h} className={`px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide ${h === "Actions" ? "text-right" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {invoices.length === 0 ? (
                    <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      No invoices yet.
                    </td></tr>
                  ) : invoices.map(inv => {
                    const ds = inv.displayStatus || inv.status;
                    const cfg = STATUS_CONFIG[ds] ?? STATUS_CONFIG.unpaid;
                    const Icon = cfg.icon;
                    const eligible = isRefundEligible(inv);
                    return (
                      <tr key={inv.id} className="hover:bg-secondary/20 transition-colors cursor-pointer" onClick={() => setLocation(`/client/invoices/${inv.id}`)}>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-primary/5 rounded-lg flex items-center justify-center shrink-0">
                              <Receipt size={14} className="text-primary" />
                            </div>
                            <div>
                              <p className="font-semibold text-foreground text-sm">{inv.invoiceNumber}</p>
                              <p className="text-[10px] text-muted-foreground capitalize">{(inv.invoiceType || "hosting").replace(/_/g, " ")}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-muted-foreground">{format(new Date(inv.createdAt), "MMM d, yyyy")}</td>
                        <td className="px-4 py-3.5 text-sm text-muted-foreground">{format(new Date(inv.dueDate), "MMM d, yyyy")}</td>
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-foreground text-sm"><InvAmount inv={inv} /></p>
                          {inv.currencyCode !== "PKR" && (
                            <p className="text-[10px] text-muted-foreground">{inv.currencyCode}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
                            <Icon size={10} />{cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5 justify-end">
                            <Button size="sm" variant="outline" className="h-7 px-2.5 gap-1 text-xs"
                              onClick={() => setLocation(`/client/invoices/${inv.id}`)}>
                              <Eye size={11} /> View
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 px-2.5 gap-1 text-xs"
                              onClick={() => setLocation(`/client/invoices/${inv.id}`)}>
                              <Download size={11} /> PDF
                            </Button>
                            {(inv.status === "unpaid" || inv.status === "overdue") && (
                              <Button size="sm" className="h-7 px-2.5 bg-primary hover:bg-primary/90 gap-1 text-xs"
                                onClick={() => handlePay(inv.id)}>
                                <CreditCard size={11} /> Pay
                              </Button>
                            )}
                            {eligible && (
                              <Button size="sm" variant="outline"
                                className="h-7 px-2.5 gap-1 text-xs border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                                onClick={() => setRefundTarget(inv)}>
                                <RotateCcw size={11} /> Refund
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
      )}

      {/* ── Transactions Tab ── */}
      {activeTab === "transactions" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          {/* Search bar */}
          <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
            <Search size={15} className="text-muted-foreground shrink-0" />
            <input
              value={txSearch}
              onChange={e => setTxSearch(e.target.value)}
              placeholder="Search by ID, method, or status…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {txSearch && (
              <button onClick={() => setTxSearch("")} className="text-xs text-muted-foreground hover:text-foreground">
                Clear
              </button>
            )}
          </div>
          {txLoading ? (
            <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-secondary/40 border-b border-border">
                    {["Date", "Transaction ID", "Method", "Amount", "Status"].map(h => (
                      <th key={h} className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredTx.length === 0 ? (
                    <tr><td colSpan={5} className="p-12 text-center text-muted-foreground">
                      <Banknote className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      {txSearch ? `No transactions match "${txSearch}".` : "No transactions yet."}
                    </td></tr>
                  ) : filteredTx.map(tx => {
                    const txCfg = TX_STATUS_CONFIG[tx.status] ?? TX_STATUS_CONFIG.pending;
                    return (
                      <tr key={tx.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3.5 text-sm text-muted-foreground">
                          {format(new Date(tx.createdAt), "MMM d, yyyy")}
                          <p className="text-[10px]">{format(new Date(tx.createdAt), "h:mm a")}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-mono text-xs text-foreground">{tx.transactionRef || tx.id.slice(0, 12) + "…"}</p>
                          {tx.invoiceId && (
                            <button className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                              onClick={() => setLocation(`/client/invoices/${tx.invoiceId}`)}>
                              View invoice <ChevronRight size={9} />
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                            <CreditCard size={13} className="text-muted-foreground" />
                            {METHOD_LABELS[tx.method] ?? tx.method}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-foreground text-sm">{formatPrice(tx.amount)}</td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${txCfg.color}`}>
                            {txCfg.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Refunds Tab ── */}
      {activeTab === "refunds" && (
        <div className="space-y-4">
          {/* Info banner */}
          <div className="flex items-start gap-3 p-4 bg-card border border-border rounded-2xl">
            <ArrowDownCircle size={18} className="text-primary mt-0.5 shrink-0" />
            <div className="text-sm space-y-0.5">
              <p className="font-medium text-foreground">30-Day Money-Back Policy</p>
              <p className="text-muted-foreground text-xs">Refunds can be requested within 30 days of payment. Once submitted, our billing team will review within 3–5 business days. Approved refunds are returned to the original payment method.</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-secondary/40 border-b border-border">
                    {["Invoice", "Paid Date", "Amount", "Reason", "Status"].map(h => (
                      <th key={h} className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {refundInvoices.length === 0 ? (
                    <tr><td colSpan={5} className="p-12 text-center text-muted-foreground">
                      <RotateCcw className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">No refund requests yet.</p>
                      <p className="text-xs mt-1">Eligible paid invoices will show a Refund button on the Invoices tab.</p>
                    </td></tr>
                  ) : refundInvoices.map(inv => {
                    const ds = inv.displayStatus || inv.status;
                    const cfg = STATUS_CONFIG[ds] ?? STATUS_CONFIG.refund_pending;
                    const Icon = cfg.icon;
                    const reason = inv.paymentNotes?.startsWith("REFUND_REQUEST:")
                      ? inv.paymentNotes.slice("REFUND_REQUEST:".length).trim()
                      : "—";
                    return (
                      <tr key={inv.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-foreground text-sm">{inv.invoiceNumber}</p>
                          <p className="text-[10px] text-muted-foreground">{format(new Date(inv.createdAt), "MMM d, yyyy")}</p>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-muted-foreground">
                          {inv.paidDate ? format(new Date(inv.paidDate), "MMM d, yyyy") : "—"}
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-foreground text-sm"><InvAmount inv={inv} /></td>
                        <td className="px-4 py-3.5 max-w-xs">
                          <p className="text-sm text-muted-foreground truncate">{reason}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
                            <Icon size={10} />{cfg.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {refundTarget && (
        <RefundModal
          invoice={refundTarget}
          onClose={() => setRefundTarget(null)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["client-invoices"] })}
        />
      )}
    </div>
  );
}
