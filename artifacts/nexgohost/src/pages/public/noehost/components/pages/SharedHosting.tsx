import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import {
  Server, Check, ArrowRight, Shield, Zap, Globe, Mail,
  HardDrive, LifeBuoy, ChevronDown, ChevronUp, X,
  MousePointer, UploadCloud, RefreshCw, Clock, Users, Award
} from 'lucide-react';
import { useContent } from '@/context/ContentContext';
import { useCurrency } from '@/context/CurrencyProvider';

const ICONS: Record<string, React.ReactNode> = {
  'cPanel Control Panel': <MousePointer size={24} />,
  '1-Click App Installer': <Zap size={24} />,
  'Free SSL Certificate': <Shield size={24} />,
  'Professional Email': <Mail size={24} />,
  'Daily Backups': <RefreshCw size={24} />,
  '24/7 Expert Support': <LifeBuoy size={24} />,
};
const DEFAULT_FEATURE_ICON = <Server size={24} />;

const DEFAULT: any = {
  hero: {
    badge: 'Most Popular',
    title: 'Shared Hosting',
    titleHighlight: 'Made Simple.',
    description: 'Launch your website today with blazing-fast NVMe SSD storage, free SSL, cPanel, and a one-click app installer. Perfect for personal sites, blogs, and small businesses.',
    primaryBtn: { text: 'See Plans', url: '#sh-plans', show: true },
    secondaryBtn: { text: 'Start Free Trial', url: '/register', show: true },
    badges: ['Free SSL Certificate', 'cPanel Included', '30-Day Money Back'],
  },
  stats: [
    { value: '99.9%', label: 'Uptime SLA' },
    { value: '< 1ms', label: 'Response Time' },
    { value: '2M+', label: 'Sites Hosted' },
    { value: '500K+', label: 'Happy Customers' },
  ],
  plans: [
    { name: 'Hatchling', desc: 'Perfect for a single website just getting started.', monthly: 2.75, yearly: 1.83, freeMonths: 3, savePercent: 33, popular: false, btnText: 'Explore Now', btnUrl: '/register', topFeatures: ['1 Website', '10 GB NVMe SSD Storage', 'Unmetered Bandwidth', 'FREE SSL Certificate', 'FREE Email Hosting'], additionalFeatures: [{ label: 'Free Domain Registration', included: true }, { label: 'Daily Backups', included: false }, { label: 'Dedicated IP', included: false }], suite: [], suiteName: '' },
    { name: 'Baby', desc: 'Host unlimited websites on one plan.', monthly: 4.75, yearly: 3.50, freeMonths: 3, savePercent: 26, popular: false, btnText: 'Explore Now', btnUrl: '/register', topFeatures: ['Unlimited Websites', '50 GB NVMe SSD Storage', 'Unmetered Bandwidth', 'FREE SSL Certificate', 'FREE Email Hosting'], additionalFeatures: [{ label: 'Free Domain Registration', included: true }, { label: 'Daily Backups', included: true }, { label: 'Dedicated IP', included: false }], suite: [], suiteName: '' },
    { name: 'Business', desc: 'Enhanced performance with premium features.', monthly: 8.95, yearly: 5.95, freeMonths: 3, savePercent: 34, popular: true, btnText: 'Explore Now', btnUrl: '/register', topFeatures: ['Unlimited Websites', '100 GB NVMe SSD Storage', 'Unmetered Bandwidth', 'FREE SSL Certificate', 'FREE Email Hosting'], additionalFeatures: [{ label: 'Free Domain Registration', included: true }, { label: 'Daily Backups', included: true }, { label: 'Dedicated IP', included: true }], suite: [{ label: 'Positive SSL', included: true }, { label: 'SiteLock Security', included: true }, { label: 'CodeGuard Backups', included: true, note: 'Up to 1GB' }], suiteName: 'Security Suite' },
    { name: 'Pro', desc: 'Maximum performance for demanding websites.', monthly: 12.95, yearly: 8.95, freeMonths: 5, savePercent: 31, popular: false, btnText: 'Explore Now', btnUrl: '/register', topFeatures: ['Unlimited Websites', 'Unlimited NVMe SSD Storage', 'Unmetered Bandwidth', 'FREE Premium SSL Certificate', 'FREE Business Email'], additionalFeatures: [{ label: 'Free Domain Registration', included: true }, { label: 'Daily Backups', included: true }, { label: 'Dedicated IP', included: true }], suite: [{ label: 'Extended Validation SSL', included: true }, { label: 'SiteLock Professional', included: true }, { label: 'CodeGuard Pro', included: true, note: 'Up to 5GB' }], suiteName: 'Pro Security Suite' },
  ],
  features: [
    { title: 'cPanel Control Panel', desc: 'Industry-leading cPanel gives you full control over your hosting environment with an intuitive graphical interface.' },
    { title: '1-Click App Installer', desc: 'Deploy WordPress, Joomla, Drupal and 400+ apps instantly with Softaculous — no technical knowledge needed.' },
    { title: 'Free SSL Certificate', desc: "Every domain gets a free Let's Encrypt SSL certificate, automatically renewed, keeping your visitors' data secure." },
    { title: 'Professional Email', desc: 'Create unlimited professional email addresses at your domain with spam filtering and webmail access included.' },
    { title: 'Daily Backups', desc: 'Automated daily backups with one-click restore. Your data is always safe, no matter what.' },
    { title: '24/7 Expert Support', desc: 'Real engineers available 24/7 via live chat, ticket, and phone. Average response time under 2 minutes.' },
  ],
  plansTitle: 'Simple, Transparent Pricing',
  plansSubtitle: 'No hidden fees. Cancel anytime.',
  featuresTitle: 'Built for Your Success',
  featuresDesc: 'Every plan comes packed with features to get your website live, fast and secure.',
  faqs: [
    { q: 'How quickly can I get my website online?', a: 'Instantly! Once your payment is processed, your hosting account is provisioned automatically. You can install WordPress or upload your files within minutes.' },
    { q: 'Can I host multiple websites on one plan?', a: 'Yes! Our Baby, Business, and Pro plans support unlimited websites. Only the Hatchling plan is limited to one domain.' },
    { q: 'Is there a money-back guarantee?', a: 'Absolutely. We offer a full 30-day money-back guarantee on all shared hosting plans. No questions asked.' },
    { q: 'Do I need technical knowledge?', a: 'Not at all. cPanel makes managing your hosting easy, and our one-click installer deploys WordPress in seconds.' },
    { q: 'Can I upgrade my plan later?', a: 'Yes, you can upgrade to any higher plan at any time directly from your client area.' },
  ],
  faqTitle: 'Frequently Asked Questions',
};

