import React from 'react';
import { Globe, Shield, Clock, Zap, ArrowRight, Star, RefreshCw } from 'lucide-react';
import { useCurrency } from '@/context/CurrencyProvider';
import { useContent } from '@/context/ContentContext';
import DomainChecker from '../DomainChecker';

const WHMCS_BASE = 'https://admin.noehost.com';

const STATIC_TLDS = [
  { ext: '.com', popular: true, badge: 'MOST POPULAR' },
  { ext: '.net', popular: false, badge: '' },
  { ext: '.org', popular: false, badge: '' },
  { ext: '.pk', popular: true, badge: 'LOCAL' },
  { ext: '.store', popular: false, badge: 'SALE' },
  { ext: '.online', popular: false, badge: 'SALE' },
  { ext: '.tech', popular: false, badge: '' },
  { ext: '.io', popular: false, badge: '' },
  { ext: '.co', popular: false, badge: '' },
  { ext: '.info', popular: false, badge: '' },
  { ext: '.biz', popular: false, badge: '' },
  { ext: '.xyz', popular: false, badge: 'CHEAPEST' },
];

const FALLBACK: Record<string, { register: number; transfer: number }> = {
  '.com': { register: 9.99, transfer: 8.99 },
  '.net': { register: 8.99, transfer: 7.99 },
  '.org': { register: 8.49, transfer: 7.49 },
  '.pk': { register: 4.99, transfer: 4.49 },
  '.store': { register: 2.99, transfer: 2.49 },
  '.online': { register: 2.99, transfer: 2.49 },
  '.tech': { register: 12.99, transfer: 11.99 },
  '.io': { register: 39.99, transfer: 35.99 },
  '.co': { register: 24.99, transfer: 22.99 },
  '.info': { register: 5.99, transfer: 4.99 },
  '.biz': { register: 7.99, transfer: 6.99 },
  '.xyz': { register: 1.99, transfer: 1.49 },
};

const FEATURES = [
  { icon: <Shield size={22} />, title: 'Free WHOIS Privacy', desc: 'Your personal information stays hidden from public WHOIS databases at no extra cost.' },
  { icon: <Zap size={22} />, title: 'Instant Activation', desc: 'Domains are registered and propagated within minutes of your purchase.' },
  { icon: <Globe size={22} />, title: 'Free DNS Management', desc: 'Full control over your DNS records including A, CNAME, MX, TXT, and more.' },
  { icon: <Clock size={22} />, title: 'Auto-Renewal', desc: 'Never lose your domain. Enable auto-renewal and we handle everything for you.' },
];

