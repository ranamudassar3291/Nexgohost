import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { useContent } from '@/context/ContentContext';

const FAQ: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState<number | null>(0);
  const { content } = useContent();

  const faqData = content?.faq || {
    title: 'Frequently Asked Questions',
    description: 'Everything you need to know about our hosting services and platform.',
    items: [
      {
        question: "What exactly is managed hosting?",
        answer: "Managed hosting means we take care of the technical heavy lifting. From server updates and security patches to performance optimization and backups, our team handles the infrastructure so you can focus on building your business."
      },
      {
        question: "Can I upgrade my plan later?",
        answer: "Absolutely! You can upgrade or downgrade your hosting plan at any time through your client dashboard. The process is seamless and won't cause any downtime for your website."
      },
      {
        question: "Do you offer a money-back guarantee?",
        answer: "Yes, we offer a 30-day money-back guarantee on all our hosting plans. If you're not completely satisfied with our service, we'll refund your payment, no questions asked."
      }
    ]
  };

  return (
    <section id="faq" className="py-14 bg-secondary relative overflow-hidden">
      <div className="tech-grid absolute inset-0 opacity-5"></div>
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2 className="text-3xl font-black text-white mb-3">{faqData.title}</h2>
          <p className="text-base text-slate-400 font-medium">{faqData.description}</p>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          {faqData.items.map((faq: any, i: number) => (
            <div 
              key={i} 
              className={`bg-white/5 rounded-2xl border transition-all ${activeIndex === i ? 'border-primary bg-white/10 shadow-2xl shadow-primary/5' : 'border-white/5 hover:border-white/10'}`}
            >
              <button
                onClick={() => setActiveIndex(activeIndex === i ? null : i)}
                className="w-full px-8 py-6 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-4">
                  <HelpCircle className={`transition-colors ${activeIndex === i ? 'text-primary' : 'text-slate-500'}`} size={24} />
                  <span className="text-lg font-black text-white">{faq.question}</span>
                </div>
                <ChevronDown 
                  className={`transition-transform duration-300 ${activeIndex === i ? 'rotate-180 text-primary' : 'text-slate-500'}`} 
                  size={20} 
                />
              </button>
              
              <AnimatePresence>
                {activeIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="px-8 pb-6 text-slate-400 font-medium leading-relaxed border-t border-white/5 pt-4">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQ;
