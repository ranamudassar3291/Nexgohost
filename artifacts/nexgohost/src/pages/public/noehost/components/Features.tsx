import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Zap, Shield, Globe, Clock, Activity, RefreshCw, ArrowRight, Database, Lock, Cpu, Server, Cloud, HardDrive, Terminal, Code, Headphones, Settings, Star } from 'lucide-react';
import { useContent } from '@/context/ContentContext';

const IconMap: any = {
  Zap: <Zap size={24} />,
  Shield: <Shield size={24} />,
  Globe: <Globe size={24} />,
  Clock: <Clock size={24} />,
  Activity: <Activity size={24} />,
  RefreshCw: <RefreshCw size={24} />,
  Database: <Database size={24} />,
  Lock: <Lock size={24} />,
  Cpu: <Cpu size={24} />,
  Server: <Server size={24} />,
  Cloud: <Cloud size={24} />,
  HardDrive: <HardDrive size={24} />,
  Terminal: <Terminal size={24} />,
  Code: <Code size={24} />,
  Headphones: <Headphones size={24} />,
  Settings: <Settings size={24} />,
  Star: <Star size={24} />,
  CheckCircle2: <CheckCircle2 size={24} />,
};

const defaultItems = [
  { title: "Maximum Performance", description: "Blazing fast load times with NVMe storage and LiteSpeed technology.", icon: "Zap", badge: 'POPULAR' },
  { title: "Advanced Security", description: "Keep your data safe with automated backups and Imunify360 protection.", icon: "Shield" },
  { title: "Global Reach", description: "Serve your content from 200+ edge locations worldwide via our CDN.", icon: "Globe" },
  { title: "24/7 Expert Support", description: "Our team of experts is always here to help you with any technical issues.", icon: "Clock" },
  { title: "AI-Powered Tools", description: "Leverage AI to build, optimize, and manage your website effortlessly.", icon: "Activity", badge: 'AI' },
  { title: "Free Migration", description: "We'll move your site to Noehost for free with zero downtime guaranteed.", icon: "RefreshCw" },
  { title: "Daily Backups", description: "Automated daily backups ensure your data is always safe and recoverable.", icon: "Database" },
  { title: "One-Click Installs", description: "Install WordPress, Joomla, and 400+ apps with just a single click.", icon: "Server" },
  { title: "Free SSL Certificates", description: "Secure your website and improve SEO with free Let's Encrypt SSL.", icon: "Lock" },
  { title: "99.9% Uptime", description: "Our high-availability infrastructure guarantees your site stays online.", icon: "Activity" },
  { title: "NVMe SSD Storage", description: "Experience 20x faster storage performance compared to traditional SSDs.", icon: "Cpu" },
  { title: "LiteSpeed Server", description: "Optimized web server technology for superior speed and handling.", icon: "Zap" },
];

const Features: React.FC = () => {
  const { content } = useContent();

  const featuresData = content?.features || {
    title: 'Powerful Features for Modern Websites',
    description: "Experience the perfect blend of performance, security, and ease of use. Our infrastructure is built for the future of the web.",
    items: defaultItems
  };

  const items = featuresData.items || defaultItems;

  const resolveIcon = (icon: any) => {
    if (icon && typeof icon === 'string') {
      return IconMap[icon] || <Zap size={24} />;
    }
    if (icon && typeof icon === 'object') {
      return icon;
    }
    return <Zap size={24} />;
  };

  return (
    <section id="features" className="py-16 bg-secondary relative overflow-hidden">
      <div className="tech-grid absolute inset-0 opacity-5"></div>
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary-300 text-xs font-black mb-6 uppercase tracking-widest"
          >
            Core Features
          </motion.div>
          <h2 className="text-4xl lg:text-5xl font-black text-white mb-6 tracking-tight">{featuresData.title}</h2>
          <p className="text-lg text-slate-400 font-medium leading-relaxed">{featuresData.description}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {items.map((f: any, i: number) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="group p-6 bg-white/5 rounded-[24px] border border-white/5 hover:border-primary/30 hover:bg-white/10 transition-all duration-500 flex flex-col"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-primary-300 group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-sm border border-white/5">
                  {resolveIcon(f.icon)}
                </div>
                {f.badge && (
                  <span className={`text-[10px] font-black px-2 py-1 rounded-md tracking-widest ${f.badge === 'AI' ? 'bg-purple-500/20 text-purple-300' : 'bg-primary/20 text-primary-300'}`}>
                    {f.badge}
                  </span>
                )}
              </div>

              <h4 className="text-xl font-black text-white mb-3 group-hover:text-primary-300 transition-colors">{f.title}</h4>
              <p className="text-sm text-slate-400 font-medium leading-relaxed mb-6 flex-grow">{f.description}</p>

              <div className="flex items-center gap-2 text-primary-300 font-bold text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                Learn more <ArrowRight size={14} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
