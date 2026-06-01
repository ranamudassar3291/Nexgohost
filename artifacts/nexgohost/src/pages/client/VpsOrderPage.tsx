import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  ArrowLeft, Check, Shield, Server,
  HardDrive, Cpu, Wifi, Lock, Eye, EyeOff,
  RefreshCw, AlertCircle, Loader2, CheckCircle, ShoppingCart, Zap, Star,
  Tag, Wallet, CreditCard, ChevronRight, Globe, Gift
} from 'lucide-react';
import { useCurrency } from '@/context/CurrencyProvider';

const OS_META: Record<string, { color: string; letter: string }> = {
  Ubuntu:           { color: '#E95420', letter: 'U' },
  Debian:           { color: '#D70A53', letter: 'D' },
  AlmaLinux:        { color: '#2962A0', letter: 'A' },
  'Rocky Linux':    { color: '#10B981', letter: 'R' },
  CentOS:           { color: '#932279', letter: 'C' },
  Fedora:           { color: '#3C6EB4', letter: 'F' },
  'Oracle Linux':   { color: '#C74634', letter: 'O' },
  'Kali Linux':     { color: '#268BEE', letter: 'K' },
  FreeBSD:          { color: '#AE1D2A', letter: 'B' },
  OpenSUSE:         { color: '#73BA25', letter: 'S' },
  'Windows Server': { color: '#0078D4', letter: 'W' },
  n8n:              { color: '#EA4B71', letter: 'n' },
};

const FLAGS: Record<string, string> = {
  US: '🇺🇸', GB: '🇬🇧', DE: '🇩🇪', SG: '🇸🇬', FR: '🇫🇷',
  NL: '🇳🇱', IN: '🇮🇳', JP: '🇯🇵', CA: '🇨🇦', AU: '🇦🇺',
  TR: '🇹🇷', BR: '🇧🇷', PL: '🇵🇱', PK: '🇵🇰',
};

const BACKUP_PRICE_PKR = 299;
const CYCLE_MONTHS: Record<string, number> = {
  monthly: 1, quarterly: 3, semiannual: 6, yearly: 12, biennial: 24
};
const CYCLE_LABELS: Record<string, string> = {
  monthly: '1 Month', quarterly: '3 Months', semiannual: '6 Months', yearly: '1 Year', biennial: '2 Years'
};
const VPS_CONFIG_KEY = 'pending_vps_order';

interface VpsPlan {
  id: string; name: string; description?: string;
  price: number; quarterlyPrice?: number; semiannualPrice?: number;
  yearlyPrice?: number; biennialPrice?: number;
  cpuCores: number; ramGb: number; storageGb: number; bandwidthTb?: number;
  features?: string[]; saveAmount?: number;
}
interface OsTemplate { id: string; name: string; version: string; imageId?: string; iconUrl?: string; }
interface Location { id: string; countryName: string; countryCode: string; city?: string; networkSpeed?: string; latencyMs?: number; }
interface PaymentMethod { id: string; name: string; type: string; description?: string; instructions?: string; publicSettings?: any; }

