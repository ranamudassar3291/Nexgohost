import React from 'react';
import { motion } from 'motion/react';
import { Globe, Shield, Zap, Headphones, Database, Cpu, ArrowRight } from 'lucide-react';
import { useContent } from '../ContentContext';

const Services: React.FC = () => {
  const { content } = useContent();

  const servicesData = content?.services || {
    title: 'Comprehensive Hosting Solutions',
    description: 'Everything you need to build, manage, and scale your online presence with confidence and precision.',
    items: [
      { title: "Domain Registration", description: "Secure your perfect domain name with our lightning-fast registration and management tools.", color: "text-blue-600", bg: "bg-blue-50" },
      { title: "Managed SSD Hosting", description: "High-performance hosting with NVMe storage, optimized for speed and reliability.", color: "text-primary", bg: "bg-primary/5" },
      { title: "Advanced Security", description: "Enterprise-grade protection with DDoS mitigation, firewalls, and free SSL certificates.", color: "text-emerald-600", bg: "bg-emerald-50" },
      { title: "Blazing Performance", description: "LiteSpeed web servers and global CDN integration for the fastest load times possible.", color: "text-amber-600", bg: "bg-amber-50" },
      { title: "24/7 Expert Support", description: "Our dedicated team of hosting experts is always available to help you with any issues.", color: "text-purple-600", bg: "bg-purple-50" },
      { title: "Reseller Solutions", description: "Powerful white-label hosting packages designed for agencies and entrepreneurs.", color: "text-rose-600", bg: "bg-rose-50" }
    ]
  };

  const icons = [
    <Globe size={26} />,
    <Database size={26} />,
    <Shield size={26} />,
    <Zap size={26} />,
    <Headphones size={26} />,
    <Cpu size={26} />
  ];

  const iconBgs: string[] = [
    'bg-blue-50 text-blue-600',
    'bg-violet-50 text-violet-600',
    'bg-emerald-50 text-emerald-600',
    'bg-amber-50 text-amber-600',
    'bg-purple-50 text-purple-600',
    'bg-rose-50 text-rose-600',
  ];

  return (
    <section id="services" className="py-16 bg-white relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(103,61,230,0.04) 0%, transparent 60%)' }} />
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-xs font-black mb-6 uppercase tracking-widest border border-primary/20"
          >
            Our Services
          </motion.div>
          <h2 className="text-3xl lg:text-4xl font-black text-gray-900 mb-4 tracking-tight">{servicesData.title}</h2>
          <p className="text-base text-gray-500 font-medium leading-relaxed">{servicesData.description}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servicesData.items.map((s: any, i: number) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -6 }}
              className="p-7 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300 group"
            >
              <div className={`w-12 h-12 ${iconBgs[i % iconBgs.length]} rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                {icons[i % icons.length]}
              </div>
              <h3 className="text-lg font-black text-gray-900 mb-2 group-hover:text-primary transition-colors">{s.title}</h3>
              <p className="text-sm text-gray-500 font-medium leading-relaxed">{s.description}</p>
              <div className="mt-5 flex items-center gap-2 text-primary font-bold text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                Learn more <ArrowRight size={14} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;