const SharedHosting: React.FC = () => {
  const { content } = useContent();
  const pgCms = content?.['pages.sharedHosting'] || {};
  const pg = { ...DEFAULT, ...pgCms };

  const hero = pg.hero || {};
  const stats = pg.stats || [];
  const plans = pg.plans || [];
  const features = pg.features || [];
  const faqs = pg.faqs || [];
  const featuresTitle = pg.featuresTitle || 'Built for Your Success';
  const featuresDesc = pg.featuresDesc || 'Every plan comes packed with features to get your website live, fast and secure.';
  const faqTitle = pg.faqTitle || 'Frequently Asked Questions';

  const { convert } = useCurrency();
  const [yearly, setYearly] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const renderLink = (to: string, children: React.ReactNode, className: string) => {
    if (!to) return null;
    if (to.startsWith('#') || to.startsWith('http')) {
      return <a href={to} className={className}>{children}</a>;
    }
    return <Link to={to} className={className}>{children}</Link>;
  };

  return (
    <div className="min-h-screen bg-dark">

      {/* SECTION 1 — Hero */}
      <section className="relative bg-secondary overflow-hidden pt-36 pb-24">
        <div className="tech-grid absolute inset-0 opacity-5" />
        <div className="absolute top-0 left-0 w-[700px] h-[700px] rounded-full blur-[150px]" style={{ background: 'radial-gradient(circle, rgba(103,61,230,0.25) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full blur-[120px]" style={{ background: 'radial-gradient(circle, rgba(0,209,255,0.08) 0%, transparent 70%)' }} />

        <div className="container mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7 }}
              className="lg:w-1/2"
            >
              {hero.badge && (
                <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary-300 text-xs font-black px-4 py-2 rounded-full mb-6 uppercase tracking-widest">
                  <Zap size={12} className="fill-primary-400" /> {hero.badge}
                </div>
              )}
              <h1 className="text-5xl lg:text-6xl font-black text-white leading-[1.05] tracking-tight mb-6">
                {hero.title || 'Shared Hosting'}<br />
                <span className="text-primary-300">{hero.titleHighlight || 'Made Simple.'}</span>
              </h1>
              <p className="text-lg text-slate-400 font-medium leading-relaxed mb-8 max-w-lg">
                {hero.description || 'Launch your website today with blazing-fast SSD storage, free SSL, and a one-click app installer.'}
              </p>
              <div className="flex flex-wrap gap-4">
                {(hero.primaryBtn?.show !== false) && hero.primaryBtn && renderLink(
                  hero.primaryBtn.url || '#sh-plans',
                  <>{hero.primaryBtn.text || 'See Plans'} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>,
                  'px-8 py-4 bg-primary hover:bg-primary-600 text-white rounded-xl font-black text-sm transition-all shadow-xl shadow-primary/30 flex items-center gap-2 group'
                )}
                {(hero.secondaryBtn?.show !== false) && hero.secondaryBtn && renderLink(
                  hero.secondaryBtn.url || '/register',
                  hero.secondaryBtn.text || 'Start Free Trial',
                  'px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black text-sm transition-all border border-white/10'
                )}
              </div>
              {(hero.badges || []).length > 0 && (
                <div className="flex flex-wrap gap-6 mt-8">
                  {(hero.badges || []).map((f: string) => (
                    <span key={f} className="flex items-center gap-2 text-xs text-slate-400 font-bold">
                      <Check size={14} className="text-primary-400" /> {f}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>

            {/* cPanel Mockup */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="lg:w-1/2"
            >
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 shadow-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  <div className="ml-3 flex-1 bg-white/5 rounded-lg px-3 py-1.5 text-xs text-slate-400 font-mono">cPanel — yourdomain.com</div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'File Manager', icon: <HardDrive size={20} />, color: 'text-primary-400 bg-primary/10' },
                    { label: 'MySQL Databases', icon: <Server size={20} />, color: 'text-accent bg-accent/10' },
                    { label: 'Email Accounts', icon: <Mail size={20} />, color: 'text-emerald-400 bg-emerald-400/10' },
                    { label: 'SSL/TLS Manager', icon: <Shield size={20} />, color: 'text-amber-400 bg-amber-400/10' },
                    { label: 'Softaculous', icon: <Zap size={20} />, color: 'text-primary-300 bg-primary/10' },
                    { label: 'Backup Wizard', icon: <RefreshCw size={20} />, color: 'text-rose-400 bg-rose-400/10' },
                    { label: 'DNS Zone', icon: <Globe size={20} />, color: 'text-accent bg-accent/10' },
                    { label: 'Cron Jobs', icon: <Clock size={20} />, color: 'text-orange-400 bg-orange-400/10' },
                    { label: 'FTP Accounts', icon: <UploadCloud size={20} />, color: 'text-pink-400 bg-pink-400/10' },
                  ].map((item) => (
                    <div key={item.label} className={`${item.color} rounded-xl p-3 flex flex-col items-center gap-2 text-center border border-white/5 hover:scale-105 transition-transform cursor-default`}>
                      {item.icon}
                      <span className="text-[10px] font-bold text-slate-300 leading-tight">{item.label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="col-span-2 bg-white/5 rounded-xl p-3 border border-white/5">
                    <div className="text-[10px] text-slate-500 font-bold mb-2 uppercase tracking-widest">Disk Usage</div>
                    <div className="h-1.5 bg-white/10 rounded-full mb-1"><div className="h-full w-[34%] bg-primary rounded-full" /></div>
                    <div className="text-xs text-slate-300 font-bold">3.4 GB / 10 GB</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex flex-col items-center justify-center">
                    <div className="text-2xl font-black text-primary-300">14</div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Domains</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* SECTION 2 — Stats */}
      <section className="py-12 bg-primary">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s: any, i: number) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center">
                <div className="text-3xl font-black text-white mb-1">{s.value}</div>
                <div className="text-primary-200 text-xs font-black uppercase tracking-widest">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3 — Plans */}
      {plans.length > 0 && (
        <section id="sh-plans" className="py-20 bg-white">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-black px-4 py-2 rounded-full mb-4 uppercase tracking-widest">Pricing Plans</div>
              <h2 className="text-4xl font-black text-slate-900 mb-3">{pg.plansTitle || 'Simple, Transparent Pricing'}</h2>
              <p className="text-slate-500 font-medium">{pg.plansSubtitle || 'No hidden fees. Cancel anytime.'}</p>
              <div className="flex items-center justify-center gap-4 mt-6">
                <span className={`text-sm font-black ${!yearly ? 'text-slate-900' : 'text-slate-400'}`}>Monthly</span>
                <button onClick={() => setYearly(y => !y)} className={`w-12 h-6 rounded-full transition-all relative ${yearly ? 'bg-primary' : 'bg-slate-200'}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${yearly ? 'left-7' : 'left-1'}`} />
                </button>
                <span className={`text-sm font-black ${yearly ? 'text-slate-900' : 'text-slate-400'}`}>
                  Annual <span className="text-emerald-600 ml-1">Save 33%</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
              {plans.map((plan: any, i: number) => (
                <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className={`relative flex flex-col rounded-2xl overflow-hidden transition-all ${plan.popular ? 'border-2 border-primary shadow-2xl shadow-primary/20 bg-primary/[0.03]' : 'border border-slate-200 bg-white hover:border-primary/40 shadow-sm hover:shadow-md'}`}>
                  {plan.popular && (
                    <div className="absolute top-4 right-4 px-3 py-1 bg-primary rounded-full text-[10px] font-black text-white uppercase tracking-widest">Popular</div>
                  )}
                  <div className="p-6 text-center border-b border-slate-100">
                    <h3 className={`text-lg font-black mb-1 ${plan.popular ? 'text-primary' : 'text-slate-900'}`}>{plan.name}</h3>
                    <p className="text-xs text-slate-500 font-medium leading-snug mb-5 px-2">{plan.desc}</p>
                    <div className="mb-1">
                      <span className="text-4xl font-black text-slate-900">{convert(yearly ? plan.yearly : plan.monthly)}</span>
                    </div>
                    <p className="text-xs text-slate-400 font-bold mb-1">Per month</p>
                    {yearly && <p className="text-xs text-emerald-500 font-bold mb-3">Billed yearly</p>}
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                      <span className="text-xs text-slate-500 font-medium">UP TO{' '}
                        <span className="font-black text-primary">{plan.freeMonths} MONTHS FREE</span>
                      </span>
                    </div>
                    <p className="text-sm font-black text-slate-800 mb-1">Save {plan.savePercent}%</p>
                    <p className="text-[10px] text-slate-400 font-medium mb-5 leading-tight">1-year discount term renew at<br /><span className="font-black text-slate-500">Regular rate</span></p>
                    {renderLink(
                      plan.btnUrl || '/register',
                      plan.btnText || 'Explore Now',
                      `block text-center py-2.5 rounded-xl font-black text-sm transition-all ${plan.popular ? 'bg-primary hover:bg-primary-600 text-white shadow-lg shadow-primary/30' : 'bg-transparent hover:bg-slate-50 text-slate-800 border border-slate-300 hover:border-primary/50'}`
                    )}
                  </div>
                  <div className="p-5 flex flex-col gap-5 flex-1">
                    {(plan.topFeatures || []).length > 0 && (
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest mb-3 text-primary">Top Features</p>
                        <ul className="space-y-2">
                          {plan.topFeatures.map((f: string, j: number) => (
                            <li key={j} className="flex items-start gap-2 text-xs text-slate-600 font-medium">
                              <div className="w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5"><Check size={9} className="text-primary" /></div>
                              <span dangerouslySetInnerHTML={{ __html: f.replace('FREE', '<strong class="text-slate-900">FREE</strong>') }} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(plan.additionalFeatures || []).length > 0 && (
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest mb-3 text-primary">Additional Features</p>
                        <ul className="space-y-2">
                          {plan.additionalFeatures.map((f: any, j: number) => (
                            <li key={j} className="flex items-start gap-2 text-xs font-medium">
                              {f.included ? (
                                <div className="w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5"><Check size={9} className="text-primary" /></div>
                              ) : (
                                <div className="w-4 h-4 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5"><X size={9} className="text-red-400" /></div>
                              )}
                              <span className={f.included ? 'text-slate-600' : 'text-slate-400'}>{f.label}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(plan.suite || []).length > 0 && (
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest mb-3 text-primary">{plan.suiteName || 'Suite'}</p>
                        <ul className="space-y-2.5">
                          {plan.suite.map((f: any, j: number) => (
                            <li key={j} className="flex items-start gap-2 text-xs font-medium">
                              {f.included ? (
                                <div className="w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5"><Check size={9} className="text-primary" /></div>
                              ) : (
                                <div className="w-4 h-4 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5"><X size={9} className="text-red-400" /></div>
                              )}
                              <div>
                                <span className={f.included ? 'text-slate-600' : 'text-slate-400'}>{f.label}</span>
                                {f.note && <><br /><span className="text-[10px] text-slate-400">{f.note}</span></>}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* SECTION 4 — Features */}
      {features.length > 0 && (
        <section className="py-20 bg-dark">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary-300 text-xs font-black px-4 py-2 rounded-full mb-4 uppercase tracking-widest">Everything Included</div>
              <h2 className="text-4xl font-black text-white mb-3">{featuresTitle}</h2>
              <p className="text-slate-400 font-medium max-w-xl mx-auto">{featuresDesc}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.map((f: any, i: number) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} whileHover={{ y: -5 }}
                  className="p-6 bg-white/5 rounded-2xl border border-white/5 hover:border-primary/30 hover:bg-white/10 transition-all group">
                  <div className="w-12 h-12 bg-primary/10 text-primary-400 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-all">
                    {ICONS[f.title] || DEFAULT_FEATURE_ICON}
                  </div>
                  <h3 className="text-base font-black text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-400 font-medium leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* SECTION 5 — Control Panel Showcase */}
      <section className="py-20 bg-white overflow-hidden relative">
        <div className="container mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-14">
            <motion.div initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="lg:w-1/2">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-black px-4 py-2 rounded-full mb-6 uppercase tracking-widest">Full Control</div>
              <h2 className="text-4xl font-black text-slate-900 mb-5">cPanel Hosting<br /><span className="text-primary">The Industry Standard.</span></h2>
              <p className="text-slate-500 font-medium leading-relaxed mb-8">
                Manage every aspect of your hosting from one intuitive dashboard. cPanel is the world's most trusted control panel — and it comes included with every plan.
              </p>
              <ul className="space-y-3">
                {['One-click WordPress installer', 'Full DNS and domain management', 'Advanced email & spam filtering', 'Real-time resource monitoring'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-slate-700 font-medium">
                    <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0"><Check size={12} className="text-primary" /></div>
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="lg:w-1/2">
              <div className="bg-[#0d1117] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
                <div className="bg-[#161b22] px-4 py-3 flex items-center gap-2 border-b border-slate-800">
                  <div className="flex gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500" /><div className="w-2.5 h-2.5 rounded-full bg-yellow-500" /><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /></div>
                  <span className="text-slate-400 text-xs font-mono flex-1 text-center">cPanel — File Manager</span>
                </div>
                <div className="p-4 space-y-2 font-mono text-xs">
                  {['public_html/', '├── wp-content/', '│   ├── themes/', '│   ├── plugins/', '│   └── uploads/', '├── wp-config.php', '├── index.php', '└── .htaccess'].map((line, i) => (
                    <div key={i} className={`${line.includes('wp-content') || line === 'public_html/' ? 'text-primary-300 font-bold' : line.includes('/') && !line.includes('public') ? 'text-accent' : 'text-slate-400'}`}>{line}</div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* SECTION 6 — FAQ */}
      {faqs.length > 0 && (
        <section className="py-20 bg-dark">
          <div className="container mx-auto px-6 max-w-3xl">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary-300 text-xs font-black px-4 py-2 rounded-full mb-4 uppercase tracking-widest">FAQ</div>
              <h2 className="text-4xl font-black text-white mb-3">{faqTitle}</h2>
            </div>
            <div className="space-y-3">
              {faqs.map((faq: any, i: number) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
                  className="border border-white/10 rounded-xl overflow-hidden bg-white/5">
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors">
                    <span className="text-sm font-black text-white pr-3">{faq.q}</span>
                    {openFaq === i ? <ChevronUp size={16} className="text-primary-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-slate-500 flex-shrink-0" />}
                  </button>
                  {openFaq === i && <div className="px-5 pb-4 pt-2 text-sm text-slate-400 font-medium leading-relaxed border-t border-white/5">{faq.a}</div>}
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default SharedHosting;
