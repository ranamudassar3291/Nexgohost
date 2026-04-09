import React, { useState } from 'react';
import { Globe, Search, CheckCircle2, XCircle, RefreshCw, ShoppingCart, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrency } from '@/context/CurrencyProvider';

const WHMCS_BASE = 'https://admin.noehost.com';

export interface DomainResult {
  domain: string;
  sld: string;
  tld: string;
  available: boolean;
  price: string;
  registerPrice: string;
  transferPrice: string;
}

const whmcsUrl = (action: 'register' | 'transfer', result: DomainResult) =>
  `${WHMCS_BASE}/cart.php?a=add&domain=${action}&query=${encodeURIComponent(result.domain)}&sld=${encodeURIComponent(result.sld)}&tld=${encodeURIComponent(result.tld)}`;

interface DomainCheckerProps {
  variant?: 'hero' | 'page';
  placeholder?: string;
}

const DomainChecker: React.FC<DomainCheckerProps> = ({
  variant = 'page',
  placeholder = 'Search for your dream domain...',
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DomainResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState('');
  const { convert } = useCurrency();

  const handleSearch = async (e: React.FormEvent, overrideQuery?: string) => {
    e.preventDefault();
    const q = (overrideQuery ?? query).trim();
    if (!q) return;
    setSearching(true);
    setSearched(q);
    try {
      const res = await fetch(`/api/domain/search?q=${encodeURIComponent(q)}`);
      const data: DomainResult[] = await res.json();
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const quickTlds = ['.com', '.net', '.org', '.pk', '.store', '.io'];

  return (
    <div className="w-full">
      {/* Search Form */}
      <form onSubmit={handleSearch}>
        {variant === 'hero' ? (
          <div className="relative bg-white rounded-3xl p-2 shadow-2xl flex flex-col md:flex-row items-stretch gap-3">
            <div className="flex-grow flex items-center px-8 gap-5">
              <Globe className="text-primary flex-shrink-0" size={24} />
              <input
                type="text"
                placeholder={placeholder}
                className="w-full py-5 text-xl font-bold text-slate-800 focus:outline-none placeholder:text-slate-300"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="bg-primary hover:bg-primary-600 text-white px-14 py-5 rounded-2xl font-black transition-all flex items-center justify-center gap-3 disabled:opacity-60 shadow-xl shadow-primary/30 text-lg"
            >
              {searching ? <Loader2 size={22} className="animate-spin" /> : <Search size={22} />}
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>
        ) : (
          <div className="flex gap-0 max-w-2xl mx-auto shadow-2xl shadow-primary/20">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={placeholder}
              className="flex-1 px-6 py-4 text-base font-semibold bg-white text-slate-800 rounded-l-2xl outline-none placeholder:text-slate-400 border-0"
            />
            <button
              type="submit"
              disabled={searching}
              className="px-8 py-4 bg-primary hover:bg-primary-600 text-white font-black text-sm rounded-r-2xl transition-all flex items-center gap-2 uppercase tracking-widest whitespace-nowrap disabled:opacity-60"
            >
              {searching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              {searching ? 'Checking...' : 'Search'}
            </button>
          </div>
        )}
      </form>

      {/* Quick TLD pills */}
      {!searching && results.length === 0 && (
        <div className={`flex flex-wrap gap-2 mt-4 ${variant === 'hero' ? '' : 'justify-center'}`}>
          {quickTlds.map(tld => (
            <button
              key={tld}
              type="button"
              onClick={e => { setQuery(prev => { const base = prev.replace(/\.[a-z]+$/, ''); return base + tld; }); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                variant === 'hero'
                  ? 'bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300'
                  : 'bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300'
              }`}
            >
              {tld}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      <AnimatePresence>
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.3 }}
            className="mt-6 bg-white rounded-[28px] shadow-2xl overflow-hidden border border-slate-100"
          >
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Results for "{searched}"
              </span>
              <button
                onClick={() => { setResults([]); setSearched(''); }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
              {results.map((res, i) => (
                <motion.div
                  key={res.domain}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="px-4 sm:px-6 py-4 flex flex-row items-center justify-between gap-2 hover:bg-slate-50 transition-all"
                >
                  {/* Domain info */}
                  <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      res.available ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'
                    }`}>
                      <Globe size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm sm:text-base font-black text-slate-900 truncate">{res.domain}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {res.available ? (
                          <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                            <CheckCircle2 size={11} /> Available
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-black text-red-500 uppercase tracking-widest">
                            <XCircle size={11} /> Taken
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Price + CTA */}
                  <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                    <div className="text-right hidden xs:block sm:block">
                      <div className={`text-sm sm:text-base font-black ${res.available ? 'text-primary' : 'text-orange-500'}`}>
                        {convert(parseFloat(res.available ? (res.registerPrice ?? res.price) : (res.transferPrice ?? res.price)))}
                      </div>
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                        {res.available ? 'reg/yr' : 'xfr/yr'}
                      </div>
                    </div>
                    {res.available ? (
                      <a
                        href={whmcsUrl('register', res)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 bg-slate-900 hover:bg-primary text-white font-black text-xs rounded-xl transition-all whitespace-nowrap uppercase tracking-widest"
                      >
                        <ShoppingCart size={13} />
                        <span className="hidden sm:inline">Add to Cart</span>
                        <span className="sm:hidden">Add</span>
                      </a>
                    ) : (
                      <a
                        href={whmcsUrl('transfer', res)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/30 font-black text-xs rounded-xl transition-all whitespace-nowrap uppercase tracking-widest"
                      >
                        <RefreshCw size={13} />
                        Transfer
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DomainChecker;
