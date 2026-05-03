import { useState, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import {
  FileText, CreditCard, CheckCircle, AlertCircle, Eye, Loader2,
  RefreshCcw, Banknote, Download, Clock, ChevronRight, X, RotateCcw,
  Receipt, ArrowDownCircle, Info, Search, TrendingUp, Wallet, Share2,
  BadgeCheck, AlertOctagon, Server, Calendar, HardDrive, Wifi,
  RefreshCw, Shield, ToggleLeft, ToggleRight, ExternalLink,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useCurrency } from "@/context/CurrencyProvider";
import { apiFetch } from "@/lib/api";
import { fmtInvNum } from "@/lib/utils";

const CreditsTab  = lazy(() => import("@/pages/client/Credits"));
const AffiliateTab = lazy(() => import("@/pages/client/Affiliate"));

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface Invoice {
  id: string; invoiceNumber: string; total: number; amount: number; tax: number;
  status: string; displayStatus: string; dueDate: string; paidDate?: string | null;
  createdAt: string; paymentRef?: string; paymentNotes?: string;
  currencyCode: string; currencySymbol: string; currencyRate: number;
  items: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  invoiceType?: string;
}
interface Transaction {
  id: string; invoiceId?: string; amount: number; method: string;
  status: string; transactionRef?: string; createdAt: string;
}
interface HostingService {
  id: string; planName: string; domain: string; status: string;
  billingCycle: string; nextDueDate?: string; autoRenew: boolean;
  diskUsed?: number | null; bandwidthUsed?: number | null;
  createdAt: string;
}

function localApiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  return fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } })
    .then(res => { if (!res.ok) return res.json().then(d => { throw new Error(d.error || "Request failed"); }); return res.json(); });
}

/* ── Config ─────────────────────────────────────────────────────────────────── */
type BillingTab = "invoices" | "transactions" | "refunds" | "credits" | "affiliate";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  paid:            { label: "Paid",           color: "bg-green-50 text-green-700 border-green-200",       icon: CheckCircle },
  unpaid:          { label: "Unpaid",         color: "bg-red-50 text-red-600 border-red-200",             icon: AlertCircle },
  overdue:         { label: "Overdue",        color: "bg-red-50 text-red-600 border-red-200",             icon: AlertCircle },
  payment_pending: { label: "Pending Review", color: "bg-amber-50 text-amber-700 border-amber-200",       icon: Clock },
  cancelled:       { label: "Cancelled",      color: "bg-secondary/60 text-muted-foreground border-border", icon: FileText },
  refunded:        { label: "Refunded",       color: "bg-purple-50 text-purple-700 border-purple-200",    icon: RotateCcw },
  refund_pending:  { label: "Refund Pending", color: "bg-amber-50 text-amber-700 border-amber-200",       icon: RefreshCcw },
};
const METHOD_LABELS: Record<string, string> = {
  safepay: "Safepay", jazzcash: "JazzCash", easypaisa: "Easypaisa",
  bank_transfer: "Bank Transfer", manual: "Manual", crypto: "Crypto",
  stripe: "Stripe", paypal: "PayPal",
};
const TX_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  success:  { color: "bg-green-50 text-green-700 border-green-200",     label: "Success" },
  failed:   { color: "bg-red-50 text-red-600 border-red-200",           label: "Failed" },
  pending:  { color: "bg-amber-50 text-amber-700 border-amber-200",     label: "Pending" },
  refunded: { color: "bg-purple-50 text-purple-700 border-purple-200",  label: "Refunded" },
};

/* ── Subscription Card ───────────────────────────────────────────────────────── */
const CYCLE_LABEL: Record<string, string> = {
  monthly: "Monthly", quarterly: "Quarterly", semiannual: "6-Month", yearly: "Annual",
};
const STATUS_PILL: Record<string, string> = {
  active:   "bg-green-500/10 text-green-600 border-green-200",
  suspended:"bg-red-500/10 text-red-600 border-red-200",
  pending:  "bg-amber-500/10 text-amber-600 border-amber-200",
  terminated:"bg-secondary text-muted-foreground border-border",
};

