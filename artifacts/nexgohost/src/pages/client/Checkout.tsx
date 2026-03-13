import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import { ShoppingCart, Tag, CreditCard, CheckCircle, Loader2, AlertCircle, ArrowLeft, ArrowRight, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface PaymentMethod { id: string; name: string; type: string; description: string | null; isSandbox: boolean; }

interface PromoResult {
  valid: boolean; code: string; discountPercent: number;
  discountAmount: number; originalAmount: number; finalAmount: number;
}

interface OrderSuccess {
  order: { id: string; itemName: string; amount: number; status: string };
  invoice: { id: string; amount: number; status: string; dueDate: string };
  summary: { packageName: string; baseAmount: number; discountAmount: number; finalAmount: number; promo: { code: string; discountPercent: number } | null };
}

const METHOD_ICONS: Record<string, string> = {
  stripe: "💳", paypal: "🅿️", bank_transfer: "🏦", crypto: "₿", manual: "✍️",
};

async function fetchPaymentMethods(): Promise<PaymentMethod[]> {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/payment-methods", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  return res.json();
}

export default function Checkout() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();

  const params = new URLSearchParams(search);
  const packageId = params.get("packageId") ?? "";
  const packageName = params.get("packageName") ?? "Hosting Package";
  const baseAmount = parseFloat(params.get("amount") ?? "0");
  const billingCycle = params.get("billingCycle") ?? "monthly";

  const [promoCode, setPromoCode] = useState("");
  const [promoResult, setPromoResult] = useState<PromoResult | null>(null);
  const [promoError, setPromoError] = useState("");
  const [checkingPromo, setCheckingPromo] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("none");
  const [billingPeriod, setBillingPeriod] = useState(1);
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState<OrderSuccess | null>(null);

  const { data: paymentMethods = [] } = useQuery({ queryKey: ["payment-methods"], queryFn: fetchPaymentMethods });

  // Recalculate when billing period changes — reset promo
  useEffect(() => { setPromoResult(null); setPromoError(""); setPromoCode(""); }, [billingPeriod]);

  if (!packageId) {
    return (
      <div className="flex flex-col items-center justify-center h-60 text-center">
        <AlertCircle size={32} className="text-muted-foreground mb-3" />
        <p className="text-muted-foreground">No package selected.</p>
        <Button className="mt-4" onClick={() => setLocation("/client/orders/new")}>Browse Packages</Button>
      </div>
    );
  }

  const periodAmount = baseAmount * billingPeriod;
  const discount = promoResult?.discountAmount ?? 0;
  const finalAmount = Math.max(0, periodAmount - discount);

  const applyPromo = async () => {
    if (!promoCode.trim()) return;
    setCheckingPromo(true);
    setPromoError("");
    setPromoResult(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/promo-codes/validate?code=${encodeURIComponent(promoCode)}&amount=${periodAmount}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid promo code");
      setPromoResult(data);
    } catch (err: any) {
      setPromoError(err.message);
    } finally {
      setCheckingPromo(false);
    }
  };

  const handleCheckout = async () => {
    setPlacing(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/client/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          packageId,
          promoCode: promoResult?.code ?? undefined,
          paymentMethodId: selectedPaymentMethod !== "none" ? selectedPaymentMethod : undefined,
          billingPeriod,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      setSuccess(data);
    } catch (err: any) {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
    } finally {
      setPlacing(false);
    }
  };

  // Success screen
  if (success) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md mx-auto text-center space-y-6 py-8">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shadow-[0_0_40px_-8px_rgba(34,197,94,0.3)]">
            <CheckCircle size={40} className="text-green-400" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Order Placed!</h1>
          <p className="text-muted-foreground mt-1">Your order has been submitted and is pending review.</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 text-left space-y-3">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Package</span><span className="font-medium text-foreground">{success.summary.packageName}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Order ID</span><span className="font-mono text-xs text-foreground">{success.order.id.slice(0, 8)}…</span></div>
          {success.summary.promo && (
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Promo Applied</span><span className="text-green-400 font-medium">{success.summary.promo.code} (-{success.summary.promo.discountPercent}%)</span></div>
          )}
          <div className="flex justify-between text-sm font-semibold border-t border-border/50 pt-3">
            <span>Invoice Total</span>
            <span className="text-primary">${success.invoice.amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Due Date</span>
            <span>{success.invoice.dueDate ? new Date(success.invoice.dueDate).toLocaleDateString() : "—"}</span>
          </div>
        </div>
        <div className="flex gap-3">
          <Button className="flex-1 bg-primary hover:bg-primary/90 gap-2" onClick={() => setLocation("/client/invoices")}>
            <Receipt size={16} /> View Invoice
          </Button>
          <Button variant="outline" onClick={() => setLocation("/client/dashboard")}>Dashboard</Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/client/orders/new")} className="rounded-xl">
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Checkout</h1>
          <p className="text-muted-foreground text-sm">Complete your order</p>
        </div>
      </div>

      <div className="grid gap-5">
        {/* Order Summary */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart size={18} className="text-primary" />
            <h2 className="font-semibold text-foreground">Order Summary</h2>
          </div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-medium text-foreground">{packageName}</p>
              <p className="text-sm text-muted-foreground">${baseAmount.toFixed(2)} / {billingCycle}</p>
            </div>
            <div className="flex gap-2">
              {[1, 3, 6, 12].map(m => (
                <button
                  key={m}
                  onClick={() => setBillingPeriod(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${billingPeriod === m ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                >
                  {m === 1 ? "1 mo" : `${m} mo`}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2 text-sm border-t border-border/50 pt-3">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal ({billingPeriod} month{billingPeriod > 1 ? "s" : ""})</span>
              <span>${periodAmount.toFixed(2)}</span>
            </div>
            {promoResult && (
              <div className="flex justify-between text-green-400">
                <span>Promo: {promoResult.code} (-{promoResult.discountPercent}%)</span>
                <span>-${discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-foreground text-base border-t border-border/50 pt-2">
              <span>Total</span>
              <span className="text-primary">${finalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Promo Code */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Tag size={18} className="text-primary" />
            <h2 className="font-semibold text-foreground">Promo Code</h2>
          </div>
          <div className="flex gap-2">
            <Input
              value={promoCode}
              onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError(""); setPromoResult(null); }}
              placeholder="Enter promo code (e.g. SAVE20)"
              className="font-mono uppercase"
              disabled={!!promoResult}
            />
            {promoResult ? (
              <Button variant="outline" onClick={() => { setPromoResult(null); setPromoCode(""); }} className="shrink-0">Remove</Button>
            ) : (
              <Button onClick={applyPromo} disabled={checkingPromo || !promoCode.trim()} className="shrink-0 gap-1.5">
                {checkingPromo ? <Loader2 size={14} className="animate-spin" /> : <Tag size={14} />} Apply
              </Button>
            )}
          </div>
          {promoError && (
            <div className="flex items-center gap-2 mt-2 text-sm text-destructive">
              <AlertCircle size={14} />{promoError}
            </div>
          )}
          {promoResult && (
            <div className="flex items-center gap-2 mt-2 text-sm text-green-400">
              <CheckCircle size={14} />
              {promoResult.code} applied — {promoResult.discountPercent}% off (saves ${promoResult.discountAmount.toFixed(2)})
            </div>
          )}
        </div>

        {/* Payment Method */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={18} className="text-primary" />
            <h2 className="font-semibold text-foreground">Payment Method</h2>
          </div>
          <div className="space-y-2">
            <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedPaymentMethod === "none" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
              <input type="radio" value="none" checked={selectedPaymentMethod === "none"} onChange={() => setSelectedPaymentMethod("none")} className="accent-primary" />
              <span className="text-2xl">📋</span>
              <div>
                <p className="font-medium text-foreground text-sm">Manual / Pay Later</p>
                <p className="text-xs text-muted-foreground">Invoice will be sent to your email</p>
              </div>
            </label>
            {paymentMethods.map(m => (
              <label key={m.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedPaymentMethod === m.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                <input type="radio" value={m.id} checked={selectedPaymentMethod === m.id} onChange={() => setSelectedPaymentMethod(m.id)} className="accent-primary" />
                <span className="text-2xl">{METHOD_ICONS[m.type] ?? "💳"}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground text-sm">{m.name}</p>
                    {m.isSandbox && <span className="text-xs px-1.5 py-0.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 rounded">Sandbox</span>}
                  </div>
                  {m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Place Order */}
        <Button
          onClick={handleCheckout}
          disabled={placing}
          className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 gap-2"
        >
          {placing ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
          {placing ? "Placing Order..." : `Place Order · $${finalAmount.toFixed(2)}`}
        </Button>
      </div>
    </motion.div>
  );
}
