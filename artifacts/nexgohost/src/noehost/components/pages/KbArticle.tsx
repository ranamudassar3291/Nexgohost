import React, { useState } from 'react';
import { Link, useParams } from 'wouter';
import { motion } from 'framer-motion';
import {
  Search, Clock, ThumbsUp, ThumbsDown, ChevronRight,
  ArrowLeft, FileText, Server, Layout, Globe,
  HardDrive, Mail, Database, Shield, CreditCard, Cpu, Workflow
} from 'lucide-react';
import { getArticleBySlug, getCategoryBySlug, KB_CATEGORIES, getTotalArticles } from '../../data/kb-data';

const ICON_SM: Record<string, React.ReactNode> = {
  FileText:  <FileText  size={18} strokeWidth={1.5} />,
  Server:    <Server    size={18} strokeWidth={1.5} />,
  Layout:    <Layout    size={18} strokeWidth={1.5} />,
  Globe:     <Globe     size={18} strokeWidth={1.5} />,
  HardDrive: <HardDrive size={18} strokeWidth={1.5} />,
  Mail:      <Mail      size={18} strokeWidth={1.5} />,
  Database:  <Database  size={18} strokeWidth={1.5} />,
  Shield:    <Shield    size={18} strokeWidth={1.5} />,
  CreditCard:<CreditCard size={18} strokeWidth={1.5} />,
  Cpu:       <Cpu       size={18} strokeWidth={1.5} />,
  Workflow:  <Workflow  size={18} strokeWidth={1.5} />,
};

