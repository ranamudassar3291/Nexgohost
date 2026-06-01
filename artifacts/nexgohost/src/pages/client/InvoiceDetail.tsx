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
import { fmtInvNum } from "@/lib/utils";
import { useBranding } from "@/hooks/use-branding";

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
        <div className="rounded-lg bg-[#6B46C1]/5 border border-[#6B46C1]/20 p-3 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B46C1]/70">
            {isWallet ? "Send Payment To" : "Transfer To"}
          </p>
          {s.accountTitle && (
            <p className="text-sm font-extrabold text-slate-900">{s.accountTitle}</p>
          )}
          {s.mobileNumber && (
            <p className="text-base font-black text-[#6B46C1] tracking-wide">{s.mobileNumber}</p>
          )}
          {s.accountNumber && !s.mobileNumber && (
            <p className="text-base font-black text-[#6B46C1] tracking-wide">{s.accountNumber}</p>
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
  const branding = useBranding();
  const BRAND = branding.primaryColor || "#701AFE";

  // ── Legacy protection: always format using the invoice's OWN stored currency.
  // This prevents old PKR invoices from being re-converted to the session currency.
  // invFmt is defined after invoice loads; before that it falls back to PKR.
  function makeInvFmt(inv: Invoice | undefined) {
    if (!inv) return formatPrice;
    const code   = inv.currencyCode   || "PKR";
    const symbol = inv.currencySymbol || "Rs.";
    const rate   = Number(inv.currencyRate ?? 1) || 1;
    return (pkrAmount: number) => {
      const converted = pkrAmount * rate;
      // Locale map (mirrors currency-format.ts)
      const localeMap: Record<string, { locale: string; pos: "before" | "after"; sep?: string }> = {
        PKR: { locale: "en-US", pos: "before", sep: " " },
        USD: { locale: "en-US", pos: "before" },
        GBP: { locale: "en-GB", pos: "before" },
        EUR: { locale: "de-DE", pos: "after", sep: "\u00A0" },
        AED: { locale: "en-AE", pos: "before", sep: " " },
        AUD: { locale: "en-AU", pos: "before" },
        CAD: { locale: "en-CA", pos: "before" },
        INR: { locale: "en-IN", pos: "before" },
      };
      const cfg = localeMap[code] ?? { locale: "en-US", pos: "before" };
      const fmt = converted.toLocaleString(cfg.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (code === "PKR") return `Rs. ${fmt}`;
      if (cfg.pos === "after") return `${fmt}${cfg.sep ?? "\u00A0"}${symbol}`;
      return `${symbol}${cfg.sep ?? ""}${fmt}`;
    };
  }
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

  // Invoice-locked formatter — uses the stored currency from this invoice record.
  // Old PKR invoices show in PKR regardless of the user's current session currency.
  const invFmt = makeInvFmt(invoice);

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
      const result = await apiFetch(`/api/my/invoices/${id}/pay-with-credits`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      qc.invalidateQueries({ queryKey: ["my-credits"] });
      if (result?.status === "paid") {
        toast({ title: "Invoice paid!", description: "Your invoice has been fully paid from your account credit balance." });
      } else {
        toast({ title: "Credits applied!", description: "Your available credit has been applied. Please pay the remaining balance." });
      }
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

  // Credit already stored on invoice (from a previous partial apply)
  const alreadyApplied = Number((invoice as any).creditApplied ?? 0);
  // Additional credit that can still be applied from the wallet
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
            className="gap-2 border-[#6B46C1]/30 text-[#6B46C1] hover:bg-[#6B46C1]/5"
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
            {branding.logoUrl ? (
              <div className="mb-1.5 bg-white/10 rounded-xl px-3 py-2 inline-block backdrop-blur-sm">
                <img src={branding.logoUrl} alt={branding.siteName} style={{ maxHeight: 36, width: "auto", maxWidth: 180 }} />
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-white font-black text-2xl tracking-tight leading-none">{branding.siteName[0]}</span>
                <span className="text-white/90 font-semibold text-2xl tracking-tight leading-none">{branding.siteName.slice(1)}</span>
              </div>
            )}
            <p className="text-white/65 text-[11px] font-medium">{branding.siteTagline || "Professional Hosting Solutions"}</p>
            {branding.brandSupportEmail && <p className="text-white/50 text-[10px] mt-0.5">{branding.brandSupportEmail}</p>}
          </div>
          <div className="text-right flex flex-col items-end gap-2">
            <div>
              <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest">Invoice</p>
              <p className="text-white font-black text-3xl leading-tight">{fmtInvNum(invoice.invoiceNumber)}</p>
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
            <p className="font-bold text-slate-800 text-[15px]">{branding.siteName}</p>
            {branding.brandSupportEmail && <p className="text-xs text-slate-500 mt-1">{branding.brandSupportEmail}</p>}
            {branding.brandAddress && <p className="text-xs text-slate-500 mt-0.5">{branding.brandAddress}</p>}
            {branding.brandWebsite && <p className="text-xs text-slate-500 mt-0.5">{branding.brandWebsite}</p>}
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
                  <td className="py-3 px-3 text-right text-slate-600">{invFmt(Number(item.unitPrice))}</td>
                  <td className="py-3 px-3 text-right font-semibold text-slate-800">{invFmt(Number(item.total))}</td>
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
                <span className="text-slate-700 font-medium">{invFmt(Number(invoice.amount))}</span>
              </div>
              {Number(invoice.tax || 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">
                    {invoice.items?.find((it: any) =>
                      /vat|gst|tax/i.test(it.description))?.description?.replace(/\s*\(.*?\)/, "") || "Tax / VAT"}
                  </span>
                  <span className="text-slate-700 font-medium">{invFmt(Number(invoice.tax))}</span>
                </div>
              )}
              {alreadyApplied > 0 && (
                <div className="flex justify-between text-sm text-emerald-600">
                  <span className="font-medium">Credit Already Applied</span>
                  <span className="font-medium">− {invFmt(alreadyApplied)}</span>
                </div>
              )}
            </div>
            <div
              className="mt-3 flex items-center justify-between rounded-xl px-4 py-3 text-white"
              style={{ background: BRAND }}
            >
              <span className="text-sm font-bold uppercase tracking-wide">Total Due</span>
              <span className="text-lg font-black">{invFmt(Number(invoice.total))}</span>
            </div>
            {creditApplicable && (
              <p className="text-[10px] text-emerald-600 text-right mt-1.5">
                💳 {invFmt(creditApplied)} wallet credit available — click "Apply Credit" below to reduce to {invFmt(amountAfterCredit)}
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
          <div ref={paymentRef} className="border-t border-slate-200 print:hidden">

            {/* Section Header */}
            <div className="px-8 py-5 flex items-center gap-3 border-b border-slate-100 bg-slate-50">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: BRAND + "18" }}>
                <CreditCard size={15} style={{ color: BRAND }} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Complete Payment</p>
                <p className="text-xs text-slate-500">Choose a payment method to pay {creditApplicable ? invFmt(amountAfterCredit) : invFmt(Number(invoice.total))}</p>
              </div>
            </div>

            <div className="px-8 py-6 space-y-5">

              {/* ── Quick Pay: Wallet Balance ── */}
              {creditApplicable && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">Instant Pay</p>
                  <button
                    onClick={handlePayWithCredits}
                    disabled={payingWithCredits}
                    className="w-full flex items-center gap-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 px-5 py-4 transition-all cursor-pointer group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-emerald-100 group-hover:bg-emerald-200 flex items-center justify-center shrink-0 transition-colors">
                      {payingWithCredits ? <Loader2 size={20} className="animate-spin text-emerald-600" /> : <Wallet size={20} className="text-emerald-600" />}
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-sm font-bold text-slate-800">
                        {creditBalance >= Number(invoice.total) ? "Pay with Wallet Balance" : "Apply Wallet Credit"}
                      </p>
                      <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                        {formatPrice(creditBalance)} available ·{" "}
                        {creditBalance >= Number(invoice.total)
                          ? "Covers full amount — invoice will be closed"
                          : `Invoice reduces to ${invFmt(amountAfterCredit)} after applying`}
                      </p>
                    </div>
                    <div className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-lg shrink-0">
                      {payingWithCredits ? "Processing…" : creditBalance >= Number(invoice.total) ? "Pay Now" : "Apply Credit"}
                    </div>
                  </button>
                </div>
              )}

              {/* ── Local Payments (JazzCash / EasyPaisa / Bank) ── */}
              {mobileWalletMethods.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">Local / Mobile Wallet</p>
                  <div className="space-y-2">
                    {mobileWalletMethods.map(pm => {
                      const isSel = selectedGateway === pm.id;
                      const isJazz = pm.type === "jazzcash";
                      const accentColor = isJazz ? "#f0612e" : "#3bb54a";
                      const accentBg    = isJazz ? "#f0612e14" : "#3bb54a14";
                      return (
                        <div key={pm.id}>
                          <div
                            onClick={() => setSelectedGateway(isSel ? "" : pm.id)}
                            className={`flex items-center gap-4 rounded-2xl border-2 px-5 py-4 cursor-pointer transition-all ${
                              isSel ? "shadow-md" : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                            style={isSel ? { borderColor: accentColor, background: accentBg } : {}}
                          >
                            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: accentColor + "20" }}>
                              <Smartphone size={20} style={{ color: accentColor }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-800">{pm.name}</p>
                              {pm.publicSettings?.mobileNumber && (
                                <p className="text-base font-black mt-0.5" style={{ color: accentColor }}>
                                  {pm.publicSettings.mobileNumber}
                                </p>
                              )}
                              {pm.publicSettings?.accountTitle && (
                                <p className="text-xs text-slate-500">{pm.publicSettings.accountTitle}</p>
                              )}
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                              isSel ? "border-transparent" : "border-slate-300"
                            }`} style={isSel ? { background: accentColor } : {}}>
                              {isSel && <CheckCircle size={12} className="text-white" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── International / Card Payments ── */}
              {otherMethods.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">Card & International</p>
                  <div className="space-y-2">
                    {otherMethods.map(pm => {
                      const isSel = selectedGateway === pm.id;
                      const isBank = pm.type === "bank_transfer";
                      return (
                        <div key={pm.id}>
                          <div
                            onClick={() => setSelectedGateway(isSel ? "" : pm.id)}
                            className={`flex items-center gap-4 rounded-2xl border-2 px-5 py-4 cursor-pointer transition-all ${
                              isSel ? "border-[#6B46C1] bg-[#6B46C1]/5 shadow-md shadow-[#6B46C1]/10" : "border-slate-200 bg-white hover:border-[#6B46C1]/30"
                            }`}
                          >
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-xl ${
                              pm.type === "safepay" ? "bg-[#5046e4]/10" : pm.type === "stripe" ? "bg-[#635bff]/10" : "bg-blue-500/10"
                            }`}>
                              {pm.type === "safepay" ? (
                                <span className="text-[#5046e4] text-lg">🔐</span>
                              ) : pm.type === "stripe" ? (
                                <CreditCard size={20} className="text-[#635bff]" />
                              ) : isBank ? (
                                <span className="text-blue-500 text-lg">🏦</span>
                              ) : (
                                <span className="text-lg">{TYPE_ICONS[pm.type] ?? "💳"}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-slate-800">{pm.name}</p>
                                {["safepay", "stripe"].includes(pm.type) && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-green-500/15 text-green-600">⚡ Instant</span>
                                )}
                              </div>
                              {pm.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{pm.description}</p>}
                              {isBank && pm.publicSettings?.bankName && (
                                <p className="text-xs font-semibold text-slate-600 mt-0.5">{pm.publicSettings.bankName} · {pm.publicSettings.accountTitle}</p>
                              )}
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                              isSel ? "bg-[#6B46C1] border-[#6B46C1]" : "border-slate-300"
                            }`}>
                              {isSel && <CheckCircle size={12} className="text-white" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Safepay CTA ── */}
              <AnimatePresence>
                {selectedGateway && selectedMethodType === "safepay" && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="rounded-2xl border border-[#6B46C1]/20 bg-[#6B46C1]/3 p-5 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-800">Pay Securely via Safepay</p>
                        <p className="text-xs text-slate-500 mt-0.5">You'll be redirected to complete payment.</p>
                      </div>
                      <span className="text-lg font-black" style={{ color: BRAND }}>{invFmt(Number(invoice.total))}</span>
                    </div>
                    {invoice.currencyCode && invoice.currencyCode !== "PKR" && (
                      <p className="text-[11px] text-slate-400">
                        Settled as Rs. {Number(invoice.total).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PKR by Safepay
                      </p>
                    )}
                    <Button
                      type="button"
                      disabled={safepayInitiating}
                      onClick={handleSafepayPay}
                      className="w-full gap-2 text-white h-12 rounded-xl font-bold text-sm"
                      style={{ background: BRAND }}
                    >
                      {safepayInitiating
                        ? <><Loader2 size={16} className="animate-spin" /> Redirecting to Safepay…</>
                        : <><CreditCard size={16} /> Pay {invFmt(Number(invoice.total))} with Safepay</>
                      }
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Manual Payment Proof Form ── */}
              <AnimatePresence>
                {selectedGateway && selectedMethodType !== "safepay" && (
                  <motion.form
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    onSubmit={handleSubmitPayment}
                    className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4"
                  >
                    <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-800">
                        <p className="font-semibold">After transferring payment:</p>
                        <p className="mt-0.5 text-amber-700">Submit your transaction ID below. Our team verifies within 24 hours and activates your service.</p>
                      </div>
                    </div>

                    {/* Payment details summary */}
                    {selectedMethodObj && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <PaymentInstructions method={selectedMethodObj} />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Your WhatsApp / Phone *</label>
                      <Input
                        value={senderPhone}
                        onChange={e => setSenderPhone(e.target.value.replace(/\D/g, ""))}
                        placeholder="923001234567"
                        inputMode="numeric"
                        required
                        className="border-slate-200 font-mono h-11 rounded-xl"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Transaction ID / Receipt Number *</label>
                      <Input
                        value={txRef}
                        onChange={e => setTxRef(e.target.value)}
                        placeholder="e.g. JC-1234567890"
                        required
                        className="border-slate-200 font-mono h-11 rounded-xl"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={submitting || !txRef.trim() || !senderPhone.trim()}
                      className="w-full gap-2 text-white h-12 rounded-xl font-bold"
                      style={{ background: BRAND }}
                    >
                      {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      Submit Payment Confirmation
                    </Button>
                  </motion.form>
                )}
              </AnimatePresence>

              {paymentMethods.length === 0 && creditBalance <= 0 && (
                <div className="text-center py-6">
                  <CreditCard size={32} className="mx-auto text-slate-200 mb-3" />
                  <p className="text-sm text-slate-500">No payment methods available. Please contact support.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ISSUED BY / BRAND STAMP ────────────────────────────────────────── */}
        <div className="border-t border-slate-100 px-8 py-5">
          <div className="flex items-center gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 flex-1">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">Authorized & Issued by</p>
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt={branding.siteName} style={{ maxHeight: 28, width: "auto", maxWidth: 160 }} className="mb-1" />
              ) : (
                <p className="font-black text-[18px] leading-tight" style={{ color: BRAND }}>{branding.siteName}</p>
              )}
              {branding.invoiceFooterText && (
                <p className="text-[11px] italic text-slate-400 mt-1.5">"{branding.invoiceFooterText}"</p>
              )}
            </div>
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
            All services are governed by the {branding.siteName}{" "}
            <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="underline text-violet-600">Terms of Service</a>.
            {" "}Invoices must be paid by the due date to avoid service interruption.
            {branding.brandSupportEmail && <> For any billing queries, contact <span className="text-slate-600 font-medium">{branding.brandSupportEmail}</span>.</>}
            {" "}Thank you for choosing {branding.siteName}!
          </p>
        </div>

        {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
        <div className="px-8 py-5 text-center" style={{ background: BRAND }}>
          <p className="text-white font-bold text-sm">Thank you for choosing {branding.siteName}!</p>
          <p className="text-white/65 text-[11px] mt-1">
            {[branding.brandSupportEmail, branding.brandWebsite].filter(Boolean).join(" · ")}
          </p>
          <p className="text-white/40 text-[10px] mt-0.5">
            Invoice #{invoice.invoiceNumber} — Generated by {branding.siteName} Billing System
          </p>
        </div>

      </div>
    </motion.div>
  );
}
