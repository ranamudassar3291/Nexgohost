import { useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Download, CreditCard, CheckCircle, Clock, XCircle,
  Printer, Send, AlertCircle, Loader2, Wallet, FileDown, Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useCurrency } from "@/context/CurrencyProvider";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InvoiceItem { description: string; quantity: number; unitPrice: number; total: number; }
interface Invoice {
  id: string; invoiceNumber: string; clientId: string; clientName: string;
  clientEmail?: string;
  amount: number; tax: number; total: number; status: string;
  dueDate: string; paidDate?: string;
  paymentRef?: string | null; paymentGatewayId?: string | null; paymentNotes?: string | null;
  items: InvoiceItem[]; createdAt: string;
  currencyCode?: string | null;
  currencySymbol?: string | null;
  currencyRate?: number | null;
}
interface PaymentMethod {
  id: string; name: string; type: string; description: string | null;
  publicSettings: Record<string, string | undefined>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND = "#701AFE";

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; bgClass: string; textClass: string; borderClass: string }> = {
  paid:            { label: "Paid",            icon: CheckCircle, bgClass: "bg-emerald-50",  textClass: "text-emerald-700",  borderClass: "border-emerald-300" },
  unpaid:          { label: "Unpaid",          icon: Clock,       bgClass: "bg-amber-50",    textClass: "text-amber-700",    borderClass: "border-amber-300"   },
  payment_pending: { label: "Pending Review",  icon: Clock,       bgClass: "bg-sky-50",      textClass: "text-sky-700",      borderClass: "border-sky-300"     },
  cancelled:       { label: "Cancelled",       icon: XCircle,     bgClass: "bg-slate-100",   textClass: "text-slate-600",    borderClass: "border-slate-300"   },
  overdue:         { label: "Overdue",         icon: AlertCircle, bgClass: "bg-red-50",      textClass: "text-red-700",      borderClass: "border-red-300"     },
};

const TYPE_ICONS: Record<string, string> = {
  jazzcash: "📱", easypaisa: "💚", bank_transfer: "🏦",
  paypal: "🅿️", stripe: "💳", crypto: "₿", manual: "✍️", safepay: "🔐",
};

// ─── Payment Instructions sub-component ───────────────────────────────────────

