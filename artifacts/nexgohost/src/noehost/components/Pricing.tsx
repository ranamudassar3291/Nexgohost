import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, CheckCircle2, ArrowRight, Mail } from 'lucide-react';
import { useContent } from '../ContentContext';
import { useCurrency } from '../CurrencyContext';
import { Link } from 'react-router-dom';
import { usePackagesByGroup, useEmailPackages, EmailPlan } from '../hooks/usePackages';
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

function buildEmailFeatures(plan: EmailPlan): string[] {
  const mb = plan.max_mailboxes >= 999 ? 'Unlimited mailboxes' : `${plan.max_mailboxes} mailbox${plan.max_mailboxes > 1 ? 'es' : ''}`;
  const base = [
    mb,
    `${plan.max_storage_gb} GB storage per mailbox`,
    'Custom domain email',
    'Webmail access',
    'iOS & Android apps',
    'Spam & virus protection',
    'SSL encryption',
    '24/7 support',
  ];
  if (plan.max_mailboxes >= 5) base.push('Email aliases', 'Auto-responder', 'Email forwarding');
  if (plan.max_mailboxes >= 20 || plan.max_mailboxes >= 999) base.push('Dedicated support manager', 'Catch-all email');
  return base;
}

const Pricing: React.FC = () => {
  const [category, setCategory] = useState<'shared' | 'reseller' | 'email'>('shared');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [orderPlan, setOrderPlan] = useState<OrderPlan | null>(null);
  const { content } = useContent();
  const { convertFromPKR } = useCurrency();

  const handleOrderNow = (p: any) => {
    const raw = p._raw || p;
    setSelectedPlan(null);
    if (raw.id) {
      window.location.href = `/cart/add/${raw.id}`;
    } else {
      window.location.href = '/';
    }
  };

  const { plans: apiShared, loading: loadingShared } = usePackagesByGroup('shared-hosting');
  const { plans: apiReseller, loading: loadingReseller } = usePackagesByGroup('reseller-hosting');
  const { plans: apiEmail, loading: loadingEmail } = useEmailPackages();

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
      _isEmail: false,
    }));

  const mapEmailPlans = (emailPlans: EmailPlan[]) =>
    emailPlans.map((p) => ({
      name: p.name,
      monthly: p.price,
      yearly: p.yearly_price ? +(p.yearly_price / 12).toFixed(2) : p.price,
      btnText: 'Get Started',
      btnUrl: '',
      features: buildEmailFeatures(p),
      popular: p.is_popular,
      badge: '',
      _raw: p,
      _isEmail: true,
    }));

  const header = content?.pricing?.header || DEFAULT_HEADER;
  const allFeatures = content?.pricing?.allFeatures || DEFAULT_ALL_FEATURES;
  const showResellerTab = content?.pricing?.showReseller ?? false;

  const sharedPlans = mapPlans(apiShared);
  const resellerPlans = mapPlans(apiReseller);
  const emailPlans = mapEmailPlans(apiEmail);

  const activeCategory =
    category === 'email' ? 'email' :
    !showResellerTab && category === 'reseller' ? 'shared' : category;

  const isLoading =
    activeCategory === 'email' ? loadingEmail :
    activeCategory === 'reseller' ? loadingReseller : loadingShared;

  const plans =
    activeCategory === 'email' ? emailPlans :
    activeCategory === 'reseller' ? resellerPlans : sharedPlans;

  const getPrice = (plan: any) => {
    if (billingCycle === 'yearly') return plan.yearly ?? plan.price ?? 0;
    return plan.monthly ?? plan.price ?? 0;
  };

  const emailAllFeatures = [
    { category: 'Mailbox', items: ['Custom domain email', 'Webmail access', 'iOS & Android apps', 'IMAP / SMTP / POP3'] },
    { category: 'Security', items: ['Spam & virus filtering', 'SSL/TLS encryption', 'Two-factor authentication', 'Daily backups'] },
    { category: 'Productivity', items: ['Email aliases', 'Auto-responder', 'Email forwarding', 'Catch-all address'] },
    { category: 'Support', items: ['24/7 live chat', 'Guided DNS setup', 'Email migration help', 'Knowledge base'] },
  ];

  return (
    <section id="pricing" className="py-16 bg-[#050612] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(103,61,230,0.12),transparent_60%)]" />
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2 className="text-3xl lg:text-4xl font-black text-white mb-4">{header.title}</h2>
          <p className="text-base text-slate-400 font-medium">{header.subtitle}</p>

          {/* Billing toggle — hidden for email (shows monthly & yearly via plan card) */}
          {activeCategory !== 'email' && (
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
          )}

          {/* Category tabs */}
          <div className="mt-6 inline-flex p-1.5 rounded-2xl bg-white/10 border border-white/10 shadow-sm">
            <button
              onClick={() => setCategory('shared')}
              className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all ${activeCategory === 'shared' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-slate-400 hover:text-white'}`}
            >
              Web Hosting
            </button>
            {showResellerTab && (
              <button
                onClick={() => setCategory('reseller')}
                className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all ${activeCategory === 'reseller' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-slate-400 hover:text-white'}`}
              >
                Reseller
              </button>
            )}
            <button
              onClick={() => setCategory('email')}
              className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-1.5 ${activeCategory === 'email' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' : 'text-slate-400 hover:text-white'}`}
            >
              <Mail size={14} />
              Business Email
            </button>
          </div>

          {/* Email tab subtitle */}
          {activeCategory === 'email' && (
            <p className="mt-4 text-sm text-emerald-400 font-medium">
              Professional email with your custom domain — starting from day one.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto mt-4">
          {isLoading && [0, 1, 2].map((i) => (
            <div key={`sk-${i}`} className="relative flex flex-col p-6 rounded-2xl border border-slate-200 bg-white animate-pulse">
              <div className="h-6 bg-slate-200 rounded-lg w-2/3 mb-4" />
              <div className="h-10 bg-slate-200 rounded-lg w-1/2 mb-2" />
              <div className="h-4 bg-slate-100 rounded w-3/4 mb-6" />
              <div className="h-12 bg-slate-200 rounded-2xl mb-6" />
              <div className="space-y-3">
                {[1,2,3,4].map(j => <div key={j} className="h-4 bg-slate-100 rounded w-full" />)}
              </div>
            </div>
          ))}
          {!isLoading && plans.map((plan: any, i: number) => (
            <motion.div
              key={plan.name || i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              whileHover={{ y: -4 }}
              className={`relative flex flex-col p-6 rounded-2xl border transition-all duration-300 ${
                plan.popular
                  ? plan._isEmail
                    ? 'border-emerald-500/60 z-10 shadow-2xl shadow-emerald-500/20 bg-white mt-0'
                    : 'border-primary/60 z-10 shadow-2xl shadow-primary/20 bg-white mt-0'
                  : 'border-slate-200 bg-white hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10'
              }`}
            >
              {plan.popular && (
                <div className={`absolute -top-4 left-1/2 -translate-x-1/2 text-white px-5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl whitespace-nowrap ${plan._isEmail ? 'bg-emerald-500 shadow-emerald-500/30' : 'bg-primary shadow-primary/30'}`}>
                  Most Popular
                </div>
              )}

              {plan._isEmail && (
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Mail size={15} className="text-emerald-500" />
                  </div>
                  <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">Business Email</span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-black text-slate-900 mb-3">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className={`text-4xl font-black tracking-tighter ${plan._isEmail ? 'text-emerald-600' : 'text-primary'}`}>
                    {convertFromPKR(getPrice(plan))}
                  </span>
                  <span className="text-slate-500 font-bold">/mo</span>
                </div>
                {billingCycle === 'yearly' && plan._raw?.yearlyPrice ? (
                  <div className="mt-1.5 space-y-0.5">
                    <div className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                      <span className="inline-block w-4 h-0.5 bg-emerald-400 rounded"></span>
                      Save {Math.round((1 - plan.yearly / plan.monthly) * 100)}% vs monthly
                    </div>
                    <div className="text-xs text-slate-500 font-semibold">
                      Billed <span className="text-slate-900 font-black">{convertFromPKR(plan._raw.yearlyPrice)}</span>/yr
                    </div>
                  </div>
                ) : plan._isEmail && plan._raw?.yearly_price ? (
                  <div className="mt-1.5 text-xs text-slate-500 font-semibold">
                    Billed yearly: <span className="text-slate-900 font-black">{convertFromPKR(plan._raw.yearly_price)}</span>/yr
                  </div>
                ) : billingCycle === 'yearly' && (
                  <div className="text-xs text-slate-500 font-medium mt-1">Billed yearly</div>
                )}
              </div>

              <button
                onClick={() => handleOrderNow(plan)}
                className={`block w-full py-3.5 rounded-2xl font-black transition-all mb-6 text-sm text-center ${
                  plan.popular
                    ? plan._isEmail
                      ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/40'
                      : 'bg-primary text-white hover:bg-primary-600 shadow-lg shadow-primary/40'
                    : 'bg-slate-100 text-slate-900 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {plan.btnText || 'Order Now'}
              </button>

              <div className="flex-grow">
                <div className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Top Features</div>
                <ul className="space-y-3">
                  {(plan.features || []).slice(0, 8).map((feature: string, j: number) => (
                    <li key={j} className="flex items-start gap-3">
                      <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm font-medium leading-tight text-slate-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-200">
                <button
                  onClick={() => setSelectedPlan(plan)}
                  className={`font-black text-sm hover:underline flex items-center gap-2 ${plan._isEmail ? 'text-emerald-600' : 'text-primary'}`}
                >
                  See all features <ArrowRight size={15} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Email tab: CTA to full page */}
        {activeCategory === 'email' && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-center mt-8"
          >
            <Link
              to="/business-email"
              className="inline-flex items-center gap-2 text-sm font-black text-emerald-400 hover:text-emerald-300 underline-offset-4 hover:underline transition-all"
            >
              <Mail size={15} />
              See full Business Email page with features & FAQ →
            </Link>
          </motion.div>
        )}
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
                {(selectedPlan._isEmail ? emailAllFeatures : (allFeatures || DEFAULT_ALL_FEATURES)).map((cat: any, i: number) => (
                  <div key={i} className="space-y-3">
                    <h4 className={`text-xs font-black uppercase tracking-[0.2em] ${selectedPlan._isEmail ? 'text-emerald-600' : 'text-primary'}`}>{cat.category}</h4>
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
                  <span className={`text-3xl font-black ${selectedPlan._isEmail ? 'text-emerald-600' : 'text-primary'}`}>
                    {convertFromPKR(getPrice(selectedPlan))}
                  </span>
                  <span className="text-gray-400 font-bold">/mo</span>
                </div>
                <button
                  onClick={() => handleOrderNow(selectedPlan)}
                  className={`py-3 px-8 rounded-2xl font-black text-sm text-white shadow-lg transition-all ${selectedPlan._isEmail ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/25' : 'bg-primary hover:bg-primary-600 shadow-primary/25'}`}
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
