import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Zap } from 'lucide-react';
import { useContent } from '@/context/ContentContext';

const CTA: React.FC = () => {
  const { content } = useContent();

  const ctaData = content?.cta || {
    badge: 'Limited Time Offer: Get 50% Off Your First Year',
    title: 'Ready to Accelerate Your Online Presence?',
    description: 'Join 10,000+ happy customers who trust Noehost for their hosting needs. Start your 30-day risk-free trial today.',
    footer: 'No credit card required for trial. 30-day money-back guarantee.'
  };

  return (
    <section className="py-14 bg-dark relative overflow-hidden">
      <div className="container mx-auto px-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="bg-gradient-to-br from-primary to-primary-800 rounded-[2rem] p-8 md:p-14 text-white text-center relative overflow-hidden shadow-2xl shadow-primary/30 border border-white/10"
        >
          {/* Decorative Elements */}
          <div className="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 animate-pulse-slow"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/20 rounded-full blur-[100px] translate-x-1/2 translate-y-1/2 animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
          
          <div className="relative z-10 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[10px] font-black uppercase tracking-widest mb-8">
              <Zap size={14} className="fill-white" />
              {ctaData.badge}
            </div>
            
            <h2 className="text-3xl md:text-5xl font-black mb-5 leading-[1.1] tracking-tighter">
              {ctaData.title}
            </h2>
            
            <p className="text-base text-white/80 mb-8 leading-relaxed font-medium">
              {ctaData.description}
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {ctaData.showCtaPrimary !== false && (() => {
                const txt = ctaData.ctaPrimary || 'Get Started Now';
                const href = ctaData.ctaPrimaryHref || '/shared-hosting';
                const cls = "w-full sm:w-auto px-8 py-4 bg-white text-primary hover:bg-slate-100 rounded-xl font-black transition-all flex items-center justify-center gap-3 shadow-2xl shadow-white/10 text-sm group block text-center";
                const inner = <>{txt}<ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>;
                return href.startsWith('/') || href.startsWith('#')
                  ? <a href={href} className={cls}>{inner}</a>
                  : <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>;
              })()}
              {ctaData.showCtaSecondary !== false && (() => {
                const txt = ctaData.ctaSecondary || 'Contact Sales';
                const href = ctaData.ctaSecondaryHref || '/contact';
                const cls = "w-full sm:w-auto px-8 py-4 bg-white/10 text-white hover:bg-white/20 rounded-xl font-black transition-all border border-white/20 backdrop-blur-md text-sm block text-center";
                return href.startsWith('/') || href.startsWith('#')
                  ? <a href={href} className={cls}>{txt}</a>
                  : <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{txt}</a>;
              })()}
            </div>
            
            <p className="mt-10 text-xs text-white/40 font-bold uppercase tracking-widest">
              {ctaData.footer}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTA;
