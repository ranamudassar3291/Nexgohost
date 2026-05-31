import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, ArrowRight, Shield, Zap, Star,
  ChevronDown, ChevronUp, Mail, Bot, Inbox,
  Send, Trash2, Folder, Users, Search,
  Lock, Globe, RefreshCw, LifeBuoy, Smartphone,
  CheckCircle2, MessageSquare, Calendar, FileText
} from 'lucide-react';
import { useCurrency } from '../../CurrencyContext';

const PLANS_PKR = [
  {
    name: 'Business Starter',
    badge: '',
    popular: false,
    savePercent: 42,
    monthlyPKR: 1199,
    yearlyPKR: 699,
    storage: '10 GB / mailbox',
    users: '1 user',
    features: [
      'Professional email address',
      'Custom domain email',
      '10 GB mailbox storage',
      'Webmail access',
      'Mobile & desktop apps',
      'Free SSL security',
      'Spam & virus protection',
      '24/7 email support',
    ],
  },
  {
    name: 'Business Pro',
    badge: 'MOST POPULAR',
    popular: true,
    savePercent: 40,
    monthlyPKR: 1999,
    yearlyPKR: 1199,
    storage: '50 GB / mailbox',
    users: 'Up to 10 users',
    features: [
      'Professional email address',
      'Custom domain email',
      '50 GB mailbox storage',
      'Webmail access',
      'Mobile & desktop apps',
      'Free SSL security',
      'Spam & virus protection',
      '24/7 priority support',
      'Email aliases',
      'Auto-responders',
      'Email forwarding',
    ],
  },
  {
    name: 'Business Enterprise',
    badge: '',
    popular: false,
    savePercent: 43,
    monthlyPKR: 3499,
    yearlyPKR: 1999,
    storage: '100 GB / mailbox',
    users: 'Unlimited users',
    features: [
      'Professional email address',
      'Custom domain email',
      '100 GB mailbox storage',
      'Webmail access',
      'Mobile & desktop apps',
      'Free SSL security',
      'Advanced spam protection',
      'Dedicated support manager',
      'Email aliases (unlimited)',
      'Auto-responders',
      'Email forwarding',
      'Custom email signatures',
      'Admin control panel',
    ],
  },
];

