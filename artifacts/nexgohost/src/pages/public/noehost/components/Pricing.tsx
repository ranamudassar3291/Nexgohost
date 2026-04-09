import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, CheckCircle2, ArrowRight } from 'lucide-react';
import { useContent } from '@/context/ContentContext';
import { useCurrency } from '@/context/CurrencyProvider';
import { Link } from 'wouter';

const DEFAULT_ALL_FEATURES = [
  { category: 'Performance', items: ['NVMe Storage', 'Object Cache', 'CDN Included', '99.9% Uptime Guarantee'] },
  { category: 'Security', items: ['Free SSL', 'DDoS Protection', 'Web Application Firewall', 'Daily Backups'] },
  { category: 'Support', items: ['24/7 Live Chat', 'Priority Support', 'Knowledge Base', 'Video Tutorials'] },
  { category: 'Tools', items: ['WordPress Staging', 'AI Website Builder', 'GIT Integration', 'SSH Access'] },
];

const DEFAULT_PRICING = {
  header: {
    title: 'Choose your Web Hosting plan',
    subtitle: 'Get the best value for your money with our feature-rich plans. All plans include a 30-day money-back guarantee.',
  },
  shared: [
    { name: 'Single', monthly: 1.99, yearly: 1.49, btnText: 'Add to cart', btnUrl: '/register', features: ['1 Website', '50GB SSD', '100GB Bandwidth', 'Free SSL', 'Weekly Backups'], popular: false, badge: '' },
    { name: 'Premium', monthly: 2.99, yearly: 2.49, btnText: 'Add to cart', btnUrl: '/register', features: ['100 Websites', '100GB SSD', 'Unlimited Bandwidth', 'Free SSL', 'Free Domain ($9.99 value)', 'Weekly Backups'], popular: true, badge: '+ 3 Months Free' },
    { name: 'Business', monthly: 3.99, yearly: 2.99, btnText: 'Add to cart', btnUrl: '/register', features: ['100 Websites', '200GB NVMe SSD', 'Unlimited Bandwidth', 'Free SSL', 'Free Domain', 'Daily Backups', 'CDN Included'], popular: false, badge: '' },
  ],
  reseller: [
    { name: 'Reseller Lite', monthly: 19.99, yearly: 14.99, btnText: 'Add to cart', btnUrl: '/register', features: ['20 cPanel Accounts', '40GB SSD', 'White Label', 'Free WHMCS', 'Private Nameservers'], popular: false, badge: '' },
    { name: 'Reseller Pro', monthly: 39.99, yearly: 29.99, btnText: 'Add to cart', btnUrl: '/register', features: ['50 cPanel Accounts', '100GB SSD', 'White Label', 'Free Billing Software', 'Priority Support'], popular: true, badge: '' },
  ],
  allFeatures: DEFAULT_ALL_FEATURES,
};

const PlanBtn: React.FC<{ url: string; text: string; popular: boolean }> = ({ url, text, popular }) => {
  const cls = `block w-full py-3.5 rounded-2xl font-black transition-all mb-6 text-sm text-center ${
    popular ? 'bg-primary text-white hover:bg-primary-600 shadow-xl shadow-primary/30' : 'bg-slate-900 text-white hover:bg-slate-800'
  }`;
  if (!url || url.startsWith('/')) return <Link to={url || '/register'} className={cls}>{text}</Link>;
  return <a href={url} target="_blank" rel="noopener noreferrer" className={cls}>{text}</a>;
};

