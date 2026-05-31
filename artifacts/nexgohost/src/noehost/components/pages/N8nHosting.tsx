import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, ArrowRight, ChevronDown, ChevronUp,
  Shield, Zap, RefreshCw, Globe, Lock,
  Cpu, GitBranch, Activity, Star, LifeBuoy,
  MessageSquare, Bot, Workflow, Play
} from 'lucide-react';
import { useCurrency } from '../../CurrencyContext';
import { useVpsPlans, type VpsPlan } from '../../hooks/usePackages';

const FAQS = [
  {
    q: 'What is self-hosted n8n?',
    a: 'Self-hosted n8n is the open-source version of n8n that you run on your own server. Unlike n8n Cloud, there are no per-execution charges, no workflow limits, and your data stays on your server — giving you full control and privacy.',
  },
  {
    q: 'Is n8n already installed when I buy?',
    a: 'Yes. n8n is fully pre-installed and configured on your VPS. You\'ll receive login credentials by email immediately after your order is activated — just open your browser and start building.',
  },
  {
    q: 'Can I connect n8n to any third-party service?',
    a: 'n8n natively supports 400+ integrations including Slack, Gmail, Google Sheets, WhatsApp, Airtable, Stripe, GitHub, Telegram, and much more. You can also install community nodes for even more integrations.',
  },
  {
    q: 'Do you handle server updates and maintenance?',
    a: 'Yes. We manage n8n updates, OS patches, and security fixes automatically. You focus on building workflows — we keep the server running smoothly.',
  },
  {
    q: 'Can I use my own domain with n8n?',
    a: 'Absolutely. You can point any domain or subdomain (e.g. n8n.yourbusiness.com) to your VPS. We\'ll guide you through DNS setup and install a free SSL certificate.',
  },
  {
    q: 'Is there a money-back guarantee?',
    a: 'Yes — all plans come with a 30-day money-back guarantee. If you\'re not satisfied for any reason, contact support within 30 days for a full refund.',
  },
];

