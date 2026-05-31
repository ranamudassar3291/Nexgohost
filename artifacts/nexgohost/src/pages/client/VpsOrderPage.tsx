import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  ArrowLeft, Check, ChevronRight, Shield, Server,
  HardDrive, Cpu, Wifi, Lock, Eye, EyeOff,
  RefreshCw, AlertCircle, Loader2, CheckCircle, ShoppingCart, Zap
} from 'lucide-react';
import { useCurrency } from '@/context/CurrencyProvider';

// ── OS brand config ────────────────────────────────────────────────────────────
const OS_META: Record<string, { color: string; bg: string; letter: string; textColor: string }> = {
  Ubuntu:           { color: '#E95420', bg: '#FFF3EF', letter: 'U', textColor: '#fff' },
  Debian:           { color: '#D70A53', bg: '#FFF0F5', letter: 'D', textColor: '#fff' },
  AlmaLinux:        { color: '#2962A0', bg: '#EFF5FF', letter: 'A', textColor: '#fff' },
  'Rocky Linux':    { color: '#10B981', bg: '#ECFDF5', letter: 'R', textColor: '#fff' },
  CentOS:           { color: '#932279', bg: '#FFF0FC', letter: 'C', textColor: '#fff' },
  Fedora:           { color: '#3C6EB4', bg: '#EFF5FF', letter: 'F', textColor: '#fff' },
  'Oracle Linux':   { color: '#C74634', bg: '#FFF5F5', letter: 'O', textColor: '#fff' },
  'Kali Linux':     { color: '#268BEE', bg: '#EFF8FF', letter: 'K', textColor: '#fff' },
  FreeBSD:          { color: '#AE1D2A', bg: '#FFF5F5', letter: 'B', textColor: '#fff' },
  OpenSUSE:         { color: '#73BA25', bg: '#F5FFF0', letter: 'S', textColor: '#fff' },
  'Windows Server': { color: '#0078D4', bg: '#EFF8FF', letter: 'W', textColor: '#fff' },
};

// ── Country flag emoji ─────────────────────────────────────────────────────────
const FLAGS: Record<string, string> = {
  US: '🇺🇸', GB: '🇬🇧', DE: '🇩🇪', SG: '🇸🇬', FR: '🇫🇷',
  NL: '🇳🇱', IN: '🇮🇳', JP: '🇯🇵', CA: '🇨🇦', AU: '🇦🇺',
  TR: '🇹🇷', BR: '🇧🇷', PL: '🇵🇱', PK: '🇵🇰',
};

// ── Constants ─────────────────────────────────────────────────────────────────
const BACKUP_PRICE_PKR = 299;
const CYCLE_MONTHS: Record<string, number> = {
  monthly: 1, quarterly: 3, semiannual: 6, yearly: 12, biennial: 24
};
const CYCLE_LABELS: Record<string, string> = {
  monthly: '1 Month', quarterly: '3 Months', semiannual: '6 Months', yearly: '1 Year', biennial: '2 Years'
};

interface VpsPlan {
  id: string; name: string; description?: string;
  price: number; quarterlyPrice?: number; semiannualPrice?: number;
  yearlyPrice?: number; biennialPrice?: number;
  cpuCores: number; ramGb: number; storageGb: number; bandwidthTb?: number;
  features?: string[];
}
interface OsTemplate { id: string; name: string; version: string; imageId?: string; iconUrl?: string; }
interface Location { id: string; countryName: string; countryCode: string; city?: string; networkSpeed?: string; latencyMs?: number; }

