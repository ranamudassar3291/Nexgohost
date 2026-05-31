import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check, ArrowRight, Shield, Zap, Globe, ChevronDown, ChevronUp,
  Server, RefreshCw, Lock, Cpu, HardDrive, Activity, GitBranch,
  Workflow, Bot, Star, Users, Clock, Play, LifeBuoy
} from 'lucide-react';

const PLANS = [
  {
    name: 'Starter',
    badge: '',
    popular: false,
    monthlyPrice: 9,
    yearlyPrice: 6,
    savePercent: 33,
    description: 'Perfect for individuals and small teams automating workflows.',
    highlight: 'rgba(99,102,241,0.15)',
    borderColor: 'border-white/10',
    features: [
      '2 vCPU Cores',
      '2 GB RAM',
      '20 GB NVMe SSD',
      'Up to 5,000 Executions/mo',
      'n8n Pre-installed',
      'Free SSL Certificate',
      '1 Custom Domain',
      'Daily Backups',
      'Managed Auto-updates',
    ],
  },
  {
    name: 'Business',
    badge: 'MOST POPULAR',
    popular: true,
    monthlyPrice: 19,
    yearlyPrice: 12,
    savePercent: 37,
    description: 'For growing teams running serious automation at scale.',
    highlight: 'rgba(99,102,241,0.25)',
    borderColor: 'border-violet-500/60',
    features: [
      '4 vCPU Cores',
      '8 GB RAM',
      '80 GB NVMe SSD',
      'Up to 50,000 Executions/mo',
      'n8n Pre-installed',
      'Free SSL Certificate',
      '5 Custom Domains',
      'Daily Backups + Restore',
      'Managed Auto-updates',
      'Priority Support (24/7)',
      'Webhook Rate Limit Boost',
    ],
  },
  {
    name: 'Enterprise',
    badge: '',
    popular: false,
    monthlyPrice: 39,
    yearlyPrice: 26,
    savePercent: 33,
    description: 'Maximum power for large organizations and mission-critical workflows.',
    highlight: 'rgba(99,102,241,0.15)',
    borderColor: 'border-white/10',
    features: [
      '8 vCPU Cores',
      '16 GB RAM',
      '200 GB NVMe SSD',
      'Unlimited Executions',
      'n8n Pre-installed',
      'Free SSL Certificate',
      'Unlimited Custom Domains',
      'Hourly Backups + Restore',
      'Managed Auto-updates',
      'Dedicated Support Manager',
      'Webhook Rate Limit Boost',
      'Custom SMTP Integration',
      'White-label Ready',
    ],
  },
];

const FEATURES = [
  {
    icon: <Bot size={28} />,
    color: 'text-violet-400 bg-violet-500/10',
    title: 'n8n Pre-Installed',
    desc: 'Your server comes with n8n fully configured and ready to use. No setup required — just login and start building workflows.',
  },
  {
    icon: <Zap size={28} />,
    color: 'text-amber-400 bg-amber-500/10',
    title: 'Blazing-Fast NVMe SSD',
    desc: 'AMD EPYC processors with NVMe SSDs ensure n8n executes your automations at maximum speed with zero lag.',
  },
  {
    icon: <Shield size={28} />,
    color: 'text-emerald-400 bg-emerald-500/10',
    title: 'Free SSL + Secure Access',
    desc: "Let's Encrypt SSL auto-installed. Your n8n instance is secured with HTTPS so webhooks and API calls are always encrypted.",
  },
  {
    icon: <RefreshCw size={28} />,
    color: 'text-sky-400 bg-sky-500/10',
    title: 'Managed Updates & Backups',
    desc: 'We handle n8n updates, OS patches, and daily backups for you. Your workflows are always protected and up-to-date.',
  },
  {
    icon: <Globe size={28} />,
    color: 'text-pink-400 bg-pink-500/10',
    title: 'Custom Domain Support',
    desc: 'Point your own domain to your n8n instance. Run automation at n8n.yourdomain.com with full DNS management.',
  },
  {
    icon: <LifeBuoy size={28} />,
    color: 'text-orange-400 bg-orange-500/10',
    title: '24/7 Expert Support',
    desc: 'Our engineers know n8n inside-out. Get help with workflow errors, webhook configs, and integrations anytime.',
  },
];

