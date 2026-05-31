import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Shield, ChevronDown, ChevronUp,
  Mail, Bot, Lock, Globe, Smartphone, Headphones,
  Star, Check, Zap, Users, HardDrive, RefreshCw,
  Send, Trash2, Folder, FileText, Search, Inbox,
  ArrowRight, BadgeCheck, Clock, Building2
} from 'lucide-react';
import { useCurrency } from '../../CurrencyContext';

/* ─── DATA ───────────────────────────────────────────────────────────────── */

const PLANS = [
  {
    key: 'starter',
    name: 'Business Starter',
    popular: false,
    monthlyPKR: 1099,
    annualPKR: 599,
    storage: '10 GB',
    mailboxes: '1 mailbox',
    save: 45,
    features: [
      '1 email address',
      '10 GB storage per mailbox',
      'Free domain email',
      'Webmail access',
      'iOS & Android apps',
      'Spam & virus protection',
      'SSL encryption',
      '24/7 support',
    ],
  },
  {
    key: 'business',
    name: 'Business',
    popular: true,
    monthlyPKR: 1999,
    annualPKR: 1199,
    storage: '50 GB',
    mailboxes: 'Up to 10 mailboxes',
    save: 40,
    features: [
      'Up to 10 email addresses',
      '50 GB storage per mailbox',
      'Free domain email',
      'Webmail access',
      'iOS & Android apps',
      'Spam & virus protection',
      'SSL encryption',
      '24/7 priority support',
      'Email aliases',
      'Auto-responder',
      'Email forwarding',
      'Catch-all email',
    ],
  },
  {
    key: 'enterprise',
    name: 'Business Enterprise',
    popular: false,
    monthlyPKR: 2999,
    annualPKR: 1799,
    storage: '100 GB',
    mailboxes: 'Unlimited mailboxes',
    save: 40,
    features: [
      'Unlimited email addresses',
      '100 GB storage per mailbox',
      'Free domain email',
      'Webmail access',
      'iOS & Android apps',
      'Advanced spam & virus protection',
      'SSL encryption',
      'Dedicated support manager',
      'Email aliases (unlimited)',
      'Auto-responder',
      'Email forwarding',
      'Catch-all email',
      'Custom email signatures',
      'Admin control panel',
      'Priority migration support',
    ],
  },
];

const WHY_ITEMS = [
  {
    icon: <Bot size={24} />,
    color: '#7C3AED',
    bg: '#F5F3FF',
    title: 'Built-in AI assistant',
    desc: 'Draft replies, summarize long threads, and compose professional emails in seconds — all without leaving your inbox.',
  },
  {
    icon: <Globe size={24} />,
    color: '#0EA5E9',
    bg: '#F0F9FF',
    title: 'Your own domain',
    desc: 'Send from name@yourbusiness.com. A branded address instantly looks more credible to clients and partners.',
  },
  {
    icon: <Lock size={24} />,
    color: '#10B981',
    bg: '#F0FDF4',
    title: 'Spam-free & secure',
    desc: 'Enterprise-grade spam filtering, antivirus scanning, and end-to-end SSL encryption protect every message.',
  },
  {
    icon: <Smartphone size={24} />,
    color: '#F59E0B',
    bg: '#FFFBEB',
    title: 'Any device, anywhere',
    desc: 'Works on iPhone, Android, Outlook, Gmail app, Thunderbird, and our own fast webmail. Always in sync.',
  },
  {
    icon: <HardDrive size={24} />,
    color: '#8B5CF6',
    bg: '#F5F3FF',
    title: 'Generous storage',
    desc: 'Up to 100 GB per mailbox — no more "storage full" alerts. Keep every email without deleting anything.',
  },
  {
    icon: <Headphones size={24} />,
    color: '#EC4899',
    bg: '#FDF2F8',
    title: '24/7 expert support',
    desc: 'Our email specialists are online around the clock to help with setup, migration, or any question.',
  },
];

