/**
 * /cart/hosting — Hostinger-style Hosting Plan Cart Page
 * Steps: 1. Plan Selection → 2. Domain Setup → 3. Payment
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  Server, Check, ChevronDown, ChevronUp, Globe, Shield, Zap, HardDrive,
  Mail, Database, Tag, Gift, Loader2, AlertCircle, Lock, Search, X,
  CreditCard, Landmark, Smartphone, Wallet, Bitcoin, ArrowRight,
  Star, CheckCircle2, Eye, EyeOff, RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/context/CurrencyProvider";
import { useAuth } from "@/hooks/use-auth";

const BRAND = "#6B46C1";
const G = "linear-gradient(135deg,#6B46C1 0%,#8B5CF6 100%)";

type Cycle = "monthly" | "quarterly" | "semiannual" | "yearly";
const CYCLE_LABELS: Record<Cycle, string> = { monthly: "Monthly", quarterly: "3 Months", semiannual: "6 Months", yearly: "Yearly" };
const CYCLE_SUFFIX: Record<Cycle, string> = { monthly: "/mo", quarterly: "/3mo", semiannual: "/6mo", yearly: "/yr" };
const CYCLE_MONTHS: Record<Cycle, number> = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 };

interface Plan {
  id: string; name: string; description: string | null;
  price: number; yearlyPrice: number | null; quarterlyPrice: number | null; semiannualPrice: number | null;
  renewalPrice: number | null; renewalEnabled: boolean;
  diskSpace: string; bandwidth: string; emailAccounts: number | null; databases: number | null;
  features: string[]; freeDomainEnabled: boolean; freeDomainTlds: string[];
  saveAmount: number | null; isPopular?: boolean;
}

interface TldRow { tld: string; registerPrice: number; renewPrice: number; isFreeWithHosting: boolean; }
interface PaymentMethod {
  id: string; name: string; type: string; description: string | null; isSandbox: boolean;
  publicSettings?: Record<string, string>;
}

function authHeaders() {
  const t = localStorage.getItem("token") || localStorage.getItem("noehost_token") || "";
  return { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, { ...opts, headers: { ...authHeaders(), ...opts?.headers } });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || "Request failed");
  return d;
}

function planPrice(p: Plan, cycle: Cycle): number {
  if (cycle === "quarterly" && p.quarterlyPrice) return p.quarterlyPrice;
  if (cycle === "semiannual" && p.semiannualPrice) return p.semiannualPrice;
  if (cycle === "yearly" && p.yearlyPrice) return p.yearlyPrice;
  return p.price * CYCLE_MONTHS[cycle];
}

function availableCycles(p: Plan): Cycle[] {
  const c: Cycle[] = ["monthly"];
  if (p.quarterlyPrice) c.push("quarterly");
  if (p.semiannualPrice) c.push("semiannual");
  if (p.yearlyPrice) c.push("yearly");
  return c;
}

function PlanCard({ plan, selected, cycle, onSelect, formatPrice }: {
  plan: Plan; selected: boolean; cycle: Cycle; onSelect: () => void; formatPrice: (n: number) => string;
}) {
  const price = planPrice(plan, cycle);
  const monthly = cycle !== "monthly" ? price / CYCLE_MONTHS[cycle] : price;
  const features = plan.features?.slice(0, 5) ?? [];
  return (
    <button
      onClick={onSelect}
      className="w-full text-left rounded-2xl border-2 p-5 transition-all duration-200 relative"
      style={{
        borderColor: selected ? BRAND : plan.isPopular ? "#E9D5FF" : "#E5E7EB",
        background: selected ? "#FAF5FF" : "#fff",
        boxShadow: selected ? `0 0 0 4px #EDE9FE` : undefined,
      }}
    >
      {plan.isPopular && (
        <span className="absolute -top-3 left-5 px-3 py-0.5 rounded-full text-[11px] font-bold text-white"
          style={{ background: G }}>⭐ Most Popular</span>
      )}
      {plan.freeDomainEnabled && (
        <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
          Free Domain
        </span>
      )}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-bold text-gray-900 text-[15px]">{plan.name}</div>
          {plan.description && <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{plan.description}</div>}
        </div>
        <div className="text-right shrink-0">
          <div className="font-extrabold text-[18px]" style={{ color: BRAND }}>{formatPrice(price)}</div>
          <div className="text-[11px] text-gray-400">{formatPrice(monthly)}/mo{cycle !== "monthly" ? ` × ${CYCLE_MONTHS[cycle]}` : ""}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5 text-[12px] text-gray-600">
        <span className="flex items-center gap-1"><HardDrive size={11} className="text-purple-400"/>{plan.diskSpace} Storage</span>
        <span className="flex items-center gap-1"><Globe size={11} className="text-blue-400"/>{plan.bandwidth} BW</span>
        {plan.emailAccounts && <span className="flex items-center gap-1"><Mail size={11} className="text-pink-400"/>{plan.emailAccounts} Emails</span>}
        {plan.databases && <span className="flex items-center gap-1"><Database size={11} className="text-orange-400"/>{plan.databases} DBs</span>}
      </div>
      {features.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {features.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-0.5 text-[10px] text-gray-500 bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5">
              <Check size={8} className="text-green-500"/>{f}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

function PaymentIcon({ type }: { type: string }) {
  if (type === "stripe" || type === "card") return <CreditCard size={16} className="text-blue-500"/>;
  if (type === "bank_transfer" || type === "bank") return <Landmark size={16} className="text-gray-500"/>;
  if (type === "mobile_wallet" || type === "easypaisa" || type === "jazzcash") return <Smartphone size={16} className="text-green-500"/>;
  if (type === "crypto") return <Bitcoin size={16} className="text-amber-500"/>;
  if (type === "wallet" || type === "credits") return <Wallet size={16} className="text-purple-500"/>;
  return <CreditCard size={16} className="text-gray-400"/>;
}

export default function CartHosting() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { formatPrice, currency } = useCurrency();

  const [step, setStep] = useState<"plan" | "domain" | "payment">("plan");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [cycle, setCycle] = useState<Cycle>("yearly");

  // Domain step
  const [domainMode, setDomainMode] = useState<"register" | "existing" | "free" | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [domainChecking, setDomainChecking] = useState(false);
  const [domainAvailable, setDomainAvailable] = useState<boolean | null>(null);
  const [domainPrice, setDomainPrice] = useState(0);
  const [freeTlds, setFreeTlds] = useState<TldRow[]>([]);
  const [freeDomainName, setFreeDomainName] = useState("");
  const [freeDomainTld, setFreeDomainTld] = useState("");

  // Payment step
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [pmLoading, setPmLoading] = useState(false);
  const [selectedPm, setSelectedPm] = useState<string>("");
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [referralApplied, setReferralApplied] = useState(false);
  const [referralPct, setReferralPct] = useState(0);
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralError, setReferralError] = useState("");
  const [placing, setPlacing] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);
  const [applyCredits, setApplyCredits] = useState(false);

  // Restore state saved before login redirect
  const stateRestored = useRef(false);

  useEffect(() => {
    fetch("/api/hosting/plans").then(r => r.json()).then(data => {
      const arr: Plan[] = Array.isArray(data) ? data.map((p: any, i: number) => ({
        ...p,
        price: Number(p.price || 0),
        yearlyPrice: p.yearlyPrice ? Number(p.yearlyPrice) : null,
        quarterlyPrice: p.quarterlyPrice ? Number(p.quarterlyPrice) : null,
        semiannualPrice: p.semiannualPrice ? Number(p.semiannualPrice) : null,
        renewalPrice: p.renewalPrice ? Number(p.renewalPrice) : null,
        isPopular: i === 1,
      })) : [];
      setPlans(arr);
      // Restore pre-login cart state saved to localStorage
      if (!stateRestored.current) {
        stateRestored.current = true;
        try {
          const saved = localStorage.getItem("cart_hosting_state");
          if (saved) {
            const s = JSON.parse(saved);
            localStorage.removeItem("cart_hosting_state");
            if (s.plan && arr.length > 0) {
              const found = arr.find(p => String(p.id) === String(s.plan));
              if (found) { setSelectedPlan(found); }
              else if (arr.length > 1) setSelectedPlan(arr[1]);
              else setSelectedPlan(arr[0]);
            } else if (arr.length > 1) setSelectedPlan(arr[1]);
            else if (arr.length > 0) setSelectedPlan(arr[0]);
            if (s.cycle) setCycle(s.cycle);
            if (s.domainMode) setDomainMode(s.domainMode);
            if (s.domainInput) setDomainInput(s.domainInput);
            if (s.promoCode) setPromoCode(s.promoCode);
            if (s.freeDomainName) setFreeDomainName(s.freeDomainName);
            if (s.freeDomainTld) setFreeDomainTld(s.freeDomainTld);
            return;
          }
        } catch {}
      }
      if (arr.length > 1) setSelectedPlan(arr[1]);
      else if (arr.length > 0) setSelectedPlan(arr[0]);
    }).catch(console.warn).finally(() => setPlansLoading(false));
  }, []);

  useEffect(() => {
    if (step === "payment") {
      setPmLoading(true);
      apiFetch("/api/payment-methods").then(setPaymentMethods).catch(console.warn).finally(() => setPmLoading(false));
      if (user) {
        apiFetch("/api/my/credits").then(d => setCreditBalance(Number(d.balance || 0))).catch(() => {});
      }
    }
  }, [step, user]);

  useEffect(() => {
    if (step === "domain" && selectedPlan?.freeDomainEnabled) {
      fetch("/api/domain-search/tlds").then(r => r.json()).then((rows: TldRow[]) => {
        setFreeTlds(rows.filter(r => r.isFreeWithHosting));
      }).catch(() => {});
    }
  }, [step, selectedPlan]);

  const checkDomain = useCallback(async () => {
    if (!domainInput.trim()) return;
    setDomainChecking(true);
    setDomainAvailable(null);
    try {
      const res = await fetch(`/api/domain/search?q=${encodeURIComponent(domainInput.trim())}`);
      const results: any[] = await res.json();
      const first = results.find(r => r.domain.toLowerCase() === domainInput.toLowerCase()) || results[0];
      if (first) {
        setDomainAvailable(first.available);
        setDomainPrice(Number(first.price || first.registerPrice || 0));
      }
    } catch { toast({ title: "Check failed", variant: "destructive" }); }
    finally { setDomainChecking(false); }
  }, [domainInput, toast]);

  const applyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true); setPromoError("");
    try {
      const amount = planPrice(selectedPlan!, cycle);
      const res = await fetch(`/api/promo-codes/validate?code=${promoCode.trim()}&amount=${amount}&serviceType=hosting&billingCycle=${cycle}`);
      const d = await res.json();
      if (!res.ok || d.error) { setPromoError(d.error || "Invalid promo code"); return; }
      setPromoDiscount(d.discountAmount || Math.round(amount * (d.discountPercent / 100)));
      setPromoApplied(true);
      toast({ title: "Promo applied!", description: `${d.discountPercent ?? ""}% discount applied.` });
    } catch { setPromoError("Could not validate code"); }
    finally { setPromoLoading(false); }
  };

  const applyReferral = async () => {
    if (!referralCode.trim()) return;
    setReferralLoading(true); setReferralError("");
    try {
      const res = await fetch("/api/cart/validate-referral", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: referralCode.trim() }),
      });
      const d = await res.json();
      if (!res.ok || !d.valid) { setReferralError(d.error || "Invalid referral code"); return; }
      setReferralPct(d.discountPercent || 0);
      setReferralApplied(true);
      toast({ title: "Referral applied!", description: `${d.discountPercent}% discount applied.` });
    } catch { setReferralError("Could not validate referral"); }
    finally { setReferralLoading(false); }
  };

  // Save cart state to localStorage before login redirect, restore on mount
  const saveCartState = useCallback(() => {
    localStorage.setItem("cart_hosting_state", JSON.stringify({
      plan: selectedPlan?.id, cycle, domainMode, domainInput, domainPrice, freeDomainName, freeDomainTld, promoCode,
    }));
  }, [selectedPlan, cycle, domainMode, domainInput, domainPrice, freeDomainName, freeDomainTld, promoCode]);

  const placeOrder = async () => {
    if (!user) {
      saveCartState();
      localStorage.setItem("postLoginRedirect", "/cart/hosting");
      navigate("/client/login?redirect=/cart/hosting");
      return;
    }
    if (!selectedPm && !applyCredits) { toast({ title: "Select a payment method", variant: "destructive" }); return; }
    setPlacing(true);
    try {
      const body: any = {
        packageId: selectedPlan!.id,
        billingCycle: CYCLE_MONTHS[cycle],
        billingCycleLabel: cycle,
        paymentMethodId: selectedPm || undefined,
        applyCredits,
      };
      if (promoApplied) body.promoCode = promoCode;
      if (referralApplied && referralCode) body.referralCode = referralCode.trim().toUpperCase();
      if (domainMode === "register" && domainInput) { body.domain = domainInput; body.registerDomain = true; }
      if (domainMode === "free" && freeDomainName && freeDomainTld) { body.domain = `${freeDomainName}${freeDomainTld}`; body.registerDomain = true; body.freeDomain = true; }
      const d = await apiFetch("/api/checkout", { method: "POST", body: JSON.stringify(body) });
      // Payment routing: gateway redirect (SafePay) vs manual invoice
      const pm = paymentMethods.find(p => p.id === selectedPm);
      if (pm?.type === "safepay" && d.invoiceId) {
        try {
          const sp = await apiFetch("/api/payments/safepay/initiate", { method: "POST", body: JSON.stringify({ invoiceId: d.invoiceId }) });
          if (sp.checkoutUrl) { window.location.href = sp.checkoutUrl; return; }
        } catch {}
      }
      toast({ title: "Order placed!", description: "Redirecting to invoice…" });
      navigate(d.invoiceId ? `/dashboard/invoices/${d.invoiceId}` : "/dashboard/invoices");
    } catch (err: any) {
      toast({ title: "Order failed", description: err.message, variant: "destructive" });
    } finally { setPlacing(false); }
  };

  const subtotal = selectedPlan ? planPrice(selectedPlan, cycle) + (domainMode === "register" ? domainPrice : 0) : 0;
  const referralOff = referralApplied ? Math.round(subtotal * (referralPct / 100) * 100) / 100 : 0;
  const total = Math.max(0, subtotal - promoDiscount - referralOff - (applyCredits ? Math.min(creditBalance, subtotal) : 0));
  const cycles = selectedPlan ? availableCycles(selectedPlan) : (["monthly", "quarterly", "semiannual", "yearly"] as Cycle[]);

  return (
    <div className="min-h-screen bg-[#F8F9FB]" style={{ fontFamily: "'Inter','Plus Jakarta Sans',sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href={user ? "/dashboard" : "/"} className="flex items-center gap-2 no-underline">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-white text-[15px]" style={{ background: G }}>N</div>
            <span className="text-[17px] font-extrabold text-gray-900 tracking-tight">Noehost</span>
          </a>
          <div className="flex items-center gap-4 text-[12px] text-gray-500">
            <span className="hidden sm:flex items-center gap-1"><Shield size={13} className="text-green-500"/> SSL Secured</span>
            <span className="flex items-center gap-1"><Lock size={12} style={{ color: BRAND }}/> Secure Checkout</span>
            <span className="hidden sm:block">30-Day Money-Back</span>
          </div>
        </div>
      </header>

      {/* Step bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-0">
          {(["plan","domain","payment"] as const).map((s, i) => (
            <div key={s} className="flex items-center">
              <button
                onClick={() => { if (s === "plan" || (s === "domain" && selectedPlan)) setStep(s); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${step === s ? "text-white" : "text-gray-400 hover:text-gray-700"}`}
                style={{ background: step === s ? G : undefined }}
              >
                <span className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center font-bold ${step === s ? "bg-white/30 text-white" : "bg-gray-100 text-gray-500"}`}>{i+1}</span>
                {s === "plan" ? "Choose Plan" : s === "domain" ? "Domain Setup" : "Payment"}
              </button>
              {i < 2 && <span className="text-gray-200 mx-1">›</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main content */}
          <div className="flex-1 min-w-0">

            {/* Step 1: Plan */}
            {step === "plan" && (
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Choose Your Hosting Plan</h1>
                <p className="text-gray-500 mb-5 text-[14px]">All plans include cPanel, free SSL, 99.9% uptime guarantee.</p>

                {/* Cycle selector */}
                <div className="flex items-center gap-2 mb-6 flex-wrap">
                  {(["monthly","quarterly","semiannual","yearly"] as Cycle[]).map(c => (
                    <button key={c} onClick={() => setCycle(c)}
                      className="px-4 py-1.5 rounded-full text-[13px] font-semibold border-2 transition-all"
                      style={{ borderColor: cycle === c ? BRAND : "#E5E7EB", background: cycle === c ? BRAND : "#fff", color: cycle === c ? "#fff" : "#6B7280" }}>
                      {CYCLE_LABELS[c]}
                      {c === "yearly" && <span className="ml-1 text-[10px] bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded-full font-bold">SAVE</span>}
                    </button>
                  ))}
                </div>

                {plansLoading ? (
                  <div className="flex items-center justify-center h-40"><Loader2 size={28} className="animate-spin text-purple-400"/></div>
                ) : plans.length === 0 ? (
                  <div className="text-center py-16 text-gray-400"><Server size={40} className="mx-auto mb-3 text-gray-200"/><p>No plans found.</p></div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {plans.map(plan => (
                      <PlanCard key={plan.id} plan={plan} selected={selectedPlan?.id === plan.id} cycle={cycle} onSelect={() => setSelectedPlan(plan)} formatPrice={formatPrice}/>
                    ))}
                  </div>
                )}

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={() => selectedPlan && setStep("domain")}
                    disabled={!selectedPlan}
                    className="px-8 py-3 rounded-xl text-white font-bold text-[15px] flex items-center gap-2 disabled:opacity-40 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: G }}>
                    Continue <ArrowRight size={18}/>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Domain */}
            {step === "domain" && (
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Domain Setup</h1>
                <p className="text-gray-500 mb-6 text-[14px]">Set up a domain for your hosting account.</p>

                <div className="grid gap-4 sm:grid-cols-3 mb-8">
                  {([
                    { mode: "register" as const, icon: Globe, title: "Register New Domain", desc: "Search & register a new domain" },
                    { mode: "existing" as const, icon: Server, title: "Use Existing Domain", desc: "Point your own domain to us" },
                    ...(selectedPlan?.freeDomainEnabled ? [{ mode: "free" as const, icon: Gift, title: "Free Domain", desc: "Claim your free domain with this plan" }] : []),
                  ]).map(opt => (
                    <button key={opt.mode} onClick={() => setDomainMode(opt.mode)}
                      className="rounded-2xl border-2 p-5 text-left transition-all"
                      style={{ borderColor: domainMode === opt.mode ? BRAND : "#E5E7EB", background: domainMode === opt.mode ? "#FAF5FF" : "#fff" }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: domainMode === opt.mode ? G : "#F3F4F6" }}>
                        <opt.icon size={20} color={domainMode === opt.mode ? "#fff" : "#9CA3AF"}/>
                      </div>
                      <div className="font-bold text-gray-900 text-[14px]">{opt.title}</div>
                      <div className="text-[12px] text-gray-500 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>

                {domainMode === "register" && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <label className="block text-[13px] font-semibold text-gray-700 mb-2">Search for a domain</label>
                    <div className="flex gap-2">
                      <input value={domainInput} onChange={e => { setDomainInput(e.target.value); setDomainAvailable(null); }}
                        onKeyDown={e => e.key === "Enter" && checkDomain()}
                        placeholder="example.com" className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-[14px] outline-none focus:border-purple-400"/>
                      <button onClick={checkDomain} disabled={domainChecking || !domainInput.trim()}
                        className="px-5 py-2.5 rounded-xl text-white font-semibold text-[13px] flex items-center gap-2 disabled:opacity-50"
                        style={{ background: G }}>
                        {domainChecking ? <Loader2 size={15} className="animate-spin"/> : <Search size={15}/>} Check
                      </button>
                    </div>
                    {domainAvailable === true && (
                      <div className="mt-3 flex items-center gap-2 text-emerald-600 font-semibold text-[13px]">
                        <CheckCircle2 size={16}/> Available! {domainPrice > 0 ? `+${formatPrice(domainPrice)}` : "Free with plan"}
                      </div>
                    )}
                    {domainAvailable === false && (
                      <div className="mt-3 flex items-center gap-2 text-red-500 text-[13px]">
                        <AlertCircle size={16}/> Domain not available. Try another.
                      </div>
                    )}
                  </div>
                )}

                {domainMode === "free" && freeTlds.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <label className="block text-[13px] font-semibold text-gray-700 mb-3">Choose your free domain</label>
                    <div className="flex gap-2 mb-3">
                      <input value={freeDomainName} onChange={e => setFreeDomainName(e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase())}
                        placeholder="yourdomain" className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-[14px] outline-none focus:border-purple-400"/>
                      <select value={freeDomainTld} onChange={e => setFreeDomainTld(e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-2.5 text-[14px] outline-none focus:border-purple-400 bg-white">
                        <option value="">Select TLD</option>
                        {freeTlds.map(t => <option key={t.tld} value={t.tld}>{t.tld}</option>)}
                      </select>
                    </div>
                    {freeDomainName && freeDomainTld && (
                      <div className="flex items-center gap-2 text-emerald-600 font-semibold text-[13px]">
                        <Gift size={16}/> {freeDomainName}{freeDomainTld} — FREE with your plan!
                      </div>
                    )}
                  </div>
                )}

                {domainMode === "existing" && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <label className="block text-[13px] font-semibold text-gray-700 mb-2">Your existing domain</label>
                    <input value={domainInput} onChange={e => setDomainInput(e.target.value)}
                      placeholder="yourdomain.com" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-[14px] outline-none focus:border-purple-400"/>
                    <p className="mt-2 text-[12px] text-gray-400">You'll update your nameservers after purchase.</p>
                  </div>
                )}

                <div className="mt-8 flex items-center justify-between">
                  <button onClick={() => setStep("plan")} className="px-5 py-2.5 rounded-xl text-gray-600 font-semibold text-[14px] border border-gray-200 hover:bg-gray-50">← Back</button>
                  <button
                    onClick={() => setStep("payment")}
                    disabled={domainMode === null}
                    className="px-8 py-3 rounded-xl text-white font-bold text-[15px] flex items-center gap-2 disabled:opacity-40"
                    style={{ background: G }}>
                    Continue to Payment <ArrowRight size={18}/>
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Payment */}
            {step === "payment" && (
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Payment</h1>
                <p className="text-gray-500 mb-6 text-[14px]">Choose how you'd like to pay.</p>

                {!user && (
                  <div className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                    <AlertCircle size={18} className="text-amber-500 mt-0.5 shrink-0"/>
                    <div>
                      <div className="font-semibold text-amber-800 text-[13px]">Sign in to complete your order</div>
                      <button onClick={() => { localStorage.setItem("postLoginRedirect", "/cart/hosting"); navigate("/client/login?redirect=/cart/hosting"); }}
                        className="mt-1.5 text-[12px] font-bold text-white px-4 py-1.5 rounded-lg" style={{ background: G }}>
                        Sign In / Register
                      </button>
                    </div>
                  </div>
                )}

                {/* Promo code */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
                  <div className="font-semibold text-gray-800 text-[14px] mb-3 flex items-center gap-2"><Tag size={15} style={{ color: BRAND }}/> Promo Code</div>
                  {promoApplied ? (
                    <div className="flex items-center gap-2 text-emerald-600 font-semibold text-[13px]">
                      <CheckCircle2 size={16}/> {promoCode.toUpperCase()} — {formatPrice(promoDiscount)} off
                      <button onClick={() => { setPromoApplied(false); setPromoDiscount(0); setPromoCode(""); }} className="ml-auto text-gray-400 hover:text-red-400"><X size={14}/></button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input value={promoCode} onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError(""); }}
                        placeholder="Enter promo code" className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-[13px] outline-none focus:border-purple-400"/>
                      <button onClick={applyPromo} disabled={promoLoading || !promoCode.trim()}
                        className="px-4 py-2 rounded-xl text-white text-[13px] font-semibold disabled:opacity-50" style={{ background: G }}>
                        {promoLoading ? <Loader2 size={14} className="animate-spin"/> : "Apply"}
                      </button>
                    </div>
                  )}
                  {promoError && <p className="text-red-500 text-[12px] mt-1">{promoError}</p>}
                </div>

                {/* Referral code */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
                  <div className="font-semibold text-gray-800 text-[14px] mb-3 flex items-center gap-2"><Gift size={15} className="text-emerald-500"/> Referral Code</div>
                  {referralApplied ? (
                    <div className="flex items-center gap-2 text-emerald-600 font-semibold text-[13px]">
                      <CheckCircle2 size={16}/> {referralCode.toUpperCase()} — {referralPct}% off
                      <button onClick={() => { setReferralApplied(false); setReferralPct(0); setReferralCode(""); }} className="ml-auto text-gray-400 hover:text-red-400"><X size={14}/></button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input value={referralCode} onChange={e => { setReferralCode(e.target.value); setReferralError(""); }}
                        placeholder="Enter referral code" className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-[13px] outline-none focus:border-purple-400"/>
                      <button onClick={applyReferral} disabled={referralLoading || !referralCode.trim()}
                        className="px-4 py-2 rounded-xl text-white text-[13px] font-semibold disabled:opacity-50" style={{ background: G }}>
                        {referralLoading ? <Loader2 size={14} className="animate-spin"/> : "Apply"}
                      </button>
                    </div>
                  )}
                  {referralError && <p className="text-red-500 text-[12px] mt-1">{referralError}</p>}
                </div>

                {/* Credits */}
                {user && creditBalance > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={applyCredits} onChange={e => setApplyCredits(e.target.checked)} className="w-4 h-4 accent-purple-600"/>
                      <div>
                        <div className="font-semibold text-gray-800 text-[13px] flex items-center gap-1.5"><Wallet size={14} className="text-purple-500"/> Apply Account Credits</div>
                        <div className="text-[12px] text-gray-400">Balance: {formatPrice(creditBalance)}</div>
                      </div>
                    </label>
                  </div>
                )}

                {/* Payment methods */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
                  <div className="font-semibold text-gray-800 text-[14px] mb-3">Payment Method</div>
                  {pmLoading ? (
                    <div className="flex items-center gap-2 text-gray-400 text-[13px]"><Loader2 size={14} className="animate-spin"/> Loading…</div>
                  ) : paymentMethods.length === 0 ? (
                    <p className="text-gray-400 text-[13px]">No payment methods available.</p>
                  ) : (
                    <div className="grid gap-2">
                      {paymentMethods.map(pm => (
                        <button key={pm.id} onClick={() => setSelectedPm(pm.id)}
                          className="flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left"
                          style={{ borderColor: selectedPm === pm.id ? BRAND : "#E5E7EB", background: selectedPm === pm.id ? "#FAF5FF" : "#fff" }}>
                          <PaymentIcon type={pm.type}/>
                          <div>
                            <div className="font-semibold text-[13px] text-gray-800">{pm.name}</div>
                            {pm.description && <div className="text-[11px] text-gray-400">{pm.description}</div>}
                          </div>
                          {pm.isSandbox && <span className="ml-auto text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">TEST</span>}
                          {selectedPm === pm.id && <CheckCircle2 size={16} className="ml-auto" style={{ color: BRAND }}/>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <button onClick={() => setStep("domain")} className="px-5 py-2.5 rounded-xl text-gray-600 font-semibold text-[14px] border border-gray-200 hover:bg-gray-50">← Back</button>
                  <button
                    onClick={placeOrder}
                    disabled={placing || (!selectedPm && !applyCredits)}
                    className="px-8 py-3 rounded-xl text-white font-bold text-[16px] flex items-center gap-2 disabled:opacity-40 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    style={{ background: G }}>
                    {placing ? <Loader2 size={18} className="animate-spin"/> : <Lock size={18}/>}
                    {placing ? "Placing Order…" : `Pay ${formatPrice(total)}`}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar: Order Summary */}
          <div className="w-full lg:w-80 shrink-0">
            <div className="sticky top-20 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="font-bold text-gray-900 text-[15px] mb-4 flex items-center gap-2"><Server size={16} style={{ color: BRAND }}/> Order Summary</div>
              {selectedPlan ? (
                <>
                  <div className="rounded-xl bg-purple-50 border border-purple-100 p-3 mb-4">
                    <div className="font-bold text-gray-900 text-[14px]">{selectedPlan.name}</div>
                    <div className="text-[12px] text-gray-500 mt-0.5">{CYCLE_LABELS[cycle]} — {selectedPlan.diskSpace} disk · {selectedPlan.bandwidth} BW</div>
                    <div className="font-extrabold text-[17px] mt-2" style={{ color: BRAND }}>{formatPrice(planPrice(selectedPlan, cycle))}</div>
                  </div>
                  {(domainMode === "register" && domainAvailable && domainInput) && (
                    <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 mb-4">
                      <div className="text-[12px] font-semibold text-gray-700 flex items-center gap-1.5"><Globe size={12}/> Domain</div>
                      <div className="text-[13px] text-gray-800 mt-0.5">{domainInput}</div>
                      <div className="text-[12px] font-bold text-gray-700 mt-1">{domainPrice > 0 ? formatPrice(domainPrice) : "FREE"}</div>
                    </div>
                  )}
                  {(domainMode === "free" && freeDomainName && freeDomainTld) && (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 mb-4">
                      <div className="text-[12px] font-semibold text-emerald-700 flex items-center gap-1.5"><Gift size={12}/> Free Domain</div>
                      <div className="text-[13px] text-gray-800 mt-0.5">{freeDomainName}{freeDomainTld}</div>
                      <div className="text-[12px] font-bold text-emerald-600 mt-1">FREE</div>
                    </div>
                  )}
                  <div className="border-t border-gray-100 pt-3 space-y-1.5 text-[13px]">
                    <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
                    {promoApplied && <div className="flex justify-between text-emerald-600"><span>Promo ({promoCode})</span><span>-{formatPrice(promoDiscount)}</span></div>}
                    {referralApplied && <div className="flex justify-between text-emerald-600"><span>Referral ({referralPct}%)</span><span>-{formatPrice(referralOff)}</span></div>}
                    {applyCredits && <div className="flex justify-between text-purple-600"><span>Credits</span><span>-{formatPrice(Math.min(creditBalance, subtotal))}</span></div>}
                    <div className="flex justify-between font-extrabold text-gray-900 text-[15px] pt-2 border-t border-gray-100"><span>Total</span><span style={{ color: BRAND }}>{formatPrice(total)}</span></div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["cPanel Access","Free SSL","24/7 Support","99.9% Uptime"].map(f => (
                      <span key={f} className="text-[10px] text-gray-500 bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5 flex items-center gap-1">
                        <Check size={8} className="text-green-500"/>{f}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-6 text-gray-400 text-[13px]"><Server size={28} className="mx-auto mb-2 text-gray-200"/><p>Select a plan to continue</p></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