function SubscriptionCard({ svc, onToggleAutoRenew }: { svc: HostingService; onToggleAutoRenew: () => void }) {
  const [, setLocation] = useLocation();
  const daysLeft = svc.nextDueDate ? differenceInDays(new Date(svc.nextDueDate), new Date()) : null;
  const isOverdue = daysLeft !== null && daysLeft < 0;
  const isUrgent  = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
  const pillCls = STATUS_PILL[svc.status] ?? STATUS_PILL.pending;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4 hover:border-primary/30 transition-colors min-w-[280px] max-w-[320px] flex-shrink-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Server size={18} className="text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-foreground text-sm truncate">{svc.planName || "Hosting Plan"}</p>
            <p className="text-xs text-muted-foreground font-mono truncate">{svc.domain || "—"}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${pillCls}`}>
            {svc.status}
          </span>
          {svc.billingCycle && (
            <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              {CYCLE_LABEL[svc.billingCycle] ?? svc.billingCycle}
            </span>
          )}
        </div>
      </div>

      {/* Next Billing Date */}
      <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 border ${
        isOverdue ? "bg-red-500/8 border-red-200" : isUrgent ? "bg-amber-500/8 border-amber-200" : "bg-secondary/40 border-border"
      }`}>
        <Calendar size={14} className={isOverdue ? "text-red-500" : isUrgent ? "text-amber-500" : "text-muted-foreground"} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Next Billing Date</p>
          {svc.nextDueDate ? (
            <p className={`text-sm font-bold ${isOverdue ? "text-red-600" : isUrgent ? "text-amber-600" : "text-foreground"}`}>
              {format(new Date(svc.nextDueDate), "d MMM yyyy")}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </div>
        {daysLeft !== null && (
          <span className={`text-xs font-black px-2 py-1 rounded-lg ${
            isOverdue ? "bg-red-500 text-white" : isUrgent ? "bg-amber-500 text-white" : "bg-primary/10 text-primary"
          }`}>
            {isOverdue ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? "Today" : `${daysLeft}d`}
          </span>
        )}
      </div>

      {/* Usage Mini-Bars */}
      {(svc.diskUsed != null || svc.bandwidthUsed != null) && (
        <div className="space-y-2">
          {svc.diskUsed != null && (
            <div className="flex items-center gap-2 text-xs">
              <HardDrive size={11} className="text-muted-foreground shrink-0" />
              <span className="text-muted-foreground w-14 shrink-0">Disk</span>
              <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary/60 rounded-full" style={{ width: `${Math.min(100, (svc.diskUsed / 5120) * 100)}%` }} />
              </div>
              <span className="text-muted-foreground font-mono shrink-0">{svc.diskUsed >= 1024 ? `${(svc.diskUsed/1024).toFixed(1)}GB` : `${svc.diskUsed}MB`}</span>
            </div>
          )}
          {svc.bandwidthUsed != null && (
            <div className="flex items-center gap-2 text-xs">
              <Wifi size={11} className="text-muted-foreground shrink-0" />
              <span className="text-muted-foreground w-14 shrink-0">Bandwidth</span>
              <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-indigo-400/60 rounded-full" style={{ width: `${Math.min(100, (svc.bandwidthUsed / 102400) * 100)}%` }} />
              </div>
              <span className="text-muted-foreground font-mono shrink-0">{svc.bandwidthUsed >= 1024 ? `${(svc.bandwidthUsed/1024).toFixed(1)}GB` : `${svc.bandwidthUsed}MB`}</span>
            </div>
          )}
        </div>
      )}

      {/* Auto-Renew Toggle */}
      <div className="flex items-center justify-between pt-1 border-t border-border">
        <div className="flex items-center gap-2">
          <RefreshCw size={12} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Auto-Renew</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${svc.autoRenew ? "text-green-600" : "text-muted-foreground"}`}>
            {svc.autoRenew ? "On" : "Off"}
          </span>
          <button onClick={onToggleAutoRenew} className="focus:outline-none" title="Toggle auto-renew">
            {svc.autoRenew
              ? <ToggleRight size={24} className="text-green-500 hover:text-green-600 transition-colors" />
              : <ToggleLeft size={24} className="text-muted-foreground hover:text-foreground transition-colors" />
            }
          </button>
        </div>
      </div>

      {/* Manage link */}
      <button
        onClick={() => setLocation(`/client/hosting/${svc.id}`)}
        className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
      >
        Manage Service <ExternalLink size={11} />
      </button>
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function InvAmount({ inv }: { inv: Invoice }) {
  const { formatPrice } = useCurrency();
  if (inv.currencyCode && inv.currencyRate && inv.currencyRate !== 1 && inv.currencyCode !== "PKR") {
    const converted = inv.total * inv.currencyRate;
    return <span>{inv.currencySymbol}{converted.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
  }
  return <span>{formatPrice(inv.total)}</span>;
}

function SummaryCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string;
  color: "green" | "red" | "purple" | "blue";
}) {
  const clr = {
    green:  { bg: "bg-green-50",  icon: "text-green-600",  val: "text-green-700"  },
    red:    { bg: "bg-red-50",    icon: "text-red-500",    val: "text-red-600"    },
    purple: { bg: "bg-purple-50", icon: "text-purple-600", val: "text-purple-700" },
    blue:   { bg: "bg-primary/5", icon: "text-primary",    val: "text-primary"    },
  }[color];
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${clr.bg}`}>
        <Icon size={18} className={clr.icon} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
        <p className={`text-xl font-black ${clr.val} leading-none`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

/* ── Refund Modal ───────────────────────────────────────────────────────────── */
function RefundModal({ invoice, onClose, onSuccess }: { invoice: Invoice; onClose: () => void; onSuccess: () => void }) {
  const [reason, setReason] = useState("");
  const { toast } = useToast();
  const mutation = useMutation({
    mutationFn: () => localApiFetch(`/api/invoices/${invoice.id}/refund-request`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: () => {
      toast({ title: "Refund Requested", description: "Your refund request has been submitted. We'll review it within 3–5 business days." });
      onSuccess(); onClose();
    },
    onError: (err: any) => { toast({ title: "Failed", description: err.message, variant: "destructive" }); },
  });
  const paidAt = invoice.paidDate ? new Date(invoice.paidDate) : null;
  const daysLeft = paidAt ? Math.max(0, 30 - differenceInDays(new Date(), paidAt)) : 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-bold text-foreground">Request Refund</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{fmtInvNum(invoice.invoiceNumber)}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 transition-colors"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3 p-3 bg-orange-500/5 border border-orange-500/20 rounded-xl">
            <Info size={15} className="text-orange-400 mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p className="font-medium text-foreground">30-Day Money-Back Guarantee</p>
              <p>You have <span className="text-orange-400 font-semibold">{daysLeft} day{daysLeft !== 1 ? "s" : ""}</span> remaining.</p>
              <p>Refund amount: <span className="font-semibold text-foreground"><InvAmount inv={invoice} /></span></p>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Reason for Refund *</label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Please describe why you are requesting a refund…" rows={4} className="bg-background resize-none" />
          </div>
          <p className="text-xs text-muted-foreground bg-secondary/50 rounded-xl p-3">
            Requests are reviewed within 3–5 business days. Approved refunds go back to your original payment method.
          </p>
        </div>
        <div className="flex gap-2 p-5 pt-0">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!reason.trim() || mutation.isPending}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white gap-2">
            {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            Submit Request
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────────── */
export default function ClientInvoices() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { formatPrice } = useCurrency();
  const [refundTarget, setRefundTarget] = useState<Invoice | null>(null);
  const [txSearch, setTxSearch] = useState("");

  const { data: services = [] } = useQuery<HostingService[]>({
    queryKey: ["client-hosting-billing"],
    queryFn: () => apiFetch("/api/client/hosting"),
  });

  const autoRenewMutation = useMutation({
    mutationFn: ({ id, autoRenew }: { id: string; autoRenew: boolean }) =>
      apiFetch(`/api/client/hosting/${id}/auto-renew`, { method: "PUT", body: JSON.stringify({ autoRenew }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["client-hosting-billing"] }),
    onError: () => toast({ title: "Failed to update", description: "We couldn't update auto-renewal. Please refresh the page and try again.", variant: "destructive" }),
  });

  const initTab = (): BillingTab => {
    const p = new URLSearchParams(window.location.search).get("tab");
    if (p === "credits" || p === "affiliate" || p === "transactions" || p === "refunds") return p;
    return "invoices";
  };
  const [activeTab, setActiveTab] = useState<BillingTab>(initTab);

  /* ── Queries ── */
  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["client-invoices"],
    queryFn: () => localApiFetch("/api/invoices"),
  });
  const { data: transactions = [], isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ["client-transactions"],
    queryFn: () => localApiFetch("/api/payments/transactions"),
    enabled: activeTab === "transactions",
  });
  const { data: creditsData } = useQuery<{ creditBalance: string }>({
    queryKey: ["my-credits"],
    queryFn: () => apiFetch("/api/my/credits"),
  });
  const { data: affiliateData } = useQuery<{ totalEarnings: string; pendingEarnings: string } | null>({
    queryKey: ["affiliate-me"],
    queryFn: () => apiFetch("/api/affiliates/me").catch(() => null),
  });

  /* ── Computed ── */
  const paidInvoices     = invoices.filter(i => i.status === "paid");
  const unpaidInvoices   = invoices.filter(i => ["unpaid", "overdue"].includes(i.status));
  const refundInvoices   = invoices.filter(i => i.displayStatus === "refund_pending" || i.status === "refunded");
  const totalPaid        = paidInvoices.reduce((s, i) => s + Number(i.total), 0);
  const totalDue         = unpaidInvoices.reduce((s, i) => s + Number(i.total), 0);
  const creditBalance    = parseFloat(creditsData?.creditBalance ?? "0");
  const affiliateEarnings = parseFloat(affiliateData?.totalEarnings ?? "0");

  const filteredTx = txSearch.trim()
    ? transactions.filter(tx =>
        (tx.transactionRef || "").toLowerCase().includes(txSearch.toLowerCase()) ||
        (tx.method || "").toLowerCase().includes(txSearch.toLowerCase()) ||
        String(tx.amount).includes(txSearch) ||
        (tx.status || "").toLowerCase().includes(txSearch.toLowerCase()))
    : transactions;

  function isRefundEligible(inv: Invoice) {
    if (inv.status !== "paid" || inv.displayStatus === "refund_pending") return false;
    const paidAt = inv.paidDate ? new Date(inv.paidDate) : null;
    return paidAt ? differenceInDays(new Date(), paidAt) <= 30 : false;
  }

  const tabs: Array<{ key: BillingTab; label: string; icon: React.ElementType; count?: number }> = [
    { key: "invoices",     label: "Invoices",     icon: FileText,     count: invoices.length },
    { key: "transactions", label: "Transactions",  icon: CreditCard },
    { key: "refunds",      label: "Refunds",       icon: RotateCcw,    count: refundInvoices.length || undefined },
    { key: "credits",      label: "Wallet",        icon: Wallet },
    { key: "affiliate",    label: "Affiliate",     icon: Share2 },
  ];

  return (
    <div className="space-y-6">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Billing</h1>
          <p className="text-muted-foreground mt-1">Manage invoices, payments, wallet, and affiliate earnings.</p>
        </div>
        {unpaidInvoices.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertOctagon size={16} className="text-red-500 shrink-0" />
            <div>
              <div className="text-xs text-muted-foreground">{unpaidInvoices.length} unpaid invoice{unpaidInvoices.length > 1 ? "s" : ""}</div>
              <div className="text-sm font-black text-red-500">{formatPrice(totalDue)} due</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Active Subscriptions ── */}
      {services.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={15} className="text-primary" />
              <h2 className="font-bold text-foreground text-base">Active Subscriptions</h2>
              <span className="text-xs font-bold px-2 py-0.5 bg-primary/10 text-primary rounded-full">{services.length}</span>
            </div>
            <p className="text-xs text-muted-foreground">Toggle auto-renew per service</p>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none" style={{ scrollbarWidth: "none" }}>
            {services.map(svc => (
              <SubscriptionCard
                key={svc.id}
                svc={svc}
                onToggleAutoRenew={() => autoRenewMutation.mutate({ id: svc.id, autoRenew: !svc.autoRenew })}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={BadgeCheck}  label="Total Paid"        value={formatPrice(totalPaid)}       sub={`${paidInvoices.length} invoice${paidInvoices.length !== 1 ? "s" : ""}`}  color="green"  />
        <SummaryCard icon={AlertCircle} label="Outstanding"       value={formatPrice(totalDue)}        sub={`${unpaidInvoices.length} pending`}                                          color="red"    />
        <SummaryCard icon={Wallet}      label="Wallet Balance"    value={formatPrice(creditBalance)}   sub="Available credits"                                                           color="purple" />
        <SummaryCard icon={TrendingUp}  label="Affiliate Earned"  value={formatPrice(affiliateEarnings)} sub="Total commissions"                                                        color="blue"   />
      </div>

      {/* ── Tabs ── */}
      <div className="flex flex-wrap gap-1 bg-secondary/40 border border-border rounded-xl p-1">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === t.key
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={14} />
              {t.label}
              {t.count !== undefined && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === t.key ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─────────────────────── INVOICES TAB ─────────────────────────────── */}
      {activeTab === "invoices" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="divide-y divide-border/50">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-8 h-8 bg-primary/5 rounded-lg shrink-0 skeleton" />
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="skeleton h-3.5 w-28 rounded" />
                    <div className="skeleton h-3 w-16 rounded" />
                  </div>
                  <div className="skeleton h-3.5 w-20 rounded hidden sm:block" />
                  <div className="skeleton h-3.5 w-20 rounded hidden sm:block" />
                  <div className="skeleton h-5 w-16 rounded-full hidden sm:block" />
                  <div className="skeleton h-7 w-14 rounded-lg" />
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-secondary/40 border-b border-border">
                    {["Invoice", "Date", "Due Date", "Amount", "Status", "Actions"].map(h => (
                      <th key={h} className={`px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide ${h === "Actions" ? "text-right" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {invoices.length === 0 ? (
                    <tr><td colSpan={6} className="p-16 text-center text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p className="font-medium">No invoices yet</p>
                      <p className="text-xs mt-1">Your billing history will appear here.</p>
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
                              <p className="font-bold text-foreground text-sm">{fmtInvNum(inv.invoiceNumber)}</p>
                              <p className="text-[10px] text-muted-foreground capitalize">{(inv.invoiceType || "hosting").replace(/_/g, " ")}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-muted-foreground whitespace-nowrap">{format(new Date(inv.createdAt), "MMM d, yyyy")}</td>
                        <td className="px-4 py-3.5 text-sm text-muted-foreground whitespace-nowrap">{format(new Date(inv.dueDate), "MMM d, yyyy")}</td>
                        <td className="px-4 py-3.5">
                          <p className="font-black text-foreground text-sm"><InvAmount inv={inv} /></p>
                          {inv.currencyCode !== "PKR" && <p className="text-[10px] text-muted-foreground">{inv.currencyCode}</p>}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
                            <Icon size={10} />{cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5 justify-end flex-wrap">
                            <Button size="sm" variant="outline" className="h-7 px-2.5 gap-1 text-xs" onClick={() => setLocation(`/client/invoices/${inv.id}`)}>
                              <Eye size={11} /> View
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 px-2.5 gap-1 text-xs" onClick={() => setLocation(`/client/invoices/${inv.id}`)}>
                              <Download size={11} /> PDF
                            </Button>
                            {(inv.status === "unpaid" || inv.status === "overdue") && (
                              <Button size="sm" className="h-7 px-2.5 bg-primary hover:bg-primary/90 gap-1 text-xs" onClick={() => setLocation(`/client/invoices/${inv.id}`)}>
                                <CreditCard size={11} /> Pay Now
                              </Button>
                            )}
                            {eligible && (
                              <Button size="sm" variant="outline" className="h-7 px-2.5 gap-1 text-xs border-orange-500/30 text-orange-500 hover:bg-orange-500/10" onClick={() => setRefundTarget(inv)}>
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

      {/* ─────────────────────── TRANSACTIONS TAB ─────────────────────────── */}
      {activeTab === "transactions" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
            <Search size={15} className="text-muted-foreground shrink-0" />
            <input value={txSearch} onChange={e => setTxSearch(e.target.value)} placeholder="Search by ID, method, or status…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
            {txSearch && <button onClick={() => setTxSearch("")} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>}
          </div>
          {txLoading ? (
            <div className="divide-y divide-border/50">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                  <div className="skeleton h-3.5 w-20 rounded" />
                  <div className="skeleton h-3.5 w-32 rounded flex-1" />
                  <div className="skeleton h-3.5 w-20 rounded hidden sm:block" />
                  <div className="skeleton h-3.5 w-16 rounded" />
                  <div className="skeleton h-5 w-14 rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-secondary/40 border-b border-border">
                    {["Date", "Transaction ID", "Method", "Amount", "Status"].map(h => (
                      <th key={h} className="px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredTx.length === 0 ? (
                    <tr><td colSpan={5} className="p-16 text-center text-muted-foreground">
                      <Banknote className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p className="font-medium">{txSearch ? `No results for "${txSearch}"` : "No transactions yet"}</p>
                    </td></tr>
                  ) : filteredTx.map(tx => {
                    const txCfg = TX_STATUS_CONFIG[tx.status] ?? TX_STATUS_CONFIG.pending;
                    return (
                      <tr key={tx.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3.5 text-sm text-muted-foreground whitespace-nowrap">
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
                          <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                            <CreditCard size={13} className="text-muted-foreground" />
                            {METHOD_LABELS[tx.method] ?? tx.method}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-black text-foreground text-sm">{formatPrice(tx.amount)}</td>
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

      {/* ─────────────────────── REFUNDS TAB ──────────────────────────────── */}
      {activeTab === "refunds" && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-card border border-border rounded-2xl">
            <ArrowDownCircle size={18} className="text-primary mt-0.5 shrink-0" />
            <div className="text-sm space-y-0.5">
              <p className="font-semibold text-foreground">30-Day Money-Back Policy</p>
              <p className="text-muted-foreground text-xs">Refunds can be requested within 30 days of payment. Our billing team reviews within 3–5 business days. Approved refunds go back to your original payment method.</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-secondary/40 border-b border-border">
                    {["Invoice", "Paid Date", "Amount", "Reason", "Status"].map(h => (
                      <th key={h} className="px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {refundInvoices.length === 0 ? (
                    <tr><td colSpan={5} className="p-16 text-center text-muted-foreground">
                      <RotateCcw className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p className="font-medium text-sm">No refund requests yet</p>
                      <p className="text-xs mt-1">Eligible paid invoices will show a Refund button on the Invoices tab.</p>
                    </td></tr>
                  ) : refundInvoices.map(inv => {
                    const ds = inv.displayStatus || inv.status;
                    const cfg = STATUS_CONFIG[ds] ?? STATUS_CONFIG.refund_pending;
                    const Icon = cfg.icon;
                    const reason = inv.paymentNotes?.startsWith("REFUND_REQUEST:")
                      ? inv.paymentNotes.slice("REFUND_REQUEST:".length).trim() : "—";
                    return (
                      <tr key={inv.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3.5">
                          <p className="font-bold text-foreground text-sm">{fmtInvNum(inv.invoiceNumber)}</p>
                          <p className="text-[10px] text-muted-foreground">{format(new Date(inv.createdAt), "MMM d, yyyy")}</p>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-muted-foreground">{inv.paidDate ? format(new Date(inv.paidDate), "MMM d, yyyy") : "—"}</td>
                        <td className="px-4 py-3.5 font-black text-foreground text-sm"><InvAmount inv={inv} /></td>
                        <td className="px-4 py-3.5 max-w-xs"><p className="text-sm text-muted-foreground truncate">{reason}</p></td>
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

      {/* ─────────────────────── CREDITS TAB ──────────────────────────────── */}
      {activeTab === "credits" && (
        <Suspense fallback={<div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary" size={28} /></div>}>
          <CreditsTab />
        </Suspense>
      )}

      {/* ─────────────────────── AFFILIATE TAB ────────────────────────────── */}
      {activeTab === "affiliate" && (
        <Suspense fallback={<div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary" size={28} /></div>}>
          <AffiliateTab />
        </Suspense>
      )}

      {/* ── Refund Modal ── */}
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