const FEATURES = [
  { icon: <Bot size={26} />, color: '#7C3AED', bg: 'rgba(124,58,237,0.1)', title: 'AI-Powered Inbox', desc: 'Smart AI summarizes long threads, suggests replies, and helps you compose professional emails in seconds.' },
  { icon: <Globe size={26} />, color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)', title: 'Custom Domain Email', desc: 'Send emails from you@yourbusiness.com — build credibility and trust with every message you send.' },
  { icon: <Lock size={26} />, color: '#10B981', bg: 'rgba(16,185,129,0.1)', title: 'Enterprise Security', desc: 'SSL encryption, advanced spam filtering, and virus protection keep your mailbox safe and clean.' },
  { icon: <Smartphone size={26} />, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', title: 'Works Everywhere', desc: 'Access your email on any device — webmail, iOS, Android, Outlook, or any IMAP/SMTP client.' },
  { icon: <RefreshCw size={26} />, color: '#EC4899', bg: 'rgba(236,72,153,0.1)', title: 'Auto-Backup & Recovery', desc: 'Daily backups ensure your emails are never lost. Restore deleted messages anytime with one click.' },
  { icon: <LifeBuoy size={26} />, color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)', title: '24/7 Expert Support', desc: 'Our email specialists are available around the clock to help with setup, migration, and troubleshooting.' },
];

const FAQS = [
  { q: 'What is a professional business email?', a: 'A business email uses your own domain name (e.g. john@yourcompany.com) instead of a generic address like Gmail or Yahoo. It looks more professional, builds brand trust, and is essential for any serious business.' },
  { q: 'Can I use my existing domain?', a: 'Yes! You can connect any domain you already own to your business email. We\'ll walk you through the simple DNS setup — it takes about 5 minutes.' },
  { q: 'How many email accounts can I create?', a: 'It depends on your plan. Business Starter supports 1 user, Business Pro supports up to 10 users, and Business Enterprise supports unlimited users with no extra charge per mailbox.' },
  { q: 'Can I access email on my phone?', a: 'Absolutely. Your business email works with any mail client including iPhone Mail, Gmail app, Outlook, Thunderbird, and our own webmail — all synced in real-time.' },
  { q: 'Is email migration from Gmail or Outlook included?', a: 'Yes. We provide free email migration assistance. You can import all your existing emails, contacts, and calendar data without losing anything.' },
  { q: 'Is there a money-back guarantee?', a: 'Yes — all plans include a 30-day money-back guarantee. If you\'re not completely satisfied, contact our support team within 30 days for a full refund.' },
];

const BusinessEmail: React.FC = () => {
  const [yearly, setYearly] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { convertFromPKR } = useCurrency();

  return (
    <div className="min-h-screen text-gray-900" style={{ background: '#FFFFFF' }}>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden pt-36 pb-0" style={{ background: '#FFFFFF' }}>
        {/* Top-right purple shape like Hostinger */}
        <div className="absolute top-0 right-0 w-[55%] h-[400px] rounded-bl-[80px] pointer-events-none"
          style={{ background: 'linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%)', zIndex: 0 }} />

        <div className="max-w-[1200px] mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-10">

            {/* LEFT */}
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="lg:w-[440px] flex-shrink-0 pb-20">
              <p className="text-sm font-bold mb-3" style={{ color: '#7C3AED' }}>Business email</p>
              <h1 className="font-black leading-[1.08] tracking-tight mb-7 text-gray-900"
                style={{ fontSize: 'clamp(2.2rem, 5vw, 3.6rem)' }}>
                Build trust with<br />every email
              </h1>
              <ul className="space-y-3 mb-8">
                {['Work faster with built-in AI', 'Look professional with a personal domain'].map(f => (
                  <li key={f} className="flex items-center gap-3 text-[15px] text-gray-600">
                    <CheckCircle2 size={17} style={{ color: '#7C3AED', flexShrink: 0 }} />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-4">
                <a href="#email-plans"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-[15px] text-white transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}>
                  Choose plan
                </a>
              </div>
              <p className="flex items-center gap-2 mt-5 text-sm text-gray-500">
                <Shield size={14} className="text-gray-400" />
                30-day money-back guarantee
              </p>
            </motion.div>

            {/* RIGHT — Email client mockup */}
            <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.15 }} className="flex-1 relative pt-8">
              <div className="rounded-2xl shadow-2xl overflow-hidden border border-gray-100 relative z-10"
                style={{ background: '#FFFFFF', maxWidth: 640, marginLeft: 'auto' }}>
                {/* Titlebar */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100" style={{ background: '#F9FAFB' }}>
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <div className="ml-3 flex items-center gap-2 flex-1">
                    <span className="text-xs font-bold text-gray-400">NOEHOST</span>
                    <span className="text-xs text-gray-400">|</span>
                    <span className="text-xs font-bold text-gray-600">Mail</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Search size={14} className="text-gray-400" />
                    <span className="text-xs text-gray-400">Search mail</span>
                  </div>
                </div>

                <div className="flex">
                  {/* Sidebar */}
                  <div className="w-48 border-r border-gray-100 py-3" style={{ background: '#FAFAFA' }}>
                    <button className="w-full mx-3 px-3 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-2 mb-4"
                      style={{ background: '#7C3AED', width: 'calc(100% - 24px)' }}>
                      <Mail size={13} /> New message
                    </button>
                    {[
                      { icon: <Inbox size={14} />, label: 'Inbox', count: 4, active: true },
                      { icon: <FileText size={14} />, label: 'Drafts', count: null, active: false },
                      { icon: <Send size={14} />, label: 'Sent', count: null, active: false },
                      { icon: <MessageSquare size={14} />, label: 'Spam', count: null, active: false },
                      { icon: <Trash2 size={14} />, label: 'Trash', count: null, active: false },
                      { icon: <Folder size={14} />, label: 'Folders', count: null, active: false },
                      { icon: <Users size={14} />, label: 'Contacts', count: null, active: false },
                    ].map(item => (
                      <div key={item.label} className={`flex items-center justify-between px-4 py-2 text-xs font-medium cursor-pointer ${item.active ? 'text-gray-900 font-bold' : 'text-gray-500 hover:text-gray-700'}`}>
                        <div className="flex items-center gap-2">
                          <span style={{ color: item.active ? '#7C3AED' : '#9CA3AF' }}>{item.icon}</span>
                          {item.label}
                        </div>
                        {item.count && <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full text-white" style={{ background: '#7C3AED' }}>{item.count}</span>}
                      </div>
                    ))}
                  </div>

                  {/* Email list */}
                  <div className="flex-1 border-r border-gray-100">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
                      <span className="text-xs font-black text-gray-700">All mail</span>
                      <span className="text-xs text-gray-400 px-2 py-0.5 rounded-full bg-gray-100">Unread</span>
                      <span className="text-xs text-gray-400 px-2 py-0.5 rounded-full bg-gray-100">Read</span>
                    </div>
                    {[
                      { name: 'Sara Okafor', date: 'Oct 23', starred: false, attach: true },
                      { name: 'Lucas Taylor', date: 'Jun 3', starred: false, attach: false },
                      { name: 'Ethan Williams', date: '10:12 AM', starred: true, attach: true },
                      { name: 'Sophia Johnson', date: '12:34 PM', starred: false, attach: true },
                      { name: 'Liam Davis', date: 'Oct 24', starred: false, attach: false },
                    ].map((email, i) => (
                      <div key={email.name} className={`flex items-center gap-2 px-3 py-2.5 border-b border-gray-50 cursor-pointer hover:bg-purple-50/50 text-xs ${i === 0 ? 'bg-purple-50/30' : ''}`}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                          style={{ background: ['#7C3AED','#0EA5E9','#10B981','#F59E0B','#EC4899'][i] }}>
                          {email.name[0]}
                        </div>
                        <span className="flex-1 font-medium text-gray-700 truncate">{email.name}</span>
                        {email.starred && <Star size={11} className="text-amber-400 fill-amber-400 flex-shrink-0" />}
                        {email.attach && <span className="text-gray-400 flex-shrink-0">📎</span>}
                        <span className="text-gray-400 flex-shrink-0 text-[10px]">{email.date}</span>
                      </div>
                    ))}
                  </div>

                  {/* Email detail */}
                  <div className="flex-1 p-4 hidden xl:block">
                    <div className="text-xs font-bold text-gray-800 mb-3">Logo Project — Final Files Delivered</div>
                    <div className="text-xs text-gray-500 mb-3">From Sara Okafor<br /><span className="text-gray-400">to me</span></div>
                    <div className="text-[11px] text-gray-600 leading-relaxed mb-4">
                      Hi Tom,<br /><br />
                      The final logo files are ready. You'll find all formats (SVG, PNG, PDF) in the <span className="text-purple-600 underline cursor-pointer">shared folder</span>.<br />
                      Let me know if you need any adjustments.<br /><br />
                      Best,<br />Sara Okafor<br />
                      <span className="text-gray-400">sara@saraokafor.com</span>
                    </div>
                    <div className="flex gap-2">
                      <button className="text-[10px] px-3 py-1.5 rounded-lg font-bold text-gray-600 border border-gray-200 hover:bg-gray-50">↩ Reply</button>
                      <button className="text-[10px] px-3 py-1.5 rounded-lg font-bold text-gray-600 border border-gray-200 hover:bg-gray-50">→ Forward</button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── TRUSTPILOT ── */}
      <section className="py-10 border-y border-gray-100" style={{ background: '#FFFFFF' }}>
        <div className="max-w-[1200px] mx-auto px-6 flex flex-wrap items-center justify-center gap-3">
          <span className="font-semibold text-gray-800 text-base">Excellent</span>
          <div className="flex gap-0.5">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="w-6 h-6 flex items-center justify-center" style={{ background: '#00B67A' }}>
                <Star size={14} className="fill-white text-white" />
              </div>
            ))}
          </div>
          <span className="text-sm underline text-gray-500 cursor-pointer hover:text-gray-700">68,298 reviews on</span>
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="w-4 h-4" style={{ background: '#00B67A' }}>
                  <Star size={10} className="fill-white text-white" />
                </div>
              ))}
            </div>
            <span className="font-black text-sm text-gray-800">Trustpilot</span>
          </div>
        </div>
      </section>

      {/* ── MAKE THE RIGHT IMPRESSION ── */}
      <section className="py-20" style={{ background: '#12113A' }}>
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="font-black text-white mb-5" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', lineHeight: 1.1 }}>
              Make the right impression
            </h2>
            <p className="text-lg mb-12 max-w-2xl mx-auto" style={{ color: '#A5B4FC' }}>
              Every email you send says something about your business. Stand out with a professional address that matches your brand and builds lasting trust.
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: <Mail size={28} />, title: 'Your name, your brand', desc: 'hello@yourbusiness.com looks infinitely more professional than yourname123@gmail.com — and clients notice.', color: '#818CF8' },
                { icon: <Bot size={28} />, title: 'AI writes for you', desc: 'Built-in AI assistant helps you compose, summarize, and respond to emails faster than ever before.', color: '#34D399' },
                { icon: <Shield size={28} />, title: 'Secure & reliable', desc: 'Enterprise-grade spam filtering, virus protection, and SSL encryption keep your inbox clean and safe.', color: '#FBBF24' },
              ].map((card, i) => (
                <motion.div key={card.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="p-7 rounded-2xl text-left" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                    style={{ background: 'rgba(255,255,255,0.07)', color: card.color }}>
                    {card.icon}
                  </div>
                  <h3 className="font-bold text-white text-base mb-2">{card.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>{card.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="email-plans" className="py-20" style={{ background: '#FFFFFF' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="font-black text-gray-900 mb-4" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)' }}>
              Get business email today
            </h2>
            <p className="text-gray-500 text-base">Professional email at a price that fits every business.</p>

            <div className="flex items-center justify-center gap-4 mt-8">
              <button onClick={() => setYearly(false)}
                className={`text-sm font-bold px-4 py-2 rounded-lg transition-all ${!yearly ? 'text-gray-900 bg-gray-100' : 'text-gray-400'}`}>
                Monthly
              </button>
              <button onClick={() => setYearly(true)}
                className={`text-sm font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${yearly ? 'text-gray-900 bg-gray-100' : 'text-gray-400'}`}>
                Yearly
                <span className="text-[11px] font-black px-2 py-0.5 rounded-full text-white" style={{ background: '#7C3AED' }}>Save up to 43%</span>
              </button>
            </div>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5">
            {PLANS_PKR.map((plan, i) => {
              const price = yearly ? plan.yearlyPKR : plan.monthlyPKR;
              const displayPrice = convertFromPKR(price);
              const origPrice = convertFromPKR(plan.monthlyPKR);
              return (
                <motion.div key={plan.name} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="relative flex flex-col rounded-2xl overflow-hidden"
                  style={{
                    border: plan.popular ? '2px solid #7C3AED' : '1px solid #E5E7EB',
                    background: plan.popular ? 'linear-gradient(180deg, #F5F3FF 0%, #FFFFFF 100%)' : '#FFFFFF',
                    boxShadow: plan.popular ? '0 8px 40px rgba(124,58,237,0.15)' : 'none',
                  }}>
                  {plan.badge && (
                    <div className="py-2 text-center text-[11px] font-black uppercase tracking-[0.12em] text-white"
                      style={{ background: 'linear-gradient(90deg, #6D28D9, #7C3AED)' }}>
                      {plan.badge}
                    </div>
                  )}
                  <div className="p-7 flex flex-col flex-1">
                    <div className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1">{plan.users}</div>
                    <h3 className="text-lg font-black text-gray-900 mb-1">{plan.name}</h3>
                    <div className="text-xs text-gray-500 mb-5">{plan.storage}</div>

                    <div className="mb-6">
                      <div className="flex items-end gap-2 mb-1">
                        <span className="font-black text-gray-900" style={{ fontSize: '2.2rem', lineHeight: 1 }}>{displayPrice}</span>
                        <span className="text-sm pb-1 text-gray-400">/mo</span>
                      </div>
                      {yearly ? (
                        <p className="text-xs text-gray-400">{origPrice}/mo regular · <span className="font-bold" style={{ color: '#7C3AED' }}>Save {plan.savePercent}%</span></p>
                      ) : (
                        <p className="text-xs text-gray-400">or {convertFromPKR(plan.yearlyPKR)}/mo billed yearly</p>
                      )}
                    </div>

                    <button onClick={() => window.location.href = '/client/orders/new'}
                      className="w-full py-3 rounded-xl font-bold text-[14px] mb-7 transition-all hover:opacity-90"
                      style={{
                        background: plan.popular ? 'linear-gradient(135deg, #7C3AED, #6D28D9)' : '#F3F4F6',
                        color: plan.popular ? '#FFFFFF' : '#374151',
                        border: plan.popular ? 'none' : '1px solid #E5E7EB',
                      }}>
                      Choose plan
                    </button>

                    <ul className="space-y-2.5 flex-1">
                      {plan.features.map(f => (
                        <li key={f} className="flex items-start gap-2.5 text-[13px] text-gray-600">
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
          <p className="text-center text-sm mt-8 text-gray-400">
            Need a custom solution?{' '}
            <a href="/contact-us" className="underline hover:text-gray-600 transition-colors" style={{ color: '#7C3AED' }}>Contact our sales team</a>
          </p>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-20" style={{ background: '#F9FAFB' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
            <h2 className="font-black text-gray-900 mb-3" style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)' }}>Everything your team needs</h2>
            <p className="text-gray-500 text-base">Professional tools built for businesses of every size.</p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                className="p-6 rounded-2xl bg-white border border-gray-100 hover:shadow-md transition-all hover:border-purple-100 group">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform"
                  style={{ background: f.bg, color: f.color }}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-gray-900 text-[15px] mb-2">{f.title}</h3>
                <p className="text-sm leading-relaxed text-gray-500">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20" style={{ background: '#FFFFFF' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
            <h2 className="font-black text-gray-900 mb-3" style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)' }}>Up and running in minutes</h2>
            <p className="text-gray-500">Set up your business email in just a few simple steps.</p>
          </motion.div>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { num: '1', icon: <Mail size={22} />, color: '#7C3AED', title: 'Choose your plan', desc: 'Pick the email plan that fits your team size and needs.' },
              { num: '2', icon: <Globe size={22} />, color: '#0EA5E9', title: 'Connect your domain', desc: 'Link your existing domain or register a new one in minutes.' },
              { num: '3', icon: <Users size={22} />, color: '#10B981', title: 'Create mailboxes', desc: 'Set up email addresses for every team member instantly.' },
              { num: '4', icon: <Send size={22} />, color: '#F59E0B', title: 'Start sending', desc: 'Use webmail, your phone, or any desktop email client.' },
            ].map((s, i) => (
              <motion.div key={s.num} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="relative text-center p-7 rounded-2xl border border-gray-100 bg-white hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black mb-5 mx-auto text-white"
                  style={{ background: s.color }}>
                  {s.num}
                </div>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 mx-auto"
                  style={{ background: '#F3F4F6', color: s.color }}>
                  {s.icon}
                </div>
                <h3 className="font-bold text-gray-900 text-[14px] mb-2">{s.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
                {i < 3 && <div className="hidden md:block absolute top-10 -right-3 text-gray-300 text-lg font-bold">→</div>}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20" style={{ background: '#F9FAFB' }}>
        <div className="max-w-[760px] mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="font-black text-gray-900 mb-3" style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)' }}>Frequently asked questions</h2>
            <p className="text-gray-500">Everything you need to know about business email hosting.</p>
          </motion.div>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left flex items-center justify-between gap-4 px-5 py-4 rounded-xl transition-all"
                  style={{
                    background: openFaq === i ? '#F5F3FF' : '#FFFFFF',
                    border: openFaq === i ? '1px solid #DDD6FE' : '1px solid #E5E7EB',
                  }}>
                  <span className="font-semibold text-[14px]" style={{ color: openFaq === i ? '#6D28D9' : '#111827' }}>{faq.q}</span>
                  {openFaq === i
                    ? <ChevronUp size={16} style={{ color: '#7C3AED', flexShrink: 0 }} />
                    : <ChevronDown size={16} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                  }
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                      style={{ borderLeft: '1px solid #DDD6FE', borderRight: '1px solid #DDD6FE', borderBottom: '1px solid #DDD6FE', borderRadius: '0 0 12px 12px' }}>
                      <div className="px-5 py-4 text-sm leading-relaxed text-gray-500" style={{ background: '#FDFCFF' }}>{faq.a}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20" style={{ background: '#12113A' }}>
        <div className="max-w-[760px] mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-sm font-semibold mb-3" style={{ color: '#818CF8' }}>Professional business email</p>
            <h2 className="font-black text-white mb-4" style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}>
              Start building trust with every email
            </h2>
            <p className="mb-8 text-sm" style={{ color: '#94A3B8' }}>
              Get your professional business email today. Set up in minutes, 30-day money-back guarantee.
            </p>
            <a href="#email-plans"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-[15px] text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}>
              Get started <ArrowRight size={16} />
            </a>
            <div className="flex flex-wrap gap-6 justify-center mt-7">
              {['30-Day Money-Back', 'Custom Domain Email', 'Cancel Anytime'].map(f => (
                <span key={f} className="flex items-center gap-2 text-xs" style={{ color: '#94A3B8' }}>
                  <Shield size={13} style={{ color: '#818CF8' }} /> {f}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

    </div>
  );
};

export default BusinessEmail;