function PaymentInstructions({ method }: { method: PaymentMethod }) {
  const s = method.publicSettings ?? {};
  const isWallet = ["jazzcash", "easypaisa"].includes(method.type);

  // Safepay: hosted checkout — no manual details needed
  if (method.type === "safepay") {
    return (
      <p className="text-xs text-slate-500">
        You'll be redirected to Safepay's secure hosted checkout page to complete your payment.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {/* Receiver name + number — always bold and prominent */}
      {(s.accountTitle || s.mobileNumber || s.accountNumber) && (
        <div className="rounded-lg bg-[#701AFE]/5 border border-[#701AFE]/20 p-3 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#701AFE]/70">
            {isWallet ? "Send Payment To" : "Transfer To"}
          </p>
          {s.accountTitle && (
            <p className="text-sm font-extrabold text-slate-900">{s.accountTitle}</p>
          )}
          {s.mobileNumber && (
            <p className="text-base font-black text-[#701AFE] tracking-wide">{s.mobileNumber}</p>
          )}
          {s.accountNumber && !s.mobileNumber && (
            <p className="text-base font-black text-[#701AFE] tracking-wide">{s.accountNumber}</p>
          )}
          {s.bankName && (
            <p className="text-xs text-slate-500">{s.bankName}</p>
          )}
        </div>
      )}
      {/* Additional fields */}
      {[
        s.iban && { label: "IBAN", value: s.iban },
        s.swiftCode && { label: "SWIFT", value: s.swiftCode },
        s.paypalEmail && { label: "PayPal", value: s.paypalEmail },
        s.walletAddress && { label: "Wallet", value: s.walletAddress },
        s.cryptoType && { label: "Coin", value: s.cryptoType },
        s.instructions && { label: "Note", value: s.instructions },
      ].filter(Boolean).map((r: any) => (
        <div key={r.label} className="flex items-start justify-between gap-4 text-xs">
          <span className="text-slate-400 shrink-0">{r.label}</span>
          <span className="font-medium text-slate-700 text-right break-all">{r.value}</span>
        </div>
      ))}
      {!s.accountTitle && !s.mobileNumber && !s.accountNumber && (
        <p className="text-xs text-slate-500">Contact support for payment details.</p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const paymentRef = useRef<HTMLDivElement>(null);
  const { formatPrice } = useCurrency();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedGateway, setSelectedGateway] = useState<string>("");
  const [txRef, setTxRef] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [payingWithCredits, setPayingWithCredits] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [safepayInitiating, setSafepayInitiating] = useState(false);

  const { data: invoice, isLoading } = useQuery<Invoice>({
    queryKey: ["invoice", id],
    queryFn: () => apiFetch(`/api/my/invoices/${id}`),
    enabled: !!id,
  });

  const { data: paymentMethods = [] } = useQuery<PaymentMethod[]>({
    queryKey: ["payment-methods"],
    queryFn: () => apiFetch("/api/payment-methods"),
  });

  const { data: credits } = useQuery<{ creditBalance: string }>({
    queryKey: ["my-credits"],
    queryFn: () => apiFetch("/api/my/credits"),
  });

  const creditBalance = parseFloat(credits?.creditBalance ?? "0");

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    setDownloading(true);
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`/api/my/invoices/${id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Noehost-Invoice-${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const handlePayWithCredits = async () => {
    if (!invoice) return;
    setPayingWithCredits(true);
    try {
      await apiFetch(`/api/my/invoices/${id}/pay-with-credits`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      qc.invalidateQueries({ queryKey: ["my-credits"] });
      toast({ title: "Paid with credits!", description: "Your invoice has been paid from your account credit balance." });
    } catch (err: any) {
      toast({ title: "Payment failed", description: err.message, variant: "destructive" });
    } finally {
      setPayingWithCredits(false);
    }
  };

  const handleSafepayPay = async () => {
    if (!invoice) return;
    setSafepayInitiating(true);
    try {
      const data = await apiFetch(`/api/payments/safepay/initiate`, {
        method: "POST",
        body: JSON.stringify({ invoiceId: invoice.id }),
      });
      if (data?.checkoutUrl) {
        // Clean redirect — replaces current history entry so back button returns to invoices
        window.location.assign(data.checkoutUrl);
        // Keep spinner active during navigation
        return;
      } else {
        throw new Error("No checkout URL returned. Please try again.");
      }
    } catch (err: any) {
      const msg: string = err.message ?? "";
      const isNetwork  = /fetch|network|timeout/i.test(msg);
      const isOnboard  = /setup mode|onboarding|not live|not active|pending/i.test(msg);

      toast({
        title: isNetwork ? "Connection Error"
             : isOnboard ? "Safepay Not Available"
             : "Payment Gateway Error",
        description: isNetwork
          ? "Could not reach the payment server. Please check your connection and try again."
          : isOnboard
          ? "Safepay is currently in setup mode. Please use your Wallet balance or select another payment method."
          : (msg || "Failed to initiate Safepay payment. Please try again or use another payment method."),
        variant: "destructive",
      });
      setSafepayInitiating(false);
    }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGateway || !txRef.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/my/invoices/${id}/submit-payment`, {
        method: "POST",
        body: JSON.stringify({ paymentRef: txRef.trim(), paymentGatewayId: selectedGateway, paymentNotes: senderPhone.trim() || undefined }),
      });
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      toast({ title: "Payment submitted!", description: "We'll verify and confirm your payment shortly." });
      setTxRef(""); setSenderPhone(""); setSelectedGateway("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return (
    <div className="flex justify-center p-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  if (!invoice) return (
    <div className="text-center py-12">
      <p className="text-slate-500">Invoice not found.</p>
      <Button variant="outline" className="mt-4" onClick={() => setLocation("/client/invoices")}>Back to Invoices</Button>
    </div>
  );

  const statusCfg = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.unpaid;
  const StatusIcon = statusCfg.icon;
  const isPaid = invoice.status === "paid";
  const isPaymentPending = invoice.status === "payment_pending";
  const isUnpaid = ["unpaid", "overdue"].includes(invoice.status);
  const canPay = isUnpaid;

  // Credit deduction shown when invoice is unpaid and user has credits
  const creditApplicable = canPay && creditBalance > 0;
  const creditApplied = creditApplicable ? Math.min(creditBalance, Number(invoice.total)) : 0;
  const amountAfterCredit = Number(invoice.total) - creditApplied;

  // JazzCash / EasyPaisa methods
  const mobileWalletMethods = paymentMethods.filter(pm => ["jazzcash", "easypaisa"].includes(pm.type));
  const otherMethods = paymentMethods.filter(pm => !["jazzcash", "easypaisa"].includes(pm.type));

  // Detect the type of the currently selected gateway
  const selectedMethodObj = paymentMethods.find(pm => pm.id === selectedGateway);
  const selectedMethodType = selectedMethodObj?.type ?? "";

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-4">

      {/* Toolbar */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/client/invoices")} className="gap-2 text-slate-600 hover:text-slate-900">
          <ArrowLeft size={16} /> Back to Invoices
        </Button>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2 text-slate-600">
            <Printer size={15} /> Print
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={handleDownloadPdf} disabled={downloading}
            className="gap-2 border-[#701AFE]/30 text-[#701AFE] hover:bg-[#701AFE]/5"
          >
            {downloading ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
            {downloading ? "Generating…" : "Download PDF"}
          </Button>
          {canPay && (
            <Button
              size="sm"
              onClick={() => paymentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              style={{ background: BRAND }}
              className="gap-2 text-white hover:opacity-90"
            >
              <CreditCard size={15} /> Pay Now
            </Button>
          )}
        </div>
      </div>

      {/* ── INVOICE DOCUMENT ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-xl shadow-black/10 overflow-hidden border border-slate-200/80 print:shadow-none print:border-none">

        {/* ── HEADER BAND ─────────────────────────────────────────────────────── */}
        <div style={{ background: BRAND }} className="px-8 py-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-white font-black text-2xl tracking-tight leading-none">N</span>
              <span className="text-white/90 font-semibold text-2xl tracking-tight leading-none">oehost</span>
            </div>
            <p className="text-white/65 text-[11px] font-medium">Professional Hosting Solutions</p>
            <p className="text-white/50 text-[10px] mt-0.5">billing@noehost.com</p>
          </div>
          <div className="text-right flex flex-col items-end gap-2">
            <div>
              <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest">Invoice</p>
              <p className="text-white font-black text-3xl leading-tight">#{invoice.invoiceNumber}</p>
            </div>
            {/* Status badge — red pill for unpaid/overdue, elegant for others */}
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${
              isUnpaid
                ? "bg-red-500 text-white border-red-400"
                : `${statusCfg.bgClass} ${statusCfg.textClass} ${statusCfg.borderClass}`
            }`}>
              <StatusIcon size={11} />
              {statusCfg.label}
            </div>
          </div>
        </div>

        {/* ── DATE ROW ─────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 divide-x divide-slate-200 border-b border-slate-200 bg-slate-50">
          {[
            { label: "Invoice Date", value: format(new Date(invoice.createdAt), "d MMMM yyyy") },
            { label: "Due Date",     value: format(new Date(invoice.dueDate), "d MMMM yyyy") },
            { label: "Paid Date",    value: isPaid && invoice.paidDate ? format(new Date(invoice.paidDate), "d MMMM yyyy") : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="px-6 py-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
              <p className="text-sm font-bold text-slate-800">{value}</p>
            </div>
          ))}
        </div>

        {/* ── BILL FROM / BILL TO ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-200 px-0">
          <div className="px-8 py-5">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: BRAND }}>Pay To</p>
            <p className="font-bold text-slate-800 text-[15px]">Noehost</p>
            <p className="text-xs text-slate-500 mt-1">billing@noehost.com</p>
            <p className="text-xs text-slate-500">support@noehost.com</p>
            <p className="text-xs text-slate-500 mt-0.5">ns1.noehost.com / ns2.noehost.com</p>
          </div>
          <div className="px-8 py-5">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: BRAND }}>Bill To</p>
            <p className="font-bold text-slate-800 text-[15px]">{invoice.clientName || "Client"}</p>
            {invoice.clientEmail && <p className="text-xs text-slate-500 mt-1">{invoice.clientEmail}</p>}
          </div>
        </div>

        {/* ── LINE ITEMS TABLE ─────────────────────────────────────────────────── */}
        <div className="px-8 py-6">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: BRAND }}>
                <th className="text-left py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide text-white rounded-l-lg">Description</th>
                <th className="text-center py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide text-white">Qty</th>
                <th className="text-right py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide text-white">Unit Price</th>
                <th className="text-right py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide text-white rounded-r-lg">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.items || []).length > 0 ? (invoice.items || []).map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/80"}>
                  <td className="py-3 px-3 text-slate-800">{item.description}</td>
                  <td className="py-3 px-3 text-center text-slate-500">{item.quantity}</td>
                  <td className="py-3 px-3 text-right text-slate-600">{formatPrice(Number(item.unitPrice))}</td>
                  <td className="py-3 px-3 text-right font-semibold text-slate-800">{formatPrice(Number(item.total))}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 text-sm">No line items</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── TOTALS BLOCK ────────────────────────────────────────────────────── */}
        <div className="border-t border-slate-100 px-8 pb-8">
          <div className="ml-auto max-w-xs">
            <div className="space-y-2 pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="text-slate-700 font-medium">{formatPrice(Number(invoice.amount))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Tax / VAT (0%)</span>
                <span className="text-slate-700 font-medium">{formatPrice(Number(invoice.tax || 0))}</span>
              </div>
              {creditApplicable && (
                <div className="flex justify-between text-sm text-emerald-600">
                  <span className="font-medium">Account Credit Applied</span>
                  <span className="font-medium">− {formatPrice(creditApplied)}</span>
                </div>
              )}
            </div>
            <div
              className="mt-3 flex items-center justify-between rounded-xl px-4 py-3 text-white"
              style={{ background: BRAND }}
            >
              <span className="text-sm font-bold uppercase tracking-wide">Total Due</span>
              <span className="text-lg font-black">
                {creditApplicable ? formatPrice(amountAfterCredit) : formatPrice(Number(invoice.total))}
              </span>
            </div>
            {creditApplicable && (
              <p className="text-[10px] text-emerald-600 text-right mt-1.5">
                * {formatPrice(creditApplied)} account credit will be applied at checkout
              </p>
            )}
          </div>
        </div>

        {/* Payment reference info (if payment_pending) */}
        {isPaymentPending && invoice.paymentRef && (
          <div className="border-t border-sky-200 bg-sky-50 px-8 py-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
                <Clock size={15} className="text-sky-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-sky-800">Payment Under Review</p>
                <p className="text-xs text-sky-600 mt-0.5">Your payment is being verified by our team.</p>
                <div className="mt-2 text-xs text-sky-700 space-y-0.5">
                  <div className="flex gap-2"><span className="text-sky-500">Ref:</span><span className="font-mono font-semibold">{invoice.paymentRef}</span></div>
                  {invoice.paymentNotes && <div className="flex gap-2"><span className="text-sky-500">Notes:</span><span>{invoice.paymentNotes}</span></div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PAYMENT SECTION (HTML only — not printed) ──────────────────────── */}
        {canPay && (
          <div ref={paymentRef} className="border-t border-slate-200 bg-slate-50 px-8 py-7 print:hidden">

            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5">Payment Options</p>

            {/* Quick-pay CTAs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {/* Wallet Balance CTA */}
              <button
                onClick={handlePayWithCredits}
                disabled={payingWithCredits || creditBalance <= 0}
                className={`flex items-center gap-3 rounded-xl border-2 px-5 py-4 transition-all ${
                  creditBalance > 0
                    ? "border-emerald-400 bg-emerald-50 hover:bg-emerald-100 cursor-pointer"
                    : "border-slate-200 bg-white opacity-60 cursor-not-allowed"
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                  {payingWithCredits ? <Loader2 size={18} className="animate-spin text-emerald-600" /> : <Wallet size={18} className="text-emerald-600" />}
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-slate-800">Pay with Wallet Balance</p>
                  <p className="text-xs text-slate-500">
                    Available: <span className={`font-semibold ${creditBalance > 0 ? "text-emerald-600" : "text-slate-400"}`}>{formatPrice(creditBalance)}</span>
                  </p>
                </div>
              </button>

              {/* JazzCash / EasyPaisa CTA */}
              {mobileWalletMethods.length > 0 && (
                <button
                  onClick={() => setSelectedGateway(mobileWalletMethods[0].id)}
                  className={`flex items-center gap-3 rounded-xl border-2 px-5 py-4 transition-all cursor-pointer ${
                    mobileWalletMethods.some(m => m.id === selectedGateway)
                      ? "border-[#701AFE] bg-[#701AFE]/5"
                      : "border-slate-200 bg-white hover:border-[#701AFE]/50"
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-xl" style={{ background: "rgba(112,26,254,0.08)" }}>
                    <Smartphone size={18} style={{ color: BRAND }} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-800">JazzCash / EasyPaisa</p>
                    <p className="text-xs text-slate-500">Mobile wallet — instant transfer</p>
                  </div>
                </button>
              )}
            </div>

            {/* All other payment gateways */}
            {paymentMethods.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs text-slate-400 font-medium">— or choose a payment method —</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {paymentMethods.map(pm => (
                    <div
                      key={pm.id}
                      onClick={() => setSelectedGateway(selectedGateway === pm.id ? "" : pm.id)}
                      className={`bg-white border-2 rounded-xl p-4 cursor-pointer transition-all ${
                        selectedGateway === pm.id ? "border-[#701AFE] shadow-md shadow-[#701AFE]/10" : "border-slate-200 hover:border-[#701AFE]/40"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="text-lg">{TYPE_ICONS[pm.type] ?? "💳"}</span>
                        <span className="text-sm font-bold text-slate-800">{pm.name}</span>
                        {selectedGateway === pm.id && <CheckCircle size={14} className="ml-auto" style={{ color: BRAND }} />}
                      </div>
                      <PaymentInstructions method={pm} />
                    </div>
                  ))}
                </div>

                {/* Safepay: direct Pay Now button — no manual form */}
                <AnimatePresence>
                  {selectedGateway && selectedMethodType === "safepay" && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="bg-white border-2 rounded-xl p-5 space-y-4"
                      style={{ borderColor: BRAND + "33" }}
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-800">Pay Securely via Safepay</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          You'll be redirected to Safepay's secure checkout to complete your payment.
                        </p>
                      </div>
                      <div className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-200 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Amount to Pay</span>
                          <span className="text-base font-black" style={{ color: BRAND }}>
                            {formatPrice(Number(invoice.total))}
                          </span>
                        </div>
                        {invoice.currencyCode && invoice.currencyCode !== "PKR" && (
                          <p className="text-[11px] text-slate-400 text-right">
                            Settled as Rs. {Number(invoice.total).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PKR by Safepay
                          </p>
                        )}
                      </div>

                      <Button
                        type="button"
                        disabled={safepayInitiating}
                        onClick={handleSafepayPay}
                        className="w-full gap-2 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: BRAND }}
                      >
                        {safepayInitiating
                          ? <><Loader2 size={15} className="animate-spin" /> Redirecting to Safepay…</>
                          : <><CreditCard size={15} /> Pay Now with Safepay</>
                        }
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Manual payment form — only for non-Safepay methods */}
                <AnimatePresence>
                  {selectedGateway && selectedMethodType !== "safepay" && (
                    <motion.form
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      onSubmit={handleSubmitPayment}
                      className="bg-white border-2 rounded-xl p-5 space-y-4"
                      style={{ borderColor: BRAND + "33" }}
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-800">Confirm Your Payment</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          After transferring, fill in the details below and our team will verify shortly.
                        </p>
                      </div>

                      {/* Client name — read-only */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600">Client Name</label>
                        <Input
                          value={invoice?.clientName ?? ""}
                          readOnly
                          className="border-slate-200 bg-slate-50 text-slate-500 cursor-default"
                        />
                      </div>

                      {/* Sender WhatsApp/Phone */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600">Your WhatsApp / Phone Number *</label>
                        <Input
                          value={senderPhone}
                          onChange={e => setSenderPhone(e.target.value.replace(/\D/g, ""))}
                          placeholder="e.g. 923001234567"
                          inputMode="numeric"
                          required
                          className="border-slate-300 font-mono"
                        />
                        <p className="text-[11px] text-slate-400">Numbers only — no spaces, dashes or +</p>
                      </div>

                      {/* Transaction ID */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600">Transaction ID / Receipt Number *</label>
                        <Input
                          value={txRef}
                          onChange={e => setTxRef(e.target.value)}
                          placeholder="e.g. JC-1234567890 or TXN#XXXXX"
                          required
                          className="border-slate-300 font-mono"
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={submitting || !txRef.trim() || !senderPhone.trim()}
                        className="w-full gap-2 text-white"
                        style={{ background: BRAND }}
                      >
                        {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                        Submit Payment Confirmation
                      </Button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            )}

            {paymentMethods.length === 0 && creditBalance <= 0 && (
              <p className="text-sm text-slate-500 text-center py-4">No payment methods available. Please contact support.</p>
            )}
          </div>
        )}

        {/* ── CEO SIGNATURE ────────────────────────────────────────────────── */}
        <div className="border-t border-slate-100 px-8 py-5">
          <div className="flex items-center gap-4">
            {/* Signature block */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 flex-1">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">Authorized & Issued by</p>
              <p className="font-black text-[18px] leading-tight" style={{ color: BRAND }}>Muhammad Arslan</p>
              <p className="text-[12px] font-semibold text-slate-700 mt-0.5">Founder & CEO, Noehost</p>
              <p className="text-[11px] italic text-slate-400 mt-1.5">
                "Empowering your digital journey with premium hosting solutions."
              </p>
            </div>
            {/* Decorative brand accent */}
            <div className="hidden sm:flex flex-col items-center gap-1 shrink-0 opacity-30">
              <div className="w-0.5 h-10 rounded-full" style={{ background: BRAND }} />
              <div className="w-2 h-2 rounded-full" style={{ background: BRAND }} />
              <div className="w-0.5 h-10 rounded-full" style={{ background: BRAND }} />
            </div>
          </div>
        </div>

        {/* ── TERMS & CONDITIONS ──────────────────────────────────────────────── */}
        <div className="border-t border-slate-100 px-8 py-5 bg-slate-50/70">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Terms & Conditions</p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            All services are governed by the Noehost <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="underline text-violet-600">Terms of Service</a>. Invoices must be paid by the due date to avoid service interruption. For any billing queries, contact <span className="text-slate-600 font-medium">billing@noehost.com</span>. Thank you for choosing Noehost!
          </p>
        </div>

        {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
        <div
          className="px-8 py-5 text-center"
          style={{ background: BRAND }}
        >
          <p className="text-white font-bold text-sm">Thank you for choosing Noehost!</p>
          <p className="text-white/65 text-[11px] mt-1">
            support@noehost.com · https://noehost.com · ns1.noehost.com / ns2.noehost.com
          </p>
          <p className="text-white/40 text-[10px] mt-0.5">
            Invoice #{invoice.invoiceNumber} — Generated by Noehost Billing System
          </p>
        </div>

      </div>
    </motion.div>
  );
}