function OsIcon({ name, size = 40 }: { name: string; size?: number }) {
  const meta = OS_META[name] ?? { color: '#6B7280', letter: name[0] };
  if (name === 'Ubuntu') return (
    <div style={{ width: size, height: size, background: meta.color, borderRadius: size * 0.25, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
  if (name === 'Windows Server') return (
    <div style={{ width: size, height: size, background: meta.color, borderRadius: size * 0.25, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: size * 0.2 }}>
      <svg viewBox="0 0 24 24" fill="white">
        <path d="M3 5.557L9.624 4.7v6.124H3V5.557zM10.376 4.59L21 3v7.824H10.376V4.59zM3 11.476h6.624V17.6L3 16.743V11.476zM10.376 11.476H21V21l-10.624-1.6V11.476z"/>
      </svg>
    </div>
  );
  if (name === 'n8n') return (
    <div style={{ width: size, height: size, background: 'linear-gradient(135deg, #EA4B71, #c0392b)', borderRadius: size * 0.25, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#fff', fontWeight: 900, fontSize: size * 0.44, fontFamily: 'monospace', letterSpacing: '-1px' }}>n8n</span>
    </div>
  );
  return (
    <div style={{ width: size, height: size, background: meta.color, borderRadius: size * 0.25, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#fff', fontWeight: 800, fontSize: size * 0.42, fontFamily: 'monospace' }}>{meta.letter}</span>
    </div>
  );
}

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

function SectionNum({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0">{n}</div>
      <h3 className="font-black text-gray-900 text-base">{label}</h3>
    </div>
  );
}

export default function VpsOrderPage() {
  const { planId: initialPlanId } = useParams<{ planId: string }>();
  const [, setLocation] = useLocation();
  const { formatPrice } = useCurrency();

  const [allPlans, setAllPlans]         = useState<VpsPlan[]>([]);
  const [plan, setPlan]                 = useState<VpsPlan | null>(null);
  const [osTemplates, setOsTemplates]   = useState<OsTemplate[]>([]);
  const [locations, setLocations]       = useState<Location[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');

  const [selectedOs, setSelectedOs]             = useState<OsTemplate | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [hostname, setHostname]                 = useState('');
  const [rootPassword, setRootPassword]         = useState('');
  const [showPassword, setShowPassword]         = useState(false);
  const [dailyBackup, setDailyBackup]           = useState(false);
  const [billingCycle, setBillingCycle]         = useState<string>('monthly');

  const [step, setStep]                 = useState<'configure' | 'review'>('configure');
  const [formErrors, setFormErrors]     = useState<Record<string, string>>({});

  const [paymentMethods, setPaymentMethods]     = useState<PaymentMethod[]>([]);
  const [creditBalance, setCreditBalance]       = useState(0);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string>('');
  const [applyCredits, setApplyCredits]         = useState(false);
  const [promoCode, setPromoCode]               = useState('');
  const [promoDiscount, setPromoDiscount]       = useState(0);
  const [promoError, setPromoError]             = useState('');
  const [promoLoading, setPromoLoading]         = useState(false);

  const [ordering, setOrdering]   = useState(false);
  const [orderError, setOrderError] = useState('');
  const [success, setSuccess]     = useState(false);
  const [invoiceId, setInvoiceId] = useState('');

  const isLoggedIn = !!(localStorage.getItem('token') || localStorage.getItem('noehost_token'));

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch('/api/vps-plans').then(r => r.json()),
      fetch('/api/vps-os-templates').then(r => r.json()),
      fetch('/api/vps-locations').then(r => r.json()),
    ]).then(([plans, os, locs]) => {
      const sorted = (plans as VpsPlan[]).sort((a, b) => a.price - b.price);
      setAllPlans(sorted);

      const savedRaw = localStorage.getItem(VPS_CONFIG_KEY);
      const saved = savedRaw ? (() => { try { return JSON.parse(savedRaw); } catch { return null; } })() : null;

      const activePlan = sorted.find(p => p.id === (saved?.planId ?? initialPlanId)) ?? sorted[0] ?? null;
      setPlan(activePlan);

      const seen = new Set<string>();
      const unique = (os as OsTemplate[]).filter(t => {
        const k = `${t.name}|||${t.version}`;
        if (seen.has(k)) return false;
        seen.add(k); return true;
      });
      setOsTemplates(unique);

      const withCity = (locs as Location[]).filter(l => l.city && l.city.trim());
      const allLocs = withCity.length > 0 ? withCity : (locs as Location[]);
      setLocations(allLocs);

      // Restore from saved config
      if (saved) {
        if (saved.osId) {
          const restoredOs = unique.find(t => t.id === saved.osId) ?? null;
          if (restoredOs) setSelectedOs(restoredOs);
          else {
            const defOs = unique.find(t => t.name === 'Ubuntu' && t.version.includes('22')) ?? unique[0] ?? null;
            setSelectedOs(defOs);
          }
        } else {
          const defOs = unique.find(t => t.name === 'Ubuntu' && t.version.includes('22')) ?? unique[0] ?? null;
          setSelectedOs(defOs);
        }
        if (saved.locationId) {
          const restoredLoc = allLocs.find(l => l.id === saved.locationId) ?? null;
          setSelectedLocation(restoredLoc ?? getDefaultLocation(allLocs));
        } else {
          setSelectedLocation(getDefaultLocation(allLocs));
        }
        if (saved.hostname) setHostname(saved.hostname);
        if (saved.rootPassword) setRootPassword(saved.rootPassword);
        if (saved.dailyBackup !== undefined) setDailyBackup(saved.dailyBackup);
        if (saved.billingCycle) setBillingCycle(saved.billingCycle);
        if (saved.step === 'review' && isLoggedIn) setStep('review');
      } else {
        const defOs = unique.find(t => t.name === 'Ubuntu' && t.version.includes('22')) ?? unique[0] ?? null;
        setSelectedOs(defOs);
        setSelectedLocation(getDefaultLocation(allLocs));
      }

      setLoading(false);
    }).catch(() => { setError('Failed to load plan details'); setLoading(false); });
  }, [initialPlanId]);

  function getDefaultLocation(locs: Location[]): Location | null {
    const germany = locs.find(l => l.countryCode === 'DE' || l.countryName.toLowerCase().includes('germany'));
    return germany ?? locs[0] ?? null;
  }

  // ── Update hostname when plan changes ─────────────────────────────────────
  useEffect(() => {
    if (plan && !hostname) {
      const slug = plan.name.toLowerCase().replace(/\s+/g, '-');
      setHostname(`${slug}-server`);
    }
  }, [plan?.id]);

  // ── Auto-save config to localStorage on every change ──────────────────────
  useEffect(() => {
    if (!plan) return;
    const config = {
      planId: plan.id,
      osId: selectedOs?.id,
      locationId: selectedLocation?.id,
      hostname,
      rootPassword,
      dailyBackup,
      billingCycle,
      step,
    };
    localStorage.setItem(VPS_CONFIG_KEY, JSON.stringify(config));
  }, [plan?.id, selectedOs?.id, selectedLocation?.id, hostname, rootPassword, dailyBackup, billingCycle, step]);

  // ── Load payment methods + credit balance (when on review step) ───────────
  useEffect(() => {
    if (step !== 'review' || !isLoggedIn) return;
    const token = localStorage.getItem('token') || localStorage.getItem('noehost_token');
    Promise.all([
      fetch('/api/payment-methods', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/my/profile', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([methods, profile]) => {
      setPaymentMethods(Array.isArray(methods) ? methods : []);
      const bal = parseFloat(profile?.creditBalance ?? profile?.user?.creditBalance ?? '0');
      setCreditBalance(isNaN(bal) ? 0 : bal);
    }).catch(() => {});
  }, [step, isLoggedIn]);

  // ── Price calculations ────────────────────────────────────────────────────
  const getCycleMonthlyPrice = (p: VpsPlan | null): number => {
    if (!p) return 0;
    if (billingCycle === 'quarterly' && p.quarterlyPrice) return p.quarterlyPrice / 3;
    if (billingCycle === 'semiannual' && p.semiannualPrice) return p.semiannualPrice / 6;
    if (billingCycle === 'yearly' && p.yearlyPrice) return p.yearlyPrice / 12;
    if (billingCycle === 'biennial' && (p as any).biennialPrice) return (p as any).biennialPrice / 24;
    return p.price;
  };

  const monthlyPrice     = getCycleMonthlyPrice(plan);
  const backupMonthly    = dailyBackup ? BACKUP_PRICE_PKR : 0;
  const totalMonthly     = monthlyPrice + backupMonthly;
  const cycleMonths      = CYCLE_MONTHS[billingCycle] ?? 1;
  const subtotal         = totalMonthly * cycleMonths;
  const savePercent      = billingCycle !== 'monthly' && plan && monthlyPrice < plan.price
    ? Math.max(0, Math.round((1 - monthlyPrice / plan.price) * 100)) : 0;
  const totalAfterPromo  = Math.max(0, subtotal - promoDiscount);
  const creditDeducted   = applyCredits ? Math.min(creditBalance, totalAfterPromo) : 0;
  const finalAmount      = Math.max(0, totalAfterPromo - creditDeducted);

  const availableCycles = (['monthly', 'quarterly', 'semiannual', 'yearly', 'biennial'] as const).filter(c => {
    if (c === 'monthly') return true;
    if (!plan) return false;
    if (c === 'quarterly') return !!plan.quarterlyPrice;
    if (c === 'semiannual') return !!plan.semiannualPrice;
    if (c === 'yearly') return !!plan.yearlyPrice;
    if (c === 'biennial') return !!(plan as any).biennialPrice;
    return false;
  });

  // ── Validate configure step ────────────────────────────────────────────────
  function validateConfigure(): boolean {
    const errors: Record<string, string> = {};
    if (!selectedOs) errors.os = 'Please select an operating system';
    if (!selectedLocation) errors.location = 'Please select a data center location';
    if (!hostname.trim()) errors.hostname = 'Hostname is required';
    if (!rootPassword || rootPassword.length < 8) errors.rootPassword = 'Password must be at least 8 characters';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── Checkout Now click ─────────────────────────────────────────────────────
  const handleCheckoutNow = () => {
    if (!validateConfigure()) return;
    if (!isLoggedIn) {
      // Save with step='review' so after login we jump straight to review
      const config = {
        planId: plan?.id, osId: selectedOs?.id, locationId: selectedLocation?.id,
        hostname, rootPassword, dailyBackup, billingCycle, step: 'review',
      };
      localStorage.setItem(VPS_CONFIG_KEY, JSON.stringify(config));
      const returnUrl = window.location.pathname;
      window.location.href = `/client/login?redirect=${encodeURIComponent(returnUrl)}`;
      return;
    }
    setStep('review');
  };

  // ── Apply promo ────────────────────────────────────────────────────────────
  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoError('');
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('noehost_token');
      const res = await fetch('/api/validate-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: promoCode.trim().toUpperCase(), amount: subtotal }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setPromoError(data.error ?? 'Invalid promo code'); setPromoDiscount(0); }
      else { setPromoDiscount(data.discount ?? 0); setPromoError(''); }
    } catch { setPromoError('Could not validate promo code'); }
    setPromoLoading(false);
  };

  // ── Place order ────────────────────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    const token = localStorage.getItem('token') || localStorage.getItem('noehost_token');
    if (!token) { setLocation('/client/login'); return; }
    if (!selectedPaymentId && finalAmount > 0) { setOrderError('Please select a payment method'); return; }
    setOrdering(true);
    setOrderError('');
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          vpsPlanId: plan?.id ?? initialPlanId,
          vpsOsTemplate: `${selectedOs!.name} ${selectedOs!.version}`,
          vpsLocation: `${selectedLocation!.countryName}${selectedLocation!.city ? ' — ' + selectedLocation!.city : ''}`,
          vpsHostname: hostname.trim(),
          vpsRootPassword: rootPassword,
          vpsImageId: selectedOs!.imageId ?? null,
          vpsWeeklyBackups: dailyBackup,
          vpsBackupAddon: dailyBackup,
          billingCycle,
          promoCode: promoCode.trim().toUpperCase() || undefined,
          applyCredits: applyCredits || selectedPaymentId === 'credits',
          paymentMethodId: selectedPaymentId === 'credits' ? 'credits' : (selectedPaymentId || undefined),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setOrderError(data.error ?? 'Order failed. Please try again.'); setOrdering(false); return; }
      localStorage.removeItem(VPS_CONFIG_KEY);
      setSuccess(true);
      setInvoiceId(data.invoiceId);
    } catch { setOrderError('Network error. Please try again.'); setOrdering(false); }
  };

  // ── OS Groups ─────────────────────────────────────────────────────────────
  const appOS     = osTemplates.filter(t => ['n8n'].includes(t.name));
  const windowsOS = osTemplates.filter(t => t.name === 'Windows Server');
  const otherOS   = osTemplates.filter(t => t.name === 'FreeBSD');
  const linuxOS   = osTemplates.filter(t => !['Windows Server', 'FreeBSD', 'n8n'].includes(t.name));

  function isGermany(loc: Location) {
    return loc.countryCode === 'DE' || loc.countryName.toLowerCase().includes('germany');
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4">
          <Loader2 className="animate-spin text-indigo-600" size={28}/>
        </div>
        <p className="text-gray-500 font-medium">Loading your plan…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="mx-auto mb-3 text-red-500" size={36}/>
        <p className="text-gray-700 font-semibold mb-4">{error}</p>
        <button onClick={() => setLocation('/vps-hosting')}
          className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700">
          ← Back to Plans
        </button>
      </div>
    </div>
  );

  // ── Success ───────────────────────────────────────────────────────────────
  if (success) return (
    <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-emerald-50 border-4 border-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="text-emerald-500" size={40}/>
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">Order Placed! 🎉</h2>
        <p className="text-gray-500 mb-1">Your VPS <span className="font-bold text-gray-800">{plan?.name}</span> is being provisioned.</p>
        <p className="text-gray-400 text-sm mb-8">Login credentials will be emailed once your server is activated.</p>
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

  // ── REVIEW STEP ───────────────────────────────────────────────────────────
  if (step === 'review') return (
    <div className="min-h-screen" style={{ background: '#F7F8FA' }}>
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => setStep('configure')} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 text-sm font-semibold transition-colors">
            <ArrowLeft size={15}/> Back to Configure
          </button>
          <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
            <div className="w-5 h-5 rounded-md bg-indigo-600 flex items-center justify-center">
              <Server size={11} className="text-white"/>
            </div>
            Review & Pay
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
            <Shield size={13} className="text-emerald-500"/> Secure Checkout
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">

          {/* Left: Payment options */}
          <div className="space-y-4">

            {/* Order Summary */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h3 className="font-black text-gray-900 text-base mb-4 flex items-center gap-2">
                <CheckCircle size={16} className="text-indigo-600"/> Order Summary
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                  <Server size={18} className="text-indigo-600 mt-0.5 flex-shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 text-sm">{plan?.name} — Cloud VPS</div>
                    <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-2">
                      <span>{plan?.cpuCores} vCPU</span>
                      <span>·</span>
                      <span>{plan?.ramGb} GB RAM</span>
                      <span>·</span>
                      <span>{plan?.storageGb} GB NVMe</span>
                    </div>
                  </div>
                  <span className="font-black text-indigo-700 text-sm whitespace-nowrap">{formatPrice(monthlyPrice)}/mo</span>
                </div>
                {selectedOs && (
                  <div className="flex items-center gap-3 px-3 py-2">
                    <OsIcon name={selectedOs.name} size={24}/>
                    <div className="flex-1">
                      <span className="text-sm text-gray-700 font-medium">{selectedOs.name} {selectedOs.version}</span>
                    </div>
                  </div>
                )}
                {selectedLocation && (
                  <div className="flex items-center gap-3 px-3 py-2">
                    <span className="text-xl leading-none">{FLAGS[selectedLocation.countryCode] ?? '🌐'}</span>
                    <div className="flex-1">
                      <span className="text-sm text-gray-700 font-medium">
                        {selectedLocation.countryName}{selectedLocation.city ? ` — ${selectedLocation.city}` : ''}
                      </span>
                      {isGermany(selectedLocation) && (
                        <span className="ml-2 text-[10px] font-black px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">Recommended</span>
                      )}
                    </div>
                  </div>
                )}
                {hostname && (
                  <div className="flex items-center gap-3 px-3 py-2">
                    <Server size={16} className="text-gray-400 flex-shrink-0"/>
                    <span className="text-sm text-gray-600 font-medium">{hostname}</span>
                  </div>
                )}
                {dailyBackup && (
                  <div className="flex items-center gap-3 px-3 py-2">
                    <RefreshCw size={16} className="text-indigo-500 flex-shrink-0"/>
                    <span className="text-sm text-indigo-600 font-medium">Daily Automatic Backups (+{formatPrice(BACKUP_PRICE_PKR)}/mo)</span>
                  </div>
                )}
                <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
                  <span className="text-sm text-gray-500">Billing</span>
                  <span className="text-sm font-bold text-gray-800">{CYCLE_LABELS[billingCycle]}</span>
                </div>
              </div>
            </div>

            {/* Promo Code */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h3 className="font-black text-gray-900 text-base mb-4 flex items-center gap-2">
                <Gift size={16} className="text-indigo-600"/> Promo Code
              </h3>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                  <input
                    type="text"
                    value={promoCode}
                    onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoDiscount(0); setPromoError(''); }}
                    placeholder="Enter promo code"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white hover:border-gray-300 transition-all uppercase"
                  />
                </div>
                <button onClick={handleApplyPromo} disabled={promoLoading || !promoCode.trim()}
                  className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap">
                  {promoLoading ? <Loader2 size={14} className="animate-spin"/> : 'Apply'}
                </button>
              </div>
              {promoError && <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><AlertCircle size={11}/> {promoError}</p>}
              {promoDiscount > 0 && <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1"><Check size={11}/> Promo applied! You save {formatPrice(promoDiscount)}</p>}
            </div>

            {/* Wallet Credits */}
            {creditBalance > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h3 className="font-black text-gray-900 text-base mb-4 flex items-center gap-2">
                  <Wallet size={16} className="text-indigo-600"/> Account Credits
                </h3>
                <button onClick={() => setApplyCredits(!applyCredits)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                    applyCredits ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200 bg-white'
                  }`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${applyCredits ? 'bg-indigo-600' : 'bg-gray-100'}`}>
                    <Wallet size={18} className={applyCredits ? 'text-white' : 'text-gray-500'}/>
                  </div>
                  <div className="flex-1">
                    <div className={`font-bold text-sm ${applyCredits ? 'text-indigo-900' : 'text-gray-800'}`}>
                      Use Account Credits
                    </div>
                    <div className="text-xs text-gray-400">Balance: {formatPrice(creditBalance)}</div>
                  </div>
                  <div>
                    {applyCredits && creditDeducted > 0 && (
                      <div className="text-sm font-black text-indigo-700">−{formatPrice(creditDeducted)}</div>
                    )}
                    <div className={`w-10 h-5 rounded-full transition-all flex items-center mt-1 ml-auto ${applyCredits ? 'bg-indigo-600 justify-end' : 'bg-gray-200 justify-start'}`}>
                      <div className="w-4 h-4 bg-white rounded-full shadow mx-0.5"/>
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* Payment Methods */}
            {finalAmount > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h3 className="font-black text-gray-900 text-base mb-4 flex items-center gap-2">
                  <CreditCard size={16} className="text-indigo-600"/> Payment Method
                </h3>
                {paymentMethods.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 text-sm">
                    <Loader2 size={20} className="animate-spin mx-auto mb-2"/>
                    Loading payment methods…
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {paymentMethods.map(pm => {
                      const sel = selectedPaymentId === pm.id;
                      return (
                        <button key={pm.id} onClick={() => setSelectedPaymentId(pm.id)}
                          className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                            sel ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200 bg-white'
                          }`}>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${sel ? 'bg-indigo-600' : 'bg-gray-100'}`}>
                            <CreditCard size={18} className={sel ? 'text-white' : 'text-gray-500'}/>
                          </div>
                          <div className="flex-1">
                            <div className={`font-bold text-sm ${sel ? 'text-indigo-900' : 'text-gray-800'}`}>{pm.name}</div>
                            {pm.description && <div className="text-xs text-gray-400">{pm.description}</div>}
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${sel ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'}`}>
                            {sel && <div className="w-2 h-2 bg-white rounded-full"/>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {orderError && (
                  <div className="mt-3 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                    <AlertCircle size={14} className="mt-0.5 flex-shrink-0"/>
                    <span>{orderError}</span>
                  </div>
                )}
              </div>
            )}

            {finalAmount === 0 && creditBalance > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                <CheckCircle size={20} className="text-emerald-600 mx-auto mb-1"/>
                <p className="text-sm font-bold text-emerald-800">Fully covered by your credits!</p>
                <p className="text-xs text-emerald-600">No additional payment needed.</p>
              </div>
            )}
          </div>

          {/* Right: Price summary + Place Order */}
          <div className="lg:sticky lg:top-20 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-4 border-b border-gray-100">
                <h3 className="font-black text-gray-900 text-sm mb-3">Price Summary</h3>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{plan?.name} × {cycleMonths}mo</span>
                    <span className="font-bold text-gray-800">{formatPrice(monthlyPrice * cycleMonths)}</span>
                  </div>
                  {savePercent > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-emerald-600 font-medium">Plan discount ({savePercent}%)</span>
                      <span className="font-bold text-emerald-600">−{formatPrice((plan!.price - monthlyPrice) * cycleMonths)}</span>
                    </div>
                  )}
                  {dailyBackup && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Daily Backups × {cycleMonths}mo</span>
                      <span className="font-bold text-gray-800">{formatPrice(BACKUP_PRICE_PKR * cycleMonths)}</span>
                    </div>
                  )}
                  {promoDiscount > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-emerald-600 font-medium">Promo ({promoCode})</span>
                      <span className="font-bold text-emerald-600">−{formatPrice(promoDiscount)}</span>
                    </div>
                  )}
                  {creditDeducted > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-indigo-600 font-medium">Credits applied</span>
                      <span className="font-bold text-indigo-600">−{formatPrice(creditDeducted)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
                    <span className="font-black text-gray-900">Total Due</span>
                    <div className="text-right">
                      <div className="font-black text-indigo-700 text-xl">{formatPrice(finalAmount)}</div>
                      {billingCycle !== 'monthly' && (
                        <div className="text-xs text-gray-400">{formatPrice(totalMonthly)}/mo</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-3">
                <button onClick={handlePlaceOrder} disabled={ordering}
                  className="w-full py-4 rounded-xl font-black text-sm text-white transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
                  style={{
                    background: ordering ? '#a5b4fc' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    boxShadow: ordering ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
                  }}>
                  {ordering
                    ? <><Loader2 size={16} className="animate-spin"/> Processing…</>
                    : <><ShoppingCart size={15}/> Place Order — {formatPrice(finalAmount)}</>
                  }
                </button>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: <Shield size={12}/>, text: '30-day refund', color: '#10B981' },
                    { icon: <Check size={12}/>, text: '99.9% uptime', color: '#3B82F6' },
                    { icon: <Zap size={12}/>, text: 'Instant deploy', color: '#F59E0B' },
                    { icon: <Lock size={12}/>, text: 'Free DDoS', color: '#8B5CF6' },
                  ].map(({ icon, text, color }) => (
                    <div key={text} className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500">
                      <span style={{ color }}>{icon}</span> {text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ── CONFIGURE STEP (Main) ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: '#F7F8FA' }}>

      {/* ── Sticky Header ────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => setLocation('/vps-hosting')}
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 text-sm font-semibold transition-colors">
            <ArrowLeft size={15}/> VPS Plans
          </button>
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-indigo-600 flex items-center justify-center">
              <Server size={11} className="text-white"/>
            </div>
            <span className="font-bold text-gray-800 text-sm">Configure {plan?.name}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
            <Shield size={13} className="text-emerald-500"/>
            <span className="hidden sm:inline">Secure Checkout</span>
          </div>
        </div>
      </div>

      {/* ── Main layout ──────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">

          {/* ── LEFT COLUMN ────────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* 1. Choose Plan */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <SectionNum n={1} label="Choose Your Plan" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {allPlans.map((p, i) => {
                  const isSelected = plan?.id === p.id;
                  const isPopular  = i === 1;
                  const yearlyM    = p.yearlyPrice ? p.yearlyPrice / 12 : null;
                  const savePct    = yearlyM ? Math.round((1 - yearlyM / p.price) * 100) : 0;
                  return (
                    <button key={p.id} onClick={() => setPlan(p)}
                      className={`relative flex flex-col p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100'
                          : 'border-gray-200 hover:border-indigo-200 bg-white hover:bg-gray-50'
                      }`}>
                      {isPopular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-indigo-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">
                          <Star size={9} fill="white"/> MOST POPULAR
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute top-2.5 right-2.5 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                          <Check size={10} className="text-white"/>
                        </div>
                      )}
                      <div className={`text-xs font-black uppercase tracking-wider mb-2 ${isSelected ? 'text-indigo-500' : 'text-gray-400'}`}>
                        {p.name}
                      </div>
                      <div className={`text-2xl font-black mb-0.5 ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>
                        {formatPrice(p.price)}
                        <span className="text-sm font-semibold text-gray-400">/mo</span>
                      </div>
                      {savePct > 0 && (
                        <div className="text-[10px] font-bold text-emerald-600 mb-3">Save {savePct}% yearly</div>
                      )}
                      <div className="mt-2 space-y-1.5 border-t border-gray-100 pt-3">
                        {[
                          { icon: <Cpu size={11}/>, text: `${p.cpuCores} vCPU Cores` },
                          { icon: <HardDrive size={11}/>, text: `${p.ramGb} GB RAM` },
                          { icon: <Server size={11}/>, text: `${p.storageGb} GB NVMe` },
                          { icon: <Wifi size={11}/>, text: p.bandwidthTb ? `${p.bandwidthTb} TB BW` : 'Unmetered' },
                        ].map(({ icon, text }) => (
                          <div key={text} className={`flex items-center gap-2 text-xs font-semibold ${isSelected ? 'text-indigo-700' : 'text-gray-600'}`}>
                            <span className={isSelected ? 'text-indigo-400' : 'text-gray-400'}>{icon}</span> {text}
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Operating System */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <SectionNum n={2} label="Select Operating System" />
              {formErrors.os && (
                <div className="mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                  <AlertCircle size={14}/> {formErrors.os}
                </div>
              )}
              {linuxOS.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[11px] font-black uppercase tracking-widest text-gray-400">Linux Distributions</span>
                    <div className="flex-1 h-px bg-gray-100"/>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {linuxOS.map(os => {
                      const sel = selectedOs?.id === os.id;
                      return (
                        <button key={os.id} onClick={() => { setSelectedOs(os); setFormErrors(p => ({ ...p, os: '' })); }}
                          className={`relative flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                            sel ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-gray-200 hover:border-indigo-200 bg-white hover:bg-gray-50'
                          }`}>
                          {sel && (
                            <div className="absolute top-2 right-2 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center">
                              <Check size={9} className="text-white"/>
                            </div>
                          )}
                          <OsIcon name={os.name} size={38}/>
                          <div className="min-w-0">
                            <div className={`font-bold text-sm truncate ${sel ? 'text-indigo-900' : 'text-gray-800'}`}>{os.name}</div>
                            <div className="text-xs text-gray-400 truncate">{os.version}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {[...windowsOS, ...otherOS].length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[11px] font-black uppercase tracking-widest text-gray-400">Other</span>
                    <div className="flex-1 h-px bg-gray-100"/>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {[...windowsOS, ...otherOS].map(os => {
                      const sel = selectedOs?.id === os.id;
                      return (
                        <button key={os.id} onClick={() => { setSelectedOs(os); setFormErrors(p => ({ ...p, os: '' })); }}
                          className={`relative flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                            sel ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-gray-200 hover:border-indigo-200 bg-white hover:bg-gray-50'
                          }`}>
                          {sel && (
                            <div className="absolute top-2 right-2 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center">
                              <Check size={9} className="text-white"/>
                            </div>
                          )}
                          <OsIcon name={os.name} size={38}/>
                          <div className="min-w-0">
                            <div className={`font-bold text-sm truncate ${sel ? 'text-indigo-900' : 'text-gray-800'}`}>{os.name}</div>
                            <div className="text-xs text-gray-400 truncate">{os.version}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {appOS.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[11px] font-black uppercase tracking-widest text-gray-400">Applications</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-100 text-rose-600 rounded-full">Optional</span>
                    <div className="flex-1 h-px bg-gray-100"/>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {appOS.map(os => {
                      const sel = selectedOs?.id === os.id;
                      return (
                        <button key={os.id} onClick={() => { setSelectedOs(os); setFormErrors(p => ({ ...p, os: '' })); }}
                          className={`relative flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                            sel ? 'border-rose-400 bg-rose-50 shadow-sm' : 'border-gray-200 hover:border-rose-200 bg-white hover:bg-gray-50'
                          }`}>
                          {sel && (
                            <div className="absolute top-2 right-2 w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center">
                              <Check size={9} className="text-white"/>
                            </div>
                          )}
                          <OsIcon name={os.name} size={38}/>
                          <div className="min-w-0">
                            <div className={`font-bold text-sm truncate ${sel ? 'text-rose-900' : 'text-gray-800'}`}>{os.name}</div>
                            <div className="text-xs text-gray-400 truncate">Pre-configured on Ubuntu</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-2.5 flex items-center gap-1.5">
                    <Zap size={11} className="text-amber-500"/>
                    n8n will be auto-installed with Docker on Ubuntu 22.04 LTS.
                  </p>
                </div>
              )}
            </div>

            {/* 3. Data Center Location */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <SectionNum n={3} label="Data Center Location" />
              <p className="text-xs text-gray-400 -mt-3 mb-5">Choose a region closest to your target audience for best performance</p>
              {formErrors.location && (
                <div className="mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                  <AlertCircle size={14}/> {formErrors.location}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Sort: Germany first, then rest */}
                {[...locations].sort((a, b) => {
                  if (isGermany(a) && !isGermany(b)) return -1;
                  if (!isGermany(a) && isGermany(b)) return 1;
                  return 0;
                }).map(loc => {
                  const sel = selectedLocation?.id === loc.id;
                  const flag = FLAGS[loc.countryCode] ?? '🌐';
                  const germany = isGermany(loc);
                  return (
                    <button key={loc.id} onClick={() => { setSelectedLocation(loc); setFormErrors(p => ({ ...p, location: '' })); }}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                        sel
                          ? germany ? 'border-indigo-500 bg-indigo-50 shadow-md' : 'border-indigo-500 bg-indigo-50 shadow-sm'
                          : germany ? 'border-indigo-200 hover:border-indigo-400 bg-indigo-50/30' : 'border-gray-200 hover:border-indigo-200 bg-white hover:bg-gray-50'
                      }`}>
                      <span className="text-2xl flex-shrink-0 leading-none">{flag}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className={`font-bold text-sm ${sel ? 'text-indigo-900' : 'text-gray-800'}`}>
                            {loc.countryName}{loc.city ? ` — ${loc.city}` : ''}
                          </div>
                          {germany && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 bg-indigo-600 text-white rounded-full flex items-center gap-0.5">
                              <Star size={8} fill="white"/> Recommended
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400">{loc.networkSpeed ?? '10 Gbps'}</span>
                          {loc.latencyMs && (
                            <>
                              <span className="text-gray-300">·</span>
                              <span className={`text-xs font-semibold ${germany ? 'text-indigo-600' : loc.latencyMs < 20 ? 'text-emerald-600' : loc.latencyMs < 60 ? 'text-amber-600' : 'text-red-500'}`}>
                                ~{loc.latencyMs}ms
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {sel && (
                        <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <Check size={10} className="text-white"/>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Server Details */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <SectionNum n={4} label="Server Details" />
              <p className="text-xs text-gray-400 -mt-3 mb-5">Set a hostname and root password for your server</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    Hostname <span className="text-gray-400 font-normal text-xs">e.g. myserver.example.com</span>
                  </label>
                  <div className="relative">
                    <Server size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                    <input type="text" value={hostname}
                      onChange={e => { setHostname(e.target.value); setFormErrors(p => ({ ...p, hostname: '' })); }}
                      placeholder="my-vps-server"
                      className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all ${
                        formErrors.hostname ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    />
                  </div>
                  {formErrors.hostname && <p className="text-xs text-red-500 mt-1">{formErrors.hostname}</p>}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Root Password</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                    <input type={showPassword ? 'text' : 'password'} value={rootPassword}
                      onChange={e => { setRootPassword(e.target.value); setFormErrors(p => ({ ...p, rootPassword: '' })); }}
                      placeholder="Min. 8 chars, uppercase, number, symbol"
                      className={`w-full pl-10 pr-11 py-2.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all ${
                        formErrors.rootPassword ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                      {showPassword ? <EyeOff size={15}/> : <Eye size={15}/>}
                    </button>
                  </div>
                  {rootPassword && (() => {
                    const str = passwordStrength(rootPassword);
                    return (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex gap-1 flex-1">
                          {[25, 50, 75, 100].map(v => (
                            <div key={v} className="h-1 flex-1 rounded-full transition-all"
                              style={{ background: str.pct >= v ? str.color : '#E5E7EB' }}/>
                          ))}
                        </div>
                        <span className="text-xs font-semibold" style={{ color: str.color }}>{str.label}</span>
                      </div>
                    );
                  })()}
                  {formErrors.rootPassword && <p className="text-xs text-red-500 mt-1">{formErrors.rootPassword}</p>}
                  <p className="text-xs text-gray-400 mt-1.5">Use uppercase letters, numbers, and symbols for a strong password.</p>
                </div>
              </div>
            </div>

            {/* 5. Add-ons */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <SectionNum n={5} label="Add-ons" />
              <button onClick={() => setDailyBackup(!dailyBackup)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                  dailyBackup ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200 bg-white'
                }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${dailyBackup ? 'bg-indigo-600' : 'bg-gray-100'}`}>
                  <RefreshCw size={18} className={dailyBackup ? 'text-white' : 'text-gray-500'}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`font-bold text-sm ${dailyBackup ? 'text-indigo-900' : 'text-gray-800'}`}>Daily Automatic Backups</span>
                    <span className="text-[10px] font-black px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">RECOMMENDED</span>
                  </div>
                  <p className="text-xs text-gray-400">Daily snapshots stored 7 days. One-click restore anytime.</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`font-black text-sm ${dailyBackup ? 'text-indigo-700' : 'text-gray-700'}`}>
                    +{formatPrice(BACKUP_PRICE_PKR)}<span className="font-normal text-xs text-gray-400">/mo</span>
                  </div>
                  <div className={`w-10 h-5 rounded-full transition-all flex items-center mt-1.5 ml-auto ${dailyBackup ? 'bg-indigo-600 justify-end' : 'bg-gray-200 justify-start'}`}>
                    <div className="w-4 h-4 bg-white rounded-full shadow mx-0.5"/>
                  </div>
                </div>
              </button>
            </div>

          </div>

          {/* ── RIGHT SIDEBAR ──────────────────────────────────────────── */}
          <div className="lg:sticky lg:top-20">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

              <div className="px-5 pt-5 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <Server size={13} className="text-indigo-600"/>
                  </div>
                  <h3 className="font-black text-gray-900 text-sm">{plan?.name} — Cloud VPS</h3>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {plan && [
                    `${plan.cpuCores} vCPU`,
                    `${plan.ramGb} GB RAM`,
                    `${plan.storageGb} GB NVMe`,
                    plan.bandwidthTb ? `${plan.bandwidthTb} TB` : 'Unmetered',
                  ].map(s => (
                    <span key={s} className="text-[11px] font-semibold px-2 py-1 bg-gray-100 text-gray-600 rounded-lg">{s}</span>
                  ))}
                </div>
              </div>

              <div className="p-5 space-y-5">

                {/* Billing period */}
                <div>
                  <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2.5">Billing Period</p>
                  <div className="space-y-2">
                    {availableCycles.map(cycle => {
                      let cmprice = plan?.price ?? 0;
                      if (cycle === 'quarterly' && plan?.quarterlyPrice) cmprice = plan.quarterlyPrice / 3;
                      else if (cycle === 'semiannual' && plan?.semiannualPrice) cmprice = plan.semiannualPrice / 6;
                      else if (cycle === 'yearly' && plan?.yearlyPrice) cmprice = plan.yearlyPrice / 12;
                      else if (cycle === 'biennial' && (plan as any)?.biennialPrice) cmprice = (plan as any).biennialPrice / 24;
                      const sp = cycle !== 'monthly' && plan?.price && cmprice < plan.price
                        ? Math.round((1 - cmprice / plan.price) * 100) : 0;
                      const isSel = billingCycle === cycle;
                      return (
                        <button key={cycle} onClick={() => setBillingCycle(cycle)}
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border-2 transition-all ${
                            isSel ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}>
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${isSel ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'}`}>
                              {isSel && <div className="w-1.5 h-1.5 bg-white rounded-full"/>}
                            </div>
                            <span className={`text-sm font-bold ${isSel ? 'text-indigo-900' : 'text-gray-700'}`}>{CYCLE_LABELS[cycle]}</span>
                            {sp > 0 && <span className="text-[10px] font-black px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">Save {sp}%</span>}
                          </div>
                          <span className={`text-sm font-black ${isSel ? 'text-indigo-700' : 'text-gray-600'}`}>
                            {formatPrice(cmprice)}<span className="text-xs font-normal text-gray-400">/mo</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Price breakdown */}
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3">Price Breakdown</p>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{plan?.name} <span className="text-gray-400 text-xs">×{cycleMonths}mo</span></span>
                      <span className="font-bold text-gray-800">{formatPrice(monthlyPrice * cycleMonths)}</span>
                    </div>
                    {savePercent > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-emerald-600 font-medium">Discount ({savePercent}% off)</span>
                        <span className="font-bold text-emerald-600">−{formatPrice((plan!.price - monthlyPrice) * cycleMonths)}</span>
                      </div>
                    )}
                    {dailyBackup && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Daily Backups <span className="text-gray-400 text-xs">×{cycleMonths}mo</span></span>
                        <span className="font-bold text-gray-800">{formatPrice(BACKUP_PRICE_PKR * cycleMonths)}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
                      <span className="font-black text-gray-900">Total Due</span>
                      <div className="text-right">
                        <div className="font-black text-indigo-700 text-xl">{formatPrice(subtotal)}</div>
                        {billingCycle !== 'monthly' && (
                          <div className="text-xs text-gray-400">{formatPrice(totalMonthly)}/mo</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Checkout Now CTA */}
                <button onClick={handleCheckoutNow}
                  className="w-full py-4 rounded-xl font-black text-sm text-white transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', boxShadow: '0 4px 20px rgba(99,102,241,0.4)' }}>
                  <ShoppingCart size={15}/> Checkout Now — {formatPrice(subtotal)}
                </button>

                {/* Trust badges */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {[
                    { icon: <Shield size={12}/>, text: '30-day refund', color: '#10B981' },
                    { icon: <Check size={12}/>, text: '99.9% uptime', color: '#3B82F6' },
                    { icon: <Zap size={12}/>, text: 'Instant deploy', color: '#F59E0B' },
                    { icon: <Lock size={12}/>, text: 'Free DDoS', color: '#8B5CF6' },
                  ].map(({ icon, text, color }) => (
                    <div key={text} className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500">
                      <span style={{ color }}>{icon}</span> {text}
                    </div>
                  ))}
                </div>

                {/* Config preview */}
                {(selectedOs || selectedLocation) && (
                  <div className="border-t border-gray-100 pt-4 space-y-2">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Your Config</p>
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
                        {isGermany(selectedLocation) && (
                          <span className="text-[10px] font-black px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">Recommended</span>
                        )}
                      </div>
                    )}
                    {hostname && (
                      <div className="flex items-center gap-2">
                        <Server size={13} className="text-gray-400 flex-shrink-0"/>
                        <span className="text-xs text-gray-500 font-medium truncate">{hostname}</span>
                      </div>
                    )}
                    {dailyBackup && (
                      <div className="flex items-center gap-2">
                        <RefreshCw size={13} className="text-indigo-500 flex-shrink-0"/>
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
