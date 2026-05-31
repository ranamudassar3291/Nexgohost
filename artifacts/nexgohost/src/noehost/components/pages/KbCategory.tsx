import React, { useState } from 'react';
import { Link, useParams } from 'wouter';
import { motion } from 'framer-motion';
import {
  Search, ChevronRight, FileText, Server, Layout, Globe,
  HardDrive, Mail, Database, Shield, CreditCard, Cpu, Workflow
} from 'lucide-react';
import { KB_CATEGORIES, getCategoryBySlug, getTotalArticles } from '../../data/kb-data';

const ICON_MAP: Record<string, React.ReactNode> = {
  FileText: <FileText size={48} strokeWidth={1.3} />,
  Server:   <Server   size={48} strokeWidth={1.3} />,
  Layout:   <Layout   size={48} strokeWidth={1.3} />,
  Globe:    <Globe    size={48} strokeWidth={1.3} />,
  HardDrive:<HardDrive size={48} strokeWidth={1.3} />,
  Mail:     <Mail     size={48} strokeWidth={1.3} />,
  Database: <Database size={48} strokeWidth={1.3} />,
  Shield:   <Shield   size={48} strokeWidth={1.3} />,
  CreditCard:<CreditCard size={48} strokeWidth={1.3} />,
  Cpu:      <Cpu      size={48} strokeWidth={1.3} />,
  Workflow: <Workflow size={48} strokeWidth={1.3} />,
};

export default function KbCategory() {
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const [query, setQuery] = useState('');

  const category = getCategoryBySlug(categorySlug || '');

  if (!category) {
    return (
      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#fff' }}>
        <section style={{ background: 'linear-gradient(135deg, #6D28D9, #7C3AED)', padding: '80px 0 40px' }}>
          <div className="max-w-3xl mx-auto px-6">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input placeholder="Search for articles..." className="w-full pl-12 pr-5 py-4 rounded-xl text-sm outline-none" />
            </div>
          </div>
        </section>
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h2 className="text-2xl font-black mb-4 text-gray-800">Category Not Found</h2>
          <Link to="/knowledge-base" className="text-purple-600 font-bold underline">← Back to Knowledge Base</Link>
        </div>
      </div>
    );
  }

  const total = getTotalArticles(category);

  const filteredSections = query.trim()
    ? category.sections.map(sec => ({
        ...sec,
        articles: sec.articles.filter(a =>
          a.title.toLowerCase().includes(query.toLowerCase()) ||
          a.excerpt.toLowerCase().includes(query.toLowerCase())
        ),
      })).filter(sec => sec.articles.length > 0)
    : category.sections;

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#fff', color: '#111827' }}>

      {/* ── PURPLE SEARCH HERO ── */}
      <section style={{ background: 'linear-gradient(135deg, #6D28D9 0%, #7C3AED 40%, #8B5CF6 100%)', paddingTop: 80, paddingBottom: 40 }}>
        <div className="max-w-3xl mx-auto px-6">
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
            <input
              type="text"
              placeholder="Search for articles..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-12 pr-5 py-4 rounded-xl text-sm font-medium outline-none"
              style={{ background: '#fff', color: '#111827', border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}
            />
          </div>
        </div>
      </section>

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-3xl mx-auto px-6 py-10">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-8" style={{ color: '#6B7280' }}>
          <Link to="/" className="hover:text-purple-600 transition-colors">Home</Link>
          <span style={{ color: '#D1D5DB' }}>»</span>
          <Link to="/knowledge-base" className="hover:text-purple-600 transition-colors">Support</Link>
          <span style={{ color: '#D1D5DB' }}>»</span>
          <span style={{ color: '#111827', fontWeight: 600 }}>{category.title}</span>
        </nav>

        {/* Category Header */}
        <div className="mb-10">
          <div className="mb-4" style={{ color: '#673DE6', opacity: 0.8 }}>
            {ICON_MAP[category.iconName] || <FileText size={48} strokeWidth={1.3} />}
          </div>
          <h1 className="font-black mb-2" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', color: '#111827', letterSpacing: '-0.02em' }}>
            {category.title}
          </h1>
          <p className="text-sm mb-2" style={{ color: '#4B5563' }}>{category.description}</p>
          <p className="text-sm font-medium" style={{ color: '#9CA3AF' }}>
            {query.trim()
              ? `${filteredSections.reduce((s, sec) => s + sec.articles.length, 0)} result${filteredSections.reduce((s, sec) => s + sec.articles.length, 0) !== 1 ? 's' : ''} for "${query}"`
              : `${total} article${total !== 1 ? 's' : ''}`
            }
          </p>
        </div>

        {/* Article Sections */}
        {filteredSections.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-bold text-gray-700 mb-2">No articles found</p>
            <button onClick={() => setQuery('')} className="text-sm font-bold underline" style={{ color: '#673DE6' }}>Clear search</button>
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {filteredSections.map((section, si) => (
              <motion.div key={section.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: si * 0.05 }}>
                {/* Section heading */}
                <h2 className="font-black mb-1 pb-4" style={{ fontSize: '1.05rem', color: '#111827', borderBottom: '1px solid #E5E7EB' }}>
                  {section.title}
                </h2>

                {/* Article list */}
                <div className="flex flex-col">
                  {section.articles.map((article, ai) => (
                    <Link
                      key={article.slug}
                      to={`/knowledge-base/${category.slug}/${article.slug}`}
                      className="flex items-start justify-between gap-4 py-4 group"
                      style={{ borderBottom: ai < section.articles.length - 1 ? '1px solid #F3F4F6' : 'none' }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm mb-1 group-hover:text-purple-600 transition-colors" style={{ color: '#673DE6' }}>
                          {article.title}
                        </p>
                        <p className="text-xs leading-relaxed" style={{ color: '#6B7280' }}>{article.excerpt}</p>
                      </div>
                      <ChevronRight
                        size={18}
                        className="flex-shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform"
                        style={{ color: '#9CA3AF' }}
                      />
                    </Link>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Browse other categories */}
        <div className="mt-16 pt-10" style={{ borderTop: '1px solid #E5E7EB' }}>
          <h3 className="font-black mb-6 text-sm uppercase tracking-widest" style={{ color: '#9CA3AF' }}>Browse other categories</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {KB_CATEGORIES.filter(c => c.slug !== category.slug).map(cat => (
              <Link
                key={cat.slug}
                to={`/knowledge-base/${cat.slug}`}
                className="flex items-center gap-2 p-3 rounded-xl border border-gray-100 hover:border-purple-200 hover:shadow-sm transition-all group text-sm font-semibold"
                style={{ color: '#374151' }}
              >
                <span style={{ color: '#673DE6', opacity: 0.7 }}>
                  {React.cloneElement(ICON_MAP[cat.iconName] as React.ReactElement, { size: 16, strokeWidth: 1.8 })}
                </span>
                <span className="group-hover:text-purple-600 transition-colors truncate">{cat.title}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
