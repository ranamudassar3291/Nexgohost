import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { Check, ArrowRight, Users, Shield, Globe, Zap, DollarSign, ChevronDown, ChevronUp, X, Package, TrendingUp } from 'lucide-react';
import { useContent } from '@/context/ContentContext';
import { useCurrency } from '@/context/CurrencyProvider';

const RS_DEFAULT: any = {
  hero: {
    badge: 'Business Ready', title: 'Reseller Hosting.', titleHighlight: 'Build Your Business.',
    description: 'Start your own hosting company using our enterprise infrastructure. White-label branding, WHM control panel, and automated billing included.',
    primaryBtn: { text: 'View Plans', url: '#rs-plans', show: true },
    secondaryBtn: { text: 'Start Free', url: '/register', show: true },
    badges: ['White-Label Branding', 'WHM Included', 'Free Private Nameservers', 'WHMCS-Ready'],
  },
  steps: [
    { title: 'Purchase a Plan', desc: 'Choose a reseller plan that fits the number of clients you plan to host.' },
    { title: 'Set Your Brand', desc: 'Apply your logo, company name, and custom nameservers. Clients never see Noehost.' },
    { title: 'Create Client Accounts', desc: 'Use WHM to provision cPanel accounts for your clients and set resource limits.' },
  ],
  stepsTitle: 'Start Your Hosting Business in 3 Steps',
  stepsDesc: 'Go from zero to running your own hosting brand in under an hour.',
  plans: [
    { name: 'Reseller Lite', desc: 'For freelancers with a small client base.', monthly: 19.99, yearly: 13.99, popular: false, btnText: 'Get Started', btnUrl: '/register',
      specs: ['20 cPanel Accounts', '40 GB NVMe SSD Storage', '400 GB Monthly Bandwidth', 'Free SSL for All Clients', 'WHM Control Panel Included', 'cPanel for Each Client', 'White-Label Branding', 'Free Private Nameservers', 'Email Hosting for Clients', '24/7 Support Included'],
      addons: [{ label: 'WHMCS License', included: false }, { label: 'Dedicated IP Address', included: false }] },
    { name: 'Reseller Pro', desc: 'For growing agencies.', monthly: 39.99, yearly: 27.99, popular: true, btnText: 'Get Started', btnUrl: '/register',
      specs: ['50 cPanel Accounts', '100 GB NVMe SSD Storage', '1 TB Monthly Bandwidth', 'Free SSL for All Clients', 'WHM Control Panel Included', 'cPanel for Each Client', 'White-Label Branding', 'Free Private Nameservers', 'Email Hosting for Clients', 'Priority 24/7 Support'],
      addons: [{ label: 'WHMCS License', included: true }, { label: 'Dedicated IP Address', included: true }] },
    { name: 'Reseller Elite', desc: 'For established hosting businesses.', monthly: 59.99, yearly: 41.99, popular: false, btnText: 'Get Started', btnUrl: '/register',
      specs: ['100 cPanel Accounts', '200 GB NVMe SSD Storage', '2 TB Monthly Bandwidth', 'Free SSL for All Clients', 'WHM Control Panel Included', 'cPanel for Each Client', 'White-Label Branding', 'Free Private Nameservers', 'Email Hosting for Clients', 'VIP Priority Support'],
      addons: [{ label: 'WHMCS License', included: true }, { label: 'Dedicated IP Address', included: true }] },
    { name: 'Reseller Ultimate', desc: 'Unlimited accounts, unlimited growth.', monthly: 99.99, yearly: 69.99, popular: false, btnText: 'Get Started', btnUrl: '/register',
      specs: ['Unlimited cPanel Accounts', '500 GB NVMe SSD Storage', 'Unmetered Bandwidth', 'Free SSL for All Clients', 'WHM Control Panel Included', 'cPanel for Each Client', 'White-Label Branding', 'Free Private Nameservers', 'Email Hosting for Clients', 'Dedicated Account Manager'],
      addons: [{ label: 'WHMCS License', included: true }, { label: 'Dedicated IP Address', included: true }] },
  ],
  plansTitle: 'Reseller Hosting Plans',
  plansDesc: 'All plans include WHM, white-label branding and 24/7 support.',
  features: [
    { title: 'WHM Control Panel', desc: 'Web Host Manager gives you full control over all client cPanel accounts from one dashboard.' },
    { title: 'White Label Branding', desc: 'Your logo, your nameservers, your brand. Clients never see Noehost anywhere in the interface.' },
    { title: 'Free SSL for Clients', desc: 'AutoSSL automatically provisions and renews SSL certificates for every client domain you add.' },
    { title: 'Unlimited Sub-Accounts', desc: 'Create as many cPanel accounts as your plan allows with granular resource allocation per account.' },
    { title: 'Automated Billing', desc: 'Integrate with WHMCS to automate invoicing, payments, and account provisioning for your clients.' },
    { title: 'Global Network', desc: 'Your clients benefit from our global CDN and low-latency network without any extra configuration.' },
  ],
  featuresTitle: 'Everything You Need to Resell',
  featuresDesc: 'Our reseller platform is built for entrepreneurs who want to start a hosting business fast.',
  faqs: [
    { q: 'Do my clients see Noehost branding?', a: 'No. Our reseller plans are fully white-label. Clients only see your brand.' },
    { q: 'What is WHM?', a: 'Web Host Manager (WHM) lets you manage all your client hosting accounts, set resource limits, and monitor server usage.' },
    { q: 'Can I set my own pricing?', a: 'Absolutely. You buy resources from us at wholesale prices and set your own retail pricing to your clients.' },
  ],
  faqTitle: 'Reseller Hosting FAQs',
  ctaTitle: 'Ready to Start Your Hosting Business?',
  ctaDesc: 'Join hundreds of entrepreneurs who built their hosting brand on Noehost infrastructure.',
  ctaBtnText: 'Start Reselling Today',
  ctaBtnUrl: '/register',
};

