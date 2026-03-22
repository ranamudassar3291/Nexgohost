import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Tag, CreditCard, CheckCircle, Loader2, AlertCircle,
  ArrowLeft, ArrowRight, Package, Globe, Receipt, Check,
  Search as SearchIcon, XCircle, Gift,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useCurrency } from "@/context/CurrencyProvider";

interface PaymentMethod { id: string; name: string; type: string; description: string | null; isSandbox: boolean; }
interface PromoResult {
  valid: boolean; code: string; discountPercent: number;
  discountAmount: number; originalAmount: number; finalAmount: number;
}

const METHOD_ICONS: Record<string, string> = {
  stripe: "💳", paypal: "🅿️", bank_transfer: "🏦", crypto: "₿", manual: "✍️",
};

type BillingCycle = "monthly" | "quarterly" | "semiannual" | "yearly";

const CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: "Monthly", quarterly: "Quarterly", semiannual: "Semiannual (6 mo)", yearly: "Yearly",
};
const CYCLE_SUFFIX: Record<BillingCycle, string> = {
  monthly: "/mo", quarterly: "/qtr", semiannual: "/6mo", yearly: "/yr",
};
const CYCLE_MONTHS: Record<BillingCycle, number> = {
  monthly: 1, quarterly: 3, semiannual: 6, yearly: 12,
};

