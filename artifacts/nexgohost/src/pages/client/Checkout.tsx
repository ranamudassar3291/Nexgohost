import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldCheck, CheckCircle2, Loader2, AlertCircle, Globe, Tag,
  Gift, Search as SearchIcon, XCircle, Wallet, CreditCard,
  Smartphone, Landmark, Lock, BadgeCheck, ChevronRight, Zap,
  Check, Mail, Shield, Server, Star,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/context/CurrencyProvider";
import CaptchaWidget from "@/components/CaptchaWidget";

const BRAND = "#4F46E5";
const BRAND_GRADIENT = "linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)";

type BillingCycle = "monthly" | "quarterly" | "semiannual" | "yearly";

const CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: "Monthly", quarterly: "Quarterly", semiannual: "6 Months", yearly: "Yearly",
};
const CYCLE_SUFFIX: Record<BillingCycle, string> = {
  monthly: "/mo", quarterly: "/qtr", semiannual: "/6mo", yearly: "/yr",
};
const CYCLE_MONTHS: Record<BillingCycle, number> = {
  monthly: 1, quarterly: 3, semiannual: 6, yearly: 12,
};

interface PaymentMethod {
  id: string; name: string; type: string; description: string | null; isSandbox: boolean;
  publicSettings?: { mobileNumber?: string; bankName?: string; accountTitle?: string; accountNumber?: string };
}
interface PromoResult {
  valid: boolean; code: string; discountPercent: number; discountAmount: number;
  originalAmount: number; finalAmount: number; discountType?: string;
}

function PayIcon({ type }: { type: string }) {
  const base = "w-10 h-10 rounded-xl flex items-center justify-center shrink-0";
  switch (type) {
    case "jazzcash": return <div className={base} style={{ background: "#f0612e18" }}><Smartphone size={19} style={{ color: "#f0612e" }} /></div>;
    case "easypaisa": return <div className={base} style={{ background: "#3bb54a18" }}><Smartphone size={19} style={{ color: "#3bb54a" }} /></div>;
    case "bank_transfer": return <div className={`${base} bg-blue-500/10`}><Landmark size={19} className="text-blue-500" /></div>;
    case "safepay": return <div className={base} style={{ background: "#5046e418" }}><Shield size={19} style={{ color: "#5046e4" }} /></div>;
    case "stripe": return <div className={`${base} bg-[#635bff]/10`}><CreditCard size={19} className="text-[#635bff]" /></div>;
    default: return <div className={`${base} bg-secondary`}><CreditCard size={19} className="text-muted-foreground" /></div>;
  }
}

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

const ADDONS = [
  { key: "privacy", Icon: Shield, iconColor: "text-purple-400", iconBg: "bg-purple-500/10", title: "Domain Privacy", desc: "Hide personal info from WHOIS", price: 999, badge: "Popular" },
  { key: "email",   Icon: Mail,   iconColor: "text-blue-400",   iconBg: "bg-blue-500/10",   title: "Business Email",  desc: "Professional @domain email",     price: 1499, badge: null },
  { key: "ssl",     Icon: Lock,   iconColor: "text-green-400",  iconBg: "bg-green-500/10",  title: "SSL Certificate", desc: "HTTPS & padlock for your site",  price: 0,    badge: "Free" },
];

