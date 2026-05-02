import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Zap, Shield, Globe, Clock, Activity, RefreshCw, ArrowRight, Database, Lock, Cpu, Server, Cloud, HardDrive, Terminal, Code, Headphones, Settings, Star } from 'lucide-react';
import { useContent } from '../ContentContext';

const IconMap: any = {
  Zap: <Zap size={22} />,
  Shield: <Shield size={22} />,
  Globe: <Globe size={22} />,
  Clock: <Clock size={22} />,
  Activity: <Activity size={22} />,
  RefreshCw: <RefreshCw size={22} />,
  Database: <Database size={22} />,
  Lock: <Lock size={22} />,
  Cpu: <Cpu size={22} />,
  Server: <Server size={22} />,
  Cloud: <Cloud size={22} />,
  HardDrive: <HardDrive size={22} />,
  Terminal: <Terminal size={22} />,
  Code: <Code size={22} />,
  Headphones: <Headphones size={22} />,
  Settings: <Settings size={22} />,
  Star: <Star size={22} />,
  CheckCircle2: <CheckCircle2 size={22} />,
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
    if (icon && typeof icon === 'string') return IconMap[icon] || <Zap size={22} />;
    if (icon && typeof icon === 'object') return icon;
    return <Zap size={22} />;
  };

  return (
    <section id="features" className="py-16 bg-gray-50 relative overflow-hidden">
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-xs font-black mb-6 uppercase tracking-widest border border-primary/20"
          >
            Core Features
          </motion.div>
          <h2 className="text-4xl lg:text-5xl font-black text-gray-900 mb-6 tracking-tight">{featuresData.title}</h2>
          <p className="text-lg text-gray-500 font-medium leading-relaxed">{featuresData.description}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 max-w-7xl mx-auto">
          {items.map((f: any, i: number) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              className="group p-6 bg-white rounded-2xl border border-gray-100 hover:border-primary/30 hover:shadow-md transition-all duration-300 flex flex-col"
            >
              <div className="flex justify-between items-start mb-5">
                <div className="w-11 h-11 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all duration-300 shadow-sm">
                  {resolveIcon(f.icon)}
                </div>
                {f.badge && (
                  <span className={`text-[10px] font-black px-2 py-1 rounded-md tracking-widest ${f.badge === 'AI' ? 'bg-purple-100 text-purple-600' : 'bg-primary/10 text-primary'}`}>
                    {f.badge}
                  </span>
                )}
              </div>

              <h4 className="text-base font-black text-gray-900 mb-2 group-hover:text-primary transition-colors">{f.title}</h4>
              <p className="text-sm text-gray-500 font-medium leading-relaxed mb-4 flex-grow">{f.description}</p>

              <div className="flex items-center gap-2 text-primary font-bold text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                Learn more <ArrowRight size={13} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