const Pricing: React.FC = () => {
  const [category, setCategory] = useState<'shared' | 'reseller'>('shared');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const { content } = useContent();
  const { convert } = useCurrency();

  const pricing = content?.pricing ? {
    header: content.pricing.header || DEFAULT_PRICING.header,
    shared: content.pricing.shared || DEFAULT_PRICING.shared,
    reseller: content.pricing.reseller || DEFAULT_PRICING.reseller,
    allFeatures: content.pricing.allFeatures || DEFAULT_ALL_FEATURES,
    showReseller: content.pricing.showReseller ?? false,
  } : { ...DEFAULT_PRICING, showReseller: false };

  const showResellerTab = pricing.showReseller;
  const activeCategory = !showResellerTab && category === 'reseller' ? 'shared' : category;
  const plans = (pricing as any)[activeCategory] || [];

  const getPrice = (plan: any) => {
    if (billingCycle === 'yearly') return plan.yearly ?? plan.price ?? 0;
    return plan.monthly ?? plan.price ?? 0;
  };

  return (
    <section id="pricing" className="py-16 bg-slate-50 relative overflow-hidden">
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2 className="text-3xl lg:text-4xl font-black text-slate-900 mb-4">{pricing.header.title}</h2>
          <p className="text-base text-slate-600 font-medium">{pricing.header.subtitle}</p>

          {/* Billing toggle */}
          <div className="mt-6 inline-flex items-center gap-4">
            <span className={`text-sm font-black ${billingCycle === 'monthly' ? 'text-slate-900' : 'text-slate-400'}`}>Monthly</span>
            <button
              onClick={() => setBillingCycle(b => b === 'monthly' ? 'yearly' : 'monthly')}
              className={`w-12 h-6 rounded-full transition-all relative ${billingCycle === 'yearly' ? 'bg-primary' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${billingCycle === 'yearly' ? 'left-7' : 'left-1'}`} />
            </button>
            <span className={`text-sm font-black ${billingCycle === 'yearly' ? 'text-slate-900' : 'text-slate-400'}`}>
              Annual <span className="text-emerald-600 ml-1 text-xs">Save more</span>
            </span>
          </div>

          {showResellerTab && (
            <div className="mt-6 inline-flex p-1.5 bg-slate-200 rounded-2xl border border-slate-300 ml-4">
              <button
                onClick={() => setCategory('shared')}
                className={`px-10 py-3.5 rounded-xl font-black text-sm transition-all ${activeCategory === 'shared' ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Web Hosting
              </button>
              <button
                onClick={() => setCategory('reseller')}
                className={`px-10 py-3.5 rounded-xl font-black text-sm transition-all ${activeCategory === 'reseller' ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Reseller Hosting
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {plans.map((plan: any, i: number) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative flex flex-col p-7 rounded-[28px] border-2 transition-all duration-500 ${
                plan.popular
                  ? 'border-primary bg-white shadow-2xl shadow-primary/10 scale-105 z-10'
                  : 'border-slate-200 bg-white hover:border-primary/30'
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
                {billingCycle === 'yearly' && plan.monthly && plan.yearly && (
                  <div className="text-xs text-emerald-600 font-bold mt-1">
                    Save {Math.round((1 - plan.yearly / plan.monthly) * 100)}% vs monthly
                  </div>
                )}
                {billingCycle === 'yearly' && (
                  <div className="text-xs text-slate-400 font-medium mt-1">Billed yearly</div>
                )}
                {plan.badge && (
                  <div className="mt-4 inline-block px-3 py-1 bg-primary/10 text-primary text-[10px] font-black rounded-full uppercase tracking-widest">
                    {plan.badge}
                  </div>
                )}
              </div>

              <PlanBtn url={plan.btnUrl || '/register'} text={plan.btnText || 'Add to cart'} popular={plan.popular} />

              <div className="flex-grow">
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Top Features</div>
                <ul className="space-y-4">
                  {(plan.features || []).map((feature: string, j: number) => (
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
                {(pricing.allFeatures || DEFAULT_ALL_FEATURES).map((cat: any, i: number) => (
                  <div key={i} className="space-y-4">
                    <h4 className="text-xs font-black text-primary uppercase tracking-[0.2em]">{cat.category}</h4>
                    <div className="grid grid-cols-1 gap-3">
                      {(cat.items || []).map((item: string, j: number) => (
                        <div key={j} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
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
                <PlanBtn url={selectedPlan.btnUrl || '/register'} text={selectedPlan.btnText || 'Get Started Now'} popular={true} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default Pricing;
