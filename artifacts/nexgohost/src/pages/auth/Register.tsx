import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Eye, EyeOff, ShieldCheck, RefreshCw,
  Gift, AlertCircle, CheckCircle2, ChevronDown, MapPin,
} from "lucide-react";
import CaptchaWidget from "@/components/CaptchaWidget";
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

type FieldErrors = Partial<Record<"firstName" | "lastName" | "email" | "password", string>>;

const BRAND = "#701AFE";
const defaultCountry = COUNTRIES.find(c => c.code === "PK") ?? COUNTRIES[0]!;

export default function Register() {
  const { login }       = useAuth();
  const [, setLocation] = useLocation();
  const { toast }       = useToast();
  const { currency, setCurrency, allCurrencies } = useCurrency();

  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(defaultCountry);
  const [detectingIp,     setDetectingIp]     = useState(true);

  const [formData,     setFormData]     = useState({ firstName: "", lastName: "", email: "", password: "", company: "", phone: "" });
  const [showExtras,   setShowExtras]   = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [showPwd,      setShowPwd]      = useState(false);
  const [step,         setStep]         = useState<"form" | "verify">("form");
  const [tempToken,    setTempToken]    = useState("");
  const [code,         setCode]         = useState("");
  const [resending,    setResending]    = useState(false);
  const [countdown,    setCountdown]    = useState(0);
  const [refCode,      setRefCode]      = useState<string | null>(null);
  const [fieldErrors,  setFieldErrors]  = useState<FieldErrors>({});
  const [formError,    setFormError]    = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const { data: captchaConfig } = useQuery({
    queryKey: ["captcha-config"],
    queryFn: () => fetch("/api/security/captcha-config").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  const captchaRequired = captchaConfig?.enabledPages?.register && !!captchaConfig?.siteKey;

  // ── IP Geolocation: auto-detect country on mount ──────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/global/config", {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const d = await res.json();
          const countryCode = d?.detectedCountry as string | null;
          if (countryCode) {
            const match = COUNTRIES.find(c => c.code === countryCode);
            if (match) {
              applyCountry(match);
            }
          }
        }
      } catch { /* non-fatal — stay on PK */ }
      setDetectingIp(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyCountry(country: CountryOption) {
    setSelectedCountry(country);
    const matched = allCurrencies.find(c => c.code === countryToCurrency(country.code));
    if (matched) setCurrency(matched);
  }

  useEffect(() => {
    fetch("/api/auth/google/config")
      .then(r => r.json())
      .catch(() => null);

    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");

    const getCookie = (name: string): string | null => {
      const match = document.cookie.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
      return match ? decodeURIComponent(match[1]) : null;
    };
    const setCookie = (name: string, value: string, days: number) => {
      const exp = new Date();
      exp.setDate(exp.getDate() + days);
      document.cookie = `${name}=${encodeURIComponent(value)};expires=${exp.toUTCString()};path=/;SameSite=Lax`;
    };

    if (ref) {
      setRefCode(ref);
      localStorage.setItem("referralCode", ref);
      fetch("/api/affiliate/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: ref }),
      }).then(r => r.json()).then(d => {
        const days = typeof d?.cookieDays === "number" ? d.cookieDays : 30;
        setCookie("referralCode", ref, days);
      }).catch(() => { setCookie("referralCode", ref, 30); });
    } else {
      const stored = localStorage.getItem("referralCode") || getCookie("referralCode");
      if (stored) setRefCode(stored);
    }
  }, []);

  const startCountdown = () => {
    setCountdown(60);
    const t = setInterval(() => setCountdown(c => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; }), 1000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setFieldErrors(prev => ({ ...prev, [name]: undefined }));
    setFormError(null);
  };

  const validate = (): boolean => {
    const errs: FieldErrors = {};
    if (!formData.firstName.trim())                  errs.firstName = "First name is required.";
    if (!formData.lastName.trim())                   errs.lastName  = "Last name is required.";
    if (!formData.email.trim())                      errs.email     = "Email address is required.";
    else if (!/\S+@\S+\.\S+/.test(formData.email))  errs.email     = "Enter a valid email address.";
    if (!formData.password)                          errs.password  = "Password is required.";
    else if (formData.password.length < 8)           errs.password  = "Must be at least 8 characters.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (captchaRequired && !captchaToken) {
      setFormError("Please complete the security check before registering.");
      return;
    }
    setFormError(null);
    setLoading(true);
    try {
      const billingCurrency = allCurrencies.find(c => c.code === currency.code)?.code ?? selectedCountry.currency;
      const payload = {
        ...formData,
        country: selectedCountry.code,
        billingCurrency,
        ...(refCode ? { refCode } : {}),
        ...(captchaToken ? { captchaToken } : {}),
      };
      const data = await apiFetch("/api/auth/register", null, { method: "POST", body: JSON.stringify(payload) });
      setTempToken(data.token);
      if (refCode) {
        localStorage.removeItem("referralCode");
        document.cookie = "referralCode=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/";
      }
      if (data.requiresVerification) {
        setStep("verify");
        startCountdown();
        toast({ title: "Verification code sent", description: `Check your email at ${formData.email}` });
      } else {
        login(data.token);
        setLocation("/client/dashboard");
      }
    } catch (err: any) {
      setFormError(err.message || "Registration failed. Please try again.");
    } finally { setLoading(false); }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/api/auth/verify-email", tempToken, { method: "POST", body: JSON.stringify({ code }) });
      login(tempToken);
      toast({ title: "Email verified!", description: "Welcome to Noehost." });
      setLocation("/client/dashboard");
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await apiFetch("/api/auth/resend-verification", tempToken, { method: "POST" });
      startCountdown();
      toast({ title: "Code resent", description: "Check your inbox." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setResending(false); }
  };

  const inputCls = (field?: string) =>
    `w-full h-11 px-4 rounded-xl border text-sm text-black placeholder-gray-400 outline-none transition-all focus:ring-2 focus:ring-[#701AFE]/25 focus:border-[#701AFE] bg-white ${
      field && fieldErrors[field as keyof FieldErrors] ? "border-red-400 bg-red-50" : "border-gray-200"
    }`;

  // Password strength meter
  const pwdLen = formData.password.length;
  const pwdStrength = pwdLen === 0 ? 0 : pwdLen < 8 ? 1 : pwdLen < 12 ? 2 : 3;
  const pwdColors = ["", "bg-red-400", "bg-yellow-400", "bg-emerald-500"];
  const pwdLabels = ["", "Weak", "Good", "Strong"];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-white via-violet-50/30 to-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[440px]">

        {/* Logo */}
        <div className="flex flex-col items-center mb-7">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-violet-500/25" style={{ background: BRAND }}>
            <img src={`${import.meta.env.BASE_URL}images/logo-icon.png`} alt="Noehost" className="w-6 h-6" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Create your account</h1>
          <p className="text-gray-500 text-sm mt-1">Professional hosting, globally priced</p>
        </div>

        <AnimatePresence mode="wait">

          {/* ── Registration form ── */}
          {step === "form" && (
            <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="bg-white border border-gray-100 rounded-2xl shadow-xl shadow-black/[0.06] p-7">

              {/* Referral banner */}
              {refCode && (
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 mb-5">
                  <Gift size={14} className="shrink-0" />
                  <span>You were referred — a welcome bonus may apply!</span>
                </div>
              )}

              {/* ── Google sign up ── */}
              <button
                type="button"
                onClick={() => { window.location.href = "/api/auth/google/start"; }}
                className="w-full h-11 flex items-center justify-center gap-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors shadow-sm"
              >
                <svg width="17" height="17" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-[11px] text-gray-400 font-medium">or register with email</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* General form error */}
              {formError && (
                <div className="flex items-start gap-2.5 px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 mb-4">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-3.5" noValidate>

                {/* ── Name row ── */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">First name <span className="text-red-400">*</span></label>
                    <input name="firstName" value={formData.firstName} onChange={handleChange}
                      placeholder="John" className={inputCls("firstName")} autoComplete="given-name" />
                    {fieldErrors.firstName && <p className="mt-1 text-[11px] text-red-500">{fieldErrors.firstName}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Last name <span className="text-red-400">*</span></label>
                    <input name="lastName" value={formData.lastName} onChange={handleChange}
                      placeholder="Smith" className={inputCls("lastName")} autoComplete="family-name" />
                    {fieldErrors.lastName && <p className="mt-1 text-[11px] text-red-500">{fieldErrors.lastName}</p>}
                  </div>
                </div>

                {/* ── Email ── */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email address <span className="text-red-400">*</span></label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange}
                    placeholder="you@example.com" className={inputCls("email")} autoComplete="email" />
                  {fieldErrors.email && <p className="mt-1 text-[11px] text-red-500">{fieldErrors.email}</p>}
                </div>

                {/* ── Password ── */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <input type={showPwd ? "text" : "password"} name="password" value={formData.password} onChange={handleChange}
                      placeholder="Min. 8 characters" className={`${inputCls("password")} pr-11`} autoComplete="new-password" />
                    <button type="button" onClick={() => setShowPwd(p => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {/* Password strength */}
                  {formData.password.length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 flex gap-1">
                        {[1, 2, 3].map(n => (
                          <div key={n} className={`h-1 flex-1 rounded-full transition-colors ${n <= pwdStrength ? pwdColors[pwdStrength] : "bg-gray-100"}`} />
                        ))}
                      </div>
                      <span className={`text-[11px] font-medium ${pwdStrength === 1 ? "text-red-400" : pwdStrength === 2 ? "text-yellow-500" : "text-emerald-600"}`}>
                        {pwdLabels[pwdStrength]}
                      </span>
                    </div>
                  )}
                  {fieldErrors.password && <p className="mt-1 text-[11px] text-red-500">{fieldErrors.password}</p>}
                </div>

                {/* ── Country selector (IP-detected) ── */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <MapPin size={11} className="text-gray-400" />
                      Country &amp; Billing Currency
                      {detectingIp && <span className="text-[10px] text-violet-500 font-normal animate-pulse">detecting…</span>}
                    </span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedCountry.code}
                      onChange={e => {
                        const country = COUNTRIES.find(c => c.code === e.target.value);
                        if (country) applyCountry(country);
                      }}
                      className="w-full h-11 pl-4 pr-9 rounded-xl border border-gray-200 text-sm text-black bg-white outline-none focus:ring-2 focus:ring-[#701AFE]/25 focus:border-[#701AFE] appearance-none transition-all"
                    >
                      {COUNTRIES.map(c => (
                        <option key={c.code} value={c.code}>
                          {c.flag}  {c.name} — {c.currency}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                  <p className="mt-1.5 text-[11px] text-gray-400">
                    Prices show in <strong className="text-gray-600">{selectedCountry.currency}</strong>. Payments settle in PKR via Safepay.
                  </p>
                </div>

                {/* ── Optional extras (Company / Phone) — collapsible ── */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowExtras(v => !v)}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <ChevronDown size={13} className={`transition-transform ${showExtras ? "rotate-180" : ""}`} />
                    {showExtras ? "Hide" : "Add"} optional info (company & phone)
                  </button>

                  <AnimatePresence>
                    {showExtras && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Company</label>
                            <input name="company" value={formData.company} onChange={handleChange}
                              placeholder="Acme Inc." className={inputCls()} autoComplete="organization" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone</label>
                            <input name="phone" value={formData.phone} onChange={handleChange}
                              placeholder="+1 555 000 0000" className={inputCls()} autoComplete="tel" />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ── Captcha ── */}
                {captchaRequired && captchaConfig?.siteKey && (
                  <div className="pt-1">
                    <CaptchaWidget
                      siteKey={captchaConfig.siteKey}
                      provider={captchaConfig.provider ?? "turnstile"}
                      onVerify={token => setCaptchaToken(token)}
                      onExpire={() => setCaptchaToken(null)}
                    />
                  </div>
                )}

                {/* ── Submit ── */}
                <button type="submit" disabled={loading || (captchaRequired && !captchaToken)}
                  className="w-full h-11 mt-1 rounded-xl text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:brightness-110"
                  style={{ background: BRAND }}
                >
                  {loading
                    ? <><Loader2 size={16} className="animate-spin" /> Creating account…</>
                    : "Create account →"
                  }
                </button>
              </form>

              <p className="mt-4 text-center text-sm text-gray-500">
                Already have an account?{" "}
                <a href="/client/login" className="font-semibold hover:underline" style={{ color: BRAND }}>Sign in</a>
              </p>
            </motion.div>
          )}

          {/* ── Email verification ── */}
          {step === "verify" && (
            <motion.div key="verify" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              className="bg-white border border-gray-100 rounded-2xl shadow-xl shadow-black/[0.06] p-8 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: `${BRAND}18` }}>
                <ShieldCheck size={28} style={{ color: BRAND }} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Check your email</h2>
              <p className="text-gray-500 text-sm mb-1">
                We sent a 6-digit code to <span className="text-gray-900 font-semibold">{formData.email}</span>
              </p>
              <p className="text-gray-400 text-xs mb-8">Expires in 10 minutes. Check your spam folder if needed.</p>

              <form onSubmit={handleVerify} className="space-y-4 text-left">
                <input
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000 000"
                  maxLength={6}
                  inputMode="numeric"
                  className="w-full h-14 px-4 rounded-xl border border-gray-200 text-center text-2xl font-mono tracking-[0.4em] text-gray-900 outline-none focus:ring-2 focus:border-[#701AFE] transition-all"
                  style={{ "--tw-ring-color": `${BRAND}40` } as any}
                />
                <button type="submit" disabled={loading || code.length !== 6}
                  className="w-full h-11 rounded-xl text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-violet-500/25"
                  style={{ background: BRAND }}
                >
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Verifying…</> : "Verify & activate account"}
                </button>
              </form>

              <div className="mt-5 flex items-center justify-center gap-2 text-sm">
                <span className="text-gray-400">Didn't receive it?</span>
                <button onClick={handleResend} disabled={resending || countdown > 0}
                  className="flex items-center gap-1.5 font-medium hover:underline disabled:opacity-50" style={{ color: BRAND }}>
                  {resending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  {countdown > 0 ? `Resend in ${countdown}s` : "Resend code"}
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>

        <p className="mt-5 text-center text-[11px] text-gray-400">
          By creating an account you agree to our{" "}
          <a href="/terms" className="underline hover:text-gray-600">Terms</a>
          {" "}and{" "}
          <a href="/privacy" className="underline hover:text-gray-600">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
