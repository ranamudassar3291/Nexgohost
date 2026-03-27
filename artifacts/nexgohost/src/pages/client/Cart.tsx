import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Trash2, ArrowRight, ArrowLeft, Package, Tag, ShieldCheck,
  Globe, Zap, Star, Server, HardDrive, Mail, CheckCircle2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useCart, availableCycles, getItemPrice, CYCLE_LABELS, CYCLE_SUFFIX, type BillingCycle } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyProvider";
import { useQuery } from "@tanstack/react-query";

const BRAND_GRADIENT = "linear-gradient(135deg, #701AFE 0%, #9B51E0 60%, #C084FC 100%)";

interface Plan {
  id: string; name: string; description?: string | null; price: number;
  yearlyPrice?: number | null; diskSpace?: string | null; bandwidth?: string | null;
  emailAccounts?: string | null; features?: string[];
}
interface HostingService { id: string; status: string; }
interface DomainItem { id: string; name: string; tld: string; status: string; }

async function apiFetch(url: string) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

function HostingUpsellBanner({
  plans, services, formatPrice, onAddPlan,
}: {
  plans: Plan[]; services: HostingService[]; formatPrice: (n: number) => string; onAddPlan: (p: Plan) => void;
}) {
  const [, setLocation] = useLocation();
  const hasActiveHosting = services.some(s => s.status === "active" || s.status === "pending");
  if (hasActiveHosting || plans.length === 0) return null;

  const top2 = plans.slice(0, 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden border border-violet-500/30 shadow-xl shadow-violet-500/10"
    >
      {/* Header */}
      <div className="px-5 py-4 flex items-start gap-3" style={{ background: "linear-gradient(135deg, rgba(112,26,254,0.12) 0%, rgba(155,81,224,0.08) 100%)" }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#701AFE18" }}>
          <Zap size={18} className="text-primary" />
        </div>
        <div>
          <p className="font-bold text-foreground">Your domain needs a home!</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Connect it to a high-speed hosting plan and launch your website. Add hosting with one click below.
          </p>
        </div>
      </div>

      {/* Plan comparison cards */}
      <div className="p-4 bg-card grid grid-cols-1 sm:grid-cols-2 gap-3">
        {top2.map((plan, i) => (
          <div
            key={plan.id}
            className={`rounded-xl border p-4 space-y-3 relative ${i === 1 ? "border-primary/40 bg-primary/3" : "border-border"}`}
          >
            {i === 1 && (
              <div className="absolute -top-2.5 left-4">
                <span className="px-2.5 py-0.5 text-[10px] font-bold text-white rounded-full" style={{ background: BRAND_GRADIENT }}>
                  ⭐ MOST POPULAR
                </span>
              </div>
            )}
            <div className="pt-1">
              <h4 className="font-bold text-foreground">{plan.name}</h4>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{plan.description || "Reliable hosting for your domain"}</p>
            </div>
            <div>
              <span className="text-2xl font-black text-foreground">{formatPrice(plan.price)}</span>
              <span className="text-xs text-muted-foreground">/mo</span>
              {plan.yearlyPrice && (
                <p className="text-[11px] text-emerald-500 mt-0.5 font-medium">
                  {formatPrice(plan.yearlyPrice)}/yr · saves {Math.round((1 - plan.yearlyPrice / (plan.price * 12)) * 100)}%
                </p>
              )}
            </div>

            {/* Features */}
            <div className="space-y-1.5">
              {[
                plan.diskSpace && { icon: HardDrive, label: `${plan.diskSpace} Storage` },
                plan.bandwidth && { icon: Server, label: `${plan.bandwidth} Bandwidth` },
                plan.emailAccounts && { icon: Mail, label: `${plan.emailAccounts} Email Accounts` },
              ].filter(Boolean).map((f: any, j) => (
                <div key={j} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
                  {f.label}
                </div>
              ))}
            </div>

            <button
              onClick={() => onAddPlan(plan)}
              className={`w-full h-9 rounded-lg text-sm font-semibold transition-all ${
                i === 1
                  ? "text-white shadow-md"
                  : "border border-primary/30 text-primary hover:bg-primary/5"
              }`}
              style={i === 1 ? { background: BRAND_GRADIENT } : {}}
            >
              Add to Cart
            </button>
          </div>
        ))}
      </div>

      <div className="px-4 pb-3 text-center">
        <button onClick={() => setLocation("/client/orders/new")} className="text-xs text-muted-foreground hover:text-primary transition-colors underline-offset-2 hover:underline">
          See all hosting plans →
        </button>
      </div>
    </motion.div>
  );
}

export default function Cart() {
  const [, setLocation] = useLocation();
  const { items, removeItem, updateCycle, clearCart, addItem } = useCart();
  const { formatPrice } = useCurrency();

  const total = items.reduce((sum, item) => sum + getItemPrice(item), 0);

  const { data: services = [] } = useQuery<HostingService[]>({
    queryKey: ["client-services-cart"],
    queryFn: () => apiFetch("/api/client/hosting"),
    retry: false,
  });

  const { data: domains = [] } = useQuery<DomainItem[]>({
    queryKey: ["client-domains-cart"],
    queryFn: () => apiFetch("/api/domains"),
    retry: false,
  });

  const { data: plans = [], isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["public-packages-cart"],
    queryFn: () => fetch("/api/packages").then(r => r.json()),
    staleTime: 300_000,
  });

  const hasDomains = domains.some(d => d.status === "active" || d.status === "pending");
  const hasActiveHosting = services.some(s => s.status === "active" || s.status === "pending");
  const showUpsell = hasDomains && !hasActiveHosting && !plansLoading;

  function handleAddPlan(plan: Plan) {
    addItem({
      planId: plan.id,
      planName: plan.name,
      billingCycle: "monthly",
      monthlyPrice: plan.price,
      yearlyPrice: plan.yearlyPrice ?? null,
    });
  }

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
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center space-y-5">
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
        </div>

        {/* Full-size upsell when cart empty but user has domains */}
        {showUpsell && (
          <div className="space-y-3">
            <p className="text-center text-sm font-semibold text-foreground">Recommended for your domain</p>
            <HostingUpsellBanner plans={plans} services={services} formatPrice={formatPrice} onAddPlan={handleAddPlan} />
          </div>
        )}
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

      {/* Upsell banner if user has domains but no hosting yet */}
      {showUpsell && (
        <HostingUpsellBanner plans={plans} services={services} formatPrice={formatPrice} onAddPlan={handleAddPlan} />
      )}

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

      <div className="flex items-center gap-3 justify-center text-sm text-muted-foreground bg-card border border-border rounded-xl p-3">
        <ShieldCheck size={15} className="text-green-500" />
        Secure checkout · 30-day money-back guarantee · No setup fees
      </div>

      {/* Full-width purple gradient checkout button */}
      <button
        onClick={handleCheckout}
        className="w-full h-14 rounded-xl text-white text-base font-bold flex items-center justify-center gap-2.5 transition-all shadow-xl hover:shadow-2xl hover:brightness-110 active:scale-[0.99]"
        style={{ background: BRAND_GRADIENT, boxShadow: "0 8px 32px rgba(112,26,254,0.3)" }}
      >
        Proceed to Checkout <ArrowRight size={20} />
      </button>
    </motion.div>
  );
}
