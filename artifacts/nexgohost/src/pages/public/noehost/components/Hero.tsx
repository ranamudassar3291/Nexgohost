import React from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { CheckCircle2, Star, Zap, Globe, Server, Shield, Database, Wifi, Activity, Lock } from 'lucide-react';
import { useContent } from '@/context/ContentContext';
import { useCurrency } from '@/context/CurrencyProvider';
import DomainChecker from './DomainChecker';

const HeroIllustration: React.FC = () => (
  <div className="relative w-full max-w-lg mx-auto select-none">
    {/* Glow */}
    <div className="absolute inset-0 bg-primary/20 blur-[80px] rounded-full"></div>

    {/* Main Panel */}
    <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
      {/* Top bar */}
      <div className="flex items-center gap-2 mb-5">
        <div className="w-3 h-3 rounded-full bg-red-400"></div>
        <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
        <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
        <div className="flex-1 bg-white/10 rounded-full h-5 ml-3 flex items-center px-3">
          <span className="text-[9px] text-slate-400 font-mono">noehost.com — Secured</span>
        </div>
        <Lock size={10} className="text-emerald-400" />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Uptime', value: '99.9%', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Speed', value: '< 1ms', color: 'text-primary-400', bg: 'bg-primary/10' },
          { label: 'Sites', value: '2M+', color: 'text-purple-400', bg: 'bg-purple-500/10' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-2xl p-3 text-center border border-white/5`}>
            <div className={`text-lg font-black ${s.color}`}>{s.value}</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Server Cards */}
      <div className="space-y-2 mb-4">
        {[
          { name: 'Web Server', status: 'Running', icon: <Server size={14} />, color: 'text-emerald-400', bar: 'w-4/5' },
          { name: 'Database', status: 'Active', icon: <Database size={14} />, color: 'text-blue-400', bar: 'w-3/5' },
          { name: 'CDN Network', status: 'Optimal', icon: <Wifi size={14} />, color: 'text-purple-400', bar: 'w-11/12' },
        ].map((s, i) => (
          <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2.5 border border-white/5">
            <span className={s.color}>{s.icon}</span>
            <span className="text-xs font-bold text-slate-300 flex-1">{s.name}</span>
            <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className={`h-full ${s.bar} bg-gradient-to-r from-primary to-primary-400 rounded-full`}></div>
            </div>
            <span className="text-[9px] font-black text-emerald-400 uppercase">{s.status}</span>
          </div>
        ))}
      </div>

      {/* Security + Activity Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-1">
            <Shield size={14} className="text-primary-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Security</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <Lock size={10} className="text-emerald-400" />
            </div>
            <span className="text-[10px] text-slate-300 font-bold">SSL Active</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Shield size={10} className="text-blue-400" />
            </div>
            <span className="text-[10px] text-slate-300 font-bold">DDoS Guard</span>
          </div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={14} className="text-purple-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live</span>
          </div>
          {[70, 45, 85, 55].map((h, i) => (
            <div key={i} className="flex items-end gap-0.5">
              {[...Array(12)].map((_, j) => (
                <div
                  key={j}
                  className="flex-1 bg-primary/30 rounded-sm"
                  style={{ height: `${Math.random() * h + 8}px` }}
                ></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Floating badges */}
    <div className="absolute -top-4 -right-4 bg-emerald-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg shadow-emerald-500/30 uppercase tracking-widest">
      ✓ Live
    </div>
    <div className="absolute -bottom-4 -left-4 bg-primary text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg shadow-primary/30 uppercase tracking-widest">
      Free SSL
    </div>
  </div>
);

const Hero: React.FC = () => {
  const { content } = useContent();
  const { convert } = useCurrency();
  const [domainTlds, setDomainTlds] = React.useState<Array<{ ext: string; register: number }>>([]);

  React.useEffect(() => {
    fetch('/api/domain/pricing')
      .then(r => r.ok ? r.json() : null)
      .then((data: any) => { if (data?.tlds) setDomainTlds(data.tlds); })
      .catch(() => {});
  }, []);

  const heroData = content?.hero || {
    title: 'Everything you need to create a website',
    description: 'Free SSL, one-year free domain, 99.9% uptime, easy WordPress. Explore Our Services',
  };

  const features = (heroData.features && heroData.features.length > 0)
    ? heroData.features
    : [
      'Free Domain for 1st Year',
      'Free Website Migration',
      '24/7 Customer Support',
      '30-Day Money-Back Guarantee'
    ];

  const FEATURED_EXTS = ['.com', '.net', '.pk'];
  const FALLBACK_PRICES: Record<string, number> = { '.com': 9.99, '.net': 8.99, '.pk': 4.99 };
  const tlds = FEATURED_EXTS.map(ext => {
    const found = domainTlds.find((t: any) => t.ext === ext);
    const usdPrice = found ? Number(found.register) : FALLBACK_PRICES[ext];
    return { name: ext, price: convert(usdPrice) };
  });

  return (
    <section className="bg-black pt-28 pb-16 overflow-hidden relative min-h-screen flex flex-col items-center">
      {/* Decorative Lines and Glows */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top Left Corner */}
        <div className="absolute top-20 left-20 w-40 h-px bg-gradient-to-r from-primary to-transparent"></div>
        <div className="absolute top-20 left-20 w-px h-40 bg-gradient-to-b from-primary to-transparent"></div>
        <div className="absolute top-[19px] left-[19px] w-2 h-2 bg-primary rounded-full shadow-[0_0_15px_rgba(59,130,246,0.8)]"></div>

        {/* Bottom Right Corner */}
        <div className="absolute bottom-20 right-20 w-40 h-px bg-gradient-to-l from-primary to-transparent"></div>
        <div className="absolute bottom-20 right-20 w-px h-40 bg-gradient-to-t from-primary to-transparent"></div>
        <div className="absolute bottom-[19px] right-[19px] w-2 h-2 bg-primary rounded-full shadow-[0_0_15px_rgba(59,130,246,0.8)]"></div>

        {/* Top Right Glow */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4"></div>
      </div>
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-10 mb-14">
          {/* Left Content */}
          <div className="lg:w-1/2 text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary-400 text-xs font-black mb-8 border border-primary/20 backdrop-blur-md uppercase tracking-widest">
                <Star size={14} className="fill-primary-400" />
                {heroData.badge || 'Special Offer: Save 75% Today'}
              </div>

              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-black text-white leading-[1.1] mb-6 tracking-tighter max-w-2xl">
                {heroData.title}
              </h1>
              
              <p className="text-lg text-slate-400 mb-10 leading-relaxed max-w-xl mx-auto lg:mx-0 font-medium">
                {heroData.description}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12 max-w-xl mx-auto lg:mx-0">
                {features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 text-slate-300">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                      <CheckCircle2 size={14} />
                    </div>
                    <span className="text-sm font-bold">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-8 mb-16">
                <div className="flex flex-col items-center lg:items-start">
                  <div className="text-slate-500 text-xs font-black uppercase tracking-widest mb-1">Starting at</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-white text-4xl font-black">{convert(heroData.startingPrice ?? 1.99)}</span>
                    <span className="text-slate-500 text-sm font-bold">/mo</span>
                  </div>
                </div>
                {heroData.showCtaPrimary !== false && (() => {
                  const btnText = heroData.ctaPrimary || 'Get Started';
                  const btnHref = heroData.ctaPrimaryHref || '/shared-hosting';
                  const cls = "w-full sm:w-auto px-12 py-5 bg-primary hover:bg-primary-600 text-white rounded-xl font-black transition-all shadow-2xl shadow-primary/40 text-lg group flex items-center justify-center gap-3 block text-center";
                  const inner = <>{btnText}<Zap size={20} className="group-hover:scale-110 transition-transform" /></>;
                  return btnHref.startsWith('/') || btnHref.startsWith('#')
                    ? <Link to={btnHref} className={cls}>{inner}</Link>
                    : <a href={btnHref} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>;
                })()}
                {heroData.showCtaSecondary !== false && heroData.ctaSecondary && (() => {
                  const btnText = heroData.ctaSecondary;
                  const btnHref = heroData.ctaSecondaryHref || '/#pricing';
                  const cls = "w-full sm:w-auto px-10 py-5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black transition-all border border-white/10 hover:border-white/20 text-lg block text-center";
                  return btnHref.startsWith('/') || btnHref.startsWith('#')
                    ? <Link to={btnHref} className={cls}>{btnText}</Link>
                    : <a href={btnHref} target="_blank" rel="noopener noreferrer" className={cls}>{btnText}</a>;
                })()}
              </div>

              {/* Trust Section */}
              <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center gap-8 justify-center lg:justify-start">
                <div className="flex -space-x-3">
                  {[
                    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80",
                    "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=100&q=80",
                    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80",
                    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80"
                  ].map((url, i) => (
                    <img 
                      key={i}
                      src={url} 
                      alt="User" 
                      className="w-10 h-10 rounded-full border-2 border-black object-cover"
                    />
                  ))}
                  <div className="w-10 h-10 rounded-full border-2 border-black bg-secondary flex items-center justify-center text-[10px] font-black text-white">
                    +2M
                  </div>
                </div>
                <div className="text-center sm:text-left">
                  <div className="flex items-center gap-1 justify-center sm:justify-start mb-1">
                    {[1, 2, 3, 4, 5].map(i => <Star key={i} size={12} className="text-amber-400 fill-amber-400" />)}
                  </div>
                  <div className="text-xs font-bold text-slate-500">Trusted by over 2 million users worldwide</div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Content - Hosting Illustration */}
          <div className="lg:w-1/2 relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="relative"
            >
              <div className="relative z-10">
                <HeroIllustration />
              </div>
            </motion.div>
          </div>
        </div>

        {/* Domain Search Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="max-w-5xl mx-auto"
        >
          <div className="bg-white/5 backdrop-blur-3xl rounded-[40px] p-10 border border-white/10 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-primary/20 transition-all duration-700"></div>
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-10">
              <div className="text-center md:text-left">
                <h2 className="text-3xl font-black text-white mb-3">Find your perfect domain name</h2>
                <p className="text-slate-400 font-medium">Claim your digital identity today. Instant availability check.</p>
              </div>
              <div className="flex flex-wrap justify-center gap-4">
                {tlds.map(tld => (
                  <div key={tld.name} className="flex items-center gap-3 px-5 py-3 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all">
                    <span className="text-white font-black">{tld.name}</span>
                    <span className="text-accent font-black">{tld.price}</span>
                  </div>
                ))}
              </div>
            </div>

            <DomainChecker variant="hero" placeholder="Search for your dream domain..." />
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