const Domains: React.FC = () => {
  const { convert, loading } = useCurrency();
  const { content } = useContent();
  const fmt = (usd: number) => loading ? '...' : convert(usd);

  const cmsPriceMap: Record<string, { register: number; transfer: number }> = {};
  if (content?.domainPricing?.tlds && Array.isArray(content.domainPricing.tlds)) {
    content.domainPricing.tlds.forEach((t: any) => {
      if (t.ext) cmsPriceMap[t.ext] = { register: t.register, transfer: t.transfer };
    });
  }

  const getPrice = (ext: string) => {
    const cms = cmsPriceMap[ext];
    const fb = FALLBACK[ext];
    return {
      register: cms?.register ?? fb?.register ?? 9.99,
      transfer: cms?.transfer ?? fb?.transfer ?? 8.99,
    };
  };

  return (
    <div className="noehost-public min-h-screen bg-dark">

      {/* HERO */}
      <section className="relative bg-secondary overflow-hidden pt-36 pb-28">
        <div className="tech-grid absolute inset-0 opacity-5" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full blur-[160px]" style={{ background: 'radial-gradient(circle, rgba(103,61,230,0.28) 0%, transparent 70%)' }} />
        <div className="container mx-auto px-6 relative z-10 text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary-300 text-xs font-black px-4 py-2 rounded-full mb-6 uppercase tracking-widest">
            <Globe size={14} /> Domain Registration
          </div>
          <h1 className="text-5xl lg:text-6xl font-black text-white mb-4 leading-tight">
            Find Your Perfect<br />
            <span className="text-primary">Domain Name.</span>
          </h1>
          <p className="text-slate-300 text-lg mb-10 font-medium">
            Search millions of available domains and register yours in seconds. Starting from {fmt(getPrice('.xyz').register)}/yr.
          </p>

          <DomainChecker variant="page" placeholder="Enter your domain name..." />
        </div>
      </section>

      {/* TLD PRICING TABLE */}
      <section className="bg-[#0d0d1f] py-20">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-black text-white mb-3">Domain Pricing</h2>
            <p className="text-slate-400 text-base font-medium">Transparent, affordable pricing. Prices in your local currency — no hidden fees.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {STATIC_TLDS.map(tld => {
              const prices = getPrice(tld.ext);
              const registerUrl = `${WHMCS_BASE}/cart.php?a=add&domain=register&tld=${encodeURIComponent(tld.ext)}`;
              const transferUrl = `${WHMCS_BASE}/cart.php?a=add&domain=transfer&tld=${encodeURIComponent(tld.ext)}`;
              return (
                <div
                  key={tld.ext}
                  className={`relative p-5 rounded-2xl border text-center transition-all ${
                    tld.popular ? 'border-primary/40 bg-primary/10 shadow-lg shadow-primary/10' : 'border-white/10 bg-white/5 hover:border-primary/30 hover:bg-white/10'
                  }`}
                >
                  {tld.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-primary text-white whitespace-nowrap">{tld.badge}</span>
                    </div>
                  )}
                  <div className="text-2xl font-black text-white mb-2">{tld.ext}</div>
                  <div className="mb-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Register</span>
                    <div className="text-lg font-black text-[#00D1FF]">{fmt(prices.register)}<span className="text-xs font-medium text-slate-500">/yr</span></div>
                  </div>
                  <div className="mb-3">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Transfer</span>
                    <div className="text-base font-black text-orange-400">{fmt(prices.transfer)}<span className="text-xs font-medium text-slate-500">/yr</span></div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <a
                      href={registerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full py-2 border border-primary text-primary hover:bg-primary hover:text-white font-black text-xs rounded-xl transition-all uppercase tracking-widest"
                    >
                      Register
                    </a>
                    <a
                      href={transferUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1 w-full py-2 border border-orange-400/40 text-orange-500 hover:bg-orange-500 hover:text-white font-black text-xs rounded-xl transition-all uppercase tracking-widest"
                    >
                      <RefreshCw size={11} /> Transfer
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-secondary py-20">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-black text-white mb-3">Everything Included</h2>
            <p className="text-slate-400 text-base font-medium">Every domain comes loaded with powerful features at no extra cost.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/30 transition-all group">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:bg-primary group-hover:text-white transition-all">
                  {f.icon}
                </div>
                <h3 className="font-black text-white mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm font-medium leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#0a0a18] py-16 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[140px] opacity-25" style={{ background: 'radial-gradient(circle, rgba(103,61,230,0.5) 0%, transparent 70%)' }} />
        <div className="container mx-auto px-6 text-center max-w-2xl relative z-10">
          <Star className="mx-auto mb-4 text-primary-400" size={32} />
          <h2 className="text-3xl font-black text-white mb-4">Ready to Claim Your Domain?</h2>
          <p className="text-slate-400 text-base font-medium mb-8">Join thousands of businesses who trust Noehost for their domain needs.</p>
          <a
            href={`${WHMCS_BASE}/cart.php?a=add&domain=register`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-10 py-4 bg-primary hover:bg-primary-600 text-white font-black rounded-2xl transition-all shadow-xl shadow-primary/30 uppercase tracking-widest text-sm"
          >
            Register Now <ArrowRight size={18} />
          </a>
        </div>
      </section>

    </div>
  );
};

export default Domains;
