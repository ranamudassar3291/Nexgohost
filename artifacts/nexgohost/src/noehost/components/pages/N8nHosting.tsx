import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, ArrowRight, ChevronDown, ChevronUp,
  Shield, Zap, RefreshCw, Globe, Lock,
  Cpu, GitBranch, Activity, Star, LifeBuoy,
  MessageSquare, Bot, Workflow, Play
} from 'lucide-react';
import { useCurrency } from '../../CurrencyContext';

const PLANS_PKR = [
  {
    name: 'KVM 1',
    badge: '',
    popular: false,
    savePercent: 17,
    monthlyPKR: 1500,
    yearlyPKR: 1250,
    cpu: '2 vCPU',
    ram: '4 GB RAM',
    storage: '50 GB NVMe',
    bandwidth: '4 TB Bandwidth',
    features: [
      'n8n Pre-installed',
      'Free SSL Certificate',
      'Unlimited Workflows',
      'Unlimited Executions',
      'Community Nodes Access',
      'Daily Backups',
      'Managed Updates',
      'Full Root Access',
    ],
  },
  {
    name: 'KVM 2',
    badge: 'MOST POPULAR',
    popular: true,
    savePercent: 17,
    monthlyPKR: 2500,
    yearlyPKR: 2083,
    cpu: '4 vCPU',
    ram: '8 GB RAM',
    storage: '100 GB NVMe',
    bandwidth: '8 TB Bandwidth',
    features: [
      'n8n Pre-installed',
      'Free SSL Certificate',
      'Unlimited Workflows',
      'Unlimited Executions',
      'Community Nodes Access',
      'Daily Backups',
      'Managed Updates',
      'Full Root Access',
      'Priority Support 24/7',
      'Custom Domain Included',
    ],
  },
  {
    name: 'KVM 3',
    badge: '',
    popular: false,
    savePercent: 17,
    monthlyPKR: 4500,
    yearlyPKR: 3750,
    cpu: '6 vCPU',
    ram: '12 GB RAM',
    storage: '200 GB NVMe',
    bandwidth: '12 TB Bandwidth',
    features: [
      'n8n Pre-installed',
      'Free SSL Certificate',
      'Unlimited Workflows',
      'Unlimited Executions',
      'Community Nodes Access',
      'Hourly Backups + Restore',
      'Managed Updates',
      'Full Root Access',
      'Dedicated Support Manager',
      'Custom Domain Included',
      'White-label Ready',
      'Custom SMTP Integration',
    ],
  },
];

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

  return (
    <div className="min-h-screen text-white" style={{ background: '#000000' }}>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden pt-36 pb-20" style={{ background: '#000000' }}>
        {/* Subtle grid bg */}
        <div className="absolute inset-0 opacity-[0.035]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        {/* Purple glow top-right */}
        <div className="absolute top-0 right-0 w-[700px] h-[700px] rounded-full blur-[200px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 65%)' }} />

        <div className="max-w-[1200px] mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">

            {/* LEFT */}
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="lg:w-[480px] flex-shrink-0">
              <p className="text-sm font-semibold mb-5" style={{ color: '#7C3AED' }}>
                Up to <span className="font-black">17% off</span> n8n self hosting
              </p>
              <h1 className="font-black leading-[1.08] tracking-tight mb-7"
                style={{ fontSize: 'clamp(2.2rem, 5vw, 3.2rem)', color: '#FFFFFF' }}>
                Self-hosted n8n:<br />No-code AI workflows
              </h1>
              <ul className="space-y-3 mb-8">
                {[
                  'Unlock unlimited workflows',
                  'Launch unlimited concurrent executions',
                  'Access community nodes',
                ].map(f => (
                  <li key={f} className="flex items-center gap-3 text-[15px]" style={{ color: '#D1D5DB' }}>
                    <Check size={16} className="flex-shrink-0" style={{ color: '#7C3AED' }} />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-4">
                <a href="#n8n-plans"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-[15px] text-white transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}>
                  Choose your plan
                </a>
              </div>
              <p className="flex items-center gap-2 mt-5 text-sm" style={{ color: '#9CA3AF' }}>
                <Shield size={14} style={{ color: '#9CA3AF' }} />
                30-day money-back guarantee
              </p>
            </motion.div>

            {/* RIGHT — n8n workflow diagram */}
            <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.15 }} className="flex-1 flex items-center justify-center">
              <div className="relative w-full max-w-[520px] h-[340px]">
                {/* BG card */}
                <div className="absolute bottom-0 left-4 right-4 h-[200px] rounded-2xl"
                  style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', border: '1px solid rgba(99,102,241,0.3)' }} />

                {/* n8n logo node (large, center-bottom) */}
                <motion.div
                  animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}
                  className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center justify-center rounded-2xl shadow-2xl"
                  style={{ width: 220, height: 72, background: '#1a1a2e', border: '1.5px solid rgba(99,102,241,0.5)', zIndex: 10 }}>
                  {/* n8n logo SVG */}
                  <svg width="80" height="32" viewBox="0 0 80 32" fill="none">
                    <circle cx="8" cy="16" r="7" fill="none" stroke="#666" strokeWidth="2"/>
                    <circle cx="8" cy="16" r="3" fill="#666"/>
                    <line x1="15" y1="16" x2="25" y2="16" stroke="#888" strokeWidth="2"/>
                    <circle cx="30" cy="16" r="5" fill="none" stroke="#888" strokeWidth="2"/>
                    <line x1="35" y1="16" x2="45" y2="16" stroke="#888" strokeWidth="2"/>
                    <circle cx="50" cy="16" r="7" fill="none" stroke="#666" strokeWidth="2"/>
                    <circle cx="50" cy="16" r="3" fill="#666"/>
                    <line x1="57" y1="16" x2="67" y2="16" stroke="#888" strokeWidth="2"/>
                    <circle cx="72" cy="16" r="5" fill="none" stroke="#888" strokeWidth="2"/>
                  </svg>
                </motion.div>

                {/* Chat bubble node (top-left) */}
                <motion.div
                  animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut', delay: 0.5 }}
                  className="absolute top-8 left-8 flex items-center justify-center rounded-2xl shadow-xl"
                  style={{ width: 80, height: 80, background: '#111827', border: '1.5px solid rgba(255,255,255,0.12)', zIndex: 10 }}>
                  <MessageSquare size={32} style={{ color: '#9CA3AF' }} />
                </motion.div>

                {/* Zap node (top-left connector) */}
                <motion.div
                  animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 3.2, ease: 'easeInOut', delay: 0.2 }}
                  className="absolute top-[60px] left-[68px] flex items-center justify-center rounded-full shadow-lg"
                  style={{ width: 36, height: 36, background: '#1e1b4b', border: '1.5px solid rgba(99,102,241,0.5)', zIndex: 20 }}>
                  <Zap size={16} style={{ color: '#818CF8' }} />
                </motion.div>

                {/* AI Agent node (top-center) */}
                <motion.div
                  animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 3.8, ease: 'easeInOut', delay: 0.3 }}
                  className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 rounded-2xl shadow-2xl"
                  style={{ height: 72, background: '#1e1b4b', border: '1.5px solid rgba(99,102,241,0.6)', minWidth: 200, zIndex: 15 }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(99,102,241,0.2)' }}>
                    <Bot size={20} style={{ color: '#818CF8' }} />
                  </div>
                  <span className="font-bold text-white text-[15px]">AI Agent</span>
                </motion.div>

                {/* Edit/pencil node (top-right) */}
                <motion.div
                  animate={{ y: [0, -7, 0] }} transition={{ repeat: Infinity, duration: 3.3, ease: 'easeInOut', delay: 0.7 }}
                  className="absolute top-4 right-8 flex items-center justify-center rounded-2xl shadow-xl"
                  style={{ width: 72, height: 72, background: '#1e1b4b', border: '1.5px solid rgba(99,102,241,0.5)', zIndex: 10 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(129,140,248,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </motion.div>

                {/* Arrow/cursor (right side) */}
                <motion.div
                  animate={{ x: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                  className="absolute top-20 right-2"
                  style={{ zIndex: 20 }}>
                  <svg width="32" height="40" viewBox="0 0 32 40" fill="none">
                    <path d="M4 4L4 32L12 24L18 36L22 34L16 22L28 22L4 4Z" fill="white" stroke="rgba(0,0,0,0.3)" strokeWidth="1"/>
                  </svg>
                </motion.div>

                {/* Connecting lines (SVG overlay) */}
                <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none', zIndex: 5 }}>
                  {/* Chat to Zap */}
                  <line x1="108" y1="88" x2="86" y2="96" stroke="rgba(99,102,241,0.4)" strokeWidth="2" strokeDasharray="5 4"/>
                  {/* AI Agent down to n8n node */}
                  <line x1="260" y1="76" x2="260" y2="228" stroke="rgba(99,102,241,0.35)" strokeWidth="2" strokeDasharray="5 4"/>
                  {/* Edit node down */}
                  <line x1="410" y1="76" x2="350" y2="228" stroke="rgba(99,102,241,0.3)" strokeWidth="2" strokeDasharray="5 4"/>
                </svg>
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
                <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.2)', color: '#818CF8' }}>Save up to 17%</span>
              </button>
            </div>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5">
            {PLANS_PKR.map((plan, i) => {
              const price = yearly ? plan.yearlyPKR : plan.monthlyPKR;
              const displayPrice = convertFromPKR(price);
              const origPrice = convertFromPKR(plan.monthlyPKR);

              return (
                <motion.div
                  key={plan.name}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="relative flex flex-col rounded-2xl overflow-hidden"
                  style={{
                    background: plan.popular
                      ? 'linear-gradient(180deg, #1e1b4b 0%, #0f0e1a 100%)'
                      : '#111111',
                    border: plan.popular
                      ? '1.5px solid rgba(99,102,241,0.5)'
                      : '1px solid rgba(255,255,255,0.08)',
                  }}>

                  {/* % off badge */}
                  <div className="absolute top-4 right-4 text-[11px] font-black px-2.5 py-1 rounded-full"
                    style={{ background: plan.popular ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)', color: '#D1D5DB' }}>
                    {plan.savePercent}% off
                  </div>

                  {/* MOST POPULAR badge */}
                  {plan.badge && (
                    <div className="py-2 text-center text-[11px] font-black uppercase tracking-[0.12em] text-white"
                      style={{ background: 'linear-gradient(90deg, #6D28D9, #7C3AED)' }}>
                      {plan.badge}
                    </div>
                  )}

                  <div className="p-7 flex flex-col flex-1">
                    <h3 className="text-lg font-black text-white mb-1">{plan.name}</h3>

                    {/* Specs pills */}
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {[plan.cpu, plan.ram, plan.storage].map(spec => (
                        <span key={spec} className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                          style={{ background: 'rgba(255,255,255,0.06)', color: '#9CA3AF', border: '1px solid rgba(255,255,255,0.08)' }}>
                          {spec}
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
                      {yearly && (
                        <p className="text-xs" style={{ color: '#6B7280' }}>
                          {origPrice}/mo regular price
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => window.location.href = '/client/orders/new'}
                      className="w-full py-3 rounded-xl font-bold text-[14px] text-white mb-7 transition-all hover:opacity-90"
                      style={{
                        background: plan.popular
                          ? 'linear-gradient(135deg, #7C3AED, #6D28D9)'
                          : 'rgba(255,255,255,0.08)',
                        border: plan.popular ? 'none' : '1px solid rgba(255,255,255,0.12)',
                      }}>
                      Choose your plan
                    </button>

                    {/* Features */}
                    <ul className="space-y-2.5 flex-1">
                      {plan.features.map(f => (
                        <li key={f} className="flex items-start gap-2.5 text-[13px]" style={{ color: '#D1D5DB' }}>
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
