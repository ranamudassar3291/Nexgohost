/**
 * /cart/email — Business Email Hosting Cart Page
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Mail, Globe, Check, Shield, Lock, Tag, X, Wallet, ArrowRight,
  CreditCard, Landmark, Smartphone, Bitcoin, Loader2, AlertCircle,
  CheckCircle2, Users, HardDrive, Zap, Inbox, Star,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/context/CurrencyProvider";
import { useAuth } from "@/hooks/use-auth";

const BRAND = "#6B46C1";
const G = "linear-gradient(135deg,#6B46C1 0%,#8B5CF6 100%)";

type Cycle = "monthly" | "quarterly" | "semiannual" | "yearly";
const CYCLE_LABELS: Record<Cycle, string> = { monthly: "Monthly", quarterly: "3 Months", semiannual: "6 Months", yearly: "Yearly" };
const CYCLE_MONTHS: Record<Cycle, number> = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 };

// Static email plans (since backend may not have separate email plan endpoint)
const DEFAULT_EMAIL_PLANS = [
  {
    id: "email-starter", name: "Starter Email", price: 199, yearlyPrice: 1999, quarterlyPrice: 549, semiannualPrice: 999,
    mailboxes: 5, storageGb: 5, aliases: 5, features: ["Webmail Access","Spam Filter","IMAP/POP3/SMTP","Mobile Sync"],
    description: "Perfect for individuals & small teams",
  },
  {
    id: "email-business", name: "Business Email", price: 499, yearlyPrice: 4999, quarterlyPrice: 1399, semiannualPrice: 2499,
    mailboxes: 20, storageGb: 25, aliases: 50, features: ["All Starter Features","Calendar & Contacts","Shared Mailboxes","Priority Support","Anti-Spam Pro"],
    description: "For growing businesses", isPopular: true,
  },
  {
    id: "email-enterprise", name: "Enterprise Email", price: 999, yearlyPrice: 9999, quarterlyPrice: 2799, semiannualPrice: 4999,
    mailboxes: 100, storageGb: 100, aliases: 500, features: ["All Business Features","Dedicated IP","Advanced Security","SLA 99.99%","Custom Retention"],
    description: "Unlimited scale for enterprises",
  },
];

interface EmailPlan {
  id: string; name: string; price: number; yearlyPrice: number; quarterlyPrice: number; semiannualPrice: number;
  mailboxes: number; storageGb: number; aliases: number; features: string[]; description: string; isPopular?: boolean;
}

interface PaymentMethod {
  id: string; name: string; type: string; description: string | null; isSandbox: boolean;
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
function PaymentIcon({ type }: { type: string }) {
  if (type === "stripe" || type === "card") return <CreditCard size={16} className="text-blue-500"/>;
  if (type === "bank_transfer" || type === "bank") return <Landmark size={16} className="text-gray-500"/>;
  if (type === "mobile_wallet" || type === "easypaisa" || type === "jazzcash") return <Smartphone size={16} className="text-green-500"/>;
  if (type === "crypto") return <Bitcoin size={16} className="text-amber-500"/>;
  return <CreditCard size={16} className="text-gray-400"/>;
}

function planPrice(p: EmailPlan, cycle: Cycle): number {
  if (cycle === "quarterly") return p.quarterlyPrice;
  if (cycle === "semiannual") return p.semiannualPrice;
  if (cycle === "yearly") return p.yearlyPrice;
  return p.price;
}

export default function CartEmail() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();

  const [step, setStep] = useState<"plan" | "domain" | "payment">("plan");
  const [plans] = useState<EmailPlan[]>(DEFAULT_EMAIL_PLANS);
  const [selectedPlan, setSelectedPlan] = useState<EmailPlan | null>(DEFAULT_EMAIL_PLANS[1]);
  const [cycle, setCycle] = useState<Cycle>("yearly");
  const [mailboxQty, setMailboxQty] = useState(1);
  const [domainName, setDomainName] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [pmLoading, setPmLoading] = useState(false);
  const [selectedPm, setSelectedPm] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [applyCredits, setApplyCredits] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);
  const [placing, setPlacing] = useState(false);

  // Restore pre-login cart state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cart_email_state");
      if (saved) {
        const s = JSON.parse(saved);
        localStorage.removeItem("cart_email_state");
        if (s.planId) {
          const plan = DEFAULT_EMAIL_PLANS.find(p => String(p.id) === String(s.planId));
          if (plan) setSelectedPlan(plan);
        }
        if (s.cycle) setCycle(s.cycle);
        if (s.mailboxQty) setMailboxQty(Number(s.mailboxQty));
        if (s.domainName) setDomainName(s.domainName);
        if (s.promoCode) setPromoCode(s.promoCode);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (step === "payment") {
      setPmLoading(true);
      apiFetch("/api/payment-methods").then(setPaymentMethods).catch(() => []).finally(() => setPmLoading(false));
      if (user) apiFetch("/api/my/credits").then(d => setCreditBalance(Number(d.balance || 0))).catch(() => {});
    }
  }, [step, user]);

  const applyPromo = async () => {
    if (!promoCode.trim() || !selectedPlan) return;
    setPromoLoading(true); setPromoError("");
    try {
      const amount = planPrice(selectedPlan, cycle);
      const res = await fetch(`/api/promo-codes/validate?code=${promoCode.trim()}&amount=${amount}&serviceType=hosting&billingCycle=${cycle}`);
      const d = await res.json();
      if (!res.ok || d.error) { setPromoError(d.error || "Invalid promo code"); return; }
      setPromoDiscount(d.discountAmount || Math.round(amount * (d.discountPercent / 100)));
      setPromoApplied(true);
      toast({ title: "Promo applied!" });
    } catch { setPromoError("Could not validate code"); }
    finally { setPromoLoading(false); }
  };

  const saveCartState = () => {
    localStorage.setItem("cart_email_state", JSON.stringify({
      planId: selectedPlan?.id, cycle, mailboxQty, domainName, promoCode,
    }));
  };

  const placeOrder = async () => {
    if (!user) {
      saveCartState();
      localStorage.setItem("postLoginRedirect", "/cart/email");
      navigate("/client/login?redirect=/cart/email");
      return;
    }
    if (!selectedPm && !applyCredits) { toast({ title: "Select a payment method", variant: "destructive" }); return; }
    setPlacing(true);
    try {
      const body: any = {
        packageId: selectedPlan!.id,
        billingCycle: CYCLE_MONTHS[cycle],
        billingCycleLabel: cycle,
        domain: domainName,
        mailboxQuantity: mailboxQty,
        paymentMethodId: selectedPm || undefined,
        applyCredits,
        notes: `Business Email: ${selectedPlan!.name} · ${mailboxQty} mailbox${mailboxQty > 1 ? "es" : ""} · ${domainName}`,
      };
      if (promoApplied) body.promoCode = promoCode;
      const d = await apiFetch("/api/checkout", { method: "POST", body: JSON.stringify(body) }).catch(async () => {
        // Fallback: create a manual order via support ticket if no email plan in system
        await apiFetch("/api/tickets", { method: "POST", body: JSON.stringify({
          subject: `Business Email Order — ${selectedPlan!.name}`,
          message: `Plan: ${selectedPlan!.name}\nMailboxes: ${mailboxQty}\nDomain: ${domainName}\nBilling: ${CYCLE_LABELS[cycle]}\nAmount: ${formatPrice(planPrice(selectedPlan!, cycle))}`,
          department: "Sales",
          priority: "high",
        })});
        return { invoiceId: null };
      });
      // Generic payment gateway routing: SafePay, RapidGateway, then manual invoice
      const pm = paymentMethods.find(p => p.id === selectedPm);
      if (d.invoiceId && pm) {
        if (pm.type === "safepay") {
          try {
            const sp = await apiFetch("/api/payments/safepay/initiate", { method: "POST", body: JSON.stringify({ invoiceId: d.invoiceId }) });
            if (sp.checkoutUrl) { window.location.href = sp.checkoutUrl; return; }
          } catch {}
        } else if (pm.type === "rapidgateway") {
          try {
            const rg = await apiFetch("/api/payments/rapidgateway/initiate", { method: "POST", body: JSON.stringify({ invoiceId: d.invoiceId }) });
            if (rg.checkoutUrl) { window.location.href = rg.checkoutUrl; return; }
          } catch {}
        }
      }
      toast({ title: "Email order placed!", description: "We'll set up your business email within 24 hours." });
      if (d.invoiceId) navigate(`/dashboard/invoices/${d.invoiceId}`);
      else navigate("/dashboard");
    } catch (err: any) {
      toast({ title: "Order failed", description: err.message, variant: "destructive" });
    } finally { setPlacing(false); }
  };

  const price = selectedPlan ? planPrice(selectedPlan, cycle) : 0;
  const total = Math.max(0, price - promoDiscount - (applyCredits ? Math.min(creditBalance, price) : 0));

  return (
    <div className="min-h-screen bg-[#F8F9FB]" style={{ fontFamily: "'Inter','Plus Jakarta Sans',sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href={user ? "/dashboard" : "/"} className="flex items-center gap-2 no-underline">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-white text-[15px]" style={{ background: G }}>N</div>
            <span className="text-[17px] font-extrabold text-gray-900">Noehost</span>
          </a>
          <div className="flex items-center gap-4 text-[12px] text-gray-500">
            <span className="hidden sm:flex items-center gap-1"><Shield size={13} className="text-green-500"/> SSL Secured</span>
            <span className="flex items-center gap-1"><Lock size={12} style={{ color: BRAND }}/> Secure Checkout</span>
          </div>
        </div>
      </header>

      {/* Step bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center">
          {(["plan","domain","payment"] as const).map((s, i) => (
            <div key={s} className="flex items-center">
              <button onClick={() => { if (s === "plan" || (s === "domain" && selectedPlan) || (s === "payment" && selectedPlan && domainName)) setStep(s); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${step === s ? "text-white" : "text-gray-400"}`}
                style={{ background: step === s ? G : undefined }}>
                <span className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center font-bold ${step === s ? "bg-white/30 text-white" : "bg-gray-100 text-gray-500"}`}>{i+1}</span>
                {s === "plan" ? "Choose Plan" : s === "domain" ? "Your Domain" : "Payment"}
              </button>
              {i < 2 && <span className="text-gray-200 mx-1">›</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 min-w-0">

            {step === "plan" && (
              <div>
                <div className="text-center mb-8">
                  <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: G }}>
                    <Mail size={26} className="text-white"/>
                  </div>
                  <h1 className="text-2xl font-extrabold text-gray-900">Business Email Hosting</h1>
                  <p className="text-gray-500 text-[14px] mt-1">Professional email @yourdomain.com with spam protection & mobile sync</p>
                </div>

                {/* Cycle selector */}
                <div className="flex items-center gap-2 mb-6 flex-wrap justify-center">
                  {(["monthly","quarterly","semiannual","yearly"] as Cycle[]).map(c => (
                    <button key={c} onClick={() => setCycle(c)}
                      className="px-4 py-1.5 rounded-full text-[13px] font-semibold border-2 transition-all"
                      style={{ borderColor: cycle === c ? BRAND : "#E5E7EB", background: cycle === c ? BRAND : "#fff", color: cycle === c ? "#fff" : "#6B7280" }}>
                      {CYCLE_LABELS[c]}
                      {c === "yearly" && <span className="ml-1 text-[10px] bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded-full font-bold">SAVE</span>}
                    </button>
                  ))}
                </div>

                {/* Plan cards */}
                <div className="grid gap-5 sm:grid-cols-3">
                  {plans.map(plan => {
                    const p = planPrice(plan, cycle);
                    const sel = selectedPlan?.id === plan.id;
                    return (
                      <button key={plan.id} onClick={() => setSelectedPlan(plan)}
                        className="w-full text-left rounded-2xl border-2 p-5 transition-all relative"
                        style={{ borderColor: sel ? BRAND : plan.isPopular ? "#E9D5FF" : "#E5E7EB", background: sel ? "#FAF5FF" : "#fff", boxShadow: sel ? `0 0 0 4px #EDE9FE` : undefined }}>
                        {plan.isPopular && <span className="absolute -top-3 left-5 px-3 py-0.5 rounded-full text-[11px] font-bold text-white" style={{ background: G }}>⭐ Most Popular</span>}
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: sel ? G : "#F3F4F6" }}>
                          <Mail size={18} color={sel ? "#fff" : "#9CA3AF"}/>
                        </div>
                        <div className="font-bold text-gray-900 text-[15px]">{plan.name}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5 mb-2">{plan.description}</div>
                        <div className="font-extrabold text-[20px]" style={{ color: BRAND }}>{formatPrice(p)}</div>
                        <div className="text-[11px] text-gray-400 mb-3">{CYCLE_LABELS[cycle].toLowerCase()}</div>
                        <div className="space-y-1.5 text-[12px] text-gray-600">
                          <div className="flex items-center gap-1.5"><Users size={11} className="text-blue-400"/>{plan.mailboxes} Mailboxes</div>
                          <div className="flex items-center gap-1.5"><HardDrive size={11} className="text-orange-400"/>{plan.storageGb} GB Storage</div>
                          <div className="flex items-center gap-1.5"><Inbox size={11} className="text-purple-400"/>{plan.aliases} Aliases</div>
                        </div>
                        <div className="mt-3 space-y-1">
                          {plan.features.map((f, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-[11px] text-gray-500"><Check size={9} className="text-green-500 shrink-0"/>{f}</div>
                          ))}
                        </div>
                        {sel && (
                          <div className="mt-3 flex items-center gap-1.5 text-[12px] font-bold" style={{ color: BRAND }}>
                            <CheckCircle2 size={14}/> Selected
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-8 flex justify-end">
                  <button onClick={() => selectedPlan && setStep("domain")} disabled={!selectedPlan}
                    className="px-8 py-3 rounded-xl text-white font-bold text-[15px] flex items-center gap-2 disabled:opacity-40 hover:scale-[1.02] transition-all"
                    style={{ background: G }}>
                    Continue <ArrowRight size={18}/>
                  </button>
                </div>
              </div>
            )}

            {step === "domain" && (
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Your Business Domain</h1>
                <p className="text-gray-500 mb-6 text-[14px]">Enter the domain where you want email hosted (e.g. mycompany.com)</p>

                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
                  <div>
                    <label className="block text-[13px] font-semibold text-gray-700 mb-2">Domain Name</label>
                    <div className="relative">
                      <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
                      <input value={domainName} onChange={e => setDomainName(e.target.value.toLowerCase().trim())}
                        placeholder="mycompany.com"
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-[15px] outline-none focus:border-purple-400"/>
                    </div>
                    <p className="mt-2 text-[12px] text-gray-400">
                      You need to own this domain and have access to its DNS settings. We'll provide the MX records to configure after purchase.
                    </p>
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-gray-700 mb-2">Number of Mailboxes</label>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setMailboxQty(q => Math.max(1, q - 1))}
                        className="w-9 h-9 rounded-xl border border-gray-200 text-[18px] font-bold text-gray-600 flex items-center justify-center hover:bg-gray-50">−</button>
                      <input type="number" min={1} max={selectedPlan?.mailboxes ?? 100} value={mailboxQty}
                        onChange={e => setMailboxQty(Math.max(1, Math.min(selectedPlan?.mailboxes ?? 100, Number(e.target.value))))}
                        className="w-20 text-center border border-gray-200 rounded-xl py-2 text-[15px] font-bold outline-none focus:border-purple-400"/>
                      <button onClick={() => setMailboxQty(q => Math.min(selectedPlan?.mailboxes ?? 100, q + 1))}
                        className="w-9 h-9 rounded-xl border border-gray-200 text-[18px] font-bold text-gray-600 flex items-center justify-center hover:bg-gray-50">+</button>
                      <span className="text-[12px] text-gray-400">Max {selectedPlan?.mailboxes} on {selectedPlan?.name} plan</span>
                    </div>
                  </div>
                </div>

                {/* What you get */}
                <div className="mt-5 bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl border border-purple-100 p-5">
                  <div className="font-semibold text-gray-800 text-[14px] mb-3 flex items-center gap-2"><Zap size={15} className="text-amber-500"/> What You Get</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      "Professional @yourdomain.com email",
                      "Webmail access from any device",
                      "Mobile sync (iOS/Android/Outlook)",
                      "Anti-spam & virus protection",
                      "IMAP / POP3 / SMTP support",
                      "Shared calendar & contacts",
                    ].map(f => (
                      <div key={f} className="flex items-start gap-1.5 text-[12px] text-gray-600"><Check size={11} className="text-green-500 shrink-0 mt-0.5"/>{f}</div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-between">
                  <button onClick={() => setStep("plan")} className="px-5 py-2.5 rounded-xl text-gray-600 font-semibold text-[14px] border border-gray-200 hover:bg-gray-50">← Back</button>
                  <button onClick={() => domainName && setStep("payment")} disabled={!domainName.includes(".")}
                    className="px-8 py-3 rounded-xl text-white font-bold text-[15px] flex items-center gap-2 disabled:opacity-40 hover:scale-[1.02] transition-all"
                    style={{ background: G }}>
                    Continue to Payment <ArrowRight size={18}/>
                  </button>
                </div>
              </div>
            )}

            {step === "payment" && (
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Payment</h1>
                <p className="text-gray-500 mb-6 text-[14px]">Complete your business email order.</p>

                {!user && (
                  <div className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                    <AlertCircle size={18} className="text-amber-500 mt-0.5 shrink-0"/>
                    <div>
                      <div className="font-semibold text-amber-800 text-[13px]">Sign in to complete your order</div>
                      <button onClick={() => { localStorage.setItem("postLoginRedirect", "/cart/email"); navigate("/client/login?redirect=/cart/email"); }}
                        className="mt-1.5 text-[12px] font-bold text-white px-4 py-1.5 rounded-lg" style={{ background: G }}>
                        Sign In / Register
                      </button>
                    </div>
                  </div>
                )}

                {/* Promo */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
                  <div className="font-semibold text-gray-800 text-[14px] mb-3 flex items-center gap-2"><Tag size={15} style={{ color: BRAND }}/> Promo Code</div>
                  {promoApplied ? (
                    <div className="flex items-center gap-2 text-emerald-600 font-semibold text-[13px]">
                      <CheckCircle2 size={16}/> {promoCode.toUpperCase()} — {formatPrice(promoDiscount)} off
                      <button onClick={() => { setPromoApplied(false); setPromoDiscount(0); setPromoCode(""); }} className="ml-auto text-gray-400"><X size={14}/></button>
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

                {/* Credits */}
                {user && creditBalance > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={applyCredits} onChange={e => setApplyCredits(e.target.checked)} className="w-4 h-4 accent-purple-600"/>
                      <div>
                        <div className="font-semibold text-gray-800 text-[13px] flex items-center gap-1.5"><Wallet size={14} className="text-purple-500"/> Apply Credits</div>
                        <div className="text-[12px] text-gray-400">Balance: {formatPrice(creditBalance)}</div>
                      </div>
                    </label>
                  </div>
                )}

                {/* Payment methods */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
                  <div className="font-semibold text-gray-800 text-[14px] mb-3">Payment Method</div>
                  {pmLoading ? <div className="flex items-center gap-2 text-gray-400 text-[13px]"><Loader2 size={14} className="animate-spin"/> Loading…</div>
                    : paymentMethods.length === 0 ? <p className="text-gray-400 text-[13px]">No payment methods available.</p>
                    : (
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
                  <button onClick={placeOrder} disabled={placing || (!selectedPm && !applyCredits)}
                    className="px-8 py-3 rounded-xl text-white font-bold text-[16px] flex items-center gap-2 disabled:opacity-40 hover:scale-[1.02] transition-all"
                    style={{ background: G }}>
                    {placing ? <Loader2 size={18} className="animate-spin"/> : <Lock size={18}/>}
                    {placing ? "Processing…" : `Pay ${formatPrice(total)}`}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-80 shrink-0">
            <div className="sticky top-20 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="font-bold text-gray-900 text-[15px] mb-4 flex items-center gap-2"><Mail size={16} style={{ color: BRAND }}/> Order Summary</div>
              {selectedPlan ? (
                <>
                  <div className="rounded-xl bg-purple-50 border border-purple-100 p-3 mb-4">
                    <div className="font-bold text-gray-900 text-[14px]">{selectedPlan.name}</div>
                    <div className="text-[12px] text-gray-500 mt-0.5">{CYCLE_LABELS[cycle]} · {mailboxQty} mailbox{mailboxQty > 1 ? "es" : ""}</div>
                    {domainName && <div className="text-[12px] text-gray-500 mt-0.5">📧 @{domainName}</div>}
                    <div className="font-extrabold text-[17px] mt-2" style={{ color: BRAND }}>{formatPrice(price)}</div>
                  </div>
                  <div className="border-t border-gray-100 pt-3 space-y-1.5 text-[13px]">
                    <div className="flex justify-between text-gray-600"><span>Email Plan</span><span>{formatPrice(price)}</span></div>
                    {promoApplied && <div className="flex justify-between text-emerald-600"><span>Promo</span><span>-{formatPrice(promoDiscount)}</span></div>}
                    {applyCredits && <div className="flex justify-between text-purple-600"><span>Credits</span><span>-{formatPrice(Math.min(creditBalance, price))}</span></div>}
                    <div className="flex justify-between font-extrabold text-gray-900 text-[15px] pt-2 border-t border-gray-100"><span>Total</span><span style={{ color: BRAND }}>{formatPrice(total)}</span></div>
                  </div>
                  <div className="mt-4 space-y-1.5">
                    {["Professional Email","Spam Protection","Mobile Sync","24/7 Support"].map(f => (
                      <div key={f} className="flex items-center gap-2 text-[11px] text-gray-500"><Check size={11} className="text-green-500 shrink-0"/>{f}</div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-6 text-gray-400 text-[13px]"><Mail size={28} className="mx-auto mb-2 text-gray-200"/><p>Select a plan to continue</p></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
