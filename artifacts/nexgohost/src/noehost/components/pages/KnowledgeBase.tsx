import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Play, BookOpen, Headphones, ChevronRight,
  FileText, Server, Globe, HardDrive, Mail, Database,
  Shield, CreditCard, Cpu, Workflow, Layout, Zap,
  ArrowRight, MessageCircle, Phone, Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';

/* ─── DATA ───────────────────────────────────────────────────────────────── */

const CATEGORIES = [
  {
    icon: <Zap size={40} strokeWidth={1.4} />,
    color: '#673DE6',
    title: 'Getting Started',
    desc: 'Things you need to know before launching your website',
    articles: 42,
    href: '#',
  },
  {
    icon: <Server size={40} strokeWidth={1.4} />,
    color: '#673DE6',
    title: 'cPanel & Hosting',
    desc: 'The features of the cPanel control panel',
    articles: 60,
    href: '#',
  },
  {
    icon: <Layout size={40} strokeWidth={1.4} />,
    color: '#673DE6',
    title: 'WordPress',
    desc: 'Everything you need to know about WordPress hosting',
    articles: 89,
    href: '#',
  },
  {
    icon: <Globe size={40} strokeWidth={1.4} />,
    color: '#673DE6',
    title: 'Domains',
    desc: 'Useful information about purchasing, transferring and managing your domains',
    articles: 77,
    href: '#',
  },
  {
    icon: <FileText size={40} strokeWidth={1.4} />,
    color: '#673DE6',
    title: 'DNS',
    desc: 'Managing your domain\'s DNS Zone',
    articles: 31,
    href: '#',
  },
  {
    icon: <HardDrive size={40} strokeWidth={1.4} />,
    color: '#673DE6',
    title: 'Files & FTP',
    desc: 'How to manage and transfer your website files',
    articles: 24,
    href: '#',
  },
  {
    icon: <Mail size={40} strokeWidth={1.4} />,
    color: '#673DE6',
    title: 'Email',
    desc: 'How to set up and use email accounts, webmail, and business email',
    articles: 38,
    href: '#',
  },
  {
    icon: <Database size={40} strokeWidth={1.4} />,
    color: '#673DE6',
    title: 'Databases',
    desc: 'MySQL, phpMyAdmin, and database management',
    articles: 19,
    href: '#',
  },
  {
    icon: <Shield size={40} strokeWidth={1.4} />,
    color: '#673DE6',
    title: 'SSL & Security',
    desc: 'SSL certificates, two-factor auth, and security best practices',
    articles: 27,
    href: '#',
  },
  {
    icon: <CreditCard size={40} strokeWidth={1.4} />,
    color: '#673DE6',
    title: 'Billing & Payments',
    desc: 'Invoices, payment methods, renewals, and upgrades',
    articles: 33,
    href: '#',
  },
  {
    icon: <Cpu size={40} strokeWidth={1.4} />,
    color: '#673DE6',
    title: 'VPS Hosting',
    desc: 'VPS setup, SSH access, server management, and root access',
    articles: 45,
    href: '#',
  },
  {
    icon: <Workflow size={40} strokeWidth={1.4} />,
    color: '#673DE6',
    title: 'n8n Automation',
    desc: 'Self-hosted n8n workflow setup, triggers, and integrations',
    articles: 18,
    href: '#',
  },
];

const POPULAR_ARTICLES = [
  { title: 'How to Set Up Your First Website on Noehost', category: 'Getting Started', time: '5 min read' },
  { title: 'How to Connect a Domain to Your Hosting', category: 'Domains', time: '4 min read' },
  { title: 'How to Install WordPress Manually', category: 'WordPress', time: '7 min read' },
  { title: 'How to Create a Professional Business Email', category: 'Email', time: '3 min read' },
  { title: 'How to Set Up DNS Records (A, CNAME, MX, TXT)', category: 'DNS', time: '6 min read' },
  { title: 'How to Install a Free SSL Certificate', category: 'SSL & Security', time: '4 min read' },
  { title: 'How to Create a MySQL Database in cPanel', category: 'Databases', time: '4 min read' },
  { title: 'How to Upload Files via FTP with FileZilla', category: 'Files & FTP', time: '5 min read' },
];

/* ─── COMPONENT ─────────────────────────────────────────────────────────── */

