import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, ArrowLeft, ArrowRight, Check, User, CreditCard,
  Globe, Package, Lock, Eye, EyeOff, Loader2, AlertCircle,
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useCurrency } from '../../CurrencyContext';

const STEPS = [
  { id: 'review',  label: 'Review Order', icon: ShoppingCart },
  { id: 'domain',  label: 'Domain',       icon: Globe        },
  { id: 'account', label: 'Account',      icon: User         },
  { id: 'payment', label: 'Payment',      icon: CreditCard   },
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

function getItemPrice(item: any) {
  switch (item.billingCycle) {
    case 'monthly':    return item.monthlyPrice;
    case 'quarterly':  return item.quarterlyPrice  ?? item.monthlyPrice * 3;
    case 'semiannual': return item.semiannualPrice ?? item.monthlyPrice * 6;
    case 'yearly':     return item.yearlyPrice     ?? item.monthlyPrice * 12;
    default:           return item.monthlyPrice;
  }
}

const Checkout: React.FC = () => {
  const { items, getTotal, clearCart, syncWithBackend } = useCart();
  const { convertFromPKR } = useCurrency();
  const navigate = useNavigate();

  const [step, setStep]   = useState(0);
  const [loggedInUser, setLoggedInUser] = useState<any>(null);
  const [authChecked, setAuthChecked]   = useState(false);

  const [domainOption,    setDomainOption]    = useState<'new' | 'existing' | 'skip'>('skip');
  const [domainSearch,    setDomainSearch]    = useState('');
  const [domainResults,   setDomainResults]   = useState<any[]>([]);
  const [selectedDomain,  setSelectedDomain]  = useState('');
  const [existingDomain,  setExistingDomain]  = useState('');
  const [searchingDomain, setSearchingDomain] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderInvoices,  setOrderInvoices]  = useState<string[]>([]);
  const [authMode, setAuthMode] = useState<'register' | 'login'>('login');

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', phone: '', company: '', country: 'PK',
  });
  const [loginForm,  setLoginForm]  = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [regError,   setRegError]   = useState('');

  // ── On mount: check if already logged in ────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('noehost_token');
    if (!token) { setAuthChecked(true); return; }

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(user => {
        if (user) setLoggedInUser(user);
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
  }, []);

  // ── Domain search ────────────────────────────────────────────────────────
  const handleDomainSearch = async () => {
    if (!domainSearch.trim()) return;
    setSearchingDomain(true);
    try {
      const res = await fetch(`/api/domain/search?q=${encodeURIComponent(domainSearch.trim())}`);
      const data = await res.json();
      setDomainResults(Array.isArray(data) ? data : []);
    } catch {
      setDomainResults([]);
    } finally {
      setSearchingDomain(false);
    }
  };

  // ── Auth helpers ─────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setLoginError('');
    if (!loginForm.email || !loginForm.password) { setLoginError('Email and password required.'); return; }
    setSubmitting(true);
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.message || data.error || 'Login failed'); return; }
      localStorage.setItem('noehost_token', data.token);
      setLoggedInUser(data.user);
      await syncWithBackend();
      setStep(3);
    } catch { setLoginError('Network error. Please try again.'); }
    finally  { setSubmitting(false); }
  };

  const handleRegister = async () => {
    setRegError('');
    if (!form.firstName || !form.email || !form.password) { setRegError('First name, email and password are required.'); return; }
    setSubmitting(true);
    try {
      const res  = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setRegError(data.message || data.error || 'Registration failed'); return; }

      // Auto-login after registration
      const loginRes  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok) { setRegError('Account created but login failed. Please go to login tab.'); return; }
      localStorage.setItem('noehost_token', loginData.token);
      setLoggedInUser(loginData.user || { email: form.email, firstName: form.firstName });
      await syncWithBackend();
      setStep(3);
    } catch { setRegError('Network error. Please try again.'); }
    finally  { setSubmitting(false); }
  };

  // ── Place order: call backend checkout per item ──────────────────────────
  const handlePlaceOrder = async () => {
    const token = localStorage.getItem('noehost_token');
    if (!token) { setStep(2); return; }

    setSubmitting(true);
    const invoiceIds: string[] = [];
    let hadError = false;

    try {
      for (const item of items) {
        let body: Record<string, any> = { billingCycle: item.billingCycle };

        if (item.type === 'domain') {
          const domainToReg = item.domainName;
          if (!domainToReg) continue;
          body = { domain: domainToReg, registerDomain: true, billingCycle: 'yearly' };
        } else {
          // hosting / vps — use planId as packageId
          body.packageId = item.planId;

          // Attach domain if user chose one and this is the first hosting item
          if (invoiceIds.length === 0) {
            if (domainOption === 'new' && selectedDomain)  body.domain = selectedDomain;
            if (domainOption === 'existing' && existingDomain) body.domain = existingDomain;
          }
        }

        const res  = await fetch('/api/client/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        const data = await res.json();

        if (!res.ok) {
          // Some plans might not be in the backend DB — warn but continue
          console.warn('[Checkout] item failed:', item.planId, data.error);
          hadError = true;
        } else {
          if (data.invoiceId) invoiceIds.push(data.invoiceId);
        }
      }

      if (invoiceIds.length > 0 || !hadError) {
        await clearCart();
        setOrderInvoices(invoiceIds);
        setOrderComplete(true);
      } else {
        alert('Order could not be placed. Please make sure your plan is valid and try again.');
      }
    } catch (e: any) {
      alert(`Network error: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step navigation helpers ───────────────────────────────────────────────
  const goToAccount = () => {
    if (loggedInUser) { setStep(3); }   // already logged in → skip to payment
    else              { setStep(2); }
  };

  // ── Order complete screen ────────────────────────────────────────────────
  if (orderComplete) {
    return (
      <div className="min-h-screen bg-dark pt-36 pb-20">
        <div className="container mx-auto px-6 max-w-2xl text-center">
          <div className="bg-secondary rounded-3xl p-12 border border-white/10">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check size={40} className="text-emerald-400" />
            </div>
            <h1 className="text-3xl font-black text-white mb-3">Order Placed!</h1>
            <p className="text-slate-400 mb-2">
              Your order has been submitted successfully.
              {orderInvoices.length > 0 && ` ${orderInvoices.length} invoice${orderInvoices.length > 1 ? 's' : ''} generated.`}
            </p>
            <p className="text-slate-500 text-sm mb-8">Go to your client area to pay the invoice and activate your services.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="/client/"
                className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-white font-black rounded-2xl hover:bg-primary-600 transition-all"
              >
                Go to Client Area <ArrowRight size={18} />
              </a>
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-8 py-3 border border-white/10 text-white font-black rounded-2xl hover:bg-white/5 transition-all"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-dark pt-36 pb-20">
        <div className="container mx-auto px-6 max-w-2xl text-center">
          <div className="bg-secondary rounded-3xl p-12 border border-white/10">
            <ShoppingCart className="mx-auto mb-6 text-slate-500" size={64} />
            <h1 className="text-3xl font-black text-white mb-3">Cart is Empty</h1>
            <p className="text-slate-400 mb-8">Add some plans to your cart first.</p>
            <Link
              to="/shared-hosting"
              className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-white font-black rounded-2xl hover:bg-primary-600 transition-all"
            >
              Browse Plans <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Effective steps (skip account step display if logged in — show it greyed out as done)
  const effectiveStep = step;

  return (
    <div className="min-h-screen bg-dark pt-36 pb-20">
      <div className="container mx-auto px-6 max-w-4xl">

        {/* Steps */}
        <div className="flex items-center justify-between mb-10 overflow-x-auto">
          {STEPS.map((s, i) => {
            const done = i < effectiveStep || (i === 2 && loggedInUser && effectiveStep >= 2);
            const active = i === effectiveStep && !(i === 2 && loggedInUser);
            return (
              <React.Fragment key={s.id}>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black transition-all ${
                    done   ? 'bg-emerald-500 text-white' :
                    active ? 'bg-primary text-white shadow-lg shadow-primary/30' :
                    'bg-white/5 text-slate-500 border border-white/10'
                  }`}>
                    {done ? <Check size={18} /> : <s.icon size={18} />}
                  </div>
                  <span className={`text-sm font-black hidden sm:inline ${
                    done || active ? 'text-white' : 'text-slate-500'
                  }`}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-grow h-0.5 mx-3 rounded-full ${done ? 'bg-emerald-500' : 'bg-white/10'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">

            {/* ── Step 0: Review Order ── */}
            {step === 0 && (
              <div className="bg-secondary rounded-2xl border border-white/10 p-6">
                <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2">
                  <ShoppingCart size={20} /> Review Your Order
                </h2>
                <div className="space-y-3">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center gap-4 p-4 bg-dark rounded-xl">
                      <Package size={20} className="text-primary flex-shrink-0" />
                      <div className="flex-grow">
                        <div className="font-black text-white text-sm">{item.name}</div>
                        <div className="text-xs text-slate-400 capitalize">
                          {item.type} &middot; {item.billingCycle}
                          {item.domainName && <> &middot; {item.domainName}</>}
                        </div>
                      </div>
                      <div className="text-primary font-black text-sm">
                        {convertFromPKR(getItemPrice(item))}{getCycleSuffix(item.billingCycle)}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="mt-6 w-full py-3 bg-primary text-white font-black rounded-2xl hover:bg-primary-600 transition-all flex items-center justify-center gap-2"
                >
                  Continue <ArrowRight size={18} />
                </button>
              </div>
            )}

            {/* ── Step 1: Domain ── */}
            {step === 1 && (
              <div className="bg-secondary rounded-2xl border border-white/10 p-6">
                <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2">
                  <Globe size={20} /> Domain Configuration
                </h2>

                <div className="space-y-3 mb-6">
                  {[
                    { value: 'new'      as const, label: 'Register a New Domain', desc: 'Search and register a brand new domain name' },
                    { value: 'existing' as const, label: 'I Already Have a Domain', desc: 'Use a domain you already own' },
                    { value: 'skip'     as const, label: 'Skip for Now', desc: "I'll set up a domain later" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setDomainOption(opt.value)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        domainOption === opt.value ? 'border-primary bg-primary/5' : 'border-white/10 bg-dark hover:border-white/20'
                      }`}
                    >
                      <div className="font-black text-white text-sm">{opt.label}</div>
                      <div className="text-xs text-slate-400">{opt.desc}</div>
                    </button>
                  ))}
                </div>

                {domainOption === 'new' && (
                  <div className="mb-6">
                    <div className="flex gap-2 mb-4">
                      <input
                        type="text"
                        placeholder="Search domain e.g. mysite.com"
                        value={domainSearch}
                        onChange={e => setDomainSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleDomainSearch()}
                        className="flex-grow bg-dark border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-primary"
                      />
                      <button
                        onClick={handleDomainSearch}
                        disabled={searchingDomain}
                        className="px-6 py-3 bg-primary text-white font-black text-sm rounded-xl hover:bg-primary-600 disabled:opacity-50 flex items-center gap-2"
                      >
                        {searchingDomain ? <Loader2 size={16} className="animate-spin" /> : 'Search'}
                      </button>
                    </div>
                    {domainResults.length > 0 && (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {domainResults.map(d => (
                          <button
                            key={d.domain}
                            onClick={() => d.available && setSelectedDomain(d.domain)}
                            disabled={!d.available}
                            className={`w-full flex items-center justify-between p-3 rounded-xl text-sm transition-all ${
                              selectedDomain === d.domain ? 'border-primary bg-primary/10 border' :
                              d.available ? 'bg-dark border border-white/10 hover:border-primary/30' :
                              'bg-dark border border-white/5 opacity-50 cursor-not-allowed'
                            }`}
                          >
                            <span className="font-bold text-white">{d.domain}</span>
                            <span className={`font-black text-xs ${d.available ? 'text-emerald-400' : 'text-red-400'}`}>
                              {d.available ? `${convertFromPKR(parseFloat(d.registerPrice || '0'))}/yr` : 'Taken'}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedDomain && (
                      <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-bold flex items-center gap-2">
                        <Check size={14} /> Selected: {selectedDomain}
                      </div>
                    )}
                  </div>
                )}

                {domainOption === 'existing' && (
                  <div className="mb-6">
                    <input
                      type="text"
                      placeholder="Enter your existing domain e.g. example.com"
                      value={existingDomain}
                      onChange={e => setExistingDomain(e.target.value)}
                      className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-primary"
                    />
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setStep(0)} className="flex-1 py-3 border border-white/10 text-white font-black rounded-2xl hover:bg-white/5 transition-all flex items-center justify-center gap-2">
                    <ArrowLeft size={16} /> Back
                  </button>
                  <button onClick={goToAccount} className="flex-1 py-3 bg-primary text-white font-black rounded-2xl hover:bg-primary-600 transition-all flex items-center justify-center gap-2">
                    Continue <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 2: Account ── */}
            {step === 2 && (
              <div className="bg-secondary rounded-2xl border border-white/10 p-6">
                <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2">
                  <User size={20} /> {loggedInUser ? 'Account Ready' : 'Your Account'}
                </h2>

                {loggedInUser ? (
                  <>
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mb-6">
                      <div className="text-emerald-400 font-black text-sm flex items-center gap-2">
                        <Check size={14} /> Logged in as {loggedInUser.email}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setStep(1)} className="flex-1 py-3 border border-white/10 text-white font-black rounded-2xl hover:bg-white/5 transition-all flex items-center justify-center gap-2">
                        <ArrowLeft size={16} /> Back
                      </button>
                      <button onClick={() => setStep(3)} className="flex-1 py-3 bg-primary text-white font-black rounded-2xl hover:bg-primary-600 transition-all flex items-center justify-center gap-2">
                        Continue to Payment <ArrowRight size={18} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex gap-2 mb-6">
                      {(['login', 'register'] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => setAuthMode(mode)}
                          className={`flex-1 py-2 text-sm font-black rounded-xl transition-all ${
                            authMode === mode ? 'bg-primary text-white' : 'bg-dark text-slate-400 border border-white/10'
                          }`}
                        >
                          {mode === 'login' ? 'Existing Account' : 'New Account'}
                        </button>
                      ))}
                    </div>

                    {authMode === 'login' ? (
                      <div className="space-y-3">
                        <input
                          type="email" placeholder="Email Address"
                          value={loginForm.email}
                          onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))}
                          className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-primary"
                        />
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'} placeholder="Password"
                            value={loginForm.password}
                            onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && handleLogin()}
                            className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 pr-12 text-white text-sm outline-none focus:border-primary"
                          />
                          <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        {loginError && (
                          <div className="flex items-center gap-2 text-red-400 text-sm font-bold">
                            <AlertCircle size={14} /> {loginError}
                          </div>
                        )}
                        <button
                          onClick={handleLogin} disabled={submitting}
                          className="w-full py-3 bg-primary text-white font-black rounded-2xl hover:bg-primary-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {submitting ? <Loader2 size={18} className="animate-spin" /> : <><Lock size={16} /> Login & Continue</>}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <input placeholder="First Name *" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} className="bg-dark border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-primary" />
                          <input placeholder="Last Name"    value={form.lastName}  onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}  className="bg-dark border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-primary" />
                        </div>
                        <input type="email"    placeholder="Email Address *" value={form.email}    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}    className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-primary" />
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'} placeholder="Password *"
                            value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                            className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 pr-12 text-white text-sm outline-none focus:border-primary"
                          />
                          <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        <input placeholder="Phone Number"     value={form.phone}   onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}   className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-primary" />
                        <input placeholder="Company (Optional)" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-primary" />
                        {regError && (
                          <div className="flex items-center gap-2 text-red-400 text-sm font-bold">
                            <AlertCircle size={14} /> {regError}
                          </div>
                        )}
                        <button
                          onClick={handleRegister} disabled={submitting}
                          className="w-full py-3 bg-primary text-white font-black rounded-2xl hover:bg-primary-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {submitting ? <Loader2 size={18} className="animate-spin" /> : <><Lock size={16} /> Create Account & Continue</>}
                        </button>
                      </div>
                    )}

                    <button onClick={() => setStep(1)} className="mt-4 w-full py-2 border border-white/10 text-slate-400 font-black text-sm rounded-xl hover:bg-white/5 transition-all flex items-center justify-center gap-2">
                      <ArrowLeft size={14} /> Back
                    </button>
                  </>
                )}
              </div>
            )}

            {/* ── Step 3: Payment ── */}
            {step === 3 && (
              <div className="bg-secondary rounded-2xl border border-white/10 p-6">
                <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2">
                  <CreditCard size={20} /> Complete Your Order
                </h2>

                {loggedInUser && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mb-4 text-emerald-400 text-sm font-bold flex items-center gap-2">
                    <Check size={14} /> Placing order as {loggedInUser.email}
                  </div>
                )}

                <div className="p-4 bg-dark rounded-xl mb-4">
                  <div className="text-sm text-slate-400 mb-3 font-bold">Order Summary</div>
                  {items.map(item => (
                    <div key={item.id} className="flex justify-between py-2 text-sm">
                      <span className="text-white font-bold">{item.name} <span className="text-slate-500 capitalize">({item.billingCycle})</span></span>
                      <span className="text-primary font-black">{convertFromPKR(getItemPrice(item))}</span>
                    </div>
                  ))}
                  {selectedDomain && (
                    <div className="flex justify-between py-2 text-sm border-t border-white/10 mt-2 pt-2">
                      <span className="text-white font-bold">Domain: {selectedDomain}</span>
                      <span className="text-emerald-400 font-black text-xs">Included</span>
                    </div>
                  )}
                  <div className="flex justify-between py-3 text-lg border-t border-white/10 mt-2 pt-3">
                    <span className="text-white font-black">Total</span>
                    <span className="text-primary font-black">{convertFromPKR(getTotal())}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 mb-5">
                  An invoice will be generated. Pay via your preferred method from the client area to activate services.
                </p>

                <div className="flex gap-3">
                  <button onClick={() => setStep(loggedInUser ? 1 : 2)} className="flex-1 py-3 border border-white/10 text-white font-black rounded-2xl hover:bg-white/5 transition-all flex items-center justify-center gap-2">
                    <ArrowLeft size={16} /> Back
                  </button>
                  <button
                    onClick={handlePlaceOrder} disabled={submitting}
                    className="flex-1 py-3 bg-emerald-500 text-white font-black rounded-2xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-xl shadow-emerald-500/20"
                  >
                    {submitting ? <Loader2 size={18} className="animate-spin" /> : <><Lock size={16} /> Place Order</>}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Order summary sidebar ── */}
          <div className="lg:col-span-1">
            <div className="bg-secondary rounded-2xl border border-white/10 p-6 sticky top-32">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Order Summary</h3>
              {items.map(item => (
                <div key={item.id} className="flex justify-between py-2 text-sm">
                  <span className="text-white font-medium truncate mr-2">{item.name}</span>
                  <span className="text-primary font-black flex-shrink-0">{convertFromPKR(getItemPrice(item))}</span>
                </div>
              ))}
              <div className="border-t border-white/10 mt-3 pt-3 flex justify-between">
                <span className="text-white font-black">Total</span>
                <span className="text-xl text-primary font-black">{convertFromPKR(getTotal())}</span>
              </div>
              {loggedInUser && (
                <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-emerald-400 font-black text-xs flex items-center gap-1.5">
                    <Check size={12} /> {loggedInUser.email}
                  </div>
                </div>
              )}
              <Link
                to="/cart"
                className="mt-4 block text-center text-xs text-slate-400 hover:text-primary font-bold transition-colors"
              >
                ← Edit Cart
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
