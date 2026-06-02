import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Globe, ArrowRightLeft, ShieldCheck, ChevronRight, Loader2, Check, AlertCircle, KeyRound, Wallet, CreditCard, ArrowLeft, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useCurrency } from "@/context/CurrencyProvider";

const BRAND = "linear-gradient(135deg, #6B46C1 0%, #7C5DE2 60%, #8B5CF6 100%)";

function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token") || localStorage.getItem("noehost_token") || "";
  return fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((opts as any)?.headers),
    },
    ...opts,
  }).then(async r => {
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error || data?.message || `HTTP ${r.status}`);
    return data;
  });
}

type AuthStep = "login" | "register";

export default function DomainOrder() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { formatPrice } = useCurrency();

  const params = new URLSearchParams(search);
  const domain  = params.get("domain") || "";
  const action  = (params.get("action") || "register") as "register" | "transfer";
  const period  = parseInt(params.get("period") || "1", 10) || 1;
  const price   = parseFloat(params.get("price") || "0") || 0;

  // Auth inline
  const [authStep, setAuthStep] = useState<AuthStep>("login");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError]     = useState<string | null>(null);

  // Transfer EPP
  const [eppCode, setEppCode] = useState("");

  // Promo code
  const [promoInput, setPromoInput]   = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError]   = useState<string | null>(null);
  const [promoData, setPromoData]     = useState<{ code: string; discountAmount: number; finalAmount: number; discountPercent: number; discountType: string; fixedAmount: number | null } | null>(null);

  const finalPrice = promoData ? promoData.finalAmount : price;

  async function applyPromo() {
    if (!promoInput.trim()) return;
    setPromoLoading(true); setPromoError(null);
    try {
      const tld = domain.includes(".") ? domain.slice(domain.indexOf(".")) : "";
      const res = await fetch(`/api/promo-codes/validate?code=${encodeURIComponent(promoInput.trim().toUpperCase())}&amount=${price}&serviceType=domain&tld=${encodeURIComponent(tld)}`);
      const data = await res.json();
      if (!res.ok) { setPromoError(data.error || "Invalid promo code"); return; }
      setPromoData({ code: data.code, discountAmount: data.discountAmount, finalAmount: data.finalAmount, discountPercent: data.discountPercent, discountType: data.discountType, fixedAmount: data.fixedAmount });
    } catch { setPromoError("Could not validate promo code. Try again."); }
    finally { setPromoLoading(false); }
  }

  // Order
  const [placing, setPlacing]   = useState(false);
  const [orderErr, setOrderErr] = useState<string | null>(null);
  const [success, setSuccess]   = useState<{ orderId: string; invoiceId: string; promoCode?: string; discount?: number } | null>(null);

  const isLoggedIn = !!user;

  // Redirect if no domain
  useEffect(() => {
    if (!domain) setLocation("/dashboard/domains");
  }, [domain]);

  // Wallet balance
  const { data: creditData, refetch: refetchCredits } = useQuery<{ creditBalance: string }>({
    queryKey: ["domain-order-credits"],
    queryFn: () => apiFetch("/api/my/credits"),
    enabled: isLoggedIn,
  });
  const walletBal = parseFloat(creditData?.creditBalance || "0");
  const canPayWallet = walletBal >= price;

  // Payment methods
  const { data: pmData } = useQuery<any[]>({
    queryKey: ["domain-order-pms"],
    queryFn: () => apiFetch("/api/payment-methods"),
    enabled: isLoggedIn,
  });
  const paymentMethods: any[] = Array.isArray(pmData) ? pmData : [];
  const [selectedPm, setSelectedPm] = useState<string>("credits");

  // Pick first available PM by default once loaded
  useEffect(() => {
    if (!canPayWallet && paymentMethods.length > 0 && selectedPm === "credits") {
      setSelectedPm(paymentMethods[0]?.id || "credits");
    }
  }, [canPayWallet, paymentMethods]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true); setAuthError(null);
    try {
      if (authStep === "login") {
        const data = await apiFetch("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        if (data.token) {
          localStorage.setItem("token", data.token);
          localStorage.setItem("noehost_token", data.token);
          window.location.reload();
        }
      } else {
        const data = await apiFetch("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({ email, password, firstName, lastName }),
        });
        if (data.token) {
          localStorage.setItem("token", data.token);
          localStorage.setItem("noehost_token", data.token);
          window.location.reload();
        }
      }
    } catch (err: any) {
      setAuthError(err.message || "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  }

  async function placeOrder() {
    if (action === "transfer" && !eppCode.trim()) {
      setOrderErr("Please enter your EPP / Authorization code.");
      return;
    }
    setPlacing(true); setOrderErr(null);
    try {
      const payload: Record<string, any> = {
        domain,
        registerDomain: action === "register",
        transferDomain: action === "transfer",
        billingPeriod: period,
        paymentMethodId: selectedPm,
        applyCredits: selectedPm === "credits",
      };
      if (action === "transfer") payload.eppCode = eppCode.trim();
      if (promoData) payload.promoCode = promoData.code;

      const data = await apiFetch("/api/checkout", { method: "POST", body: JSON.stringify(payload) });
      setSuccess({ orderId: data.orderId, invoiceId: data.invoiceId, promoCode: promoData?.code, discount: promoData?.discountAmount });
      refetchCredits();
    } catch (err: any) {
      setOrderErr(err.message || "Order failed. Please try again.");
    } finally {
      setPlacing(false);
    }
  }

  if (!domain) return null;

  // ── SUCCESS STATE ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto" style={{ background: BRAND }}>
          <Check size={36} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Order Placed!</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Your {action === "transfer" ? "transfer" : "registration"} request for <span className="font-mono font-semibold text-foreground">{domain}</span> has been submitted.
          </p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 text-left space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Domain</span>
            <span className="font-mono font-semibold text-foreground text-xs">{domain}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Order ID</span>
            <span className="font-mono text-foreground text-xs">{success.orderId}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Invoice</span>
            <span className="font-mono text-foreground text-xs">{success.invoiceId}</span>
          </div>
          {success.promoCode && success.discount && (
            <div className="flex justify-between text-sm border-t border-border pt-2">
              <span className="text-green-600 flex items-center gap-1.5"><Tag size={12} /> Promo: {success.promoCode}</span>
              <span className="text-green-600 font-semibold">− {formatPrice(success.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm border-t border-border pt-2 font-bold">
            <span className="text-foreground">Amount Paid</span>
            <span className="text-foreground">{formatPrice(finalPrice)}</span>
          </div>
          {action === "transfer" && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-600">
              Transfer takes 5–7 business days. Check your email for confirmation.
            </div>
          )}
        </div>
        <div className="flex gap-3 justify-center flex-wrap">
          <Button variant="outline" onClick={() => setLocation("/dashboard/invoices")}>View Invoice</Button>
          <Button style={{ background: BRAND, border: "none" }} onClick={() => setLocation("/dashboard/domains")}>
            My Domains <ChevronRight size={14} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">

      {/* Back */}
      <button onClick={() => setLocation("/dashboard/domains")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft size={14} /> Back to Domain Search
      </button>

      {/* Domain card */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-5" style={{ background: BRAND }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              {action === "transfer" ? <ArrowRightLeft size={18} className="text-white" /> : <Globe size={18} className="text-white" />}
            </div>
            <div>
              <p className="font-mono font-bold text-white text-lg leading-tight">{domain}</p>
              <p className="text-white/70 text-xs mt-0.5">
                {action === "transfer" ? "Domain Transfer" : "New Registration"} · {period} year{period > 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 flex items-center justify-between border-t border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck size={14} className="text-green-500" />
            <span>{action === "transfer" ? "Transfer includes 1-year renewal" : "Free DNS management included"}</span>
          </div>
          <div className="text-right">
            <p className="font-bold text-foreground text-lg">{formatPrice(price)}</p>
            <p className="text-xs text-muted-foreground">{period} yr{period > 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>

      {/* ── NOT LOGGED IN: inline auth ────────────────────────────────────── */}
      {!isLoggedIn && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex border-b border-border">
            {(["login", "register"] as AuthStep[]).map(s => (
              <button key={s} onClick={() => { setAuthStep(s); setAuthError(null); }}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${authStep === s ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
                {s === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>
          <form onSubmit={handleAuth} className="p-5 space-y-3">
            {authStep === "register" && (
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="First name" value={firstName} onChange={e => setFirstName(e.target.value)} required className="h-10 text-sm" />
                <Input placeholder="Last name" value={lastName} onChange={e => setLastName(e.target.value)} required className="h-10 text-sm" />
              </div>
            )}
            <Input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required className="h-10 text-sm" />
            <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="h-10 text-sm" />
            {authError && (
              <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/10 rounded-xl px-3 py-2.5">
                <AlertCircle size={13} /> {authError}
              </div>
            )}
            <Button type="submit" disabled={authLoading} className="w-full h-10 gap-2" style={{ background: BRAND, border: "none" }}>
              {authLoading ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
              {authStep === "login" ? "Sign In & Continue" : "Create Account & Continue"}
            </Button>
          </form>
        </div>
      )}

      {/* ── LOGGED IN: Transfer EPP + Payment ─────────────────────────────── */}
      {isLoggedIn && (
        <>
          {/* EPP code for transfers */}
          {action === "transfer" && (
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound size={15} className="text-primary" />
                <h3 className="font-semibold text-foreground text-sm">Authorization / EPP Code</h3>
              </div>
              <p className="text-xs text-muted-foreground">Get this from your current registrar (Domain Settings → Transfer Lock → Auth Code).</p>
              <Input
                placeholder="EPP / Auth code — e.g. aB3$xZ1qW9"
                value={eppCode}
                onChange={e => setEppCode(e.target.value)}
                className="h-10 font-mono text-sm"
              />
            </div>
          )}

          {/* Promo Code */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <Tag size={15} className="text-primary" /> Promo Code
            </h3>
            {promoData ? (
              <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 text-green-600 text-sm font-semibold">
                  <Tag size={13} />
                  <span>{promoData.code}</span>
                  <span className="text-green-500 text-xs">
                    {promoData.discountType === "fixed"
                      ? `− ${formatPrice(promoData.discountAmount)}`
                      : `${promoData.discountPercent}% off`}
                  </span>
                </div>
                <button onClick={() => { setPromoData(null); setPromoInput(""); }} className="text-green-700 hover:text-green-900 transition-colors"><X size={15} /></button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Enter promo code"
                  value={promoInput}
                  onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoError(null); }}
                  onKeyDown={e => e.key === "Enter" && applyPromo()}
                  className="h-10 text-sm font-mono uppercase focus-visible:ring-0 focus-visible:border-primary"
                />
                <Button size="sm" variant="outline" className="h-10 px-4 text-xs font-semibold shrink-0" onClick={applyPromo} disabled={promoLoading || !promoInput.trim()}>
                  {promoLoading ? <Loader2 size={13} className="animate-spin" /> : "Apply"}
                </Button>
              </div>
            )}
            {promoError && <p className="text-xs text-destructive flex items-center gap-1.5"><AlertCircle size={11} />{promoError}</p>}
          </div>

          {/* Payment */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <CreditCard size={15} className="text-primary" /> Payment Method
            </h3>

            {/* Wallet option */}
            <button onClick={() => setSelectedPm("credits")}
              className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 transition-all text-sm ${selectedPm === "credits" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedPm === "credits" ? "border-primary" : "border-muted-foreground"}`}>
                  {selectedPm === "credits" && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <Wallet size={15} className="text-primary" />
                <span className="font-medium">Wallet Balance</span>
              </div>
              <div className="text-right">
                <span className={`font-bold text-sm ${canPayWallet ? "text-green-500" : "text-destructive"}`}>
                  {formatPrice(walletBal)}
                </span>
                {!canPayWallet && <p className="text-[10px] text-destructive">Insufficient</p>}
              </div>
            </button>

            {/* Other payment methods */}
            {paymentMethods.map(pm => (
              <button key={pm.id} onClick={() => setSelectedPm(pm.id)}
                className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 transition-all text-sm ${selectedPm === pm.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedPm === pm.id ? "border-primary" : "border-muted-foreground"}`}>
                  {selectedPm === pm.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <CreditCard size={14} className="text-muted-foreground" />
                <span className="font-medium">{pm.name}</span>
                {pm.instructions && <span className="text-muted-foreground text-xs ml-auto truncate max-w-[140px]">{pm.instructions}</span>}
              </button>
            ))}

            {!canPayWallet && selectedPm === "credits" && paymentMethods.length === 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-600">
                Insufficient wallet balance. Please top up your account or contact support.
              </div>
            )}
          </div>

          {/* Order summary + place */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{action === "transfer" ? "Transfer fee" : "Registration"}</span>
                <span className="font-medium">{formatPrice(price)}</span>
              </div>
              {promoData && (
                <div className="flex justify-between text-green-600">
                  <span className="flex items-center gap-1.5"><Tag size={11} /> Promo discount</span>
                  <span className="font-semibold">− {formatPrice(promoData.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 mt-2">
                <span className="font-semibold text-foreground">Total</span>
                <span className="font-bold text-foreground text-base">{formatPrice(finalPrice)}</span>
              </div>
            </div>

            {orderErr && (
              <div className="flex items-start gap-2 text-destructive text-xs bg-destructive/10 rounded-xl px-3 py-3">
                <AlertCircle size={13} className="shrink-0 mt-0.5" /> {orderErr}
              </div>
            )}

            <Button
              className="w-full h-11 text-sm font-semibold gap-2"
              style={{ background: BRAND, border: "none" }}
              onClick={placeOrder}
              disabled={placing || (selectedPm === "credits" && !canPayWallet && paymentMethods.length === 0)}>
              {placing
                ? <><Loader2 size={15} className="animate-spin" /> Processing…</>
                : <>{action === "transfer" ? <ArrowRightLeft size={15} /> : <Globe size={15} />}
                   {action === "transfer" ? "Start Transfer" : "Register Domain"} <ChevronRight size={14} /></>}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              By placing this order you agree to our Terms of Service
            </p>
          </div>
        </>
      )}

    </div>
  );
}
