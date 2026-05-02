import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { useContent } from '../ContentContext';

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
    <section id="faq" className="py-14 bg-gray-50 relative overflow-hidden">
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2 className="text-3xl font-black text-gray-900 mb-3">{faqData.title}</h2>
          <p className="text-base text-gray-500 font-medium">{faqData.description}</p>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {faqData.items.map((faq: any, i: number) => (
            <div
              key={i}
              className={`bg-white rounded-2xl border transition-all shadow-sm ${
                activeIndex === i
                  ? 'border-primary shadow-md shadow-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <button
                onClick={() => setActiveIndex(activeIndex === i ? null : i)}
                className="w-full px-7 py-5 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <HelpCircle
                    className={`flex-shrink-0 transition-colors ${activeIndex === i ? 'text-primary' : 'text-gray-400'}`}
                    size={20}
                  />
                  <span className="text-base font-black text-gray-900">{faq.question}</span>
                </div>
                <ChevronDown
                  className={`flex-shrink-0 transition-transform duration-300 ${activeIndex === i ? 'rotate-180 text-primary' : 'text-gray-400'}`}
                  size={18}
                />
              </button>

              <AnimatePresence>
                {activeIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-7 pb-6 text-gray-500 font-medium leading-relaxed border-t border-gray-100 pt-4 text-sm">
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
