import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Eye, EyeOff, ShieldCheck, RefreshCw,
  Gift, AlertCircle, CheckCircle2,
} from "lucide-react";

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

export default function Register() {
  const { login }      = useAuth();
  const [, setLocation] = useLocation();
  const { toast }      = useToast();

  const [formData,     setFormData]     = useState({ firstName: "", lastName: "", email: "", password: "", company: "", phone: "" });
  const [loading,      setLoading]      = useState(false);
  const [showPwd,      setShowPwd]      = useState(false);
  const [step,         setStep]         = useState<"form" | "verify">("form");
  const [tempToken,    setTempToken]    = useState("");
  const [code,         setCode]         = useState("");
  const [resending,    setResending]    = useState(false);
  const [countdown,    setCountdown]    = useState(0);
  const [googleEnabled,setGoogleEnabled]= useState<boolean | null>(null);
  const [refCode,      setRefCode]      = useState<string | null>(null);
  const [fieldErrors,  setFieldErrors]  = useState<FieldErrors>({});
  const [formError,    setFormError]    = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/google/config")
      .then(r => r.json())
      .then(d => setGoogleEnabled(d.configured ?? !!d.clientId))
      .catch(() => setGoogleEnabled(false));

    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      setRefCode(ref);
      localStorage.setItem("referralCode", ref);
      fetch("/api/affiliate/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: ref }) }).catch(() => {});
    } else {
      const stored = localStorage.getItem("referralCode");
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
    if (!formData.firstName.trim())              errs.firstName = "First name is required.";
    if (!formData.lastName.trim())               errs.lastName  = "Last name is required.";
    if (!formData.email.trim())                  errs.email     = "Email address is required.";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errs.email  = "Enter a valid email address.";
    if (!formData.password)                      errs.password  = "Password is required.";
    else if (formData.password.length < 8)       errs.password  = "Password must be at least 8 characters.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setFormError(null);
    setLoading(true);
    try {
      const payload = { ...formData, ...(refCode ? { refCode } : {}) };
      const data = await apiFetch("/api/auth/register", null, { method: "POST", body: JSON.stringify(payload) });
      setTempToken(data.token);
      if (refCode) localStorage.removeItem("referralCode");
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

  return (
    <div className="min-h-screen w-full bg-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#701AFE] flex items-center justify-center mb-3 shadow-lg shadow-[#701AFE]/30">
            <img src={`${import.meta.env.BASE_URL}images/logo-icon.png`} alt="Noehost" className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-black">Create your account</h1>
          <p className="text-gray-500 text-sm mt-1">Join Noehost — deploy and manage your infrastructure</p>
        </div>

        <AnimatePresence mode="wait">

          {/* ── Registration form ── */}
          {step === "form" && (
            <motion.div key="form" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-white border border-gray-100 rounded-2xl shadow-lg shadow-black/5 p-8">

              {/* Referral banner */}
              {refCode && (
                <div className="flex items-center gap-2.5 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 mb-6">
                  <Gift size={15} className="shrink-0" />
                  <span>You were referred by a friend — a welcome bonus may apply!</span>
                </div>
              )}

              {/* Google sign up */}
              {googleEnabled && (
                <div className="mb-6">
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
                    Sign up with Google
                  </button>
                  <div className="flex items-center gap-3 mt-5">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400">or register with email</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                </div>
              )}

              {/* General form error */}
              {formError && (
                <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 mb-5">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4" noValidate>
                {/* First name + Last name */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">First name <span className="text-red-400">*</span></label>
                    <input name="firstName" value={formData.firstName} onChange={handleChange}
                      placeholder="John" className={inputCls("firstName")} />
                    {fieldErrors.firstName && <p className="mt-1.5 text-xs text-red-500">{fieldErrors.firstName}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Last name <span className="text-red-400">*</span></label>
                    <input name="lastName" value={formData.lastName} onChange={handleChange}
                      placeholder="Smith" className={inputCls("lastName")} />
                    {fieldErrors.lastName && <p className="mt-1.5 text-xs text-red-500">{fieldErrors.lastName}</p>}
                  </div>
                </div>

                {/* Email — full width */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address <span className="text-red-400">*</span></label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange}
                    placeholder="john@example.com" className={inputCls("email")} />
                  {fieldErrors.email && <p className="mt-1.5 text-xs text-red-500">{fieldErrors.email}</p>}
                </div>

                {/* Password — full width */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Password <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <input type={showPwd ? "text" : "password"} name="password" value={formData.password} onChange={handleChange}
                      placeholder="Min. 8 characters" className={`${inputCls("password")} pr-11`} />
                    <button type="button" onClick={() => setShowPwd(p => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  {fieldErrors.password && <p className="mt-1.5 text-xs text-red-500">{fieldErrors.password}</p>}
                  {formData.password && !fieldErrors.password && formData.password.length >= 8 && (
                    <p className="mt-1.5 text-xs text-green-600 flex items-center gap-1"><CheckCircle2 size={11} /> Strong password</p>
                  )}
                </div>

                {/* Company + Phone — optional */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Company <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input name="company" value={formData.company} onChange={handleChange}
                      placeholder="Acme Inc." className={inputCls()} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input name="phone" value={formData.phone} onChange={handleChange}
                      placeholder="+1 555 000 0000" className={inputCls()} />
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full h-11 mt-2 rounded-xl bg-[#701AFE] hover:bg-[#5e14d4] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-md shadow-[#701AFE]/25">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : "Create account"}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-gray-500">
                Already have an account?{" "}
                <a href="/client/login" className="text-[#701AFE] font-medium hover:underline">Sign in</a>
              </p>
            </motion.div>
          )}

          {/* ── Email verification ── */}
          {step === "verify" && (
            <motion.div key="verify" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              className="bg-white border border-gray-100 rounded-2xl shadow-lg shadow-black/5 p-8 text-center">
              <div className="w-14 h-14 bg-[#701AFE]/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <ShieldCheck size={28} className="text-[#701AFE]" />
              </div>
              <h2 className="text-2xl font-bold text-black mb-1">Verify your email</h2>
              <p className="text-gray-500 text-sm mb-1">
                We sent a 6-digit code to{" "}
                <span className="text-black font-medium">{formData.email}</span>
              </p>
              <p className="text-gray-400 text-xs mb-8">It expires in 10 minutes.</p>

              <form onSubmit={handleVerify} className="space-y-4 text-left">
                <input
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000 000"
                  maxLength={6}
                  className="w-full h-14 px-4 rounded-xl border border-gray-200 text-center text-2xl font-mono tracking-[0.4em] text-black outline-none focus:ring-2 focus:ring-[#701AFE]/25 focus:border-[#701AFE]"
                />
                <button type="submit" disabled={loading || code.length !== 6}
                  className="w-full h-11 rounded-xl bg-[#701AFE] hover:bg-[#5e14d4] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : "Verify & activate account"}
                </button>
              </form>

              <div className="mt-5 flex items-center justify-center gap-2 text-sm">
                <span className="text-gray-500">Didn't receive it?</span>
                <button onClick={handleResend} disabled={resending || countdown > 0}
                  className="flex items-center gap-1.5 text-[#701AFE] hover:underline disabled:opacity-50">
                  {resending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  {countdown > 0 ? `Resend in ${countdown}s` : "Resend code"}
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>

        <p className="mt-6 text-center text-xs text-gray-400">
          By creating an account, you agree to our{" "}
          <a href="/terms" className="underline hover:text-gray-600">Terms of Service</a>
          {" "}and{" "}
          <a href="/privacy" className="underline hover:text-gray-600">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
