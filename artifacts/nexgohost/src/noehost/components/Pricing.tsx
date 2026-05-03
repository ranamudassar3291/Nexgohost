import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, CheckCircle2, ArrowRight } from 'lucide-react';
import { useContent } from '../ContentContext';
import { useCurrency } from '../CurrencyContext';
import { Link } from 'react-router-dom';
import { usePackagesByGroup } from '../hooks/usePackages';
import OrderModal, { OrderPlan } from './OrderModal';

const DEFAULT_ALL_FEATURES = [
  { category: 'Performance', items: ['NVMe Storage', 'Object Cache', 'CDN Included', '99.9% Uptime Guarantee'] },
  { category: 'Security', items: ['Free SSL', 'DDoS Protection', 'Web Application Firewall', 'Daily Backups'] },
  { category: 'Support', items: ['24/7 Live Chat', 'Priority Support', 'Knowledge Base', 'Video Tutorials'] },
  { category: 'Tools', items: ['WordPress Staging', 'AI Website Builder', 'GIT Integration', 'SSH Access'] },
];

const DEFAULT_HEADER = {
  title: 'Choose your Web Hosting plan',
  subtitle: 'Get the best value for your money with our feature-rich plans. All plans include a 30-day money-back guarantee.',
};

const Pricing: React.FC = () => {
  const [category, setCategory] = useState<'shared' | 'reseller'>('shared');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [orderPlan, setOrderPlan] = useState<OrderPlan | null>(null);
  const { content } = useContent();
  const { convertFromPKR } = useCurrency();

  const handleOrderNow = (p: any) => {
    const raw = p._raw || p;
    setSelectedPlan(null);
    window.location.href = raw.id
      ? `/client/orders/new?plan_id=${raw.id}`
      : '/client/orders/new';
  };

  const { plans: apiShared, loading: loadingShared } = usePackagesByGroup('shared-hosting');
  const { plans: apiReseller, loading: loadingReseller } = usePackagesByGroup('reseller-hosting');

  const mapPlans = (apiPlans: typeof apiShared) =>
    apiPlans.map((p, i) => ({
      name: p.name,
      monthly: p.price,
      yearly: p.yearlyPrice ? +(p.yearlyPrice / 12).toFixed(2) : p.price,
      btnText: 'Order Now',
      btnUrl: '',
      features: [
        ...(p.diskSpace ? [`${p.diskSpace} SSD`] : []),
        ...(p.bandwidth ? [`${p.bandwidth} Bandwidth`] : []),
        'Free SSL',
        ...(p.features || []),
      ],
      popular: i === Math.min(1, apiPlans.length - 1),
      badge: '',
      _raw: p,
    }));

  const header = content?.pricing?.header || DEFAULT_HEADER;
  const allFeatures = content?.pricing?.allFeatures || DEFAULT_ALL_FEATURES;
  const showResellerTab = content?.pricing?.showReseller ?? false;

  const sharedPlans = mapPlans(apiShared);
  const resellerPlans = mapPlans(apiReseller);

  const activeCategory = !showResellerTab && category === 'reseller' ? 'shared' : category;
  const isLoading = activeCategory === 'reseller' ? loadingReseller : loadingShared;
  const plans = activeCategory === 'reseller' ? resellerPlans : sharedPlans;

  const getPrice = (plan: any) => {
    if (billingCycle === 'yearly') return plan.yearly ?? plan.price ?? 0;
    return plan.monthly ?? plan.price ?? 0;
  };

  return (
    <section id="pricing" className="py-16 bg-gray-50 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(103,61,230,0.05),transparent_60%)]" />
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2 className="text-3xl lg:text-4xl font-black text-gray-900 mb-4">{header.title}</h2>
          <p className="text-base text-gray-500 font-medium">{header.subtitle}</p>

          {/* Billing toggle */}
          <div className="mt-6 inline-flex items-center gap-4">
            <span className={`text-sm font-black ${billingCycle === 'monthly' ? 'text-gray-900' : 'text-gray-400'}`}>Monthly</span>
            <button
              onClick={() => setBillingCycle(b => b === 'monthly' ? 'yearly' : 'monthly')}
              className={`w-12 h-6 rounded-full transition-all relative ${billingCycle === 'yearly' ? 'bg-primary' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${billingCycle === 'yearly' ? 'left-7' : 'left-1'}`} />
            </button>
            <span className={`text-sm font-black ${billingCycle === 'yearly' ? 'text-gray-900' : 'text-gray-400'}`}>
              Annual <span className="text-emerald-500 ml-1 text-xs">Save more</span>
            </span>
          </div>

          {showResellerTab && (
            <div className="mt-6 inline-flex p-1.5 rounded-2xl ml-4 bg-white border border-gray-200 shadow-sm">
              <button
                onClick={() => setCategory('shared')}
                className={`px-10 py-3 rounded-xl font-black text-sm transition-all ${activeCategory === 'shared' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-gray-500 hover:text-gray-800'}`}
              >
                Web Hosting
              </button>
              <button
                onClick={() => setCategory('reseller')}
                className={`px-10 py-3 rounded-xl font-black text-sm transition-all ${activeCategory === 'reseller' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-gray-500 hover:text-gray-800'}`}
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
              className={`relative flex flex-col p-7 rounded-[28px] border-2 transition-all duration-300 bg-white ${
                plan.popular
                  ? 'border-primary scale-105 z-10 shadow-2xl shadow-primary/15'
                  : 'border-gray-100 shadow-sm hover:border-primary/30 hover:shadow-md'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-primary text-white px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/30">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-black text-gray-900 mb-3">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-primary tracking-tighter">{convertFromPKR(getPrice(plan))}</span>
                  <span className="text-gray-400 font-bold">/mo</span>
                </div>
                {billingCycle === 'yearly' && plan._raw?.yearlyPrice ? (
                  <div className="mt-1.5 space-y-0.5">
                    <div className="text-xs font-black text-emerald-500 flex items-center gap-1.5">
                      <span className="inline-block w-4 h-0.5 bg-emerald-400 rounded"></span>
                      Save {Math.round((1 - plan.yearly / plan.monthly) * 100)}% vs monthly
                    </div>
                    <div className="text-xs text-gray-400 font-semibold">
                      Billed <span className="text-gray-700 font-black">{convertFromPKR(plan._raw.yearlyPrice)}</span>/yr
                    </div>
                  </div>
                ) : billingCycle === 'yearly' && (
                  <div className="text-xs text-gray-400 font-medium mt-1">Billed yearly</div>
                )}
                {plan.badge && (
                  <div className="mt-4 inline-block px-3 py-1 bg-primary/10 text-primary text-[10px] font-black rounded-full uppercase tracking-widest">
                    {plan.badge}
                  </div>
                )}
              </div>

              <button
                onClick={() => handleOrderNow(plan)}
                className={`block w-full py-3.5 rounded-2xl font-black transition-all mb-6 text-sm text-center ${
                  plan.popular
                    ? 'bg-primary text-white hover:bg-primary-600 shadow-lg shadow-primary/25'
                    : 'bg-gray-900 text-white hover:bg-gray-700'
                }`}
              >
                {plan.btnText || 'Order Now'}
              </button>

              <div className="flex-grow">
                <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Top Features</div>
                <ul className="space-y-3">
                  {(plan.features || []).map((feature: string, j: number) => (
                    <li key={j} className="flex items-start gap-3">
                      <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm font-medium leading-tight text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 pt-5 border-t border-gray-100">
                <button
                  onClick={() => setSelectedPlan(plan)}
                  className="text-primary font-black text-sm hover:underline flex items-center gap-2"
                >
                  See all features <ArrowRight size={15} />
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
              className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              className="relative w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col bg-white"
            >
              <div className="p-7 flex items-center justify-between border-b border-gray-100">
                <div>
                  <h3 className="text-2xl font-black text-gray-900">{selectedPlan.name} Features</h3>
                  <p className="text-gray-500 font-medium text-sm mt-1">Detailed breakdown of everything included in this plan.</p>
                </div>
                <button
                  onClick={() => setSelectedPlan(null)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-7 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-7">
                {(allFeatures || DEFAULT_ALL_FEATURES).map((cat: any, i: number) => (
                  <div key={i} className="space-y-3">
                    <h4 className="text-xs font-black text-primary uppercase tracking-[0.2em]">{cat.category}</h4>
                    <div className="grid grid-cols-1 gap-2">
                      {(cat.items || []).map((item: string, j: number) => (
                        <div key={j} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                          <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-700">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-7 flex items-center justify-between border-t border-gray-100 bg-gray-50">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-primary">{convertFromPKR(getPrice(selectedPlan))}</span>
                  <span className="text-gray-400 font-bold">/mo</span>
                </div>
                <button
                  onClick={() => handleOrderNow(selectedPlan)}
                  className="py-3 px-8 rounded-2xl font-black text-sm bg-primary text-white hover:bg-primary-600 shadow-lg shadow-primary/25 transition-all"
                >
                  {selectedPlan.btnText || 'Order Now'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <OrderModal plan={orderPlan} onClose={() => setOrderPlan(null)} />
    </section>
  );
};

export default Pricing;
