import React, { useState, useRef, useEffect } from 'react';
import {
  Globe, Search, XCircle, Loader2, ShoppingCart, RefreshCw, Info,
  Calendar, Building2, Server, CheckCircle2, AlertCircle, Copy, ExternalLink,
  Layers, ArrowRightLeft, Check, Plus, Trash2, Tag, Square, CheckSquare,
  PackagePlus, KeyRound, CircleX, CircleCheck, ShoppingBag
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

  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [transferEppCodes, setTransferEppCodes] = useState<Record<string, string>>({});
  const [transferEppErrors, setTransferEppErrors] = useState<Set<string>>(new Set());
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferResults, setTransferResults] = useState<{domain: string; success: boolean; error?: string; invoiceNumber?: string; price?: number}[]>([]);

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

  const handleRegisterNow = (tld: string, price: number, baseName?: string) => {
    const name = baseName ?? searched;
    const domainFull = `${name}${tld}`;
    const finalPrice = isPkDomain(tld) ? 4000 : price;
    const period = isPkDomain(tld) ? 2 : 1;
    const params = new URLSearchParams({
      domain: domainFull,
      action: 'register',
      period: String(period),
      price: String(finalPrice),
    });
    window.location.href = `/order/domain?${params.toString()}`;
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

    // Check all domains in parallel — results arrive all at once
    const checkAll = domains.map(({ baseName, tld }, i) =>
      fetch(`/api/domains/availability?domain=${encodeURIComponent(baseName)}`)
        .then(r => r.json())
        .then(data => {
          const match = (data.results ?? []).find((r: TldResult) => r.tld === tld);
          return { i, checking: false, available: match?.available ?? null, price: match?.registrationPrice ?? 0, tld };
        })
        .catch(() => ({ i, checking: false, available: null as null, price: 0, tld }))
    );
    const settled = await Promise.all(checkAll);
    setBulkResults(prev => {
      const next = [...prev];
      settled.forEach(({ i, ...rest }) => { next[i] = { ...next[i], ...rest }; });
      return next;
    });
    setBulkSearching(false);
    // Auto-select all available domains
    const autoSelect = new Set(
      settled.filter(s => s.available === true && s.price > 0).map((s) => domains[s.i].domain)
    );
    setBulkSelected(autoSelect);
  };

  const addBulkToCart = async (r: BulkResult) => {
    if (!r.available || !r.price) return;
    const tld = r.tld ?? '';
    const finalPrice = isPkDomain(tld) ? 4000 : r.price;
    await addItem({
      type: 'domain', planId: `domain-${r.domain}`, name: r.domain,
      billingCycle: isPkDomain(tld) ? 'yearly' : 'yearly',
      monthlyPrice: finalPrice, quarterlyPrice: null, semiannualPrice: null,
      yearlyPrice: finalPrice, domainName: r.domain, tld,
    });
    setBulkResults(prev => prev.map(p => p.domain === r.domain ? { ...p, added: true } : p));
  };

  const selectAllAvailableBulk = () => {
    const available = bulkResults.filter(r => r.available && r.price && !r.checking).map(r => r.domain);
    if (bulkSelected.size === available.length) {
      setBulkSelected(new Set());
    } else {
      setBulkSelected(new Set(available));
    }
  };

  const addAllSelectedToCart = async () => {
    const toAdd = bulkResults.filter(r => r.available && r.price && !r.checking && bulkSelected.has(r.domain) && !r.added);
    if (!toAdd.length) return;
    for (const r of toAdd) {
      const tld = r.tld ?? '';
      const finalPrice = isPkDomain(tld) ? 4000 : r.price!;
      await addItem({
        type: 'domain', planId: `domain-${r.domain}`, name: r.domain,
        billingCycle: isPkDomain(tld) ? 'biennially' : 'yearly',
        monthlyPrice: finalPrice, quarterlyPrice: null, semiannualPrice: null,
        yearlyPrice: finalPrice, domainName: r.domain, tld,
      });
      setBulkResults(prev => prev.map(p => p.domain === r.domain ? { ...p, added: true } : p));
    }
    openCart();
  };

  const handleBulkTransferAll = async () => {
    const pending = transferList.filter(d => !transferResults.find(r => r.domain === d && r.success));
    const missing = new Set(pending.filter(d => !transferEppCodes[d]?.trim() || transferEppCodes[d].trim().length < 8));
    if (missing.size > 0) {
      setTransferEppErrors(missing);
      return;
    }
    setTransferEppErrors(new Set());

    localStorage.setItem('noehost_transfer_epps', JSON.stringify(transferEppCodes));

    setTransferSubmitting(true);
    for (const domain of pending) {
      const tld = '.' + domain.split('.').slice(1).join('.');
      await addItem({
        type: 'domain_transfer' as any,
        planId: `transfer-${domain}`,
        name: `Transfer: ${domain}`,
        billingCycle: 'yearly',
        monthlyPrice: 0,
        quarterlyPrice: null,
        semiannualPrice: null,
        yearlyPrice: 0,
        domainName: domain,
        tld,
        eppCode: transferEppCodes[domain]?.trim(),
      });
    }
    setTransferSubmitting(false);
    openCart();
  };

  const handleTransferParse = () => {
    setTransferResults([]);
    setTransferEppCodes({});
    setTransferEppErrors(new Set());
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
                            <Globe size={15} /> Register Now →
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
                                onClick={() => handleRegisterNow(primaryAvail.tld, primaryAvail.registrationPrice)}
                                className="flex items-center justify-center gap-2 w-full py-3 bg-white hover:bg-slate-100 border-2 border-purple-200 hover:border-purple-400 text-purple-700 rounded-xl font-black text-sm transition-all"
                              >
                                <Globe size={15} /> Register Bundle →
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
                                  <button onClick={() => handleRegisterNow(r.tld, r.registrationPrice)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-xs transition-all whitespace-nowrap bg-purple-600 hover:bg-purple-700 text-white shadow-sm">
                                    <Globe size={12} />Register
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
                <div className="border-t border-slate-100">
                  {/* Select All header bar */}
                  {bulkResults.some(r => r.available && r.price && !r.checking) && (
                    <div className="px-5 py-3 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
                      <button onClick={selectAllAvailableBulk} className="flex items-center gap-2 text-xs font-black text-purple-700 hover:text-purple-900 transition-colors">
                        {bulkSelected.size === bulkResults.filter(r => r.available && r.price && !r.checking).length
                          ? <><CheckSquare size={14} />Deselect All</>
                          : <><Square size={14} />Select All Available ({bulkResults.filter(r => r.available && r.price && !r.checking).length})</>
                        }
                      </button>
                      {bulkSelected.size > 0 && (
                        <span className="text-xs font-bold text-purple-600">{bulkSelected.size} selected</span>
                      )}
                    </div>
                  )}

                  <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                    {bulkResults.map((r, i) => {
                      const p = r.available && r.price ? getPriceDisplay(r.tld ?? '', r.price) : null;
                      const isSelected = bulkSelected.has(r.domain);
                      const canSelect = r.available === true && !!r.price && !r.checking;
                      return (
                        <div key={i} className={`px-5 py-3.5 flex items-center gap-3 transition-colors ${isSelected ? 'bg-purple-50/60' : 'hover:bg-slate-50'}`}>
                          {/* Checkbox */}
                          <div className="flex-shrink-0 w-5">
                            {canSelect ? (
                              <button onClick={() => setBulkSelected(prev => {
                                const next = new Set(prev);
                                if (next.has(r.domain)) next.delete(r.domain); else next.add(r.domain);
                                return next;
                              })} className="text-purple-600 hover:text-purple-800 transition-colors">
                                {isSelected ? <CheckSquare size={16} /> : <Square size={16} className="text-slate-300" />}
                              </button>
                            ) : (
                              r.checking
                                ? <Loader2 size={14} className="animate-spin text-slate-400" />
                                : <div className="w-2.5 h-2.5 rounded-full bg-red-300 mt-0.5 mx-auto" />
                            )}
                          </div>
                          {/* Domain info */}
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-black text-slate-800">{r.domain}</span>
                            {!r.checking && (
                              <div className={`text-xs font-semibold ${r.available === true ? 'text-green-600' : r.available === false ? 'text-red-500' : 'text-slate-400'}`}>
                                {r.available === true ? 'Available' : r.available === false ? 'Taken' : 'Unknown'}
                              </div>
                            )}
                          </div>
                          {/* Price + action */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {p && <span className="text-xs font-black text-slate-700 whitespace-nowrap">{p.label}{p.period}</span>}
                            {r.available && r.price && !r.checking && (
                              <button onClick={() => addBulkToCart(r)} disabled={r.added} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-black text-xs transition-all ${r.added ? 'bg-green-500 text-white' : 'bg-white border border-slate-200 hover:border-purple-400 hover:text-purple-700 text-slate-600'}`}>
                                {r.added ? <><Check size={11} />Added</> : <><Plus size={11} />Add</>}
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

                  {/* Add All Selected to Cart button */}
                  {bulkSelected.size > 0 && (
                    <div className="px-5 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-between gap-4">
                      <div className="text-white">
                        <div className="text-sm font-black">{bulkSelected.size} domain{bulkSelected.size > 1 ? 's' : ''} selected</div>
                        <div className="text-xs text-purple-200 font-medium">All will be added to your cart</div>
                      </div>
                      <button onClick={addAllSelectedToCart} className="flex items-center gap-2 px-5 py-2.5 bg-white text-purple-700 rounded-xl font-black text-sm hover:bg-purple-50 transition-all shadow-lg whitespace-nowrap">
                        <ShoppingBag size={15} />Add {bulkSelected.size} to Cart
                      </button>
                    </div>
                  )}
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
                  {/* Header */}
                  <div className="px-5 py-3 bg-orange-50 border-b border-orange-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <KeyRound size={14} className="text-orange-600" />
                      <span className="text-xs font-black text-orange-700 uppercase tracking-widest">{transferList.length} domain{transferList.length > 1 ? 's' : ''} — Enter EPP/Auth codes below</span>
                    </div>
                    <span className="text-xs text-orange-500 font-medium">Get codes from your current registrar</span>
                  </div>

                  {/* Domain rows with EPP inputs */}
                  <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                    {transferList.map((domain, i) => {
                      const result = transferResults.find(r => r.domain === domain);
                      const hasError = transferEppErrors.has(domain);
                      return (
                        <div key={i} className={`px-5 py-4 transition-colors ${result?.success ? 'bg-green-50' : result?.error ? 'bg-red-50/40' : ''}`}>
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {result?.success
                                ? <CircleCheck size={14} className="text-green-500 flex-shrink-0" />
                                : result?.error
                                  ? <CircleX size={14} className="text-red-500 flex-shrink-0" />
                                  : <RefreshCw size={14} className="text-orange-500 flex-shrink-0" />
                              }
                              <span className="text-sm font-black text-slate-800 truncate">{domain}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {result?.success && result.invoiceNumber && (
                                <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Invoice {result.invoiceNumber}</span>
                              )}
                              {!result?.success && (
                                <button onClick={() => setTransferList(prev => prev.filter((_, idx) => idx !== i))} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all"><Trash2 size={12} /></button>
                              )}
                            </div>
                          </div>

                          {result?.success ? (
                            <p className="text-xs text-green-700 font-semibold ml-5">✓ Transfer initiated. You'll receive an email confirmation shortly.</p>
                          ) : result?.error ? (
                            <p className="text-xs text-red-600 font-semibold ml-5">{result.error}</p>
                          ) : (
                            <div className="ml-5">
                              <input
                                type="text"
                                placeholder="EPP/Auth code (min. 8 chars, letters + numbers)"
                                value={transferEppCodes[domain] ?? ''}
                                onChange={e => {
                                  setTransferEppCodes(prev => ({ ...prev, [domain]: e.target.value }));
                                  if (transferEppErrors.has(domain)) setTransferEppErrors(prev => { const n = new Set(prev); n.delete(domain); return n; });
                                }}
                                className={`w-full text-xs font-mono bg-white border rounded-xl px-3 py-2 focus:outline-none transition-colors placeholder:text-slate-400 ${hasError ? 'border-red-400 bg-red-50 focus:border-red-500' : 'border-slate-200 focus:border-orange-400'}`}
                              />
                              {hasError && <p className="text-xs text-red-500 font-semibold mt-1">EPP code must be at least 8 characters (letters + numbers)</p>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Transfer All button or Success summary */}
                  {transferResults.length > 0 && transferResults.every(r => r.success) ? (
                    <div className="p-5 bg-green-50 border-t border-green-100 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-black text-green-700">All {transferResults.length} transfers initiated!</div>
                        <div className="text-xs text-green-600 font-medium">Check your email for confirmation. Transfers take 5–7 days.</div>
                      </div>
                      <button onClick={() => window.location.href = '/client/domains'} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-black text-xs hover:bg-green-700 transition-all">
                        <ArrowRightLeft size={13} />View Transfers
                      </button>
                    </div>
                  ) : (
                    <div className="p-5 border-t border-slate-100 bg-slate-50">
                      <div className="flex items-center gap-2 mb-3 text-xs text-slate-500 font-medium">
                        <Info size={12} className="text-slate-400" />
                        Get your EPP/auth code from your current registrar's domain settings. Transfers take 5–7 days.
                      </div>
                      <button
                        onClick={handleBulkTransferAll}
                        disabled={transferSubmitting || transferList.every(d => transferResults.find(r => r.domain === d && r.success))}
                        className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-orange-500/20"
                      >
                        {transferSubmitting
                          ? <><Loader2 size={16} className="animate-spin" />Adding to cart...</>
                          : <><ShoppingCart size={16} />Add {transferList.filter(d => !transferResults.find(r => r.domain === d && r.success)).length} Transfer{transferList.filter(d => !transferResults.find(r => r.domain === d && r.success)).length > 1 ? 's' : ''} to Cart</>
                        }
                      </button>
                    </div>
                  )}
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
