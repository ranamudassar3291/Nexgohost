import React from 'react';
import { motion } from 'motion/react';
import { Star, Quote } from 'lucide-react';
import { useContent } from '../ContentContext';

const Testimonials: React.FC = () => {
  const { content } = useContent();

  const testimonialsData = content?.testimonials || {
    title: 'Trusted by Thousands',
    description: "Don't just take our word for it. Here's what our amazing community has to say about Noehost.",
    items: [
      {
        name: "Sarah Jenkins",
        role: "E-commerce Founder",
        content: "Noehost transformed our online store's performance. Our page load times dropped by 60%, and our conversion rate has never been higher. Their support is truly 24/7.",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80"
      },
      {
        name: "Michael Chen",
        role: "Web Agency Owner",
        content: "The reseller hosting plan is a game-changer. I can manage all my client sites from one dashboard with white-labeling that looks professional. Best decision for my agency.",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80"
      },
      {
        name: "David Rodriguez",
        role: "Full Stack Developer",
        content: "As a developer, I appreciate the NVMe storage and the freedom of the environment. Deployment is a breeze, and the uptime is rock-solid. Highly recommended.",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80"
      }
    ],
    partners: ["Cloudflare", "cPanel", "LiteSpeed", "Softaculous", "Intel", "AMD"]
  };

  return (
    <section id="testimonials" className="py-14 bg-dark relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(103,61,230,0.10) 0%, transparent 55%)' }} />
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2 className="text-3xl font-black text-white mb-3">{testimonialsData.title}</h2>
          <p className="text-base text-slate-400 font-medium">{testimonialsData.description}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {testimonialsData.items.map((t: any, i: number) => (
            <motion.div
              key={i}
              whileHover={{ y: -5 }}
              className="p-8 rounded-2xl bg-white/5 border border-white/10 relative group hover:border-primary/30 hover:bg-white/8 transition-all"
            >
              <Quote className="absolute top-6 right-8 text-primary/15 group-hover:text-primary/25 transition-colors" size={44} />

              <div className="flex gap-1 mb-5">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} size={15} className="fill-amber-400 text-amber-400" />
                ))}
              </div>

              <p className="text-slate-300 mb-7 italic leading-relaxed font-medium text-sm">
                "{t.content}"
              </p>

              <div className="flex items-center gap-3">
                <img src={t.avatar} alt={t.name} className="w-11 h-11 rounded-full border-2 border-white/20 shadow-sm object-cover" />
                <div>
                  <h4 className="font-black text-white text-sm">{t.name}</h4>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="pt-8 border-t border-white/10">
          <p className="text-center text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6">Powering our infrastructure with the best</p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-14 opacity-40 hover:opacity-80 transition-all duration-500 grayscale hover:grayscale-0">
            {testimonialsData.partners.map((p: string, i: number) => (
              <span key={i} className="text-lg md:text-xl font-black text-slate-400 hover:text-primary transition-colors cursor-default">{p}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
