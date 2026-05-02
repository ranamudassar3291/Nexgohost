import React from 'react';
import { motion } from 'motion/react';
import { Server, CheckCircle2, Zap, Cloud, Mail, Settings, Globe, Layout, Sparkles, Database, Cpu, Users, Lock, Shield, HardDrive, RefreshCw, Wifi, Activity } from 'lucide-react';
import { useContent } from '../ContentContext';

const SharedHostingIllustration: React.FC = () => (
  <div className="w-full space-y-2 select-none">
    <div className="bg-white/10 rounded-xl p-3 flex items-center gap-3">
      <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center"><Server size={16} className="text-white" /></div>
      <div className="flex-1">
        <div className="text-[10px] text-white/60 font-bold mb-1">CPU Usage</div>
        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden"><div className="h-full w-3/5 bg-white rounded-full"></div></div>
      </div>
      <span className="text-[10px] font-black text-white">60%</span>
    </div>
    <div className="bg-white/10 rounded-xl p-3 flex items-center gap-3">
      <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center"><Database size={16} className="text-white" /></div>
      <div className="flex-1">
        <div className="text-[10px] text-white/60 font-bold mb-1">Storage</div>
        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden"><div className="h-full w-2/5 bg-white rounded-full"></div></div>
      </div>
      <span className="text-[10px] font-black text-white">40%</span>
    </div>
    <div className="bg-white/10 rounded-xl p-3 flex items-center gap-3">
      <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center"><Wifi size={16} className="text-white" /></div>
      <div className="flex-1">
        <div className="text-[10px] text-white/60 font-bold mb-1">Bandwidth</div>
        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden"><div className="h-full w-4/5 bg-white rounded-full"></div></div>
      </div>
      <span className="text-[10px] font-black text-white">80%</span>
    </div>
    <div className="grid grid-cols-3 gap-2 mt-1">
      {[{v:'99.9%',l:'Uptime'},{v:'< 1ms',l:'Latency'},{v:'24/7',l:'Support'}].map((s,i)=>(
        <div key={i} className="bg-white/10 rounded-lg p-2 text-center">
          <div className="text-sm font-black text-white">{s.v}</div>
          <div className="text-[8px] text-white/60 uppercase font-bold">{s.l}</div>
        </div>
      ))}
    </div>
  </div>
);

const WordPressIllustration: React.FC = () => (
  <div className="w-full h-32 rounded-2xl flex flex-col items-center justify-center gap-2 select-none" style={{ background: 'rgba(255,255,255,0.05)' }}>
    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
      <Layout size={22} className="text-primary-300" />
    </div>
    <div className="flex gap-1">
      {['#','W','P'].map((c,i)=>(
        <div key={i} className="w-6 h-6 bg-white/10 rounded text-[10px] font-black text-slate-300 flex items-center justify-center">{c}</div>
      ))}
    </div>
    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">1-Click Install</div>
  </div>
);

const VPSIllustration: React.FC = () => (
  <div className="w-full h-32 rounded-2xl flex flex-col items-center justify-center gap-2 select-none" style={{ background: 'rgba(16,185,129,0.06)' }}>
    <div className="flex gap-2">
      {[1,2,3].map(i=>(
        <div key={i} className="w-8 h-16 bg-emerald-500/10 rounded-lg flex flex-col items-center justify-center gap-1">
          <div className="w-5 h-1 bg-emerald-500 rounded-full"></div>
          <div className="w-5 h-1 bg-emerald-500 rounded-full opacity-60"></div>
          <div className="w-5 h-1 bg-emerald-500 rounded-full opacity-30"></div>
          <Cpu size={10} className="text-emerald-400 mt-1" />
        </div>
      ))}
    </div>
    <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Dedicated vCPUs</div>
  </div>
);

const EmailIllustration: React.FC = () => (
  <div className="w-full h-32 rounded-2xl flex flex-col items-center justify-center gap-2 select-none" style={{ background: 'rgba(244,63,94,0.06)' }}>
    <div className="w-14 h-10 bg-rose-500/20 rounded-xl flex items-center justify-center relative">
      <Mail size={22} className="text-rose-400" />
      <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-white text-[8px] font-black flex items-center justify-center">3</div>
    </div>
    <div className="flex flex-col gap-1 w-4/5">
      {['inbox@domain.com','team@domain.com'].map((e,i)=>(
        <div key={i} className="bg-rose-500/10 rounded-md px-2 py-1 text-[8px] font-bold text-rose-400 truncate">{e}</div>
      ))}
    </div>
  </div>
);

const CpanelIllustration: React.FC = () => (
  <div className="w-full h-32 rounded-2xl flex flex-col items-center justify-center gap-2 select-none" style={{ background: 'rgba(245,158,11,0.06)' }}>
    <div className="grid grid-cols-3 gap-2">
      {[
        {icon:<Settings size={12}/>,label:'cPanel'},
        {icon:<Database size={12}/>,label:'MySQL'},
        {icon:<Globe size={12}/>,label:'DNS'},
        {icon:<Shield size={12}/>,label:'SSL'},
        {icon:<HardDrive size={12}/>,label:'Files'},
        {icon:<RefreshCw size={12}/>,label:'Backup'},
      ].map((item,i)=>(
        <div key={i} className="w-10 h-10 bg-amber-500/10 rounded-xl flex flex-col items-center justify-center gap-0.5">
          <span className="text-amber-400">{item.icon}</span>
          <span className="text-[6px] font-black text-amber-500 uppercase">{item.label}</span>
        </div>
      ))}
    </div>
  </div>
);

