import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, CheckCircle2, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useCurrency } from "@/context/CurrencyProvider";

const DEFAULT_ALL_FEATURES = [
  { category: "Performance", items: ["NVMe Storage", "Object Cache", "CDN Included", "99.9% Uptime Guarantee"] },
  { category: "Security",    items: ["Free SSL", "DDoS Protection", "Web Application Firewall", "Daily Backups"] },
  { category: "Support",     items: ["24/7 Live Chat", "Priority Support", "Knowledge Base", "Video Tutorials"] },
  { category: "Tools",       items: ["WordPress Staging", "AI Website Builder", "GIT Integration", "SSH Access"] },
];

const SHARED_PLANS = [
  {
    name: "Single",   monthly: 1.99, yearly: 1.49,
    features: ["1 Website", "50GB SSD", "100GB Bandwidth", "Free SSL", "Weekly Backups"],
    popular: false, badge: "", btnText: "Get Started", btnUrl: "/register",
  },
  {
    name: "Premium",  monthly: 2.99, yearly: 2.49,
    features: ["100 Websites", "100GB SSD", "Unlimited Bandwidth", "Free SSL", "Free Domain ($9.99 value)", "Weekly Backups"],
    popular: true, badge: "+ 3 Months Free", btnText: "Get Started", btnUrl: "/register",
  },
  {
    name: "Business", monthly: 3.99, yearly: 2.99,
    features: ["100 Websites", "200GB NVMe SSD", "Unlimited Bandwidth", "Free SSL", "Free Domain", "Daily Backups", "CDN Included"],
    popular: false, badge: "", btnText: "Get Started", btnUrl: "/register",
  },
];

const PlanBtn = ({ url, text, popular }: { url: string; text: string; popular: boolean }) => {
  const cls = `block w-full py-3.5 rounded-2xl font-black transition-all mb-6 text-sm text-center ${
    popular ? "bg-primary text-white hover:bg-primary-600 shadow-xl shadow-primary/30" : "bg-slate-900 text-white hover:bg-slate-800"
  }`;
  return <Link href={url} className={cls}>{text}</Link>;
};

export function SitePricing() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const { convert } = useCurrency();

  const getPrice = (plan: any) => billingCycle === "yearly" ? plan.yearly : plan.monthly;

  return (
    <section id="pricing" className="py-16 bg-slate-50 relative overflow-hidden">
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2 className="text-3xl lg:text-4xl font-black text-slate-900 mb-4">Choose your Web Hosting plan</h2>
          <p className="text-base text-slate-600 font-medium">
            Get the best value for your money with our feature-rich plans. All plans include a 30-day money-back guarantee.
          </p>

          {/* Billing toggle */}
          <div className="mt-6 inline-flex items-center gap-4">
            <span className={`text-sm font-black ${billingCycle === "monthly" ? "text-slate-900" : "text-slate-400"}`}>Monthly</span>
            <button
              onClick={() => setBillingCycle(b => b === "monthly" ? "yearly" : "monthly")}
              className={`w-12 h-6 rounded-full transition-all relative ${billingCycle === "yearly" ? "bg-primary" : "bg-slate-300"}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${billingCycle === "yearly" ? "left-7" : "left-1"}`} />
            </button>
            <span className={`text-sm font-black ${billingCycle === "yearly" ? "text-slate-900" : "text-slate-400"}`}>
              Annual <span className="text-emerald-600 ml-1 text-xs">Save more</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {SHARED_PLANS.map((plan, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative flex flex-col p-7 rounded-[28px] border-2 transition-all duration-500 ${
                plan.popular
                  ? "border-primary bg-white shadow-2xl shadow-primary/10 scale-105 z-10"
                  : "border-slate-200 bg-white hover:border-primary/30"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-primary text-white px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/30">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-black text-slate-900 mb-3">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-primary tracking-tighter">{convert(getPrice(plan))}</span>
                  <span className="text-slate-500 font-bold">/mo</span>
                </div>
                {billingCycle === "yearly" && (
                  <div className="text-xs text-emerald-600 font-bold mt-1">
                    Save {Math.round((1 - plan.yearly / plan.monthly) * 100)}% vs monthly
                  </div>
                )}
                {plan.badge && (
                  <div className="mt-4 inline-block px-3 py-1 bg-primary/10 text-primary text-[10px] font-black rounded-full uppercase tracking-widest">
                    {plan.badge}
                  </div>
                )}
              </div>

              <PlanBtn url={plan.btnUrl} text={plan.btnText} popular={plan.popular} />

              <div className="flex-grow">
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Top Features</div>
                <ul className="space-y-4">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-3 text-slate-600">
                      <CheckCircle2 size={18} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm font-bold leading-tight">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-100">
                <button
                  onClick={() => setSelectedPlan(plan)}
                  className="text-primary font-black text-sm hover:underline flex items-center gap-2"
                >
                  See all features <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Features Modal */}
      <AnimatePresence>
        {selectedPlan && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPlan(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-[40px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="text-2xl font-black text-slate-900">{selectedPlan.name} Features</h3>
                  <p className="text-slate-500 font-medium">Detailed breakdown of everything included in this plan.</p>
                </div>
                <button
                  onClick={() => setSelectedPlan(null)}
                  className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                {DEFAULT_ALL_FEATURES.map((cat, i) => (
                  <div key={i} className="space-y-4">
                    <h4 className="text-xs font-black text-primary uppercase tracking-[0.2em]">{cat.category}</h4>
                    <div className="grid grid-cols-1 gap-3">
                      {cat.items.map((item, j) => (
                        <div key={j} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <Check size={16} className="text-emerald-500 flex-shrink-0" />
                          <span className="text-sm font-bold text-slate-700">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-8 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-primary">{convert(getPrice(selectedPlan))}</span>
                  <span className="text-slate-500 font-bold">/mo</span>
                </div>
                <PlanBtn url={selectedPlan.btnUrl} text="Get Started Now" popular={true} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
