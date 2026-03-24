import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Redirect } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, ArrowRight, AlertCircle, UserCheck,
  Smartphone, RefreshCw, MailCheck, Eye, EyeOff,
  Server, Globe, Shield, Zap,
} from "lucide-react";

async function apiFetch(url: string, token?: string, opts?: RequestInit) {
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts?.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Request failed");
  return data;
}

type Step = "password" | "2fa" | "verify";

const FEATURES = [
  { icon: Server, text: "Manage unlimited hosting services" },
  { icon: Globe, text: "One-click domain management" },
  { icon: Shield, text: "Free SSL on every domain" },
  { icon: Zap,    text: "99.9% uptime guarantee" },
];

export default function ClientLogin() {
  const { user, login } = useAuth();
  const [, setLocation] = useLocation();

  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [totp,        setTotp]        = useState("");
  const [verifyCode,  setVerifyCode]  = useState("");
  const [step,        setStep]        = useState<Step>("password");
  const [tempToken,   setTempToken]   = useState("");
  const [loading,     setLoading]     = useState(false);
  const [showPwd,     setShowPwd]     = useState(false);
  const [resending,   setResending]   = useState(false);
  const [countdown,   setCountdown]   = useState(0);
  const [error,       setError]       = useState<string | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    fetch("/api/auth/google/config")
      .then(r => r.json())
      .then(d => setGoogleEnabled(d.configured ?? !!d.clientId))
      .catch(() => setGoogleEnabled(false));

    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) {
      const msgs: Record<string, string> = {
        google_not_configured: "Google Sign-In is not yet configured. Please use email and password.",
        google_denied: "Google sign-in was cancelled.",
        google_failed: "Google sign-in failed. Please try again.",
        google_domain_not_allowed: "Your Google account domain is not permitted. Please contact support.",
        account_suspended: "Your account has been suspended. Please contact support.",
      };
      setError(msgs[err] || "Sign-in error. Please try again.");
    }
  }, []);

  if (user) return <Redirect to={user.role === "admin" ? "/admin/dashboard" : "/client/dashboard"} />;

  const startCountdown = () => {
    setCountdown(60);
    const t = setInterval(() => setCountdown(c => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; }), 1000);
  };

  const validate = () => {
    const errs: typeof fieldErrors = {};
    if (!email)                              errs.email    = "Email is required.";
    else if (!/\S+@\S+\.\S+/.test(email))   errs.email    = "Enter a valid email address.";
    if (!password)                           errs.password = "Password is required.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch("/api/auth/login", undefined, { method: "POST", body: JSON.stringify({ email, password }) });
      if (data.user?.role !== "client") {
        setError("This portal is for clients only. Please use the Admin Portal to sign in.");
        return;
      }
      if (data.requires2FA) { setTempToken(data.tempToken); setStep("2fa"); }
      else { login(data.token); setLocation("/client/dashboard"); }
    } catch (err: any) {
      let raw: any = {};
      try { raw = JSON.parse(err.message); } catch { /* not json */ }
      if (raw?.requiresVerification || err.message?.includes("verify")) {
        try {
          const res2 = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
          const d2 = await res2.json();
          if (d2.requiresVerification && d2.tempToken) { setTempToken(d2.tempToken); setStep("verify"); startCountdown(); return; }
        } catch { /* fall through */ }
      }
      setError(err.message || "Invalid email or password. Please try again.");
    } finally { setLoading(false); }
  };

  const handle2FA = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true);
    try {
      const data = await apiFetch("/api/auth/2fa/verify", tempToken, { method: "POST", body: JSON.stringify({ totp }) });
      login(data.token); setLocation("/client/dashboard");
    } catch (err: any) { setError(err.message || "Invalid code. Please try again."); }
    finally { setLoading(false); }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true);
    try {
      await apiFetch("/api/auth/verify-email", tempToken, { method: "POST", body: JSON.stringify({ code: verifyCode }) });
      const loginData = await apiFetch("/api/auth/login", undefined, { method: "POST", body: JSON.stringify({ email, password }) });
      login(loginData.token); setLocation("/client/dashboard");
    } catch (err: any) { setError(err.message || "Invalid code. Please try again."); }
    finally { setLoading(false); }
  };

  const handleResend = async () => {
    setResending(true); setError(null);
    try { await apiFetch("/api/auth/resend-verification", tempToken, { method: "POST" }); startCountdown(); }
    catch (err: any) { setError(err.message || "Failed to resend code."); }
    finally { setResending(false); }
  };

  return (
    <div className="min-h-screen w-full flex bg-white">

      {/* ── Left marketing panel ──────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#701AFE] flex-col justify-between p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-white/10 rounded-full" />
        <div className="absolute -bottom-32 -left-20 w-96 h-96 bg-white/5  rounded-full" />
        <div className="absolute top-1/2 right-0 w-48 h-48 bg-purple-400/20 rounded-full blur-2xl" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}images/logo-icon.png`} alt="Noehost" className="w-9 h-9" />
          <span className="text-white text-xl font-bold tracking-tight">Noehost</span>
        </div>

        {/* Headline */}
        <div className="relative z-10">
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Everything you need<br />to grow online.
          </h2>
          <p className="text-white/75 text-base mb-10 leading-relaxed">
            Manage your hosting, domains, emails, and more<br />from one powerful dashboard.
          </p>
          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                  <Icon size={15} className="text-white" />
                </div>
                <span className="text-white/90 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial card */}
        <div className="relative z-10 bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20">
          <p className="text-white/90 text-sm leading-relaxed">
            "Switching to Noehost was the best decision for my business. Setup was instant and support is world-class."
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white/25 flex items-center justify-center text-white text-xs font-bold">S</div>
            <div>
              <p className="text-white text-xs font-semibold">Sara Müller</p>
              <p className="text-white/60 text-xs">E-commerce founder</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form panel ──────────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <img src={`${import.meta.env.BASE_URL}images/logo-icon.png`} alt="Noehost" className="w-8 h-8" />
            <span className="text-[#701AFE] text-lg font-bold">Noehost</span>
          </div>

          <AnimatePresence mode="wait">

            {/* ── Step: password ── */}
            {step === "password" && (
              <motion.div key="pw" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <h1 className="text-3xl font-bold text-black mb-1">Welcome back</h1>
                <p className="text-gray-500 text-sm mb-8">Sign in to your Noehost account</p>

                {error && (
                  <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 mb-6">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Social buttons */}
                <div className="space-y-3 mb-6">
                  {googleEnabled && (
                    <button
                      type="button"
                      onClick={() => { window.location.href = "/api/auth/google/start"; }}
                      className="w-full h-11 flex items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors"
                    >
                      <svg width="18" height="18" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                      </svg>
                      Continue with Google
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { window.location.href = "/api/auth/github/start"; }}
                    className="w-full h-11 flex items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                    Continue with GitHub
                  </button>
                </div>

                <div className="flex items-center gap-3 mb-6">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">or continue with email</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: undefined })); setError(null); }}
                      placeholder="you@example.com"
                      className={`w-full h-11 px-4 rounded-xl border text-sm text-black placeholder-gray-400 outline-none transition-all focus:ring-2 focus:ring-[#701AFE]/30 focus:border-[#701AFE] ${fieldErrors.email ? "border-red-400 bg-red-50" : "border-gray-200 bg-white"}`}
                    />
                    {fieldErrors.email && <p className="mt-1.5 text-xs text-red-500">{fieldErrors.email}</p>}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-medium text-gray-700">Password</label>
                      <a href="/forgot-password" className="text-xs text-[#701AFE] hover:underline">Forgot password?</a>
                    </div>
                    <div className="relative">
                      <input
                        type={showPwd ? "text" : "password"}
                        value={password}
                        onChange={e => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: undefined })); setError(null); }}
                        placeholder="••••••••"
                        className={`w-full h-11 px-4 pr-11 rounded-xl border text-sm text-black placeholder-gray-400 outline-none transition-all focus:ring-2 focus:ring-[#701AFE]/30 focus:border-[#701AFE] ${fieldErrors.password ? "border-red-400 bg-red-50" : "border-gray-200 bg-white"}`}
                      />
                      <button type="button" onClick={() => setShowPwd(p => !p)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                    {fieldErrors.password && <p className="mt-1.5 text-xs text-red-500">{fieldErrors.password}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 rounded-xl bg-[#701AFE] hover:bg-[#5e14d4] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <><span>Sign in</span><ArrowRight size={16} /></>}
                  </button>
                </form>

                <p className="mt-6 text-center text-sm text-gray-500">
                  Don't have an account?{" "}
                  <a href="/register" className="text-[#701AFE] font-medium hover:underline">Create account</a>
                </p>
              </motion.div>
            )}

            {/* ── Step: 2FA ── */}
            {step === "2fa" && (
              <motion.div key="2fa" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[#701AFE]/10 mb-6">
                  <Smartphone size={26} className="text-[#701AFE]" />
                </div>
                <h1 className="text-2xl font-bold text-black mb-1">Two-factor verification</h1>
                <p className="text-gray-500 text-sm mb-8">Enter the 6-digit code from your authenticator app</p>

                {error && (
                  <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 mb-6">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
                  </div>
                )}

                <form onSubmit={handle2FA} className="space-y-4">
                  <input
                    value={totp}
                    onChange={e => { setTotp(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(null); }}
                    placeholder="000 000"
                    maxLength={6}
                    className="w-full h-14 px-4 rounded-xl border border-gray-200 text-center text-2xl font-mono tracking-[0.4em] text-black outline-none focus:ring-2 focus:ring-[#701AFE]/30 focus:border-[#701AFE]"
                  />
                  <button type="submit" disabled={loading || totp.length !== 6}
                    className="w-full h-11 rounded-xl bg-[#701AFE] hover:bg-[#5e14d4] text-white text-sm font-semibold transition-colors flex items-center justify-center disabled:opacity-60">
                    {loading ? <Loader2 size={18} className="animate-spin" /> : "Verify code"}
                  </button>
                  <button type="button" onClick={() => { setStep("password"); setTotp(""); setError(null); }}
                    className="w-full text-sm text-gray-500 hover:text-gray-700 text-center transition-colors">
                    ← Back to login
                  </button>
                </form>
              </motion.div>
            )}

            {/* ── Step: email verify ── */}
            {step === "verify" && (
              <motion.div key="verify" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[#701AFE]/10 mb-6">
                  <MailCheck size={26} className="text-[#701AFE]" />
                </div>
                <h1 className="text-2xl font-bold text-black mb-1">Check your email</h1>
                <p className="text-gray-500 text-sm mb-2">
                  We sent a 6-digit code to <span className="text-black font-medium">{email}</span>
                </p>
                <p className="text-gray-400 text-xs mb-8">It expires in 10 minutes.</p>

                {error && (
                  <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 mb-6">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleVerify} className="space-y-4">
                  <input
                    value={verifyCode}
                    onChange={e => { setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(null); }}
                    placeholder="000 000"
                    maxLength={6}
                    className="w-full h-14 px-4 rounded-xl border border-gray-200 text-center text-2xl font-mono tracking-[0.4em] text-black outline-none focus:ring-2 focus:ring-[#701AFE]/30 focus:border-[#701AFE]"
                  />
                  <button type="submit" disabled={loading || verifyCode.length !== 6}
                    className="w-full h-11 rounded-xl bg-[#701AFE] hover:bg-[#5e14d4] text-white text-sm font-semibold transition-colors flex items-center justify-center disabled:opacity-60">
                    {loading ? <Loader2 size={18} className="animate-spin" /> : "Verify & sign in"}
                  </button>
                </form>
                <div className="mt-5 flex items-center justify-between text-sm">
                  <button onClick={() => { setStep("password"); setVerifyCode(""); setError(null); }}
                    className="text-gray-500 hover:text-gray-700">← Back</button>
                  <button onClick={handleResend} disabled={resending || countdown > 0}
                    className="flex items-center gap-1.5 text-[#701AFE] hover:underline disabled:opacity-50">
                    {resending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    {countdown > 0 ? `Resend in ${countdown}s` : "Resend code"}
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>

          {/* Client portal badge */}
          {step === "password" && (
            <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-gray-400">
              <UserCheck size={12} />
              <span>Client portal · <a href="/admin/login" className="hover:text-gray-600 transition-colors">Admin login</a></span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