const ResellerHosting: React.FC = () => {
  const { content } = useContent();
  const pgCms = content?.["pages.resellerHosting"] || {};
  const pg = { ...RS_DEFAULT, ...pgCms };

  const hero = pg.hero || {};
  const plans = pg.plans || [];
  const features = pg.features || [];
  const faqs = pg.faqs || [];
  const { convert } = useCurrency();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [yearly, setYearly] = useState(false);
  const [clients, setClients] = useState(20);
  const [avgPrice, setAvgPrice] = useState(15);

  const renderLink = (to: string, children: React.ReactNode, className: string) => {
    if (!to) return null;
    if (to.startsWith('#') || to.startsWith('http')) return <a href={to} className={className}>{children}</a>;
    return <Link to={to} className={className}>{children}</Link>;
  };

  const featIcons: any = {
    'WHM Control Panel': <Package size={22} />,
    'White Label Branding': <Shield size={22} />,
    'Free SSL for Clients': <Shield size={22} />,
    'Unlimited Sub-Accounts': <Users size={22} />,
    'Automated Billing': <DollarSign size={22} />,
    'Global Network': <Globe size={22} />,
  };

  return (
    <div className="noehost-public min-h-screen bg-dark">

      {/* HERO */}
      <section className="relative bg-secondary overflow-hidden pt-36 pb-24">
        <div className="tech-grid absolute inset-0 opacity-5" />
        <div className="absolute top-0 left-0 w-[700px] h-[700px] rounded-full blur-[150px]" style={{ background: 'radial-gradient(circle, rgba(103,61,230,0.25) 0%, transparent 70%)' }} />
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            {hero.badge && (
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary-300 text-xs font-black px-4 py-2 rounded-full mb-6 uppercase tracking-widest">
                <Users size={12} /> {hero.badge}
              </div>
            )}
            <h1 className="text-5xl lg:text-6xl font-black text-white leading-[1.05] tracking-tight mb-6">
              {hero.title || 'Reseller Hosting.'}<br />
              <span className="text-primary-300">{hero.titleHighlight || 'Build Your Business.'}</span>
            </h1>
            <p className="text-lg text-slate-400 font-medium leading-relaxed mb-8">
              {hero.description || 'Start your own hosting company with our white-label reseller plans.'}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {(hero.primaryBtn?.show !== false) && hero.primaryBtn && renderLink(hero.primaryBtn.url || '#rs-plans', <>{hero.primaryBtn.text || 'View Plans'} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>, 'px-8 py-4 bg-primary hover:bg-primary-600 text-white rounded-xl font-black text-sm transition-all shadow-xl shadow-primary/30 flex items-center gap-2 group')}
              {(hero.secondaryBtn?.show !== false) && hero.secondaryBtn && renderLink(hero.secondaryBtn.url || '/register', hero.secondaryBtn.text || 'Start Free', 'px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black text-sm transition-all border border-white/10')}
            </div>
            {(hero.badges || []).length > 0 && (
              <div className="flex flex-wrap justify-center gap-6 mt-8">
                {hero.badges.map((f: string) => <span key={f} className="flex items-center gap-2 text-xs text-slate-400 font-bold"><Check size={14} className="text-primary-400" /> {f}</span>)}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      {(pg.steps || []).length > 0 && (
        <section className="py-16 bg-primary">
          <div className="container mx-auto px-6">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-black text-white mb-2">{pg.stepsTitle || 'How Reseller Hosting Works'}</h2>
              <p className="text-primary-200 font-medium">{pg.stepsDesc || ''}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {pg.steps.map((step: any, i: number) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="text-center">
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-black text-white">{i + 1}</div>
                  <h3 className="text-base font-black text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-primary-200 font-medium leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PLANS */}
      {plans.length > 0 && (
        <section id="rs-plans" className="py-20 bg-dark">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary-300 text-xs font-black px-4 py-2 rounded-full mb-4 uppercase tracking-widest">Reseller Plans</div>
              <h2 className="text-4xl font-black text-white mb-3">{pg.plansTitle || 'Reseller Hosting Plans'}</h2>
              <p className="text-slate-400 font-medium mb-6">{pg.plansDesc || 'All plans include WHM, white-label branding and 24/7 support.'}</p>
              <div className="flex items-center justify-center gap-4">
                <span className={`text-sm font-black ${!yearly ? 'text-white' : 'text-slate-500'}`}>Monthly</span>
                <button onClick={() => setYearly(y => !y)} className={`w-12 h-6 rounded-full transition-all relative ${yearly ? 'bg-primary' : 'bg-white/10'}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${yearly ? 'left-7' : 'left-1'}`} />
                </button>
                <span className={`text-sm font-black ${yearly ? 'text-white' : 'text-slate-500'}`}>Annual <span className="text-emerald-400 ml-1">Save 30%</span></span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {plans.map((plan: any, i: number) => (
                <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className={`relative flex flex-col rounded-2xl overflow-hidden transition-all ${plan.popular ? 'border-2 border-primary shadow-2xl shadow-primary/30 bg-white/5' : 'border border-white/10 bg-white/5 hover:border-primary/30'}`}>
                  {plan.popular && <div className="absolute top-4 right-4 px-3 py-1 bg-primary rounded-full text-[10px] font-black text-white uppercase tracking-widest">Popular</div>}
                  <div className="p-6 border-b border-white/10">
                    <div className="text-xs font-black text-primary-300 uppercase tracking-widest mb-2">{plan.name}</div>
                    <p className="text-xs text-slate-400 font-medium mb-4 leading-snug">{plan.desc}</p>
                    <div className="mb-4">
                      <span className="text-3xl font-black text-white">{convert(yearly ? plan.yearly : plan.monthly)}</span>
                      <span className="text-slate-500 text-sm">/mo</span>
                      {yearly && <div className="text-xs text-emerald-400 font-bold mt-1">Billed yearly</div>}
                    </div>
                    {renderLink(plan.btnUrl || '/register', plan.btnText || 'Get Started', `block text-center py-2.5 rounded-xl font-black text-sm transition-all ${plan.popular ? 'bg-primary hover:bg-primary-600 text-white shadow-lg shadow-primary/30' : 'bg-transparent hover:bg-white/5 text-white border border-white/20 hover:border-primary/40'}`)}
                  </div>
                  <div className="p-5 flex flex-col gap-2 flex-1">
                    {(plan.specs || []).map((spec: string, j: number) => (
                      <div key={j} className="text-xs text-slate-300 font-medium flex items-center gap-2">
                        <Check size={12} className="text-primary-400 flex-shrink-0" /> {spec}
                      </div>
                    ))}
                    {(plan.addons || []).map((addon: any, j: number) => (
                      <div key={j} className="text-xs font-medium flex items-center gap-2">
                        {addon.included ? <Check size={12} className="text-emerald-400 flex-shrink-0" /> : <X size={12} className="text-red-400 flex-shrink-0" />}
                        <span className={addon.included ? 'text-slate-300' : 'text-slate-500'}>{addon.label}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PROFIT CALCULATOR */}
      <section className="py-20 bg-dark relative overflow-hidden">
        <div className="tech-grid absolute inset-0 opacity-5" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[140px]" style={{ background: 'radial-gradient(circle, rgba(103,61,230,0.2) 0%, transparent 70%)' }} />
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary-300 text-xs font-black px-4 py-2 rounded-full mb-4 uppercase tracking-widest">
              <TrendingUp size={12} /> Profit Calculator
            </div>
            <h2 className="text-4xl font-black text-white mb-3">See How Much You Can Earn</h2>
            <p className="text-slate-400 font-medium">Adjust the sliders to calculate your monthly earnings as a Noehost reseller.</p>
          </div>
          <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-8">
              <div>
                <div className="flex justify-between mb-3">
                  <label className="text-sm font-black text-white">Number of Clients</label>
                  <span className="text-primary-300 font-black text-sm">{clients} clients</span>
                </div>
                <input type="range" min={1} max={200} value={clients} onChange={e => setClients(Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary" />
                <div className="flex justify-between text-xs text-slate-600 mt-1"><span>1</span><span>200</span></div>
              </div>
              <div>
                <div className="flex justify-between mb-3">
                  <label className="text-sm font-black text-white">Average Price per Client</label>
                  <span className="text-primary-300 font-black text-sm">{convert(avgPrice)}/mo</span>
                </div>
                <input type="range" min={5} max={100} value={avgPrice} onChange={e => setAvgPrice(Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary" />
                <div className="flex justify-between text-xs text-slate-600 mt-1"><span>{convert(5)}</span><span>{convert(100)}</span></div>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
              <div className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Your Monthly Revenue</div>
              <div className="text-5xl font-black text-white mb-1">{convert(clients * avgPrice)}</div>
              <div className="text-xs text-slate-500 font-medium mb-6">from {clients} client{clients !== 1 ? 's' : ''} at {convert(avgPrice)}/mo each</div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                  <div className="text-xs text-slate-500 font-bold mb-1">Your Plan Cost</div>
                  <div className="text-xl font-black text-slate-300">{convert(39.99)}<span className="text-xs text-slate-500">/mo</span></div>
                </div>
                <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
                  <div className="text-xs text-emerald-400 font-bold mb-1">Est. Profit</div>
                  <div className="text-xl font-black text-emerald-400">{convert(clients * avgPrice - 39.99)}<span className="text-xs text-emerald-500">/mo</span></div>
                </div>
              </div>
              {renderLink('/register', <>Start Earning Now <ArrowRight size={16} /></>, 'inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-600 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-primary/30 group')}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      {features.length > 0 && (
        <section className="py-20 bg-white">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-black px-4 py-2 rounded-full mb-4 uppercase tracking-widest">Platform Features</div>
              <h2 className="text-4xl font-black text-slate-900 mb-3">{pg.featuresTitle || 'Everything You Need to Resell'}</h2>
              <p className="text-slate-500 font-medium max-w-xl mx-auto">{pg.featuresDesc || ''}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.map((f: any, i: number) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} whileHover={{ y: -5 }}
                  className="p-6 bg-white rounded-2xl border border-slate-200 hover:border-primary/40 shadow-sm hover:shadow-md transition-all group">
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-all">
                    {featIcons[f.title] || <Zap size={22} />}
                  </div>
                  <h3 className="text-base font-black text-slate-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {faqs.length > 0 && (
        <section className="py-20 bg-dark">
          <div className="container mx-auto px-6 max-w-3xl">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary-300 text-xs font-black px-4 py-2 rounded-full mb-4 uppercase tracking-widest">FAQ</div>
              <h2 className="text-4xl font-black text-white mb-3">{pg.faqTitle || 'Reseller Hosting FAQs'}</h2>
            </div>
            <div className="space-y-3">
              {faqs.map((faq: any, i: number) => (
                <div key={i} className="border border-white/10 rounded-xl overflow-hidden bg-white/5">
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors">
                    <span className="text-sm font-black text-white pr-3">{faq.q}</span>
                    {openFaq === i ? <ChevronUp size={16} className="text-primary-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-slate-500 flex-shrink-0" />}
                  </button>
                  {openFaq === i && <div className="px-5 pb-4 pt-2 text-sm text-slate-400 font-medium leading-relaxed border-t border-white/5">{faq.a}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      {pg.ctaTitle && (
        <section className="py-20 bg-primary relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
          <div className="container mx-auto px-6 text-center relative z-10">
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-4xl font-black text-white mb-4">{pg.ctaTitle}</h2>
              <p className="text-primary-200 font-medium leading-relaxed mb-8 text-lg max-w-xl mx-auto">{pg.ctaDesc}</p>
              {renderLink(pg.ctaBtnUrl || '/register', <>{pg.ctaBtnText || 'Start Reselling'} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>, 'inline-flex items-center gap-2 px-8 py-4 bg-white text-primary hover:bg-primary-50 rounded-xl font-black text-sm transition-all group shadow-xl shadow-black/20')}
            </motion.div>
          </div>
        </section>
      )}
    </div>
  );
};

export default ResellerHosting;
