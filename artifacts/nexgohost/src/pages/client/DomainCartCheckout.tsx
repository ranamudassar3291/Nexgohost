import { useState, useEffect } from "react";
import {
  Globe, ArrowRightLeft, ShoppingCart, Trash2, ChevronRight,
  CheckCircle2, Loader2, AlertCircle, CreditCard, Lock, RefreshCw,
  KeyRound, Tag, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useCurrency } from "@/context/CurrencyProvider";

const DOMAIN_CART_KEY = "noehost_domain_cart_v1";
const BRAND = "linear-gradient(135deg, #6B46C1 0%, #7C5DE2 60%, #8B5CF6 100%)";

interface CartItem {
  domain: string;
  period: number;
  price: number;
  originalPrice: number | null;
  isFreeWithHosting: boolean;
  action: "register" | "transfer";
}

interface PaymentMethod {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token") || localStorage.getItem("noehost_token") || "";
  return fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...opts,
  }).then(async r => {
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error || data?.message || `HTTP ${r.status}`);
    return data;
  });
}

type AuthTab = "login" | "register";

export default function DomainCartCheckout() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();

  const [items, setItems] = useState<CartItem[]>([]);
  const [eppCodes, setEppCodes] = useState<Record<string, string>>({});
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("token"));
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [applyCredits, setApplyCredits] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successInvoiceId, setSuccessInvoiceId] = useState<string | null>(null);

  // Promo code
  const [promoInput, setPromoInput]     = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError]     = useState<string | null>(null);
  const [promoData, setPromoData]       = useState<{ code: string; discountAmount: number; finalAmount: number; discountPercent: number; discountType: string; fixedAmount: number | null } | null>(null);

  // Auth form
  const [authTab, setAuthTab] = useState<AuthTab>("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DOMAIN_CART_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setItems(parsed);
          return;
        }
      }
    } catch {}
    // Nothing in cart — redirect back to domain search
    setLocation("/client/domains");
  }, []);

  const { data: creditData } = useQuery<{ creditBalance: string }>({
    queryKey: ["credit-balance-domain-checkout"],
    queryFn: () => apiFetch("/api/my/credit-balance"),
    enabled: isLoggedIn,
    staleTime: 30_000,
  });
  const creditBalance = parseFloat(creditData?.creditBalance ?? "0");

  const { data: paymentMethods = [] } = useQuery<PaymentMethod[]>({
    queryKey: ["payment-methods-domain-checkout"],
    queryFn: async () => (await fetch("/api/payment-methods")).json(),
    enabled: isLoggedIn,
    staleTime: 60_000,
  });

  const rawTotal = items.reduce((s, c) => s + c.price, 0);
  const promoDiscount = promoData ? Math.min(promoData.discountAmount, rawTotal) : 0;
  const total = Math.max(0, rawTotal - promoDiscount);
  const walletDeducted = applyCredits && creditBalance > 0 ? Math.min(creditBalance, total) : 0;
  const remaining = Math.max(0, total - walletDeducted);

  async function applyPromo() {
    if (!promoInput.trim()) return;
    setPromoLoading(true); setPromoError(null);
    try {
      const res = await fetch(`/api/promo-codes/validate?code=${encodeURIComponent(promoInput.trim().toUpperCase())}&amount=${rawTotal}&serviceType=domain`);
      const data = await res.json();
      if (!res.ok) { setPromoError(data.error || "Invalid promo code"); return; }
      setPromoData({ code: data.code, discountAmount: data.discountAmount, finalAmount: data.finalAmount, discountPercent: data.discountPercent, discountType: data.discountType, fixedAmount: data.fixedAmount });
    } catch { setPromoError("Could not validate promo code. Try again."); }
    finally { setPromoLoading(false); }
  }

  function removeItem(domain: string) {
    setItems(prev => {
      const next = prev.filter(c => c.domain !== domain);
      if (next.length === 0) {
        localStorage.removeItem(DOMAIN_CART_KEY);
        setLocation("/client/domain-search");
      } else {
        localStorage.setItem(DOMAIN_CART_KEY, JSON.stringify(next));
      }
      return next;
    });
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      const token = data.token || data.accessToken;
      if (!token) throw new Error("Login failed — no token returned");
      localStorage.setItem("token", token);
      localStorage.setItem("noehost_token", token);
      setIsLoggedIn(true);
      toast({ title: "Logged in!", description: "You can now place your domain order." });
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const data = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name: authName, email: authEmail, password: authPassword }),
      });
      const token = data.token || data.accessToken;
      if (!token) throw new Error("Registration succeeded but login token missing — please log in.");
      localStorage.setItem("token", token);
      localStorage.setItem("noehost_token", token);
      setIsLoggedIn(true);
      toast({ title: "Account created!", description: "You can now place your domain order." });
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handlePlaceOrder() {
    // Validate EPP codes for transfers
    for (const item of items) {
      if (item.action === "transfer" && !eppCodes[item.domain]?.trim()) {
        toast({ title: "EPP code required", description: `Please enter the EPP / auth code for ${item.domain}`, variant: "destructive" });
        return;
      }
    }

    const effectivePaymentId = remaining === 0 && applyCredits
      ? "credits"
      : applyCredits && walletDeducted > 0
        ? paymentMethodId
        : paymentMethodId;

    if (remaining > 0 && !effectivePaymentId) {
      toast({ title: "Select a payment method", description: "Choose how to pay the remaining balance.", variant: "destructive" });
      return;
    }

    setPlacing(true);
    const invoiceIds: string[] = [];

    try {
      for (const item of items) {
        const body: Record<string, unknown> = {
          domain: item.domain,
          billingCycle: item.period === 2 ? "2year" : item.period === 3 ? "3year" : "yearly",
          paymentMethodId: effectivePaymentId,
          applyCredits,
        };

        if (item.action === "transfer") {
          body.transferDomain = true;
          body.eppCode = eppCodes[item.domain]?.trim();
        } else {
          body.registerDomain = true;
        }
        if (promoData) body.promoCode = promoData.code;

        const result = await apiFetch("/api/checkout", {
          method: "POST",
          body: JSON.stringify(body),
        });

        if (result.invoiceId) invoiceIds.push(result.invoiceId);
      }

      // Clear cart
      localStorage.removeItem(DOMAIN_CART_KEY);
      setSuccess(true);
      if (invoiceIds.length === 1) setSuccessInvoiceId(invoiceIds[0]);
    } catch (err: any) {
      console.error("[DOMAIN CHECKOUT] Order placement failed:", err);
      toast({
        title: "Order could not be placed",
        description: err.message || "Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setPlacing(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center mx-auto">
            <CheckCircle2 size={40} className="text-green-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Order Placed!</h1>
            <p className="text-muted-foreground text-sm mt-2">
              Your domain{items.length > 1 ? "s are" : " is"} being processed. You'll receive a confirmation email shortly.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {successInvoiceId && (
              <Button className="w-full gap-2" style={{ background: BRAND, border: "none" }}
                onClick={() => setLocation(`/client/invoices/${successInvoiceId}`)}>
                View Invoice <ChevronRight size={15} />
              </Button>
            )}
            <Button variant="outline" className="w-full" onClick={() => setLocation("/client/domains")}>
              My Domains
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: BRAND }}>
              <Globe size={16} className="text-white" />
            </div>
            <span className="font-semibold text-foreground text-sm">Domain Checkout</span>
          </div>
          <button onClick={() => setLocation("/client/domains")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Search
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-sm">
          <div className="flex items-center gap-1.5 text-primary font-semibold">
            <div className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center" style={{ background: BRAND }}>1</div>
            Review Order
          </div>
          <div className="h-px flex-1 bg-border" />
          <div className={`flex items-center gap-1.5 ${isLoggedIn ? "text-primary font-semibold" : "text-muted-foreground"}`}>
            <div className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${isLoggedIn ? "text-white" : "bg-muted text-muted-foreground"}`}
              style={isLoggedIn ? { background: BRAND } : {}}>2</div>
            {isLoggedIn ? "Signed In" : "Sign In"}
          </div>
          <div className="h-px flex-1 bg-border" />
          <div className={`flex items-center gap-1.5 ${isLoggedIn ? "text-muted-foreground" : "text-muted-foreground"}`}>
            <div className="w-5 h-5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center">3</div>
            Payment
          </div>
        </div>

        {/* Domain line items */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart size={15} className="text-primary" />
              <h2 className="font-semibold text-foreground text-sm">Your Order ({items.length} domain{items.length > 1 ? "s" : ""})</h2>
            </div>
            <button onClick={() => setLocation("/client/domain-search")}
              className="text-xs text-primary hover:underline flex items-center gap-1">
              <RefreshCw size={11} /> Edit Cart
            </button>
          </div>
          <div className="divide-y divide-border">
            {items.map(item => (
              <div key={item.domain} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.action === "transfer" ? "bg-blue-500/10 text-blue-500" : "bg-green-500/10 text-green-600"}`}>
                    {item.action === "transfer" ? <ArrowRightLeft size={15} /> : <Globe size={15} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-foreground text-sm">{item.domain}</span>
                      <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${item.action === "transfer" ? "border-blue-500/30 text-blue-500 bg-blue-500/5" : "border-green-500/30 text-green-600 bg-green-500/5"}`}>
                        {item.action === "transfer" ? "Transfer" : "Registration"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{item.period} yr{item.period > 1 ? "s" : ""}</span>
                    </div>
                    {/* EPP code input for transfers */}
                    {item.action === "transfer" && (
                      <div className="mt-2 flex items-center gap-2">
                        <KeyRound size={12} className="text-muted-foreground shrink-0" />
                        <Input
                          value={eppCodes[item.domain] ?? ""}
                          onChange={e => setEppCodes(prev => ({ ...prev, [item.domain]: e.target.value }))}
                          placeholder="EPP / Auth code from your current registrar"
                          className="h-8 text-xs font-mono focus-visible:ring-0 focus-visible:border-primary"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-foreground text-sm">{formatPrice(item.price)}</span>
                    <button onClick={() => removeItem(item.domain)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Totals */}
          <div className="px-5 py-4 border-t border-border bg-muted/30 space-y-2">
            {promoData && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-green-600 flex items-center gap-1.5"><Tag size={11} /> Promo: {promoData.code}</span>
                <span className="text-green-600 font-semibold">− {formatPrice(promoDiscount)}</span>
              </div>
            )}
            {applyCredits && walletDeducted > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Wallet Credit Applied</span>
                <span className="text-green-600 font-medium">− {formatPrice(walletDeducted)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground text-sm">Total Due Today</span>
              <span className="text-xl font-bold text-foreground">{formatPrice(applyCredits ? remaining : total)}</span>
            </div>
          </div>
        </div>

        {/* Promo Code section */}
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
              <input
                type="text"
                placeholder="Enter promo code"
                value={promoInput}
                onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoError(null); }}
                onKeyDown={e => e.key === "Enter" && applyPromo()}
                className="flex-1 h-10 px-3 text-sm font-mono uppercase bg-background border border-input rounded-xl focus:outline-none focus:border-primary"
              />
              <button onClick={applyPromo} disabled={promoLoading || !promoInput.trim()}
                className="h-10 px-4 text-xs font-semibold rounded-xl border border-input bg-background hover:bg-muted transition-all disabled:opacity-50">
                {promoLoading ? <Loader2 size={13} className="animate-spin" /> : "Apply"}
              </button>
            </div>
          )}
          {promoError && <p className="text-xs text-destructive flex items-center gap-1.5"><AlertCircle size={11} />{promoError}</p>}
        </div>

        {/* Payment section — only shown when logged in */}
        {isLoggedIn && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <CreditCard size={15} className="text-primary" />
              <h2 className="font-semibold text-foreground text-sm">Payment</h2>
            </div>
            <div className="px-5 py-4 space-y-4">
              {/* Wallet toggle */}
              {creditBalance > 0 && (
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-border hover:border-primary/30 transition-colors">
                  <input type="checkbox" checked={applyCredits} onChange={e => setApplyCredits(e.target.checked)} className="rounded" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">Use Wallet Balance</p>
                    <p className="text-xs text-muted-foreground">Available: {formatPrice(creditBalance)}</p>
                  </div>
                  {applyCredits && walletDeducted === total && (
                    <Badge className="bg-green-500/15 text-green-600 border-green-500/25 text-xs">Fully Covered</Badge>
                  )}
                </label>
              )}

              {/* Payment method selector */}
              {remaining > 0 && paymentMethods.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Payment Method</p>
                  {(paymentMethods as PaymentMethod[]).filter(p => p.isActive).map(pm => (
                    <label key={pm.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${paymentMethodId === pm.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                      <input type="radio" name="paymentMethod" checked={paymentMethodId === pm.id}
                        onChange={() => setPaymentMethodId(pm.id)} className="text-primary" />
                      <span className="text-sm text-foreground">{pm.name}</span>
                    </label>
                  ))}
                </div>
              )}

              {remaining === 0 && applyCredits && (
                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
                  <CheckCircle2 size={15} />
                  Your wallet balance fully covers this order — no additional payment needed.
                </div>
              )}

              {/* Place order button */}
              <Button
                className="w-full h-12 gap-2 font-semibold text-base"
                style={{ background: BRAND, border: "none" }}
                disabled={placing || (remaining > 0 && !paymentMethodId)}
                onClick={handlePlaceOrder}
              >
                {placing
                  ? <><Loader2 size={16} className="animate-spin" /> Placing Order…</>
                  : <><Lock size={15} /> Place Order — {formatPrice(applyCredits ? remaining : total)}</>}
              </Button>
              <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Lock size={10} /> Secured checkout · 256-bit SSL
              </p>
            </div>
          </div>
        )}

        {/* Auth gate — shown when NOT logged in */}
        {!isLoggedIn && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground text-sm">Sign in to complete your order</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Your cart is saved — create an account or sign in below to proceed.</p>
            </div>
            {/* Tabs */}
            <div className="flex border-b border-border">
              {(["login", "register"] as AuthTab[]).map(tab => (
                <button key={tab} onClick={() => { setAuthTab(tab); setAuthError(null); }}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${authTab === tab ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}>
                  {tab === "login" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>
            <div className="px-5 py-5">
              <form onSubmit={authTab === "login" ? handleLogin : handleRegister} className="space-y-3">
                {authTab === "register" && (
                  <Input
                    placeholder="Full name"
                    value={authName}
                    onChange={e => setAuthName(e.target.value)}
                    required
                    className="h-11 focus-visible:ring-0 focus-visible:border-primary"
                  />
                )}
                <Input
                  type="email"
                  placeholder="Email address"
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  required
                  className="h-11 focus-visible:ring-0 focus-visible:border-primary"
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-11 focus-visible:ring-0 focus-visible:border-primary"
                />
                {authError && (
                  <div className="flex items-start gap-2 text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-sm">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" /> {authError}
                  </div>
                )}
                <Button
                  type="submit"
                  className="w-full h-11 gap-2 font-semibold"
                  style={{ background: BRAND, border: "none" }}
                  disabled={authLoading}
                >
                  {authLoading
                    ? <><Loader2 size={15} className="animate-spin" /> {authTab === "login" ? "Signing in…" : "Creating account…"}</>
                    : authTab === "login" ? "Sign In & Review Payment" : "Create Account & Review Payment"}
                </Button>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
