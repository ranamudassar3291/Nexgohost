import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, Trash2, ArrowRight, ArrowLeft, Package, Tag, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useCart, availableCycles, getItemPrice, CYCLE_LABELS, CYCLE_SUFFIX, type BillingCycle } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyProvider";

export default function Cart() {
  const [, setLocation] = useLocation();
  const { items, removeItem, updateCycle, clearCart } = useCart();
  const { formatPrice } = useCurrency();

  const total = items.reduce((sum, item) => sum + getItemPrice(item), 0);

  function handleCheckout() {
    if (items.length === 0) return;
    const item = items[0];
    const price = getItemPrice(item);
    const params = new URLSearchParams({
      packageId: item.planId,
      packageName: item.planName,
      amount: String(price),
      billingCycle: item.billingCycle,
      monthlyPrice: String(item.monthlyPrice),
      ...(item.quarterlyPrice != null ? { quarterlyPrice: String(item.quarterlyPrice) } : {}),
      ...(item.semiannualPrice != null ? { semiannualPrice: String(item.semiannualPrice) } : {}),
      ...(item.yearlyPrice != null ? { yearlyPrice: String(item.yearlyPrice) } : {}),
      ...(item.renewalEnabled && item.renewalPrice != null ? { renewalPrice: String(item.renewalPrice) } : {}),
    });
    clearCart();
    setLocation(`/client/checkout?${params.toString()}`);
  }

  if (items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-5"
      >
        <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center">
          <ShoppingCart size={36} className="text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground mb-2">Your cart is empty</h2>
          <p className="text-muted-foreground">Browse our hosting plans and add one to get started.</p>
        </div>
        <Button onClick={() => setLocation("/client/orders/new")} className="gap-2">
          <Package size={16} /> Browse Plans
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Your Cart</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{items.length} item{items.length !== 1 ? "s" : ""} in your cart</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setLocation("/client/orders/new")} className="gap-2 text-muted-foreground">
          <ArrowLeft size={15} /> Continue Shopping
        </Button>
      </div>

      {/* Cart Items */}
      <div className="space-y-4">
        <AnimatePresence>
          {items.map(item => {
            const price = getItemPrice(item);
            const cycles = availableCycles(item);
            return (
              <motion.div
                key={item.planId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -40 }}
                className="bg-card border border-border rounded-2xl p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Package size={18} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{item.planName}</h3>
                      <p className="text-xs text-muted-foreground">Hosting Package</p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeItem(item.planId)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-lg hover:bg-destructive/10"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Billing Cycle Selector */}
                {cycles.length > 1 && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-2">Billing Cycle</p>
                    <div className="flex flex-wrap gap-1.5">
                      {cycles.map(c => {
                        const cyclePrice = c === "monthly" ? item.monthlyPrice
                          : c === "quarterly" ? (item.quarterlyPrice ?? item.monthlyPrice * 3)
                          : c === "semiannual" ? (item.semiannualPrice ?? item.monthlyPrice * 6)
                          : (item.yearlyPrice ?? item.monthlyPrice * 12);
                        return (
                          <button
                            key={c}
                            onClick={() => updateCycle(item.planId, c as BillingCycle)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                              item.billingCycle === c
                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                : "bg-background text-muted-foreground border-border hover:border-primary/40"
                            }`}
                          >
                            {CYCLE_LABELS[c as BillingCycle]} — {formatPrice(cyclePrice)}{CYCLE_SUFFIX[c as BillingCycle]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Price */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <span className="text-sm text-muted-foreground">Price</span>
                  <span className="font-display font-bold text-lg text-foreground">
                    {formatPrice(price)}
                    <span className="text-sm font-normal text-muted-foreground">{CYCLE_SUFFIX[item.billingCycle]}</span>
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Order Summary */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Tag size={16} className="text-primary" /> Order Summary
        </h3>
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.planId} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{item.planName} ({CYCLE_LABELS[item.billingCycle]})</span>
              <span className="text-foreground font-medium">{formatPrice(getItemPrice(item))}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center pt-3 border-t border-border font-semibold">
          <span className="text-foreground">Total Due Today</span>
          <span className="text-xl font-display text-primary">{formatPrice(total)}</span>
        </div>
      </div>

      {/* Trust badges */}
      <div className="flex items-center gap-3 justify-center text-sm text-muted-foreground bg-card border border-border rounded-xl p-3">
        <ShieldCheck size={15} className="text-green-500" />
        Secure checkout · 30-day money-back guarantee · No setup fees
      </div>

      {/* Checkout button */}
      <Button onClick={handleCheckout} size="lg" className="w-full gap-2 shadow-lg shadow-primary/20">
        Proceed to Checkout <ArrowRight size={18} />
      </Button>
    </motion.div>
  );
}
