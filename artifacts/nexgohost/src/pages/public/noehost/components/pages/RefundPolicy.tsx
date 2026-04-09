import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { useContent } from '@/context/ContentContext';

const RefundPolicy: React.FC = () => {
  const { content } = useContent();
  const pgCms = content?.["pages.refund"] || {};
  const pg = { title: 'Refund Policy', lastUpdated: '', intro: '', sections: [], ...pgCms };
  const [openSection, setOpenSection] = useState<number | null>(0);

  const sections = (pg.sections || []).filter((s: any) => s.show !== false);

  return (
    <div className="noehost-public min-h-screen bg-dark">
      <section className="relative bg-secondary overflow-hidden pt-36 pb-24">
        <div className="tech-grid absolute inset-0 opacity-5" />
        <div className="absolute top-0 left-0 w-[700px] h-[700px] rounded-full blur-[150px]" style={{ background: 'radial-gradient(circle, rgba(103,61,230,0.25) 0%, transparent 70%)' }} />
        <div className="container mx-auto px-6 relative z-10 text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary-300 text-xs font-black px-4 py-2 rounded-full mb-6 uppercase tracking-widest">
            <RefreshCw size={12} /> Refunds
          </div>
          <h1 className="text-5xl font-black text-white mb-4">{pg.title || 'Refund Policy'}</h1>
          <p className="text-slate-400 font-medium">Last updated: <span className="text-primary-300 font-black">{pg.lastUpdated || 'January 15, 2025'}</span></p>
        </div>
      </section>

      <section className="py-16 bg-dark">
        <div className="container mx-auto px-6 max-w-3xl">
          {pg.intro && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 bg-primary/5 border border-primary/10 rounded-2xl mb-8">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={20} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <p className="text-slate-300 font-medium leading-relaxed">{pg.intro}</p>
              </div>
            </motion.div>
          )}
          <div className="space-y-3">
            {sections.map((section: any, i: number) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className="border border-white/10 rounded-xl overflow-hidden bg-white/5">
                <button onClick={() => setOpenSection(openSection === i ? null : i)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors">
                  <span className="text-sm font-black text-white pr-3">{section.title}</span>
                  {openSection === i ? <ChevronUp size={16} className="text-primary-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-slate-500 flex-shrink-0" />}
                </button>
                {openSection === i && (
                  <div className="px-5 pb-5 pt-3 border-t border-white/5">
                    <p className="text-sm text-slate-400 font-medium leading-relaxed whitespace-pre-line">{section.content}</p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default RefundPolicy;
