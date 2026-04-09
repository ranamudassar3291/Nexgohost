import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import {
  Cpu, Terminal, Shield, Zap, HardDrive, Globe, Server,
  ArrowRight, Check, ChevronRight, Database, Lock, Activity,
  Code, RefreshCw, Network, Monitor
} from 'lucide-react';
import { useContent } from '@/context/ContentContext';
import { useCurrency } from '@/context/CurrencyProvider';

const UC_ICONS: any = { 'Development & Testing': <Code size={22} />, 'High-Traffic Websites': <Globe size={22} />, 'Database Servers': <Database size={22} />, 'Game Servers': <Monitor size={22} />, 'VPN & Security': <Shield size={22} />, 'Analytics & APIs': <Activity size={22} /> };
const SEC_ICONS: any = { 'DDoS Mitigation': <Shield size={24} />, 'Firewall Control': <Lock size={24} />, 'Root SSH Access': <Terminal size={24} />, 'Snapshot Backups': <RefreshCw size={24} /> };
const DEFAULT_ICON = <Zap size={22} />;

const terminalLines = [
  { text: '$ ssh root@203.0.113.42', color: 'text-slate-400' },
  { text: 'Welcome to Noehost VPS — Ubuntu 22.04 LTS', color: 'text-emerald-400' },
  { text: 'root@noehost-vps:~# uname -a', color: 'text-slate-400' },
  { text: 'Linux noehost-vps 5.15.0 #1 SMP x86_64 GNU/Linux', color: 'text-primary-300' },
  { text: 'root@noehost-vps:~# free -h', color: 'text-slate-400' },
  { text: '              total    used    free', color: 'text-slate-500' },
  { text: 'Mem:           8.0G    1.2G    6.8G', color: 'text-accent' },
  { text: 'root@noehost-vps:~# _', color: 'text-primary-300 animate-pulse' },
];

const VPS_DEFAULT: any = {
  hero: {
    badge: 'High Performance', title: 'VPS Hosting.', titleHighlight: 'Your Rules.',
    description: 'Deploy a high-performance KVM VPS in under 60 seconds. Full root access, dedicated resources, and a 10 Gbps uplink — all backed by our 99.9% uptime SLA.',
    primaryBtn: { text: 'Deploy Now', url: '#vps-plans', show: true },
    secondaryBtn: { text: 'View Specs', url: '#vps-specs', show: true },
    badges: ['Full Root Access', 'KVM Virtualization', 'Instant Deployment', '10 Gbps Uplink'],
  },
  plans: [
    { name: 'VPS 1', price: 19.99, cpu: '2 vCPU Cores', ram: '4 GB RAM', storage: '80 GB NVMe SSD', bandwidth: '2 TB', popular: false, btnText: 'Deploy Now', btnUrl: '/register' },
    { name: 'VPS 2', price: 39.99, cpu: '4 vCPU Cores', ram: '8 GB RAM', storage: '160 GB NVMe SSD', bandwidth: '4 TB', popular: true, btnText: 'Deploy Now', btnUrl: '/register' },
    { name: 'VPS 3', price: 79.99, cpu: '8 vCPU Cores', ram: '16 GB RAM', storage: '320 GB NVMe SSD', bandwidth: '8 TB', popular: false, btnText: 'Deploy Now', btnUrl: '/register' },
    { name: 'VPS 4', price: 149.99, cpu: '16 vCPU Cores', ram: '32 GB RAM', storage: '640 GB NVMe SSD', bandwidth: 'Unmetered', popular: false, btnText: 'Deploy Now', btnUrl: '/register' },
  ],
  plansTitle: 'Choose Your Power',
  plansDesc: 'All plans include 10 Gbps uplink, DDoS protection & instant provisioning.',
  useCases: [
    { title: 'Development & Testing', desc: 'Isolated environments for developing and testing applications without affecting production.' },
    { title: 'High-Traffic Websites', desc: 'Dedicated resources ensure consistent performance even during traffic spikes.' },
    { title: 'Database Servers', desc: 'Optimise MySQL, PostgreSQL or MongoDB with dedicated RAM and NVMe storage.' },
    { title: 'Game Servers', desc: 'Low-latency servers perfect for hosting Minecraft, CS2, Rust and other game servers.' },
    { title: 'VPN & Security', desc: 'Run your own private VPN, firewall, or security appliance with full root control.' },
    { title: 'Analytics & APIs', desc: 'Handle heavy API workloads and analytics processing with guaranteed compute resources.' },
  ],
  useCasesTitle: 'What Will You Build?',
  useCasesDesc: 'From web apps to game servers, our VPS plans handle any workload.',
  techSpecs: [
    { spec: 'Processor', value: 'AMD EPYC / Intel Xeon (latest gen)' },
    { spec: 'Storage', value: 'NVMe SSD (PCIe Gen 4)' },
    { spec: 'Network', value: '10 Gbps uplink, redundant' },
    { spec: 'Virtualisation', value: 'KVM (full hardware virtualisation)' },
    { spec: 'OS Options', value: 'Ubuntu, Debian, CentOS, AlmaLinux, Rocky Linux, Windows Server' },
    { spec: 'DDoS Protection', value: 'Up to 400 Gbps mitigation included' },
    { spec: 'Provisioning', value: 'Instant (< 60 seconds)' },
    { spec: 'SLA', value: '99.9% uptime guarantee' },
  ],
  datacenters: [
    { city: 'Karachi', region: 'South Asia', ping: '8ms' },
    { city: 'Dubai', region: 'Middle East', ping: '12ms' },
    { city: 'London', region: 'Europe West', ping: '4ms' },
    { city: 'New York', region: 'North America East', ping: '6ms' },
    { city: 'Singapore', region: 'Southeast Asia', ping: '5ms' },
    { city: 'Frankfurt', region: 'Europe Central', ping: '3ms' },
  ],
  securityItems: [
    { title: 'DDoS Mitigation', desc: 'Up to 400 Gbps DDoS mitigation included on every VPS at no extra cost.' },
    { title: 'Firewall Control', desc: 'Configure iptables or use our intuitive firewall manager from the control panel.' },
    { title: 'Root SSH Access', desc: 'Full root access via SSH. Run any command, install any software, full control.' },
    { title: 'Snapshot Backups', desc: 'Create snapshots of your entire VPS at any time and restore with a single click.' },
  ],
  securityTitle: 'Total Control. Maximum Security.',
  migrationTitle: 'Free Migration to Noehost VPS',
  migrationDesc: "Already have a VPS somewhere else? Our engineers will migrate your data, applications, and databases with zero downtime — completely free of charge.",
  migrationPoints: ['Zero-downtime migration', 'All apps & data transferred', 'Free for all VPS plans'],
  migrationBtnText: 'Request Free Migration',
  migrationBtnUrl: '/contact-us',
};