const WHY_ITEMS = [
  { icon: <Lock size={20} />, title: 'Your Data Stays Yours', desc: 'Unlike n8n Cloud, self-hosted means your credentials and workflow data never leave your server.' },
  { icon: <Cpu size={20} />, title: 'No Execution Limits on Enterprise', desc: 'Run as many automations as you need. No throttling, no per-workflow pricing.' },
  { icon: <GitBranch size={20} />, title: '400+ Integrations', desc: 'Connect Slack, Google Sheets, Airtable, GitHub, Stripe, WhatsApp, and hundreds more.' },
  { icon: <Activity size={20} />, title: 'Full Admin Control', desc: 'Access n8n\'s full admin panel, environment variables, and custom nodes — your instance, your rules.' },
];

const FAQS = [
  { q: 'What is n8n self-hosted?', a: 'n8n is an open-source workflow automation tool. Self-hosted means you run it on your own server — giving you full data privacy, unlimited customization, and no per-workflow pricing from n8n\'s cloud plans.' },
  { q: 'Is n8n already installed when I purchase?', a: 'Yes! n8n is pre-installed and configured on your server. You\'ll receive login credentials by email immediately after your order is processed.' },
  { q: 'Can I connect n8n to any service?', a: 'n8n supports 400+ native integrations including Slack, Gmail, Google Sheets, Airtable, Stripe, WhatsApp, Telegram, GitHub, and many more. You can also build custom nodes.' },
  { q: 'Do you manage updates?', a: 'Yes. We automatically update n8n and the underlying OS for you. You won\'t need to SSH in or manage packages — we handle everything.' },
  { q: 'Can I use my own domain?', a: 'Absolutely. You can point any domain or subdomain (like n8n.yourdomain.com) to your server. We\'ll help you configure the DNS and SSL certificate.' },
  { q: 'Is there a money-back guarantee?', a: 'Yes, all plans come with a 30-day money-back guarantee. If you\'re not satisfied for any reason, we\'ll refund you — no questions asked.' },
];

