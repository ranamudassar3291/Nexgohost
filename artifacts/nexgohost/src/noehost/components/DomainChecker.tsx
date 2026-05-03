import React, { useState } from 'react';
import { Globe, Search, XCircle, Loader2, ShoppingCart, RefreshCw, Info, Calendar, Building2, Server, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrency } from '../CurrencyContext';
import { useCart } from '../context/CartContext';

interface TldResult {
  tld: string;
  available: boolean;
  registrationPrice: number;
  renewalPrice: number;
  rdapStatus?: string;
}

interface WhoisData {
  domain: string;
  available: boolean;
  status: string[];
  registrar: string | null;
  registrationDate: string | null;
  expirationDate: string | null;
  lastUpdated: string | null;
  nameservers: string[];
}

interface DomainCheckerProps {
  variant?: 'hero' | 'page';
  placeholder?: string;
}

function formatDate(iso: string | null) {
  if (!iso) return 'N/A';
  try {
    return new Date(iso).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return iso; }
}

const WhoisModal: React.FC<{ domain: string; onClose: () => void }> = ({ domain, onClose }) => {
  const [data, setData] = useState<WhoisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  React.useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`/api/domains/whois?domain=${encodeURIComponent(domain)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError('Failed to fetch WHOIS data.'))
      .finally(() => setLoading(false));
  }, [domain]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-primary to-purple-700 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-widest">WHOIS Lookup</p>
            <h3 className="text-white text-lg font-black">{domain}</h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <XCircle size={22} />
          </button>
        </div>

        <div className="p-6">
          {loading && (
            <div className="flex flex-col items-center py-10 gap-3">
              <Loader2 size={28} className="animate-spin text-primary" />
              <p className="text-sm text-slate-400 font-medium">Fetching WHOIS data...</p>
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center py-10 gap-3 text-center">
              <AlertCircle size={28} className="text-red-400" />
              <p className="text-sm text-slate-500 font-medium">{error}</p>
              <p className="text-xs text-slate-400">WHOIS data may not be available for this TLD</p>
            </div>
          )}
          {data && !loading && !error && (
            <div className="space-y-3">
              {/* Domain status */}
              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50">
                {data.available ? (
                  <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                ) : (
                  <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
                )}
                <span className={`text-sm font-black ${data.available ? 'text-emerald-600' : 'text-red-500'}`}>
                  {data.available ? 'Domain is Available' : 'Domain is Registered'}
                </span>
              </div>

              {!data.available && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Calendar size={12} className="text-primary" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registered</span>
                      </div>
                      <p className="text-sm font-black text-slate-800">{formatDate(data.registrationDate)}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Calendar size={12} className="text-red-400" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expires</span>
                      </div>
                      <p className="text-sm font-black text-slate-800">{formatDate(data.expirationDate)}</p>
                    </div>
                  </div>

                  {data.registrar && (
                    <div className="p-3 rounded-xl bg-slate-50">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Building2 size={12} className="text-primary" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registrar</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800">{data.registrar}</p>
                    </div>
                  )}

                  {data.nameservers.length > 0 && (
                    <div className="p-3 rounded-xl bg-slate-50">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Server size={12} className="text-primary" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nameservers</span>
                      </div>
                      <div className="space-y-1">
                        {data.nameservers.slice(0, 4).map((ns, i) => (
                          <p key={i} className="text-xs font-mono text-slate-600 bg-white rounded-lg px-2 py-1 border border-slate-200">{ns}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {data.status.length > 0 && (
                    <div className="p-3 rounded-xl bg-slate-50">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Info size={12} className="text-primary" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {data.status.slice(0, 4).map((s, i) => (
                          <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      onClick={() => window.location.href = `/client/orders/new?type=transfer&domain=${encodeURIComponent(domain)}`}
                      className="w-full py-3 bg-primary hover:bg-primary-600 text-white font-black text-sm rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <RefreshCw size={14} /> Transfer This Domain to NoeHost
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const DomainChecker: React.FC<DomainCheckerProps> = ({
  variant = 'page',
  placeholder = 'Search for your dream domain...',
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TldResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState('');
  const [error, setError] = useState('');
  const [addedDomains, setAddedDomains] = useState<Set<string>>(new Set());
  const [whoisDomain, setWhoisDomain] = useState<string | null>(null);
  const { convertFromPKR } = useCurrency();
  const { addItem, openCart } = useCart();

  const cleanName = (s: string) =>
    s.trim().toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .replace(/\s+/g, '-')
      .split('.')[0]
      .replace(/[^a-z0-9-]/g, '')
      .replace(/^-+|-+$/g, '');

  const handleSearch = async (e: React.FormEvent, overrideQuery?: string) => {
    e.preventDefault();
    const q = (overrideQuery ?? query).trim();
    if (!q) return;
    const name = cleanName(q);
    if (!name || name.length < 2) { setError('Please enter a valid domain name (min 2 characters).'); return; }
    setError('');
    setSearching(true);
    setResults(null);
    setSearched(name);
    try {
      const res = await fetch(`/api/domains/availability?domain=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to check domain availability.'); }
      else { setResults((data.results || []).filter((r: TldResult) => r.registrationPrice > 0)); }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleAddToCart = async (r: TldResult) => {
    const domainFull = `${searched}${r.tld}`;
    await addItem({
      type: 'domain',
      planId: `domain-${domainFull}`,
      name: domainFull,
      billingCycle: 'yearly',
      monthlyPrice: r.registrationPrice,
      quarterlyPrice: null,
      semiannualPrice: null,
      yearlyPrice: r.registrationPrice,
      domainName: domainFull,
      tld: r.tld,
    });
    setAddedDomains(prev => new Set([...prev, domainFull]));
    openCart();
  };

  const quickTlds = ['.com', '.net', '.org', '.pk', '.store', '.io'];

  return (
    <div className="w-full">
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
      {!searching && !results && (
        <div className={`flex flex-wrap gap-2 mt-4 ${variant === 'hero' ? '' : 'justify-center'}`}>
          {quickTlds.map(tld => (
            <button
              key={tld}
              type="button"
              onClick={e => {
                const base = cleanName(query) || 'yourdomain';
                setQuery(base + tld);
                handleSearch(e as any, base + tld);
              }}
              className="px-3 py-1.5 text-xs font-bold rounded-lg transition-all bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300"
            >
              {tld}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && <p className="mt-3 text-sm text-red-400 font-medium text-center">{error}</p>}

      {/* Loading */}
      {searching && (
        <div className="flex items-center justify-center gap-3 mt-8 py-6">
          <Loader2 size={22} className="animate-spin text-primary" />
          <p className="text-sm font-bold text-slate-400">Checking availability across 50+ extensions...</p>
        </div>
      )}

      {/* Results */}
      <AnimatePresence>
        {results && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.3 }}
            className="mt-6 bg-white rounded-[28px] shadow-2xl overflow-hidden border border-slate-100"
          >
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Results for "<span className="text-slate-700">{searched}</span>"
              </span>
              <button
                onClick={() => { setResults(null); setSearched(''); setQuery(''); }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
              {results.slice(0, 15).map((r, i) => {
                const domainFull = `${searched}${r.tld}`;
                const isAdded = addedDomains.has(domainFull);
                return (
                  <motion.div
                    key={r.tld}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${r.available ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      <div className="min-w-0">
                        <div className="font-black text-slate-900 text-sm">
                          <span>{searched}</span><span className="text-primary">{r.tld}</span>
                        </div>
                        <span className={`text-xs font-semibold ${r.available ? 'text-emerald-600' : 'text-red-400'}`}>
                          {r.available ? 'Available' : 'Taken'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-black text-slate-700">
                        {convertFromPKR(r.registrationPrice)}/yr
                      </span>
                      {r.available && (
                        <button
                          onClick={() => handleAddToCart(r)}
                          disabled={isAdded}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs transition-all ${
                            isAdded
                              ? 'bg-emerald-500 text-white'
                              : 'bg-primary hover:bg-primary-600 text-white shadow-md shadow-primary/20'
                          }`}
                        >
                          <ShoppingCart size={12} />
                          {isAdded ? 'Added' : 'Add'}
                        </button>
                      )}
                      {!r.available && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setWhoisDomain(domainFull)}
                            title="View WHOIS"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-black text-xs bg-slate-100 hover:bg-primary/10 hover:text-primary text-slate-500 transition-all"
                          >
                            <Info size={12} /> WHOIS
                          </button>
                          <button
                            onClick={() => window.location.href = `/client/orders/new?type=transfer&domain=${encodeURIComponent(domainFull)}`}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-black text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
                          >
                            <RefreshCw size={12} /> Transfer
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WHOIS Modal */}
      <AnimatePresence>
        {whoisDomain && (
          <WhoisModal domain={whoisDomain} onClose={() => setWhoisDomain(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default DomainChecker;