const N8nHosting: React.FC = () => {
  const [yearly, setYearly] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { convertFromPKR, currency } = useCurrency();
  const { plans: vpsPlans, loading: plansLoading } = useVpsPlans();

  const maxSavePercent = vpsPlans.reduce((max, p) => {
    if (!p.yearlyPrice || !p.price) return max;
    const yearlyMonthly = p.yearlyPrice / 12;
    const save = Math.round((1 - yearlyMonthly / p.price) * 100);
    return save > 0 && save > max ? save : max;
  }, 0);

  const fmtSpec = (plan: VpsPlan) => {
    const yearlyMonthly = plan.yearlyPrice ? +(plan.yearlyPrice / 12).toFixed(2) : null;
    const savePercent = yearlyMonthly && plan.price && yearlyMonthly < plan.price
      ? Math.round((1 - yearlyMonthly / plan.price) * 100)
      : 0;
    return {
      cpu: `${plan.cpuCores} vCPU`,
      ram: `${plan.ramGb} GB RAM`,
      storage: `${plan.storageGb} GB NVMe`,
      bandwidth: plan.bandwidthTb ? `${plan.bandwidthTb} TB Bandwidth` : 'Unmetered',
      popular: vpsPlans.length >= 3 && vpsPlans.indexOf(plan) === 1,
      badge: vpsPlans.length >= 3 && vpsPlans.indexOf(plan) === 1 ? 'MOST POPULAR' : '',
      savePercent,
      monthlyPrice: plan.price,
      yearlyMonthly: yearlyMonthly ?? plan.price,
      yearlyTotal: plan.yearlyPrice,
      features: plan.features && plan.features.length > 0
        ? plan.features
        : ['n8n Pre-installed', 'Free SSL Certificate', 'Unlimited Workflows', 'Unlimited Executions', 'Full Root Access'],
    };
  };

  return (
    <div className="min-h-screen text-white" style={{ background: '#000000' }}>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #0a0614 0%, #000000 100%)', paddingTop: '100px', paddingBottom: '80px' }}>
        {/* Background glow blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full blur-[160px] pointer-events-none opacity-40"
          style={{ background: 'radial-gradient(ellipse, rgba(109,40,217,0.5) 0%, rgba(99,102,241,0.2) 40%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full blur-[120px] pointer-events-none opacity-25"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.6) 0%, transparent 65%)' }} />

        <div className="max-w-[1200px] mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-12">

            {/* LEFT */}
            <motion.div
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}
              className="flex-1 max-w-[580px]"
            >
              {/* Offer badge */}
              <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full text-sm font-bold"
                style={{ background: 'rgba(109,40,217,0.15)', border: '1px solid rgba(139,92,246,0.4)', color: '#C4B5FD' }}>
                <Zap size={13} className="fill-violet-400 text-violet-400" />
                Up to <span className="text-white font-black">{maxSavePercent}% off</span> n8n self-hosting
              </div>

              {/* Headline */}
              <h1 className="font-black leading-[1.06] tracking-tight mb-6 text-white"
                style={{ fontSize: 'clamp(2.6rem, 5.5vw, 4rem)' }}>
                Self-hosted n8n.<br />
                <span style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa 0%, #818cf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Zero limits. Full control.
                </span>
              </h1>

              {/* Sub-headline */}
              <p className="text-lg mb-8 leading-relaxed" style={{ color: '#9CA3AF' }}>
                Run unlimited AI workflows on your own server. No per-execution fees, no data leaving your infrastructure — just pure automation power.
              </p>

              {/* Feature checklist */}
              <ul className="space-y-3 mb-10">
                {[
                  'Unlimited workflows & concurrent executions',
                  'Free SSL + custom domain included',
                  '400+ integrations — Slack, WhatsApp, Gmail & more',
                  'Managed updates, daily backups, full root access',
                ].map(f => (
                  <li key={f} className="flex items-center gap-3 text-[15px]" style={{ color: '#D1D5DB' }}>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(109,40,217,0.25)', border: '1px solid rgba(139,92,246,0.5)' }}>
                      <Check size={11} style={{ color: '#A78BFA' }} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA row */}
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <a href="#n8n-plans"
                  className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold text-base text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)', boxShadow: '0 8px 32px rgba(109,40,217,0.45)' }}>
                  Get started
                  <ArrowRight size={16} />
                </a>
                <a href="#n8n-plans"
                  className="inline-flex items-center gap-2 px-6 py-4 rounded-xl font-semibold text-sm transition-all hover:bg-white/5"
                  style={{ color: '#C4B5FD', border: '1px solid rgba(139,92,246,0.3)' }}>
                  View all plans
                </a>
              </div>

              {/* Trust row */}
              <div className="flex flex-wrap items-center gap-5 text-sm" style={{ color: '#6B7280' }}>
                <span className="flex items-center gap-1.5">
                  <Shield size={14} style={{ color: '#6B7280' }} />
                  30-day money-back guarantee
                </span>
                <span className="flex items-center gap-1.5">
                  <Zap size={14} style={{ color: '#6B7280' }} />
                  n8n live in under 2 minutes
                </span>
              </div>
            </motion.div>

            {/* RIGHT — n8n dashboard mockup */}
            <motion.div
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.65, delay: 0.1 }}
              className="flex-1 flex items-center justify-center w-full max-w-[560px]"
            >
              <div className="relative w-full" style={{ aspectRatio: '1.25' }}>
                {/* Main dashboard card */}
                <div className="absolute inset-0 rounded-2xl overflow-hidden"
                  style={{ background: 'linear-gradient(145deg, #13111f 0%, #0d0b1a 100%)', border: '1px solid rgba(99,102,241,0.25)', boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 60px rgba(99,102,241,0.12)' }}>

                  {/* Window chrome */}
                  <div className="flex items-center gap-2 px-5 py-3.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                    <div className="w-3 h-3 rounded-full bg-red-500/70" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                    <div className="w-3 h-3 rounded-full bg-green-500/70" />
                    <div className="flex-1 mx-4 h-6 rounded-md flex items-center px-3 text-xs" style={{ background: 'rgba(255,255,255,0.05)', color: '#6B7280' }}>
                      n8n.yourdomain.com
                    </div>
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-[10px] font-semibold text-emerald-400">LIVE</span>
                  </div>

                  {/* Canvas area */}
                  <div className="relative p-5" style={{ height: 'calc(100% - 52px)' }}>
                    {/* Grid dots bg */}
                    <div className="absolute inset-0 opacity-[0.04]"
                      style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

                    {/* Workflow nodes */}
                    <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none', zIndex: 1 }}>
                      <path d="M 110 100 C 155 100 145 158 190 158" stroke="rgba(139,92,246,0.5)" strokeWidth="2" fill="none" strokeDasharray="6 4"/>
                      <path d="M 110 100 C 155 100 145 230 190 230" stroke="rgba(139,92,246,0.35)" strokeWidth="2" fill="none" strokeDasharray="6 4"/>
                      <path d="M 310 158 C 345 158 345 158 380 158" stroke="rgba(139,92,246,0.5)" strokeWidth="2" fill="none" strokeDasharray="6 4"/>
                      <path d="M 310 230 C 345 230 345 158 380 158" stroke="rgba(139,92,246,0.35)" strokeWidth="2" fill="none" strokeDasharray="6 4"/>
                      <circle cx="110" cy="100" r="5" fill="rgba(139,92,246,0.8)"/>
                      <circle cx="190" cy="158" r="5" fill="rgba(139,92,246,0.6)"/>
                      <circle cx="190" cy="230" r="5" fill="rgba(139,92,246,0.6)"/>
                      <circle cx="310" cy="158" r="5" fill="rgba(139,92,246,0.6)"/>
                      <circle cx="310" cy="230" r="5" fill="rgba(139,92,246,0.4)"/>
                      <circle cx="380" cy="158" r="5" fill="rgba(99,102,241,0.9)"/>
                    </svg>

                    {/* Trigger node */}
                    <motion.div
                      animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                      className="absolute flex items-center gap-2.5 px-4 py-2.5 rounded-xl z-10"
                      style={{ top: '18%', left: '4%', background: '#1e1a30', border: '1.5px solid rgba(139,92,246,0.6)', boxShadow: '0 4px 20px rgba(109,40,217,0.3)' }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.2)' }}>
                        <Zap size={14} style={{ color: '#A78BFA' }} />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-white">Webhook Trigger</p>
                        <p className="text-[9px]" style={{ color: '#7C3AED' }}>● Active</p>
                      </div>
                    </motion.div>

                    {/* AI Agent node */}
                    <motion.div
                      animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut', delay: 0.4 }}
                      className="absolute flex items-center gap-2.5 px-4 py-2.5 rounded-xl z-10"
                      style={{ top: '32%', left: '35%', background: '#151228', border: '1.5px solid rgba(99,102,241,0.7)', boxShadow: '0 4px 24px rgba(79,70,229,0.35)' }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.2)' }}>
                        <Bot size={14} style={{ color: '#818CF8' }} />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-white">AI Agent</p>
                        <p className="text-[9px]" style={{ color: '#818CF8' }}>GPT-4 • Running</p>
                      </div>
                    </motion.div>

                    {/* HTTP node */}
                    <motion.div
                      animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut', delay: 0.8 }}
                      className="absolute flex items-center gap-2.5 px-4 py-2.5 rounded-xl z-10"
                      style={{ top: '55%', left: '35%', background: '#121c18', border: '1.5px solid rgba(16,185,129,0.5)' }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.15)' }}>
                        <Globe size={14} style={{ color: '#34D399' }} />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-white">HTTP Request</p>
                        <p className="text-[9px]" style={{ color: '#34D399' }}>200 OK</p>
                      </div>
                    </motion.div>

                    {/* Send Message node */}
                    <motion.div
                      animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 3.8, ease: 'easeInOut', delay: 0.2 }}
                      className="absolute flex items-center gap-2.5 px-4 py-2.5 rounded-xl z-10"
                      style={{ top: '32%', right: '4%', background: '#161521', border: '1.5px solid rgba(139,92,246,0.5)' }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.15)' }}>
                        <MessageSquare size={14} style={{ color: '#A78BFA' }} />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-white">Send Message</p>
                        <p className="text-[9px]" style={{ color: '#A78BFA' }}>Slack • Done</p>
                      </div>
                    </motion.div>

                    {/* Executions counter badge */}
                    <motion.div
                      animate={{ scale: [1, 1.04, 1] }} transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                      className="absolute bottom-4 left-4 flex items-center gap-3 px-4 py-2.5 rounded-xl z-20"
                      style={{ background: 'rgba(15,12,28,0.95)', border: '1px solid rgba(99,102,241,0.3)', backdropFilter: 'blur(8px)' }}>
                      <Activity size={14} style={{ color: '#818CF8' }} />
                      <div>
                        <p className="text-[10px] font-semibold" style={{ color: '#6B7280' }}>Executions today</p>
                        <p className="text-sm font-black text-white">1,248 <span className="text-[10px] text-emerald-400 font-bold">+12%</span></p>
                      </div>
                    </motion.div>
                  </div>
                </div>

                {/* Floating badge — integrations */}
                <motion.div
                  animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 4.5, ease: 'easeInOut', delay: 1 }}
                  className="absolute -top-5 -right-4 px-4 py-2.5 rounded-xl z-20 flex items-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #1e1b4b, #2d2460)', border: '1px solid rgba(99,102,241,0.5)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                  <Workflow size={14} style={{ color: '#818CF8' }} />
                  <span className="text-xs font-bold text-white">400+ Integrations</span>
                </motion.div>

                {/* Floating badge — no limits */}
                <motion.div
                  animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 3.8, ease: 'easeInOut', delay: 0.3 }}
                  className="absolute -bottom-4 -left-4 px-4 py-2.5 rounded-xl z-20 flex items-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #0f2a1a, #122b1f)', border: '1px solid rgba(16,185,129,0.4)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                  <RefreshCw size={13} style={{ color: '#34D399' }} />
                  <span className="text-xs font-bold text-white">Unlimited Executions</span>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── TRUSTPILOT ── */}
      <section className="py-10 border-y" style={{ background: '#000000', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-[1200px] mx-auto px-6 flex flex-wrap items-center justify-center gap-3">
          <span className="font-semibold text-white text-base">Excellent</span>
          <div className="flex gap-0.5">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="w-6 h-6 flex items-center justify-center" style={{ background: '#00B67A' }}>
                <Star size={14} className="fill-white text-white" />
              </div>
            ))}
          </div>
          <span className="text-sm underline" style={{ color: '#9CA3AF' }}>68,298 reviews on</span>
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="w-4 h-4" style={{ background: '#00B67A' }}>
                  <Star size={10} className="fill-white text-white" />
                </div>
              ))}
            </div>
            <span className="font-black text-sm text-white">Trustpilot</span>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="n8n-plans" className="py-20" style={{ background: '#000000' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="font-black mb-4" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', color: '#FFFFFF' }}>
              Pick the best VPS plan –<br />self-hosted n8n included
            </h2>

            {/* Billing toggle */}
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                onClick={() => setYearly(false)}
                className={`text-sm font-bold px-4 py-2 rounded-lg transition-all ${!yearly ? 'text-white bg-white/10' : 'text-gray-500'}`}>
                Monthly
              </button>
              <button
                onClick={() => setYearly(true)}
                className={`text-sm font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${yearly ? 'text-white bg-white/10' : 'text-gray-500'}`}>
                Yearly
                {maxSavePercent > 0 && (
                  <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.2)', color: '#818CF8' }}>
                    Save up to {maxSavePercent}%
                  </span>
                )}
              </button>
            </div>
          </motion.div>

          {/* Loading skeleton */}
          {plansLoading && (
            <div className="grid md:grid-cols-3 gap-5">
              {[1,2,3].map(i => (
                <div key={i} className="rounded-2xl h-[480px] animate-pulse" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }} />
              ))}
            </div>
          )}

          {!plansLoading && vpsPlans.length === 0 && (
            <div className="text-center py-12" style={{ color: '#6B7280' }}>
              <p className="text-base">Plans temporarily unavailable. Please try again shortly.</p>
            </div>
          )}

          {!plansLoading && vpsPlans.length > 0 && (
            <div className="grid md:grid-cols-3 gap-5">
              {vpsPlans.map((plan, i) => {
                const spec = fmtSpec(plan);
                const price = yearly ? spec.yearlyMonthly : spec.monthlyPrice;
                const displayPrice = convertFromPKR(price);
                const origPrice = convertFromPKR(spec.monthlyPrice);

                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="relative flex flex-col rounded-2xl overflow-hidden"
                    style={{
                      background: spec.popular
                        ? 'linear-gradient(180deg, #1e1b4b 0%, #0f0e1a 100%)'
                        : '#111111',
                      border: spec.popular
                        ? '1.5px solid rgba(99,102,241,0.5)'
                        : '1px solid rgba(255,255,255,0.08)',
                    }}>

                    {/* % off badge */}
                    {spec.savePercent > 0 && yearly && (
                      <div className="absolute top-4 right-4 text-[11px] font-black px-2.5 py-1 rounded-full"
                        style={{ background: spec.popular ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)', color: '#D1D5DB' }}>
                        {spec.savePercent}% off
                      </div>
                    )}

                    {/* MOST POPULAR badge */}
                    {spec.badge && (
                      <div className="py-2 text-center text-[11px] font-black uppercase tracking-[0.12em] text-white"
                        style={{ background: 'linear-gradient(90deg, #6D28D9, #7C3AED)' }}>
                        {spec.badge}
                      </div>
                    )}

                    <div className="p-7 flex flex-col flex-1">
                      <h3 className="text-lg font-black text-white mb-1">{plan.name}</h3>
                      {plan.description && (
                        <p className="text-xs mb-3" style={{ color: '#6B7280' }}>{plan.description}</p>
                      )}

                      {/* Specs pills */}
                      <div className="flex flex-wrap gap-1.5 mb-5">
                        {[spec.cpu, spec.ram, spec.storage, spec.bandwidth].map(s => (
                          <span key={s} className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                            style={{ background: 'rgba(255,255,255,0.06)', color: '#9CA3AF', border: '1px solid rgba(255,255,255,0.08)' }}>
                            {s}
                          </span>
                        ))}
                      </div>

                      {/* Price */}
                      <div className="mb-6">
                        <div className="flex items-end gap-2 mb-1">
                          <span className="font-black text-white" style={{ fontSize: '2.2rem', lineHeight: 1 }}>
                            {displayPrice}
                          </span>
                          <span className="text-sm pb-1" style={{ color: '#6B7280' }}>/mo</span>
                        </div>
                        {yearly && spec.savePercent > 0 && (
                          <p className="text-xs" style={{ color: '#6B7280' }}>
                            {origPrice}/mo regular price
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => window.location.href = '/client/orders/new'}
                        className="w-full py-3 rounded-xl font-bold text-[14px] text-white mb-7 transition-all hover:opacity-90"
                        style={{
                          background: spec.popular
                            ? 'linear-gradient(135deg, #7C3AED, #6D28D9)'
                            : 'rgba(255,255,255,0.08)',
                          border: spec.popular ? 'none' : '1px solid rgba(255,255,255,0.12)',
                        }}>
                        Choose your plan
                      </button>

                      {/* Features */}
                      <ul className="space-y-2.5 flex-1">
                        {spec.features.map((f, fi) => (
                          <li key={fi} className="flex items-start gap-2.5 text-[13px]" style={{ color: '#D1D5DB' }}>
                            <Check size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#7C3AED' }} />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          <p className="text-center text-sm mt-8" style={{ color: '#6B7280' }}>
            Need something custom?{' '}
            <a href="/contact-us" className="underline hover:text-white transition-colors" style={{ color: '#818CF8' }}>
              Contact our sales team
            </a>
          </p>
        </div>
      </section>

      {/* ── WHY SELF-HOST n8n ── */}
      <section className="py-20" style={{ background: '#0a0a0a' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
            <h2 className="font-black mb-3" style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', color: '#FFFFFF' }}>
              Why self-host n8n?
            </h2>
            <p style={{ color: '#9CA3AF', fontSize: 15 }}>Everything you need to automate your business — on your own infrastructure.</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: <Workflow size={26} />, color: '#7C3AED', bg: 'rgba(124,58,237,0.12)', title: 'Unlimited Workflows', desc: 'Build as many automated workflows as you need with no restrictions or per-workflow fees.' },
              { icon: <Activity size={26} />, color: '#06B6D4', bg: 'rgba(6,182,212,0.1)', title: 'Unlimited Executions', desc: 'Run concurrent executions without throttling. Scale your automations as your business grows.' },
              { icon: <GitBranch size={26} />, color: '#10B981', bg: 'rgba(16,185,129,0.1)', title: '400+ Integrations', desc: 'Connect Slack, Google Sheets, WhatsApp, Airtable, Stripe, GitHub and hundreds more out of the box.' },
              { icon: <Lock size={26} />, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', title: 'Full Data Privacy', desc: 'Your credentials and workflow data never leave your server. Complete sovereignty over your data.' },
              { icon: <RefreshCw size={26} />, color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', title: 'Managed & Maintained', desc: 'We handle OS updates, n8n upgrades, and daily backups. Zero server management on your end.' },
              { icon: <LifeBuoy size={26} />, color: '#EC4899', bg: 'rgba(236,72,153,0.1)', title: '24/7 Expert Support', desc: 'Our engineers know n8n inside-out. Get help with workflow errors, webhooks, and custom nodes anytime.' },
            ].map((f, i) => (
              <motion.div key={f.title}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                className="p-6 rounded-2xl transition-all hover:scale-[1.02]"
                style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: f.bg, color: f.color }}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-white text-[15px] mb-2">{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#9CA3AF' }}>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20" style={{ background: '#000000' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
            <h2 className="font-black mb-3" style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', color: '#FFFFFF' }}>
              Up and running in minutes
            </h2>
            <p style={{ color: '#9CA3AF', fontSize: 15 }}>No DevOps expertise required — we handle everything for you.</p>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-4">
            {[
              { num: '1', icon: <Play size={24} />, color: '#7C3AED', title: 'Order your plan', desc: 'Pick the VPS plan that fits your team and workflow volume.' },
              { num: '2', icon: <Cpu size={24} />, color: '#06B6D4', title: 'Server provisioned', desc: 'Your VPS is spun up with n8n pre-installed within minutes of order.' },
              { num: '3', icon: <Globe size={24} />, color: '#10B981', title: 'Domain & SSL ready', desc: 'Point your domain and we set up free HTTPS automatically.' },
              { num: '4', icon: <Workflow size={24} />, color: '#F59E0B', title: 'Build workflows', desc: 'Log in to n8n and start connecting 400+ apps right away.' },
            ].map((s, i) => (
              <motion.div key={s.num}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="relative text-center p-7 rounded-2xl"
                style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black mb-5 mx-auto"
                  style={{ background: s.color, color: '#fff' }}>
                  {s.num}
                </div>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 mx-auto"
                  style={{ background: 'rgba(255,255,255,0.05)', color: s.color }}>
                  {s.icon}
                </div>
                <h3 className="font-bold text-white text-[14px] mb-2">{s.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: '#9CA3AF' }}>{s.desc}</p>
                {i < 3 && (
                  <div className="hidden md:block absolute top-10 -right-3 text-gray-600 text-lg font-bold z-10">→</div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20" style={{ background: '#0a0a0a' }}>
        <div className="max-w-[760px] mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="font-black mb-3" style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)', color: '#FFFFFF' }}>
              Frequently asked questions
            </h2>
            <p style={{ color: '#9CA3AF' }}>Everything you need to know about self-hosted n8n on Noehost.</p>
          </motion.div>

          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left flex items-center justify-between gap-4 px-5 py-4 rounded-xl transition-all"
                  style={{
                    background: openFaq === i ? 'rgba(99,102,241,0.08)' : '#111111',
                    border: openFaq === i ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  }}>
                  <span className="font-semibold text-[14px]" style={{ color: openFaq === i ? '#C4B5FD' : '#E5E7EB' }}>
                    {faq.q}
                  </span>
                  {openFaq === i
                    ? <ChevronUp size={16} style={{ color: '#818CF8', flexShrink: 0 }} />
                    : <ChevronDown size={16} style={{ color: '#6B7280', flexShrink: 0 }} />
                  }
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                      style={{ borderLeft: '1px solid rgba(99,102,241,0.3)', borderRight: '1px solid rgba(99,102,241,0.3)', borderBottom: '1px solid rgba(99,102,241,0.3)', borderRadius: '0 0 12px 12px' }}>
                      <div className="px-5 py-4 text-sm leading-relaxed" style={{ color: '#9CA3AF', background: 'rgba(99,102,241,0.04)' }}>
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="py-20" style={{ background: '#000000' }}>
        <div className="max-w-[760px] mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="rounded-2xl p-12" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #12112a 100%)', border: '1px solid rgba(99,102,241,0.3)' }}>
              <p className="text-sm font-semibold mb-3" style={{ color: '#818CF8' }}>
                Up to <span className="font-black">69% off</span> n8n self hosting
              </p>
              <h2 className="font-black mb-4" style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', color: '#FFFFFF' }}>
                Start automating everything today
              </h2>
              <p className="mb-8 text-sm" style={{ color: '#9CA3AF' }}>
                Join thousands of teams running n8n on their own infrastructure. Get started in minutes with a 30-day money-back guarantee.
              </p>
              <a href="#n8n-plans"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-[15px] text-white transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}>
                Choose your plan <ArrowRight size={16} />
              </a>
              <div className="flex flex-wrap gap-6 justify-center mt-7">
                {['30-Day Money-Back', 'n8n Pre-Installed', 'Cancel Anytime'].map(f => (
                  <span key={f} className="flex items-center gap-2 text-xs" style={{ color: '#9CA3AF' }}>
                    <Shield size={13} style={{ color: '#818CF8' }} /> {f}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

    </div>
  );
};

export default N8nHosting;
