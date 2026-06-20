import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Trash2, ChevronDown, ChevronRight, ShieldCheck,
  Tag, Gift, Globe, Server, Zap, Mail, Package, Lock, CheckCircle2,
  User, UserPlus, Loader2, AlertCircle, CreditCard,
  Smartphone, Landmark, Shield, BadgeCheck, Search, X, Check,
  ArrowLeft, Ticket, ArrowRightLeft, Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/context/CurrencyProvider";
import { useAuth } from "@/hooks/use-auth";
import {
  useUnifiedCart, availableCycles, getItemPrice,
  CYCLE_LABELS, CYCLE_SUFFIX, CYCLE_MONTHS,
  type BillingCycle, type UnifiedCartItem,
} from "@/context/UnifiedCartContext";
import { BrandingLogo } from "@/components/BrandingLogo";
import CaptchaWidget from "@/components/CaptchaWidget";

const BRAND = "#6B46C1";
const G = "linear-gradient(135deg, #6B46C1 0%, #8B5CF6 100%)";

type Step = "cart" | "domain" | "account" | "payment";

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
  const { user } = useAuth();
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

  // Multi-TLD domain search results per item
  const [domainResults, setDomainResults] = useState<Record<string, any[]>>({});
  const [domainSelectedTld, setDomainSelectedTld] = useState<Record<string, string>>({});
  const [domainShowAll, setDomainShowAll] = useState<Record<string, boolean>>({});

  // VPS OS selector per item
  const VPS_OS = ["Ubuntu 22.04 LTS", "Ubuntu 20.04 LTS", "Debian 12", "CentOS Stream 9", "AlmaLinux 9", "Rocky Linux 9", "Windows Server 2022"];
  const [vpsOs, setVpsOs] = useState<Record<string, string>>({});

  // Email mailbox config per item
  const [emailDomain, setEmailDomain] = useState<Record<string, string>>({});

  const [selectedPm, setSelectedPm] = useState<string>("none");
  const [placing, setPlacing] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  // Queries
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

  const subtotal = getSubtotal();
  const total = getTotal();
  const couponDiscount = coupon?.discountAmount ?? 0;

  // ── Domain check helper ── multi-TLD search ─────────────────────────────────
  function checkDomain(pkgId: string, domain: string) {
    const d = domain.trim().toLowerCase();
    if (!d || !d.includes(".")) { setDomainAvail(p => ({ ...p, [pkgId]: null })); return; }
    if (domainTimers.current[pkgId]) clearTimeout(domainTimers.current[pkgId]);
    domainTimers.current[pkgId] = setTimeout(async () => {
      setDomainChecking(p => ({ ...p, [pkgId]: true }));
      setDomainAvail(p => ({ ...p, [pkgId]: null }));
      setDomainResults(p => ({ ...p, [pkgId]: [] }));
      try {
        const r = await fetch(`/api/domain/search?q=${encodeURIComponent(d)}`);
        const data = await r.json();
        if (Array.isArray(data)) {
          const all = data.filter((x: any) => {
            const p = parseFloat(x.price || x.registerPrice || "0");
            return p >= 0;
          });
          setDomainResults(p => ({ ...p, [pkgId]: all }));
          const anyMatch = all.find((x: any) => x.available) || all[0];
          if (anyMatch) {
            setDomainAvail(p => ({ ...p, [pkgId]: anyMatch.available ? "available" : "taken" }));
            if (anyMatch.available) {
              setDomainSelectedTld(p => ({ ...p, [pkgId]: anyMatch.tld }));
            }
          }
        }
      } catch {}
      finally { setDomainChecking(p => ({ ...p, [pkgId]: false })); }
    }, 700);
  }

  function getDomainPrice(domain: string, freeDomainTlds?: string[]): number {
    if (!domain || !domain.includes(".")) return 0;
    const parts = domain.split(".");
    const long = "." + parts.slice(-2).join(".");
    const short = "." + parts[parts.length - 1];
    const ext = domainExtensions.find(e => e.extension === long) || domainExtensions.find(e => e.extension === short);
    if (!ext) return 0;
    // Check if this TLD is eligible for free domain
    const domainTld = domain.includes(".") ? domain.slice(domain.indexOf(".")).toLowerCase() : "";
    const isFree = freeDomainTlds && freeDomainTlds.length > 0 && domainTld ? freeDomainTlds.includes(domainTld) : false;
    if (isFree) return 0;
    return domain.toLowerCase().endsWith(".pk") ? Number(ext.register2YearPrice ?? ext.registerPrice ?? 0) : Number(ext.registerPrice ?? 0);
  }

  // ── Place Order ── processes ALL cart items, one checkout call per item ────
  async function handlePlaceOrder() {
    if (items.length === 0) return;
    if (captchaRequired && !captchaToken) {
      toast({ title: "Please complete the security check", variant: "destructive" }); return;
    }
    setPlacing(true);
    const pmObj = paymentMethods.find(p => p.id === selectedPm);
    const invoiceIds: string[] = [];

    try {
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const domainForOrder = (item.productType === "hosting" && (item.domainAction === "register" || item.domainAction === "transfer") && item.domainName)
          ? item.domainName : null;

        const body: Record<string, any> = {
          billingCycle: item.billingCycle,
          billingPeriod: CYCLE_MONTHS[item.billingCycle],
          promoCode: coupon ? couponInput : undefined,
          paymentMethodId: selectedPm !== "none" && selectedPm !== "credits" ? selectedPm : (selectedPm === "credits" ? "credits" : undefined),
          applyCredits: selectedPm === "credits",
          referralCode: referral?.code,
          currencyCode: currency.code,
          currencySymbol: currency.symbol,
          currencyRate: currency.rate,
          ...(idx === 0 && captchaToken ? { captchaToken } : {}),
        };

        if (item.productType === "hosting") {
          body.packageId = item.packageId;
          body.domain = domainForOrder;
          body.registerDomain = item.domainAction === "register" && !!item.domainName;
          body.transferDomain = item.domainAction === "transfer" && !!item.domainName;
          body.domainAmount = item.domainAction === "register" ? (item.domainPrice ?? 0) : 0;
          body.domainPeriod = item.domainName?.toLowerCase().endsWith(".pk") ? 2 : 1;
        } else if (item.productType === "vps") {
          body.vpsPlanId = item.packageId;
          body.operatingSystem = vpsOs[item.packageId] ?? VPS_OS[0];
        } else if (item.productType === "email") {
          body.emailPackageId = item.packageId;
        } else if (item.productType === "domain") {
          body.domain = item.domainName;
          body.registerDomain = true;
          body.domainAmount = item.monthlyPrice;
          body.domainPeriod = 1;
        }

        // Email items use the dedicated email-orders endpoint (checkout.ts doesn't support emailPackageId)
        let data: any;
        if (item.productType === "email") {
          data = await apiFetch("/api/my/email-orders", {
            method: "POST",
            body: JSON.stringify({
              package_id: item.packageId,
              domain_name: emailDomain[item.packageId] ?? item.domainName ?? "",
              billing_cycle: item.billingCycle === "yearly" ? "yearly" : "monthly",
            }),
          });
        } else {
          data = await apiFetch("/api/checkout", { method: "POST", body: JSON.stringify(body) });
        }
        if (data.invoice?.id) invoiceIds.push(data.invoice.id);
      }

      // ── All invoices created — now handle gateway redirect for first invoice ──
      // (All items are checked out first so no items are lost if gateway redirect fires)
      const firstInvoice = invoiceIds[0];
      if (firstInvoice && pmObj?.type === "safepay") {
        const spData = await apiFetch("/api/payments/safepay/initiate", {
          method: "POST", body: JSON.stringify({ invoiceId: firstInvoice }),
        });
        if (spData.checkoutUrl) { clearCart(); window.location.href = spData.checkoutUrl; return; }
      }
      if (firstInvoice && pmObj?.type === "rapidgateway") {
        const rgData = await apiFetch("/api/payments/rapidgateway/initiate", {
          method: "POST", body: JSON.stringify({ invoiceId: firstInvoice }),
        });
        if (rgData.checkoutUrl) { clearCart(); window.location.href = rgData.checkoutUrl; return; }
      }

      clearCart();
      setLocation(firstInvoice ? `/dashboard/invoices/${firstInvoice}` : "/dashboard/billing");
      toast({ title: "Order placed successfully!", description: invoiceIds.length > 1 ? `${invoiceIds.length} orders created.` : undefined });
    } catch (err: any) {
      toast({ title: "Order failed", description: err.message, variant: "destructive" });
    } finally { setPlacing(false); }
  }

  // ── Empty cart → redirect to homepage ─────────────────────────────────────
  if (items.length === 0) {
    window.location.replace("/");
    return null;
  }

  const hostingItem = items.find(i => i.productType === "hosting");
  // Config step appears when cart has hosting, VPS, or email items
  const hasDomainStep = items.some(i => ["hosting", "vps", "email"].includes(i.productType));
  const selectedPmObj = paymentMethods.find(p => p.id === selectedPm);
  const isManual = selectedPmObj && !["safepay", "stripe", "rapidgateway"].includes(selectedPmObj.type);

  return (
    <div className="min-h-screen bg-white">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-100 px-4 sm:px-8 py-4 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <BrandingLogo size="sm" showText={true} />
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

                            {/* Domain step teaser for hosting items */}
                            {isHosting && (
                              <div className="bg-blue-50 rounded-xl px-4 py-3 border border-blue-100 flex items-center gap-2 mt-1">
                                <Globe size={14} className="text-blue-500 shrink-0" />
                                <span className="text-xs text-blue-700 font-medium">
                                  {item.domainAction === "register" && item.domainName
                                    ? `Domain: ${item.domainName}${item.billingCycle === "yearly" && item.freeDomainEnabled ? " (FREE)" : ""}`
                                    : "You'll configure your domain in the next step"}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Continue CTA */}
                      <button
                        onClick={() => {
                          if (hasDomainStep) { setStep("domain"); }
                          else if (isLoggedIn) { setStep("payment"); }
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

            {/* ── STEP 2: Configure (domain/OS/mailbox) ────────────────────── */}
            {hasDomainStep && (
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <StepHeader num={2} label="Configure" active={step === "domain"} done={step === "account" || step === "payment"} onClick={() => setStep("domain")} />
                <AnimatePresence>
                  {step === "domain" && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="px-6 pb-6 border-t border-gray-100 space-y-5 pt-4">
                        {items.filter(i => i.productType === "hosting").map(item => {
                          const domainInput = domainInputs[item.packageId] ?? item.domainName ?? "";
                          const avail = domainAvail[item.packageId];
                          const checking = domainChecking[item.packageId];
                          const isYearly = item.billingCycle === "yearly";
                          const freeDomainEligible = isYearly && item.freeDomainEnabled;
                          return (
                            <div key={item.packageId} className="space-y-3">
                              <p className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                <Server size={14} className="text-primary" /> {item.packageName}
                              </p>
                              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
                                <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                  <Globe size={14} className="text-primary" /> Domain Name
                                  {freeDomainEligible && <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">FREE with Yearly</span>}
                                </p>
                                <div className="space-y-2">
                                  {[
                                    { value: "register", label: "Register a new domain" },
                                    { value: "transfer", label: "Transfer an existing domain to us" },
                                    { value: "skip", label: "I'll use my own domain / add later" },
                                  ].map(opt => (
                                    <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                                      <input type="radio" name={`domain-step-${item.packageId}`}
                                        checked={(item.domainAction ?? "skip") === opt.value}
                                        onChange={() => updateDomain(item.packageId, domainInput, opt.value as any, getDomainPrice(domainInput, item.freeDomainTlds))}
                                        className="accent-primary" />
                                      <span className="text-sm text-gray-700">{opt.label}</span>
                                    </label>
                                  ))}
                                </div>
                                {(item.domainAction === "transfer") && (
                                  <div>
                                    <div className="relative">
                                      <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                      <input type="text" value={domainInput}
                                        onChange={e => {
                                          const v = e.target.value;
                                          setDomainInputs(p => ({ ...p, [item.packageId]: v }));
                                          updateDomain(item.packageId, v, "transfer", 0);
                                        }}
                                        placeholder="yourdomain.com"
                                        className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                                    </div>
                                    <p className="text-xs text-amber-600 mt-1.5">You'll need your domain's EPP/Auth code to complete the transfer.</p>
                                  </div>
                                )}
                                {item.domainAction === "register" && (
                                  <div className="space-y-3">
                                    <div className="relative">
                                      <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                      <input type="text" value={domainInput}
                                        onChange={e => {
                                          const v = e.target.value;
                                          setDomainInputs(p => ({ ...p, [item.packageId]: v }));
                                          checkDomain(item.packageId, v);
                                        }}
                                        placeholder="Search your domain (e.g. mysite.com)"
                                        className="w-full pl-8 pr-24 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                        <button onClick={() => checkDomain(item.packageId, domainInput)}
                                          disabled={checking}
                                          className="px-3 py-1 text-xs font-bold text-white rounded-md transition-all hover:brightness-110 disabled:opacity-50"
                                          style={{ background: G }}>
                                          {checking ? <Loader2 size={12} className="animate-spin" /> : <><Search size={12} className="inline mr-1" />Search</>}
                                        </button>
                                      </div>
                                    </div>

                                    {/* Multi-TLD search results */}
                                    {domainResults[item.packageId]?.length > 0 && (
                                      <div className="space-y-2">
                                        {(domainShowAll[item.packageId]
                                          ? domainResults[item.packageId]
                                          : domainResults[item.packageId].slice(0, 4)
                                        ).map((r: any) => {
                                          const sld = domainInput.trim().split(".")[0].toLowerCase();
                                          const fullName = `${sld}${r.tld}`;
                                          const isSelected = domainSelectedTld[item.packageId] === r.tld;
                                          const isFree = freeDomainEligible && r.isFreeWithHosting;
                                          const isTaken = !r.available;
                                          const regPrice = parseFloat(r.price || r.registerPrice || "0");
                                          const renPrice = parseFloat(r.renewalPrice || "0");
                                          const isPk = r.tld?.toLowerCase().includes(".pk");

                                          return (
                                            <div key={r.tld}
                                              onClick={() => {
                                                if (isTaken) return;
                                                setDomainSelectedTld(p => ({ ...p, [item.packageId]: r.tld }));
                                                const fullDomain = `${sld}${r.tld}`;
                                                const price = isFree ? 0 : regPrice;
                                                updateDomain(item.packageId, fullDomain, "register", price);
                                              }}
                                              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm cursor-pointer transition-all ${
                                                isSelected
                                                  ? "border-primary bg-primary/5"
                                                  : "border-gray-200 hover:border-gray-300"
                                              } ${isTaken ? "opacity-60" : ""}`}>
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                  <span className="font-semibold text-gray-900 truncate">{fullName}</span>
                                                  {isTaken && <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">TAKEN</span>}
                                                  {isSelected && !isTaken && <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">SELECTED</span>}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                  {isFree && !isTaken ? (
                                                    <span className="text-xs font-bold text-emerald-600">FREE</span>
                                                  ) : (
                                                    <span className="text-xs text-gray-600">
                                                      {regPrice > 0 ? formatPrice(regPrice) : "Price on request"}
                                                    </span>
                                                  )}
                                                  <span className="text-xs text-gray-400">
                                                    {isPk
                                                      ? "2-year registration"
                                                      : renPrice > 0
                                                        ? `Renews at ${formatPrice(renPrice)}/year`
                                                        : "Renews at regular price"
                                                    }
                                                  </span>
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-1.5 shrink-0">
                                                {isTaken ? (
                                                  <>
                                                    <button onClick={e => { e.stopPropagation(); window.open(`https://whois.domaintools.com/${fullName}`, "_blank"); }}
                                                      className="px-2 py-1 text-[10px] font-bold text-blue-600 bg-blue-50 rounded hover:bg-blue-100">
                                                      WHOIS
                                                    </button>
                                                    <button onClick={e => {
                                                      e.stopPropagation();
                                                      setDomainInputs(p => ({ ...p, [item.packageId]: fullName }));
                                                      updateDomain(item.packageId, fullName, "transfer", 0);
                                                    }}
                                                      className="px-2 py-1 text-[10px] font-bold text-amber-600 bg-amber-50 rounded hover:bg-amber-100 flex items-center gap-1">
                                                      <ArrowRightLeft size={9} /> Transfer
                                                    </button>
                                                  </>
                                                ) : (
                                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                                    isSelected ? "border-primary bg-primary" : "border-gray-300"
                                                  }`}>
                                                    {isSelected && <Check size={12} className="text-white" />}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                        {domainResults[item.packageId].length > 4 && (
                                          <button onClick={() => setDomainShowAll(p => ({ ...p, [item.packageId]: !p[item.packageId] }))}
                                            className="w-full text-xs font-semibold text-primary py-1 hover:underline">
                                            {domainShowAll[item.packageId] ? "Show less" : `Show ${domainResults[item.packageId].length - 4} more`}
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {/* VPS OS selector */}
                        {items.filter(i => i.productType === "vps").map(item => (
                          <div key={item.packageId} className="border border-gray-200 rounded-xl p-4 space-y-3">
                            <p className="text-sm font-bold text-gray-700 flex items-center gap-2">
                              <Server size={14} className="text-primary" /> {item.packageName} — Operating System
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {VPS_OS.map(os => (
                                <label key={os} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-all ${
                                  (vpsOs[item.packageId] ?? VPS_OS[0]) === os
                                    ? "border-primary bg-primary/5 text-primary font-semibold"
                                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                                }`}>
                                  <input type="radio" name={`vps-os-${item.packageId}`}
                                    className="sr-only"
                                    checked={(vpsOs[item.packageId] ?? VPS_OS[0]) === os}
                                    onChange={() => setVpsOs(p => ({ ...p, [item.packageId]: os }))} />
                                  {os}
                                </label>
                              ))}
                            </div>
                            <p className="text-xs text-gray-400">You can reinstall the OS anytime from your control panel.</p>
                          </div>
                        ))}

                        {/* Email mailbox domain config */}
                        {items.filter(i => i.productType === "email").map(item => (
                          <div key={item.packageId} className="border border-gray-200 rounded-xl p-4 space-y-3">
                            <p className="text-sm font-bold text-gray-700 flex items-center gap-2">
                              <Globe size={14} className="text-primary" /> {item.packageName} — Email Domain
                            </p>
                            <div className="relative">
                              <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input type="text"
                                value={emailDomain[item.packageId] ?? ""}
                                onChange={e => setEmailDomain(p => ({ ...p, [item.packageId]: e.target.value }))}
                                placeholder="yourdomain.com"
                                className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                            </div>
                            <p className="text-xs text-gray-400">Enter the domain you want email addresses set up on (e.g. you@yourdomain.com).</p>
                          </div>
                        ))}

                        <button
                          onClick={() => {
                            if (isLoggedIn) { setStep("payment"); }
                            else { setStep("account"); }
                          }}
                          className="w-full h-12 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all hover:brightness-110 shadow-lg"
                          style={{ background: G }}>
                          Continue <ChevronRight size={18} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* ── STEP 3: Account ──────────────────────────────────────────── */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <StepHeader num={hasDomainStep ? 3 : 2} label={isLoggedIn ? "Account ✓" : "Account"} active={step === "account"} done={isLoggedIn || step === "payment"} onClick={() => setStep("account")} />
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
                          <div className="space-y-3">
                            <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
                              <Lock size={18} className="text-amber-500 shrink-0 mt-0.5" />
                              <div>
                                <p className="font-semibold text-amber-800 text-sm">Sign in to continue</p>
                                <p className="text-xs text-amber-700 mt-0.5">Your selections are saved. Sign in to complete your purchase.</p>
                              </div>
                            </div>
                            <button
                              onClick={() => setLocation(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)}
                              className="w-full h-11 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all hover:brightness-110"
                              style={{ background: G }}>
                              <User size={15} /> Sign In
                            </button>
                            <button
                              onClick={() => setLocation(`/register?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)}
                              className="w-full h-11 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-700 flex items-center justify-center gap-2 transition-all hover:bg-gray-50 hover:border-gray-300 active:scale-[0.99]">
                              <UserPlus size={15} /> Create Account
                            </button>
                            <p className="text-center text-[11px] text-gray-400">
                              <Lock size={9} className="inline mr-1 text-emerald-500" />
                              Your order details are saved. Sign in will not reset your selections.
                            </p>
                          </div>
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

            {/* ── STEP 4: Payment ──────────────────────────────────────────── */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <StepHeader num={hasDomainStep ? 4 : 3} label="Payment" active={step === "payment"} done={false} onClick={undefined} />
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
                  const domainCost = item.domainAction === "register" && item.domainName ? (item.domainPrice ?? getDomainPrice(item.domainName, item.freeDomainTlds)) : 0;
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
                {referral && subtotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-600 flex items-center gap-1"><Gift size={12} /> Referral ({referral.code})</span>
                    <span className="text-emerald-600 font-semibold">-{formatPrice(Math.round(subtotal * (referral.discountPercent / 100) * 100) / 100)}</span>
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
