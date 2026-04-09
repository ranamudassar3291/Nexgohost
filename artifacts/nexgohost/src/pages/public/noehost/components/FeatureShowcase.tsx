import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Zap, Globe, ArrowRight, Lock, RefreshCw, Server, Cpu, Database, Wifi, Activity, HardDrive, Cloud, Shield } from 'lucide-react';
import { useContent } from '@/context/ContentContext';

const SecurityIllustration: React.FC = () => (
  <div className="relative w-full max-w-md mx-auto select-none">
    <div className="absolute inset-0 bg-primary/15 blur-[80px] rounded-full -z-10"></div>
    <div className="bg-slate-900 rounded-3xl p-6 shadow-2xl border border-white/10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
          <Shield size={20} className="text-emerald-400" />
        </div>
        <div>
          <div className="text-sm font-black text-white">Security Center</div>
          <div className="text-[10px] text-emerald-400 font-bold">All systems protected</div>
        </div>
        <div className="ml-auto w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
      </div>

      {/* SSL card */}
      <div className="bg-white/5 rounded-2xl p-4 mb-3 border border-white/5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
            <Lock size={14} className="text-emerald-400" />
          </div>
          <div>
            <div className="text-xs font-black text-white">SSL Certificate</div>
            <div className="text-[9px] text-slate-400 font-bold">256-bit encryption</div>
          </div>
          <div className="ml-auto text-[9px] bg-emerald-500/20 text-emerald-400 font-black px-2 py-0.5 rounded-full uppercase">Active</div>
        </div>
        <div className="flex gap-1">
          {['TLS 1.3','HSTS','OCSP','CAA'].map((t,i) => (
            <span key={i} className="text-[8px] bg-white/5 text-slate-400 font-bold px-1.5 py-0.5 rounded-md uppercase">{t}</span>
          ))}
        </div>
      </div>

      {/* DDoS card */}
      <div className="bg-white/5 rounded-2xl p-4 mb-3 border border-white/5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
            <ShieldCheck size={14} className="text-blue-400" />
          </div>
          <div>
            <div className="text-xs font-black text-white">DDoS Protection</div>
            <div className="text-[9px] text-slate-400 font-bold">Multi-layer defense</div>
          </div>
          <div className="ml-auto text-[9px] bg-blue-500/20 text-blue-400 font-black px-2 py-0.5 rounded-full uppercase">On</div>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full w-11/12 bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"></div>
        </div>
        <div className="text-[9px] text-slate-500 font-bold mt-1">Blocked 0 threats today</div>
      </div>

      {/* Firewall rows */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Firewall', icon: <Shield size={12}/>, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { label: 'Malware Scan', icon: <Activity size={12}/>, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Backup', icon: <Database size={12}/>, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        ].map((item, i) => (
          <div key={i} className={`${item.bg} rounded-xl p-2.5 text-center`}>
            <span className={`${item.color} flex justify-center mb-1`}>{item.icon}</span>
            <div className={`text-[8px] font-black uppercase ${item.color}`}>{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const PerformanceIllustration: React.FC = () => (
  <div className="relative w-full max-w-md mx-auto select-none">
    <div className="absolute inset-0 bg-emerald-500/10 blur-[80px] rounded-full -z-10"></div>
    <div className="bg-slate-900 rounded-3xl p-6 shadow-2xl border border-white/10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
          <Zap size={20} className="text-primary-400" />
        </div>
        <div>
          <div className="text-sm font-black text-white">Performance Monitor</div>
          <div className="text-[10px] text-primary-400 font-bold">NVMe SSD powered</div>
        </div>
      </div>

      {/* Speed meter */}
      <div className="bg-white/5 rounded-2xl p-4 mb-3 border border-white/5 text-center">
        <div className="text-4xl font-black text-white mb-1">247<span className="text-xl text-slate-400">ms</span></div>
        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3">Avg. Response Time</div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full w-1/4 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"></div>
        </div>
        <div className="flex justify-between text-[8px] text-slate-500 font-bold mt-1">
          <span>0ms</span><span>1000ms</span>
        </div>
      </div>

      {/* Migration + Storage */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw size={12} className="text-emerald-400" />
            <span className="text-[10px] font-black text-white">Migration</span>
          </div>
          <div className="text-lg font-black text-emerald-400">Free</div>
          <div className="text-[8px] text-slate-500 font-bold">Zero downtime</div>
        </div>
        <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive size={12} className="text-primary-400" />
            <span className="text-[10px] font-black text-white">NVMe SSD</span>
          </div>
          <div className="text-lg font-black text-primary-400">20×</div>
          <div className="text-[8px] text-slate-500 font-bold">Faster reads</div>
        </div>
      </div>

      {/* Resource bars */}
      <div className="space-y-2">
        {[
          { label: 'LiteSpeed Cache', val: '92%', w: 'w-11/12', color: 'bg-primary' },
          { label: 'CDN Edge Nodes', val: '200+', w: 'w-4/5', color: 'bg-emerald-500' },
          { label: 'Global Uptime', val: '99.9%', w: 'w-full', color: 'bg-purple-500' },
        ].map((row, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="text-[9px] text-slate-400 font-bold w-24 shrink-0">{row.label}</div>
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className={`h-full ${row.w} ${row.color} rounded-full`}></div>
            </div>
            <span className="text-[9px] font-black text-white w-8 text-right">{row.val}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const FeatureShowcase: React.FC = () => {
  const { content } = useContent();

  const data = content?.featureShowcase || {
    badge: 'Premium Features',
    title: 'Feature-Rich Hosting for Every Website',
    description: 'Packed with performance-enhancing tools and trusted by thousands, our hosting solutions are built to help your site thrive in the modern web.',
    row1: {
      title: 'Everything You Need to Host & Grow Your Website',
      description: 'Our hosting platform combines power, simplicity, and reliability so you can focus on growing your business while we handle the technical heavy lifting.',
      features: [
        { title: 'SSL Certificates', description: 'Secure your site and build trust with free, automated SSL certificates for all your domains and subdomains.', icon: 'Lock' },
        { title: 'Advanced DDoS Protection', description: 'Multi-layer protection ensures your website remains online even during the most intense traffic spikes or attacks.', icon: 'ShieldCheck' }
      ]
    },
    row2: {
      title: 'Powerful Features Built for Unmatched Performance',
      description: 'Explore a full suite of premium hosting features designed to keep your website fast, secure, and always accessible to your global audience.',
      features: [
        { title: 'Free Website Migration', description: 'Moving from another host? Our experts will migrate your website for free with zero downtime, guaranteed.', icon: 'RefreshCw' },
        { title: 'NVMe SSD Storage', description: 'Experience up to 20x faster load times with our enterprise-grade NVMe SSD storage across all hosting plans.', icon: 'Cpu' }
      ]
    }
  };

  const IconMap: any = {
    Lock: <Lock size={28} />,
    ShieldCheck: <ShieldCheck size={28} />,
    RefreshCw: <RefreshCw size={28} />,
    Cpu: <Cpu size={28} />,
    Zap: <Zap size={28} />,
    Globe: <Globe size={28} />,
    Server: <Server size={28} />
  };

  return (
    <section className="py-16 bg-[#0d0d1f] overflow-hidden">
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary-300 text-xs font-black mb-6 uppercase tracking-widest"
          >
            <Zap size={14} className="fill-primary-300" />
            {data.badge}
          </motion.div>
          <h2 className="text-3xl lg:text-4xl font-black text-white mb-4 tracking-tight">
            {data.title}
          </h2>
          <p className="text-lg text-slate-400 font-medium leading-relaxed">
            {data.description}
          </p>
        </div>

        {/* Feature Row 1 */}
        <div className="flex flex-col lg:flex-row items-center gap-10 mb-16">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="lg:w-1/2"
          >
            <SecurityIllustration />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="lg:w-1/2"
          >
            <h3 className="text-3xl lg:text-4xl font-black text-white mb-6 leading-tight">
              {data.row1.title}
            </h3>
            <p className="text-lg text-slate-400 mb-10 font-medium">
              {data.row1.description}
            </p>

            <div className="space-y-8">
              {data.row1.features.map((f: any, i: number) => (
                <div key={i} className="flex items-start gap-6 group">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary-300 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                    {IconMap[f.icon] || <Zap size={28} />}
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-white mb-2">{f.title}</h4>
                    <p className="text-slate-400 font-medium leading-relaxed">
                      {f.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <button className="mt-12 flex items-center gap-2 text-primary-300 font-black text-sm uppercase tracking-widest hover:gap-4 transition-all group">
              Explore All Features <ArrowRight size={18} />
            </button>
          </motion.div>
        </div>

        {/* Feature Row 2 */}
        <div className="flex flex-col lg:flex-row-reverse items-center gap-10">
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="lg:w-1/2"
          >
            <PerformanceIllustration />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="lg:w-1/2"
          >
            <h3 className="text-3xl lg:text-4xl font-black text-white mb-6 leading-tight">
              {data.row2.title}
            </h3>
            <p className="text-lg text-slate-400 mb-10 font-medium">
              {data.row2.description}
            </p>

            <div className="space-y-8">
              {data.row2.features.map((f: any, i: number) => (
                <div key={i} className="flex items-start gap-6 group">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                    {IconMap[f.icon] || <Zap size={28} />}
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-white mb-2">{f.title}</h4>
                    <p className="text-slate-400 font-medium leading-relaxed">
                      {f.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <button className="mt-12 flex items-center gap-2 text-emerald-400 font-black text-sm uppercase tracking-widest hover:gap-4 transition-all group">
              View Performance Specs <ArrowRight size={18} />
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default FeatureShowcase;
