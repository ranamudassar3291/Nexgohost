/**
 * /cart/domain/transfer — Domain Transfer Cart Page
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowRightLeft, Globe, Key, Search, Loader2, CheckCircle2, AlertCircle,
  Lock, Shield, Tag, X, CreditCard, Landmark, Smartphone, Bitcoin,
  Wallet, Check, ArrowRight, Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/context/CurrencyProvider";
import { useAuth } from "@/hooks/use-auth";

const BRAND = "#6B46C1";
const G = "linear-gradient(135deg,#6B46C1 0%,#8B5CF6 100%)";

interface TldRow { tld: string; registerPrice: number; transferPrice?: number; renewalPrice?: number; }
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

export default function CartDomainTransfer() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();

  const [step, setStep] = useState<"details" | "payment">("details");
  const [domainInput, setDomainInput] = useState("");
  const [eppCode, setEppCode] = useState("");
  const [showEpp, setShowEpp] = useState(false);
  const [tldPrice, setTldPrice] = useState<number | null>(null);
  const [tldLoading, setTldLoading] = useState(false);
  const [tlds, setTlds] = useState<TldRow[]>([]);

  // Payment
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

  useEffect(() => {
    fetch("/api/domain-search/tlds").then(r => r.json()).then(setTlds).catch(() => {});
    // Restore pre-login state saved to localStorage
    try {
      const saved = localStorage.getItem("cart_domain_transfer_state");
      if (saved) {
        const s = JSON.parse(saved);
        localStorage.removeItem("cart_domain_transfer_state");
        if (s.domain) setDomainInput(s.domain);
        if (s.eppCode) setEppCode(s.eppCode);
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

  const lookupPrice = () => {
    const domain = domainInput.trim().toLowerCase();
    if (!domain.includes(".")) { toast({ title: "Enter a valid domain (e.g. example.com)", variant: "destructive" }); return; }
    const tld = domain.slice(domain.indexOf("."));
    const row = tlds.find(t => t.tld === tld || t.tld === tld.replace(/^\./, "") || `.${t.tld}` === tld);
    if (row) {
      // Spec: show renewal-based pricing for transfers (includes 1-year renewal)
      setTldPrice(row.renewalPrice ?? (row as any).transferPrice ?? row.registerPrice ?? null);
    } else {
      setTldPrice(null);
    }
  };

  const applyPromo = async () => {
    if (!promoCode.trim() || tldPrice === null) return;
    setPromoLoading(true); setPromoError("");
    try {
      const res = await fetch(`/api/promo-codes/validate?code=${promoCode.trim()}&amount=${tldPrice}&serviceType=domain&billingCycle=yearly`);
      const d = await res.json();
      if (!res.ok || d.error) { setPromoError(d.error || "Invalid promo code"); return; }
      setPromoDiscount(d.discountAmount || Math.round(tldPrice * (d.discountPercent / 100)));
      setPromoApplied(true);
      toast({ title: "Promo applied!" });
    } catch { setPromoError("Could not validate code"); }
    finally { setPromoLoading(false); }
  };

  const saveCartState = () => {
    localStorage.setItem("cart_domain_transfer_state", JSON.stringify({
      domain: domainInput.trim(), eppCode: eppCode.trim(), promoCode,
    }));
  };

  const placeOrder = async () => {
    if (!user) {
      saveCartState();
      localStorage.setItem("postLoginRedirect", "/cart/domain/transfer");
      navigate("/client/login?redirect=/cart/domain/transfer");
      return;
    }
    if (!selectedPm && !applyCredits) { toast({ title: "Select a payment method", variant: "destructive" }); return; }
    setPlacing(true);
    try {
      const body: any = {
        domain: domainInput.trim().toLowerCase(),
        transferDomain: true,
        eppCode: eppCode.trim(),
        paymentMethodId: selectedPm || undefined,
        applyCredits,
        domainAmount: tldPrice ?? 0,
      };
      if (promoApplied) body.promoCode = promoCode;
      const d = await apiFetch("/api/checkout", { method: "POST", body: JSON.stringify(body) });
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
      toast({ title: "Transfer initiated!", description: "Check your email for transfer instructions." });
      navigate(d.invoiceId ? `/dashboard/invoices/${d.invoiceId}` : "/dashboard/invoices");
    } catch (err: any) {
      toast({ title: "Transfer failed", description: err.message, variant: "destructive" });
    } finally { setPlacing(false); }
  };

  const total = Math.max(0, (tldPrice ?? 0) - promoDiscount - (applyCredits ? Math.min(creditBalance, tldPrice ?? 0) : 0));
  const canContinue = domainInput.trim().includes(".") && eppCode.trim().length > 0;

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
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-0">
          {(["details","payment"] as const).map((s, i) => (
            <div key={s} className="flex items-center">
              <button onClick={() => { if (s === "details" || canContinue) setStep(s); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${step === s ? "text-white" : "text-gray-400"}`}
                style={{ background: step === s ? G : undefined }}>
                <span className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center font-bold ${step === s ? "bg-white/30 text-white" : "bg-gray-100 text-gray-500"}`}>{i+1}</span>
                {s === "details" ? "Transfer Details" : "Payment"}
              </button>
              {i < 1 && <span className="text-gray-200 mx-1">›</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 min-w-0">

            {step === "details" && (
              <div>
                <div className="text-center mb-8">
                  <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: G }}>
                    <ArrowRightLeft size={26} className="text-white"/>
                  </div>
                  <h1 className="text-2xl font-extrabold text-gray-900">Transfer Your Domain</h1>
                  <p className="text-gray-500 text-[14px] mt-1">Move your domain to Noehost for better management.</p>
                </div>

                {/* Info banner */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
                  <Info size={18} className="text-blue-500 shrink-0 mt-0.5"/>
                  <div className="text-[13px] text-blue-700">
                    <strong>Before you transfer:</strong> Unlock your domain at your current registrar, disable WHOIS privacy, and get the EPP/Auth code. The transfer adds 1 year to your registration.
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
                  {/* Domain name */}
                  <div>
                    <label className="block text-[13px] font-semibold text-gray-700 mb-2">Domain Name</label>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
                        <input
                          value={domainInput}
                          onChange={e => { setDomainInput(e.target.value); setTldPrice(null); }}
                          onBlur={lookupPrice}
                          placeholder="yourdomain.com"
                          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-[14px] outline-none focus:border-purple-400"
                        />
                      </div>
                      <button onClick={lookupPrice} className="px-4 py-3 rounded-xl border border-gray-200 text-[13px] text-gray-600 hover:bg-gray-50 flex items-center gap-1.5">
                        <Search size={14}/> Check Price
                      </button>
                    </div>
                    {tldPrice !== null && (
                      <div className="mt-2 flex items-center gap-2 text-[13px] font-semibold" style={{ color: BRAND }}>
                        <CheckCircle2 size={14}/> Transfer price: {formatPrice(tldPrice)} (includes 1 year renewal)
                      </div>
                    )}
                    {tldPrice === null && domainInput.includes(".") && (
                      <div className="mt-2 flex items-center gap-2 text-[13px] text-gray-400">
                        <AlertCircle size={14}/> Price will be shown after validation
                      </div>
                    )}
                  </div>

                  {/* EPP Code */}
                  <div>
                    <label className="block text-[13px] font-semibold text-gray-700 mb-2">
                      EPP / Auth Code
                      <span className="ml-1 text-gray-400 font-normal text-[12px]">(Get this from your current registrar)</span>
                    </label>
                    <div className="relative">
                      <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
                      <input
                        type={showEpp ? "text" : "password"}
                        value={eppCode}
                        onChange={e => setEppCode(e.target.value)}
                        placeholder="Enter EPP authorization code"
                        className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl text-[14px] outline-none focus:border-purple-400 font-mono"
                      />
                      <button onClick={() => setShowEpp(!showEpp)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showEpp ? <X size={15}/> : <Key size={15}/>}
                      </button>
                    </div>
                  </div>

                  {/* Checklist */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-[12px] font-semibold text-gray-500 mb-2">Transfer Requirements</div>
                    <div className="space-y-1.5">
                      {[
                        "Domain must be older than 60 days",
                        "Domain must be unlocked at current registrar",
                        "WHOIS privacy must be disabled temporarily",
                        "EPP/Auth code must be valid",
                      ].map(r => (
                        <div key={r} className="flex items-center gap-2 text-[12px] text-gray-600">
                          <Check size={12} className="text-green-500 shrink-0"/>{r}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={() => canContinue && setStep("payment")}
                    disabled={!canContinue}
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
                <p className="text-gray-500 mb-6 text-[14px]">Complete your domain transfer request.</p>

                {!user && (
                  <div className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                    <AlertCircle size={18} className="text-amber-500 mt-0.5 shrink-0"/>
                    <div>
                      <div className="font-semibold text-amber-800 text-[13px]">Sign in to complete your order</div>
                      <button onClick={() => { localStorage.setItem("postLoginRedirect", "/cart/domain/transfer"); navigate("/client/login?redirect=/cart/domain/transfer"); }}
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
                  <button onClick={() => setStep("details")} className="px-5 py-2.5 rounded-xl text-gray-600 font-semibold text-[14px] border border-gray-200 hover:bg-gray-50">← Back</button>
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
              <div className="font-bold text-gray-900 text-[15px] mb-4 flex items-center gap-2"><ArrowRightLeft size={16} style={{ color: BRAND }}/> Transfer Summary</div>
              {domainInput.trim() ? (
                <>
                  <div className="rounded-xl bg-purple-50 border border-purple-100 p-3 mb-4">
                    <div className="text-[11px] text-gray-500 font-semibold mb-1">Transferring</div>
                    <div className="font-bold text-gray-900 text-[16px] break-all">{domainInput.trim().toLowerCase()}</div>
                    {tldPrice !== null && (
                      <div className="font-extrabold text-[18px] mt-2" style={{ color: BRAND }}>{formatPrice(tldPrice)}</div>
                    )}
                  </div>
                  {tldPrice !== null && (
                    <div className="border-t border-gray-100 pt-3 space-y-1.5 text-[13px]">
                      <div className="flex justify-between text-gray-600"><span>Transfer Fee</span><span>{formatPrice(tldPrice)}</span></div>
                      {promoApplied && <div className="flex justify-between text-emerald-600"><span>Promo</span><span>-{formatPrice(promoDiscount)}</span></div>}
                      {applyCredits && <div className="flex justify-between text-purple-600"><span>Credits</span><span>-{formatPrice(Math.min(creditBalance, tldPrice))}</span></div>}
                      <div className="flex justify-between font-extrabold text-gray-900 text-[15px] pt-2 border-t border-gray-100"><span>Total</span><span style={{ color: BRAND }}>{formatPrice(total)}</span></div>
                    </div>
                  )}
                  <div className="mt-4 space-y-1.5">
                    {["Includes 1-year renewal","Full DNS control","Free SSL","24/7 Support"].map(f => (
                      <div key={f} className="flex items-center gap-2 text-[11px] text-gray-500"><Check size={11} className="text-green-500 shrink-0"/>{f}</div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-6 text-gray-400 text-[13px]"><ArrowRightLeft size={28} className="mx-auto mb-2 text-gray-200"/><p>Enter domain details to continue</p></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
