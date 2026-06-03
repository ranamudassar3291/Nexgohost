import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Trash2, ChevronDown, ChevronRight, ShieldCheck,
  Tag, Gift, Globe, Server, Zap, Mail, Package, Lock, CheckCircle2,
  Eye, EyeOff, User, UserPlus, Loader2, AlertCircle, CreditCard,
  Smartphone, Landmark, Shield, BadgeCheck, Search, X, Check,
  ArrowLeft, Ticket,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/context/CurrencyProvider";
import { useAuth } from "@/hooks/use-auth";
import {
  useUnifiedCart, availableCycles, getItemPrice,
  CYCLE_LABELS, CYCLE_SUFFIX, CYCLE_MONTHS,
  type BillingCycle, type UnifiedCartItem,
} from "@/context/UnifiedCartContext";
import CaptchaWidget from "@/components/CaptchaWidget";

const BRAND = "#6B46C1";
const G = "linear-gradient(135deg, #6B46C1 0%, #8B5CF6 100%)";

type Step = "cart" | "account" | "payment";

interface PaymentMethod {
  id: string; name: string; type: string; description: string | null; isSandbox: boolean;
  publicSettings?: { mobileNumber?: string; bankName?: string; accountTitle?: string; accountNumber?: string };
}

function authHeaders() {
  const t = localStorage.getItem("token") || localStorage.getItem("noehost_token") || "";
  return { "Content-Type": "application/json", Authorization: `Bearer ${t}` };
}

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, { ...opts, headers: { ...authHeaders(), ...opts?.headers } });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error || "Request failed");
  return d;
}

function ProductIcon({ type, size = 18 }: { type: string; size?: number }) {
  if (type === "vps") return <Zap size={size} className="text-amber-400" />;
  if (type === "email") return <Mail size={size} className="text-blue-400" />;
  if (type === "domain") return <Globe size={size} className="text-emerald-400" />;
  return <Server size={size} className="text-primary" />;
}

function ProductLabel({ type }: { type: string }) {
  const map: Record<string, string> = {
    hosting: "🖥️ Shared Hosting",
    vps: "⚡ VPS Server",
    email: "📧 Business Email",
    domain: "🌐 Domain",
  };
  return <span className="text-xs text-muted-foreground">{map[type] ?? "Hosting Package"}</span>;
}