const VPSHosting: React.FC = () => {
  const { content } = useContent();
  const pgCms = content?.["pages.vpsHosting"] || {};
  const pg = { ...VPS_DEFAULT, ...pgCms };
  const { convert } = useCurrency();
  const [activeTab, setActiveTab] = useState<'specs' | 'dc'>('specs');

  const hero = pg.hero || {};
  const plans = pg.plans || [];
  const useCases = pg.useCases || [];
  const techSpecs = pg.techSpecs || [];
  const datacenters = pg.datacenters || [];
  const securityItems = pg.securityItems || [];

  const renderLink = (to: string, children: React.ReactNode, className: string) => {
    if (!to) return <a className={className}>{children}</a>;
    if (to.startsWith('#') || to.startsWith('http')) return <a href={to} className={className}>{children}</a>;
    return <Link to={to} className={className}>{children}</Link>;
  };

  return (
    <div className="noehost-public min-h-screen bg-dark">

      {/* HERO */}
      <section className="relative bg-secondary overflow-hidden pt-36 pb-24">
        <div className="tech-grid absolute inset-0 opacity-5" />
        <div className="absolute top-0 left-0 w-[800px] h-[800px] rounded-full blur-[180px]" style={{ background: 'radial-gradient(circle, rgba(103,61,230,0.2) 0%, transparent 70%)' }} />
        <div className="container mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="lg:w-1/2">
              {hero.badge && (
                <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary-300 text-xs font-black px-4 py-2 rounded-full mb-6 uppercase tracking-widest">
                  <Cpu size={12} /> {hero.badge}
                </div>
              )}
              <h1 className="text-5xl lg:text-6xl font-black text-white leading-[1.05] tracking-tight mb-6">
                {hero.title || 'VPS Hosting.'}<br />
                <span className="text-primary-300">{hero.titleHighlight || 'Your Rules.'}</span>
              </h1>
              <p className="text-lg text-slate-400 font-medium leading-relaxed mb-8 max-w-lg">
                {hero.description || 'Deploy a high-performance KVM VPS in under 60 seconds.'}
              </p>
              <div className="flex flex-wrap gap-4">
                {(hero.primaryBtn?.show !== false) && hero.primaryBtn && renderLink(hero.primaryBtn.url || '#vps-plans', <>{hero.primaryBtn.text || 'Deploy Now'} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>, 'px-8 py-4 bg-primary hover:bg-primary-600 text-white rounded-xl font-black text-sm transition-all shadow-xl shadow-primary/30 flex items-center gap-2 group')}
                {(hero.secondaryBtn?.show !== false) && hero.secondaryBtn && renderLink(hero.secondaryBtn.url || '#vps-specs', <><Terminal size={16} /> {hero.secondaryBtn.text || 'View Specs'}</>, 'px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black text-sm transition-all border border-white/10 flex items-center gap-2')}
              </div>
              {(hero.badges || []).length > 0 && (
                <div className="flex flex-wrap gap-6 mt-8">
                  {hero.badges.map((f: string) => <span key={f} className="flex items-center gap-2 text-xs text-slate-400 font-bold"><Check size={14} className="text-primary-400" /> {f}</span>)}
                </div>
              )}
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.2 }} className="lg:w-1/2">
              <div className="bg-dark rounded-2xl border border-white/10 overflow-hidden shadow-2xl shadow-black/50">
                <div className="bg-white/5 px-4 py-3 flex items-center gap-3 border-b border-white/5">
                  <div className="flex gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500" /><div className="w-2.5 h-2.5 rounded-full bg-yellow-500" /><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /></div>
                  <span className="text-slate-400 text-xs font-mono flex-1 text-center">bash — root@noehost-vps</span>
                </div>
                <div className="p-5 font-mono text-sm space-y-1.5 min-h-[280px]">
                  {terminalLines.map((line, i) => (
                    <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 + i * 0.15 }} className={line.color}>{line.text}</motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* VPS PLANS */}
      {plans.length > 0 && (
        <section id="vps-plans" className="py-20 bg-dark">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary-300 text-xs font-black px-4 py-2 rounded-full mb-4 uppercase tracking-widest">VPS Plans</div>
              <h2 className="text-4xl font-black text-white mb-3">{pg.plansTitle || 'Choose Your Power'}</h2>
              <p className="text-slate-400 font-medium">{pg.plansDesc || 'All plans include 10 Gbps uplink, DDoS protection & instant provisioning.'}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {plans.map((plan: any, i: number) => (
                <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} whileHover={{ y: -6 }}
                  className={`relative rounded-2xl p-6 transition-all ${plan.popular ? 'bg-primary border-2 border-primary shadow-2xl shadow-primary/30' : 'bg-white/5 border border-white/10 hover:border-primary/30'}`}>
                  {plan.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-white rounded-full text-xs font-black text-primary">Most Popular</div>}
                  <div className="text-xs font-black text-primary-300 uppercase tracking-widest mb-3">{plan.name}</div>
                  <div className="flex items-baseline gap-1 mb-5">
                    <span className="text-3xl font-black text-white">{convert(plan.price)}</span>
                    <span className={`text-sm ${plan.popular ? 'text-primary-200' : 'text-slate-500'}`}>/mo</span>
                  </div>
                  <ul className="space-y-3 mb-6 border-t border-white/10 pt-5">
                    {[plan.cpu, plan.ram, plan.storage, `${plan.bandwidth} Bandwidth`].map((spec: string, j: number) => (
                      <li key={j} className="flex items-center gap-2 text-sm text-slate-300"><ChevronRight size={14} className="text-primary-400" /> {spec}</li>
                    ))}
                    {['Full Root Access', 'KVM Virtualization', 'Instant Deploy', 'DDoS Protection'].map((f, j) => (
                      <li key={j + 4} className="flex items-center gap-2 text-sm text-slate-400"><Check size={14} className="text-emerald-400" /> {f}</li>
                    ))}
                  </ul>
                  {renderLink(plan.btnUrl || '/register', plan.btnText || 'Deploy Now', `block text-center py-3 rounded-xl font-black text-sm transition-all ${plan.popular ? 'bg-white text-primary hover:bg-primary-50' : 'bg-primary/10 hover:bg-primary/20 text-primary-300 border border-primary/20'}`)}
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* USE CASES */}
      {useCases.length > 0 && (
        <section className="py-20 bg-white">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-black px-4 py-2 rounded-full mb-4 uppercase tracking-widest">Use Cases</div>
              <h2 className="text-4xl font-black text-slate-900 mb-3">{pg.useCasesTitle || 'What Will You Build?'}</h2>
              <p className="text-slate-500 font-medium max-w-lg mx-auto">{pg.useCasesDesc || ''}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {useCases.map((uc: any, i: number) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} whileHover={{ scale: 1.02 }}
                  className="p-6 bg-white rounded-2xl border border-slate-200 hover:border-primary/40 shadow-sm hover:shadow-md transition-all group">
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-all">
                    {UC_ICONS[uc.title] || DEFAULT_ICON}
                  </div>
                  <h3 className="text-base font-black text-slate-900 mb-2">{uc.title}</h3>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">{uc.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* SPECS & DATA CENTERS */}
      {(techSpecs.length > 0 || datacenters.length > 0) && (
        <section id="vps-specs" className="py-20 bg-dark">
          <div className="container mx-auto px-6">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary-300 text-xs font-black px-4 py-2 rounded-full mb-4 uppercase tracking-widest">Infrastructure</div>
              <h2 className="text-4xl font-black text-white mb-3">Enterprise-Grade Everything</h2>
            </div>
            <div className="flex justify-center gap-3 mb-8">
              {(['specs', 'dc'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10'}`}>
                  {tab === 'specs' ? 'Technical Specs' : 'Data Centers'}
                </button>
              ))}
            </div>
            {activeTab === 'specs' ? (
              <div className="max-w-3xl mx-auto divide-y divide-white/5">
                {techSpecs.map((row: any, i: number) => (
                  <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="flex items-center justify-between py-4">
                    <span className="text-sm text-slate-500 font-black uppercase tracking-widest">{row.spec}</span>
                    <span className="text-sm text-slate-200 font-bold text-right max-w-[60%]">{row.value}</span>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                {datacenters.map((dc: any, i: number) => (
                  <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08 }}
                    className="bg-white/5 rounded-xl p-5 border border-white/10 text-center hover:border-primary/30 transition-colors">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3"><Network size={18} className="text-primary-400" /></div>
                    <div className="font-black text-white text-sm">{dc.city}</div>
                    <div className="text-slate-500 text-xs font-bold mt-0.5">{dc.region}</div>
                    <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-400/10 rounded-full">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-emerald-400 text-xs font-black">{dc.ping} avg</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* MIGRATION CTA */}
      {pg.migrationTitle && (
        <section className="py-20 bg-primary relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
          <div className="container mx-auto px-6 relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <RefreshCw size={40} className="text-white/60 mx-auto mb-5" />
                <h2 className="text-4xl font-black text-white mb-4">{pg.migrationTitle}</h2>
                <p className="text-primary-200 font-medium leading-relaxed mb-8 text-lg">{pg.migrationDesc}</p>
                {(pg.migrationPoints || []).length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
                    {pg.migrationPoints.map((item: string, i: number) => (
                      <div key={i} className="bg-white/10 rounded-xl px-4 py-3 border border-white/10">
                        <Check size={16} className="text-white mx-auto mb-1" />
                        <p className="text-white font-black text-xs text-center">{item}</p>
                      </div>
                    ))}
                  </div>
                )}
                {renderLink(pg.migrationBtnUrl || '/register', <>{pg.migrationBtnText || 'Request Free Migration'} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>, 'inline-flex items-center gap-2 px-8 py-4 bg-white text-primary hover:bg-primary-50 rounded-xl font-black text-sm transition-all group shadow-xl shadow-black/20')}
              </motion.div>
            </div>
          </div>
        </section>
      )}

      {/* SECURITY */}
      {securityItems.length > 0 && (
        <section className="py-20 bg-secondary relative">
          <div className="tech-grid absolute inset-0 opacity-5" />
          <div className="container mx-auto px-6 relative z-10">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary-300 text-xs font-black px-4 py-2 rounded-full mb-4 uppercase tracking-widest">Security & Control</div>
              <h2 className="text-4xl font-black text-white mb-3">{pg.securityTitle || 'Total Control. Maximum Security.'}</h2>
              <p className="text-slate-400 font-medium max-w-xl mx-auto">{pg.securityDesc || ''}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
              {securityItems.map((item: any, i: number) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="p-6 bg-white/5 rounded-2xl border border-white/5 hover:border-primary/30 hover:bg-white/10 transition-all text-center group">
                  <div className="w-12 h-12 bg-primary/10 text-primary-400 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-primary group-hover:text-white transition-all">
                    {SEC_ICONS[item.title] || <Shield size={24} />}
                  </div>
                  <h3 className="text-sm font-black text-white mb-2">{item.title}</h3>
                  <p className="text-xs text-slate-400 font-medium leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
            <div className="text-center mt-12">
              {renderLink(pg.securityBtnUrl || '/register', <>{pg.securityBtnText || 'Deploy Your VPS Now'} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>, 'inline-flex items-center gap-2 px-8 py-4 bg-primary hover:bg-primary-600 text-white rounded-xl font-black text-sm transition-all shadow-xl shadow-primary/30 group')}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default VPSHosting;
