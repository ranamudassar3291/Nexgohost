import React, { useState, useRef, useEffect } from 'react';
import { Mail, Phone, Globe, ChevronDown, X, Loader2 } from 'lucide-react';
import { useContent } from '../ContentContext';
import { useCurrency } from '../CurrencyContext';

const TopBar: React.FC = () => {
  const { content } = useContent();
  const { currency, setCurrency, currencies, loading } = useCurrency();
  const [dismissed, setDismissed] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const config = content?.config?.topbar || {
    show: true,
    email: 'support@noehost.com',
    phone: '+92 300 0000000',
    announcement: 'Flash Sale: 50% Off all Shared Plans! Use code: NEO50'
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!config.show || dismissed) return null;

  return (
    <div
      className="text-white py-2 relative z-[110] overflow-visible"
      style={{
        background: 'linear-gradient(90deg, #3b0d8f 0%, #5b21b6 20%, #673de6 50%, #5b21b6 80%, #3b0d8f 100%)',
        borderBottom: '1px solid rgba(139,92,246,0.5)',
        boxShadow: '0 2px 24px rgba(103,61,230,0.45)',
      }}
    >
      {/* subtle shimmer overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 100% at 50% 0%, rgba(255,255,255,0.08) 0%, transparent 100%)',
        }}
      />
      <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10">

        {/* Left: contact */}
        <div className="flex items-center gap-5 text-[10px] font-bold uppercase tracking-widest text-purple-100">
          <a href={`mailto:${config.email}`} className="flex items-center gap-1.5 hover:text-white transition-all group">
            <Mail size={11} className="text-purple-200 group-hover:scale-110 transition-transform" />
            {config.email}
          </a>
          <a href={`tel:${config.phone}`} className="flex items-center gap-1.5 hover:text-white transition-all group">
            <Phone size={11} className="text-purple-200 group-hover:scale-110 transition-transform" />
            {config.phone}
          </a>
        </div>

        {/* Centre: announcement */}
        <div className="hidden lg:flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-white">
          <div className="w-1.5 h-1.5 bg-[#00d1ff] rounded-full shadow-[0_0_8px_rgba(0,209,255,0.9)] animate-pulse" />
          {config.announcement}
          <div className="w-1.5 h-1.5 bg-[#00d1ff] rounded-full shadow-[0_0_8px_rgba(0,209,255,0.9)] animate-pulse" />
        </div>

        {/* Right: currency + dismiss */}
        <div className="flex items-center gap-4">
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="flex items-center gap-1.5 text-[10px] font-black text-purple-100 hover:text-white transition-all uppercase tracking-[0.2em] group"
            >
              {loading ? (
                <Loader2 size={11} className="animate-spin text-purple-200" />
              ) : (
                <Globe size={11} className="text-purple-200 group-hover:rotate-12 transition-transform" />
              )}
              <span>{(currency as any).flag} {currency.code}</span>
              <ChevronDown size={10} className={`opacity-70 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-52 bg-[#0e0e11] backdrop-blur-2xl rounded-2xl shadow-2xl border border-purple-500/20 py-2 z-[200] max-h-72 overflow-y-auto">
                <div className="px-4 py-2 mb-1 border-b border-white/5">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Select Currency</p>
                </div>
                {currencies.map((c: any) => (
                  <button
                    key={c.code}
                    onClick={() => { setCurrency(c); setDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-all hover:bg-white/5 ${
                      currency.code === c.code ? 'bg-purple-500/10' : ''
                    }`}
                  >
                    <span className="text-base leading-none">{c.flag}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${currency.code === c.code ? 'text-[#00d1ff]' : 'text-slate-300'}`}>
                          {c.code}
                        </span>
                        <span className="text-[9px] text-slate-600 font-bold">{c.symbol}</span>
                      </div>
                      <p className="text-[9px] text-slate-500 font-medium truncate">{c.name}</p>
                    </div>
                    {currency.code === c.code && (
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00d1ff] flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setDismissed(true)}
            className="flex items-center justify-center w-5 h-5 rounded-full bg-white/15 hover:bg-white/25 text-purple-100 hover:text-white transition-all"
            aria-label="Close announcement bar"
          >
            <X size={11} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopBar;
