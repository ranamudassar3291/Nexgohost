import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { Check, ArrowRight, Zap, Shield, RefreshCw, LifeBuoy, ChevronDown, ChevronUp, Globe, Layers, X } from 'lucide-react';
import { useContent } from '@/context/ContentContext';
import { useCurrency } from '@/context/CurrencyProvider';

const WP_DEFAULT: any = {
  hero: {
    badge: 'WP Optimised', title: 'WordPress Hosting.', titleHighlight: 'Optimised & Managed.',
    description: 'Pre-configured WordPress stacks running LiteSpeed, NVMe SSD, and Redis caching. Your site loads fast out of the box — no tuning required.',
    primaryBtn: { text: 'See Plans', url: '#wp-plans', show: true },
    secondaryBtn: { text: 'Start Free', url: '/register', show: true },
    badges: ['Auto WordPress Updates', 'Free SSL', 'Staging Environment', 'Malware Scanning'],
  },
  plans: [
    { name: 'WP Starter', desc: 'For a single WordPress site.', monthly: 4.99, yearly: 2.99, popular: false, btnText: 'Get Started', btnUrl: '/register', specs: ['1 WordPress Site', '10 GB NVMe SSD', 'Unmetered Bandwidth'], addons: [{ label: 'Staging Environment', included: false }, { label: 'Object Cache (Redis)', included: false }] },
    { name: 'WP Business', desc: 'For growing WordPress sites.', monthly: 9.99, yearly: 5.99, popular: true, btnText: 'Get Started', btnUrl: '/register', specs: ['5 WordPress Sites', '50 GB NVMe SSD', 'Unmetered Bandwidth'], addons: [{ label: 'Staging Environment', included: true }, { label: 'Object Cache (Redis)', included: true }] },
    { name: 'WP Pro', desc: 'For agencies and high-traffic sites.', monthly: 19.99, yearly: 11.99, popular: false, btnText: 'Get Started', btnUrl: '/register', specs: ['Unlimited WP Sites', '100 GB NVMe SSD', 'Unmetered Bandwidth'], addons: [{ label: 'Staging Environment', included: true }, { label: 'Object Cache (Redis)', included: true }] },
    { name: 'WP Elite', desc: 'Maximum WordPress performance.', monthly: 34.99, yearly: 19.99, popular: false, btnText: 'Get Started', btnUrl: '/register', specs: ['Unlimited WP Sites', 'Unlimited NVMe SSD', 'Priority Network'], addons: [{ label: 'Staging Environment', included: true }, { label: 'Object Cache (Redis)', included: true }] },
  ],
  plansTitle: 'Choose the Right Plan',
  plansDesc: 'All plans include auto updates, malware scanning, and free SSL.',
  features: [
    { title: 'NVMe SSD Storage', desc: 'All WordPress plans run on enterprise NVMe SSD — up to 20x faster than traditional SATA SSDs.' },
    { title: 'Managed Security', desc: 'Automatic malware scanning, a WordPress-specific WAF, and brute-force protection on every plan.' },
    { title: 'Auto Backups', desc: 'Daily automated backups stored for 30 days. Restore your entire site with a single click.' },
    { title: 'Expert WP Support', desc: 'Our support team are certified WordPress experts. Fast, knowledgeable help 24/7.' },
    { title: 'Global CDN', desc: 'Content delivered from 200+ edge locations worldwide for sub-second load times globally.' },
    { title: 'Staging Environment', desc: 'Test updates, themes, and plugins in a safe staging clone before pushing to production.' },
  ],
  featuresTitle: 'Everything Your WordPress Site Needs',
  featuresDesc: 'From caching to security — we handle the technical stack so you can focus on content.',
  ctaTitle: 'Launch Your WordPress Site Today',
  ctaDesc: 'Pre-installed WordPress, free SSL, and expert support — get online in minutes.',
  ctaBtnText: 'Start Hosting Now',
  ctaBtnUrl: '/register',
  faqs: [
    { q: 'Is WordPress pre-installed?', a: 'Yes! WordPress comes pre-installed and pre-configured on all our WordPress hosting plans.' },
    { q: 'How are WordPress sites kept secure?', a: 'We automatically apply WordPress core updates, run daily malware scans, and employ a WordPress-specific WAF.' },
    { q: 'What is a staging environment?', a: 'Staging is a private copy of your live WordPress site where you can safely test plugins and themes.' },
  ],
  faqTitle: 'WordPress Hosting FAQs',
};

