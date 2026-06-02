import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, ArrowLeft, ArrowRight, Check, User, CreditCard,
  Globe, Package, Lock, Eye, EyeOff, Loader2, AlertCircle,
  ShieldCheck, Smartphone, Landmark, Star, ChevronRight,
  BadgeCheck, Gift, Zap, Server,
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useCurrency } from '../../CurrencyContext';

// ── Types ─────────────────────────────────────────────────────────────────────
interface PaymentMethod {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  publicSettings?: {
    mobileNumber?: string;
    bankName?: string;
    accountTitle?: string;
    accountNumber?: string;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 'review',  label: 'Review',  icon: ShoppingCart },
  { id: 'domain',  label: 'Domain',  icon: Globe        },
  { id: 'account', label: 'Account', icon: User         },
  { id: 'payment', label: 'Payment', icon: CreditCard   },
];

function getCycleSuffix(cycle: string) {
  switch (cycle) {
    case 'monthly':    return '/mo';
    case 'quarterly':  return '/3mo';
    case 'semiannual': return '/6mo';
    case 'yearly':     return '/yr';
    default:           return '';
  }
}

function getCycleLabel(cycle: string) {
  switch (cycle) {
    case 'monthly':    return 'Monthly';
    case 'quarterly':  return 'Quarterly';
    case 'semiannual': return '6 Months';
    case 'yearly':     return 'Yearly';
    default:           return cycle;
  }
}

function getItemPrice(item: any): number {
  switch (item.billingCycle) {
    case 'monthly':    return item.monthlyPrice;
    case 'quarterly':  return item.quarterlyPrice  ?? item.monthlyPrice * 3;
    case 'semiannual': return item.semiannualPrice ?? item.monthlyPrice * 6;
    case 'yearly':     return item.yearlyPrice     ?? item.monthlyPrice * 12;
    default:           return item.monthlyPrice;
  }
}

function PayIcon({ type }: { type: string }) {
  const cls = "w-9 h-9 rounded-xl flex items-center justify-center shrink-0";
  switch (type) {
    case 'jazzcash':      return <div className={cls} style={{ background: 'rgba(240,97,46,0.12)' }}><Smartphone size={16} style={{ color: '#f0612e' }} /></div>;
    case 'easypaisa':     return <div className={cls} style={{ background: 'rgba(59,181,74,0.12)' }}><Smartphone size={16} style={{ color: '#3bb54a' }} /></div>;
    case 'bank_transfer': return <div className={`${cls} bg-blue-500/10`}><Landmark size={16} className="text-blue-400" /></div>;
    case 'safepay':       return <div className={cls} style={{ background: 'rgba(80,70,228,0.12)' }}><ShieldCheck size={16} style={{ color: '#5046e4' }} /></div>;
    case 'stripe':        return <div className={cls} style={{ background: 'rgba(99,91,255,0.12)' }}><CreditCard size={16} style={{ color: '#635bff' }} /></div>;
    default:              return <div className={`${cls} bg-white/5`}><CreditCard size={16} className="text-slate-400" /></div>;
  }
}

