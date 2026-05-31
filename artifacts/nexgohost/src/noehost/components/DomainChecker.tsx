import React, { useState, useRef } from 'react';
import {
  Globe, Search, XCircle, Loader2, ShoppingCart, RefreshCw, Info,
  Calendar, Building2, Server, CheckCircle2, AlertCircle, Copy, ExternalLink,
  List, Layers, ArrowRightLeft, Check, Plus, Trash2, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrency } from '../CurrencyContext';
import { useCart } from '../context/CartContext';

interface TldResult {
  tld: string;
  available: boolean;
  registrationPrice: number;
  renewalPrice: number;
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

interface BulkResult {
  domain: string;
  available: boolean | null;
  checking: boolean;
  price?: number;
  tld?: string;
  baseName?: string;
  added?: boolean;
}

const RDAP_OVERRIDES: Record<string, string> = {
  com:    'https://rdap.verisign.com/com/v1/domain/',
  net:    'https://rdap.verisign.com/net/v1/domain/',
  org:    'https://rdap.publicinterestregistry.org/rdap/domain/',
  io:     'https://rdap.nic.io/domain/',
  pk:     'https://rdap.pknic.net.pk/domain/',
  'com.pk': 'https://rdap.pknic.net.pk/domain/',
  'net.pk': 'https://rdap.pknic.net.pk/domain/',
};

function isPkDomain(tld: string) {
  return /\.(pk|com\.pk|net\.pk|org\.pk)$/i.test(tld);
}

function formatDate(iso: string | null) {
  if (!iso) return 'N/A';
  try { return new Date(iso).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return iso; }
}

async function rdapLookup(domain: string): Promise<WhoisData> {
  const tld = domain.slice(domain.indexOf('.') + 1).toLowerCase();
  const baseUrl = RDAP_OVERRIDES[tld] ?? `https://rdap.org/domain/`;
  const url = RDAP_OVERRIDES[tld] ? `${baseUrl}${domain}` : `${baseUrl}${domain}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/rdap+json, application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) {
      return { domain, available: true, status: ['available'], registrar: null, registrationDate: null, expirationDate: null, lastUpdated: null, nameservers: [] };
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const nameservers: string[] = (data.nameservers ?? []).map((ns: any) => ns.ldhName ?? ns.unicodeName ?? '').filter(Boolean);
    const status: string[] = data.status ?? [];
    const events: any[] = data.events ?? [];
    const getEvent = (type: string) => events.find(e => e.eventAction === type)?.eventDate ?? null;
    let registrar: string | null = null;
    for (const ent of data.entities ?? []) {
      if ((ent.roles ?? []).includes('registrar')) {
        registrar = ent.vcardArray?.[1]?.find((v: any) => v[0] === 'fn')?.[3] ?? ent.handle ?? null;
        break;
      }
    }
    const isRegistered = status.some(s => ['active', 'registered', 'client transfer prohibited', 'server transfer prohibited'].includes(s.toLowerCase())) || (data.ldhName || data.handle);
    return {
      domain,
      available: !isRegistered,
      status,
      registrar,
      registrationDate: getEvent('registration'),
      expirationDate: getEvent('expiration'),
      lastUpdated: getEvent('last changed'),
      nameservers,
    };
  } catch {
    throw new Error('Could not fetch WHOIS data. The registry may not support RDAP for this TLD.');
  }
}

const WhoisModal: React.FC<{ domain: string; onClose: () => void }> = ({ domain, onClose }) => {
  const [data, setData] = useState<WhoisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    setLoading(true); setError('');
    rdapLookup(domain)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [domain]);

  const copyAll = () => {
    if (!data) return;
    const text = [
      `Domain: ${data.domain}`,
      `Status: ${data.available ? 'Available' : 'Registered'}`,
      data.registrar ? `Registrar: ${data.registrar}` : '',
      data.registrationDate ? `Registered: ${formatDate(data.registrationDate)}` : '',
      data.expirationDate ? `Expires: ${formatDate(data.expirationDate)}` : '',
      data.nameservers.length ? `Nameservers:\n${data.nameservers.join('\n')}` : '',
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-purple-700 to-purple-500 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-white/70 text-xs font-bold uppercase tracking-widest">WHOIS Lookup</p>
            <h3 className="text-white text-lg font-black">{domain}</h3>
          </div>
          <div className="flex items-center gap-2">
            {data && !loading && (
              <button onClick={copyAll} className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all">
                {copied ? <Check size={12} /> : <Copy size={12} />}{copied ? 'Copied' : 'Copy'}
              </button>
            )}
            <a
              href={`https://lookup.icann.org/lookup?name=${encodeURIComponent(domain)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
            >
              <ExternalLink size={12} /> ICANN
            </a>
            <button onClick={onClose} className="text-white/70 hover:text-white ml-1 transition-colors"><XCircle size={22} /></button>
          </div>
        </div>

        <div className="p-6">
          {loading && (
            <div className="flex flex-col items-center py-10 gap-3">
              <Loader2 size={28} className="animate-spin text-purple-600" />
              <p className="text-sm text-slate-400 font-medium">Querying RDAP registry...</p>
            </div>
          )}
          {error && !loading && (
            <div className="flex flex-col items-center py-8 gap-3 text-center">
              <AlertCircle size={28} className="text-red-400" />
              <p className="text-sm text-slate-600 font-medium">{error}</p>
              <a href={`https://lookup.icann.org/lookup?name=${encodeURIComponent(domain)}`} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-600 font-bold underline">Try ICANN Lookup →</a>
            </div>
          )}
          {data && !loading && !error && (
            <div className="space-y-3">
              <div className={`flex items-center gap-2 p-3 rounded-xl ${data.available ? 'bg-emerald-50' : 'bg-red-50'}`}>
                {data.available ? <CheckCircle2 size={16} className="text-emerald-500" /> : <AlertCircle size={16} className="text-red-400" />}
                <span className={`text-sm font-black ${data.available ? 'text-emerald-600' : 'text-red-500'}`}>
                  {data.available ? 'Domain is Available' : 'Domain is Registered'}
                </span>
              </div>

              {!data.available && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50">
                      <div className="flex items-center gap-1.5 mb-1"><Calendar size={12} className="text-purple-600" /><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registered</span></div>
                      <p className="text-sm font-black text-slate-800">{formatDate(data.registrationDate)}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50">
                      <div className="flex items-center gap-1.5 mb-1"><Calendar size={12} className="text-red-400" /><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expires</span></div>
                      <p className="text-sm font-black text-slate-800">{formatDate(data.expirationDate)}</p>
                    </div>
                  </div>
                  {data.registrar && (
                    <div className="p-3 rounded-xl bg-slate-50">
                      <div className="flex items-center gap-1.5 mb-1"><Building2 size={12} className="text-purple-600" /><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registrar</span></div>
                      <p className="text-sm font-semibold text-slate-800">{data.registrar}</p>
                    </div>
                  )}
                  {data.nameservers.length > 0 && (
                    <div className="p-3 rounded-xl bg-slate-50">
                      <div className="flex items-center gap-1.5 mb-2"><Server size={12} className="text-purple-600" /><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nameservers</span></div>
                      <div className="space-y-1">
                        {data.nameservers.slice(0, 4).map((ns, i) => (
                          <p key={i} className="text-xs font-mono text-slate-600 bg-white rounded-lg px-2 py-1 border border-slate-200">{ns}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.status.length > 0 && (
                    <div className="p-3 rounded-xl bg-slate-50">
                      <div className="flex items-center gap-1.5 mb-2"><Info size={12} className="text-purple-600" /><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Flags</span></div>
                      <div className="flex flex-wrap gap-1">
                        {data.status.slice(0, 5).map((s, i) => (
                          <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => window.location.href = `/client/domains/transfer?domain=${encodeURIComponent(domain)}`}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-black text-sm rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={14} /> Transfer This Domain to Noehost
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const TABS = [
  { id: 'single', label: 'Domain Search', icon: <Search size={15} /> },
  { id: 'bulk',   label: 'Bulk Search',   icon: <Layers size={15} /> },
  { id: 'transfer', label: 'Bulk Transfer', icon: <ArrowRightLeft size={15} /> },
];

const DomainChecker: React.FC<DomainCheckerProps> = ({
  variant = 'page',
  placeholder = 'Search for your dream domain...',
}) => {
  const [activeTab, setActiveTab] = useState<'single' | 'bulk' | 'transfer'>('single');

  const { convertFromPKR } = useCurrency();
  const { addItem, openCart } = useCart();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TldResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState('');
  const [error, setError] = useState('');
  const [addedDomains, setAddedDomains] = useState<Set<string>>(new Set());
  const [whoisDomain, setWhoisDomain] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [bulkInput, setBulkInput] = useState('');
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);
  const [bulkSearching, setBulkSearching] = useState(false);

  const [transferInput, setTransferInput] = useState('');
  const [transferList, setTransferList] = useState<string[]>([]);
  const [transferAdded, setTransferAdded] = useState<Set<string>>(new Set());

  const cleanName = (s: string) =>
    s.trim().toLowerCase()
      .replace(/^https?:\/\//, '').replace(/\/$/, '')
      .replace(/\s+/g, '-').split('.')[0]
      .replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '');

  const getPriceDisplay = (tld: string, price: number) => {
    if (isPkDomain(tld)) return 'PKR 4,000 / 2 yrs';
    return `${convertFromPKR(price)}/yr`;
  };

  const handleSearch = async (e: React.FormEvent, overrideQuery?: string) => {
    e.preventDefault();
    const q = (overrideQuery ?? query).trim();
    if (!q) return;
    const name = cleanName(q);
    if (!name || name.length < 2) { setError('Please enter a valid domain name (min 2 chars).'); return; }
    setError(''); setSearching(true); setResults(null); setSearched(name);
    try {
      const res = await fetch(`/api/domains/availability?domain=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to check availability.'); }
      else { setResults((data.results || []).filter((r: TldResult) => r.registrationPrice > 0)); }
    } catch { setError('Network error. Please try again.'); }
    finally { setSearching(false); }
  };

  const handleAddToCart = async (r: TldResult) => {
    const domainFull = `${searched}${r.tld}`;
    const price = isPkDomain(r.tld) ? 4000 : r.registrationPrice;
    await addItem({
      type: 'domain', planId: `domain-${domainFull}`, name: domainFull,
      billingCycle: isPkDomain(r.tld) ? 'biennially' : 'yearly',
      monthlyPrice: price, quarterlyPrice: null, semiannualPrice: null, yearlyPrice: price,
      domainName: domainFull, tld: r.tld,
    });
    setAddedDomains(prev => new Set([...prev, domainFull]));
    openCart();
  };

  const available = results?.filter(r => r.available) ?? [];
  const taken = results?.filter(r => !r.available) ?? [];

  const handleBulkSearch = async () => {
    const lines = bulkInput.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const domains = lines.map(l => {
      const name = cleanName(l);
      const tldMatch = l.includes('.') ? l.slice(l.indexOf('.')) : '.com';
      return { domain: `${name}${tldMatch}`, baseName: name, tld: tldMatch };
    }).filter(d => d.baseName.length >= 2);

    setBulkResults(domains.map(d => ({ domain: d.domain, available: null, checking: true, baseName: d.baseName, tld: d.tld })));
    setBulkSearching(true);

    for (let i = 0; i < domains.length; i++) {
      const { domain, baseName, tld } = domains[i];
      try {
        const res = await fetch(`/api/domains/availability?domain=${encodeURIComponent(baseName)}`);
        const data = await res.json();
        const match = (data.results ?? []).find((r: TldResult) => r.tld === tld);
        setBulkResults(prev => prev.map((p, idx) =>
          idx === i ? { ...p, checking: false, available: match?.available ?? null, price: match?.registrationPrice ?? 0, tld: tld } : p
        ));
      } catch {
        setBulkResults(prev => prev.map((p, idx) =>
          idx === i ? { ...p, checking: false, available: null } : p
        ));
      }
    }
    setBulkSearching(false);
  };

  const addBulkToCart = async (r: BulkResult) => {
    if (!r.available || !r.price) return;
    const price = isPkDomain(r.tld ?? '') ? 4000 : r.price;
    await addItem({
      type: 'domain', planId: `domain-${r.domain}`, name: r.domain,
      billingCycle: isPkDomain(r.tld ?? '') ? 'biennially' : 'yearly',
      monthlyPrice: price, quarterlyPrice: null, semiannualPrice: null, yearlyPrice: price,
      domainName: r.domain, tld: r.tld ?? '',
    });
    setBulkResults(prev => prev.map(p => p.domain === r.domain ? { ...p, added: true } : p));
    openCart();
  };

  const handleTransferParse = () => {
    const lines = transferInput.split('\n').map(l => l.trim().toLowerCase()).filter(l => l.includes('.') && l.length >= 4);
    setTransferList([...new Set(lines)]);
  };

  const addTransferToCart = async (domain: string) => {
    await addItem({
      type: 'domain', planId: `transfer-${domain}`, name: `Transfer: ${domain}`,
      billingCycle: 'yearly', monthlyPrice: 0, quarterlyPrice: null, semiannualPrice: null,
      yearlyPrice: 0, domainName: domain, tld: domain.slice(domain.indexOf('.')),
    });
    setTransferAdded(prev => new Set([...prev, domain]));
    openCart();
  };

  const inputBaseClass = 'w-full bg-transparent text-slate-800 font-bold placeholder:text-slate-400 focus:outline-none focus-visible:outline-none focus-visible:ring-0 border-0 focus:border-0 outline-none ring-0';

  return (
    <div className="w-full">
      {/* Tabs */}
      <div className={`flex gap-1 mb-4 p-1 rounded-2xl ${variant === 'hero' ? 'bg-white/10 backdrop-blur-sm' : 'bg-slate-100'}`}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-black text-sm transition-all ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : variant === 'hero'
                ? 'text-white/70 hover:text-white hover:bg-white/10'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* SINGLE SEARCH TAB */}
      <AnimatePresence mode="wait">
        {activeTab === 'single' && (
          <motion.div key="single" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
            <form onSubmit={handleSearch}>
              <div className="relative bg-white rounded-2xl p-2 shadow-xl flex items-stretch gap-2">
                <div className="flex-grow flex items-center px-5 gap-4">
                  <Globe className="text-purple-600 flex-shrink-0" size={22} />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder={placeholder}
                    className={`py-4 text-lg ${inputBaseClass}`}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-10 py-4 rounded-xl font-black transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-purple-600/30"
                >
                  {searching ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                  <span className="hidden sm:inline">{searching ? 'Searching...' : 'Search'}</span>
                </button>
              </div>
            </form>

            {/* Quick TLD pills */}
            {!results && !searching && (
              <div className="flex flex-wrap gap-2 mt-3">
                {['.com', '.net', '.org', '.pk', '.store', '.io'].map(tld => (
                  <button
                    key={tld}
                    type="button"
                    onClick={e => {
                      const base = cleanName(query) || 'yourdomain';
                      setQuery(base + tld);
                      handleSearch(e as any, base + tld);
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all border ${
                      variant === 'hero'
                        ? 'bg-white/5 hover:bg-white/15 border-white/10 text-slate-300'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600 shadow-sm'
                    }`}
                  >
                    {tld}
                  </button>
                ))}
              </div>
            )}

            {error && <p className="mt-3 text-sm text-red-400 font-medium">{error}</p>}

            {searching && (
              <div className="flex items-center justify-center gap-3 mt-8 py-6">
                <Loader2 size={22} className="animate-spin text-purple-600" />
                <p className="text-sm font-bold text-slate-400">Checking availability across all extensions...</p>
              </div>
            )}

            {/* RESULTS — Ionos-style 2 column */}
            <AnimatePresence>
              {results && results.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }}
                  transition={{ duration: 0.3 }}
                  className="mt-5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-black uppercase tracking-widest ${variant === 'hero' ? 'text-slate-400' : 'text-slate-500'}`}>
                      Results for "<span className={variant === 'hero' ? 'text-white' : 'text-slate-800'}>{searched}</span>"
                    </span>
                    <button
                      onClick={() => { setResults(null); setSearched(''); setQuery(''); setAddedDomains(new Set()); inputRef.current?.focus(); }}
                      className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <XCircle size={15} /> Clear
                    </button>
                  </div>

                  <div className="grid lg:grid-cols-5 gap-4">
                    {/* LEFT: Results list */}
                    <div className="lg:col-span-3 bg-white rounded-2xl shadow-lg overflow-hidden">
                      {/* Available */}
                      {available.length > 0 && (
                        <div>
                          <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-100">
                            <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">✓ Available ({available.length})</span>
                          </div>
                          <div className="divide-y divide-slate-100">
                            {available.map((r, i) => {
                              const domainFull = `${searched}${r.tld}`;
                              const isAdded = addedDomains.has(domainFull);
                              return (
                                <motion.div
                                  key={r.tld}
                                  initial={{ opacity: 0, x: -6 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: i * 0.03 }}
                                  className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-all"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0" />
                                    <div>
                                      <span className="font-black text-slate-900 text-sm">{searched}</span>
                                      <span className="font-black text-purple-600 text-sm">{r.tld}</span>
                                      <div className="text-xs text-emerald-600 font-semibold">Available</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 flex-shrink-0">
                                    <span className="text-sm font-black text-slate-700 whitespace-nowrap">{getPriceDisplay(r.tld, r.registrationPrice)}</span>
                                    <button
                                      onClick={() => handleAddToCart(r)}
                                      disabled={isAdded}
                                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-black text-xs transition-all whitespace-nowrap ${
                                        isAdded
                                          ? 'bg-emerald-500 text-white'
                                          : 'bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/20'
                                      }`}
                                    >
                                      {isAdded ? <Check size={12} /> : <ShoppingCart size={12} />}
                                      {isAdded ? 'Added' : 'Add'}
                                    </button>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Taken */}
                      {taken.length > 0 && (
                        <div>
                          <div className="px-4 py-2.5 bg-red-50 border-b border-red-100">
                            <span className="text-xs font-black text-red-600 uppercase tracking-widest">✗ Taken ({taken.length})</span>
                          </div>
                          <div className="divide-y divide-slate-100">
                            {taken.map((r, i) => {
                              const domainFull = `${searched}${r.tld}`;
                              return (
                                <motion.div
                                  key={r.tld}
                                  initial={{ opacity: 0, x: -6 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: (available.length + i) * 0.03 }}
                                  className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-all"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-400 flex-shrink-0" />
                                    <div>
                                      <span className="font-black text-slate-500 text-sm line-through">{searched}</span>
                                      <span className="font-black text-slate-500 text-sm line-through">{r.tld}</span>
                                      <div className="text-xs text-red-500 font-semibold">Taken</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                      onClick={() => setWhoisDomain(domainFull)}
                                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-black text-xs bg-slate-100 hover:bg-purple-100 hover:text-purple-700 text-slate-500 transition-all"
                                    >
                                      <Info size={11} /> WHOIS
                                    </button>
                                    <button
                                      onClick={() => window.location.href = `/client/domains/transfer?domain=${encodeURIComponent(domainFull)}`}
                                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-black text-xs bg-slate-100 hover:bg-orange-100 hover:text-orange-600 text-slate-600 transition-all"
                                    >
                                      <RefreshCw size={11} /> Transfer
                                    </button>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* RIGHT: Summary panel */}
                    <div className="lg:col-span-2 space-y-3">
                      {/* Cart summary */}
                      {addedDomains.size > 0 && (
                        <div className="bg-white rounded-2xl shadow-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <ShoppingCart size={16} className="text-purple-600" />
                            <span className="text-sm font-black text-slate-800">Selected ({addedDomains.size})</span>
                          </div>
                          <div className="space-y-1.5 mb-3">
                            {[...addedDomains].map(d => (
                              <div key={d} className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-700">{d}</span>
                                <CheckCircle2 size={13} className="text-emerald-500" />
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={openCart}
                            className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl transition-all flex items-center justify-center gap-2"
                          >
                            View Cart <ChevronRight size={14} />
                          </button>
                        </div>
                      )}

                      {/* Info panel */}
                      <div className="bg-white rounded-2xl shadow-lg p-4">
                        <h4 className="text-sm font-black text-slate-800 mb-3">Why Noehost?</h4>
                        <div className="space-y-2">
                          {['Free WHOIS Privacy', 'Free DNS Management', 'Auto-Renewal', '24/7 Support'].map((f, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
                              <span className="text-xs font-semibold text-slate-600">{f}</span>
                            </div>
                          ))}
                        </div>
                        {available.length > 0 && (
                          <div className="mt-3 p-3 bg-emerald-50 rounded-xl">
                            <p className="text-xs font-black text-emerald-700">{available.length} domain{available.length > 1 ? 's' : ''} available for "{searched}"</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* BULK SEARCH TAB */}
        {activeTab === 'bulk' && (
          <motion.div key="bulk" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <div className="flex items-center gap-2 mb-1">
                  <Layers size={16} className="text-purple-600" />
                  <span className="text-sm font-black text-slate-800">Bulk Domain Search</span>
                </div>
                <p className="text-xs text-slate-500 font-medium">Enter one domain per line (e.g. mybusiness.com, mysite.pk)</p>
              </div>
              <div className="p-4">
                <textarea
                  value={bulkInput}
                  onChange={e => setBulkInput(e.target.value)}
                  placeholder={"mybusiness.com\nmysite.pk\nmystore.net\nmybrand.io"}
                  rows={6}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:border-purple-400 resize-none transition-colors"
                />
                <button
                  onClick={handleBulkSearch}
                  disabled={bulkSearching || !bulkInput.trim()}
                  className="mt-3 w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {bulkSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                  {bulkSearching ? 'Checking...' : 'Check All Domains'}
                </button>
              </div>

              {bulkResults.length > 0 && (
                <div className="border-t border-slate-100 divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {bulkResults.map((r, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {r.checking
                          ? <Loader2 size={14} className="animate-spin text-slate-400 flex-shrink-0" />
                          : <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${r.available === true ? 'bg-emerald-400' : r.available === false ? 'bg-red-400' : 'bg-slate-300'}`} />
                        }
                        <div>
                          <span className="text-sm font-black text-slate-800">{r.domain}</span>
                          {!r.checking && (
                            <div className={`text-xs font-semibold ${r.available === true ? 'text-emerald-600' : r.available === false ? 'text-red-500' : 'text-slate-400'}`}>
                              {r.available === true ? 'Available' : r.available === false ? 'Taken' : 'Unknown'}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {r.available && r.price && !r.checking && (
                          <>
                            <span className="text-xs font-black text-slate-600 whitespace-nowrap">{getPriceDisplay(r.tld ?? '', r.price)}</span>
                            <button
                              onClick={() => addBulkToCart(r)}
                              disabled={r.added}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs transition-all ${r.added ? 'bg-emerald-500 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
                            >
                              {r.added ? <Check size={12} /> : <Plus size={12} />}
                              {r.added ? 'Added' : 'Add'}
                            </button>
                          </>
                        )}
                        {r.available === false && !r.checking && (
                          <button
                            onClick={() => window.location.href = `/client/domains/transfer?domain=${encodeURIComponent(r.domain)}`}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-black text-xs bg-slate-100 hover:bg-orange-100 hover:text-orange-600 text-slate-500 transition-all"
                          >
                            <RefreshCw size={11} /> Transfer
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* BULK TRANSFER TAB */}
        {activeTab === 'transfer' && (
          <motion.div key="transfer" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowRightLeft size={16} className="text-purple-600" />
                  <span className="text-sm font-black text-slate-800">Bulk Domain Transfer</span>
                </div>
                <p className="text-xs text-slate-500 font-medium">Enter domains you want to transfer to Noehost, one per line</p>
              </div>
              <div className="p-4">
                <textarea
                  value={transferInput}
                  onChange={e => setTransferInput(e.target.value)}
                  placeholder={"example.com\nmybusiness.pk\nmysite.net"}
                  rows={6}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:border-purple-400 resize-none transition-colors"
                />
                <button
                  onClick={handleTransferParse}
                  disabled={!transferInput.trim()}
                  className="mt-3 w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <ArrowRightLeft size={18} /> Process Transfer List
                </button>
              </div>

              {transferList.length > 0 && (
                <div className="border-t border-slate-100">
                  <div className="px-4 py-2.5 bg-orange-50">
                    <span className="text-xs font-black text-orange-700 uppercase tracking-widest">{transferList.length} domain{transferList.length > 1 ? 's' : ''} to transfer</span>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                    {transferList.map((domain, i) => (
                      <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <RefreshCw size={14} className="text-orange-500 flex-shrink-0" />
                          <span className="text-sm font-black text-slate-800">{domain}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => window.location.href = `/client/domains/transfer?domain=${encodeURIComponent(domain)}`}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs transition-all ${
                              transferAdded.has(domain) ? 'bg-emerald-500 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white shadow-md'
                            }`}
                          >
                            {transferAdded.has(domain) ? <Check size={12} /> : <ArrowRightLeft size={12} />}
                            {transferAdded.has(domain) ? 'Done' : 'Transfer'}
                          </button>
                          <button
                            onClick={() => setTransferList(prev => prev.filter((_, idx) => idx !== i))}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 bg-slate-50 border-t border-slate-100">
                    <p className="text-xs text-slate-500 font-medium">
                      💡 You'll need your domain's EPP/Auth code ready. Transfers typically complete in 5–7 days.
                    </p>
                  </div>
                </div>
              )}
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
