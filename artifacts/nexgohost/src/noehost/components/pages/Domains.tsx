import React, { useState, useEffect } from 'react';
import { Globe, Shield, Clock, Zap, ArrowRight, Star, RefreshCw, Loader2 } from 'lucide-react';
import { useCurrency } from '../../CurrencyContext';
import { useContent } from '../../ContentContext';
import DomainChecker from '../DomainChecker';

const FEATURES = [
  { icon: <Shield size={22} />, title: 'Free WHOIS Privacy', desc: 'Your personal information stays hidden from public WHOIS databases at no extra cost.' },
  { icon: <Zap size={22} />, title: 'Instant Activation', desc: 'Domains are registered and propagated within minutes of your purchase.' },
  { icon: <Globe size={22} />, title: 'Free DNS Management', desc: 'Full control over your DNS records including A, CNAME, MX, TXT, and more.' },
  { icon: <Clock size={22} />, title: 'Auto-Renewal', desc: 'Never lose your domain. Enable auto-renewal and we handle everything for you.' },
];

interface TldEntry {
  ext: string;
  register: number;
  transfer: number;
  renewal: number;
}

const Domains: React.FC = () => {
  const { convertFromPKR, loading: currencyLoading } = useCurrency();
  const { content } = useContent();
  const fmt = (pkr: number) => currencyLoading ? '...' : convertFromPKR(pkr);

  const [tlds, setTlds] = useState<TldEntry[]>([]);
  const [tldLoading, setTldLoading] = useState(true);

  useEffect(() => {
    setTldLoading(true);
    fetch('/api/domain-extensions')
      .then(r => r.ok ? r.json() : [])
      .then((list: any[]) => {
        const entries: TldEntry[] = (Array.isArray(list) ? list : []).map((d: any) => {
          const ext = (d.extension || d.ext || '').trim();
          const key = ext.startsWith('.') ? ext : `.${ext}`;
          return {
            ext: key,
            register: Number(d.registerPrice ?? d.register ?? 0),
            transfer: Number(d.transferPrice ?? d.transfer ?? 0),
            renewal: Number(d.renewalPrice ?? d.renew ?? 0),
          };
        }).filter(e => e.ext && e.register > 0);
        setTlds(entries);
      })
      .catch(() => {})
      .finally(() => setTldLoading(false));
  }, []);

  const cheapestPrice = tlds.length > 0
    ? Math.min(...tlds.map(t => t.register))
    : 0;

  const popularExts = new Set(['.com', '.net', '.org', '.pk', '.store', '.io']);
  const badgeMap: Record<string, string> = {
    '.com': 'MOST POPULAR',
    '.pk': 'LOCAL',
    '.store': 'SALE',
    '.online': 'SALE',
  };

  return (
    <div className="min-h-screen bg-dark">

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
            Search millions of available domains and register yours in seconds.
            {cheapestPrice > 0 && <> Starting from {fmt(cheapestPrice)}/yr.</>}
          </p>

          <DomainChecker variant="page" placeholder="Enter your domain name..." />
        </div>
      </section>

      {/* TLD PRICING TABLE */}
      <section className="bg-dark py-20">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-black text-white mb-3">Domain Pricing</h2>
            <p className="text-slate-400 text-base font-medium">Transparent, affordable pricing. Prices in your local currency — no hidden fees.</p>
          </div>

          {tldLoading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
              <Loader2 size={22} className="animate-spin" />
              <span className="font-bold text-sm">Loading pricing…</span>
            </div>
          ) : tlds.length === 0 ? (
            <div className="text-center py-16 text-slate-400 font-medium">
              No domain extensions configured yet. Please check back soon.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {tlds.map(tld => {
                const isPopular = popularExts.has(tld.ext);
                const badge = badgeMap[tld.ext] || '';
                return (
                  <div
                    key={tld.ext}
                    className={`relative p-5 rounded-2xl border text-center transition-all hover:shadow-lg ${
                      isPopular ? 'border-primary/40 bg-primary/10 shadow-sm shadow-primary/20' : 'border-white/10 bg-white/5 hover:border-primary/30 hover:bg-white/8'
                    }`}
                  >
                    {badge && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-primary text-white whitespace-nowrap">{badge}</span>
                      </div>
                    )}
                    <div className="text-2xl font-black text-white mb-2">{tld.ext}</div>
                    <div className="mb-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Register</span>
                      <div className="text-lg font-black text-primary">{fmt(tld.register)}<span className="text-xs font-medium text-slate-400">/yr</span></div>
                    </div>
                    {tld.transfer > 0 && (
                      <div className="mb-3">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Transfer</span>
                        <div className="text-base font-black text-orange-500">{fmt(tld.transfer)}<span className="text-xs font-medium text-slate-400">/yr</span></div>
                      </div>
                    )}
                    <div className={`flex flex-col gap-1.5 ${tld.transfer === 0 ? 'mt-3' : ''}`}>
                      <a
                        href={`/client/domains?tab=order&tld=${encodeURIComponent(tld.ext)}`}
                        className="block w-full py-2 border border-primary text-primary hover:bg-primary hover:text-white font-black text-xs rounded-xl transition-all uppercase tracking-widest"
                      >
                        Register
                      </a>
                      {tld.transfer > 0 && (
                        <a
                          href={`/client/domains?tab=transfer&tld=${encodeURIComponent(tld.ext)}`}
                          className="flex items-center justify-center gap-1 w-full py-2 border border-orange-400/40 text-orange-500 hover:bg-orange-500 hover:text-white font-black text-xs rounded-xl transition-all uppercase tracking-widest"
                        >
                          <RefreshCw size={11} /> Transfer
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
      <section className="bg-primary py-16">
        <div className="container mx-auto px-6 text-center max-w-2xl">
          <Star className="mx-auto mb-4 text-white/60" size={32} />
          <h2 className="text-3xl font-black text-white mb-4">Ready to Claim Your Domain?</h2>
          <p className="text-white/80 text-base font-medium mb-8">Join thousands of businesses who trust Noehost for their domain needs.</p>
          <a
            href="/client/domains?tab=order"
            className="inline-flex items-center gap-2 px-10 py-4 bg-white text-primary font-black rounded-2xl hover:bg-slate-50 transition-all shadow-xl uppercase tracking-widest text-sm"
          >
            Add to Cart <ArrowRight size={18} />
          </a>
        </div>
      </section>

    </div>
  );
};

export default Domains;