const WebHostingIllustration: React.FC = () => (
  <div className="w-full h-32 rounded-2xl bg-rose-600 flex flex-col items-center justify-center gap-2 select-none">
    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
      <Globe size={24} className="text-white" />
    </div>
    <div className="flex gap-1 items-center">
      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
      <div className="text-[9px] font-black text-white/80 uppercase tracking-widest">Online & Secured</div>
    </div>
  </div>
);

const ResellerIllustration: React.FC = () => (
  <div className="w-full h-32 rounded-2xl flex flex-col items-center justify-center gap-2 select-none" style={{ background: 'rgba(59,130,246,0.06)' }}>
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center"><Users size={16} className="text-blue-400" /></div>
      <div className="flex flex-col gap-1">
        {[1,2,3].map(i=>(
          <div key={i} className="flex items-center gap-1">
            <div className="w-4 h-4 bg-blue-500/20 rounded-full flex items-center justify-center">
              <Users size={8} className="text-blue-400" />
            </div>
            <div className="w-12 h-1.5 bg-blue-500/20 rounded-full"></div>
          </div>
        ))}
      </div>
    </div>
    <div className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Manage Clients</div>
  </div>
);

const ControlEfficiency: React.FC = () => {
  const { content } = useContent();

  const data = content?.controlEfficiency || {
    title: 'Maximum Control and Efficiency',
    mainCard: {
      title: 'Shared Web Hosting',
      description: 'The most popular hosting available, our plans offer exceptional performance and reliability.',
      features: [
        'Free SSL certificates included',
        'One-click WordPress installation',
        'Unlimited bandwidth & storage'
      ],
    },
    items: [
      { title: "WordPress Hosting", description: "The most popular hosting available, our plans offer exceptional performance.", icon: 'Layout', color: "text-gray-900", iconColor: "text-primary", darkBg: "" },
      { title: "VPS Hosting", description: "Upgrade to dedicated resources for increased hosting performance.", icon: 'Cloud', color: "text-gray-900", iconColor: "text-emerald-600", darkBg: "" },
      { title: "Email Hosting", description: "The most popular hosting available, our plans offer exceptional reliability.", icon: 'Mail', color: "text-gray-900", iconColor: "text-rose-500", darkBg: "" },
      { title: "cPanel Hosting", description: "cPanel Hosting is a popular hosting solution that provides a modern control panel.", icon: 'Settings', color: "text-gray-900", iconColor: "text-amber-500", darkBg: "" },
      { title: "Web Hosting", description: "Web hosting is a service that enables individuals and organizations to make sites.", icon: 'Server', color: "text-gray-900", iconColor: "text-primary", darkBg: "" },
      { title: "Reseller Hosting", description: "Reseller Hosting allows individuals or businesses to purchase hosting services.", icon: 'Globe', color: "text-gray-900", iconColor: "text-blue-500", darkBg: "" }
    ]
  };

  const IconMap: any = {
    Layout: <Layout size={32} />,
    Cloud: <Cloud size={32} />,
    Mail: <Mail size={32} />,
    Settings: <Settings size={32} />,
    Server: <Server size={32} />,
    Globe: <Globe size={32} />,
    Zap: <Zap size={32} />,
    Sparkles: <Sparkles size={32} />
  };

  const IllustrationMap: any = {
    'WordPress Hosting': <WordPressIllustration />,
    'VPS Hosting': <VPSIllustration />,
    'Email Hosting': <EmailIllustration />,
    'cPanel Hosting': <CpanelIllustration />,
    'Web Hosting': <WebHostingIllustration />,
    'Reseller Hosting': <ResellerIllustration />,
  };

  return (
    <section className="py-14 overflow-hidden bg-gray-50">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(103,61,230,0.08) 0%, transparent 60%)' }} />
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-10">
          <h2 className="text-3xl lg:text-4xl font-black text-gray-900">
            {data.title}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Large Feature Card - Shared Web Hosting */}
          <div className="md:col-span-2 xl:col-span-2">
            <div className="h-full rounded-[28px] p-8 text-white relative overflow-hidden group" style={{ background: 'linear-gradient(135deg, #673de6 0%, #4c22cc 100%)' }}>
              <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
                <div className="md:w-3/5">
                  <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center text-white mb-8 shadow-lg border border-white/20">
                    <Server size={32} />
                  </div>
                  <h3 className="text-2xl font-black mb-4">{data.mainCard.title}</h3>
                  <p className="text-white/80 font-medium mb-8">
                    {data.mainCard.description}
                  </p>
                  <ul className="space-y-4">
                    {data.mainCard.features.map((item: string, i: number) => (
                      <li key={i} className="flex items-center gap-3">
                        <CheckCircle2 size={18} className="text-white/70" />
                        <span className="font-bold text-sm">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="hidden md:block md:w-2/5">
                  <SharedHostingIllustration />
                </div>
              </div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
            </div>
          </div>

          {/* Smaller Feature Cards */}
          {data.items.map((feature: any, i: number) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`flex flex-col rounded-[28px] p-6 ${feature.color} transition-all duration-300 group min-h-[280px] border border-gray-100 hover:border-primary/20 hover:shadow-md bg-white`}
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${feature.iconColor} mb-6 bg-gray-50 border border-gray-100 group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all`}>
                {IconMap[feature.icon] || <Zap size={32} />}
              </div>
              <h4 className="text-xl font-black text-gray-900 mb-3">{feature.title}</h4>
              <p className="text-sm font-medium text-gray-500 mb-8 leading-relaxed">
                {feature.description}
              </p>
              <div className="mt-auto">
                {IllustrationMap[feature.title] || (
                  <div className="w-full h-32 rounded-2xl bg-gray-50 flex items-center justify-center border border-gray-100">
                    <div className={`${feature.iconColor} opacity-40`}>{IconMap[feature.icon]}</div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ControlEfficiency;
