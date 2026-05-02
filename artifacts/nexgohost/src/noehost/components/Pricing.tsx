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
  const [orderPlan, setOrderPlan] = useState<OrderPlan | null>(null);
  const { content } = useContent();
  const { convertFromPKR } = useCurrency();

  const handleOrderNow = (p: any) => {
    const raw = p._raw || p;
    if (!raw.id) {
      window.location.href = '/client/order';
      return;
    }
    setSelectedPlan(null);
    setOrderPlan({
      id: raw.id,
      name: raw.name || p.name,
      description: raw.description || '',
      monthlyPrice: Number(raw.price || p.monthly || 0),
      yearlyPrice: raw.yearlyPrice != null ? Number(raw.yearlyPrice) : null,
      quarterlyPrice: raw.quarterlyPrice != null ? Number(raw.quarterlyPrice) : null,
      semiannualPrice: raw.semiannualPrice != null ? Number(raw.semiannualPrice) : null,
      type: 'hosting',
      features: p.features || [],
      defaultCycle: billingCycle,
    });
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
    <section id="pricing" className="py-16 relative overflow-hidden" style={{ backgroundColor: '#050505' }}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(103,61,230,0.12),transparent_70%)]" />
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2 className="text-3xl lg:text-4xl font-black text-white mb-4">{header.title}</h2>
          <p className="text-base text-slate-400 font-medium">{header.subtitle}</p>

          {/* Billing toggle */}
          <div className="mt-6 inline-flex items-center gap-4">
            <span className={`text-sm font-black ${billingCycle === 'monthly' ? 'text-white' : 'text-slate-500'}`}>Monthly</span>
            <button
              onClick={() => setBillingCycle(b => b === 'monthly' ? 'yearly' : 'monthly')}
              className={`w-12 h-6 rounded-full transition-all relative ${billingCycle === 'yearly' ? 'bg-primary' : 'bg-white/20'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${billingCycle === 'yearly' ? 'left-7' : 'left-1'}`} />
            </button>
            <span className={`text-sm font-black ${billingCycle === 'yearly' ? 'text-white' : 'text-slate-500'}`}>
              Annual <span className="text-emerald-400 ml-1 text-xs">Save more</span>
            </span>
          </div>

          {showResellerTab && (
            <div className="mt-6 inline-flex p-1.5 rounded-2xl ml-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(103,61,230,0.3)' }}>
              <button
                onClick={() => setCategory('shared')}
                className={`px-10 py-3.5 rounded-xl font-black text-sm transition-all ${activeCategory === 'shared' ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-slate-400 hover:text-white'}`}
              >
                Web Hosting
              </button>
              <button
                onClick={() => setCategory('reseller')}
                className={`px-10 py-3.5 rounded-xl font-black text-sm transition-all ${activeCategory === 'reseller' ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-slate-400 hover:text-white'}`}
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
                  ? 'border-primary scale-105 z-10 shadow-2xl shadow-primary/20'
                  : 'hover:border-primary/40'
              }`}
              style={{
                background: plan.popular
                  ? 'linear-gradient(135deg, #1a0d3e 0%, #0e0e11 100%)'
                  : '#0e0e11',
                borderColor: plan.popular ? '#673de6' : 'rgba(103,61,230,0.2)',
              }}
            >
              {plan.popular && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-primary text-white px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/30">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-black text-white mb-3">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-primary tracking-tighter">{convertFromPKR(getPrice(plan))}</span>
                  <span className="text-slate-400 font-bold">/mo</span>
                </div>
                {billingCycle === 'yearly' && plan._raw?.yearlyPrice ? (
                  <div className="mt-1.5 space-y-0.5">
                    <div className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                      <span className="inline-block w-4 h-0.5 bg-emerald-400 rounded"></span>
                      Save {Math.round((1 - plan.yearly / plan.monthly) * 100)}% vs monthly
                    </div>
                    <div className="text-xs text-slate-500 font-semibold">
                      Billed <span className="text-slate-300 font-black">{convertFromPKR(plan._raw.yearlyPrice)}</span>/yr
                    </div>
                  </div>
                ) : billingCycle === 'yearly' && (
                  <div className="text-xs text-slate-500 font-medium mt-1">Billed yearly</div>
                )}
                {plan.badge && (
                  <div className="mt-4 inline-block px-3 py-1 bg-primary/10 text-primary text-[10px] font-black rounded-full uppercase tracking-widest">
                    {plan.badge}
                  </div>
                )}
              </div>

              <button onClick={() => handleOrderNow(plan)} className={`block w-full py-3.5 rounded-2xl font-black transition-all mb-6 text-sm text-center ${plan.popular ? 'bg-primary text-white hover:bg-primary-600 shadow-xl shadow-primary/30' : 'text-white hover:bg-primary/10'}`} style={!plan.popular ? { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(103,61,230,0.3)' } : {}}>{plan.btnText || 'Order Now'}</button>

              <div className="flex-grow">
                <div className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6">Top Features</div>
                <ul className="space-y-4">
                  {(plan.features || []).map((feature: string, j: number) => (
                    <li key={j} className="flex items-start gap-3">
                      <CheckCircle2 size={18} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm font-bold leading-tight text-slate-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
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
              className="relative w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            style={{ background: '#0e0e11', border: '1px solid rgba(103,61,230,0.3)' }}
            >
              <div className="p-8 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#111115' }}>
                <div>
                  <h3 className="text-2xl font-black text-white">{selectedPlan.name} Features</h3>
                  <p className="text-slate-400 font-medium">Detailed breakdown of everything included in this plan.</p>
                </div>
                <button
                  onClick={() => setSelectedPlan(null)}
                  className="w-12 h-12 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-all"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                {(allFeatures || DEFAULT_ALL_FEATURES).map((cat: any, i: number) => (
                  <div key={i} className="space-y-4">
                    <h4 className="text-xs font-black text-primary uppercase tracking-[0.2em]">{cat.category}</h4>
                    <div className="grid grid-cols-1 gap-3">
                      {(cat.items || []).map((item: string, j: number) => (
                        <div key={j} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
                          <span className="text-sm font-bold text-slate-300">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-8 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#111115' }}>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-primary">{convertFromPKR(getPrice(selectedPlan))}</span>
                  <span className="text-slate-400 font-bold">/mo</span>
                </div>
                <button onClick={() => handleOrderNow(selectedPlan)} className="block py-3.5 px-8 rounded-2xl font-black transition-all text-sm text-center bg-primary text-white hover:bg-primary-600 shadow-xl shadow-primary/30">{selectedPlan.btnText || 'Order Now'}</button>
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
