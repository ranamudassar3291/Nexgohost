/**
 * /cart/domain/register — Domain Registration Cart Page
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  Globe, Search, Loader2, CheckCircle2, AlertCircle, X, Tag, Gift,
  Lock, Shield, ArrowRight, CreditCard, Landmark, Smartphone,
  Bitcoin, Wallet, Check, Zap, RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/context/CurrencyProvider";
import { useAuth } from "@/hooks/use-auth";

const BRAND = "#6B46C1";
const G = "linear-gradient(135deg,#6B46C1 0%,#8B5CF6 100%)";

interface TldRow {
  tld: string; registerPrice: number; renewPrice: number; register2YearPrice?: number | null;
  register3YearPrice?: number | null; isFreeWithHosting: boolean; sortOrder?: number;
}
interface DomainResult {
  domain: string; sld: string; tld: string; available: boolean; price: string; registerPrice: string;
}
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

function PaymentIcon({ type }: { type: string }) {
  if (type === "stripe" || type === "card") return <CreditCard size={16} className="text-blue-500"/>;
  if (type === "bank_transfer" || type === "bank") return <Landmark size={16} className="text-gray-500"/>;
  if (type === "mobile_wallet" || type === "easypaisa" || type === "jazzcash") return <Smartphone size={16} className="text-green-500"/>;
  if (type === "crypto") return <Bitcoin size={16} className="text-amber-500"/>;
  return <CreditCard size={16} className="text-gray-400"/>;
}

export default function CartDomainRegister() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();

  const [step, setStep] = useState<"search" | "payment">("search");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<DomainResult[]>([]);
  const [tlds, setTlds] = useState<TldRow[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<DomainResult | null>(null);
  const [years, setYears] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    inputRef.current?.focus();
    // Restore pre-login state saved to localStorage
    try {
      const saved = localStorage.getItem("cart_domain_register_state");
      if (saved) {
        const s = JSON.parse(saved);
        localStorage.removeItem("cart_domain_register_state");
        if (s.years) setYears(Number(s.years));
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

  const search = useCallback(async () => {
    const q = query.trim();
    if (!q || q.length < 2) return;
    setSearching(true); setHasSearched(true);
    try {
      const res = await fetch(`/api/domain/search?q=${encodeURIComponent(q)}`);
      const data: DomainResult[] = await res.json();
      setResults(data);
      const avail = data.find(d => d.available);
      if (avail) setSelectedDomain(avail);
    } catch { toast({ title: "Search failed", variant: "destructive" }); }
    finally { setSearching(false); }
  }, [query, toast]);

  const getDomainPrice = (d: DomainResult) => {
    const tldRow = tlds.find(t => t.tld === d.tld);
    if (!tldRow) return Number(d.price || 0);
    if (years === 2 && tldRow.register2YearPrice) return tldRow.register2YearPrice;
    if (years === 3 && tldRow.register3YearPrice) return tldRow.register3YearPrice;
    return tldRow.registerPrice;
  };

  const applyPromo = async () => {
    if (!promoCode.trim() || !selectedDomain) return;
    setPromoLoading(true); setPromoError("");
    try {
      const amount = getDomainPrice(selectedDomain);
      const res = await fetch(`/api/promo-codes/validate?code=${promoCode.trim()}&amount=${amount}&serviceType=domain&billingCycle=yearly`);
      const d = await res.json();
      if (!res.ok || d.error) { setPromoError(d.error || "Invalid promo code"); return; }
      setPromoDiscount(d.discountAmount || Math.round(amount * (d.discountPercent / 100)));
      setPromoApplied(true);
      toast({ title: "Promo applied!", description: `${d.discountPercent}% discount applied.` });
    } catch { setPromoError("Could not validate code"); }
    finally { setPromoLoading(false); }
  };

  const saveCartState = () => {
    localStorage.setItem("cart_domain_register_state", JSON.stringify({
      domain: selectedDomain?.domain, years, promoCode,
    }));
  };

  const placeOrder = async () => {
    if (!user) {
      saveCartState();
      localStorage.setItem("postLoginRedirect", "/cart/domain/register");
      navigate("/client/login?redirect=/cart/domain/register");
      return;
    }
    if (!selectedPm && !applyCredits) { toast({ title: "Select a payment method", variant: "destructive" }); return; }
    setPlacing(true);
    try {
      const body: any = {
        domain: selectedDomain!.domain,
        registerDomain: true,
        paymentMethodId: selectedPm || undefined,
        applyCredits,
        domainAmount: getDomainPrice(selectedDomain!),
        registrationYears: years,
      };
      if (promoApplied) body.promoCode = promoCode;
      const d = await apiFetch("/api/checkout", { method: "POST", body: JSON.stringify(body) });
      // Payment routing: gateway redirect (SafePay) vs manual invoice
      const pm = paymentMethods.find(p => p.id === selectedPm);
      if (pm?.type === "safepay" && d.invoiceId) {
        try {
          const sp = await apiFetch("/api/payments/safepay/initiate", { method: "POST", body: JSON.stringify({ invoiceId: d.invoiceId }) });
          if (sp.checkoutUrl) { window.location.href = sp.checkoutUrl; return; }
        } catch {}
      }
      toast({ title: "Order placed!", description: "Domain registration initiated." });
      navigate(d.invoiceId ? `/dashboard/invoices/${d.invoiceId}` : "/dashboard/invoices");
    } catch (err: any) {
      toast({ title: "Order failed", description: err.message, variant: "destructive" });
    } finally { setPlacing(false); }
  };

  const domainPrice = selectedDomain ? getDomainPrice(selectedDomain) : 0;
  const total = Math.max(0, domainPrice - promoDiscount - (applyCredits ? Math.min(creditBalance, domainPrice) : 0));

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
          {(["search","payment"] as const).map((s, i) => (
            <div key={s} className="flex items-center">
              <button onClick={() => { if (s === "search" || selectedDomain) setStep(s); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${step === s ? "text-white" : "text-gray-400 hover:text-gray-700"}`}
                style={{ background: step === s ? G : undefined }}>
                <span className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center font-bold ${step === s ? "bg-white/30 text-white" : "bg-gray-100 text-gray-500"}`}>{i+1}</span>
                {s === "search" ? "Search Domain" : "Payment"}
              </button>
              {i < 1 && <span className="text-gray-200 mx-1">›</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 min-w-0">

            {step === "search" && (
              <div>
                <div className="text-center mb-8">
                  <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: G }}>
                    <Globe size={26} className="text-white"/>
                  </div>
                  <h1 className="text-2xl font-extrabold text-gray-900">Find Your Perfect Domain</h1>
                  <p className="text-gray-500 text-[14px] mt-1">Search availability across .com, .net, .pk and 50+ TLDs</p>
                </div>

                {/* Search bar */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
                      <input
                        ref={inputRef}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && search()}
                        placeholder="Search for your domain name…"
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-[15px] outline-none focus:border-purple-400 transition-colors"
                      />
                    </div>
                    <button
                      onClick={search}
                      disabled={searching || !query.trim()}
                      className="px-6 py-3 rounded-xl text-white font-bold text-[14px] flex items-center gap-2 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
                      style={{ background: G }}>
                      {searching ? <Loader2 size={16} className="animate-spin"/> : <Search size={16}/>}
                      {searching ? "Searching…" : "Search"}
                    </button>
                  </div>
                </div>

                {/* TLD pricing chips */}
                {tlds.length > 0 && !hasSearched && (
                  <div className="mb-6">
                    <div className="text-[13px] font-semibold text-gray-500 mb-3">Popular Extensions</div>
                    <div className="flex flex-wrap gap-2">
                      {tlds.slice(0, 12).map(t => (
                        <button key={t.tld} onClick={() => { setQuery(query.split(".")[0] || "example" + t.tld); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full border border-gray-200 text-[12px] font-semibold text-gray-700 hover:border-purple-300 hover:text-purple-700 transition-colors">
                          <span className="text-purple-500">{t.tld}</span>
                          <span className="text-gray-400 font-normal">{formatPrice(t.registerPrice)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search results */}
                {hasSearched && (
                  <div className="space-y-2">
                    {searching ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse h-16"/>
                      ))
                    ) : results.length === 0 ? (
                      <div className="text-center py-10 text-gray-400">
                        <AlertCircle size={32} className="mx-auto mb-2 text-gray-200"/>
                        <p>No results. Try a different name.</p>
                      </div>
                    ) : results.map(r => {
                      const price = getDomainPrice(r);
                      const sel = selectedDomain?.domain === r.domain;
                      return (
                        <button
                          key={r.domain}
                          onClick={() => r.available && setSelectedDomain(r)}
                          disabled={!r.available}
                          className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${
                            sel ? "" : r.available ? "hover:border-purple-200" : "opacity-60 cursor-not-allowed"
                          }`}
                          style={{ borderColor: sel ? BRAND : "#E5E7EB", background: sel ? "#FAF5FF" : "#fff" }}>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${r.available ? "" : "opacity-50"}`}
                              style={{ background: r.available ? (sel ? G : "#EDE9FE") : "#F3F4F6" }}>
                              <Globe size={16} color={r.available ? (sel ? "#fff" : BRAND) : "#9CA3AF"}/>
                            </div>
                            <div>
                              <span className="font-bold text-gray-900 text-[15px]">{r.domain}</span>
                              {!r.available && <span className="ml-2 text-[11px] text-red-500 font-semibold">Taken</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {r.available ? (
                              <>
                                <div className="text-right">
                                  <div className="font-extrabold text-[15px]" style={{ color: BRAND }}>{formatPrice(price)}</div>
                                  <div className="text-[10px] text-gray-400">/year</div>
                                </div>
                                {sel ? (
                                  <CheckCircle2 size={20} style={{ color: BRAND }}/>
                                ) : (
                                  <div className="px-3 py-1 rounded-full text-[12px] font-bold text-purple-700 bg-purple-50 border border-purple-200">Add</div>
                                )}
                              </>
                            ) : (
                              <span className="text-[12px] text-gray-400">Not available</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Registration period */}
                {selectedDomain && (
                  <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-5">
                    <div className="font-semibold text-gray-800 text-[14px] mb-3">Registration Period</div>
                    <div className="flex flex-wrap gap-2">
                      {[1,2,3,4,5].map(y => {
                        const tldRow = tlds.find(t => t.tld === selectedDomain.tld);
                        const hasPrice = y === 1 || (y === 2 && tldRow?.register2YearPrice) || (y === 3 && tldRow?.register3YearPrice);
                        const p = y === 1 ? tldRow?.registerPrice : y === 2 ? tldRow?.register2YearPrice : y === 3 ? tldRow?.register3YearPrice : y === 4 ? (tldRow?.register3YearPrice ? Number(tldRow.register3YearPrice) / 3 * 4 : null) : (tldRow?.register3YearPrice ? Number(tldRow.register3YearPrice) / 3 * 5 : null);
                        if (!hasPrice && y > 3) return null;
                        return (
                          <button key={y} onClick={() => setYears(y)}
                            className="flex-1 min-w-[72px] p-3 rounded-xl border-2 text-center transition-all"
                            style={{ borderColor: years === y ? BRAND : "#E5E7EB", background: years === y ? "#FAF5FF" : "#fff" }}>
                            <div className="font-bold text-[14px]" style={{ color: years === y ? BRAND : "#374151" }}>{y} Yr{y > 1 ? "s" : ""}</div>
                            <div className="text-[11px] text-gray-500">{p ? formatPrice(Number(p)) : "—"}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={() => selectedDomain && setStep("payment")}
                    disabled={!selectedDomain}
                    className="px-8 py-3 rounded-xl text-white font-bold text-[15px] flex items-center gap-2 disabled:opacity-40 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    style={{ background: G }}>
                    Continue to Payment <ArrowRight size={18}/>
                  </button>
                </div>
              </div>
            )}

            {step === "payment" && (
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Payment</h1>
                <p className="text-gray-500 mb-6 text-[14px]">Complete your domain registration.</p>

                {!user && (
                  <div className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                    <AlertCircle size={18} className="text-amber-500 mt-0.5 shrink-0"/>
                    <div>
                      <div className="font-semibold text-amber-800 text-[13px]">Sign in to complete your order</div>
                      <button onClick={() => { localStorage.setItem("postLoginRedirect", "/cart/domain/register"); navigate("/client/login?redirect=/cart/domain/register"); }}
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
                  <button onClick={() => setStep("search")} className="px-5 py-2.5 rounded-xl text-gray-600 font-semibold text-[14px] border border-gray-200 hover:bg-gray-50">← Back</button>
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
              <div className="font-bold text-gray-900 text-[15px] mb-4 flex items-center gap-2"><Globe size={16} style={{ color: BRAND }}/> Order Summary</div>
              {selectedDomain ? (
                <>
                  <div className="rounded-xl bg-purple-50 border border-purple-100 p-3 mb-4">
                    <div className="text-[11px] text-gray-500 font-semibold mb-1">Domain Registration</div>
                    <div className="font-bold text-gray-900 text-[16px]">{selectedDomain.domain}</div>
                    <div className="text-[12px] text-gray-500 mt-0.5">{years} Year{years > 1 ? "s" : ""} · {selectedDomain.tld}</div>
                    <div className="font-extrabold text-[18px] mt-2" style={{ color: BRAND }}>{formatPrice(domainPrice)}</div>
                  </div>
                  <div className="border-t border-gray-100 pt-3 space-y-1.5 text-[13px]">
                    <div className="flex justify-between text-gray-600"><span>Domain</span><span>{formatPrice(domainPrice)}</span></div>
                    {promoApplied && <div className="flex justify-between text-emerald-600"><span>Promo</span><span>-{formatPrice(promoDiscount)}</span></div>}
                    {applyCredits && <div className="flex justify-between text-purple-600"><span>Credits</span><span>-{formatPrice(Math.min(creditBalance, domainPrice))}</span></div>}
                    <div className="flex justify-between font-extrabold text-gray-900 text-[15px] pt-2 border-t border-gray-100"><span>Total</span><span style={{ color: BRAND }}>{formatPrice(total)}</span></div>
                  </div>
                  <div className="mt-4 space-y-1.5">
                    {["ICANN Accredited","Privacy Protection","Auto-Renew Available","DNS Management"].map(f => (
                      <div key={f} className="flex items-center gap-2 text-[11px] text-gray-500"><Check size={11} className="text-green-500 shrink-0"/>{f}</div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-6 text-gray-400 text-[13px]"><Globe size={28} className="mx-auto mb-2 text-gray-200"/><p>Search for a domain to continue</p></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
