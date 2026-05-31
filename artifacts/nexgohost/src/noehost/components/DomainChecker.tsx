import React, { useState, useRef, useEffect } from 'react';
import {
  Globe, Search, XCircle, Loader2, ShoppingCart, RefreshCw, Info,
  Calendar, Building2, Server, CheckCircle2, AlertCircle, Copy, ExternalLink,
  Layers, ArrowRightLeft, Check, Plus, Trash2, Tag, Zap
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
  com:      'https://rdap.verisign.com/com/v1/domain/',
  net:      'https://rdap.verisign.com/net/v1/domain/',
  org:      'https://rdap.publicinterestregistry.org/rdap/domain/',
  io:       'https://rdap.nic.io/domain/',
  pk:       'https://rdap.pknic.net.pk/domain/',
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
  const baseUrl = RDAP_OVERRIDES[tld] ?? 'https://rdap.org/domain/';
  const url = `${baseUrl}${domain}`;
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
    const isRegistered = status.some(s => ['active', 'registered', 'client transfer prohibited', 'server transfer prohibited'].includes(s.toLowerCase())) || !!(data.ldhName || data.handle);
    return { domain, available: !isRegistered, status, registrar, registrationDate: getEvent('registration'), expirationDate: getEvent('expiration'), lastUpdated: getEvent('last changed'), nameservers };
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
    rdapLookup(domain).then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [domain]);

  const copyAll = () => {
    if (!data) return;
    const text = [`Domain: ${data.domain}`, `Status: ${data.available ? 'Available' : 'Registered'}`, data.registrar ? `Registrar: ${data.registrar}` : '', data.registrationDate ? `Registered: ${formatDate(data.registrationDate)}` : '', data.expirationDate ? `Expires: ${formatDate(data.expirationDate)}` : '', data.nameservers.length ? `Nameservers:\n${data.nameservers.join('\n')}` : ''].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-purple-700 to-purple-500 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-white/70 text-xs font-bold uppercase tracking-widest">WHOIS Lookup</p>
            <h3 className="text-white text-lg font-black">{domain}</h3>
          </div>
          <div className="flex items-center gap-2">
            {data && !loading && <button onClick={copyAll} className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all">{copied ? <Check size={12} /> : <Copy size={12} />}{copied ? 'Copied' : 'Copy'}</button>}
            <a href={`https://lookup.icann.org/lookup?name=${encodeURIComponent(domain)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all"><ExternalLink size={12} /> ICANN</a>
            <button onClick={onClose} className="text-white/70 hover:text-white ml-1 transition-colors"><XCircle size={22} /></button>
          </div>
        </div>
        <div className="p-6">
          {loading && <div className="flex flex-col items-center py-10 gap-3"><Loader2 size={28} className="animate-spin text-purple-600" /><p className="text-sm text-slate-400 font-medium">Querying RDAP registry...</p></div>}
          {error && !loading && <div className="flex flex-col items-center py-8 gap-3 text-center"><AlertCircle size={28} className="text-red-400" /><p className="text-sm text-slate-600 font-medium">{error}</p><a href={`https://lookup.icann.org/lookup?name=${encodeURIComponent(domain)}`} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-600 font-bold underline">Try ICANN Lookup →</a></div>}
          {data && !loading && !error && (
            <div className="space-y-3">
              <div className={`flex items-center gap-2 p-3 rounded-xl ${data.available ? 'bg-emerald-50' : 'bg-red-50'}`}>
                {data.available ? <CheckCircle2 size={16} className="text-emerald-500" /> : <AlertCircle size={16} className="text-red-400" />}
                <span className={`text-sm font-black ${data.available ? 'text-emerald-600' : 'text-red-500'}`}>{data.available ? 'Domain is Available' : 'Domain is Registered'}</span>
              </div>
              {!data.available && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50"><div className="flex items-center gap-1.5 mb-1"><Calendar size={12} className="text-purple-600" /><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registered</span></div><p className="text-sm font-black text-slate-800">{formatDate(data.registrationDate)}</p></div>
                    <div className="p-3 rounded-xl bg-slate-50"><div className="flex items-center gap-1.5 mb-1"><Calendar size={12} className="text-red-400" /><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expires</span></div><p className="text-sm font-black text-slate-800">{formatDate(data.expirationDate)}</p></div>
                  </div>
                  {data.registrar && <div className="p-3 rounded-xl bg-slate-50"><div className="flex items-center gap-1.5 mb-1"><Building2 size={12} className="text-purple-600" /><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registrar</span></div><p className="text-sm font-semibold text-slate-800">{data.registrar}</p></div>}
                  {data.nameservers.length > 0 && <div className="p-3 rounded-xl bg-slate-50"><div className="flex items-center gap-1.5 mb-2"><Server size={12} className="text-purple-600" /><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nameservers</span></div><div className="space-y-1">{data.nameservers.slice(0, 4).map((ns, i) => <p key={i} className="text-xs font-mono text-slate-600 bg-white rounded-lg px-2 py-1 border border-slate-200">{ns}</p>)}</div></div>}
                  {data.status.length > 0 && <div className="p-3 rounded-xl bg-slate-50"><div className="flex items-center gap-1.5 mb-2"><Info size={12} className="text-purple-600" /><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Flags</span></div><div className="flex flex-wrap gap-1">{data.status.slice(0, 5).map((s, i) => <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{s}</span>)}</div></div>}
                  <button onClick={() => window.location.href = `/client/domains/transfer?domain=${encodeURIComponent(domain)}`} className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-black text-sm rounded-xl transition-all flex items-center justify-center gap-2"><RefreshCw size={14} /> Transfer This Domain to Noehost</button>
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
  { id: 'single',   label: 'Domain Search', icon: <Search size={15} /> },
  { id: 'bulk',     label: 'Bulk Search',   icon: <Layers size={15} /> },
  { id: 'transfer', label: 'Bulk Transfer', icon: <ArrowRightLeft size={15} /> },
];

const SaleBadge: React.FC<{ pct: number }> = ({ pct }) => (
  <span className="inline-flex items-center gap-0.5 bg-green-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide">
    <Tag size={8} />Save {pct}%
  </span>
);

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
  const [bundleConfig, setBundleConfig] = useState<Record<string, string[]>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/domain-bundles').then(r => r.json()).then(d => setBundleConfig(d)).catch(() => {});
  }, []);

  const [bulkInput, setBulkInput] = useState('');
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);
  const [bulkSearching, setBulkSearching] = useState(false);

  const [transferInput, setTransferInput] = useState('');
  const [transferList, setTransferList] = useState<string[]>([]);
  const [transferAdded, setTransferAdded] = useState<Set<string>>(new Set());

  const cleanName = (s: string) =>
    s.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/\s+/g, '-').split('.')[0].replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '');

  const getPriceDisplay = (tld: string, price: number) => {
    if (isPkDomain(tld)) return { label: 'PKR 4,000', period: '/2 yrs' };
    return { label: convertFromPKR(price), period: '/year' };
  };

  const getSavePct = (tld: string, price: number) => {
    if (isPkDomain(tld)) return 0;
    const retail = price * 3;
    const save = Math.round(((retail - price) / retail) * 100);
    return save > 10 ? save : 0;
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
      if (!res.ok) setError(data.error || 'Failed to check availability.');
      else setResults((data.results || []).filter((r: TldResult) => r.registrationPrice > 0));
    } catch { setError('Network error. Please try again.'); }
    finally { setSearching(false); }
  };

  const DOMAIN_ORDER_KEY = 'order_wizard_domain';
  const DOMAIN_SESSION_KEY = 'noehost_domain_session';

  const handleAddToCart = async (tld: string, price: number, baseName?: string) => {
    const name = baseName ?? searched;
    const domainFull = `${name}${tld}`;
    const finalPrice = isPkDomain(tld) ? 4000 : price;
    await addItem({
      type: 'domain', planId: `domain-${domainFull}`, name: domainFull,
      billingCycle: isPkDomain(tld) ? 'biennially' : 'yearly',
      monthlyPrice: finalPrice, quarterlyPrice: null, semiannualPrice: null,
      yearlyPrice: finalPrice, domainName: domainFull, tld,
    });
    setAddedDomains(prev => new Set([...prev, domainFull]));
    openCart();
  };

  const handleRegisterNow = async (tld: string, price: number, baseName?: string) => {
    const name = baseName ?? searched;
    const domainFull = `${name}${tld}`;
    const finalPrice = isPkDomain(tld) ? 4000 : price;

    const domainPayload = {
      fullName: domainFull,
      price: finalPrice,
      originalPrice: finalPrice,
      mode: 'register',
    };
    localStorage.setItem(DOMAIN_ORDER_KEY, JSON.stringify(domainPayload));

    let sessionToken = localStorage.getItem(DOMAIN_SESSION_KEY);
    if (!sessionToken) {
      sessionToken = crypto.randomUUID();
      localStorage.setItem(DOMAIN_SESSION_KEY, sessionToken);
    }

    fetch('/api/guest/domain-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionToken,
        domainName: name,
        tld,
        fullDomain: domainFull,
        price: finalPrice,
        durationYears: isPkDomain(tld) ? 2 : 1,
        actionType: 'register',
      }),
    }).catch(() => {});

    window.location.href = '/client/orders/new?service=domain';
  };

  const POPULAR_TLDS = ['.com', '.net', '.org', '.pk', '.store', '.io', '.co', '.online', '.com.pk', '.net.pk'];
  const available = results?.filter(r => r.available) ?? [];
  const taken = results?.filter(r => !r.available) ?? [];
  const primaryAvail = available[0];
  // Use admin-configured bundles if available, fall back to first 3 available TLDs
  const configuredBundle = primaryAvail ? (bundleConfig[primaryAvail.tld] ?? []) : [];
  const bundleAlts = configuredBundle.length > 0
    ? configuredBundle
        .map(tld => results?.find(r => r.tld === tld))
        .filter((r): r is TldResult => !!r)
        .slice(0, 3)
    : available.filter(r => r.tld !== primaryAvail?.tld).slice(0, 3);
  // "Other recommended" = only popular TLDs (excluding primary), max 5
  const otherDomains = results
    ? POPULAR_TLDS
        .map(tld => results.find(r => r.tld === tld))
        .filter((r): r is TldResult => !!r && r.tld !== primaryAvail?.tld)
        .slice(0, 5)
    : [];

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
        setBulkResults(prev => prev.map((p, idx) => idx === i ? { ...p, checking: false, available: match?.available ?? null, price: match?.registrationPrice ?? 0, tld } : p));
      } catch {
        setBulkResults(prev => prev.map((p, idx) => idx === i ? { ...p, checking: false, available: null } : p));
      }
    }
    setBulkSearching(false);
  };

  const addBulkToCart = async (r: BulkResult) => {
    if (!r.available || !r.price) return;
    const price = isPkDomain(r.tld ?? '') ? 4000 : r.price;
    await addItem({ type: 'domain', planId: `domain-${r.domain}`, name: r.domain, billingCycle: isPkDomain(r.tld ?? '') ? 'biennially' : 'yearly', monthlyPrice: price, quarterlyPrice: null, semiannualPrice: null, yearlyPrice: price, domainName: r.domain, tld: r.tld ?? '' });
    setBulkResults(prev => prev.map(p => p.domain === r.domain ? { ...p, added: true } : p));
    openCart();
  };

  const handleTransferParse = () => {
    const lines = transferInput.split('\n').map(l => l.trim().toLowerCase()).filter(l => l.includes('.') && l.length >= 4);
    setTransferList([...new Set(lines)]);
  };

  const inputClass = 'w-full bg-transparent text-slate-800 font-bold placeholder:text-slate-400 focus:outline-none focus-visible:outline-none focus-visible:ring-0 border-0 focus:border-0 outline-none ring-0';

  return (
    <div className="w-full">
      {/* Tabs */}
      <div className={`flex gap-1 mb-4 p-1 rounded-2xl ${variant === 'hero' ? 'bg-white/10 backdrop-blur-sm' : 'bg-slate-100'}`}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-black text-sm transition-all ${activeTab === tab.id ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : variant === 'hero' ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-800 hover:bg-white'}`}>
            {tab.icon}<span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ═══ SINGLE SEARCH TAB ═══ */}
        {activeTab === 'single' && (
          <motion.div key="single" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>

            {/* Search bar */}
            <form onSubmit={handleSearch}>
              <div className="relative bg-white rounded-2xl p-2 shadow-xl flex items-stretch gap-2">
                <div className="flex-grow flex items-center px-5 gap-4">
                  <Globe className="text-purple-600 flex-shrink-0" size={22} />
                  <input ref={inputRef} type="text" placeholder={placeholder} className={`py-4 text-lg ${inputClass}`} value={query} onChange={e => setQuery(e.target.value)} />
                </div>
                <button type="submit" disabled={searching} className="bg-purple-600 hover:bg-purple-700 text-white px-10 py-4 rounded-xl font-black transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-purple-600/30">
                  {searching ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                  <span className="hidden sm:inline">{searching ? 'Searching...' : 'Search'}</span>
                </button>
              </div>
            </form>

            {/* Quick TLD pills */}
            {!results && !searching && (
              <div className="flex flex-wrap gap-2 mt-3">
                {['.com', '.net', '.org', '.pk', '.store', '.io'].map(tld => (
                  <button key={tld} type="button" onClick={e => { const base = cleanName(query) || 'yourdomain'; setQuery(base + tld); handleSearch(e as any, base + tld); }} className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all border ${variant === 'hero' ? 'bg-white/5 hover:bg-white/15 border-white/10 text-slate-300' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600 shadow-sm'}`}>
                    {tld}
                  </button>
                ))}
              </div>
            )}

            {error && <p className="mt-3 text-sm text-red-400 font-medium">{error}</p>}

            {searching && (
              <div className="flex items-center justify-center gap-3 mt-8 py-6">
                <Loader2 size={22} className="animate-spin text-purple-600" />
                <p className={`text-sm font-bold ${variant === 'hero' ? 'text-slate-400' : 'text-slate-500'}`}>Checking availability across extensions...</p>
              </div>
            )}

            {/* ── RESULTS ── */}
            <AnimatePresence>
              {results && results.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.3 }} className="mt-5 space-y-4">

                  {/* Clear button */}
                  <div className="flex justify-end">
                    <button onClick={() => { setResults(null); setSearched(''); setQuery(''); setAddedDomains(new Set()); }} className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">
                      <XCircle size={14} /> Clear results
                    </button>
                  </div>

                  {/* ── PRIMARY AVAILABLE DOMAIN + BUNDLE — 2-column card ── */}
                  {primaryAvail && (
                    <div>
                      {/* Green banner */}
                      <div className="flex items-center gap-2 bg-green-500 text-white text-sm font-black px-5 py-3 rounded-t-2xl">
                        <CheckCircle2 size={16} /> Great! This domain is still available!
                      </div>

                      <div className="grid md:grid-cols-2 gap-0 bg-white rounded-b-2xl shadow-xl overflow-hidden border border-green-100">
                        {/* LEFT — Main domain */}
                        <div className="p-6 border-r border-slate-100">
                          {/* Domain name */}
                          <div className="flex items-center gap-2 mb-1">
                            {(() => { const sp = getSavePct(primaryAvail.tld, primaryAvail.registrationPrice); return sp > 0 ? <SaleBadge pct={sp} /> : null; })()}
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">.sale</span>
                          </div>
                          <div className="text-2xl font-black text-slate-900 mb-1">
                            {searched}<span className="text-purple-600">{primaryAvail.tld}</span>
                          </div>

                          {/* Price */}
                          <div className="mb-1">
                            {(() => {
                              const p = getPriceDisplay(primaryAvail.tld, primaryAvail.registrationPrice);
                              return (
                                <>
                                  <span className="text-2xl font-black text-slate-800">{p.label}</span>
                                  <span className="text-slate-500 font-semibold text-sm">{p.period}</span>
                                </>
                              );
                            })()}
                          </div>
                          <p className="text-xs text-slate-400 font-medium mb-4">
                            {isPkDomain(primaryAvail.tld)
                              ? '2-year registration · Renewal at same price'
                              : `for 1 year · Renewal at ${convertFromPKR(primaryAvail.renewalPrice ?? primaryAvail.registrationPrice)}/yr`
                            }
                          </p>

                          <button
                            onClick={() => handleRegisterNow(primaryAvail.tld, primaryAvail.registrationPrice)}
                            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-black text-sm bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/20 transition-all"
                          >
                            <Zap size={15} /> Register Now →
                          </button>
                          <button
                            onClick={() => handleAddToCart(primaryAvail.tld, primaryAvail.registrationPrice)}
                            disabled={addedDomains.has(`${searched}${primaryAvail.tld}`)}
                            className={`flex items-center justify-center gap-2 w-full py-2 rounded-xl font-semibold text-sm transition-all border mt-2 ${addedDomains.has(`${searched}${primaryAvail.tld}`) ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-purple-200 hover:border-purple-400 text-purple-600 hover:bg-purple-50'}`}
                          >
                            {addedDomains.has(`${searched}${primaryAvail.tld}`) ? <><Check size={13} /> Added to Cart</> : <><ShoppingCart size={13} /> Add to Cart</>}
                          </button>

                          <p className="mt-3 text-[11px] text-slate-400 font-medium leading-snug">
                            {searched}{primaryAvail.tld} is the most recognizable domain on the internet, making it the most popular choice for websites.
                          </p>
                        </div>

                        {/* RIGHT — Bundle alternatives */}
                        <div className="p-6 bg-slate-50">
                          {bundleAlts.length > 0 && (
                            <>
                              <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Bundle with popular extensions</div>
                              <div className="text-sm font-black text-slate-700 mb-3">
                                <span className="text-purple-600">{searched}{primaryAvail.tld}</span>
                                {bundleAlts.map(b => <span key={b.tld}> + <span className="text-slate-500">{searched}{b.tld}</span></span>)}
                              </div>

                              {bundleAlts[0] && (() => {
                                const p = getPriceDisplay(bundleAlts[0].tld, bundleAlts[0].registrationPrice);
                                return (
                                  <div className="mb-1">
                                    <span className="text-xl font-black text-slate-800">{p.label}</span>
                                    <span className="text-slate-500 font-semibold text-sm">{p.period}</span>
                                  </div>
                                );
                              })()}
                              <p className="text-xs text-slate-400 font-medium mb-4">
                                {isPkDomain(bundleAlts[0]?.tld ?? '') ? '2-year registration' : 'for 1 year'}
                              </p>

                              <button
                                onClick={() => bundleAlts.forEach(b => handleAddToCart(b.tld, b.registrationPrice))}
                                className="flex items-center justify-center gap-2 w-full py-3 bg-white hover:bg-slate-100 border-2 border-purple-200 hover:border-purple-400 text-purple-700 rounded-xl font-black text-sm transition-all"
                              >
                                <ShoppingCart size={15} /> Add Bundle to Cart
                              </button>

                              <p className="mt-3 text-[11px] text-slate-400 font-medium leading-snug">
                                Protect your brand and claim a stronger online presence when you buy a bundle with Noehost.
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── TAKEN MAIN DOMAIN (if not available) ── */}
                  {!primaryAvail && taken.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                      <div className="flex items-center gap-2 bg-red-500 text-white text-sm font-black px-5 py-3">
                        <AlertCircle size={16} /> Sorry, {searched}{taken[0].tld} is already taken
                      </div>
                      <div className="p-5 flex items-center justify-between gap-4">
                        <div>
                          <div className="text-xl font-black text-slate-500 line-through">{searched}{taken[0].tld}</div>
                          <div className="text-sm text-red-500 font-semibold">Already registered</div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setWhoisDomain(`${searched}${taken[0].tld}`)} className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-purple-100 hover:text-purple-700 text-slate-600 font-black text-sm rounded-xl transition-all"><Info size={14} /> WHOIS</button>
                          <button onClick={() => window.location.href = `/client/domains/transfer?domain=${encodeURIComponent(`${searched}${taken[0].tld}`)}`} className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-black text-sm rounded-xl transition-all"><RefreshCw size={14} /> Transfer</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── OTHER RECOMMENDED DOMAINS ── */}
                  {otherDomains.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                      <div className="px-6 py-4 border-b border-slate-100">
                        <h3 className={`text-base font-black ${variant === 'hero' ? 'text-slate-800' : 'text-slate-800'}`}>Other recommended domains</h3>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {otherDomains.map((r, i) => {
                          const domainFull = `${searched}${r.tld}`;
                          const isAdded = addedDomains.has(domainFull);
                          const sp = getSavePct(r.tld, r.registrationPrice);
                          const p = getPriceDisplay(r.tld, r.registrationPrice);
                          return (
                            <motion.div key={r.tld} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.025 }} className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-all">
                              {/* Left: domain name */}
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${r.available ? 'bg-green-400' : 'bg-red-400'}`} />
                                <span className="text-sm font-black text-slate-800">{searched}<span className={r.available ? 'text-purple-600' : 'text-slate-400'}>{r.tld}</span></span>
                              </div>

                              {/* Middle: price */}
                              <div className="text-right flex-shrink-0 min-w-[110px]">
                                {r.available ? (
                                  <>
                                    {sp > 0 && <div className="mb-0.5"><SaleBadge pct={sp} /></div>}
                                    <div className="font-black text-slate-800 text-sm leading-tight">
                                      {p.label}<span className="text-slate-400 font-medium text-xs">{p.period}</span>
                                    </div>
                                    {!isPkDomain(r.tld) && (
                                      <div className="text-[10px] text-slate-400 font-medium">
                                        Introductory Offer ⓘ
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-xs font-bold text-red-400">Taken</span>
                                )}
                              </div>

                              {/* Right: action button */}
                              <div className="flex-shrink-0">
                                {r.available ? (
                                  <button onClick={() => handleAddToCart(r.tld, r.registrationPrice)} disabled={isAdded} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-xs transition-all whitespace-nowrap ${isAdded ? 'bg-green-500 text-white' : 'border-2 border-purple-300 hover:border-purple-500 hover:bg-purple-50 text-purple-700'}`}>
                                    {isAdded ? <><Check size={12} />Added</> : <><ShoppingCart size={12} />Add to cart</>}
                                  </button>
                                ) : (
                                  <div className="flex gap-1.5">
                                    <button onClick={() => setWhoisDomain(domainFull)} className="flex items-center gap-1 px-2.5 py-2 rounded-xl font-black text-xs bg-slate-100 hover:bg-purple-100 hover:text-purple-700 text-slate-500 transition-all"><Info size={11} />WHOIS</button>
                                    <button onClick={() => window.location.href = `/client/domains/transfer?domain=${encodeURIComponent(domainFull)}`} className="flex items-center gap-1 px-2.5 py-2 rounded-xl font-black text-xs bg-slate-100 hover:bg-orange-100 hover:text-orange-600 text-slate-500 transition-all"><RefreshCw size={11} />Transfer</button>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ═══ BULK SEARCH TAB ═══ */}
        {activeTab === 'bulk' && (
          <motion.div key="bulk" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <div className="flex items-center gap-2 mb-1"><Layers size={16} className="text-purple-600" /><span className="text-sm font-black text-slate-800">Bulk Domain Search</span></div>
                <p className="text-xs text-slate-500 font-medium">Enter one domain per line (e.g. mybusiness.com, mysite.pk)</p>
              </div>
              <div className="p-5">
                <textarea value={bulkInput} onChange={e => setBulkInput(e.target.value)} placeholder={"mybusiness.com\nmysite.pk\nmystore.net\nmybrand.io"} rows={6} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:border-purple-400 resize-none transition-colors" />
                <button onClick={handleBulkSearch} disabled={bulkSearching || !bulkInput.trim()} className="mt-3 w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {bulkSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                  {bulkSearching ? 'Checking...' : 'Check All Domains'}
                </button>
              </div>
              {bulkResults.length > 0 && (
                <div className="border-t border-slate-100 divide-y divide-slate-100 max-h-96 overflow-y-auto">
                  {bulkResults.map((r, i) => {
                    const p = r.available && r.price ? getPriceDisplay(r.tld ?? '', r.price) : null;
                    return (
                      <div key={i} className="px-5 py-3.5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {r.checking ? <Loader2 size={14} className="animate-spin text-slate-400 flex-shrink-0" /> : <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${r.available === true ? 'bg-green-400' : r.available === false ? 'bg-red-400' : 'bg-slate-300'}`} />}
                          <div>
                            <span className="text-sm font-black text-slate-800">{r.domain}</span>
                            {!r.checking && <div className={`text-xs font-semibold ${r.available === true ? 'text-green-600' : r.available === false ? 'text-red-500' : 'text-slate-400'}`}>{r.available === true ? 'Available' : r.available === false ? 'Taken' : 'Unknown'}</div>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {p && <span className="text-xs font-black text-slate-700 whitespace-nowrap">{p.label}{p.period}</span>}
                          {r.available && r.price && !r.checking && (
                            <button onClick={() => addBulkToCart(r)} disabled={r.added} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs transition-all ${r.added ? 'bg-green-500 text-white' : 'border-2 border-purple-300 hover:border-purple-500 hover:bg-purple-50 text-purple-700'}`}>
                              {r.added ? <><Check size={12} />Added</> : <><Plus size={12} />Add</>}
                            </button>
                          )}
                          {r.available === false && !r.checking && (
                            <button onClick={() => window.location.href = `/client/domains/transfer?domain=${encodeURIComponent(r.domain)}`} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-black text-xs bg-slate-100 hover:bg-orange-100 hover:text-orange-600 text-slate-500 transition-all"><RefreshCw size={11} />Transfer</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ═══ BULK TRANSFER TAB ═══ */}
        {activeTab === 'transfer' && (
          <motion.div key="transfer" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <div className="flex items-center gap-2 mb-1"><ArrowRightLeft size={16} className="text-purple-600" /><span className="text-sm font-black text-slate-800">Bulk Domain Transfer</span></div>
                <p className="text-xs text-slate-500 font-medium">Enter domains you want to transfer to Noehost, one per line</p>
              </div>
              <div className="p-5">
                <textarea value={transferInput} onChange={e => setTransferInput(e.target.value)} placeholder={"example.com\nmybusiness.pk\nmysite.net"} rows={6} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:border-purple-400 resize-none transition-colors" />
                <button onClick={handleTransferParse} disabled={!transferInput.trim()} className="mt-3 w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  <ArrowRightLeft size={18} /> Process Transfer List
                </button>
              </div>
              {transferList.length > 0 && (
                <div className="border-t border-slate-100">
                  <div className="px-5 py-3 bg-orange-50">
                    <span className="text-xs font-black text-orange-700 uppercase tracking-widest">{transferList.length} domain{transferList.length > 1 ? 's' : ''} queued for transfer</span>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                    {transferList.map((domain, i) => (
                      <div key={i} className="px-5 py-3.5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <RefreshCw size={14} className="text-orange-500 flex-shrink-0" />
                          <span className="text-sm font-black text-slate-800">{domain}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => window.location.href = `/client/domains/transfer?domain=${encodeURIComponent(domain)}`} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-black text-xs transition-all ${transferAdded.has(domain) ? 'bg-green-500 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white shadow-md'}`}>
                            {transferAdded.has(domain) ? <><Check size={12} />Done</> : <><ArrowRightLeft size={12} />Transfer</>}
                          </button>
                          <button onClick={() => setTransferList(prev => prev.filter((_, idx) => idx !== i))} className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-5 bg-slate-50 border-t border-slate-100">
                    <p className="text-xs text-slate-500 font-medium">💡 You'll need your domain's EPP/Auth code ready. Transfers typically complete in 5–7 days.</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* WHOIS Modal */}
      <AnimatePresence>
        {whoisDomain && <WhoisModal domain={whoisDomain} onClose={() => setWhoisDomain(null)} />}
      </AnimatePresence>
    </div>
  );
};

export default DomainChecker;
