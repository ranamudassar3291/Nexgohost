import { motion } from "framer-motion";
import { Globe, Shield, Zap, Headphones, Database, Cpu, ArrowRight } from "lucide-react";

const SERVICES = [
  {
    title: "Domain Registration",
    description: "Secure your perfect domain name with our lightning-fast registration and management tools.",
    color: "text-blue-600", bg: "bg-blue-50", icon: <Globe size={32} />,
  },
  {
    title: "Managed SSD Hosting",
    description: "High-performance hosting with NVMe storage, optimized for speed and reliability.",
    color: "text-primary", bg: "bg-primary/5", icon: <Database size={32} />,
  },
  {
    title: "Advanced Security",
    description: "Enterprise-grade protection with DDoS mitigation, firewalls, and free SSL certificates.",
    color: "text-emerald-600", bg: "bg-emerald-50", icon: <Shield size={32} />,
  },
  {
    title: "Blazing Performance",
    description: "LiteSpeed web servers and global CDN integration for the fastest load times possible.",
    color: "text-amber-600", bg: "bg-amber-50", icon: <Zap size={32} />,
  },
  {
    title: "24/7 Expert Support",
    description: "Our dedicated team of hosting experts is always available to help you with any issues.",
    color: "text-purple-600", bg: "bg-purple-50", icon: <Headphones size={32} />,
  },
  {
    title: "Reseller Solutions",
    description: "Powerful white-label hosting packages designed for agencies and entrepreneurs.",
    color: "text-rose-600", bg: "bg-rose-50", icon: <Cpu size={32} />,
  },
];

export function SiteServices() {
  return (
    <section id="services" className="py-16 bg-white relative overflow-hidden">
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-600 text-xs font-black mb-6 uppercase tracking-widest"
          >
            Our Services
          </motion.div>
          <h2 className="text-3xl lg:text-4xl font-black text-slate-900 mb-4 tracking-tight">Comprehensive Hosting Solutions</h2>
          <p className="text-base text-slate-600 font-medium leading-relaxed">
            Everything you need to build, manage, and scale your online presence with confidence and precision.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {SERVICES.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -8 }}
              className="p-7 bg-white rounded-[24px] border border-slate-100 shadow-sm hover:shadow-2xl hover:border-primary/20 transition-all duration-500 group"
            >
              <div className={`w-12 h-12 ${s.bg} ${s.color} rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500`}>
                {s.icon}
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-3 group-hover:text-primary transition-colors">{s.title}</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">{s.description}</p>
              <div className="mt-5 flex items-center gap-2 text-primary font-bold text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                Learn more <ArrowRight size={16} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
