import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const TESTIMONIALS = [
  {
    name: "Sarah Jenkins",
    role: "E-commerce Founder",
    content: "Noehost transformed our online store's performance. Our page load times dropped by 60%, and our conversion rate has never been higher. Their support is truly 24/7.",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
  },
  {
    name: "Michael Chen",
    role: "Web Agency Owner",
    content: "The reseller hosting plan is a game-changer. I can manage all my client sites from one dashboard with white-labeling that looks professional. Best decision for my agency.",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
  },
  {
    name: "David Rodriguez",
    role: "Full Stack Developer",
    content: "As a developer, I appreciate the NVMe storage and the freedom of the environment. Deployment is a breeze, and the uptime is rock-solid. Highly recommended.",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80",
  },
];

const PARTNERS = ["Cloudflare", "cPanel", "LiteSpeed", "Softaculous", "Intel", "AMD"];

export function SiteTestimonials() {
  return (
    <section id="testimonials" className="py-14 bg-[#020617] relative overflow-hidden">
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: "linear-gradient(rgba(106,98,254,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(106,98,254,0.3) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2 className="text-3xl font-black text-white mb-3">Trusted by Thousands</h2>
          <p className="text-base text-slate-400 font-medium">
            Don't just take our word for it. Here's what our amazing community has to say about Noehost.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -5 }}
              className="p-8 rounded-3xl bg-[#0F172A]/50 border border-white/5 relative group hover:border-white/10 transition-all"
            >
              <Quote className="absolute top-6 right-8 text-primary/10 group-hover:text-primary/20 transition-colors" size={48} />

              <div className="flex gap-1 mb-6">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} size={16} className="fill-[#FFD700] text-[#FFD700]" />
                ))}
              </div>

              <p className="text-slate-300 mb-8 italic leading-relaxed font-medium">"{t.content}"</p>

              <div className="flex items-center gap-4">
                <img src={t.avatar} alt={t.name} className="w-12 h-12 rounded-full border-2 border-white/10 shadow-sm" />
                <div>
                  <h4 className="font-black text-white">{t.name}</h4>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Partner Logo Cloud */}
        <div className="pt-8 border-t border-white/5">
          <p className="text-center text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6">
            Powering our infrastructure with the best
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700">
            {PARTNERS.map((p, i) => (
              <span key={i} className="text-lg md:text-xl font-black text-white/50 hover:text-white transition-colors cursor-default">{p}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