const FAQS = [
  {
    q: 'What is business email hosting?',
    a: 'Business email hosting lets you send and receive emails using your own domain name (e.g. john@yourcompany.com) rather than a generic Gmail or Yahoo address. It\'s hosted on professional mail servers with high uptime, security, and storage.',
  },
  {
    q: 'Can I use my existing domain name?',
    a: 'Yes. You can connect any domain you already own by updating its MX records — we provide step-by-step instructions. The setup takes about 5–10 minutes and usually propagates within an hour.',
  },
  {
    q: 'How do I access my business email?',
    a: 'You can access it via our webmail at any browser, the iOS or Android mail apps, or any IMAP/SMTP client like Outlook, Apple Mail, or Thunderbird. All mailboxes sync in real-time across devices.',
  },
  {
    q: 'Can I migrate my existing emails from Gmail or Outlook?',
    a: 'Yes — we include free email migration assistance. You can import all your existing emails, contacts, and calendar events without any data loss.',
  },
  {
    q: 'How many email accounts can I create?',
    a: 'Business Starter supports 1 mailbox, Business supports up to 10 mailboxes, and Business Enterprise supports unlimited mailboxes with no extra charge per address.',
  },
  {
    q: 'Is there a money-back guarantee?',
    a: 'Absolutely. All plans come with a 30-day money-back guarantee. If you\'re not satisfied for any reason, contact support within 30 days for a full refund — no questions asked.',
  },
];

/* ─── COMPONENT ─────────────────────────────────────────────────────────── */