// ── OS Icon Component ─────────────────────────────────────────────────────────
function OsIcon({ name, size = 40 }: { name: string; size?: number }) {
  const meta = OS_META[name] ?? { color: '#6B7280', bg: '#F3F4F6', letter: name[0], textColor: '#fff' };
  if (name === 'Ubuntu') {
    return (
      <div style={{ width: size, height: size, background: meta.color, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4" fill="white" fillOpacity="0.9"/>
          <circle cx="12" cy="3" r="2.5" fill="white"/>
          <circle cx="20.8" cy="16.5" r="2.5" fill="white"/>
          <circle cx="3.2" cy="16.5" r="2.5" fill="white"/>
          <line x1="12" y1="8" x2="12" y2="5.5" stroke="white" strokeWidth="1.5"/>
          <line x1="15.5" y1="14" x2="18.5" y2="14.8" stroke="white" strokeWidth="1.5"/>
          <line x1="8.5" y1="14" x2="5.5" y2="14.8" stroke="white" strokeWidth="1.5"/>
        </svg>
      </div>
    );
  }
  if (name === 'Windows Server') {
    return (
      <div style={{ width: size, height: size, background: meta.color, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
        <svg viewBox="0 0 24 24" fill="white">
          <path d="M3 5.557L9.624 4.7v6.124H3V5.557zM10.376 4.59L21 3v7.824H10.376V4.59zM3 11.476h6.624V17.6L3 16.743V11.476zM10.376 11.476H21V21l-10.624-1.6V11.476z"/>
        </svg>
      </div>
    );
  }
  if (name === 'Debian') {
    return (
      <div style={{ width: size, height: size, background: meta.color, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={size * 0.65} height={size * 0.65} viewBox="0 0 24 24" fill="white">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm-1-5.5c-1.93 0-3.5-1.57-3.5-3.5S9.07 7.5 11 7.5c.96 0 1.82.4 2.45 1.04L12.3 9.68C11.98 9.26 11.52 9 11 9c-1.1 0-2 .9-2 2s.9 2 2 2c.52 0 .98-.26 1.3-.68l1.15 1.14C12.82 14.1 11.96 14.5 11 14.5z"/>
        </svg>
      </div>
    );
  }
  return (
    <div style={{ width: size, height: size, background: meta.color, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: meta.textColor, fontWeight: 800, fontSize: size * 0.42, fontFamily: 'monospace' }}>{meta.letter}</span>
    </div>
  );
}

// ── Password Strength ─────────────────────────────────────────────────────────
function passwordStrength(p: string): { label: string; color: string; pct: number } {
  if (!p) return { label: '', color: '#E5E7EB', pct: 0 };
  let score = 0;
  if (p.length >= 8) score++;
  if (p.length >= 12) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  if (score <= 1) return { label: 'Weak', color: '#EF4444', pct: 25 };
  if (score <= 2) return { label: 'Fair', color: '#F59E0B', pct: 50 };
  if (score <= 3) return { label: 'Good', color: '#3B82F6', pct: 75 };
  return { label: 'Strong', color: '#10B981', pct: 100 };
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function VpsOrderPage() {
  const { planId } = useParams<{ planId: string }>();
  const [, setLocation] = useLocation();
  const { formatPrice } = useCurrency();

  // Data state
  const [plan, setPlan]           = useState<VpsPlan | null>(null);
  const [osTemplates, setOsTemplates] = useState<OsTemplate[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  // Configuration state
  const [selectedOs, setSelectedOs]           = useState<OsTemplate | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [hostname, setHostname]               = useState('');
  const [rootPassword, setRootPassword]       = useState('');
  const [showPassword, setShowPassword]       = useState(false);
  const [dailyBackup, setDailyBackup]         = useState(false);
  const [billingCycle, setBillingCycle]       = useState<string>('monthly');

  // Order state
  const [ordering, setOrdering]   = useState(false);
  const [orderError, setOrderError] = useState('');
  const [success, setSuccess]     = useState(false);
  const [invoiceId, setInvoiceId] = useState('');

  // Form validation errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const sidebarRef = useRef<HTMLDivElement>(null);

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!planId) { setError('No plan specified'); setLoading(false); return; }

    Promise.all([
      fetch(`/api/vps-plans`).then(r => r.json()),
      fetch(`/api/vps-os-templates`).then(r => r.json()),
      fetch(`/api/vps-locations`).then(r => r.json()),
    ]).then(([plans, os, locs]) => {
      const found = (plans as VpsPlan[]).find(p => p.id === planId);
      if (!found) { setError('Plan not found'); setLoading(false); return; }
      setPlan(found);

      // Deduplicate OS by name+version
      const seen = new Set<string>();
      const unique = (os as OsTemplate[]).filter(t => {
        const k = `${t.name}|||${t.version}`;
        if (seen.has(k)) return false;
        seen.add(k); return true;
      });
      setOsTemplates(unique);
      // Default: Ubuntu 22.04 LTS
      const defaultOs = unique.find(t => t.name === 'Ubuntu' && t.version.includes('22')) ?? unique[0] ?? null;
      setSelectedOs(defaultOs);

      // Prefer locations with city
      const withCity = (locs as Location[]).filter(l => l.city && l.city.trim());
      const allLocs = withCity.length > 0 ? withCity : (locs as Location[]);
      setLocations(allLocs);
      // Default: lowest latency
      const sorted = [...allLocs].sort((a, b) => (a.latencyMs ?? 999) - (b.latencyMs ?? 999));
      setSelectedLocation(sorted[0] ?? null);

      // Default hostname from plan
      const slug = found.name.toLowerCase().replace(/\s+/g, '-');
      setHostname(`${slug}-server`);

      // Default billing cycle: monthly, or yearly if plan has yearly price
      setBillingCycle('monthly');

      setLoading(false);
    }).catch(() => { setError('Failed to load plan details'); setLoading(false); });
  }, [planId]);

  // ── Restore pending config from localStorage (after login redirect) ──────────
  useEffect(() => {
    const saved = localStorage.getItem('pending_vps_order');
    if (saved) {
      try {
        const cfg = JSON.parse(saved);
        if (cfg.planId === planId) {
          if (cfg.osId) {
            // Will be applied once templates are loaded
            setTimeout(() => {
              setOsTemplates(prev => {
                const found = prev.find(t => t.id === cfg.osId);
                if (found) setSelectedOs(found);
                return prev;
              });
              setLocations(prev => {
                const found = prev.find(l => l.id === cfg.locationId);
                if (found) setSelectedLocation(found);
                return prev;
              });
            }, 500);
          }
          if (cfg.hostname) setHostname(cfg.hostname);
          if (cfg.dailyBackup) setDailyBackup(cfg.dailyBackup);
          if (cfg.billingCycle) setBillingCycle(cfg.billingCycle);
        }
      } catch {}
    }
  }, [planId]);

  // ── Price calculations ─────────────────────────────────────────────────────
  const getCyclePrice = (): number => {
    if (!plan) return 0;
    const m = CYCLE_MONTHS[billingCycle] ?? 1;
    let base = plan.price;
    if (billingCycle === 'quarterly' && plan.quarterlyPrice) base = plan.quarterlyPrice / 3;
    else if (billingCycle === 'semiannual' && plan.semiannualPrice) base = plan.semiannualPrice / 6;
    else if (billingCycle === 'yearly' && plan.yearlyPrice) base = plan.yearlyPrice / 12;
    else if (billingCycle === 'biennial' && plan.biennialPrice) base = (plan.biennialPrice as number) / 24;
    return base;
  };

  const monthlyPrice = getCyclePrice();
  const backupMonthly = dailyBackup ? BACKUP_PRICE_PKR : 0;
  const totalMonthly = monthlyPrice + backupMonthly;
  const cycleMonths = CYCLE_MONTHS[billingCycle] ?? 1;
  const totalCycleAmount = totalMonthly * cycleMonths;
  const regularMonthly = plan?.price ?? 0;
  const savePercent = billingCycle !== 'monthly' && regularMonthly > 0
    ? Math.max(0, Math.round((1 - monthlyPrice / regularMonthly) * 100))
    : 0;

  // Available billing cycles based on plan
  const availableCycles = (['monthly', 'quarterly', 'semiannual', 'yearly', 'biennial'] as const).filter(c => {
    if (c === 'monthly') return true;
    if (c === 'quarterly') return !!plan?.quarterlyPrice;
    if (c === 'semiannual') return !!plan?.semiannualPrice;
    if (c === 'yearly') return !!plan?.yearlyPrice;
    if (c === 'biennial') return !!(plan as any)?.biennialPrice;
    return false;
  });

  // ── Submit handler ─────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const errors: Record<string, string> = {};
    if (!selectedOs) errors.os = 'Please select an operating system';
    if (!selectedLocation) errors.location = 'Please select a data center location';
    if (!hostname.trim()) errors.hostname = 'Hostname is required';
    if (!rootPassword || rootPassword.length < 8) errors.rootPassword = 'Password must be at least 8 characters';

    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setFormErrors({});
    setOrderError('');

    const token = localStorage.getItem('token') || localStorage.getItem('noehost_token');
    const config = {
      planId, osId: selectedOs!.id, osName: `${selectedOs!.name} ${selectedOs!.version}`,
      locationId: selectedLocation!.id, locationName: `${selectedLocation!.countryName}${selectedLocation!.city ? ' - ' + selectedLocation!.city : ''}`,
      hostname: hostname.trim(), dailyBackup, billingCycle,
    };

    if (!token) {
      localStorage.setItem('pending_vps_order', JSON.stringify(config));
      window.location.href = `/client/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    setOrdering(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          vpsPlanId: planId,
          vpsOsTemplate: `${selectedOs!.name} ${selectedOs!.version}`,
          vpsLocation: config.locationName,
          vpsHostname: hostname.trim(),
          vpsRootPassword: rootPassword,
          vpsImageId: selectedOs!.imageId ?? null,
          vpsWeeklyBackups: dailyBackup,
          billingCycle,
          vpsBackupAddon: dailyBackup,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setOrderError(data.error ?? 'Order failed. Please try again.'); setOrdering(false); return; }
      localStorage.removeItem('pending_vps_order');
      setSuccess(true);
      setInvoiceId(data.invoiceId);
    } catch {
      setOrderError('Network error. Please try again.');
      setOrdering(false);
    }
  };

  // ── OS groups ─────────────────────────────────────────────────────────────
  const linuxOS  = osTemplates.filter(t => t.name !== 'Windows Server' && t.name !== 'FreeBSD');
  const otherOS  = osTemplates.filter(t => t.name === 'Windows Server' || t.name === 'FreeBSD');

  // ── Loading / Error states ─────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="animate-spin mx-auto mb-3 text-indigo-600" size={36}/>
        <p className="text-gray-500 font-medium">Loading plan details…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="mx-auto mb-3 text-red-500" size={36}/>
        <p className="text-gray-700 font-semibold mb-4">{error}</p>
        <button onClick={() => setLocation('/vps-hosting')} className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700">
          ← Back to Plans
        </button>
      </div>
    </div>
  );

  // ── Success state ─────────────────────────────────────────────────────────
  if (success) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="text-emerald-600" size={36}/>
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">Order Placed! 🎉</h2>
        <p className="text-gray-500 mb-1">Your VPS <span className="font-bold text-gray-800">{plan?.name}</span> is being provisioned.</p>
        <p className="text-gray-400 text-sm mb-8">You'll receive login credentials by email once your server is activated.</p>
        <div className="space-y-3">
          {invoiceId && (
            <button onClick={() => setLocation(`/client/invoices/${invoiceId}`)}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors">
              View Invoice
            </button>
          )}
          <button onClick={() => setLocation('/client/dashboard')}
            className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors">
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: '#F7F8FA' }}>

      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setLocation('/vps-hosting')}
              className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 text-sm font-medium transition-colors">
              <ArrowLeft size={15}/> Back to Plans
            </button>
            <div className="h-5 w-px bg-gray-200"/>
            <div className="flex items-center gap-2">
              <Server size={16} className="text-indigo-600"/>
              <span className="font-bold text-gray-900 text-sm">Configure {plan?.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Shield size={13} className="text-emerald-500"/>
            <span>Secure Checkout</span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-0.5 bg-gray-100">
          <div className="h-full bg-indigo-600 transition-all duration-500" style={{ width: '33%' }}/>
        </div>
      </div>

      {/* ── Progress steps ───────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2 text-xs font-semibold">
          <div className="flex items-center gap-1.5 text-indigo-600">
            <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px]">1</span>
            <span>Configure</span>
          </div>
          <ChevronRight size={13} className="text-gray-300"/>
          <div className="flex items-center gap-1.5 text-gray-400">
            <span className="w-5 h-5 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center text-[10px]">2</span>
            <span>Review & Pay</span>
          </div>
          <ChevronRight size={13} className="text-gray-300"/>
          <div className="flex items-center gap-1.5 text-gray-400">
            <span className="w-5 h-5 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center text-[10px]">3</span>
            <span>Complete</span>
          </div>
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">

          {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
          <div className="space-y-5">

            {/* ── 1. Plan Summary ─────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <Server size={18} className="text-indigo-600"/>
                  </div>
                  <div>
                    <h2 className="font-black text-gray-900 text-base">{plan?.name}</h2>
                    <p className="text-xs text-gray-400">Cloud VPS Hosting</p>
                  </div>
                </div>
                <button onClick={() => setLocation('/vps-hosting')}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold hover:underline">
                  Change Plan
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { icon: <Cpu size={13}/>, label: `${plan?.cpuCores} vCPU` },
                  { icon: <HardDrive size={13}/>, label: `${plan?.ramGb} GB RAM` },
                  { icon: <HardDrive size={13}/>, label: `${plan?.storageGb} GB NVMe` },
                  { icon: <Wifi size={13}/>, label: plan?.bandwidthTb ? `${plan.bandwidthTb} TB` : 'Unmetered' },
                ].map(({ icon, label }) => (
                  <span key={label} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700">
                    {icon} {label}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-lg text-xs font-semibold text-indigo-700">
                  <Zap size={12}/> KVM Virtualization
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg text-xs font-semibold text-emerald-700">
                  <Shield size={12}/> DDoS Protection
                </span>
              </div>
            </div>

            {/* ── 2. Operating System ─────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-black text-gray-900 text-base mb-1">Select Operating System</h3>
              <p className="text-xs text-gray-400 mb-5">Choose your preferred Linux distribution or Windows</p>

              {formErrors.os && (
                <div className="mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  <AlertCircle size={14}/> {formErrors.os}
                </div>
              )}

              {/* Linux */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-gray-400">Linux</span>
                  <div className="flex-1 h-px bg-gray-100"/>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {linuxOS.map(os => {
                    const selected = selectedOs?.id === os.id;
                    return (
                      <button key={os.id} onClick={() => { setSelectedOs(os); setFormErrors(prev => ({ ...prev, os: '' })); }}
                        className={`relative flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                          selected
                            ? 'border-indigo-500 bg-indigo-50 shadow-sm shadow-indigo-100'
                            : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
                        }`}>
                        {selected && (
                          <div className="absolute top-2 right-2 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center">
                            <Check size={9} className="text-white"/>
                          </div>
                        )}
                        <OsIcon name={os.name} size={36}/>
                        <div className="min-w-0">
                          <div className={`font-bold text-sm truncate ${selected ? 'text-indigo-900' : 'text-gray-800'}`}>{os.name}</div>
                          <div className="text-xs text-gray-400 truncate">{os.version}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Windows / Other */}
              {otherOS.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-black uppercase tracking-wider text-gray-400">Windows & Other</span>
                    <div className="flex-1 h-px bg-gray-100"/>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {otherOS.map(os => {
                      const selected = selectedOs?.id === os.id;
                      return (
                        <button key={os.id} onClick={() => { setSelectedOs(os); setFormErrors(prev => ({ ...prev, os: '' })); }}
                          className={`relative flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                            selected
                              ? 'border-indigo-500 bg-indigo-50 shadow-sm shadow-indigo-100'
                              : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
                          }`}>
                          {selected && (
                            <div className="absolute top-2 right-2 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center">
                              <Check size={9} className="text-white"/>
                            </div>
                          )}
                          <OsIcon name={os.name} size={36}/>
                          <div className="min-w-0">
                            <div className={`font-bold text-sm truncate ${selected ? 'text-indigo-900' : 'text-gray-800'}`}>{os.name}</div>
                            <div className="text-xs text-gray-400 truncate">{os.version}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ── 3. Data Center Location ──────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-black text-gray-900 text-base mb-1">Select Data Center Location</h3>
              <p className="text-xs text-gray-400 mb-5">Choose a location closest to your users for best performance</p>

              {formErrors.location && (
                <div className="mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  <AlertCircle size={14}/> {formErrors.location}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {locations.map(loc => {
                  const selected = selectedLocation?.id === loc.id;
                  const flag = FLAGS[loc.countryCode] ?? '🌐';
                  const latency = loc.latencyMs ?? null;
                  const speed = loc.networkSpeed ?? '1 Gbps';
                  return (
                    <button key={loc.id} onClick={() => { setSelectedLocation(loc); setFormErrors(prev => ({ ...prev, location: '' })); }}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                        selected
                          ? 'border-indigo-500 bg-indigo-50 shadow-sm shadow-indigo-100'
                          : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
                      }`}>
                      <span className="text-2xl flex-shrink-0 leading-none">{flag}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`font-bold text-sm ${selected ? 'text-indigo-900' : 'text-gray-800'}`}>
                          {loc.countryName}{loc.city ? ` — ${loc.city}` : ''}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400">{speed}</span>
                          {latency && (
                            <>
                              <span className="text-gray-300">·</span>
                              <span className={`text-xs font-semibold ${latency < 20 ? 'text-emerald-600' : latency < 60 ? 'text-amber-600' : 'text-red-500'}`}>
                                ~{latency}ms
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {selected && (
                        <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <Check size={10} className="text-white"/>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── 4. Server Details ────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-black text-gray-900 text-base mb-1">Server Details</h3>
              <p className="text-xs text-gray-400 mb-5">Set your server hostname and root password</p>

              <div className="space-y-4">
                {/* Hostname */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    Hostname <span className="text-gray-400 font-normal">(e.g. myserver.example.com)</span>
                  </label>
                  <div className="relative">
                    <Server size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                    <input
                      type="text" value={hostname}
                      onChange={e => { setHostname(e.target.value); setFormErrors(prev => ({ ...prev, hostname: '' })); }}
                      placeholder="my-vps-server"
                      className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                        formErrors.hostname ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white hover:border-gray-400'
                      }`}
                    />
                  </div>
                  {formErrors.hostname && <p className="text-xs text-red-500 mt-1">{formErrors.hostname}</p>}
                </div>

                {/* Root Password */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Root Password</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                    <input
                      type={showPassword ? 'text' : 'password'} value={rootPassword}
                      onChange={e => { setRootPassword(e.target.value); setFormErrors(prev => ({ ...prev, rootPassword: '' })); }}
                      placeholder="Min. 8 characters, uppercase, number"
                      className={`w-full pl-9 pr-10 py-2.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                        formErrors.rootPassword ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white hover:border-gray-400'
                      }`}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff size={15}/> : <Eye size={15}/>}
                    </button>
                  </div>
                  {/* Strength meter */}
                  {rootPassword && (() => {
                    const str = passwordStrength(rootPassword);
                    return (
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex gap-1">
                            {[25, 50, 75, 100].map(v => (
                              <div key={v} className="h-1 w-10 rounded-full transition-all"
                                style={{ background: str.pct >= v ? str.color : '#E5E7EB' }}/>
                            ))}
                          </div>
                          <span className="text-xs font-semibold" style={{ color: str.color }}>{str.label}</span>
                        </div>
                      </div>
                    );
                  })()}
                  {formErrors.rootPassword && <p className="text-xs text-red-500 mt-1">{formErrors.rootPassword}</p>}
                  <p className="text-xs text-gray-400 mt-1.5">Use uppercase, numbers, and symbols for a strong password.</p>
                </div>
              </div>
            </div>

            {/* ── 5. Add-ons ──────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-black text-gray-900 text-base mb-1">Add-ons</h3>
              <p className="text-xs text-gray-400 mb-5">Enhance your VPS with additional services</p>

              {/* Daily Backup */}
              <button onClick={() => setDailyBackup(!dailyBackup)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                  dailyBackup
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-indigo-300 bg-white'
                }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${dailyBackup ? 'bg-indigo-600' : 'bg-gray-100'}`}>
                  <RefreshCw size={18} className={dailyBackup ? 'text-white' : 'text-gray-500'}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`font-bold text-sm ${dailyBackup ? 'text-indigo-900' : 'text-gray-800'}`}>Daily Automatic Backups</span>
                    <span className="text-[10px] font-black px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">RECOMMENDED</span>
                  </div>
                  <p className="text-xs text-gray-400">Automatic daily snapshots stored for 7 days. One-click restore anytime.</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`font-black text-sm ${dailyBackup ? 'text-indigo-700' : 'text-gray-700'}`}>
                    +{formatPrice(BACKUP_PRICE_PKR)}<span className="font-normal text-xs">/mo</span>
                  </div>
                  <div className={`w-10 h-5 rounded-full transition-all flex items-center mt-1.5 ml-auto ${dailyBackup ? 'bg-indigo-600 justify-end' : 'bg-gray-200 justify-start'}`}>
                    <div className="w-4 h-4 bg-white rounded-full shadow-sm mx-0.5"/>
                  </div>
                </div>
              </button>
            </div>

          </div>

          {/* ── RIGHT SIDEBAR ────────────────────────────────────────────────── */}
          <div className="lg:sticky lg:top-24" ref={sidebarRef}>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

              {/* Sidebar header */}
              <div className="px-5 pt-5 pb-4 border-b border-gray-100">
                <h3 className="font-black text-gray-900 text-base mb-0.5">Order Summary</h3>
                <p className="text-xs text-gray-400">{plan?.name} — Cloud VPS Hosting</p>
              </div>

              <div className="p-5 space-y-5">

                {/* Billing cycle selector */}
                <div>
                  <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2.5">Billing Period</p>
                  <div className="space-y-2">
                    {availableCycles.map(cycle => {
                      let cycleMonthlyPrice = plan?.price ?? 0;
                      if (cycle === 'quarterly' && plan?.quarterlyPrice) cycleMonthlyPrice = plan.quarterlyPrice / 3;
                      else if (cycle === 'semiannual' && plan?.semiannualPrice) cycleMonthlyPrice = plan.semiannualPrice / 6;
                      else if (cycle === 'yearly' && plan?.yearlyPrice) cycleMonthlyPrice = plan.yearlyPrice / 12;
                      else if (cycle === 'biennial' && (plan as any)?.biennialPrice) cycleMonthlyPrice = (plan as any).biennialPrice / 24;

                      const savePct = cycle !== 'monthly' && plan?.price && cycleMonthlyPrice < plan.price
                        ? Math.round((1 - cycleMonthlyPrice / plan.price) * 100) : 0;

                      return (
                        <button key={cycle} onClick={() => setBillingCycle(cycle)}
                          className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl border-2 transition-all ${
                            billingCycle === cycle
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}>
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              billingCycle === cycle ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'
                            }`}>
                              {billingCycle === cycle && <div className="w-1.5 h-1.5 bg-white rounded-full"/>}
                            </div>
                            <span className={`text-sm font-bold ${billingCycle === cycle ? 'text-indigo-900' : 'text-gray-700'}`}>
                              {CYCLE_LABELS[cycle]}
                            </span>
                            {savePct > 0 && (
                              <span className="text-[10px] font-black px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                                -{savePct}%
                              </span>
                            )}
                          </div>
                          <span className={`text-sm font-black ${billingCycle === cycle ? 'text-indigo-700' : 'text-gray-600'}`}>
                            {formatPrice(cycleMonthlyPrice)}<span className="text-xs font-normal">/mo</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Price breakdown */}
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">Price Breakdown</p>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{plan?.name} <span className="text-gray-400 text-xs">×{cycleMonths} mo</span></span>
                      <span className="font-bold text-gray-800">{formatPrice(monthlyPrice * cycleMonths)}</span>
                    </div>
                    {savePercent > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-emerald-600">Discount ({savePercent}% off)</span>
                        <span className="font-bold text-emerald-600">
                          -{formatPrice((regularMonthly - monthlyPrice) * cycleMonths)}
                        </span>
                      </div>
                    )}
                    {dailyBackup && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Daily Backups <span className="text-gray-400 text-xs">×{cycleMonths} mo</span></span>
                        <span className="font-bold text-gray-800">{formatPrice(BACKUP_PRICE_PKR * cycleMonths)}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 pt-2.5 mt-2.5 flex items-center justify-between">
                      <span className="font-black text-gray-900 text-base">Total</span>
                      <div className="text-right">
                        <div className="font-black text-indigo-700 text-xl">{formatPrice(totalCycleAmount)}</div>
                        <div className="text-xs text-gray-400">
                          {billingCycle !== 'monthly' ? `(${formatPrice(totalMonthly)}/mo)` : 'per month'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CTA button */}
                {orderError && (
                  <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2.5">
                    <AlertCircle size={14} className="mt-0.5 flex-shrink-0"/>
                    <span>{orderError}</span>
                  </div>
                )}

                <button onClick={handleSubmit} disabled={ordering}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 active:scale-[0.98]">
                  {ordering
                    ? <><Loader2 size={16} className="animate-spin"/> Processing…</>
                    : <><ShoppingCart size={15}/> Add to Cart</>
                  }
                </button>

                {/* Trust badges */}
                <div className="space-y-2 pt-1">
                  {[
                    { icon: <Shield size={13}/>, text: '30-day money-back guarantee', color: 'text-emerald-600' },
                    { icon: <Check size={13}/>, text: '99.9% uptime SLA', color: 'text-blue-600' },
                    { icon: <Zap size={13}/>, text: 'Instant server deployment', color: 'text-amber-600' },
                    { icon: <Lock size={13}/>, text: 'Free DDoS protection included', color: 'text-purple-600' },
                  ].map(({ icon, text, color }) => (
                    <div key={text} className={`flex items-center gap-2 text-xs ${color} font-medium`}>
                      {icon} {text}
                    </div>
                  ))}
                </div>

                {/* Selected config summary */}
                {(selectedOs || selectedLocation) && (
                  <div className="border-t border-gray-100 pt-4 space-y-2">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Configuration</p>
                    {selectedOs && (
                      <div className="flex items-center gap-2">
                        <OsIcon name={selectedOs.name} size={22}/>
                        <span className="text-xs text-gray-600 font-medium">{selectedOs.name} {selectedOs.version}</span>
                      </div>
                    )}
                    {selectedLocation && (
                      <div className="flex items-center gap-2">
                        <span className="text-base leading-none">{FLAGS[selectedLocation.countryCode] ?? '🌐'}</span>
                        <span className="text-xs text-gray-600 font-medium">
                          {selectedLocation.countryName}{selectedLocation.city ? ` — ${selectedLocation.city}` : ''}
                        </span>
                        {selectedLocation.latencyMs && (
                          <span className={`text-[10px] font-bold ml-auto ${selectedLocation.latencyMs < 20 ? 'text-emerald-600' : selectedLocation.latencyMs < 60 ? 'text-amber-600' : 'text-gray-400'}`}>
                            ~{selectedLocation.latencyMs}ms
                          </span>
                        )}
                      </div>
                    )}
                    {hostname && (
                      <div className="flex items-center gap-2">
                        <Server size={14} className="text-gray-400 flex-shrink-0"/>
                        <span className="text-xs text-gray-600 font-medium truncate">{hostname}</span>
                      </div>
                    )}
                    {dailyBackup && (
                      <div className="flex items-center gap-2">
                        <RefreshCw size={14} className="text-indigo-500 flex-shrink-0"/>
                        <span className="text-xs text-indigo-600 font-medium">Daily Backups enabled</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