export default function Checkout() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const { formatPrice, currency } = useCurrency();

  const params = new URLSearchParams(search);
  const packageId   = params.get("packageId") ?? "";
  const packageName = params.get("packageName") ?? "Hosting Package";
  const monthlyPrice     = parseFloat(params.get("monthlyPrice") ?? params.get("amount") ?? "0");
  const quarterlyPrice   = params.get("quarterlyPrice")   ? parseFloat(params.get("quarterlyPrice")!)   : null;
  const semiannualPrice  = params.get("semiannualPrice")  ? parseFloat(params.get("semiannualPrice")!)  : null;
  const yearlyPrice      = params.get("yearlyPrice")      ? parseFloat(params.get("yearlyPrice")!)      : null;
  const renewalPrice     = params.get("renewalPrice")     ? parseFloat(params.get("renewalPrice")!)     : null;
  const initialCycle     = (params.get("billingCycle") as BillingCycle) || "monthly";

  const priceMap: Partial<Record<BillingCycle, number>> = {
    monthly: monthlyPrice,
    ...(quarterlyPrice  != null ? { quarterly:  quarterlyPrice  } : {}),
    ...(semiannualPrice != null ? { semiannual: semiannualPrice } : {}),
    ...(yearlyPrice     != null ? { yearly:     yearlyPrice     } : {}),
  };
  const availableCycles = (Object.keys(priceMap) as BillingCycle[]).filter(c => (priceMap[c] ?? 0) > 0);

  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    availableCycles.includes(initialCycle) ? initialCycle : (availableCycles[0] ?? "monthly")
  );
  const [domainChoice,      setDomainChoice]      = useState<"register" | "existing" | "skip">("skip");
  const [domainName,        setDomainName]        = useState("");
  const [domainPeriod,      setDomainPeriod]      = useState<1 | 2 | 3>(1);
  const [existingDomainId,  setExistingDomainId]  = useState("");
  const [domainAvail,       setDomainAvail]       = useState<"available" | "taken" | null>(null);
  const [checkingDomain,    setCheckingDomain]    = useState(false);
  const domainTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cartSessionIdRef = useRef<string | null>(null);

  const [promoCode,    setPromoCode]    = useState("");
  const [promoResult,  setPromoResult]  = useState<PromoResult | null>(null);
  const [promoError,   setPromoError]   = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  const [selectedPm, setSelectedPm] = useState<string>("none");
  const [placing,    setPlacing]    = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const [addons, setAddons] = useState<Record<string, boolean>>({ privacy: false, email: false, ssl: false });

  const { data: captchaConfig } = useQuery({
    queryKey: ["captcha-config"],
    queryFn: () => fetch("/api/security/captcha-config").then(r => r.json()),
    staleTime: 300_000,
  });
  const captchaRequired = !!(captchaConfig?.enabledPages?.checkout && captchaConfig?.siteKey);

  const { data: paymentMethods = [] } = useQuery<PaymentMethod[]>({
    queryKey: ["payment-methods-checkout"],
    queryFn: () => fetch("/api/payment-methods", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }).then(r => r.json()),
  });

  const { data: domainExtensions = [] } = useQuery<any[]>({
    queryKey: ["domain-extensions-public"],
    queryFn: () => fetch("/api/domain-extensions").then(r => r.json()),
  });

  const { data: myDomains = [] } = useQuery<any[]>({
    queryKey: ["client-domains-checkout"],
    queryFn: () => apiFetch("/api/domains"),
  });

  const { data: pkgDetails } = useQuery<any>({
    queryKey: ["package-details", packageId],
    queryFn: () => apiFetch(`/api/packages/${packageId}`),
    enabled: !!packageId,
  });

  const { data: creditsData } = useQuery<{ creditBalance: string }>({
    queryKey: ["my-credits-checkout"],
    queryFn: () => apiFetch("/api/my/credits"),
  });
  const creditBalance = parseFloat(creditsData?.creditBalance ?? "0");

  const pkgFreeDomainEnabled = pkgDetails?.freeDomainEnabled ?? false;
  const pkgFreeTlds: string[] = Array.isArray(pkgDetails?.freeDomainTlds) ? pkgDetails.freeDomainTlds : [];
  const isYearly = billingCycle === "yearly";
  const isDomainFree = isYearly && pkgFreeDomainEnabled && domainChoice === "register";

  useEffect(() => {
    const saved = sessionStorage.getItem("domain_search") || localStorage.getItem("order_wizard_domain");
    if (saved) {
      setDomainName(saved);
      setDomainChoice("register");
      setTimeout(() => checkDomain(saved), 600);
    }
  }, []);

  useEffect(() => {
    if (!packageId) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    const domain = sessionStorage.getItem("domain_search") || localStorage.getItem("order_wizard_domain") || undefined;
    fetch("/api/client/cart-session", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ packageId, packageName, domainName: domain }),
    })
      .then(r => r.json())
      .then(d => { if (d?.id) cartSessionIdRef.current = d.id; })
      .catch(() => {});
  }, [packageId]);

  const getDomainExt = (domain: string) => {
    if (!domain || !domain.includes(".")) return null;
    const parts = domain.split(".");
    const long  = `.${parts.slice(-2).join(".")}`;
    const short = `.${parts[parts.length - 1]}`;
    return domainExtensions.find(e => e.extension === long) || domainExtensions.find(e => e.extension === short);
  };

  const getDomainPrice = (domain: string, period: 1 | 2 | 3): number => {
    const ext = getDomainExt(domain);
    if (!ext) return 0;
    if (period === 2 && ext.register2YearPrice) return Number(ext.register2YearPrice);
    if (period === 3 && ext.register3YearPrice) return Number(ext.register3YearPrice);
    return Number(ext.registerPrice ?? 0) * period;
  };

  const hostingPrice = priceMap[billingCycle] ?? monthlyPrice;
  const domainAmount = domainChoice === "register" && domainName && !isDomainFree
    ? getDomainPrice(domainName, domainPeriod) : 0;
  const addonTotal = Object.entries(addons).filter(([, v]) => v)
    .reduce((s, [k]) => s + (ADDONS.find(a => a.key === k)?.price ?? 0), 0);
  const subtotal = hostingPrice + domainAmount + addonTotal;
  const promoDiscount = promoResult?.discountAmount ?? 0;
  const total = Math.max(0, subtotal - promoDiscount);

  async function checkDomain(domain: string) {
    const d = domain.trim().toLowerCase();
    if (!d || !d.includes(".")) { setDomainAvail(null); return; }
    const parts = d.split(".");
    if (!parts[0]) { setDomainAvail(null); return; }
    setCheckingDomain(true); setDomainAvail(null);
    try {
      const res = await fetch(`/api/domains/availability?domain=${encodeURIComponent(parts[0])}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json();
      if (Array.isArray(data?.results)) {
        const tld = "." + parts.slice(1).join(".");
        const match = data.results.find((r: any) => r.tld === tld) || data.results[0];
        if (match) setDomainAvail(match.available ? "available" : "taken");
      }
    } catch { setDomainAvail(null); }
    finally { setCheckingDomain(false); }
  }

  async function handlePromo() {
    if (!promoCode.trim()) return;
    setPromoLoading(true); setPromoError(""); setPromoResult(null);
    try {
      const p = new URLSearchParams({ code: promoCode.trim(), amount: String(subtotal), serviceType: "hosting", billingCycle });
      const data = await apiFetch(`/api/promo-codes/validate?${p.toString()}`);
      setPromoResult(data);
    } catch (err: any) {
      setPromoError(err.message || "Invalid code");
    } finally { setPromoLoading(false); }
  }

  async function handlePlaceOrder() {
    if (!packageId) { toast({ title: "Missing package", variant: "destructive" }); return; }
    if (captchaRequired && !captchaToken) {
      toast({ title: "Security check required", description: "Please complete the captcha.", variant: "destructive" }); return;
    }
    setPlacing(true);
    try {
      const domainForOrder = domainChoice === "register" && domainName ? domainName
        : domainChoice === "existing" && existingDomainId
          ? ((myDomains.find((d: any) => d.id === existingDomainId)?.name ?? "") + (myDomains.find((d: any) => d.id === existingDomainId)?.tld ?? ""))
          : null;

      const data = await apiFetch("/api/checkout", {
        method: "POST",
        body: JSON.stringify({
          packageId, billingCycle,
          billingPeriod: CYCLE_MONTHS[billingCycle],
          domain: domainForOrder,
          registerDomain: domainChoice === "register" && domainAvail === "available",
          freeDomain: isDomainFree,
          domainAmount: isDomainFree ? 0 : domainAmount,
          domainPeriod,
          promoCode: promoResult ? promoCode : undefined,
          paymentMethodId: selectedPm !== "none" && selectedPm !== "credits" ? selectedPm : undefined,
          useCredits: selectedPm === "credits",
          ...(captchaToken ? { captchaToken } : {}),
          currencyCode: currency.code, currencySymbol: currency.symbol, currencyRate: currency.rate,
        }),
      });

      const pmObj = paymentMethods.find(p => p.id === selectedPm);
      if (pmObj?.type === "safepay" && data.invoice?.id) {
        const spData = await apiFetch("/api/payments/safepay/initiate", {
          method: "POST",
          body: JSON.stringify({ invoiceId: data.invoice.id }),
        });
        if (spData.checkoutUrl) { window.location.href = spData.checkoutUrl; return; }
      }

      sessionStorage.removeItem("domain_search");
      localStorage.removeItem("order_wizard_domain");

      if (cartSessionIdRef.current) {
        const token = localStorage.getItem("token");
        fetch(`/api/client/cart-session/${cartSessionIdRef.current}/complete`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }

      setLocation(data.invoice?.id ? `/client/invoices/${data.invoice.id}` : "/client/invoices");
    } catch (err: any) {
      toast({ title: "Order failed", description: err.message, variant: "destructive" });
    } finally { setPlacing(false); }
  }

  const toggleAddon = (key: string) => setAddons(prev => ({ ...prev, [key]: !prev[key] }));

  const selectedPmObj = paymentMethods.find(p => p.id === selectedPm);
  const isSafepay     = selectedPmObj?.type === "safepay";
  const isManual      = selectedPmObj && !["safepay", "stripe"].includes(selectedPmObj.type);

  return (
    <div className="space-y-0">
      {/* ── Slim checkout header ── */}
      <div className="flex items-center justify-between py-3 px-1 mb-6 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: BRAND_GRADIENT }}>
            <Lock size={13} className="text-white" />
          </div>
          <span className="font-display font-bold text-foreground text-sm tracking-tight">Secure Checkout</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><ShieldCheck size={11} className="text-green-500" /> SSL Encrypted</span>
          <span className="hidden sm:flex items-center gap-1"><BadgeCheck size={11} className="text-primary" /> Verified Business</span>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">

        {/* ════════════ LEFT ════════════ */}
        <div className="space-y-5">

          {/* Hosting Plan */}
          {packageId && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-border flex items-center gap-3"
                style={{ background: "linear-gradient(135deg,rgba(112,26,254,0.06) 0%,rgba(155,81,224,0.03) 100%)" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(112,26,254,0.12)" }}>
                  <Server size={16} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-foreground truncate">{packageName}</h3>
                  <p className="text-xs text-muted-foreground">Hosting Package</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold text-white shrink-0" style={{ background: BRAND_GRADIENT }}>
                  <Star size={10} className="inline mr-1" />Popular
                </span>
              </div>
              <div className="p-5 space-y-4">
                {availableCycles.length > 1 && (
                  <>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Billing Period</p>
                    <div className={`grid gap-2.5 ${availableCycles.length === 2 ? "grid-cols-2" : availableCycles.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                      {availableCycles.map(cycle => {
                        const price = priceMap[cycle]!;
                        const savePct = cycle !== "monthly" && monthlyPrice > 0
                          ? Math.round((1 - price / (monthlyPrice * CYCLE_MONTHS[cycle])) * 100) : 0;
                        const isSel = billingCycle === cycle;
                        return (
                          <button key={cycle} onClick={() => { setBillingCycle(cycle); setPromoResult(null); setPromoError(""); }}
                            className={`relative p-3.5 rounded-xl border-2 text-left transition-all ${isSel ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                            {savePct > 0 && (
                              <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-green-500/15 text-green-500">
                                Save {savePct}%
                              </span>
                            )}
                            {cycle === "yearly" && pkgFreeDomainEnabled && (
                              <span className="block text-[9px] font-bold text-green-500 mb-1">
                                <Gift size={9} className="inline" /> FREE DOMAIN
                              </span>
                            )}
                            <div className="font-semibold text-sm text-foreground">{CYCLE_LABELS[cycle]}</div>
                            <div className="text-xl font-black text-primary mt-0.5">{formatPrice(price)}</div>
                            <div className="text-[10px] text-muted-foreground">{CYCLE_SUFFIX[cycle]}</div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
                {availableCycles.length === 1 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{CYCLE_LABELS[billingCycle]}</span>
                    <span className="text-xl font-black text-primary">{formatPrice(hostingPrice)}<span className="text-xs font-normal text-muted-foreground">{CYCLE_SUFFIX[billingCycle]}</span></span>
                  </div>
                )}
                {renewalPrice != null && (
                  <p className="text-xs text-muted-foreground">Renewal: {formatPrice(renewalPrice)}/mo</p>
                )}
                {isYearly && pkgFreeDomainEnabled && (
                  <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-600 text-xs font-medium">
                    <Gift size={14} className="shrink-0" />
                    Free domain registration included{pkgFreeTlds.length > 0 ? ` (${pkgFreeTlds.join(", ")})` : ""}!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Domain */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-border flex items-center gap-3"
              style={{ background: "linear-gradient(135deg,rgba(112,26,254,0.04) 0%,rgba(155,81,224,0.02) 100%)" }}>
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Globe size={16} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-foreground">Domain</h3>
                <p className="text-xs text-muted-foreground">Associate a domain with your hosting</p>
              </div>
              {isDomainFree && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-500/15 text-green-500 border border-green-500/25">FREE</span>
              )}
            </div>
            <div className="p-5 space-y-4">
              {/* Tabs */}
              <div className="flex rounded-xl overflow-hidden border border-border">
                {([
                  { v: "register", label: isYearly && pkgFreeDomainEnabled ? "Register Free" : "Register New" },
                  { v: "existing", label: "Use Existing" },
                  { v: "skip",    label: "Skip for Now" },
                ] as const).map(({ v, label }) => (
                  <button key={v} onClick={() => setDomainChoice(v)}
                    className={`flex-1 py-2.5 text-xs font-semibold transition-all ${domainChoice === v ? "text-white" : "text-muted-foreground hover:text-foreground bg-card"}`}
                    style={domainChoice === v ? { background: BRAND_GRADIENT } : {}}>
                    {label}
                  </button>
                ))}
              </div>

              {domainChoice === "register" && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={domainName}
                        onChange={e => {
                          const val = e.target.value;
                          setDomainName(val); setDomainAvail(null);
                          if (domainTimer.current) clearTimeout(domainTimer.current);
                          domainTimer.current = setTimeout(() => checkDomain(val), 800);
                        }}
                        placeholder="yourdomain.com"
                        className={`w-full pl-8 pr-3 py-2.5 bg-background border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all ${
                          domainAvail === "available" ? "border-green-500/50" : domainAvail === "taken" ? "border-red-500/50" : "border-border"
                        }`}
                      />
                    </div>
                    <button onClick={() => checkDomain(domainName)} disabled={checkingDomain || !domainName}
                      className="px-3.5 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
                      {checkingDomain ? <Loader2 size={14} className="animate-spin" /> : <SearchIcon size={14} />}
                    </button>
                  </div>

                  {checkingDomain && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> Checking…</p>
                  )}
                  {!checkingDomain && domainAvail === "available" && domainName && (
                    <div className="flex items-center gap-2 p-2.5 bg-green-500/10 border border-green-500/20 rounded-xl text-xs text-green-500">
                      <CheckCircle2 size={13} />
                      <span className="font-mono font-semibold">{domainName}</span>
                      <span className="text-green-600">is available!</span>
                      {isDomainFree
                        ? <span className="ml-auto px-1.5 py-0.5 bg-green-500/20 rounded-full font-bold">FREE</span>
                        : (() => { const ext = getDomainExt(domainName); return ext ? <span className="ml-auto font-bold">{formatPrice(Number(ext.registerPrice))}/yr</span> : null; })()
                      }
                    </div>
                  )}
                  {!checkingDomain && domainAvail === "taken" && (
                    <div className="flex items-center gap-2 p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                      <XCircle size={13} />
                      <span className="font-mono font-semibold">{domainName}</span>
                      <span>is already taken.</span>
                    </div>
                  )}

                  {/* Domain registration period (only if available and not free) */}
                  {domainAvail === "available" && !isDomainFree && domainName.includes(".") && (() => {
                    const ext = getDomainExt(domainName);
                    if (!ext) return null;
                    const baseP = Number(ext.registerPrice ?? 0);
                    const prices: Record<number, number> = {
                      1: baseP,
                      2: ext.register2YearPrice ? Number(ext.register2YearPrice) : baseP * 2,
                      3: ext.register3YearPrice ? Number(ext.register3YearPrice) : baseP * 3,
                    };
                    return (
                      <div>
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Registration Period</p>
                        <div className="grid grid-cols-3 gap-2">
                          {([1, 2, 3] as const).map(yr => {
                            const savePct = yr > 1 && baseP > 0 ? Math.round((1 - prices[yr] / (baseP * yr)) * 100) : 0;
                            return (
                              <button key={yr} onClick={() => setDomainPeriod(yr)}
                                className={`relative pt-5 pb-3 px-2 rounded-xl border-2 text-center transition-all ${domainPeriod === yr ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                                {yr === 3 && (
                                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[9px] font-bold rounded-full text-white whitespace-nowrap" style={{ background: BRAND_GRADIENT }}>
                                    🎉 Best Deal
                                  </span>
                                )}
                                <div className="font-bold text-sm text-foreground">{yr} Yr{yr > 1 ? "s" : ""}</div>
                                <div className="text-sm font-black text-primary mt-0.5">{formatPrice(prices[yr])}</div>
                                {savePct > 0 && <div className="text-[10px] text-green-500 font-semibold mt-0.5">Save {savePct}%</div>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {domainChoice === "existing" && (
                myDomains.length === 0
                  ? <p className="text-sm text-muted-foreground py-1">No domains in your account yet.</p>
                  : <select value={existingDomainId} onChange={e => setExistingDomainId(e.target.value)}
                      className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">Select a domain…</option>
                      {myDomains.map((d: any) => <option key={d.id} value={d.id}>{d.name}{d.tld}</option>)}
                    </select>
              )}

              {domainChoice === "skip" && (
                <p className="text-sm text-muted-foreground py-1">You can point a domain to your hosting later from your control panel.</p>
              )}
            </div>
          </div>

          {/* Complete Your Setup — Add-ons Slider */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-border flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Zap size={16} className="text-amber-500" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Complete Your Setup</h3>
                <p className="text-xs text-muted-foreground">Add-ons to maximise your website launch</p>
              </div>
            </div>
            <div className="p-5">
              <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
                {ADDONS.map(({ key, Icon, iconColor, iconBg, title, desc, price, badge }) => (
                  <button key={key} onClick={() => toggleAddon(key)}
                    className={`flex-shrink-0 w-[200px] p-4 rounded-2xl border-2 text-left transition-all ${addons[key] ? "border-primary bg-primary/5 shadow-md shadow-primary/10" : "border-border hover:border-primary/30 bg-card"}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
                        <Icon size={15} className={iconColor} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        {badge && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${badge === "Free" ? "bg-green-500/15 text-green-500" : "bg-primary/15 text-primary"}`}>
                            {badge}
                          </span>
                        )}
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${addons[key] ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                          {addons[key] && <Check size={9} className="text-white" />}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs font-bold text-foreground">{title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{desc}</p>
                    <p className="text-sm font-black mt-2">
                      {price === 0
                        ? <span className="text-green-500">FREE</span>
                        : <span className="text-primary">{formatPrice(price)}<span className="text-[10px] font-normal text-muted-foreground">/yr</span></span>
                      }
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Trust badges row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { Icon: Lock,       label: "256-bit SSL",    sub: "Encrypted connection",  color: "text-green-500",  bg: "bg-green-500/10"  },
              { Icon: BadgeCheck, label: "30-Day Refund",  sub: "Money-back guarantee",  color: "text-blue-400",   bg: "bg-blue-500/10"   },
              { Icon: Zap,        label: "Auto-Activate",  sub: "Instant after payment", color: "text-amber-400",  bg: "bg-amber-500/10"  },
              { Icon: ShieldCheck,label: "Privacy Safe",   sub: "Your data protected",   color: "text-purple-400", bg: "bg-purple-500/10" },
            ].map(({ Icon, label, sub, color, bg }) => (
              <div key={label} className="flex flex-col items-center text-center p-3.5 bg-card border border-border rounded-xl">
                <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-2`}>
                  <Icon size={16} className={color} />
                </div>
                <p className="text-xs font-bold text-foreground">{label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ════════════ RIGHT (STICKY) ════════════ */}
        <div className="lg:sticky lg:top-6 space-y-4">

          {/* Order Summary */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <Tag size={14} className="text-primary" /> Order Summary
              </h3>
            </div>
            <div className="p-5 space-y-3 text-sm">
              {packageId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground truncate mr-2">{packageName} <span className="text-xs">({CYCLE_LABELS[billingCycle]})</span></span>
                  <span className="font-semibold shrink-0">{formatPrice(hostingPrice)}</span>
                </div>
              )}
              {domainChoice === "register" && domainName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-mono truncate mr-2 text-xs">{domainName}{!isDomainFree && domainPeriod > 1 ? ` (${domainPeriod}yr)` : ""}</span>
                  {isDomainFree
                    ? <span className="text-green-500 font-semibold text-xs flex items-center gap-1"><Gift size={11} /> FREE</span>
                    : <span className="font-semibold shrink-0">{formatPrice(domainAmount)}</span>
                  }
                </div>
              )}
              {domainChoice === "existing" && existingDomainId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-mono text-xs truncate mr-2">
                    {myDomains.find((d: any) => d.id === existingDomainId)?.name ?? "Domain"}{myDomains.find((d: any) => d.id === existingDomainId)?.tld ?? ""}
                  </span>
                  <span className="text-muted-foreground text-xs">Included</span>
                </div>
              )}
              {Object.entries(addons).filter(([, v]) => v).map(([key]) => {
                const a = ADDONS.find(x => x.key === key)!;
                return (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground">{a.title}</span>
                    <span className="font-semibold shrink-0">{a.price === 0 ? <span className="text-green-500 text-xs">FREE</span> : formatPrice(a.price)}</span>
                  </div>
                );
              })}
              <div className="border-t border-border/50 pt-3 flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatPrice(subtotal)}</span>
              </div>
              {promoResult && promoDiscount > 0 && (
                <div className="flex justify-between text-green-500 font-semibold">
                  <span className="flex items-center gap-1"><Tag size={11} /> {promoResult.code}</span>
                  <span>-{formatPrice(promoDiscount)}</span>
                </div>
              )}
              <div className="border-t border-border pt-3 flex justify-between items-center">
                <span className="font-bold text-foreground">Total Due</span>
                <span className="text-2xl font-black text-primary">{formatPrice(total)}</span>
              </div>
            </div>
          </div>

          {/* Promo Code */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2.5">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Tag size={12} className="text-primary" /> Promo Code <span className="text-muted-foreground font-normal">(optional)</span>
            </p>
            <div className="flex gap-2">
              <input
                value={promoCode}
                onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoResult(null); setPromoError(""); }}
                placeholder="ENTER CODE"
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono uppercase focus:outline-none focus:border-primary transition-colors"
              />
              <button onClick={handlePromo} disabled={promoLoading || !promoCode.trim()}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 ${promoResult ? "bg-green-500/15 text-green-500" : "bg-primary/10 text-primary hover:bg-primary/20"}`}>
                {promoLoading ? <Loader2 size={13} className="animate-spin" /> : promoResult ? <CheckCircle2 size={13} /> : "Apply"}
              </button>
            </div>
            {promoError && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={11} /> {promoError}</p>}
            {promoResult && promoDiscount > 0 && (
              <p className="text-xs text-green-500 font-semibold flex items-center gap-1"><CheckCircle2 size={11} /> Saved {formatPrice(promoDiscount)}!</p>
            )}
          </div>

          {/* Payment Methods */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <CreditCard size={14} className="text-primary" /> Payment Method
              </h3>
            </div>
            <div className="p-4 space-y-2.5">
              {/* Wallet */}
              {creditBalance > 0 && (
                <button onClick={() => setSelectedPm(selectedPm === "credits" ? "none" : "credits")}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${selectedPm === "credits" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Wallet size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">Wallet Balance</p>
                    <p className={`text-xs ${creditBalance >= total ? "text-green-500" : "text-amber-500"}`}>
                      {formatPrice(creditBalance)} {creditBalance >= total ? "· Enough to pay in full" : `· Short by ${formatPrice(total - creditBalance)}`}
                    </p>
                  </div>
                  {selectedPm === "credits" && <CheckCircle2 size={16} className="text-primary shrink-0" />}
                </button>
              )}

              {/* External payment methods */}
              {paymentMethods.map(pm => {
                const isSel  = selectedPm === pm.id;
                const isAuto = ["safepay", "stripe"].includes(pm.type);
                return (
                  <button key={pm.id} onClick={() => setSelectedPm(isSel ? "none" : pm.id)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${isSel ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                    <PayIcon type={pm.type} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{pm.name}</span>
                        {isAuto && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-green-500/15 text-green-500">⚡ Instant</span>}
                        {pm.isSandbox && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500/10 text-amber-500">Sandbox</span>}
                      </div>
                      {pm.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{pm.description}</p>}
                      {(pm.type === "jazzcash" || pm.type === "easypaisa") && pm.publicSettings?.mobileNumber && (
                        <p className="text-xs text-muted-foreground mt-0.5">Send to: {pm.publicSettings.mobileNumber}</p>
                      )}
                      {pm.type === "bank_transfer" && pm.publicSettings?.bankName && (
                        <p className="text-xs text-muted-foreground mt-0.5">{pm.publicSettings.bankName} · {pm.publicSettings.accountTitle}</p>
                      )}
                    </div>
                    {isSel && <CheckCircle2 size={16} className="text-primary shrink-0" />}
                  </button>
                );
              })}

              {/* Pay Later */}
              <button onClick={() => setSelectedPm("none")}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${selectedPm === "none" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                  <ChevronRight size={18} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Pay Later</p>
                  <p className="text-xs text-muted-foreground">Place order now, pay via invoice</p>
                </div>
                {selectedPm === "none" && <CheckCircle2 size={16} className="text-primary shrink-0 ml-auto" />}
              </button>

              {/* Safepay info */}
              {isSafepay && (
                <div className="flex gap-2 p-3 rounded-lg border border-green-500/20 bg-green-500/[0.07] text-xs">
                  <CheckCircle2 size={13} className="text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-green-400 font-semibold">⚡ Instant Automatic Activation</p>
                    <p className="text-muted-foreground mt-0.5">Hosting activates the moment Safepay confirms your payment — no waiting.</p>
                  </div>
                </div>
              )}

              {/* Manual method note */}
              {isManual && (
                <div className="flex gap-2 p-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.07] text-xs">
                  <AlertCircle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-muted-foreground">Send payment proof after placing order. Service activates within 24 hours after admin verification.</p>
                </div>
              )}
            </div>
          </div>

          {/* Captcha */}
          {captchaRequired && captchaConfig?.siteKey && (
            <div className="bg-card border border-border rounded-xl p-4">
              <CaptchaWidget siteKey={captchaConfig.siteKey} provider={captchaConfig.provider ?? "turnstile"}
                onVerify={t => setCaptchaToken(t)} onExpire={() => setCaptchaToken(null)} />
            </div>
          )}

          {/* CTA */}
          <button onClick={handlePlaceOrder}
            disabled={placing || !packageId || (captchaRequired && !captchaToken)}
            className="w-full h-14 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]"
            style={{ background: BRAND_GRADIENT, boxShadow: placing ? "none" : "0 8px 32px rgba(112,26,254,0.35)" }}>
            {placing
              ? <><Loader2 size={18} className="animate-spin" /> Placing Order…</>
              : <><ShieldCheck size={18} /> Complete Purchase — {formatPrice(total)}</>
            }
          </button>

          {/* Micro trust row */}
          <div className="flex items-center justify-center gap-5 text-[11px] text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><Lock size={10} className="text-green-500" /> SSL Secured</span>
            <span className="flex items-center gap-1"><BadgeCheck size={10} className="text-primary" /> 30-Day Guarantee</span>
            <span className="flex items-center gap-1"><ShieldCheck size={10} className="text-blue-400" /> No Hidden Fees</span>
          </div>
        </div>
      </div>
    </div>
  );
}