const STEPS = [
  { id: 1, label: "Plan", icon: Package },
  { id: 2, label: "Domain", icon: Globe },
  { id: 3, label: "Review", icon: Receipt },
  { id: 4, label: "Payment", icon: CreditCard },
  { id: 5, label: "Confirm", icon: CheckCircle },
];

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function Checkout() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();

  const params = new URLSearchParams(search);
  const packageId = params.get("packageId") ?? "";
  const packageName = params.get("packageName") ?? "Hosting Package";
  const monthlyPrice = parseFloat(params.get("monthlyPrice") ?? params.get("amount") ?? "0");
  const quarterlyPrice = params.get("quarterlyPrice") ? parseFloat(params.get("quarterlyPrice")!) : null;
  const semiannualPrice = params.get("semiannualPrice") ? parseFloat(params.get("semiannualPrice")!) : null;
  const yearlyPrice = params.get("yearlyPrice") ? parseFloat(params.get("yearlyPrice")!) : null;
  const initialCycle = (params.get("billingCycle") as BillingCycle) || "monthly";

  const priceMap: Partial<Record<BillingCycle, number>> = {
    monthly: monthlyPrice,
    ...(quarterlyPrice ? { quarterly: quarterlyPrice } : {}),
    ...(semiannualPrice ? { semiannual: semiannualPrice } : {}),
    ...(yearlyPrice ? { yearly: yearlyPrice } : {}),
  };
  const availableCycles = (Object.keys(priceMap) as BillingCycle[]).filter(c => priceMap[c] != null && priceMap[c]! > 0);

  const [step, setStep] = useState(1);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    availableCycles.includes(initialCycle) ? initialCycle : "monthly"
  );
  const [domainChoice, setDomainChoice] = useState<"register" | "existing" | "manual" | "skip">("skip");
  const [domainName, setDomainName] = useState("");
  const [existingDomainId, setExistingDomainId] = useState("");
  const [domainAvailability, setDomainAvailability] = useState<"available" | "taken" | "invalid" | null>(null);
  const [checkingDomain, setCheckingDomain] = useState(false);
  const domainCheckTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoResult, setPromoResult] = useState<PromoResult | null>(null);
  const [promoError, setPromoError] = useState("");
  const [checkingPromo, setCheckingPromo] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("none");
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState<any>(null);

  const isYearly = billingCycle === "yearly";
  const isDomainFree = isYearly && pkgFreeDomainEnabled && domainChoice === "register" && (domainName ? tldIsFree : true);

  const { data: paymentMethods = [] } = useQuery<PaymentMethod[]>({
    queryKey: ["payment-methods"],
    queryFn: () => fetch("/api/payment-methods", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }).then(r => r.json()),
  });

  const { data: domainExtensions = [] } = useQuery<Array<{ extension: string; registerPrice: string; renewalPrice: string }>>({
    queryKey: ["domain-extensions-public"],
    queryFn: () => fetch("/api/domain-extensions").then(r => r.json()),
  });

  const { data: myDomains = [] } = useQuery<any[]>({
    queryKey: ["client-domains"],
    queryFn: () => apiFetch("/api/domains"),
  });

  const { data: pkgDetails } = useQuery<any>({
    queryKey: ["package-details", packageId],
    queryFn: () => apiFetch(`/api/packages/${packageId}`),
    enabled: !!packageId,
  });

  const pkgFreeDomainEnabled = pkgDetails?.freeDomainEnabled ?? false;
  const pkgFreeTlds: string[] = Array.isArray(pkgDetails?.freeDomainTlds) ? pkgDetails.freeDomainTlds : [];

  const getDomainTld = (domain: string) => {
    if (!domain.includes(".")) return "";
    const parts = domain.split(".");
    return parts.length >= 3 ? `.${parts.slice(-2).join(".")}` : `.${parts[parts.length - 1]}`;
  };
  const domainTld = getDomainTld(domainName.trim().toLowerCase());
  const tldIsFree = pkgFreeTlds.length === 0 ? true : pkgFreeTlds.some(t => domainTld.endsWith(t));

  const getDomainPrice = (domain: string): { register: number; renew: number } | null => {
    if (!domain || !domain.includes(".")) return null;
    const parts = domain.split(".");
    const longTld = `.${parts.slice(-2).join(".")}`;
    const shortTld = `.${parts[parts.length - 1]}`;
    const ext = domainExtensions.find(e => e.extension === longTld) || domainExtensions.find(e => e.extension === shortTld);
    if (!ext) return null;
    return { register: Number(ext.registerPrice), renew: Number(ext.renewalPrice) };
  };

  const basePrice = priceMap[billingCycle] ?? monthlyPrice;
  const domainPriceInfo = domainChoice === "register" ? getDomainPrice(domainName) : null;
  const domainAmount = isDomainFree ? 0 : (domainPriceInfo?.register ?? 0);
  const discount = promoResult ? promoResult.discountAmount : 0;
  const finalAmount = Math.max(0, basePrice + domainAmount - discount);

  const checkDomainAvailability = async (domain: string) => {
    const trimmed = domain.trim().toLowerCase();
    if (!trimmed || !trimmed.includes(".")) { setDomainAvailability(null); return; }
    const parts = trimmed.split(".");
    if (parts.length < 2 || !parts[0] || !parts[parts.length - 1]) { setDomainAvailability(null); return; }
    const nameOnly = parts[0];
    const tld = "." + parts.slice(1).join(".");
    setCheckingDomain(true);
    setDomainAvailability(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/domains/availability?domain=${encodeURIComponent(nameOnly)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data?.results && Array.isArray(data.results)) {
        const match = data.results.find((r: any) => r.tld === tld);
        if (match) { setDomainAvailability(match.available ? "available" : "taken"); }
        else if (data.results.length > 0) { setDomainAvailability(data.results[0].available ? "available" : "taken"); }
        else { setDomainAvailability(null); }
      } else { setDomainAvailability(null); }
    } catch { setDomainAvailability(null); }
    finally { setCheckingDomain(false); }
  };

  const handlePromo = async () => {
    if (!promoCode.trim()) return;
    setCheckingPromo(true); setPromoError(""); setPromoResult(null);
    try {
      const data = await apiFetch(`/api/promo-codes/validate?code=${encodeURIComponent(promoCode)}&amount=${basePrice}&serviceType=hosting`);
      setPromoResult(data);
    } catch (err: any) {
      setPromoError(err.message || "Invalid code");
    } finally { setCheckingPromo(false); }
  };

  const handlePlaceOrder = async () => {
    if (!packageId) { toast({ title: "Missing package", variant: "destructive" }); return; }
    setPlacing(true);
    try {
      const domainForOrder = domainChoice === "register" && domainName ? domainName :
        domainChoice === "manual" && domainName ? domainName :
        domainChoice === "existing" && existingDomainId ? (myDomains.find((d: any) => d.id === existingDomainId)?.name + (myDomains.find((d: any) => d.id === existingDomainId)?.tld || "")) : null;

      const data = await apiFetch("/api/checkout", {
        method: "POST",
        body: JSON.stringify({
          packageId,
          billingCycle,
          billingPeriod: CYCLE_MONTHS[billingCycle],
          domain: domainForOrder,
          registerDomain: domainChoice === "register" && domainAvailability === "available",
          freeDomain: isDomainFree,
          domainAmount: isDomainFree ? 0 : domainAmount,
          promoCode: promoResult ? promoCode : undefined,
          paymentMethodId: selectedPaymentMethod !== "none" ? selectedPaymentMethod : undefined,
        }),
      });
      setSuccess(data);
      setStep(6);
    } catch (err: any) {
      toast({ title: "Order failed", description: err.message, variant: "destructive" });
    } finally { setPlacing(false); }
  };

  if (step === 6 && success) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-lg mx-auto text-center space-y-6 py-12">
        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
          <CheckCircle size={40} className="text-green-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Order Placed!</h1>
          <p className="text-muted-foreground">Your hosting account is being set up. You'll receive a confirmation email shortly.</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 text-left space-y-3">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Package</span><span className="font-medium">{success.summary?.packageName}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Billing</span><span className="font-medium capitalize">{billingCycle}</span></div>
          {isDomainFree && success.summary?.domain && (
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Domain</span><span className="font-medium text-green-400">✓ {success.summary.domain} (FREE)</span></div>
          )}
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Invoice</span><span className="font-medium text-primary">#{success.invoice?.invoiceNumber}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Amount Due</span><span className="font-medium">{formatPrice(success.invoice?.amount || success.summary?.finalAmount || 0)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Status</span><span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">Pending Payment</span></div>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setLocation("/client/invoices")} className="flex-1 bg-primary hover:bg-primary/90">View Invoice</Button>
          <Button variant="outline" onClick={() => setLocation("/client/dashboard")}>Dashboard</Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between relative">
        <div className="absolute top-5 left-0 right-0 h-px bg-border -z-10" />
        {STEPS.map((s) => {
          const Icon = s.icon;
          const done = step > s.id;
          const active = step === s.id;
          return (
            <div key={s.id} className="flex flex-col items-center gap-1.5">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${done ? "bg-primary border-primary" : active ? "bg-primary/10 border-primary" : "bg-card border-border"}`}>
                {done ? <Check size={16} className="text-white" /> : <Icon size={16} className={active ? "text-primary" : "text-muted-foreground"} />}
              </div>
              <span className={`text-xs font-medium ${active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>

          {/* Step 1: Billing Cycle */}
          {step === 1 && (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">Select Billing Period</h2>
                <p className="text-sm text-muted-foreground mt-1">Choose how you'd like to pay for {packageName}</p>
              </div>

              <div className={`grid gap-4 ${availableCycles.length <= 2 ? "grid-cols-2" : availableCycles.length === 3 ? "grid-cols-3" : "grid-cols-2 md:grid-cols-4"}`}>
                {availableCycles.map(cycle => {
                  const price = priceMap[cycle]!;
                  const isSelected = billingCycle === cycle;
                  const savePct = cycle !== "monthly" ? Math.round((1 - price / (monthlyPrice * CYCLE_MONTHS[cycle])) * 100) : 0;
                  return (
                    <button key={cycle} onClick={() => setBillingCycle(cycle)}
                      className={`p-4 rounded-2xl border-2 text-left transition-all relative ${isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                      {savePct > 0 && (
                        <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-green-500/20 text-green-500 text-xs rounded-md font-medium">
                          Save {savePct}%
                        </div>
                      )}
                      {cycle === "yearly" && (
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded-md font-medium flex items-center gap-1">
                          <Gift size={10} /> Free Domain
                        </div>
                      )}
                      <div className={`font-semibold text-foreground ${cycle === "yearly" ? "mt-5" : ""}`}>{CYCLE_LABELS[cycle]}</div>
                      <div className="text-xl font-bold text-primary mt-1">{formatPrice(price)}</div>
                      <div className="text-xs text-muted-foreground">{CYCLE_SUFFIX[cycle]}</div>
                    </button>
                  );
                })}
              </div>

              {isYearly && pkgFreeDomainEnabled && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 text-sm">
                  <Gift size={16} />
                  <span className="font-medium">
                    Yearly plan includes a free domain registration
                    {pkgFreeTlds.length > 0 ? ` (${pkgFreeTlds.join(", ")})` : ""}!
                  </span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button onClick={() => setStep(2)} className="bg-primary hover:bg-primary/90">
                  Continue <ArrowRight size={16} className="ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Domain */}
          {step === 2 && (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
              <div>
                <h2 className="text-xl font-bold text-foreground">Domain</h2>
                <p className="text-sm text-muted-foreground mt-1">Add a domain to your hosting account</p>
              </div>

              {isYearly && pkgFreeDomainEnabled && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 text-sm">
                  <Gift size={16} />
                  <span className="font-medium">
                    Yearly plan includes one free domain registration
                    {pkgFreeTlds.length > 0 ? ` for: ${pkgFreeTlds.join(", ")}` : ""}!
                  </span>
                </div>
              )}

              <div className="space-y-3">
                {[
                  { value: "register", label: isYearly && pkgFreeDomainEnabled ? "Register a new domain — FREE!" : "Register a new domain", icon: isYearly && pkgFreeDomainEnabled ? "🎁" : "🌐" },
                  { value: "existing", label: "Use an existing domain in my account", icon: "🔗" },
                  { value: "manual", label: "I have a domain (set up manually)", icon: "⚙️" },
                  { value: "skip", label: "Skip — I'll set this up later", icon: "⏭️" },
                ].map(opt => (
                  <button key={opt.value} onClick={() => setDomainChoice(opt.value as any)}
                    className={`w-full p-4 rounded-xl border-2 text-left flex items-center gap-3 transition-all ${domainChoice === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                    <span className="text-xl">{opt.icon}</span>
                    <span className="font-medium text-foreground text-sm flex-1">{opt.label}</span>
                    {opt.value === "register" && isYearly && pkgFreeDomainEnabled && (
                      <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-600 text-xs font-bold">FREE</span>
                    )}
                    {domainChoice === opt.value && <Check size={16} className="text-primary ml-auto" />}
                  </button>
                ))}
              </div>

              {domainChoice === "existing" && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">Select domain</label>
                  {myDomains.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No domains in your account yet.</p>
                  ) : (
                    <select value={existingDomainId} onChange={e => setExistingDomainId(e.target.value)}
                      className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">Select...</option>
                      {myDomains.map((d: any) => <option key={d.id} value={d.id}>{d.name}{d.tld}</option>)}
                    </select>
                  )}
                </div>
              )}

              {(domainChoice === "register" || domainChoice === "manual") && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/80">
                    {domainChoice === "register" ? "Domain to register" : "Domain name"}
                  </label>
                  {domainChoice === "register" && isYearly && pkgFreeDomainEnabled && pkgFreeTlds.length > 0 && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <Gift size={11} /> Free for: <span className="font-mono">{pkgFreeTlds.join(", ")}</span>
                    </p>
                  )}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        value={domainName}
                        onChange={e => {
                          const val = e.target.value;
                          setDomainName(val);
                          setDomainAvailability(null);
                          if (domainCheckTimeout.current) clearTimeout(domainCheckTimeout.current);
                          if (domainChoice === "register") {
                            domainCheckTimeout.current = setTimeout(() => checkDomainAvailability(val), 800);
                          }
                        }}
                        placeholder="yourdomain.com"
                        className={domainAvailability === "available" ? "border-green-500/50" : domainAvailability === "taken" ? "border-red-500/50" : ""}
                      />
                    </div>
                    {domainChoice === "register" && (
                      <Button type="button" variant="outline" size="sm" className="h-10 px-3"
                        onClick={() => checkDomainAvailability(domainName)} disabled={checkingDomain || !domainName}>
                        {checkingDomain ? <Loader2 size={14} className="animate-spin" /> : <SearchIcon size={14} />}
                      </Button>
                    )}
                  </div>

                  {domainChoice === "register" && checkingDomain && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Loader2 size={12} className="animate-spin" /> Checking availability...
                    </p>
                  )}
                  {domainChoice === "register" && domainAvailability === "available" && !checkingDomain && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-green-500 flex items-center gap-1.5">
                        <CheckCircle size={12} /> <strong>{domainName}</strong> is available!
                      </p>
                      {isDomainFree ? (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-xs">
                          <Gift size={12} className="text-green-500" />
                          <span className="text-green-600 font-semibold">FREE with your yearly plan!</span>
                          {(() => { const p = getDomainPrice(domainName); return p ? <span className="text-muted-foreground line-through ml-auto">{formatPrice(p.register)}/yr</span> : null; })()}
                        </div>
                      ) : (
                        (() => {
                          const price = getDomainPrice(domainName);
                          return price ? (
                            <div className="flex items-center gap-3 text-xs bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                              <span className="text-green-500 font-medium">Register: {formatPrice(price.register)}/yr</span>
                              <span className="text-muted-foreground">· Renew: {formatPrice(price.renew)}/yr</span>
                            </div>
                          ) : null;
                        })()
                      )}
                    </div>
                  )}
                  {domainChoice === "register" && domainAvailability === "taken" && !checkingDomain && (
                    <p className="text-xs text-red-400 flex items-center gap-1.5">
                      <XCircle size={12} /> <strong>{domainName}</strong> is already registered.
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft size={16} className="mr-2" /> Back</Button>
                <Button onClick={() => setStep(3)} className="bg-primary hover:bg-primary/90">
                  Continue <ArrowRight size={16} className="ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Review + Promo */}
          {step === 3 && (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
              <div>
                <h2 className="text-xl font-bold text-foreground">Order Summary</h2>
                <p className="text-sm text-muted-foreground mt-1">Review your order and apply a promo code</p>
              </div>

              <div className="space-y-3 border border-border/50 rounded-xl p-4 bg-secondary/20">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Package</span>
                  <span className="font-medium">{packageName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Billing</span>
                  <span className="font-medium">{CYCLE_LABELS[billingCycle]}</span>
                </div>
                {domainChoice === "register" && domainName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Domain Registration</span>
                    {isDomainFree ? (
                      <span className="font-medium text-green-500 flex items-center gap-1"><Gift size={12} /> FREE</span>
                    ) : (
                      <span className="font-medium">{formatPrice(domainAmount)} /yr</span>
                    )}
                  </div>
                )}
                {domainChoice === "existing" && existingDomainId && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Domain</span>
                    <span className="font-medium">{myDomains.find((d: any) => d.id === existingDomainId)?.name || "Existing"}</span>
                  </div>
                )}
                {domainChoice === "manual" && domainName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Domain</span>
                    <span className="font-medium">{domainName}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm border-t border-border/50 pt-3">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatPrice(basePrice + domainAmount)}</span>
                </div>
                {promoResult && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-500">Discount ({promoResult.discountPercent}%)</span>
                    <span className="font-medium text-green-500">-{formatPrice(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-base border-t border-border/50 pt-3">
                  <span>Total</span>
                  <span className="text-primary">{formatPrice(finalAmount)}</span>
                </div>
              </div>

              {isDomainFree && domainName && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 text-sm">
                  <Gift size={16} />
                  <span><strong>{domainName}</strong> is included FREE with your yearly plan</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80 flex items-center gap-1.5"><Tag size={14} /> Promo Code</label>
                <div className="flex gap-2">
                  <Input value={promoCode} onChange={e => { setPromoCode(e.target.value); setPromoError(""); setPromoResult(null); }} placeholder="SAVE20" className="flex-1" />
                  <Button type="button" variant="outline" onClick={handlePromo} disabled={checkingPromo || !promoCode}>
                    {checkingPromo ? <Loader2 size={16} className="animate-spin" /> : "Apply"}
                  </Button>
                </div>
                {promoError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} /> {promoError}</p>}
                {promoResult && <p className="text-xs text-green-500 flex items-center gap-1"><CheckCircle size={12} /> Code applied! Saving {promoResult.discountPercent}%</p>}
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft size={16} className="mr-2" /> Back</Button>
                <Button onClick={() => setStep(4)} className="bg-primary hover:bg-primary/90">
                  Continue <ArrowRight size={16} className="ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Payment Method */}
          {step === 4 && (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
              <div>
                <h2 className="text-xl font-bold text-foreground">Payment Method</h2>
                <p className="text-sm text-muted-foreground mt-1">Select how you'd like to pay</p>
              </div>

              <div className="space-y-3">
                {paymentMethods.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CreditCard size={32} className="mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No payment methods configured yet.</p>
                    <p className="text-xs mt-1">The admin will be notified of your order.</p>
                  </div>
                )}
                {paymentMethods.map(pm => (
                  <button key={pm.id} onClick={() => setSelectedPaymentMethod(pm.id)}
                    className={`w-full p-4 rounded-xl border-2 text-left flex items-center gap-3 transition-all ${selectedPaymentMethod === pm.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                    <span className="text-2xl">{METHOD_ICONS[pm.type] || "💰"}</span>
                    <div className="flex-1">
                      <div className="font-medium text-foreground text-sm">{pm.name}</div>
                      {pm.description && <div className="text-xs text-muted-foreground mt-0.5">{pm.description}</div>}
                      {pm.isSandbox && <span className="inline-block mt-1 px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 text-xs rounded">Sandbox</span>}
                    </div>
                    {selectedPaymentMethod === pm.id && <Check size={16} className="text-primary" />}
                  </button>
                ))}
                <button onClick={() => setSelectedPaymentMethod("none")}
                  className={`w-full p-4 rounded-xl border-2 text-left flex items-center gap-3 transition-all ${selectedPaymentMethod === "none" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                  <span className="text-2xl">📋</span>
                  <div>
                    <div className="font-medium text-foreground text-sm">Pay Later</div>
                    <div className="text-xs text-muted-foreground">Place order now, pay via invoice</div>
                  </div>
                  {selectedPaymentMethod === "none" && <Check size={16} className="text-primary ml-auto" />}
                </button>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(3)}><ArrowLeft size={16} className="mr-2" /> Back</Button>
                <Button onClick={() => setStep(5)} className="bg-primary hover:bg-primary/90">
                  Review Order <ArrowRight size={16} className="ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Confirm */}
          {step === 5 && (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
              <div>
                <h2 className="text-xl font-bold text-foreground">Confirm Order</h2>
                <p className="text-sm text-muted-foreground mt-1">Everything look good? Place your order below.</p>
              </div>

              <div className="space-y-3 border border-border/50 rounded-xl p-4 bg-secondary/20">
                {[
                  { label: "Package", value: packageName },
                  { label: "Billing", value: CYCLE_LABELS[billingCycle] },
                  ...(domainChoice === "register" && domainName ? [{ label: "New Domain", value: isDomainFree ? `${domainName} (FREE)` : domainName }] : []),
                  ...(domainChoice === "existing" && existingDomainId ? [{ label: "Domain", value: myDomains.find((d: any) => d.id === existingDomainId)?.name || "Existing" }] : []),
                  ...(domainChoice === "manual" && domainName ? [{ label: "Domain", value: domainName }] : []),
                  { label: "Subtotal", value: formatPrice(basePrice + domainAmount) },
                  ...(promoResult ? [{ label: `Discount (${promoResult.discountPercent}%)`, value: `-${formatPrice(discount)}` }] : []),
                  { label: "Payment", value: paymentMethods.find(p => p.id === selectedPaymentMethod)?.name || "Pay Later" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={`font-medium ${value.includes("FREE") ? "text-green-500" : ""}`}>{value}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-base border-t border-border/50 pt-3">
                  <span>Total Due</span>
                  <span className="text-primary text-lg">{formatPrice(finalAmount)}</span>
                </div>
              </div>

              {isDomainFree && domainName && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 text-sm">
                  <Gift size={16} />
                  <span>Free domain <strong>{domainName}</strong> included in your order</span>
                </div>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(4)}><ArrowLeft size={16} className="mr-2" /> Back</Button>
                <Button onClick={handlePlaceOrder} disabled={placing} className="bg-primary hover:bg-primary/90 min-w-32">
                  {placing ? <Loader2 size={16} className="animate-spin mr-2" /> : <ShoppingCart size={16} className="mr-2" />}
                  {placing ? "Placing..." : "Place Order"}
                </Button>
              </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}