const N8nHosting: React.FC = () => {
  const [yearly, setYearly] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">

      {/* ── HERO ── */}
      <section className="relative overflow-hidden pt-36 pb-28 bg-[#0d0d1a]">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(99,102,241,0.18) 0%, transparent 70%)' }} />
        <div className="absolute top-20 right-0 w-[600px] h-[600px] rounded-full blur-[160px]" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)' }} />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-16">

            {/* Left */}
            <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }} className="lg:w-1/2">
              <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-black px-4 py-2 rounded-full mb-6 uppercase tracking-widest">
                <Zap size={12} className="fill-violet-400" /> Self-Hosted n8n Automation
              </div>
              <h1 className="text-5xl lg:text-6xl font-black text-white leading-[1.05] tracking-tight mb-6">
                Automate Everything<br />
                <span className="text-violet-400">Own Your Data.</span>
              </h1>
              <p className="text-lg text-slate-400 font-medium leading-relaxed mb-8 max-w-lg">
                Run n8n on your own private server. Full control, zero vendor lock-in, and 400+ integrations — pre-installed and managed for you.
              </p>
              <div className="flex flex-wrap gap-4">
                <a href="#n8n-plans" className="px-8 py-4 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-black text-sm transition-all shadow-xl shadow-violet-600/30 flex items-center gap-2 group">
                  Choose a Plan <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </a>
                <a href="/contact-us" className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black text-sm transition-all border border-white/10">
                  Talk to Sales
                </a>
              </div>
              <div className="flex flex-wrap gap-6 mt-8">
                {['Free SSL Included', 'n8n Pre-Installed', '30-Day Money Back'].map(f => (
                  <span key={f} className="flex items-center gap-2 text-xs text-slate-400 font-bold">
                    <Check size={14} className="text-violet-400" /> {f}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* Right — n8n dashboard mockup */}
            <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.15 }} className="lg:w-1/2">
              <div className="bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                {/* Window chrome */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/[0.03]">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
                  <div className="ml-3 flex-1 bg-white/5 rounded-md px-3 py-1 text-xs text-slate-500 font-mono">n8n.yourdomain.com</div>
                </div>
                {/* n8n workflow mockup */}
                <div className="p-5">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3">Workflow Editor</div>
                  {/* Workflow canvas */}
                  <div className="relative bg-[#0f0f1a] rounded-xl border border-white/5 p-4 h-48 overflow-hidden">
                    {/* Grid dots */}
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                    {/* Nodes */}
                    <div className="absolute top-6 left-6 bg-violet-600 rounded-lg px-3 py-2 text-[10px] font-black shadow-lg shadow-violet-600/30 flex items-center gap-1.5">
                      <Workflow size={12} /> Webhook Trigger
                    </div>
                    <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
                      <path d="M 140 38 C 180 38, 180 70, 220 70" stroke="rgba(139,92,246,0.5)" strokeWidth="2" fill="none" strokeDasharray="4 3" />
                      <path d="M 140 38 C 180 38, 180 105, 220 105" stroke="rgba(99,102,241,0.5)" strokeWidth="2" fill="none" strokeDasharray="4 3" />
                    </svg>
                    <div className="absolute top-14 left-[220px] bg-sky-600/80 rounded-lg px-3 py-2 text-[10px] font-black flex items-center gap-1.5">
                      <Bot size={12} /> AI Agent
                    </div>
                    <div className="absolute top-24 left-[220px] bg-emerald-600/80 rounded-lg px-3 py-2 text-[10px] font-black flex items-center gap-1.5">
                      <Globe size={12} /> Slack Notify
                    </div>
                    <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
                      <path d="M 310 74 C 350 74, 350 90, 380 90" stroke="rgba(34,197,94,0.5)" strokeWidth="2" fill="none" strokeDasharray="4 3" />
                      <path d="M 310 109 C 350 109, 350 90, 380 90" stroke="rgba(34,197,94,0.5)" strokeWidth="2" fill="none" strokeDasharray="4 3" />
                    </svg>
                    <div className="absolute top-[68px] left-[370px] bg-pink-600/80 rounded-lg px-3 py-2 text-[10px] font-black flex items-center gap-1.5">
                      <Zap size={12} /> Google Sheets
                    </div>
                    {/* Status bar */}
                    <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-white/5 rounded-full px-3 py-1 border border-white/5">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] text-emerald-400 font-bold">Running</span>
                    </div>
                  </div>
                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    {[
                      { label: 'Active Workflows', value: '24', color: 'text-violet-400' },
                      { label: 'Executions Today', value: '1,847', color: 'text-emerald-400' },
                      { label: 'Success Rate', value: '99.8%', color: 'text-sky-400' },
                    ].map(s => (
                      <div key={s.label} className="bg-white/[0.03] rounded-xl p-3 border border-white/5 text-center">
                        <div className={`text-lg font-black ${s.color}`}>{s.value}</div>
                        <div className="text-[10px] text-slate-500 font-bold mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── TRUST BAR ── */}
      <section className="py-8 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-wrap items-center justify-center gap-10 md:gap-16">
            {[
              { val: '99.9%', label: 'Uptime SLA' },
              { val: '< 500ms', label: 'Setup Time' },
              { val: '400+', label: 'Integrations' },
              { val: '24/7', label: 'Support' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-black text-white">{s.val}</div>
                <div className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">{s.label}</div>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <div className="flex">
                {[1,2,3,4,5].map(i => <Star key={i} size={16} className="text-amber-400 fill-amber-400" />)}
              </div>
              <span className="text-sm text-slate-400 font-bold">Excellent on Trustpilot</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING PLANS ── */}
      <section id="n8n-plans" className="py-24 bg-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-black px-4 py-2 rounded-full mb-5 uppercase tracking-widest">
              Pricing
            </div>
            <h2 className="text-4xl lg:text-5xl font-black text-white mb-4">
              Choose Your n8n Plan
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              All plans include n8n pre-installed, managed updates, free SSL, and daily backups.
            </p>

            {/* Billing toggle */}
            <div className="flex items-center justify-center gap-4 mt-8">
              <span className={`text-sm font-black ${!yearly ? 'text-white' : 'text-slate-500'}`}>Monthly</span>
              <button
                onClick={() => setYearly(v => !v)}
                className={`relative w-12 h-6 rounded-full transition-colors ${yearly ? 'bg-violet-600' : 'bg-white/10'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${yearly ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
              <span className={`text-sm font-black ${yearly ? 'text-white' : 'text-slate-500'}`}>
                Yearly <span className="text-emerald-400 text-xs ml-1">Save up to 37%</span>
              </span>
            </div>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 items-stretch">
            {PLANS.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`relative flex flex-col rounded-2xl border ${plan.borderColor} overflow-hidden`}
                style={{ background: plan.popular ? 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.10) 100%)' : 'rgba(255,255,255,0.03)' }}
              >
                {plan.badge && (
                  <div className="absolute top-0 left-0 right-0 text-center py-1.5 text-[11px] font-black uppercase tracking-widest text-white bg-violet-600">
                    {plan.badge}
                  </div>
                )}
                <div className={`p-8 flex flex-col flex-1 ${plan.badge ? 'pt-12' : ''}`}>
                  <h3 className="text-xl font-black text-white mb-1">{plan.name}</h3>
                  <p className="text-slate-400 text-sm mb-6">{plan.description}</p>

                  <div className="mb-6">
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-black text-white">
                        ${yearly ? plan.yearlyPrice : plan.monthlyPrice}
                      </span>
                      <span className="text-slate-500 text-sm mb-1">/mo</span>
                    </div>
                    {yearly && (
                      <div className="text-xs text-slate-500 mt-1">
                        Billed as <span className="text-emerald-400 font-bold">${plan.yearlyPrice * 12}/yr</span>
                        <span className="ml-2 text-emerald-400 font-black">Save {plan.savePercent}%</span>
                      </div>
                    )}
                    {!yearly && (
                      <div className="text-xs text-slate-500 mt-1">or ${plan.yearlyPrice}/mo billed yearly</div>
                    )}
                  </div>

                  <button
                    onClick={() => window.location.href = '/client/orders/new'}
                    className={`w-full py-3.5 rounded-xl font-black text-sm transition-all mb-8 ${plan.popular
                      ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-xl shadow-violet-600/30'
                      : 'bg-white/8 hover:bg-white/12 text-white border border-white/10'
                    }`}
                  >
                    Get Started <ArrowRight size={14} className="inline ml-1" />
                  </button>

                  <ul className="space-y-3 flex-1">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-3 text-sm text-slate-300">
                        <Check size={15} className="text-violet-400 flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>

          <p className="text-center text-slate-500 text-sm mt-8">
            Need a custom solution? <a href="/contact-us" className="text-violet-400 hover:text-violet-300 font-bold">Contact us</a> for a tailored quote.
          </p>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-24 bg-[#0d0d1a]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-4xl font-black text-white mb-4">Everything You Need to Run n8n</h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">Built for automation professionals who need reliability, speed, and full control.</p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="bg-white/[0.03] border border-white/8 rounded-2xl p-7 hover:border-violet-500/30 hover:bg-white/[0.05] transition-all group">
                <div className={`${f.color} w-12 h-12 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                  {f.icon}
                </div>
                <h3 className="text-white font-black text-lg mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY SELF-HOSTED ── */}
      <section className="py-24 bg-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-16">

            {/* Left text */}
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="lg:w-1/2">
              <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-black px-4 py-2 rounded-full mb-5 uppercase tracking-widest">
                Why Self-Hosted?
              </div>
              <h2 className="text-4xl font-black text-white mb-6">
                Your Workflows.<br />
                <span className="text-violet-400">Your Rules.</span>
              </h2>
              <p className="text-slate-400 text-base leading-relaxed mb-8">
                n8n Cloud can get expensive fast. With self-hosted, you get unlimited workflows, no per-execution billing, and complete data sovereignty — all on dedicated hardware that's yours.
              </p>
              <div className="space-y-5">
                {WHY_ITEMS.map(item => (
                  <div key={item.title} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 flex-shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-white font-black text-sm mb-1">{item.title}</div>
                      <div className="text-slate-400 text-sm">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right — comparison card */}
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="lg:w-1/2">
              <div className="bg-white/[0.04] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                <div className="grid grid-cols-3 text-center">
                  <div className="py-4 border-b border-r border-white/10 text-slate-500 text-xs font-black uppercase tracking-widest col-span-1" />
                  <div className="py-4 border-b border-r border-white/10 text-slate-400 text-xs font-black uppercase tracking-widest">n8n Cloud</div>
                  <div className="py-4 border-b border-white/10 text-violet-400 text-xs font-black uppercase tracking-widest">Noehost Self-Hosted</div>
                </div>
                {[
                  { label: 'Executions', cloud: 'Limited (pay per)', us: 'Unlimited' },
                  { label: 'Custom Nodes', cloud: '✗ Restricted', us: '✓ Full Access' },
                  { label: 'Data Privacy', cloud: 'Hosted by n8n', us: 'Your Server Only' },
                  { label: 'Monthly Cost', cloud: '$20 – $50+', us: 'From $9/mo' },
                  { label: 'Environment Vars', cloud: '✗ Limited', us: '✓ Full Control' },
                  { label: 'White-label', cloud: '✗ Not Available', us: '✓ Enterprise Plan' },
                ].map((row, i) => (
                  <div key={row.label} className={`grid grid-cols-3 text-sm ${i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                    <div className="py-3.5 px-4 text-slate-400 font-bold border-r border-white/5">{row.label}</div>
                    <div className="py-3.5 px-4 text-center text-slate-500 border-r border-white/5">{row.cloud}</div>
                    <div className="py-3.5 px-4 text-center text-emerald-400 font-bold">{row.us}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-24 bg-[#0d0d1a]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-4xl font-black text-white mb-4">Up and Running in Minutes</h2>
            <p className="text-slate-400 text-lg">No DevOps expertise needed. We handle the hard parts.</p>
          </motion.div>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: '01', icon: <Server size={28} />, title: 'Choose a Plan', desc: 'Pick the plan that fits your workflow volume and team size.' },
              { step: '02', icon: <Play size={28} />, title: 'Server Provisioned', desc: 'Your VPS is spun up with n8n pre-installed within minutes.' },
              { step: '03', icon: <Lock size={28} />, title: 'Secure & Configure', desc: 'SSL installed, domain pointed. Your n8n is ready at your URL.' },
              { step: '04', icon: <Workflow size={28} />, title: 'Build Workflows', desc: 'Log in and start connecting 400+ apps. Automate everything.' },
            ].map((s, i) => (
              <motion.div key={s.step} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="relative text-center p-7 bg-white/[0.03] border border-white/8 rounded-2xl">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs font-black px-3 py-1 rounded-full">
                  Step {s.step}
                </div>
                <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mx-auto mb-5 mt-3">
                  {s.icon}
                </div>
                <h3 className="text-white font-black mb-2">{s.title}</h3>
                <p className="text-slate-400 text-sm">{s.desc}</p>
                {i < 3 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 text-slate-600 text-xl">→</div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-24 bg-[#0a0a0f]">
        <div className="max-w-3xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
            <h2 className="text-4xl font-black text-white mb-4">Frequently Asked Questions</h2>
            <p className="text-slate-400">Everything you need to know about self-hosted n8n.</p>
          </motion.div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className={`w-full text-left flex items-start justify-between gap-4 p-5 rounded-xl border transition-all ${
                    openFaq === i
                      ? 'bg-violet-500/10 border-violet-500/30'
                      : 'bg-white/[0.03] border-white/8 hover:border-white/15'
                  }`}
                >
                  <span className={`font-black text-sm ${openFaq === i ? 'text-violet-300' : 'text-white'}`}>{faq.q}</span>
                  {openFaq === i
                    ? <ChevronUp size={18} className="text-violet-400 flex-shrink-0 mt-0.5" />
                    : <ChevronDown size={18} className="text-slate-500 flex-shrink-0 mt-0.5" />
                  }
                </button>
                {openFaq === i && (
                  <div className="px-5 pt-2 pb-5 text-slate-400 text-sm leading-relaxed border-x border-b border-violet-500/30 rounded-b-xl bg-violet-500/5">
                    {faq.a}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 bg-[#0d0d1a]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="relative rounded-3xl overflow-hidden border border-violet-500/20 p-12"
              style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.10) 100%)' }}>
              <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(ellipse 60% 60% at 50% 0%, rgba(139,92,246,0.15) 0%, transparent 70%)' }} />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-black px-4 py-2 rounded-full mb-6 uppercase tracking-widest">
                  <Zap size={12} /> Start Automating Today
                </div>
                <h2 className="text-4xl lg:text-5xl font-black text-white mb-5">
                  Ready to Own<br />Your Automation Stack?
                </h2>
                <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
                  Join hundreds of teams running n8n on Noehost. Get started in minutes with a 30-day money-back guarantee.
                </p>
                <div className="flex flex-wrap gap-4 justify-center">
                  <a href="#n8n-plans" className="px-8 py-4 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-black text-sm transition-all shadow-xl shadow-violet-600/30 flex items-center gap-2 group">
                    Get Started Now <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </a>
                  <a href="/contact-us" className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black text-sm transition-all border border-white/10">
                    Talk to an Expert
                  </a>
                </div>
                <div className="flex flex-wrap gap-6 justify-center mt-8">
                  {['30-Day Money-Back', 'No Setup Fees', 'Cancel Anytime'].map(f => (
                    <span key={f} className="flex items-center gap-2 text-xs text-slate-400 font-bold">
                      <Check size={14} className="text-violet-400" /> {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

    </div>
  );
};

export default N8nHosting;
