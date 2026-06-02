import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useBranding } from "@/hooks/use-branding";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Eye, EyeOff, ShieldCheck, RefreshCw, Gift,
  AlertCircle, ChevronDown, MapPin, Search, Building2,
  User, AtSign, Phone, Mail, CheckCircle2, ArrowRight,
  Home, Lock,
} from "lucide-react";
import CaptchaWidget from "@/components/CaptchaWidget";
import { PhoneInput } from "@/components/PhoneInput";
import { useQuery } from "@tanstack/react-query";
import { useCurrency } from "@/context/CurrencyProvider";
import { COUNTRIES, countryToCurrency, type CountryOption } from "@/lib/countries";

async function apiFetch(url: string, token: string | null, opts?: RequestInit) {
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts?.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Request failed");
  return data;
}

const BRAND = "#6B46C1";
const defaultCountry = COUNTRIES.find(c => c.code === "PK") ?? COUNTRIES[0]!;

function CountryDropdown({ value, onChange, detecting }: {
  value: CountryOption; onChange: (c: CountryOption) => void; detecting: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) setTimeout(() => searchRef.current?.focus(), 50); }, [open]);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(""); }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);
  const filtered = search.trim()
    ? COUNTRIES.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase()))
    : COUNTRIES;
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full h-11 flex items-center gap-2.5 px-3.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm text-gray-800 transition-all focus:outline-none focus:ring-2 focus:ring-[#6B46C1]/25 focus:border-[#6B46C1]">
        <span className="text-xl leading-none shrink-0">{value.flag}</span>
        <span className="flex-1 text-left truncate">{value.name}
          {detecting && <span className="ml-2 text-[10px] text-violet-500 animate-pulse">detecting…</span>}
        </span>
        <span className="text-xs font-mono text-gray-400 shrink-0">{value.currency}</span>
        <ChevronDown size={13} className={`text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="absolute top-full left-0 right-0 z-50 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search country…"
                  className="w-full h-8 pl-7 pr-3 text-xs rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-[#6B46C1]/25 bg-gray-50" />
              </div>
            </div>
            <ul className="max-h-52 overflow-y-auto">
              {filtered.length === 0
                ? <li className="px-4 py-3 text-xs text-gray-400 text-center">No results</li>
                : filtered.map(c => (
                  <li key={c.code} onClick={() => { onChange(c); setOpen(false); setSearch(""); }}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer text-sm ${c.code === value.code ? "bg-violet-50 text-violet-700" : "hover:bg-gray-50 text-gray-700"}`}>
                    <span className="text-base leading-none shrink-0">{c.flag}</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-xs font-mono text-gray-400">{c.currency}</span>
                  </li>
                ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type Step = "form" | "verify";
type FieldErrors = Partial<Record<string, string>>;

export default function Register() {
  const { login } = useAuth();
  const { logoUrl, siteName } = useBranding();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { currency, setCurrency, allCurrencies } = useCurrency();

  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(defaultCountry);
  const [detectingIp, setDetectingIp] = useState(true);
  const [step, setStep] = useState<Step>("form");
  const [tempToken, setTempToken] = useState("");

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", password: "",
    username: "", company: "", phone: "",
    address1: "", city: "", state: "", postCode: "",
  });

  const [verifyCode, setVerifyCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [resending, setResending] = useState(false);

  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [refCode, setRefCode] = useState<string | null>(null);

  const { data: captchaConfig } = useQuery({
    queryKey: ["captcha-config"],
    queryFn: () => fetch("/api/security/captcha-config").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  const captchaRequired = captchaConfig?.enabledPages?.register && !!captchaConfig?.siteKey;

  function applyCountry(country: CountryOption) {
    setSelectedCountry(country);
    const matched = allCurrencies.find(c => c.code === countryToCurrency(country.code));
    if (matched) setCurrency(matched);
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/global/config", { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const d = await res.json();
          const match = COUNTRIES.find(c => c.code === (d?.detectedCountry as string));
          if (match) applyCountry(match);
        }
      } catch { }
      setDetectingIp(false);
    })();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref") || localStorage.getItem("referralCode");
    if (ref) setRefCode(ref);
  }, []);

  // Auto-generate username from email
  useEffect(() => {
    if (form.email.includes("@")) {
      const base = form.email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 16);
      if (base.length >= 3) setForm(prev => ({ ...prev, username: base }));
    }
  }, [form.email]);

  function startCountdown() {
    setCountdown(60);
    const t = setInterval(() => setCountdown(c => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; }), 1000);
  }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    setFieldErrors(prev => ({ ...prev, [field]: undefined }));
    setFormError(null);
  };

  const inputCls = (field?: string) =>
    `w-full h-11 px-4 rounded-xl border text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:ring-2 focus:ring-[#6B46C1]/25 focus:border-[#6B46C1] bg-white ${field && fieldErrors[field] ? "border-red-400 bg-red-50" : "border-gray-200"}`;

  function validate() {
    const errs: FieldErrors = {};
    if (!form.firstName.trim())          errs.firstName = "Required";
    if (!form.lastName.trim())           errs.lastName  = "Required";
    if (!form.email.trim())              errs.email     = "Required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = "Enter a valid email";
    if (!form.password)                  errs.password  = "Required";
    else if (form.password.length < 8)   errs.password  = "Min. 8 characters";
    if (!form.phone.trim())              errs.phone     = "Phone number is required";
    if (!form.address1.trim())           errs.address1  = "Required";
    if (!form.city.trim())               errs.city      = "Required";
    if (!form.postCode.trim())           errs.postCode  = "Required";
    if (form.username && form.username.length < 3) errs.username = "Min. 3 characters";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (captchaRequired && !captchaToken) { setFormError("Please complete the security check."); return; }
    setFormError(null);
    setLoading(true);
    try {
      const billingCurrency = allCurrencies.find(c => c.code === currency.code)?.code ?? selectedCountry.currency;
      const data = await apiFetch("/api/auth/register", null, {
        method: "POST",
        body: JSON.stringify({
          ...form, country: selectedCountry.code, billingCurrency,
          ...(refCode ? { refCode } : {}),
          ...(captchaToken ? { captchaToken } : {}),
        }),
      });
      setTempToken(data.token);
      if (refCode) { localStorage.removeItem("referralCode"); }
      if (data.requiresVerification) {
        setStep("verify");
        startCountdown();
        toast({ title: "Code sent!", description: `Check your email${form.phone ? " and WhatsApp/SMS" : ""}` });
      } else {
        login(data.token);
        redirect();
      }
    } catch (err: any) {
      setFormError(err.message || "Registration failed. Please try again.");
    } finally { setLoading(false); }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/api/auth/verify-email", tempToken, { method: "POST", body: JSON.stringify({ code: verifyCode }) });
      login(tempToken);
      toast({ title: "Account verified!", description: "Welcome to Noehost." });
      redirect();
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleResend() {
    setResending(true);
    try {
      await apiFetch("/api/auth/resend-verification", tempToken, { method: "POST" });
      startCountdown();
      toast({ title: "Code resent", description: "Check your email and phone." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setResending(false); }
  }

  function redirect() {
    const p = new URLSearchParams(window.location.search);
    const next = p.get("next") || p.get("redirect");
    const hasPendingCart = (() => { try { return JSON.parse(localStorage.getItem("noehost_website_cart") || "[]").length > 0; } catch { return false; } })();
    setLocation(next || (hasPendingCart ? "/dashboard/orders/new" : "/dashboard"));
  }

  const pwdLen = form.password.length;
  const pwdStrength = pwdLen === 0 ? 0 : pwdLen < 8 ? 1 : pwdLen < 12 ? 2 : 3;
  const pwdColors = ["", "bg-red-400", "bg-yellow-400", "bg-emerald-500"];
  const pwdLabels = ["", "Weak", "Good", "Strong"];

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-10"
      style={{ background: "linear-gradient(135deg, #faf8ff 0%, #f3eeff 40%, #ffffff 100%)" }}>
      <div className="w-full max-w-[520px]">

        {/* Logo */}
        <div className="flex flex-col items-center mb-7">
          {logoUrl ? (
            <img src={logoUrl} alt={siteName} className="brand-logo-img mb-3 drop-shadow-[0_4px_12px_rgba(139,92,246,0.30)]" style={{ maxHeight: 52, width: "auto" }} />
          ) : (
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 shadow-xl shadow-violet-500/30 font-bold text-white text-xl"
              style={{ background: "linear-gradient(135deg, #6B46C1 0%, #7C5DE2 100%)" }}>
              {siteName?.[0] ?? "N"}
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Create your account</h1>
          <p className="text-gray-500 text-sm mt-1">Professional hosting, globally priced</p>
        </div>

        {/* 2-step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {["Account Details", "Verify"].map((label, i) => {
            const active = (i === 0 && step === "form") || (i === 1 && step === "verify");
            const done = i === 0 && step === "verify";
            return (
              <div key={i} className="flex items-center gap-2">
                <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all ${
                  done ? "bg-emerald-500 text-white" : active ? "text-white shadow-lg" : "bg-gray-100 text-gray-400"
                }`} style={active ? { background: `linear-gradient(135deg, ${BRAND} 0%, #7C5DE2 100%)` } : {}}>
                  {done ? <CheckCircle2 size={14} /> : i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${active ? "text-violet-700" : done ? "text-emerald-600" : "text-gray-400"}`}>{label}</span>
                {i === 0 && <div className={`w-10 h-px mx-1 ${step === "verify" ? "bg-emerald-300" : "bg-gray-200"}`} />}
              </div>
            );
          })}
        </div>

        <AnimatePresence mode="wait">

          {/* ── Step 1: Registration form ── */}
          {step === "form" && (
            <motion.div key="form" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-2xl shadow-2xl shadow-violet-500/10 border border-gray-100/80 p-7">

              {refCode && (
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 mb-5">
                  <Gift size={14} className="shrink-0" /><span>You were referred — a welcome bonus may apply!</span>
                </div>
              )}

              {/* Google */}
              <button type="button" onClick={() => { window.location.href = "/api/auth/google/start"; }}
                className="w-full h-11 flex items-center justify-center gap-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-all shadow-sm hover:shadow-md">
                <svg width="17" height="17" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/><path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/></svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">or fill in your details</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {formError && (
                <div className="flex items-start gap-2.5 px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 mb-4">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" /><span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4" noValidate>

                {/* Name */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                      <User size={10} className="text-gray-400" /> First name <span className="text-red-400">*</span>
                    </label>
                    <input name="firstName" value={form.firstName} onChange={set("firstName")} placeholder="John" className={inputCls("firstName")} autoComplete="given-name" />
                    {fieldErrors.firstName && <p className="mt-1 text-[11px] text-red-500">{fieldErrors.firstName}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Last name <span className="text-red-400">*</span></label>
                    <input name="lastName" value={form.lastName} onChange={set("lastName")} placeholder="Smith" className={inputCls("lastName")} autoComplete="family-name" />
                    {fieldErrors.lastName && <p className="mt-1 text-[11px] text-red-500">{fieldErrors.lastName}</p>}
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                    <Mail size={10} className="text-gray-400" /> Email address <span className="text-red-400">*</span>
                  </label>
                  <input type="email" name="email" value={form.email} onChange={set("email")} placeholder="you@example.com" className={inputCls("email")} autoComplete="email" />
                  {fieldErrors.email && <p className="mt-1 text-[11px] text-red-500">{fieldErrors.email}</p>}
                </div>

                {/* Username */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                    <AtSign size={10} className="text-gray-400" /> Username
                    <span className="ml-1 text-[10px] font-normal text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded-full">auto-detected from email</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">@</span>
                    <input name="username" value={form.username} onChange={set("username")} placeholder="your_username"
                      className={`${inputCls("username")} pl-8`} autoComplete="username" />
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400">Login with username OR email. Min. 3 characters.</p>
                  {fieldErrors.username && <p className="mt-1 text-[11px] text-red-500">{fieldErrors.username}</p>}
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                    <Lock size={10} className="text-gray-400" /> Password <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input type={showPwd ? "text" : "password"} name="password" value={form.password} onChange={set("password")}
                      placeholder="Min. 8 characters" className={`${inputCls("password")} pr-11`} autoComplete="new-password" />
                    <button type="button" onClick={() => setShowPwd(p => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {form.password.length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 flex gap-1">
                        {[1, 2, 3].map(n => (
                          <div key={n} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${n <= pwdStrength ? pwdColors[pwdStrength] : "bg-gray-100"}`} />
                        ))}
                      </div>
                      <span className={`text-[11px] font-medium ${pwdStrength === 1 ? "text-red-400" : pwdStrength === 2 ? "text-yellow-500" : "text-emerald-600"}`}>
                        {pwdLabels[pwdStrength]}
                      </span>
                    </div>
                  )}
                  {fieldErrors.password && <p className="mt-1 text-[11px] text-red-500">{fieldErrors.password}</p>}
                </div>

                {/* Phone (required) — above country */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                    <Phone size={10} className="text-gray-400" /> Phone number <span className="text-red-400">*</span>
                    <span className="ml-1 text-[10px] font-normal text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded-full">code sent here too</span>
                  </label>
                  <PhoneInput value={form.phone}
                    onChange={val => { setForm(prev => ({ ...prev, phone: val })); setFieldErrors(prev => ({ ...prev, phone: undefined })); }}
                    countryCode={selectedCountry.code} placeholder="300 1234567" />
                  {fieldErrors.phone && <p className="mt-1 text-[11px] text-red-500">{fieldErrors.phone}</p>}
                </div>

                {/* Company + Country — country below phone */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                      <Building2 size={10} className="text-gray-400" /> Company
                    </label>
                    <input name="company" value={form.company} onChange={set("company")} placeholder="Acme Inc." className={inputCls()} autoComplete="organization" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                      <MapPin size={10} className="text-gray-400" /> Country <span className="text-red-400">*</span>
                    </label>
                    <CountryDropdown value={selectedCountry} onChange={applyCountry} detecting={detectingIp} />
                  </div>
                </div>

                {/* Billing Address */}
                <div>
                  <div className="flex items-center gap-2 mb-3 mt-1">
                    <Home size={12} className="text-gray-400" />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Billing Address</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Street address <span className="text-red-400">*</span></label>
                      <input name="address1" value={form.address1} onChange={set("address1")} placeholder="123 Main Street" className={inputCls("address1")} autoComplete="street-address" />
                      {fieldErrors.address1 && <p className="mt-1 text-[11px] text-red-500">{fieldErrors.address1}</p>}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">City <span className="text-red-400">*</span></label>
                        <input name="city" value={form.city} onChange={set("city")} placeholder="Karachi" className={inputCls("city")} autoComplete="address-level2" />
                        {fieldErrors.city && <p className="mt-1 text-[11px] text-red-500">{fieldErrors.city}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">State</label>
                        <input name="state" value={form.state} onChange={set("state")} placeholder="Sindh" className={inputCls()} autoComplete="address-level1" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Post code <span className="text-red-400">*</span></label>
                        <input name="postCode" value={form.postCode} onChange={set("postCode")} placeholder="75000" className={inputCls("postCode")} autoComplete="postal-code" />
                        {fieldErrors.postCode && <p className="mt-1 text-[11px] text-red-500">{fieldErrors.postCode}</p>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* CAPTCHA */}
                {captchaRequired && captchaConfig?.siteKey && (
                  <div className="pt-1">
                    <CaptchaWidget siteKey={captchaConfig.siteKey} provider={captchaConfig.provider ?? "turnstile"}
                      onVerify={token => setCaptchaToken(token)} onExpire={() => setCaptchaToken(null)} />
                  </div>
                )}

                <button type="submit" disabled={loading || (captchaRequired && !captchaToken)}
                  className="w-full h-12 mt-1 rounded-xl text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:brightness-110 active:scale-[0.99]"
                  style={{ background: "linear-gradient(135deg, #6B46C1 0%, #7C5DE2 60%, #8B5CF6 100%)" }}>
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Creating account…</> : <>Create Account <ArrowRight size={15} /></>}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-gray-500">
                Already have an account?{" "}
                <a href="/login" className="font-semibold hover:underline" style={{ color: BRAND }}>Sign in</a>
              </p>
            </motion.div>
          )}

          {/* ── Step 2: Combined verify (email + phone same code) ── */}
          {step === "verify" && (
            <motion.div key="verify" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              className="bg-white border border-gray-100 rounded-2xl shadow-2xl shadow-violet-500/10 p-8">

              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: `${BRAND}18` }}>
                  <ShieldCheck size={28} style={{ color: BRAND }} />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Verify your account</h2>
                <p className="text-gray-500 text-sm mt-1.5">
                  We sent a <strong className="text-gray-800">6-digit code</strong> to:
                </p>
                <div className="flex flex-col items-center gap-1.5 mt-3">
                  <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-full px-4 py-1.5 text-sm text-violet-700">
                    <Mail size={13} className="shrink-0" />
                    <span className="font-semibold">{form.email}</span>
                  </div>
                  {form.phone && (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-1.5 text-sm text-emerald-700">
                      <Phone size={13} className="shrink-0" />
                      <span className="font-semibold">{form.phone}</span>
                      <span className="text-xs text-emerald-500">(WhatsApp/SMS)</span>
                    </div>
                  )}
                </div>
                <p className="text-gray-400 text-xs mt-3">Same code works for both · Expires in 10 minutes</p>
              </div>

              <form onSubmit={handleVerify} className="space-y-4">
                <input
                  value={verifyCode}
                  onChange={e => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="• • • • • •"
                  maxLength={6}
                  inputMode="numeric"
                  className="w-full h-14 px-4 rounded-xl border-2 border-gray-200 text-center text-2xl font-mono tracking-[0.6em] text-gray-900 outline-none focus:ring-0 focus:border-[#6B46C1] transition-all bg-gray-50 focus:bg-white"
                />
                <button type="submit" disabled={loading || verifyCode.length !== 6}
                  className="w-full h-12 rounded-xl text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg hover:brightness-110"
                  style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #7C5DE2 100%)` }}>
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Verifying…</> : <><ShieldCheck size={15} /> Verify & Activate Account</>}
                </button>
              </form>

              <div className="mt-5 text-center">
                {countdown > 0 ? (
                  <p className="text-sm text-gray-400">Resend in <span className="font-mono font-semibold text-gray-600">{countdown}s</span></p>
                ) : (
                  <button onClick={handleResend} disabled={resending}
                    className="text-sm font-semibold flex items-center gap-1.5 mx-auto hover:underline disabled:opacity-50" style={{ color: BRAND }}>
                    {resending ? <><RefreshCw size={13} className="animate-spin" /> Sending…</> : "Resend code"}
                  </button>
                )}
              </div>

              <button onClick={() => setStep("form")} className="mt-3 w-full text-xs text-gray-400 hover:text-gray-600 text-center transition-colors">
                ← Back to form
              </button>
            </motion.div>
          )}

        </AnimatePresence>

        <p className="mt-6 text-center text-xs text-gray-400">
          By creating an account you agree to our{" "}
          <a href="/terms-and-conditions" className="hover:underline">Terms of Service</a>{" "}
          and{" "}
          <a href="/privacy-policy" className="hover:underline">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