const WordPressHosting: React.FC = () => {
  const { content } = useContent();
  const pgCms = content?.["pages.wordpressHosting"] || {};
  const pg = { ...WP_DEFAULT, ...pgCms };

  const hero = pg.hero || {};
  const plans = pg.plans || [];
  const features = pg.features || [];
  const faqs = pg.faqs || [];
  const { convert } = useCurrency();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [yearly, setYearly] = useState(false);

  const renderLink = (to: string, children: React.ReactNode, className: string) => {
    if (!to) return null;
    if (to.startsWith('#') || to.startsWith('http')) return <a href={to} className={className}>{children}</a>;
    return <Link to={to} className={className}>{children}</Link>;
  };

  const featIcons: any = { 'NVMe SSD Storage': <Zap size={22} />, 'Managed Security': <Shield size={22} />, 'Auto Backups': <RefreshCw size={22} />, 'Expert WP Support': <LifeBuoy size={22} />, 'Global CDN': <Globe size={22} />, 'Staging Environment': <Layers size={22} /> };

  return (
    <div className="min-h-screen bg-dark">

      {/* HERO */}
      <section className="relative bg-secondary overflow-hidden pt-36 pb-24">
        <div className="tech-grid absolute inset-0 opacity-5" />
        <div className="absolute top-0 left-0 w-[700px] h-[700px] rounded-full blur-[150px]" style={{ background: 'radial-gradient(circle, rgba(103,61,230,0.25) 0%, transparent 70%)' }} />
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-14">
            {hero.badge && (
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary-300 text-xs font-black px-4 py-2 rounded-full mb-6 uppercase tracking-widest">
                <Zap size={12} className="fill-primary-400" /> {hero.badge}
              </div>
            )}
            <h1 className="text-5xl lg:text-6xl font-black text-white leading-[1.05] tracking-tight mb-6">
              {hero.title || 'WordPress Hosting.'}<br />
              <span className="text-primary-300">{hero.titleHighlight || 'Optimised & Managed.'}</span>
            </h1>
            <p className="text-lg text-slate-400 font-medium leading-relaxed mb-8">
              {hero.description || 'Pre-optimised WordPress servers for speed, security and zero technical hassle.'}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {(hero.primaryBtn?.show !== false) && hero.primaryBtn && renderLink(hero.primaryBtn.url || '#wp-plans', <>{hero.primaryBtn.text || 'See Plans'} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>, 'px-8 py-4 bg-primary hover:bg-primary-600 text-white rounded-xl font-black text-sm transition-all shadow-xl shadow-primary/30 flex items-center gap-2 group')}
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

      {/* PLANS */}
      {plans.length > 0 && (
        <section id="wp-plans" className="py-20 bg-dark">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary-300 text-xs font-black px-4 py-2 rounded-full mb-4 uppercase tracking-widest">Managed WordPress Plans</div>
              <h2 className="text-4xl font-black text-white mb-3">{pg.plansTitle || 'Choose the Right Plan'}</h2>
              <p className="text-slate-400 font-medium mb-6">{pg.plansDesc || 'All plans include auto updates, malware scanning, and free SSL.'}</p>
              <div className="flex items-center justify-center gap-4">
                <span className={`text-sm font-black ${!yearly ? 'text-white' : 'text-slate-500'}`}>Monthly</span>
                <button onClick={() => setYearly(y => !y)} className={`w-12 h-6 rounded-full transition-all relative ${yearly ? 'bg-primary' : 'bg-white/10'}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${yearly ? 'left-7' : 'left-1'}`} />
                </button>
                <span className={`text-sm font-black ${yearly ? 'text-white' : 'text-slate-500'}`}>Annual <span className="text-emerald-400 ml-1">Save 40%</span></span>
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

      {/* FEATURES */}
      {features.length > 0 && (
        <section className="py-20 bg-white">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-black px-4 py-2 rounded-full mb-4 uppercase tracking-widest">WordPress Ready</div>
              <h2 className="text-4xl font-black text-slate-900 mb-3">{pg.featuresTitle || 'Everything Your WordPress Site Needs'}</h2>
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

      {/* CTA */}
      {pg.ctaTitle && (
        <section className="py-20 bg-primary relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
          <div className="container mx-auto px-6 text-center relative z-10">
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-4xl font-black text-white mb-4">{pg.ctaTitle}</h2>
              <p className="text-primary-200 font-medium leading-relaxed mb-8 text-lg max-w-xl mx-auto">{pg.ctaDesc}</p>
              {renderLink(pg.ctaBtnUrl || '/register', <>{pg.ctaBtnText || 'Start Hosting'} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>, 'inline-flex items-center gap-2 px-8 py-4 bg-white text-primary hover:bg-primary-50 rounded-xl font-black text-sm transition-all group shadow-xl shadow-black/20')}
            </motion.div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {faqs.length > 0 && (
        <section className="py-20 bg-dark">
          <div className="container mx-auto px-6 max-w-3xl">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary-300 text-xs font-black px-4 py-2 rounded-full mb-4 uppercase tracking-widest">FAQ</div>
              <h2 className="text-4xl font-black text-white mb-3">{pg.faqTitle || 'Questions? We Have Answers.'}</h2>
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
    </div>
  );
};

export default WordPressHosting;
