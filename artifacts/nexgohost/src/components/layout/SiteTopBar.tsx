import { useState, useRef, useEffect } from "react";
import { Mail, Phone, Globe, ChevronDown, X, Loader2 } from "lucide-react";
import { useCurrency } from "@/context/CurrencyProvider";

const CONFIG = {
  show: true,
  email: "support@noehost.com",
  phone: "+1 (800) NEO-HOST",
  announcement: "Flash Sale: 50% Off all Shared Plans! Use code: NEO50",
};

export function SiteTopBar() {
  const { currency, setCurrency, currencies, loading } = useCurrency();
  const [dismissed, setDismissed]   = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!CONFIG.show || dismissed) return null;

  return (
    <div
      className="text-white py-2.5 relative z-[110] overflow-visible"
      style={{
        background: "linear-gradient(to right, #0F172A, #1a1866, #0F172A)",
        borderBottom: "1px solid rgba(103,61,230,0.5)",
      }}
    >
      <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 50% 50%, rgba(103,61,230,0.2), transparent 70%)" }} />
      <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">

        {/* Left: contact */}
        <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-slate-300">
          <a href={`mailto:${CONFIG.email}`} className="flex items-center gap-2 hover:text-[#FFD700] transition-all group">
            <Mail size={12} className="text-primary group-hover:scale-110 transition-transform" />
            {CONFIG.email}
          </a>
          <a href={`tel:${CONFIG.phone}`} className="flex items-center gap-2 hover:text-[#FFD700] transition-all group">
            <Phone size={12} className="text-primary group-hover:scale-110 transition-transform" />
            {CONFIG.phone}
          </a>
        </div>

        {/* Centre: announcement */}
        <div className="hidden lg:flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-[#FFD700] animate-pulse">
          <div className="w-1.5 h-1.5 bg-[#FFD700] rounded-full shadow-[0_0_10px_rgba(255,215,0,0.8)]" />
          {CONFIG.announcement}
        </div>

        {/* Right: currency + dismiss */}
        <div className="flex items-center gap-4">
          {/* Currency picker */}
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="flex items-center gap-1.5 text-[10px] font-black text-slate-200 hover:text-white transition-all uppercase tracking-[0.2em] group"
            >
              {loading ? (
                <Loader2 size={11} className="animate-spin text-primary" />
              ) : (
                <Globe size={11} className="text-primary group-hover:rotate-12 transition-transform" />
              )}
              <span>{(currency as any).flag} {currency.code}</span>
              <ChevronDown size={10} className={`opacity-60 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-52 bg-[#0e0e11] backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/10 py-2 z-[200] max-h-72 overflow-y-auto">
                <div className="px-4 py-2 mb-1 border-b border-white/5">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Select Currency</p>
                </div>
                {currencies.map((c: any) => (
                  <button
                    key={c.code}
                    onClick={() => { setCurrency(c); setDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-all hover:bg-white/5 ${
                      currency.code === c.code ? "bg-primary/10" : ""
                    }`}
                  >
                    <span className="text-base leading-none">{c.flag ?? "🌐"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${currency.code === c.code ? "text-[#FFD700]" : "text-slate-300"}`}>
                          {c.code}
                        </span>
                        <span className="text-[9px] text-slate-600 font-bold">{c.symbol}</span>
                      </div>
                      <p className="text-[9px] text-slate-500 font-medium truncate">{c.name}</p>
                    </div>
                    {currency.code === c.code && (
                      <div className="w-1.5 h-1.5 rounded-full bg-[#FFD700] flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dismiss */}
          <button
            onClick={() => setDismissed(true)}
            className="flex items-center justify-center w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white transition-all"
            aria-label="Close announcement bar"
          >
            <X size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}
