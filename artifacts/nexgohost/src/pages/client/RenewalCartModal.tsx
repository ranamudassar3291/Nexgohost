import { useState } from "react";
import { X, Tag, Loader2, CheckCircle2, AlertCircle, ShoppingCart, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrency } from "@/context/CurrencyProvider";

function authFetch(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token") || "";
  return fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts.headers },
  });
}

export interface RenewalItem {
  id: string;
  name: string;
  type: "domain" | "hosting";
  price: number;
  billingCycle?: string;
  serviceType?: string;
}

interface PromoResult {
  code: string;
  discountPercent: number;
  discountAmount: number;
  originalAmount: number;
  finalAmount: number;
}

interface RenewalCartModalProps {
  item: RenewalItem;
  onClose: () => void;
  onSuccess: (invoiceId: string, invoiceNumber: string) => void;
}

export function RenewalCartModal({ item, onClose, onSuccess }: RenewalCartModalProps) {
  const { formatPrice } = useCurrency();

  const [promoInput, setPromoInput] = useState("");
  const [promoData, setPromoData] = useState<PromoResult | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const originalPrice = item.price;
  const discountAmount = promoData?.discountAmount ?? 0;
  const finalTotal = promoData ? promoData.finalAmount : originalPrice;

  const validatePromo = async () => {
    if (!promoInput.trim()) return;
    setPromoLoading(true);
    setPromoError(null);
    setPromoData(null);
    try {
      const res = await authFetch(
        `/api/promo-codes/validate?code=${encodeURIComponent(promoInput.trim())}&amount=${originalPrice}&serviceType=${item.type}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setPromoError(data.error || "Invalid promo code");
      } else {
        setPromoData(data);
        console.log("CART DEBUG:", { item: item.name, promo: data.code, discount: data.discountAmount, total: data.finalAmount });
      }
    } catch {
      setPromoError("Failed to validate promo code");
    } finally {
      setPromoLoading(false);
    }
  };

  const removePromo = () => {
    setPromoData(null);
    setPromoInput("");
    setPromoError(null);
  };

  const placeOrder = async () => {
    setPlacing(true);
    setError(null);
    try {
      const endpoint =
        item.type === "domain"
          ? `/api/domains/${item.id}/renew`
          : `/api/client/hosting/${item.id}/renew`;

      const body: Record<string, unknown> = {};
      if (promoData) body.promoCode = promoData.code;

      console.log("CART DEBUG:", {
        item: item.name,
        type: item.type,
        originalPrice,
        promoCode: promoData?.code ?? null,
        discountAmount,
        finalTotal,
      });

      const res = await authFetch(endpoint, { method: "POST", body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to place order");

      onSuccess(data.invoiceId, data.invoiceNumber);
    } catch (err: any) {
      setError(err.message || "Failed to place order");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ShoppingCart size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Renewal Cart</h3>
              <p className="text-xs text-muted-foreground">Review your order before placing</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Cart Item */}
          <div className="bg-secondary/40 rounded-xl border border-border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground font-mono truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                  {item.type === "domain" ? "Domain Renewal — 1 year" : `Hosting Renewal${item.billingCycle ? ` — ${item.billingCycle}` : ""}`}
                </p>
              </div>
              <span className="font-bold text-foreground shrink-0 font-mono">{formatPrice(originalPrice)}</span>
            </div>
          </div>

          {/* Promo Code */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wider flex items-center gap-1.5">
              <Tag size={11} /> Promo Code
            </label>
            {promoData ? (
              <div className="flex items-center justify-between gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle2 size={15} />
                  <span className="font-medium text-sm">{promoData.code}</span>
                  <span className="text-xs text-green-400/70">−{promoData.discountPercent}%</span>
                </div>
                <button
                  onClick={removePromo}
                  className="text-xs text-muted-foreground hover:text-red-400 transition-colors underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Enter promo code"
                  value={promoInput}
                  onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoError(null); }}
                  onKeyDown={e => e.key === "Enter" && validatePromo()}
                  className="h-9 font-mono uppercase"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={validatePromo}
                  disabled={!promoInput.trim() || promoLoading}
                  className="shrink-0 gap-1.5 h-9"
                >
                  {promoLoading ? <Loader2 size={13} className="animate-spin" /> : "Apply"}
                </Button>
              </div>
            )}
            {promoError && (
              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <AlertCircle size={12} /> {promoError}
              </p>
            )}
          </div>

          {/* Price Breakdown */}
          <div className="bg-secondary/30 rounded-xl border border-border/50 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">{formatPrice(originalPrice)}</span>
            </div>
            {promoData && (
              <div className="flex justify-between text-sm text-green-400">
                <span>Discount ({promoData.discountPercent}%)</span>
                <span className="font-mono">−{formatPrice(promoData.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold border-t border-border/50 pt-2 mt-2">
              <span className="text-foreground">Total</span>
              <span className="font-mono text-primary">{formatPrice(finalTotal)}</span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={placing}>
              Cancel
            </Button>
            <Button onClick={placeOrder} disabled={placing} className="flex-1 gap-2">
              {placing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              {placing ? "Placing order…" : "Place Order"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            An invoice will be generated and sent to your account.
          </p>
        </div>
      </div>
    </div>
  );
}