export default function KnowledgeBase() {
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? CATEGORIES.filter(c =>
        c.title.toLowerCase().includes(query.toLowerCase()) ||
        c.desc.toLowerCase().includes(query.toLowerCase())
      )
    : CATEGORIES;

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#fff', color: '#111827' }}>

      {/* ── HERO ── */}
      <section style={{ background: 'linear-gradient(135deg, #6D28D9 0%, #7C3AED 40%, #8B5CF6 100%)', paddingTop: 96, paddingBottom: 64 }}>
        <div className="max-w-3xl mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="font-black text-white mb-4" style={{ fontSize: 'clamp(1.6rem, 4vw, 2.6rem)', letterSpacing: '-0.02em' }}>
              Advice and answers from the<br />Customer Success Team
            </h1>
            <p className="mb-8 text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
              Search our knowledge base or browse categories below
            </p>

            {/* Search bar */}
            <div className="relative max-w-xl mx-auto">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
              <input
                type="text"
                placeholder="Search for articles..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full pl-12 pr-5 py-4 rounded-xl text-sm font-medium outline-none"
                style={{
                  background: '#fff',
                  color: '#111827',
                  border: 'none',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                }}
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CATEGORIES GRID ── */}
      <section className="py-16" style={{ background: '#F9FAFB' }}>
        <div className="max-w-5xl mx-auto px-6">
          {query.trim() && (
            <p className="text-sm mb-8" style={{ color: '#6B7280' }}>
              Showing <strong>{filtered.length}</strong> result{filtered.length !== 1 ? 's' : ''} for "<strong>{query}</strong>"
            </p>
          )}

          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-lg font-bold text-gray-700 mb-2">No categories found</p>
              <p className="text-sm text-gray-400">Try a different search term or browse all categories</p>
              <button onClick={() => setQuery('')} className="mt-4 text-sm font-bold underline" style={{ color: '#673DE6' }}>Clear search</button>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-4">
              {filtered.map((cat, i) => (
                <motion.a
                  key={cat.title}
                  href={cat.href}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04 }}
                  className="flex flex-col items-center text-center p-8 rounded-2xl bg-white border border-gray-100 hover:shadow-md hover:border-purple-100 transition-all group"
                >
                  <div className="mb-5" style={{ color: '#673DE6', opacity: 0.85 }}>
                    {cat.icon}
                  </div>
                  <h3 className="font-bold mb-2 group-hover:text-purple-700 transition-colors" style={{ fontSize: 15, color: '#111827' }}>
                    {cat.title}
                  </h3>
                  <p className="text-xs leading-relaxed mb-4" style={{ color: '#6B7280' }}>{cat.desc}</p>
                  <span className="text-xs font-semibold mt-auto" style={{ color: '#9CA3AF' }}>
                    {cat.articles} articles
                  </span>
                </motion.a>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── POPULAR ARTICLES ── */}
      <section className="py-16" style={{ background: '#fff' }}>
        <div className="max-w-5xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-8">
            <h2 className="font-black mb-1" style={{ fontSize: 'clamp(1.3rem, 2.5vw, 1.8rem)', color: '#111827', letterSpacing: '-0.02em' }}>
              Popular articles
            </h2>
            <p className="text-sm" style={{ color: '#6B7280' }}>The most-read guides from our knowledge base</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-3">
            {POPULAR_ARTICLES.map((art, i) => (
              <motion.a
                key={art.title}
                href="#"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between gap-4 p-4 rounded-xl border border-gray-100 hover:border-purple-100 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: '#F5F3FF', color: '#673DE6' }}>
                    <FileText size={15} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm group-hover:text-purple-700 transition-colors" style={{ color: '#111827' }}>
                      {art.title}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: '#F3F4F6', color: '#6B7280' }}>
                        {art.category}
                      </span>
                      <span className="flex items-center gap-1 text-[11px]" style={{ color: '#9CA3AF' }}>
                        <Clock size={10} /> {art.time}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: '#9CA3AF', flexShrink: 0 }} className="group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all" />
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      {/* ── TUTORIALS SECTION ── */}
      <section className="py-16" style={{ background: '#F9FAFB' }}>
        <div className="max-w-5xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-8">
            <h2 className="font-black mb-1" style={{ fontSize: 'clamp(1.3rem, 2.5vw, 1.8rem)', color: '#111827', letterSpacing: '-0.02em' }}>
              Tutorials
            </h2>
            <p className="text-sm" style={{ color: '#6B7280' }}>Videos and step-by-step guides to help you achieve your online success story</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { title: 'Build Your First Website in 10 Minutes', dur: '10:24', thumb: '🌐' },
              { title: 'Install WordPress with One Click', dur: '5:12', thumb: '📦' },
              { title: 'Set Up a Professional Business Email', dur: '7:45', thumb: '✉️' },
              { title: 'Connect Your Custom Domain', dur: '4:30', thumb: '🔗' },
              { title: 'Create & Restore Website Backups', dur: '6:18', thumb: '💾' },
              { title: 'Configure DNS Records Correctly', dur: '8:55', thumb: '⚙️' },
            ].map((vid, i) => (
              <motion.a
                key={vid.title}
                href="#"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="group rounded-2xl overflow-hidden border border-gray-100 hover:shadow-md hover:border-purple-100 transition-all"
              >
                <div className="h-32 flex items-center justify-center text-5xl relative"
                  style={{ background: 'linear-gradient(135deg, #EDE9FE, #DDD6FE)' }}>
                  {vid.thumb}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-all">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(103,61,230,0.9)' }}>
                      <Play size={16} className="text-white ml-0.5" />
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-white">
                  <p className="font-semibold text-sm group-hover:text-purple-700 transition-colors mb-1" style={{ color: '#111827' }}>
                    {vid.title}
                  </p>
                  <span className="text-xs" style={{ color: '#9CA3AF' }}>{vid.dur}</span>
                </div>
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      {/* ── LEARNING LAB ── */}
      <section className="py-16" style={{ background: '#fff' }}>
        <div className="max-w-5xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-8">
            <h2 className="font-black mb-1" style={{ fontSize: 'clamp(1.3rem, 2.5vw, 1.8rem)', color: '#111827', letterSpacing: '-0.02em' }}>
              Learning Lab
            </h2>
            <p className="text-sm" style={{ color: '#6B7280' }}>Step-by-step guides to launch and grow your online project</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-5">
            {[
              {
                icon: <Globe size={22} />, color: '#673DE6', bg: '#F5F3FF',
                title: 'Complete Guide: How to Start a Website',
                desc: 'Everything from domain registration to going live — a full beginner\'s walkthrough.',
                steps: 8, time: '25 min',
              },
              {
                icon: <Layout size={22} />, color: '#0EA5E9', bg: '#F0F9FF',
                title: 'WordPress Mastery: From Install to Launch',
                desc: 'Install WordPress, pick a theme, add plugins, and launch a professional site.',
                steps: 10, time: '35 min',
              },
              {
                icon: <Mail size={22} />, color: '#10B981', bg: '#F0FDF4',
                title: 'Professional Email Setup Guide',
                desc: 'Create business email, configure IMAP/SMTP, and set up mail clients on any device.',
                steps: 6, time: '18 min',
              },
              {
                icon: <Shield size={22} />, color: '#F59E0B', bg: '#FFFBEB',
                title: 'Website Security: SSL, Backups & Malware',
                desc: 'Enable SSL, schedule automatic backups, and scan for malware on your hosting.',
                steps: 5, time: '15 min',
              },
            ].map((lab, i) => (
              <motion.a
                key={lab.title}
                href="#"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="flex gap-4 p-6 rounded-2xl border border-gray-100 hover:shadow-md hover:border-purple-100 transition-all group"
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: lab.bg, color: lab.color }}>
                  {lab.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm mb-1 group-hover:text-purple-700 transition-colors" style={{ color: '#111827' }}>
                    {lab.title}
                  </h3>
                  <p className="text-xs leading-relaxed mb-3" style={{ color: '#6B7280' }}>{lab.desc}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-medium" style={{ color: '#9CA3AF' }}>{lab.steps} steps</span>
                    <span style={{ color: '#D1D5DB' }}>·</span>
                    <span className="flex items-center gap-1 text-[11px]" style={{ color: '#9CA3AF' }}>
                      <Clock size={10} /> {lab.time}
                    </span>
                  </div>
                </div>
                <ArrowRight size={16} style={{ color: '#9CA3AF', flexShrink: 0 }} className="group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all self-center" />
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT / SUPPORT ── */}
      <section className="py-16" style={{ background: '#F9FAFB' }}>
        <div className="max-w-5xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
            <h2 className="font-black mb-2" style={{ fontSize: 'clamp(1.3rem, 2.5vw, 1.8rem)', color: '#111827', letterSpacing: '-0.02em' }}>
              Still need help?
            </h2>
            <p className="text-sm" style={{ color: '#6B7280' }}>Our support team is available 24/7 — pick the channel that works best for you</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                icon: <MessageCircle size={28} />, color: '#673DE6', bg: '#F5F3FF',
                title: 'Live Chat',
                desc: 'Chat with our support team in real-time. Average response: under 2 minutes.',
                cta: 'Start chat',
                href: '/contact-us',
                badge: 'Online now',
                badgeColor: '#10B981',
              },
              {
                icon: <Headphones size={28} />, color: '#0EA5E9', bg: '#F0F9FF',
                title: 'Support Tickets',
                desc: 'Submit a detailed support request and get a full written solution.',
                cta: 'Open a ticket',
                href: '/dashboard/tickets',
                badge: '< 1hr response',
                badgeColor: '#0EA5E9',
              },
              {
                icon: <BookOpen size={28} />, color: '#10B981', bg: '#F0FDF4',
                title: 'Knowledge Base',
                desc: 'Browse thousands of guides, tutorials, and how-to articles.',
                cta: 'Browse articles',
                href: '#',
                badge: '500+ articles',
                badgeColor: '#10B981',
              },
            ].map((c, i) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex flex-col p-7 rounded-2xl bg-white border border-gray-100 hover:shadow-md hover:border-purple-100 transition-all"
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: c.bg, color: c.color }}>
                  {c.icon}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-bold text-sm" style={{ color: '#111827' }}>{c.title}</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ background: c.badgeColor }}>{c.badge}</span>
                </div>
                <p className="text-xs leading-relaxed mb-5 flex-1" style={{ color: '#6B7280' }}>{c.desc}</p>
                <Link
                  to={c.href}
                  className="flex items-center gap-1.5 text-sm font-bold transition-colors"
                  style={{ color: c.color }}>
                  {c.cta} <ArrowRight size={14} />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
