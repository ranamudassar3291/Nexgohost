import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ShoppingCart, Server, CheckCircle, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useCurrency } from "@/context/CurrencyProvider";

interface Plan {
  id: string; name: string; description: string | null; price: number;
  yearlyPrice: number | null; quarterlyPrice: number | null; semiannualPrice: number | null;
  renewalPrice: number | null; renewalEnabled: boolean;
  billingCycle: string; diskSpace: string; bandwidth: string;
  emailAccounts: number | null; databases: number | null; features: string[];
}

type BillingCycle = "monthly" | "quarterly" | "semiannual" | "yearly";

const CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  semiannual: "Semiannual",
  yearly: "Yearly",
};

const CYCLE_SUFFIX: Record<BillingCycle, string> = {
  monthly: "/mo",
  quarterly: "/qtr",
  semiannual: "/6mo",
  yearly: "/yr",
};

async function fetchPublicPlans(): Promise<Plan[]> {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/packages", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Failed to fetch packages");
  return res.json();
}

function getPrice(plan: Plan, cycle: BillingCycle): number | null {
  if (cycle === "monthly") return plan.price;
  if (cycle === "quarterly") return plan.quarterlyPrice ?? null;
  if (cycle === "semiannual") return plan.semiannualPrice ?? null;
  if (cycle === "yearly") return plan.yearlyPrice ?? null;
  return null;
}

function availableCycles(plan: Plan): BillingCycle[] {
  const cycles: BillingCycle[] = ["monthly"];
  if (plan.quarterlyPrice) cycles.push("quarterly");
  if (plan.semiannualPrice) cycles.push("semiannual");
  if (plan.yearlyPrice) cycles.push("yearly");
  return cycles;
}

const POPULAR_INDEX = 1;

export default function NewOrder() {
  const [, setLocation] = useLocation();
  const { formatPrice } = useCurrency();
  const { data: plans = [], isLoading } = useQuery({ queryKey: ["public-packages"], queryFn: fetchPublicPlans });
  const [selectedCycles, setSelectedCycles] = useState<Record<string, BillingCycle>>({});

  const getCycleForPlan = (plan: Plan): BillingCycle => {
    return selectedCycles[plan.id] ?? "monthly";
  };

  const handleOrder = (plan: Plan) => {
    const cycle = getCycleForPlan(plan);
    const price = getPrice(plan, cycle) ?? plan.price;
    const params = new URLSearchParams({
      packageId: plan.id,
      packageName: plan.name,
      amount: String(price),
      billingCycle: cycle,
      monthlyPrice: String(plan.price),
      ...(plan.quarterlyPrice ? { quarterlyPrice: String(plan.quarterlyPrice) } : {}),
      ...(plan.semiannualPrice ? { semiannualPrice: String(plan.semiannualPrice) } : {}),
      ...(plan.yearlyPrice ? { yearlyPrice: String(plan.yearlyPrice) } : {}),
      ...(plan.renewalEnabled && plan.renewalPrice ? { renewalPrice: String(plan.renewalPrice) } : {}),
    });
    setLocation(`/client/checkout?${params.toString()}`);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
          <ShoppingCart size={14} /> Choose a Plan
        </div>
        <h1 className="text-3xl font-display font-bold text-foreground">Hosting Packages</h1>
        <p className="text-muted-foreground mt-2">Select the plan and billing cycle that fits your needs. You can upgrade anytime.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-primary" size={32} /></div>
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 bg-card border border-border rounded-2xl text-center">
          <Server size={32} className="text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No packages available at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {plans.map((plan, idx) => {
            const isPopular = idx === POPULAR_INDEX || plans.length === 1;
            const cycle = getCycleForPlan(plan);
            const price = getPrice(plan, cycle) ?? plan.price;
            const cycles = availableCycles(plan);
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.07 }}
                className={`relative bg-card rounded-2xl p-6 flex flex-col gap-5 transition-all hover:shadow-lg
                  ${isPopular ? "border-2 border-primary shadow-[0_0_30px_-8px_rgba(139,92,246,0.2)]" : "border border-border"}`}
              >
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full shadow">
                    Most Popular
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${isPopular ? "bg-primary/15" : "bg-secondary"}`}>
                    <Server size={20} className={isPopular ? "text-primary" : "text-muted-foreground"} />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-foreground text-lg">{plan.name}</h2>
                    {plan.description && <p className="text-xs text-muted-foreground">{plan.description}</p>}
                  </div>
                </div>

                {/* Billing cycle selector */}
                {cycles.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {cycles.map(c => (
                      <button
                        key={c}
                        onClick={() => setSelectedCycles(prev => ({ ...prev, [plan.id]: c }))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                          cycle === c
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-background text-muted-foreground border-border hover:border-primary/40"
                        }`}
                      >
                        {CYCLE_LABELS[c]}
                      </button>
                    ))}
                  </div>
                )}

                <div>
                  <p className="text-4xl font-display font-bold text-foreground">
                    {formatPrice(price)}
                    <span className="text-base font-normal text-muted-foreground">{CYCLE_SUFFIX[cycle]}</span>
                  </p>
                  {cycle !== "monthly" && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatPrice(plan.price)}/mo equivalent
                    </p>
                  )}
                </div>

                <div className="space-y-2 border-t border-border/50 pt-4">
                  {[
                    { icon: "💾", label: plan.diskSpace + " Storage" },
                    { icon: "📶", label: plan.bandwidth + " Bandwidth" },
                    { icon: "📧", label: (plan.emailAccounts ?? 10) + " Email Accounts" },
                    { icon: "🗄️", label: (plan.databases ?? 5) + " Databases" },
                    ...(plan.features ?? []).map(f => ({ icon: "✅", label: f })),
                  ].map(({ icon, label }) => (
                    <div key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{icon}</span>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => handleOrder(plan)}
                  className={`w-full gap-2 mt-auto ${isPopular ? "bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20" : ""}`}
                  variant={isPopular ? "default" : "outline"}
                >
                  Order Now <ArrowRight size={16} />
                </Button>
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-3 justify-center text-sm text-muted-foreground bg-card border border-border rounded-xl p-4">
        <CheckCircle size={16} className="text-green-500" />
        30-day money-back guarantee on all plans · No setup fees · Cancel anytime
      </div>
    </motion.div>
  );
}
