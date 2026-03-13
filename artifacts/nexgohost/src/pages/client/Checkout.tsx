import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Tag, CreditCard, CheckCircle, Loader2, AlertCircle,
  ArrowLeft, ArrowRight, Package, Globe, Receipt, Check, DollarSign,
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
  const { currency, formatPrice, allCurrencies, setCurrency } = useCurrency();

  const params = new URLSearchParams(search);
  const packageId = params.get("packageId") ?? "";
  const packageName = params.get("packageName") ?? "Hosting Package";
  const baseAmountMonthly = parseFloat(params.get("amount") ?? "0");
  const yearlyPriceParam = parseFloat(params.get("yearlyPrice") ?? "0");

  const [step, setStep] = useState(1);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [domainChoice, setDomainChoice] = useState<"existing" | "new" | "skip">("skip");
  const [existingDomain, setExistingDomain] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoResult, setPromoResult] = useState<PromoResult | null>(null);
  const [promoError, setPromoError] = useState("");
  const [checkingPromo, setCheckingPromo] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("none");
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState<any>(null);

  const { data: paymentMethods = [] } = useQuery<PaymentMethod[]>({
    queryKey: ["payment-methods"],
    queryFn: () => fetch("/api/payment-methods", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }).then(r => r.json()),
  });

  const { data: myDomains = [] } = useQuery<any[]>({
    queryKey: ["client-domains"],
    queryFn: () => apiFetch("/api/domains"),
  });

  const yearlyPrice = yearlyPriceParam > 0 ? yearlyPriceParam : baseAmountMonthly * 12;
  const baseAmount = billingPeriod === "monthly" ? baseAmountMonthly : yearlyPrice;
  const discount = promoResult ? promoResult.discountAmount : 0;
  const finalAmount = Math.max(0, baseAmount - discount);

  const handlePromo = async () => {
    if (!promoCode.trim()) return;
    setCheckingPromo(true); setPromoError(""); setPromoResult(null);
    try {
      const data = await apiFetch(`/api/promo-codes/validate?code=${encodeURIComponent(promoCode)}&amount=${baseAmount}`);
      setPromoResult(data);
    } catch (err: any) {
      setPromoError(err.message || "Invalid code");
    } finally { setCheckingPromo(false); }
  };

  const handlePlaceOrder = async () => {
    if (selectedPaymentMethod === "none") {
      toast({ title: "Select payment method", variant: "destructive" }); return;
    }
    setPlacing(true);
    try {
      const data = await apiFetch("/api/checkout", {
        method: "POST",
        body: JSON.stringify({
          packageId, billingCycle: billingPeriod,
          billingPeriod: billingPeriod === "yearly" ? 12 : 1,
          promoCode: promoResult ? promoCode : undefined,
          paymentMethodId: selectedPaymentMethod,
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
      {/* Step indicator */}
      <div className="flex items-center justify-between relative">
        <div className="absolute top-5 left-0 right-0 h-px bg-border -z-10" />
        {STEPS.map((s, i) => {
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

          {/* Step 1: Plan */}
          {step === 1 && (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">Select Billing Period</h2>
                <p className="text-sm text-muted-foreground mt-1">Choose how you'd like to pay for {packageName}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setBillingPeriod("monthly")} className={`p-4 rounded-2xl border-2 text-left transition-all ${billingPeriod === "monthly" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                  <div className="font-semibold text-foreground">Monthly</div>
                  <div className="text-2xl font-bold text-primary mt-1">{formatPrice(baseAmountMonthly)}</div>
                  <div className="text-xs text-muted-foreground">/ month</div>
                </button>
                <button onClick={() => setBillingPeriod("yearly")} className={`p-4 rounded-2xl border-2 text-left transition-all relative ${billingPeriod === "yearly" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                  {yearlyPriceParam > 0 && <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-md">Save {Math.round((1 - yearlyPrice / (baseAmountMonthly * 12)) * 100)}%</div>}
                  <div className="font-semibold text-foreground">Yearly</div>
                  <div className="text-2xl font-bold text-primary mt-1">{formatPrice(yearlyPrice)}</div>
                  <div className="text-xs text-muted-foreground">/ year</div>
                </button>
              </div>

              {/* Currency selector */}
              <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                <DollarSign size={16} className="text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Currency:</span>
                <div className="flex gap-2 flex-wrap">
                  {allCurrencies.map(c => (
                    <button key={c.code} onClick={() => setCurrency(c)}
                      className={`px-3 py-1 text-xs rounded-lg border transition-all ${currency.code === c.code ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                      {c.symbol} {c.code}
                    </button>
                  ))}
                </div>
              </div>

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
                <h2 className="text-xl font-bold text-foreground">Domain (Optional)</h2>
                <p className="text-sm text-muted-foreground mt-1">Link a domain to your hosting, or skip for now</p>
              </div>

              <div className="space-y-3">
                {[
                  { value: "skip", label: "Skip — I'll set this up later", icon: "⏭️" },
                  { value: "existing", label: "Use an existing domain in my account", icon: "🌐" },
                  { value: "new", label: "I have a domain (not in account)", icon: "🔗" },
                ].map(opt => (
                  <button key={opt.value} onClick={() => setDomainChoice(opt.value as any)}
                    className={`w-full p-4 rounded-xl border-2 text-left flex items-center gap-3 transition-all ${domainChoice === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                    <span className="text-xl">{opt.icon}</span>
                    <span className="font-medium text-foreground text-sm">{opt.label}</span>
                    {domainChoice === opt.value && <Check size={16} className="text-primary ml-auto" />}
                  </button>
                ))}
              </div>

              {domainChoice === "existing" && myDomains.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">Select domain</label>
                  <select value={existingDomain} onChange={e => setExistingDomain(e.target.value)}
                    className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">Select...</option>
                    {myDomains.map((d: any) => <option key={d.id} value={d.id}>{d.name}{d.tld}</option>)}
                  </select>
                </div>
              )}

              {domainChoice === "new" && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">Domain name</label>
                  <Input value={existingDomain} onChange={e => setExistingDomain(e.target.value)} placeholder="yourdomain.com" />
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
                  <span className="font-medium capitalize">{billingPeriod}</span>
                </div>
                {domainChoice !== "skip" && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Domain</span>
                    <span className="font-medium">{existingDomain || "Existing domain"}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm border-t border-border/50 pt-3">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatPrice(baseAmount)}</span>
                </div>
                {promoResult && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-400">Discount ({promoResult.discountPercent}%)</span>
                    <span className="font-medium text-green-400">-{formatPrice(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-base border-t border-border/50 pt-3">
                  <span>Total</span>
                  <span className="text-primary">{formatPrice(finalAmount)}</span>
                </div>
              </div>

              {/* Promo code */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80 flex items-center gap-1.5"><Tag size={14} /> Promo Code</label>
                <div className="flex gap-2">
                  <Input value={promoCode} onChange={e => { setPromoCode(e.target.value); setPromoError(""); setPromoResult(null); }} placeholder="SAVE20" className="flex-1" />
                  <Button type="button" variant="outline" onClick={handlePromo} disabled={checkingPromo || !promoCode}>
                    {checkingPromo ? <Loader2 size={16} className="animate-spin" /> : "Apply"}
                  </Button>
                </div>
                {promoError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} /> {promoError}</p>}
                {promoResult && <p className="text-xs text-green-400 flex items-center gap-1"><CheckCircle size={12} /> Code applied! Saving {promoResult.discountPercent}%</p>}
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
                {paymentMethods.length > 0 && (
                  <button onClick={() => setSelectedPaymentMethod("none")}
                    className={`w-full p-4 rounded-xl border-2 text-left flex items-center gap-3 transition-all ${selectedPaymentMethod === "none" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                    <span className="text-2xl">📋</span>
                    <div>
                      <div className="font-medium text-foreground text-sm">Pay Later</div>
                      <div className="text-xs text-muted-foreground">Place order now, pay via invoice</div>
                    </div>
                    {selectedPaymentMethod === "none" && <Check size={16} className="text-primary ml-auto" />}
                  </button>
                )}
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
                  { label: "Billing", value: billingPeriod === "monthly" ? "Monthly" : "Yearly" },
                  { label: "Currency", value: `${currency.symbol} ${currency.code}` },
                  ...(domainChoice !== "skip" ? [{ label: "Domain", value: existingDomain || "Existing domain" }] : []),
                  { label: "Subtotal", value: formatPrice(baseAmount) },
                  ...(promoResult ? [{ label: `Discount (${promoResult.discountPercent}%)`, value: `-${formatPrice(discount)}` }] : []),
                  { label: "Payment", value: paymentMethods.find(p => p.id === selectedPaymentMethod)?.name || "Pay Later" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-base border-t border-border/50 pt-3">
                  <span>Total Due</span>
                  <span className="text-primary text-lg">{formatPrice(finalAmount)}</span>
                </div>
              </div>

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
