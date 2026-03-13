import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ShoppingCart, Server, CheckCircle, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";

interface Plan {
  id: string; name: string; description: string | null; price: number;
  billingCycle: string; diskSpace: string; bandwidth: string;
  emailAccounts: number | null; databases: number | null; features: string[];
}

async function fetchPublicPlans(): Promise<Plan[]> {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/packages", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Failed to fetch packages");
  return res.json();
}

const POPULAR_INDEX = 1; // Mark the middle plan as "popular"

export default function NewOrder() {
  const [, setLocation] = useLocation();
  const { data: plans = [], isLoading } = useQuery({ queryKey: ["public-packages"], queryFn: fetchPublicPlans });

  const handleOrder = (plan: Plan) => {
    const params = new URLSearchParams({
      packageId: plan.id,
      packageName: plan.name,
      amount: String(plan.price),
      billingCycle: plan.billingCycle,
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
        <p className="text-muted-foreground mt-2">Select the plan that fits your needs. You can upgrade anytime.</p>
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
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.07 }}
                className={`relative bg-card rounded-2xl p-6 flex flex-col gap-5 transition-all hover:shadow-lg
                  ${isPopular ? "border-2 border-primary shadow-[0_0_30px_-8px_rgba(139,92,246,0.3)]" : "border border-border"}`}
              >
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full shadow">
                    Most Popular
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${isPopular ? "bg-primary/20" : "bg-secondary"}`}>
                    <Server size={20} className={isPopular ? "text-primary" : "text-muted-foreground"} />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-foreground text-lg">{plan.name}</h2>
                    <p className="text-xs text-muted-foreground capitalize">{plan.billingCycle} billing</p>
                  </div>
                </div>

                <div>
                  <p className="text-4xl font-display font-bold text-foreground">
                    ${plan.price.toFixed(2)}
                    <span className="text-base font-normal text-muted-foreground">/{plan.billingCycle === "monthly" ? "mo" : "yr"}</span>
                  </p>
                  {plan.description && <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>}
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
                  className={`w-full gap-2 mt-auto ${isPopular ? "bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25" : ""}`}
                  variant={isPopular ? "default" : "outline"}
                >
                  Order Now <ArrowRight size={16} />
                </Button>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Money-back banner */}
      <div className="flex items-center gap-3 justify-center text-sm text-muted-foreground bg-card border border-border rounded-xl p-4">
        <CheckCircle size={16} className="text-green-400" />
        30-day money-back guarantee on all plans · No setup fees · Cancel anytime
      </div>
    </motion.div>
  );
}