function StepHeader({ num, label, active, done, onClick }: { num: number; label: string; active: boolean; done: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={done ? onClick : undefined}
      className={`w-full flex items-center gap-4 px-6 py-4 text-left transition-colors ${done && !active ? "hover:bg-gray-50 cursor-pointer" : "cursor-default"}`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all ${active ? "text-white shadow-lg" : done ? "bg-emerald-500 text-white" : "bg-gray-200 text-gray-500"}`}
        style={active ? { background: G } : {}}>
        {done && !active ? <Check size={14} /> : num}
      </div>
      <span className={`font-semibold text-sm ${active ? "text-gray-900" : done ? "text-gray-700" : "text-gray-400"}`}>{label}</span>
      {done && !active && <ChevronDown size={15} className="ml-auto text-gray-400" />}
    </button>
  );
}

export default function UnifiedCart() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { formatPrice, currency } = useCurrency();
  const { login: authLogin, user } = useAuth();
  const qc = useQueryClient();
  const {
    items, removeItem, updateCycle, updateDomain, clearCart,
    coupon, referral, couponError, referralError, couponLoading, referralLoading,
    applyCoupon, applyReferral, removeCoupon, removeReferral,
    getSubtotal, getTotal,
  } = useUnifiedCart();

  const [step, setStep] = useState<Step>("cart");
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("token") || !!localStorage.getItem("noehost_token"));

  useEffect(() => { if (user) setIsLoggedIn(true); }, [user]);

  const [couponInput, setCouponInput] = useState(coupon?.code ?? "");
  const [referralInput, setReferralInput] = useState(referral?.code ?? "");

  // Domain check state per item
  const [domainInputs, setDomainInputs] = useState<Record<string, string>>({});
  const [domainChecking, setDomainChecking] = useState<Record<string, boolean>>({});
  const [domainAvail, setDomainAvail] = useState<Record<string, "available" | "taken" | null>>({});
  const domainTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [selectedPm, setSelectedPm] = useState<string>("none");
  const [placing, setPlacing] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  // Inline auth
  const [authMode, setAuthMode] = useState<"login" | "register" | "verify">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authFirstName, setAuthFirstName] = useState("");
  const [authLastName, setAuthLastName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authShowPass, setAuthShowPass] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authTempToken, setAuthTempToken] = useState("");
  const [authVerifyCode, setAuthVerifyCode] = useState("");

  // Queries
  const { data: content } = useQuery({
    queryKey: ["site-content-cart"],
    queryFn: () => fetch("/api/content").then(r => r.json()),
    staleTime: 300_000,
  });

  const { data: paymentMethods = [] } = useQuery<PaymentMethod[]>({
    queryKey: ["payment-methods-ucart"],
    queryFn: () => fetch("/api/payment-methods", { headers: authHeaders() }).then(r => r.ok ? r.json() : []),
    enabled: isLoggedIn,
  });

  const { data: captchaConfig } = useQuery({
    queryKey: ["captcha-config"],
    queryFn: () => fetch("/api/security/captcha-config").then(r => r.json()),
    staleTime: 300_000,
  });
  const captchaRequired = !!(captchaConfig?.enabledPages?.checkout && captchaConfig?.siteKey);

  const { data: domainExtensions = [] } = useQuery<any[]>({
    queryKey: ["domain-extensions-ucart"],
    queryFn: () => fetch("/api/domain-extensions").then(r => r.json()),
    staleTime: 600_000,
  });

  const { data: creditsData } = useQuery<{ creditBalance: string }>({
    queryKey: ["my-credits-ucart"],
    queryFn: () => apiFetch("/api/my/credits"),
    enabled: isLoggedIn,
  });
  const creditBalance = parseFloat(creditsData?.creditBalance ?? "0");

  const logoUrl = content?.logoImage || content?.logoUrl || "";
  const logoText = content?.logo || "Noehost";

  const subtotal = getSubtotal();
  const total = getTotal();
  const couponDiscount = coupon?.discountAmount ?? 0;

  // ── Domain check helper ────────────────────────────────────────────────────
  function checkDomain(pkgId: string, domain: string) {
    const d = domain.trim().toLowerCase();
    if (!d || !d.includes(".")) { setDomainAvail(p => ({ ...p, [pkgId]: null })); return; }
    if (domainTimers.current[pkgId]) clearTimeout(domainTimers.current[pkgId]);
    domainTimers.current[pkgId] = setTimeout(async () => {
      setDomainChecking(p => ({ ...p, [pkgId]: true }));
      setDomainAvail(p => ({ ...p, [pkgId]: null }));
      try {
        const parts = d.split(".");
        const r = await fetch(`/api/domains/availability?domain=${encodeURIComponent(parts[0])}`, { headers: authHeaders() });
        const data = await r.json();
        if (Array.isArray(data?.results)) {
          const tld = "." + parts.slice(1).join(".");
          const match = data.results.find((x: any) => x.tld === tld) || data.results[0];
          if (match) setDomainAvail(p => ({ ...p, [pkgId]: match.available ? "available" : "taken" }));
        }
      } catch {}
      finally { setDomainChecking(p => ({ ...p, [pkgId]: false })); }
    }, 700);
  }

  function getDomainPrice(domain: string): number {
    if (!domain || !domain.includes(".")) return 0;
    const parts = domain.split(".");
    const long = "." + parts.slice(-2).join(".");
    const short = "." + parts[parts.length - 1];
    const ext = domainExtensions.find(e => e.extension === long) || domainExtensions.find(e => e.extension === short);
    if (!ext) return 0;
    return domain.toLowerCase().endsWith(".pk") ? Number(ext.register2YearPrice ?? ext.registerPrice ?? 0) : Number(ext.registerPrice ?? 0);
  }

  // ── Inline Auth ────────────────────────────────────────────────────────────
  async function handleAuth() {
    setAuthError("");
    if (!authEmail.trim() || !authPassword.trim()) { setAuthError("Email and password required."); return; }
    if (authMode === "register" && !authFirstName.trim()) { setAuthError("First name required."); return; }
    setAuthLoading(true);
    try {
      if (authMode === "register") {
        const r = await fetch("/api/auth/register", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: authEmail.trim(), password: authPassword, firstName: authFirstName.trim(), lastName: authLastName.trim(), phone: authPhone.trim() }),
        });
        const d = await r.json();
        if (!r.ok) { setAuthError(d.error ?? d.message ?? "Registration failed."); return; }
        if (d.requiresVerification && d.token) { setAuthTempToken(d.token); setAuthMode("verify"); return; }
      }
      const r = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail.trim(), password: authPassword }),
      });
      const d = await r.json();
      if (d.requiresVerification && d.tempToken) { setAuthTempToken(d.tempToken); setAuthMode("verify"); return; }
      if (!r.ok) { setAuthError(d.error ?? d.message ?? "Login failed."); return; }
      authLogin(d.token);
      setIsLoggedIn(true);
      qc.invalidateQueries();
      setStep("payment");
      toast({ title: authMode === "register" ? "Account created! Proceeding..." : "Signed in!" });
    } catch (e: any) { setAuthError(e.message ?? "Network error"); }
    finally { setAuthLoading(false); }
  }

  async function handleVerify() {
    setAuthError("");
    setAuthLoading(true);
    try {
      const vr = await fetch("/api/auth/verify-email", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authTempToken}` },
        body: JSON.stringify({ code: authVerifyCode.trim() }),
      });
      const vd = await vr.json();
      if (!vr.ok) { setAuthError(vd.error || vd.message || "Verification failed."); return; }
      const r = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail.trim(), password: authPassword }),
      });
      const d = await r.json();
      if (!r.ok) { setAuthError(d.error || "Login failed after verify."); return; }
      authLogin(d.token);
      setIsLoggedIn(true);
      qc.invalidateQueries();
      setStep("payment");
      toast({ title: "Email verified! Proceeding to payment." });
    } catch (e: any) { setAuthError(e.message ?? "Error"); }
    finally { setAuthLoading(false); }
  }

  // ── Place Order ────────────────────────────────────────────────────────────
  async function handlePlaceOrder() {
    if (items.length === 0) return;
    if (captchaRequired && !captchaToken) {
      toast({ title: "Please complete the security check", variant: "destructive" }); return;
    }
    setPlacing(true);
    try {
      const item = items[0];
      const price = getItemPrice(item);
      const domainForOrder = item.productType === "hosting" && item.domainAction === "register" && item.domainName ? item.domainName
        : item.productType === "hosting" && item.domainAction === "transfer" && item.domainName ? item.domainName
        : null;

      let body: any = {
        billingCycle: item.billingCycle,
        billingPeriod: CYCLE_MONTHS[item.billingCycle],
        promoCode: coupon ? couponInput : undefined,
        paymentMethodId: selectedPm !== "none" && selectedPm !== "credits" ? selectedPm : undefined,
        useCredits: selectedPm === "credits",
        referralCode: referral?.code,
        currencyCode: currency.code,
        currencySymbol: currency.symbol,
        currencyRate: currency.rate,
        ...(captchaToken ? { captchaToken } : {}),
      };

      if (item.productType === "hosting") {
        body.packageId = item.packageId;
        body.domain = domainForOrder;
        body.registerDomain = item.domainAction === "register" && item.domainName;
        body.domainAmount = item.domainAction === "register" ? (item.domainPrice ?? 0) : 0;
        body.domainPeriod = item.domainName?.toLowerCase().endsWith(".pk") ? 2 : 1;
      } else if (item.productType === "vps") {
        body.vpsPlanId = item.packageId;
      } else if (item.productType === "email") {
        body.emailPackageId = item.packageId;
      }

      const data = await apiFetch("/api/checkout", { method: "POST", body: JSON.stringify(body) });

      const pmObj = paymentMethods.find(p => p.id === selectedPm);
      if (pmObj?.type === "safepay" && data.invoice?.id) {
        const spData = await apiFetch("/api/payments/safepay/initiate", {
          method: "POST", body: JSON.stringify({ invoiceId: data.invoice.id }),
        });
        if (spData.checkoutUrl) { clearCart(); window.location.href = spData.checkoutUrl; return; }
      }
      if (pmObj?.type === "rapidgateway" && data.invoice?.id) {
        const rgData = await apiFetch("/api/payments/rapidgateway/initiate", {
          method: "POST", body: JSON.stringify({ invoiceId: data.invoice.id }),
        });
        if (rgData.checkoutUrl) { clearCart(); window.location.href = rgData.checkoutUrl; return; }
      }

      clearCart();
      setLocation(data.invoice?.id ? `/dashboard/invoices/${data.invoice.id}` : "/dashboard/billing");
      toast({ title: "Order placed successfully!" });
    } catch (err: any) {
      toast({ title: "Order failed", description: err.message, variant: "destructive" });
    } finally { setPlacing(false); }
  }

  // ── Empty cart ─────────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-6 px-4">
        <div className="w-20 h-20 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center">
          <ShoppingCart size={32} className="text-gray-400" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
          <p className="text-gray-500">Add a hosting plan to get started.</p>
        </div>
        <a href="/" className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm transition-all hover:brightness-110 shadow-lg"
          style={{ background: G }}>
          <Package size={16} /> Browse Plans
        </a>
      </div>
    );
  }

  const hostingItem = items.find(i => i.productType === "hosting");
  const selectedPmObj = paymentMethods.find(p => p.id === selectedPm);
  const isManual = selectedPmObj && !["safepay", "stripe", "rapidgateway"].includes(selectedPmObj.type);

  return (
    <div className="min-h-screen bg-white">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-100 px-4 sm:px-8 py-4 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          {logoUrl
            ? <img src={logoUrl} alt={logoText} className="h-8 w-auto object-contain" />
            : <span className="font-black text-xl text-gray-900">{logoText}</span>}
        </a>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1"><ShieldCheck size={12} className="text-emerald-500" /> SSL Secured</span>
          <span className="hidden sm:flex items-center gap-1"><BadgeCheck size={12} className="text-primary" /> Verified</span>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">

          {/* ══════ LEFT: STEPS ══════ */}
          <div className="space-y-4">

            {/* ── STEP 1: Cart Items ────────────────────────────────────────── */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <StepHeader num={1} label="Your Order" active={step === "cart"} done={step !== "cart"} onClick={() => setStep("cart")} />
              <AnimatePresence>
                {step === "cart" && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="px-6 pb-6 space-y-5 border-t border-gray-100">

                      {items.map(item => {
                        const cycles = availableCycles(item);
                        const price = getItemPrice(item);
                        const cycleMonths = CYCLE_MONTHS[item.billingCycle];
                        const isHosting = item.productType === "hosting";
                        const domainInput = domainInputs[item.packageId] ?? item.domainName ?? "";
                        const avail = domainAvail[item.packageId];
                        const checking = domainChecking[item.packageId];
                        const isYearly = item.billingCycle === "yearly";
                        const freeDomainEligible = isHosting && isYearly && item.freeDomainEnabled;

                        return (
                          <div key={item.packageId} className="pt-5">
                            {/* Item header */}
                            <div className="flex items-start justify-between gap-3 mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/8">
                                  <ProductIcon type={item.productType} />
                                </div>
                                <div>
                                  <p className="font-bold text-gray-900">{item.packageName}</p>
                                  <ProductLabel type={item.productType} />
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="font-black text-lg text-gray-900">{formatPrice(price)}</p>
                                  <p className="text-xs text-gray-400">{CYCLE_SUFFIX[item.billingCycle]}</p>
                                </div>
                                <button onClick={() => removeItem(item.packageId)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>

                            {/* Billing cycle switcher */}
                            {cycles.length > 1 && (
                              <div className="mb-4">
                                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Billing Period</p>
                                <div className={`grid gap-2 ${cycles.length === 2 ? "grid-cols-2" : cycles.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}>
                                  {cycles.map(c => {
                                    const cp = c === "monthly" ? item.monthlyPrice
                                      : c === "quarterly" ? (item.quarterlyPrice ?? item.monthlyPrice * 3)
                                      : c === "semiannual" ? (item.semiannualPrice ?? item.monthlyPrice * 6)
                                      : (item.yearlyPrice ?? item.monthlyPrice * 12);
                                    const savePct = c !== "monthly" && item.monthlyPrice > 0
                                      ? Math.round((1 - cp / (item.monthlyPrice * CYCLE_MONTHS[c])) * 100) : 0;
                                    const isSel = item.billingCycle === c;
                                    return (
                                      <button key={c} onClick={() => updateCycle(item.packageId, c)}
                                        className={`relative p-3 rounded-xl border-2 text-left transition-all ${isSel ? "border-primary bg-primary/4" : "border-gray-200 hover:border-primary/30"}`}>
                                        {c === "yearly" && item.freeDomainEnabled && (
                                          <span className="absolute -top-2 left-2 text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                                            FREE DOMAIN
                                          </span>
                                        )}
                                        {savePct > 0 && (
                                          <span className="absolute top-1.5 right-1.5 text-[9px] font-bold text-emerald-600">-{savePct}%</span>
                                        )}
                                        <p className="text-xs font-semibold text-gray-600 mt-1">{CYCLE_LABELS[c]}</p>
                                        <p className="text-base font-black text-gray-900">{formatPrice(cp)}</p>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Domain add-on for hosting */}
                            {isHosting && (
                              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                  <Globe size={14} className="text-primary" /> Domain Name
                                  {freeDomainEligible && <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">FREE with Yearly</span>}
                                </p>
                                <div className="space-y-2">
                                  {[
                                    { value: "register", label: "Register new domain" },
                                    { value: "skip", label: "I already have a domain / I'll add it later" },
                                  ].map(opt => (
                                    <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                                      <input type="radio" name={`domain-${item.packageId}`}
                                        checked={(item.domainAction ?? "skip") === opt.value}
                                        onChange={() => updateDomain(item.packageId, domainInput, opt.value as any, getDomainPrice(domainInput))}
                                        className="accent-primary" />
                                      <span className="text-sm text-gray-700">{opt.label}</span>
                                    </label>
                                  ))}
                                </div>

                                {item.domainAction === "register" && (
                                  <div className="mt-3">
                                    <div className="relative">
                                      <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                      <input
                                        type="text"
                                        value={domainInput}
                                        onChange={e => {
                                          const v = e.target.value;
                                          setDomainInputs(p => ({ ...p, [item.packageId]: v }));
                                          checkDomain(item.packageId, v);
                                          updateDomain(item.packageId, v, "register", getDomainPrice(v));
                                        }}
                                        placeholder="example.com"
                                        className="w-full pl-8 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                      />
                                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        {checking ? <Loader2 size={14} className="animate-spin text-gray-400" />
                                          : avail === "available" ? <CheckCircle2 size={14} className="text-emerald-500" />
                                          : avail === "taken" ? <X size={14} className="text-red-500" />
                                          : null}
                                      </div>
                                    </div>
                                    {avail === "available" && (
                                      <p className="text-xs text-emerald-600 font-medium mt-1.5 flex items-center gap-1">
                                        <CheckCircle2 size={11} /> Available!
                                        {freeDomainEligible
                                          ? <span className="ml-1 text-emerald-600 font-bold">FREE (yearly plan)</span>
                                          : getDomainPrice(domainInput) > 0 && <span className="ml-1 text-gray-500">+ {formatPrice(getDomainPrice(domainInput))}</span>}
                                      </p>
                                    )}
                                    {avail === "taken" && <p className="text-xs text-red-500 mt-1.5">This domain is taken. Try another.</p>}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Continue CTA */}
                      <button
                        onClick={() => {
                          if (isLoggedIn) { setStep("payment"); }
                          else { setStep("account"); }
                        }}
                        className="w-full h-12 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all hover:brightness-110 shadow-lg mt-2"
                        style={{ background: G }}>
                        Continue <ChevronRight size={18} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── STEP 2: Account ──────────────────────────────────────────── */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <StepHeader num={2} label={isLoggedIn ? "Account ✓" : "Account"} active={step === "account"} done={isLoggedIn || step === "payment"} onClick={() => setStep("account")} />
              <AnimatePresence>
                {step === "account" && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="px-6 pb-6 space-y-4 border-t border-gray-100">
                      <div className="pt-4">
                        {isLoggedIn ? (
                          <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                            <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
                            <div>
                              <p className="font-semibold text-emerald-800 text-sm">Signed in</p>
                              <p className="text-xs text-emerald-600">{user?.email}</p>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Auth mode toggle */}
                            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-4">
                              {([["login", "Sign In"], ["register", "Create Account"]] as const).map(([m, label]) => (
                                <button key={m} onClick={() => { setAuthMode(m); setAuthError(""); }}
                                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${authMode === m ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                                  {m === "login" ? <User size={14} /> : <UserPlus size={14} />} {label}
                                </button>
                              ))}
                            </div>

                            {authMode === "verify" ? (
                              <div className="space-y-3">
                                <p className="text-sm text-gray-600">Enter the verification code sent to <strong>{authEmail}</strong></p>
                                <input type="text" value={authVerifyCode} onChange={e => setAuthVerifyCode(e.target.value)} placeholder="6-digit code"
                                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                                {authError && <p className="text-xs text-red-500">{authError}</p>}
                                <button onClick={handleVerify} disabled={authLoading}
                                  className="w-full h-11 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all hover:brightness-110"
                                  style={{ background: G }}>
                                  {authLoading ? <Loader2 size={16} className="animate-spin" /> : "Verify & Continue"}
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {authMode === "register" && (
                                  <div className="grid grid-cols-2 gap-3">
                                    <input type="text" value={authFirstName} onChange={e => setAuthFirstName(e.target.value)} placeholder="First name"
                                      className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                                    <input type="text" value={authLastName} onChange={e => setAuthLastName(e.target.value)} placeholder="Last name"
                                      className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                                  </div>
                                )}
                                <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="Email address"
                                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                                {authMode === "register" && (
                                  <input type="tel" value={authPhone} onChange={e => setAuthPhone(e.target.value)} placeholder="Phone (optional)"
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                                )}
                                <div className="relative">
                                  <input type={authShowPass ? "text" : "password"} value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Password"
                                    className="w-full pr-10 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                                  <button onClick={() => setAuthShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    {authShowPass ? <EyeOff size={15} /> : <Eye size={15} />}
                                  </button>
                                </div>
                                {authError && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{authError}</p>}
                                <button onClick={handleAuth} disabled={authLoading}
                                  className="w-full h-11 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all hover:brightness-110"
                                  style={{ background: G }}>
                                  {authLoading ? <Loader2 size={16} className="animate-spin" /> : authMode === "login" ? "Sign In & Continue" : "Create Account & Continue"}
                                </button>
                              </div>
                            )}
                          </>
                        )}

                        {isLoggedIn && (
                          <button onClick={() => setStep("payment")}
                            className="w-full h-11 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 mt-4 transition-all hover:brightness-110"
                            style={{ background: G }}>
                            Continue to Payment <ChevronRight size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── STEP 3: Payment ──────────────────────────────────────────── */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <StepHeader num={3} label="Payment" active={step === "payment"} done={false} onClick={undefined} />
              <AnimatePresence>
                {step === "payment" && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="px-6 pb-6 border-t border-gray-100">
                      {!isLoggedIn ? (
                        <div className="py-6 text-center">
                          <Lock size={24} className="text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">Please sign in to continue to payment</p>
                        </div>
                      ) : (
                        <div className="space-y-4 pt-4">
                          {/* Wallet balance */}
                          {creditBalance > 0 && (
                            <button onClick={() => setSelectedPm("credits")}
                              className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${selectedPm === "credits" ? "border-primary bg-primary/4" : "border-gray-200 hover:border-primary/30"}`}>
                              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <CreditCard size={18} className="text-primary" />
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold text-sm text-gray-900">Wallet Balance</p>
                                <p className="text-xs text-gray-500">Available: {formatPrice(creditBalance)}</p>
                              </div>
                              {selectedPm === "credits" && <CheckCircle2 size={18} className="text-primary shrink-0" />}
                            </button>
                          )}

                          {paymentMethods.map(pm => {
                            const icon: Record<string, React.ReactNode> = {
                              jazzcash: <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-orange-50"><Smartphone size={18} className="text-orange-500" /></div>,
                              easypaisa: <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-50"><Smartphone size={18} className="text-green-600" /></div>,
                              bank_transfer: <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50"><Landmark size={18} className="text-blue-500" /></div>,
                              safepay: <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-50"><Shield size={18} className="text-indigo-500" /></div>,
                              rapidgateway: <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#eef2ff" }}><Zap size={18} style={{ color: "#4f46e5" }} /></div>,
                              stripe: <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-50"><CreditCard size={18} className="text-violet-500" /></div>,
                            };
                            return (
                              <button key={pm.id} onClick={() => setSelectedPm(pm.id)}
                                className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${selectedPm === pm.id ? "border-primary bg-primary/4" : "border-gray-200 hover:border-primary/30"}`}>
                                {icon[pm.type] ?? <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center"><CreditCard size={18} className="text-gray-500" /></div>}
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                                    {pm.name}
                                    {pm.type === "rapidgateway" && <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded-md bg-indigo-500">INSTANT ⚡</span>}
                                    {pm.isSandbox && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">TEST</span>}
                                  </p>
                                  {pm.description && <p className="text-xs text-gray-400 truncate">{pm.description}</p>}
                                  {pm.publicSettings?.mobileNumber && <p className="text-xs text-gray-500 mt-0.5">{pm.publicSettings.mobileNumber}</p>}
                                </div>
                                {selectedPm === pm.id && <CheckCircle2 size={18} className="text-primary shrink-0" />}
                              </button>
                            );
                          })}

                          {paymentMethods.length === 0 && (
                            <div className="text-center py-6 text-sm text-gray-400">No payment methods configured yet.</div>
                          )}

                          {/* Manual payment bank details */}
                          {isManual && selectedPmObj?.publicSettings && (
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-sm">
                              <p className="font-semibold text-amber-800">Payment Details</p>
                              {selectedPmObj.publicSettings.bankName && <p className="text-amber-700">Bank: <strong>{selectedPmObj.publicSettings.bankName}</strong></p>}
                              {selectedPmObj.publicSettings.accountTitle && <p className="text-amber-700">Account: <strong>{selectedPmObj.publicSettings.accountTitle}</strong></p>}
                              {selectedPmObj.publicSettings.accountNumber && <p className="text-amber-700">Number: <strong>{selectedPmObj.publicSettings.accountNumber}</strong></p>}
                            </div>
                          )}

                          {/* Captcha */}
                          {captchaRequired && (
                            <div className="mt-2">
                              <CaptchaWidget siteKey={captchaConfig.siteKey} provider={captchaConfig.provider} onVerify={setCaptchaToken} />
                            </div>
                          )}

                          <button onClick={handlePlaceOrder} disabled={placing || selectedPm === "none" || paymentMethods.length === 0}
                            className="w-full h-14 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2.5 transition-all shadow-xl hover:brightness-110 active:scale-[0.99] disabled:opacity-50 mt-2"
                            style={{ background: G, boxShadow: "0 8px 32px rgba(107,70,193,0.3)" }}>
                            {placing
                              ? <><Loader2 size={18} className="animate-spin" /> Processing...</>
                              : <><Lock size={16} /> Complete Order — {formatPrice(total)}</>}
                          </button>

                          <p className="text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                            <ShieldCheck size={12} className="text-emerald-500" /> 30-day money-back guarantee · No setup fees
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ══════ RIGHT: SUMMARY SIDEBAR ══════ */}
          <div className="lg:sticky lg:top-6 space-y-4">
            {/* Order Summary */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Tag size={16} className="text-primary" /> Order Summary
              </h3>
              <div className="space-y-3">
                {items.map(item => {
                  const price = getItemPrice(item);
                  const domainCost = item.domainAction === "register" && item.domainName && !(item.billingCycle === "yearly" && item.freeDomainEnabled) ? (item.domainPrice ?? getDomainPrice(item.domainName)) : 0;
                  return (
                    <div key={item.packageId}>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 truncate pr-2">{item.packageName}</span>
                        <span className="font-semibold text-gray-900 shrink-0">{formatPrice(price)}</span>
                      </div>
                      <p className="text-xs text-gray-400">{CYCLE_LABELS[item.billingCycle]}</p>
                      {domainCost > 0 && (
                        <div className="flex justify-between text-xs mt-1">
                          <span className="text-gray-500 flex items-center gap-1"><Globe size={10} />{item.domainName}</span>
                          <span className="text-gray-700">{formatPrice(domainCost)}</span>
                        </div>
                      )}
                      {item.domainAction === "register" && item.billingCycle === "yearly" && item.freeDomainEnabled && item.domainName && (
                        <p className="text-xs text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                          <Gift size={10} /> Domain FREE
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-gray-100 mt-3 pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-gray-900 font-medium">{formatPrice(subtotal)}</span>
                </div>
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-600 flex items-center gap-1"><Ticket size={12} /> Coupon ({coupon?.code})</span>
                    <span className="text-emerald-600 font-semibold">-{formatPrice(couponDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-base border-t border-gray-100 pt-2 mt-2">
                  <span className="text-gray-900">Total</span>
                  <span style={{ color: BRAND }}>{formatPrice(total)}</span>
                </div>
              </div>
            </div>

            {/* Coupon Code */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Ticket size={14} className="text-primary" /> Promo Code
              </p>
              {coupon ? (
                <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-2 text-emerald-700 text-sm">
                    <CheckCircle2 size={15} />
                    <span className="font-bold">{coupon.code}</span>
                    <span className="text-emerald-600">−{formatPrice(coupon.discountAmount)}</span>
                  </div>
                  <button onClick={removeCoupon} className="text-emerald-500 hover:text-emerald-700">
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={e => setCouponInput(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === "Enter" && applyCoupon(couponInput, subtotal)}
                    placeholder="ENTER CODE"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <button onClick={() => applyCoupon(couponInput, subtotal)} disabled={couponLoading || !couponInput.trim()}
                    className="px-4 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-50 transition-all"
                    style={{ background: G }}>
                    {couponLoading ? <Loader2 size={14} className="animate-spin" /> : "Apply"}
                  </button>
                </div>
              )}
              {couponError && <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><AlertCircle size={11} />{couponError}</p>}
            </div>

            {/* Referral Code */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Gift size={14} className="text-primary" /> Referral Code
              </p>
              {referral ? (
                <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-2 text-emerald-700 text-sm">
                    <CheckCircle2 size={15} />
                    <span className="font-bold">{referral.code}</span>
                    <span className="text-emerald-600 text-xs">Applied!</span>
                  </div>
                  <button onClick={removeReferral} className="text-emerald-500 hover:text-emerald-700">
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={referralInput}
                    onChange={e => setReferralInput(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === "Enter" && applyReferral(referralInput)}
                    placeholder="REFERRAL CODE"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <button onClick={() => applyReferral(referralInput)} disabled={referralLoading || !referralInput.trim()}
                    className="px-4 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-50 transition-all"
                    style={{ background: G }}>
                    {referralLoading ? <Loader2 size={14} className="animate-spin" /> : "Apply"}
                  </button>
                </div>
              )}
              {referralError && <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><AlertCircle size={11} />{referralError}</p>}
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { icon: ShieldCheck, label: "SSL Secure", color: "text-emerald-500" },
                { icon: BadgeCheck, label: "Verified", color: "text-blue-500" },
                { icon: CheckCircle2, label: "30-Day Refund", color: "text-primary" },
              ].map(({ icon: Icon, label, color }) => (
                <div key={label} className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col items-center gap-1.5">
                  <Icon size={18} className={color} />
                  <span className="text-[10px] font-medium text-gray-500">{label}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