// ── Main Component ────────────────────────────────────────────────────────────
const Checkout: React.FC = () => {
  const { items, getTotal, clearCart, syncWithBackend } = useCart();
  const { convertFromPKR } = useCurrency();
  const navigate = useNavigate();

  // ── Auth state ───────────────────────────────────────────────────────────
  const [loggedInUser,  setLoggedInUser]  = useState<any>(null);
  const [authChecked,   setAuthChecked]   = useState(false);

  // ── Step state ───────────────────────────────────────────────────────────
  const [step, setStep] = useState(0);

  // ── Domain step state ────────────────────────────────────────────────────
  const [domainOption,    setDomainOption]    = useState<'new' | 'existing' | 'skip'>('skip');
  const [domainSearch,    setDomainSearch]    = useState('');
  const [domainResults,   setDomainResults]   = useState<any[]>([]);
  const [selectedDomain,  setSelectedDomain]  = useState('');
  const [existingDomain,  setExistingDomain]  = useState('');
  const [searchingDomain, setSearchingDomain] = useState(false);

  // ── Auth form state ──────────────────────────────────────────────────────
  const [authMode,     setAuthMode]     = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [loginForm,    setLoginForm]    = useState({ email: '', password: '' });
  const [regForm,      setRegForm]      = useState({ firstName: '', lastName: '', email: '', password: '', phone: '' });
  const [loginError,   setLoginError]   = useState('');
  const [regError,     setRegError]     = useState('');

  // ── Payment step state ───────────────────────────────────────────────────
  const [paymentMethods,  setPaymentMethods]  = useState<PaymentMethod[]>([]);
  const [selectedPm,      setSelectedPm]      = useState('invoice');
  const [loadingPm,       setLoadingPm]       = useState(false);
  const [orderComplete,   setOrderComplete]   = useState(false);
  const [orderInvoices,   setOrderInvoices]   = useState<string[]>([]);
  const [orderError,      setOrderError]      = useState('');

  // ── Computed flags ───────────────────────────────────────────────────────
  const hasHosting = items.some(i => i.type === 'hosting' || i.type === 'vps');
  const hasDomains = items.some(i => i.type === 'domain');
  const allDomains = items.every(i => i.type === 'domain');

  // Effective steps: skip domain step if all items are domains, skip account if logged in
  const visibleSteps = STEPS.filter((s, i) => {
    if (i === 1 && allDomains) return false; // skip domain config for domain-only carts
    if (i === 2 && loggedInUser) return false; // skip account step if already logged in
    return true;
  });

  // ── On mount: check auth ──────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('noehost_token') || localStorage.getItem('token');
    if (!token) { setAuthChecked(true); return; }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(user => {
        if (user) setLoggedInUser(user);
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
  }, []);

  // ── Fetch payment methods when logged in ──────────────────────────────────
  const fetchPaymentMethods = useCallback(async () => {
    const token = localStorage.getItem('noehost_token') || localStorage.getItem('token');
    if (!token) return;
    setLoadingPm(true);
    try {
      const res = await fetch('/api/payment-methods', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPaymentMethods(Array.isArray(data) ? data : []);
      }
    } catch { /* ignore */ }
    finally { setLoadingPm(false); }
  }, []);

  useEffect(() => {
    if (loggedInUser) fetchPaymentMethods();
  }, [loggedInUser, fetchPaymentMethods]);

  // ── Domain search ─────────────────────────────────────────────────────────
  const handleDomainSearch = async () => {
    if (!domainSearch.trim()) return;
    setSearchingDomain(true);
    try {
      const res  = await fetch(`/api/domain/search?q=${encodeURIComponent(domainSearch.trim())}`);
      const data = await res.json();
      setDomainResults(Array.isArray(data) ? data : []);
    } catch { setDomainResults([]); }
    finally   { setSearchingDomain(false); }
  };

  // ── Auth: login ───────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setLoginError('');
    if (!loginForm.email || !loginForm.password) { setLoginError('Email and password are required.'); return; }
    setSubmitting(true);
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.message || data.error || 'Login failed.'); return; }
      localStorage.setItem('noehost_token', data.token);
      localStorage.setItem('token', data.token);
      setLoggedInUser(data.user);
      await syncWithBackend();
      setStep(3);
    } catch { setLoginError('Network error. Please try again.'); }
    finally   { setSubmitting(false); }
  };

  // ── Auth: register ────────────────────────────────────────────────────────
  const handleRegister = async () => {
    setRegError('');
    if (!regForm.firstName || !regForm.email || !regForm.password) {
      setRegError('First name, email and password are required.'); return;
    }
    setSubmitting(true);
    try {
      const regRes  = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regForm),
      });
      const regData = await regRes.json();
      if (!regRes.ok) { setRegError(regData.message || regData.error || 'Registration failed.'); return; }

      const loginRes  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regForm.email, password: regForm.password }),
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok) { setRegError('Account created! Please use the login tab.'); return; }

      localStorage.setItem('noehost_token', loginData.token);
      localStorage.setItem('token', loginData.token);
      setLoggedInUser(loginData.user || { email: regForm.email, firstName: regForm.firstName });
      await syncWithBackend();
      setStep(3);
    } catch { setRegError('Network error. Please try again.'); }
    finally   { setSubmitting(false); }
  };

  // ── Place order ───────────────────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    const token = localStorage.getItem('noehost_token') || localStorage.getItem('token');
    if (!token) { setStep(2); return; }
    setOrderError('');
    setSubmitting(true);
    const invoiceIds: string[] = [];
    let hadError = false;

    try {
      for (const item of items) {
        let body: Record<string, any> = {
          billingCycle: item.billingCycle,
          paymentMethodId: selectedPm !== 'invoice' ? selectedPm : undefined,
        };

        if (item.type === 'domain') {
          if (!item.domainName) continue;
          body = { domain: item.domainName, registerDomain: true, billingCycle: 'yearly' };
        } else {
          body.packageId = item.planId;
          if (invoiceIds.length === 0) {
            if (domainOption === 'new'      && selectedDomain)  body.domain = selectedDomain;
            if (domainOption === 'existing' && existingDomain)  body.domain = existingDomain;
          }
        }

        const res  = await fetch('/api/dashboard/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        const data = await res.json();

        if (!res.ok) {
          console.warn('[Checkout] item failed:', item.planId, data.error);
          hadError = true;
          setOrderError(data.error || data.message || 'Order could not be placed for one or more items.');
        } else {
          if (data.invoiceId || data.invoice?.id) {
            invoiceIds.push(data.invoiceId || data.invoice?.id);
          }
        }
      }

      if (invoiceIds.length > 0) {
        await clearCart();
        setOrderInvoices(invoiceIds);
        setOrderComplete(true);
      } else if (!hadError) {
        await clearCart();
        setOrderComplete(true);
      }
    } catch (e: any) {
      setOrderError(`Network error: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step helpers ──────────────────────────────────────────────────────────
  const goNext = () => {
    if (step === 0) {
      if (allDomains) {
        if (loggedInUser) setStep(3);
        else setStep(2);
      } else {
        setStep(1);
      }
    } else if (step === 1) {
      if (loggedInUser) setStep(3);
      else setStep(2);
    }
  };

  const goBack = () => {
    if (step === 1) setStep(0);
    else if (step === 2) setStep(allDomains ? 0 : 1);
    else if (step === 3) setStep(loggedInUser ? (allDomains ? 0 : 1) : 2);
  };

  // ── Order complete screen ─────────────────────────────────────────────────
  if (orderComplete) {
    return (
      <div className="min-h-screen bg-[#050505] pt-36 pb-20">
        <div className="container mx-auto px-6 max-w-xl text-center">
          <div
            className="rounded-3xl p-12"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="w-20 h-20 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-emerald-500/10">
              <Check size={36} className="text-emerald-400" />
            </div>
            <h1 className="text-3xl font-black text-white mb-2">Order Received!</h1>
            <p className="text-slate-400 mb-1 font-medium">
              Your order has been submitted successfully.
            </p>
            {orderInvoices.length > 0 && (
              <p className="text-slate-500 text-sm mb-8">
                {orderInvoices.length} invoice{orderInvoices.length > 1 ? 's' : ''} generated — complete payment to activate your services.
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
              {orderInvoices.length === 1 ? (
                <a
                  href={`/dashboard/invoices/${orderInvoices[0]}`}
                  className="inline-flex items-center gap-2 px-8 py-3.5 text-white font-black rounded-2xl transition-all shadow-xl shadow-primary/25 hover:brightness-110"
                  style={{ background: 'linear-gradient(135deg,#673de6,#4c22cc)' }}
                >
                  Pay Invoice <ArrowRight size={18} />
                </a>
              ) : (
                <a
                  href="/dashboard/billing"
                  className="inline-flex items-center gap-2 px-8 py-3.5 text-white font-black rounded-2xl transition-all shadow-xl shadow-primary/25 hover:brightness-110"
                  style={{ background: 'linear-gradient(135deg,#673de6,#4c22cc)' }}
                >
                  View Invoices <ArrowRight size={18} />
                </a>
              )}
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-8 py-3.5 text-white font-black rounded-2xl hover:bg-white/5 transition-all"
                style={{ border: '1px solid rgba(255,255,255,0.10)' }}
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Empty cart screen ─────────────────────────────────────────────────────
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[#050505] pt-36 pb-20">
        <div className="container mx-auto px-6 max-w-xl text-center">
          <div
            className="rounded-3xl p-12"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <ShoppingCart className="mx-auto mb-6 text-slate-600" size={56} />
            <h1 className="text-2xl font-black text-white mb-3">Your cart is empty</h1>
            <p className="text-slate-400 mb-8">Browse our plans and add something to get started.</p>
            <Link
              to="/shared-hosting"
              className="inline-flex items-center gap-2 px-8 py-3.5 text-white font-black rounded-2xl shadow-xl shadow-primary/25 hover:brightness-110 transition-all"
              style={{ background: 'linear-gradient(135deg,#673de6,#4c22cc)' }}
            >
              Browse Plans <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Compute display steps (skip hidden steps in indicator) ────────────────
  const getStepIndex = (raw: number) => {
    // Map raw step index to visual position
    if (allDomains && loggedInUser) {
      // only step 0 and 3 are shown
      return raw === 0 ? 0 : 1;
    }
    if (allDomains) return raw === 0 ? 0 : raw === 2 ? 1 : 2;
    if (loggedInUser) return raw <= 1 ? raw : raw - 1;
    return raw;
  };

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#050505] pt-28 pb-20">
      <div className="container mx-auto px-4 max-w-5xl">

        {/* ── Page header ── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">Secure Checkout</h1>
            <p className="text-sm text-slate-500 font-medium mt-0.5">{items.length} item{items.length !== 1 ? 's' : ''} in your order</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1.5"><ShieldCheck size={12} className="text-emerald-500" /> SSL Secured</span>
            <span className="hidden sm:flex items-center gap-1.5"><BadgeCheck size={12} className="text-primary" /> Verified Business</span>
            <span className="hidden sm:flex items-center gap-1.5"><Zap size={12} className="text-amber-500" /> Instant Setup</span>
          </div>
        </div>

        {/* ── Step indicator ── */}
        <div className="flex items-center mb-8 gap-0">
          {visibleSteps.map((s, i) => {
            const rawIdx = STEPS.findIndex(x => x.id === s.id);
            const done   = rawIdx < step;
            const active = rawIdx === step;
            return (
              <React.Fragment key={s.id}>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                    done   ? 'bg-emerald-500 text-white' :
                    active ? 'text-white shadow-lg shadow-primary/40' :
                    'text-slate-600'
                  }`}
                    style={active ? { background: 'linear-gradient(135deg,#673de6,#4c22cc)' } : done ? {} : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    {done ? <Check size={14} /> : <s.icon size={14} />}
                  </div>
                  <span className={`text-xs font-bold hidden sm:inline ${done || active ? 'text-white' : 'text-slate-600'}`}>{s.label}</span>
                </div>
                {i < visibleSteps.length - 1 && (
                  <div className={`flex-grow h-px mx-3 ${done ? 'bg-emerald-500/50' : 'bg-white/8'}`} style={{ background: done ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.06)' }} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* ── Two-column layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* ════════ LEFT: Step content ════════ */}
          <div className="lg:col-span-2 space-y-4">

            {/* ── STEP 0: Review Order ── */}
            {step === 0 && (
              <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h2 className="text-lg font-black text-white mb-5 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(103,61,230,0.15)' }}>
                    <ShoppingCart size={16} className="text-primary" />
                  </div>
                  Review Your Order
                </h2>
                <div className="space-y-3">
                  {items.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 p-4 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(103,61,230,0.12)' }}>
                        {item.type === 'domain' ? <Globe size={18} className="text-primary" /> : <Server size={18} className="text-primary" />}
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="font-black text-white text-sm truncate">{item.name}</div>
                        <div className="text-xs text-slate-400 font-medium capitalize">
                          {item.type === 'hosting' ? 'Shared Hosting' : item.type === 'vps' ? 'VPS Hosting' : 'Domain'} &middot; {getCycleLabel(item.billingCycle)}
                          {item.domainName && <> &middot; <span className="font-mono">{item.domainName}</span></>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-black text-white text-sm">
                          {convertFromPKR(getItemPrice(item))}
                          <span className="text-slate-500 font-medium text-xs">{getCycleSuffix(item.billingCycle)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Trust row */}
                <div className="flex flex-wrap items-center justify-center gap-4 mt-5 py-4 text-xs text-slate-500 font-medium" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="flex items-center gap-1.5"><ShieldCheck size={12} className="text-emerald-500" /> 30-Day Money Back</span>
                  <span className="flex items-center gap-1.5"><Zap size={12} className="text-amber-400" /> Instant Activation</span>
                  <span className="flex items-center gap-1.5"><Lock size={12} className="text-primary" /> No Setup Fees</span>
                  <span className="flex items-center gap-1.5"><BadgeCheck size={12} className="text-blue-400" /> 99.9% Uptime SLA</span>
                </div>

                <button
                  onClick={goNext}
                  className="mt-4 w-full py-3.5 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all hover:brightness-110 shadow-xl shadow-primary/20"
                  style={{ background: 'linear-gradient(135deg,#673de6,#4c22cc)' }}
                >
                  Continue <ChevronRight size={18} />
                </button>
              </div>
            )}

            {/* ── STEP 1: Domain Configuration ── */}
            {step === 1 && (
              <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h2 className="text-lg font-black text-white mb-5 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(103,61,230,0.15)' }}>
                    <Globe size={16} className="text-primary" />
                  </div>
                  Domain Configuration
                </h2>
                <p className="text-sm text-slate-400 font-medium mb-5">Associate a domain with your hosting plan — or skip and set it up later.</p>

                <div className="space-y-2 mb-5">
                  {[
                    { value: 'new'      as const, label: 'Register a New Domain',     desc: 'Search and register a brand new domain name', icon: Globe },
                    { value: 'existing' as const, label: 'I Already Have a Domain',   desc: 'Point an existing domain to your new hosting', icon: Package },
                    { value: 'skip'     as const, label: 'Skip — I\'ll Add It Later', desc: "You can add a domain anytime from your control panel", icon: ArrowRight },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setDomainOption(opt.value)}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3 ${
                        domainOption === opt.value
                          ? 'border-primary/60 bg-primary/8'
                          : 'hover:border-white/15'
                      }`}
                      style={{
                        borderColor: domainOption === opt.value ? 'rgba(103,61,230,0.5)' : 'rgba(255,255,255,0.08)',
                        background:  domainOption === opt.value ? 'rgba(103,61,230,0.08)' : 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${domainOption === opt.value ? 'bg-primary/15' : 'bg-white/5'}`}>
                        <opt.icon size={15} className={domainOption === opt.value ? 'text-primary' : 'text-slate-500'} />
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className={`font-black text-sm ${domainOption === opt.value ? 'text-white' : 'text-slate-300'}`}>{opt.label}</div>
                        <div className="text-xs text-slate-500 font-medium">{opt.desc}</div>
                      </div>
                      {domainOption === opt.value && <Check size={16} className="text-primary flex-shrink-0" />}
                    </button>
                  ))}
                </div>

                {domainOption === 'new' && (
                  <div className="mb-5 space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. mysite.com"
                        value={domainSearch}
                        onChange={e => setDomainSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleDomainSearch()}
                        className="flex-grow rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-1 focus:ring-primary font-medium"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
                      />
                      <button
                        onClick={handleDomainSearch}
                        disabled={searchingDomain}
                        className="px-5 py-3 text-white font-black text-sm rounded-xl disabled:opacity-50 flex items-center gap-2 transition-all hover:brightness-110"
                        style={{ background: 'linear-gradient(135deg,#673de6,#4c22cc)' }}
                      >
                        {searchingDomain ? <Loader2 size={15} className="animate-spin" /> : 'Search'}
                      </button>
                    </div>
                    {domainResults.length > 0 && (
                      <div className="space-y-1.5 max-h-52 overflow-y-auto rounded-xl p-2" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        {domainResults.map(d => (
                          <button
                            key={d.domain}
                            onClick={() => d.available && setSelectedDomain(d.domain)}
                            disabled={!d.available}
                            className={`w-full flex items-center justify-between p-3 rounded-lg text-sm transition-all ${
                              selectedDomain === d.domain ? 'bg-primary/15 border border-primary/40' :
                              d.available ? 'hover:bg-white/5' :
                              'opacity-40 cursor-not-allowed'
                            }`}
                          >
                            <span className="font-bold text-white">{d.domain}</span>
                            <span className={`font-black text-xs px-2 py-0.5 rounded-full ${d.available ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                              {d.available ? (d.registerPrice ? `${convertFromPKR(parseFloat(d.registerPrice))}/yr` : 'Available') : 'Taken'}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedDomain && (
                      <div className="p-3 rounded-xl text-emerald-400 text-sm font-bold flex items-center gap-2" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.20)' }}>
                        <Check size={14} /> Selected: {selectedDomain}
                      </div>
                    )}
                  </div>
                )}

                {domainOption === 'existing' && (
                  <div className="mb-5">
                    <input
                      type="text"
                      placeholder="e.g. example.com"
                      value={existingDomain}
                      onChange={e => setExistingDomain(e.target.value)}
                      className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-1 focus:ring-primary font-medium"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
                    />
                    <p className="text-xs text-slate-500 font-medium mt-2">You'll update your domain's nameservers after activation.</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={goBack}
                    className="flex-1 py-3 font-black text-sm rounded-2xl text-slate-300 hover:text-white flex items-center justify-center gap-2 transition-all"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <ArrowLeft size={15} /> Back
                  </button>
                  <button
                    onClick={goNext}
                    className="flex-1 py-3 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 transition-all hover:brightness-110 shadow-lg shadow-primary/20"
                    style={{ background: 'linear-gradient(135deg,#673de6,#4c22cc)' }}
                  >
                    Continue <ChevronRight size={17} />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 2: Account ── */}
            {step === 2 && (
              <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h2 className="text-lg font-black text-white mb-2 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(103,61,230,0.15)' }}>
                    <User size={16} className="text-primary" />
                  </div>
                  Account Details
                </h2>
                <p className="text-sm text-slate-400 font-medium mb-5">
                  Sign in or create a free account to complete your order. Your cart is saved.
                </p>

                {/* Tab switcher */}
                <div className="flex gap-1.5 mb-5 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {(['login', 'register'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setAuthMode(mode)}
                      className={`flex-1 py-2.5 text-sm font-black rounded-lg transition-all ${
                        authMode === mode
                          ? 'text-white shadow-lg'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                      style={authMode === mode ? { background: 'linear-gradient(135deg,#673de6,#4c22cc)' } : {}}
                    >
                      {mode === 'login' ? 'Sign In' : 'Create Account'}
                    </button>
                  ))}
                </div>

                {authMode === 'login' ? (
                  <div className="space-y-3">
                    <input
                      type="email"
                      placeholder="Email Address"
                      value={loginForm.email}
                      onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-1 focus:ring-primary font-medium"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
                    />
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Password"
                        value={loginForm.password}
                        onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && handleLogin()}
                        className="w-full rounded-xl px-4 py-3 pr-12 text-white text-sm outline-none focus:ring-1 focus:ring-primary font-medium"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
                      />
                      <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                    {loginError && (
                      <div className="flex items-center gap-2 text-red-400 text-sm font-bold p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                        <AlertCircle size={14} /> {loginError}
                      </div>
                    )}
                    <button
                      onClick={handleLogin}
                      disabled={submitting}
                      className="w-full py-3.5 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:brightness-110 shadow-lg shadow-primary/20"
                      style={{ background: 'linear-gradient(135deg,#673de6,#4c22cc)' }}
                    >
                      {submitting ? <Loader2 size={17} className="animate-spin" /> : <><Lock size={15} /> Sign In & Continue</>}
                    </button>
                    <div className="text-center">
                      <a href="/forgot-password" className="text-xs text-slate-500 hover:text-primary transition-colors font-medium">Forgot your password?</a>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        placeholder="First Name *"
                        value={regForm.firstName}
                        onChange={e => setRegForm(f => ({ ...f, firstName: e.target.value }))}
                        className="rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-1 focus:ring-primary font-medium"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
                      />
                      <input
                        placeholder="Last Name"
                        value={regForm.lastName}
                        onChange={e => setRegForm(f => ({ ...f, lastName: e.target.value }))}
                        className="rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-1 focus:ring-primary font-medium"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
                      />
                    </div>
                    <input
                      type="email"
                      placeholder="Email Address *"
                      value={regForm.email}
                      onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-1 focus:ring-primary font-medium"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
                    />
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Password *"
                        value={regForm.password}
                        onChange={e => setRegForm(f => ({ ...f, password: e.target.value }))}
                        className="w-full rounded-xl px-4 py-3 pr-12 text-white text-sm outline-none focus:ring-1 focus:ring-primary font-medium"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
                      />
                      <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                    <input
                      type="tel"
                      placeholder="Phone Number"
                      value={regForm.phone}
                      onChange={e => setRegForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-1 focus:ring-primary font-medium"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
                    />
                    {regError && (
                      <div className="flex items-center gap-2 text-red-400 text-sm font-bold p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                        <AlertCircle size={14} /> {regError}
                      </div>
                    )}
                    <button
                      onClick={handleRegister}
                      disabled={submitting}
                      className="w-full py-3.5 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:brightness-110 shadow-lg shadow-primary/20"
                      style={{ background: 'linear-gradient(135deg,#673de6,#4c22cc)' }}
                    >
                      {submitting ? <Loader2 size={17} className="animate-spin" /> : <><Lock size={15} /> Create Account & Continue</>}
                    </button>
                    <p className="text-xs text-slate-500 text-center font-medium">
                      By creating an account, you agree to our{' '}
                      <Link to="/terms-of-service" className="text-primary hover:underline">Terms of Service</Link>
                      {' '}and{' '}
                      <Link to="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link>.
                    </p>
                  </div>
                )}

                <button
                  onClick={goBack}
                  className="mt-4 w-full py-2.5 font-black text-sm rounded-xl text-slate-400 hover:text-white flex items-center justify-center gap-2 transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <ArrowLeft size={14} /> Back
                </button>
              </div>
            )}

            {/* ── STEP 3: Payment / Place Order ── */}
            {step === 3 && (
              <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h2 className="text-lg font-black text-white mb-5 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(103,61,230,0.15)' }}>
                    <CreditCard size={16} className="text-primary" />
                  </div>
                  Complete Your Order
                </h2>

                {loggedInUser && (
                  <div className="flex items-center gap-2 p-3 rounded-xl text-emerald-400 text-sm font-bold mb-5" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <Check size={14} /> Placing order as <span className="font-mono">{loggedInUser.email}</span>
                  </div>
                )}

                {/* Payment method selector */}
                {loadingPm ? (
                  <div className="flex items-center gap-2 text-slate-400 text-sm font-medium mb-5">
                    <Loader2 size={14} className="animate-spin" /> Loading payment options…
                  </div>
                ) : paymentMethods.length > 0 ? (
                  <div className="mb-5">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Select Payment Method</p>
                    <div className="space-y-2">
                      {/* Pay by invoice option (always available) */}
                      <button
                        onClick={() => setSelectedPm('invoice')}
                        className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left`}
                        style={{
                          borderColor: selectedPm === 'invoice' ? 'rgba(103,61,230,0.5)' : 'rgba(255,255,255,0.08)',
                          background:  selectedPm === 'invoice' ? 'rgba(103,61,230,0.08)' : 'rgba(255,255,255,0.02)',
                        }}
                      >
                        <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
                          <Landmark size={15} className="text-slate-300" />
                        </div>
                        <div className="flex-grow min-w-0">
                          <div className="text-sm font-black text-white">Pay Later via Invoice</div>
                          <div className="text-xs text-slate-500 font-medium">Invoice generated — pay from your client area</div>
                        </div>
                        {selectedPm === 'invoice' && <Check size={15} className="text-primary flex-shrink-0" />}
                      </button>

                      {paymentMethods.map(pm => (
                        <button
                          key={pm.id}
                          onClick={() => setSelectedPm(pm.id)}
                          className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left`}
                          style={{
                            borderColor: selectedPm === pm.id ? 'rgba(103,61,230,0.5)' : 'rgba(255,255,255,0.08)',
                            background:  selectedPm === pm.id ? 'rgba(103,61,230,0.08)' : 'rgba(255,255,255,0.02)',
                          }}
                        >
                          <PayIcon type={pm.type} />
                          <div className="flex-grow min-w-0">
                            <div className="text-sm font-black text-white">{pm.name}</div>
                            {pm.description && <div className="text-xs text-slate-500 font-medium">{pm.description}</div>}
                            {pm.publicSettings?.mobileNumber && (
                              <div className="text-xs text-slate-400 font-mono mt-0.5">{pm.publicSettings.mobileNumber}</div>
                            )}
                          </div>
                          {selectedPm === pm.id && <Check size={15} className="text-primary flex-shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mb-5 p-3 rounded-xl text-slate-400 text-sm font-medium" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    An invoice will be generated. Pay from your client area to activate your services immediately.
                  </div>
                )}

                {orderError && (
                  <div className="flex items-start gap-2 text-red-400 text-sm font-bold p-3 rounded-xl mb-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5" /> {orderError}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={goBack}
                    className="flex-1 py-3 font-black text-sm rounded-2xl text-slate-300 hover:text-white flex items-center justify-center gap-2 transition-all"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <ArrowLeft size={15} /> Back
                  </button>
                  <button
                    onClick={handlePlaceOrder}
                    disabled={submitting}
                    className="flex-1 py-3 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:brightness-110 shadow-xl shadow-emerald-500/20"
                    style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}
                  >
                    {submitting ? <Loader2 size={17} className="animate-spin" /> : <><Lock size={15} /> Place Order</>}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ════════ RIGHT: Order Summary Sidebar ════════ */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl p-5 sticky top-32" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Order Summary</h3>

              <div className="space-y-2 mb-4">
                {items.map(item => (
                  <div key={item.id} className="flex justify-between items-start gap-2 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate">{item.name}</div>
                      <div className="text-xs text-slate-500 font-medium capitalize">{getCycleLabel(item.billingCycle)}</div>
                    </div>
                    <div className="text-sm font-black text-primary flex-shrink-0">
                      {convertFromPKR(getItemPrice(item))}
                    </div>
                  </div>
                ))}
              </div>

              {domainOption === 'new' && selectedDomain && (
                <div className="flex justify-between items-center py-2 text-sm mb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className="text-slate-400 font-mono text-xs truncate">{selectedDomain}</span>
                  <span className="text-slate-400 font-bold text-xs ml-2">+domain</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <span className="text-white font-black">Total</span>
                <span className="text-xl font-black text-primary">{convertFromPKR(getTotal())}</span>
              </div>

              {loggedInUser && (
                <div className="mt-4 p-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                  <div className="text-emerald-400 font-black text-xs flex items-center gap-1.5">
                    <Check size={11} /> {loggedInUser.email || loggedInUser.firstName}
                  </div>
                </div>
              )}

              {/* Trust badges */}
              <div className="mt-5 space-y-2">
                {[
                  { icon: ShieldCheck, color: 'text-emerald-400', label: '30-Day Money-Back' },
                  { icon: Lock,        color: 'text-primary',     label: 'SSL Encrypted Checkout' },
                  { icon: Star,        color: 'text-amber-400',   label: '99.9% Uptime Guarantee' },
                ].map(({ icon: Icon, color, label }) => (
                  <div key={label} className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                    <Icon size={12} className={color} />
                    {label}
                  </div>
                ))}
              </div>

              <Link
                to="/shared-hosting"
                className="mt-5 block text-center text-xs text-slate-600 hover:text-slate-400 font-medium transition-colors"
              >
                ← Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