export default function BusinessEmail() {
  const [annual, setAnnual] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { convertFromPKR } = useCurrency();

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827', background: '#fff' }}>

      {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ background: '#fff', paddingTop: 100 }}>
        {/* Purple shape — top right, exact Hostinger style */}
        <div className="absolute top-0 right-0 pointer-events-none" style={{
          width: '52%', height: 420,
          background: 'linear-gradient(145deg, #EDE9FE 0%, #DDD6FE 60%, #C4B5FD 100%)',
          borderBottomLeftRadius: 80, zIndex: 0,
        }} />

        <div className="relative z-10 max-w-6xl mx-auto px-6 pb-0">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-4">

            {/* Left column */}
            <div className="lg:w-[420px] flex-shrink-0 pb-16 lg:pb-24">
              <p className="text-sm font-bold mb-4" style={{ color: '#7C3AED', letterSpacing: '0.01em' }}>
                Business email
              </p>
              <h1 style={{
                fontSize: 'clamp(2.1rem, 5vw, 3.5rem)',
                fontWeight: 900,
                lineHeight: 1.06,
                letterSpacing: '-0.02em',
                color: '#111827',
                marginBottom: 24,
              }}>
                Build trust with<br />every email
              </h1>

              <ul className="space-y-3 mb-8">
                {[
                  'Work faster with built-in AI',
                  'Look professional with a personal domain',
                ].map(txt => (
                  <li key={txt} className="flex items-center gap-3 text-sm" style={{ color: '#374151' }}>
                    <CheckCircle2 size={16} style={{ color: '#7C3AED', flexShrink: 0 }} />
                    {txt}
                  </li>
                ))}
              </ul>

              <a
                href="#pricing"
                className="inline-flex items-center gap-2 font-bold text-sm text-white transition-opacity hover:opacity-90"
                style={{
                  background: '#673DE6',
                  padding: '13px 28px',
                  borderRadius: 10,
                }}
              >
                Choose plan
              </a>

              <div className="flex items-center gap-2 mt-5 text-sm" style={{ color: '#6B7280' }}>
                <Shield size={14} style={{ color: '#9CA3AF' }} />
                30-day money-back guarantee
              </div>
            </div>

            {/* Right column — email mockup */}
            <div className="flex-1 flex justify-end relative pt-6 pb-0">
              <div
                className="w-full rounded-xl overflow-hidden shadow-2xl"
                style={{
                  maxWidth: 620,
                  border: '1px solid #E5E7EB',
                  background: '#fff',
                  fontSize: 12,
                }}
              >
                {/* Window chrome */}
                <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-gray-100" style={{ background: '#F9FAFB' }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#FC5C5C' }} />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#FCBC3D' }} />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#27C840' }} />
                  <div className="flex items-center gap-2 ml-2 flex-1">
                    <span className="font-black text-[10px]" style={{ color: '#673DE6' }}>NOEHOST</span>
                    <span style={{ color: '#D1D5DB' }}>|</span>
                    <span className="font-semibold text-[10px]" style={{ color: '#6B7280' }}>Mail</span>
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <div className="flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-[9px] text-gray-400">
                      <Search size={9} /> Search mail
                    </div>
                  </div>
                </div>

                <div className="flex" style={{ height: 300 }}>
                  {/* Sidebar */}
                  <div className="flex-shrink-0 border-r border-gray-100 flex flex-col py-2" style={{ width: 150, background: '#FAFAFA' }}>
                    <div className="px-2 mb-3">
                      <button className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold text-white" style={{ background: '#673DE6' }}>
                        <Send size={9} /> New message
                      </button>
                    </div>
                    {[
                      { icon: <Inbox size={11} />, label: 'Inbox', badge: 4 },
                      { icon: <FileText size={11} />, label: 'Drafts' },
                      { icon: <Send size={11} />, label: 'Sent' },
                      { icon: <Trash2 size={11} />, label: 'Spam' },
                      { icon: <Trash2 size={11} />, label: 'Trash' },
                      { icon: <Folder size={11} />, label: 'Folders', action: '+' },
                      { icon: <Users size={11} />, label: 'Contacts' },
                    ].map((item, i) => (
                      <div key={item.label}
                        className="flex items-center justify-between px-3 py-1.5 cursor-pointer text-[10px]"
                        style={{ color: i === 0 ? '#111827' : '#6B7280', fontWeight: i === 0 ? 700 : 500 }}>
                        <div className="flex items-center gap-2">
                          <span style={{ color: i === 0 ? '#673DE6' : '#9CA3AF' }}>{item.icon}</span>
                          {item.label}
                        </div>
                        {item.badge && (
                          <span className="text-[9px] font-black text-white px-1.5 rounded-full" style={{ background: '#673DE6' }}>{item.badge}</span>
                        )}
                        {item.action && <span className="text-gray-400">{item.action}</span>}
                      </div>
                    ))}
                  </div>

                  {/* Email list */}
                  <div className="flex-shrink-0 border-r border-gray-100 overflow-hidden" style={{ width: 195 }}>
                    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-100">
                      <span className="text-[10px] font-bold" style={{ color: '#111827' }}>All mail</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded text-gray-400 bg-gray-100 ml-1">Unread</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded text-gray-400 bg-gray-100">Read</span>
                    </div>
                    {[
                      { name: 'Sara Okafor', sub: 'Final files are ready...', date: 'Oct 23', avatar: '#673DE6', attach: true },
                      { name: 'Lucas Taylor', sub: 'Thanks for the update!', date: 'Jun 3', avatar: '#0EA5E9' },
                      { name: 'Ethan Williams', sub: 'Project proposal attached', date: '10:12 AM', avatar: '#10B981', star: true, attach: true },
                      { name: 'Sophia Johnson', sub: 'Invoice #1042 — paid ✓', date: '12:34 PM', avatar: '#F59E0B', attach: true },
                      { name: 'Liam Davis', sub: 'Quick question about...', date: 'Oct 24', avatar: '#EC4899' },
                    ].map((email, i) => (
                      <div key={email.name}
                        className="flex items-start gap-2 px-3 py-2 border-b border-gray-50 cursor-pointer"
                        style={{ background: i === 0 ? '#F9F8FF' : 'transparent' }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black text-white flex-shrink-0 mt-0.5"
                          style={{ background: email.avatar }}>
                          {email.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold truncate" style={{ color: '#111827', maxWidth: 90 }}>{email.name}</span>
                            <div className="flex items-center gap-1">
                              {email.star && <Star size={8} className="fill-amber-400 text-amber-400" />}
                              {email.attach && <span className="text-gray-400 text-[9px]">📎</span>}
                              <span className="text-[9px] text-gray-400">{email.date}</span>
                            </div>
                          </div>
                          <p className="text-[9px] text-gray-400 truncate mt-0.5">{email.sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Email detail */}
                  <div className="flex-1 p-4 overflow-hidden hidden sm:block">
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-[11px] font-bold leading-snug" style={{ color: '#111827' }}>Logo Project — Final Files Delivered</span>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        <button className="text-[9px] px-2 py-0.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50">Summarize</button>
                      </div>
                    </div>
                    <div className="text-[9px] mb-3" style={{ color: '#6B7280' }}>
                      <span className="font-semibold">From Sara Okafor</span><br />
                      to me ▾
                    </div>
                    <div className="text-[10px] leading-relaxed" style={{ color: '#374151' }}>
                      Hi Tom,<br /><br />
                      The final logo files are ready. You'll find all formats (SVG, PNG, PDF) in the{' '}
                      <span className="underline cursor-pointer" style={{ color: '#673DE6' }}>shared folder</span>.
                      <br />Let me know if you need adjustments.<br /><br />
                      Best,<br />Sara Okafor<br />
                      <span style={{ color: '#9CA3AF', fontSize: 9 }}>Brand Designer · sara@saraokafor.com</span>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button className="text-[9px] px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 font-medium">↩ Reply</button>
                      <button className="text-[9px] px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 font-medium">→ Forward</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══ TRUSTPILOT ════════════════════════════════════════════════════════ */}
      <section className="py-8 border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-center gap-2.5">
          <span className="font-semibold text-sm text-gray-800">Excellent</span>
          <div className="flex gap-0.5">
            {[0,1,2,3,4].map(i => (
              <div key={i} className="w-5 h-5 flex items-center justify-center" style={{ background: i < 4 ? '#00B67A' : '#DBEAFE' }}>
                <Star size={12} className={i < 4 ? 'fill-white text-white' : 'fill-[#00B67A] text-[#00B67A]'} />
              </div>
            ))}
          </div>
          <span className="text-sm text-gray-500">
            <span className="underline cursor-pointer">68,298 reviews</span> on
          </span>
          <div className="flex items-center gap-1">
            <div className="flex gap-0.5">
              {[0,1,2,3,4].map(i => (
                <div key={i} className="w-4 h-4 flex items-center justify-center" style={{ background: '#00B67A' }}>
                  <Star size={10} className="fill-white text-white" />
                </div>
              ))}
            </div>
            <span className="font-black text-sm" style={{ color: '#191919' }}>Trustpilot</span>
          </div>
        </div>
      </section>

      {/* ══ MAKE THE RIGHT IMPRESSION ═════════════════════════════════════════ */}
      <section className="py-20" style={{ background: '#12113A' }}>
        <div className="max-w-6xl mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 style={{
              fontSize: 'clamp(2.2rem, 5vw, 3.8rem)',
              fontWeight: 900,
              letterSpacing: '-0.025em',
              lineHeight: 1.05,
              color: '#fff',
              marginBottom: 20,
            }}>
              Make the right<br />
              <span style={{ color: '#A78BFA' }}>impression</span>
            </h2>
            <p className="text-base mb-14 mx-auto" style={{ color: '#94A3B8', maxWidth: 560 }}>
              Every email you send says something about your business. Stand out with a professional address that matches your brand and builds lasting trust.
            </p>

            <div className="grid md:grid-cols-3 gap-5 text-left">
              {[
                {
                  icon: <Mail size={22} />,
                  color: '#A78BFA',
                  title: 'Your name, your brand',
                  desc: 'hello@yourbusiness.com looks infinitely more professional than a free email — and clients notice immediately.',
                },
                {
                  icon: <Bot size={22} />,
                  color: '#34D399',
                  title: 'AI writes for you',
                  desc: 'Built-in AI drafts, summarizes, and polishes your emails so you spend less time writing and more time running your business.',
                },
                {
                  icon: <Shield size={22} />,
                  color: '#FBBF24',
                  title: 'Secure & reliable',
                  desc: 'Enterprise spam filters, antivirus protection, and SSL encryption keep your inbox clean, private, and always available.',
                },
              ].map((c, i) => (
                <motion.div key={c.title}
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                  className="p-6 rounded-2xl"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                    style={{ background: 'rgba(255,255,255,0.08)', color: c.color }}>
                    {c.icon}
                  </div>
                  <h3 className="font-bold text-white mb-2" style={{ fontSize: 15 }}>{c.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>{c.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══ WHY BUSINESS EMAIL ════════════════════════════════════════════════ */}
      <section className="py-20" style={{ background: '#fff' }}>
        <div className="max-w-6xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-12">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#7C3AED' }}>Why business email</p>
            <h2 style={{ fontSize: 'clamp(1.7rem, 3.5vw, 2.5rem)', fontWeight: 900, letterSpacing: '-0.02em', color: '#111827', marginBottom: 12 }}>
              Everything your team needs
            </h2>
            <p className="text-sm" style={{ color: '#6B7280', maxWidth: 440 }}>
              Professional tools built for businesses of every size — from solo founders to enterprise teams.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHY_ITEMS.map((item, i) => (
              <motion.div key={item.title}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
                className="group flex gap-4 p-5 rounded-2xl transition-all hover:shadow-md"
                style={{ border: '1px solid #F3F4F6' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                  style={{ background: item.bg, color: item.color }}>
                  {item.icon}
                </div>
                <div>
                  <h3 className="font-bold mb-1 text-sm" style={{ color: '#111827' }}>{item.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: '#6B7280' }}>{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PRICING ═══════════════════════════════════════════════════════════ */}
      <section id="pricing" className="py-20" style={{ background: '#FAFAFA' }}>
        <div className="max-w-6xl mx-auto px-6">

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#7C3AED' }}>Pricing</p>
            <h2 style={{ fontSize: 'clamp(1.7rem, 3.5vw, 2.4rem)', fontWeight: 900, letterSpacing: '-0.02em', color: '#111827', marginBottom: 10 }}>
              Get business email today
            </h2>
            <p className="text-sm mb-8" style={{ color: '#6B7280' }}>Professional email at a price that fits every business.</p>

            {/* Billing toggle — pill style like Hostinger */}
            <div className="inline-flex items-center rounded-full p-1" style={{ background: '#E5E7EB' }}>
              <button
                onClick={() => setAnnual(false)}
                className="px-5 py-2 rounded-full text-sm font-semibold transition-all"
                style={{
                  background: !annual ? '#fff' : 'transparent',
                  color: !annual ? '#111827' : '#6B7280',
                  boxShadow: !annual ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                }}
              >
                Monthly
              </button>
              <button
                onClick={() => setAnnual(true)}
                className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all"
                style={{
                  background: annual ? '#fff' : 'transparent',
                  color: annual ? '#111827' : '#6B7280',
                  boxShadow: annual ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                }}
              >
                Annual
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-white" style={{ background: '#673DE6' }}>
                  Save up to 45%
                </span>
              </button>
            </div>
          </motion.div>

          {/* Plan cards */}
          <div className="grid md:grid-cols-3 gap-5">
            {PLANS.map((plan, i) => {
              const price = annual ? plan.annualPKR : plan.monthlyPKR;
              const original = plan.monthlyPKR;
              const displayPrice = convertFromPKR(price);
              const displayOriginal = convertFromPKR(original);

              return (
                <motion.div key={plan.key}
                  initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                  className="relative flex flex-col rounded-2xl overflow-hidden"
                  style={{
                    background: '#fff',
                    border: plan.popular ? '2px solid #673DE6' : '1px solid #E5E7EB',
                    boxShadow: plan.popular ? '0 4px 32px rgba(103,61,230,0.14)' : 'none',
                  }}>

                  {/* Most popular badge */}
                  {plan.popular && (
                    <div className="text-center py-2 text-[10px] font-black uppercase tracking-widest text-white"
                      style={{ background: 'linear-gradient(90deg, #5B21B6, #673DE6)' }}>
                      ★ Most popular
                    </div>
                  )}

                  <div className="p-7 flex flex-col flex-1">
                    {/* Plan name */}
                    <div className="mb-5">
                      <h3 className="font-black mb-0.5" style={{ fontSize: 17, color: '#111827' }}>{plan.name}</h3>
                      <p className="text-xs" style={{ color: '#6B7280' }}>{plan.mailboxes} · {plan.storage}/mailbox</p>
                    </div>

                    {/* Price */}
                    <div className="mb-6">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-black" style={{ fontSize: '2.2rem', lineHeight: 1, color: '#111827' }}>{displayPrice}</span>
                        <span className="text-sm font-medium" style={{ color: '#6B7280' }}>/mo</span>
                      </div>
                      {annual ? (
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs line-through" style={{ color: '#9CA3AF' }}>{displayOriginal}/mo</span>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-white" style={{ background: '#673DE6' }}>
                            -{plan.save}%
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs mt-1.5" style={{ color: '#6B7280' }}>
                          or {convertFromPKR(plan.annualPKR)}/mo billed annually
                        </p>
                      )}
                    </div>

                    {/* CTA button */}
                    <button
                      onClick={() => window.location.href = '/client/orders/new'}
                      className="w-full py-3 rounded-xl text-sm font-bold mb-7 transition-all hover:opacity-90"
                      style={{
                        background: plan.popular ? '#673DE6' : '#F3F4F6',
                        color: plan.popular ? '#fff' : '#374151',
                        border: plan.popular ? 'none' : '1px solid #E5E7EB',
                      }}>
                      Add to cart
                    </button>

                    {/* Features */}
                    <ul className="space-y-2.5 flex-1">
                      {plan.features.map(f => (
                        <li key={f} className="flex items-start gap-2.5 text-xs" style={{ color: '#374151' }}>
                          <Check size={13} className="flex-shrink-0 mt-0.5" style={{ color: '#673DE6' }} />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Trust badges below pricing */}
          <div className="flex flex-wrap items-center justify-center gap-8 mt-10">
            {[
              { icon: <Shield size={16} />, text: '30-Day Money-Back Guarantee' },
              { icon: <RefreshCw size={16} />, text: 'Free Email Migration' },
              { icon: <Zap size={16} />, text: 'Setup in Minutes' },
            ].map(b => (
              <div key={b.text} className="flex items-center gap-2 text-sm" style={{ color: '#6B7280' }}>
                <span style={{ color: '#673DE6' }}>{b.icon}</span>
                {b.text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ WHAT'S INCLUDED (feature comparison) ═════════════════════════════ */}
      <section className="py-20" style={{ background: '#fff' }}>
        <div className="max-w-6xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 style={{ fontSize: 'clamp(1.7rem, 3.5vw, 2.4rem)', fontWeight: 900, letterSpacing: '-0.02em', color: '#111827', marginBottom: 10 }}>
              What's included in every plan
            </h2>
            <p className="text-sm" style={{ color: '#6B7280' }}>Professional email hosting features built for reliability and productivity.</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: <Globe size={20} />, color: '#673DE6', bg: '#F5F3FF', title: 'Custom domain email', desc: 'your@business.com' },
              { icon: <Lock size={20} />, color: '#10B981', bg: '#F0FDF4', title: 'SSL encryption', desc: 'End-to-end security' },
              { icon: <Smartphone size={20} />, color: '#0EA5E9', bg: '#F0F9FF', title: 'iOS & Android apps', desc: 'Email on any device' },
              { icon: <BadgeCheck size={20} />, color: '#F59E0B', bg: '#FFFBEB', title: 'Spam protection', desc: 'Powered by AI filters' },
              { icon: <RefreshCw size={20} />, color: '#8B5CF6', bg: '#F5F3FF', title: 'Daily backups', desc: 'Never lose a message' },
              { icon: <Clock size={20} />, color: '#EC4899', bg: '#FDF2F8', title: '99.9% uptime', desc: 'Always-on reliability' },
              { icon: <Building2 size={20} />, color: '#0EA5E9', bg: '#F0F9FF', title: 'Admin panel', desc: 'Manage your team' },
              { icon: <Headphones size={20} />, color: '#10B981', bg: '#F0FDF4', title: '24/7 support', desc: 'We\'re always here' },
            ].map((card, i) => (
              <motion.div key={card.title}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}
                className="flex items-start gap-3 p-5 rounded-xl"
                style={{ background: '#FAFAFA', border: '1px solid #F3F4F6' }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: card.bg, color: card.color }}>
                  {card.icon}
                </div>
                <div>
                  <p className="font-semibold text-xs" style={{ color: '#111827' }}>{card.title}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>{card.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ══════════════════════════════════════════════════════ */}
      <section className="py-20" style={{ background: '#FAFAFA' }}>
        <div className="max-w-6xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 style={{ fontSize: 'clamp(1.7rem, 3.5vw, 2.4rem)', fontWeight: 900, letterSpacing: '-0.02em', color: '#111827', marginBottom: 10 }}>
              Set up in minutes
            </h2>
            <p className="text-sm" style={{ color: '#6B7280' }}>From purchase to your first professional email in 4 simple steps.</p>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-4 relative">
            {[
              { n: '01', icon: <Mail size={20} />, color: '#673DE6', bg: '#F5F3FF', title: 'Choose a plan', desc: 'Pick the plan that matches your team size.' },
              { n: '02', icon: <Globe size={20} />, color: '#0EA5E9', bg: '#F0F9FF', title: 'Connect your domain', desc: 'Link your domain or register a new one.' },
              { n: '03', icon: <Users size={20} />, color: '#10B981', bg: '#F0FDF4', title: 'Create mailboxes', desc: 'Add email addresses for every team member.' },
              { n: '04', icon: <Send size={20} />, color: '#F59E0B', bg: '#FFFBEB', title: 'Start emailing', desc: 'Use webmail, phone, or any mail client.' },
            ].map((step, i) => (
              <motion.div key={step.n}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="relative text-center p-6 rounded-2xl"
                style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
                <div className="text-[10px] font-black mb-4" style={{ color: '#9CA3AF', letterSpacing: '0.1em' }}>{step.n}</div>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: step.bg, color: step.color }}>
                  {step.icon}
                </div>
                <h3 className="font-bold mb-1.5 text-sm" style={{ color: '#111827' }}>{step.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: '#6B7280' }}>{step.desc}</p>
                {i < 3 && (
                  <div className="hidden md:flex absolute top-1/2 -right-3 -translate-y-1/2 z-10 w-6 h-6 items-center justify-center">
                    <ArrowRight size={14} style={{ color: '#D1D5DB' }} />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FAQ ═══════════════════════════════════════════════════════════════ */}
      <section className="py-20" style={{ background: '#fff' }}>
        <div className="max-w-2xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
            <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 900, letterSpacing: '-0.02em', color: '#111827', marginBottom: 8 }}>
              Frequently asked questions
            </h2>
            <p className="text-sm" style={{ color: '#6B7280' }}>Everything you need to know about business email hosting.</p>
          </motion.div>

          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} style={{ border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left flex items-center justify-between gap-4 px-5 py-4 transition-colors"
                  style={{ background: openFaq === i ? '#F9F8FF' : '#fff' }}>
                  <span className="font-semibold text-sm" style={{ color: '#111827' }}>{faq.q}</span>
                  {openFaq === i
                    ? <ChevronUp size={16} style={{ color: '#673DE6', flexShrink: 0 }} />
                    : <ChevronDown size={16} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                  }
                </button>
                <AnimatePresence initial={false}>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      style={{ overflow: 'hidden' }}>
                      <div className="px-5 py-4 text-sm leading-relaxed"
                        style={{ color: '#6B7280', borderTop: '1px solid #F3F4F6' }}>
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ BOTTOM CTA ════════════════════════════════════════════════════════ */}
      <section className="py-20" style={{ background: '#12113A' }}>
        <div className="max-w-2xl mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#A78BFA' }}>Get started today</p>
            <h2 style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', fontWeight: 900, letterSpacing: '-0.02em', color: '#fff', marginBottom: 12 }}>
              Start building trust with every email
            </h2>
            <p className="text-sm mb-8" style={{ color: '#94A3B8' }}>
              Professional business email, set up in minutes. 30-day money-back guarantee.
            </p>
            <a
              href="#pricing"
              className="inline-flex items-center gap-2 font-bold text-sm text-white transition-opacity hover:opacity-90"
              style={{ background: '#673DE6', padding: '13px 32px', borderRadius: 10 }}>
              Choose your plan <ArrowRight size={15} />
            </a>
            <div className="flex flex-wrap gap-6 justify-center mt-8">
              {['30-Day Money-Back', 'Custom Domain Email', 'Cancel Anytime'].map(f => (
                <span key={f} className="flex items-center gap-2 text-xs" style={{ color: '#94A3B8' }}>
                  <Check size={12} style={{ color: '#A78BFA' }} /> {f}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

    </div>
  );
}