export default function KbArticle() {
  const { categorySlug, articleSlug } = useParams<{ categorySlug: string; articleSlug: string }>();
  const [query, setQuery] = useState('');
  const [helpful, setHelpful] = useState<boolean | null>(null);

  const result = getArticleBySlug(categorySlug || '', articleSlug || '');

  if (!result) {
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
          <h2 className="text-2xl font-black mb-4 text-gray-800">Article Not Found</h2>
          <Link to="/knowledge-base" className="text-purple-600 font-bold underline">← Back to Knowledge Base</Link>
        </div>
      </div>
    );
  }

  const { article, section, category } = result;

  /* Related articles = other articles in same section (max 5) */
  const related = section.articles
    .filter(a => a.slug !== article.slug)
    .slice(0, 5);

  /* Other articles in category (different section, max 5) */
  const otherCategoryArticles = category.sections
    .filter(s => s.title !== section.title)
    .flatMap(s => s.articles)
    .slice(0, 5);

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

      {/* ── LAYOUT: article (2/3) + sidebar (1/3) ── */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex gap-10 items-start">

          {/* ── MAIN ARTICLE ── */}
          <div className="flex-1 min-w-0">

            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-xs mb-8 flex-wrap" style={{ color: '#6B7280' }}>
              <Link to="/" className="hover:text-purple-600 transition-colors">Home</Link>
              <span style={{ color: '#D1D5DB' }}>»</span>
              <Link to="/knowledge-base" className="hover:text-purple-600 transition-colors">Support</Link>
              <span style={{ color: '#D1D5DB' }}>»</span>
              <Link to={`/knowledge-base/${category.slug}`} className="hover:text-purple-600 transition-colors">{category.title}</Link>
              <span style={{ color: '#D1D5DB' }}>»</span>
              <span style={{ color: '#111827', fontWeight: 600 }} className="truncate">{article.title}</span>
            </nav>

            {/* Article header */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <h1 className="font-black mb-3 leading-tight" style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', color: '#111827', letterSpacing: '-0.02em' }}>
                {article.title}
              </h1>
              <div className="flex items-center gap-4 mb-8">
                <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#9CA3AF' }}>
                  <Clock size={13} /> {article.readTime} min read
                </span>
                <Link
                  to={`/knowledge-base/${category.slug}`}
                  className="text-xs font-bold px-3 py-1 rounded-full transition-colors hover:opacity-80"
                  style={{ background: '#F5F3FF', color: '#673DE6' }}
                >
                  {category.title}
                </Link>
              </div>
            </motion.div>

            {/* Article content */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="kb-article-content"
              style={{ fontSize: 15, lineHeight: 1.75, color: '#374151' }}
              dangerouslySetInnerHTML={{ __html: article.content }}
            />

            {/* Was this helpful */}
            <div className="mt-12 pt-8" style={{ borderTop: '1px solid #E5E7EB' }}>
              {helpful === null ? (
                <div>
                  <p className="text-sm font-bold mb-4" style={{ color: '#111827' }}>Was this article helpful?</p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setHelpful(true)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm border transition-all hover:shadow-sm"
                      style={{ borderColor: '#D1D5DB', color: '#374151' }}
                    >
                      <ThumbsUp size={16} /> Yes
                    </button>
                    <button
                      onClick={() => setHelpful(false)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm border transition-all hover:shadow-sm"
                      style={{ borderColor: '#D1D5DB', color: '#374151' }}
                    >
                      <ThumbsDown size={16} /> No
                    </button>
                  </div>
                </div>
              ) : helpful ? (
                <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                  <ThumbsUp size={18} style={{ color: '#10B981' }} />
                  <p className="text-sm font-bold" style={{ color: '#065F46' }}>Thanks for the feedback!</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-3 p-4 rounded-xl mb-4" style={{ background: '#FFF7ED', border: '1px solid #FDE68A' }}>
                    <ThumbsDown size={18} style={{ color: '#F59E0B' }} />
                    <p className="text-sm font-bold" style={{ color: '#92400E' }}>Sorry this wasn't helpful. Our team will improve it.</p>
                  </div>
                  <Link
                    to="/contact-us"
                    className="inline-flex items-center gap-2 text-sm font-bold px-5 py-3 rounded-xl text-white transition-all hover:opacity-90"
                    style={{ background: '#673DE6' }}
                  >
                    Contact Support
                  </Link>
                </div>
              )}
            </div>

            {/* Related articles */}
            {related.length > 0 && (
              <div className="mt-12 pt-8" style={{ borderTop: '1px solid #E5E7EB' }}>
                <h3 className="font-black mb-5 text-sm uppercase tracking-widest" style={{ color: '#9CA3AF' }}>
                  Related articles
                </h3>
                <div className="flex flex-col">
                  {related.map((rel, i) => (
                    <Link
                      key={rel.slug}
                      to={`/knowledge-base/${category.slug}/${rel.slug}`}
                      className="flex items-center justify-between gap-4 py-3.5 group"
                      style={{ borderBottom: i < related.length - 1 ? '1px solid #F3F4F6' : 'none' }}
                    >
                      <p className="text-sm font-semibold group-hover:text-purple-600 transition-colors" style={{ color: '#673DE6' }}>
                        {rel.title}
                      </p>
                      <ChevronRight size={16} style={{ color: '#9CA3AF', flexShrink: 0 }} className="group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── SIDEBAR ── */}
          <aside className="w-72 flex-shrink-0 hidden lg:block" style={{ position: 'sticky', top: 100 }}>

            {/* Back link */}
            <Link
              to={`/knowledge-base/${category.slug}`}
              className="flex items-center gap-2 text-sm font-bold mb-6 hover:opacity-70 transition-opacity"
              style={{ color: '#673DE6' }}
            >
              <ArrowLeft size={15} /> {category.title}
            </Link>

            {/* More in this category */}
            {otherCategoryArticles.length > 0 && (
              <div className="p-5 rounded-2xl mb-5" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                <h4 className="font-black text-xs uppercase tracking-widest mb-4" style={{ color: '#6B7280' }}>
                  More in {category.title}
                </h4>
                <div className="flex flex-col gap-1">
                  {otherCategoryArticles.map(art => (
                    <Link
                      key={art.slug}
                      to={`/knowledge-base/${category.slug}/${art.slug}`}
                      className="flex items-start gap-2 py-2 group"
                    >
                      <ChevronRight size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#9CA3AF' }} />
                      <p className="text-xs font-medium group-hover:text-purple-600 transition-colors leading-snug" style={{ color: '#374151' }}>
                        {art.title}
                      </p>
                    </Link>
                  ))}
                </div>
                <Link
                  to={`/knowledge-base/${category.slug}`}
                  className="flex items-center gap-1 text-xs font-bold mt-4 hover:opacity-70 transition-opacity"
                  style={{ color: '#673DE6' }}
                >
                  View all {getTotalArticles(category)} articles <ChevronRight size={12} />
                </Link>
              </div>
            )}

            {/* Browse all categories */}
            <div className="p-5 rounded-2xl" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
              <h4 className="font-black text-xs uppercase tracking-widest mb-4" style={{ color: '#6B7280' }}>All categories</h4>
              <div className="flex flex-col gap-1">
                {KB_CATEGORIES.map(cat => (
                  <Link
                    key={cat.slug}
                    to={`/knowledge-base/${cat.slug}`}
                    className="flex items-center gap-2 py-1.5 group"
                  >
                    <span style={{ color: cat.slug === category.slug ? '#673DE6' : '#9CA3AF' }}>
                      {ICON_SM[cat.iconName]}
                    </span>
                    <span
                      className="text-xs font-medium group-hover:text-purple-600 transition-colors"
                      style={{ color: cat.slug === category.slug ? '#673DE6' : '#4B5563', fontWeight: cat.slug === category.slug ? 700 : 500 }}
                    >
                      {cat.title}
                    </span>
                    {cat.slug === category.slug && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#673DE6' }} />
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ── ARTICLE CONTENT STYLES ── */}
      <style>{`
        .kb-article-content h2 {
          font-size: 1.2rem;
          font-weight: 800;
          color: #111827;
          margin-top: 2rem;
          margin-bottom: 0.75rem;
          letter-spacing: -0.01em;
        }
        .kb-article-content h3 {
          font-size: 1rem;
          font-weight: 700;
          color: #1F2937;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
        }
        .kb-article-content p {
          margin-bottom: 1rem;
          color: #374151;
        }
        .kb-article-content ul, .kb-article-content ol {
          margin: 0.5rem 0 1rem 1.25rem;
        }
        .kb-article-content li {
          margin-bottom: 0.35rem;
          color: #374151;
        }
        .kb-article-content code {
          background: #F3F4F6;
          border: 1px solid #E5E7EB;
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 13px;
          font-family: 'JetBrains Mono', monospace;
          color: #673DE6;
        }
        .kb-article-content pre {
          background: #1E1E2E;
          border-radius: 12px;
          padding: 1.25rem 1.5rem;
          overflow-x: auto;
          margin: 1rem 0 1.5rem;
        }
        .kb-article-content pre code {
          background: none;
          border: none;
          padding: 0;
          color: #A5F3FC;
          font-size: 13px;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
        }
        .kb-article-content strong {
          font-weight: 700;
          color: #111827;
        }
        .kb-article-content a {
          color: #673DE6;
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
