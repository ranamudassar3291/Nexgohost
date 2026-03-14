import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowRight, ShieldCheck, AlertCircle, UserCheck, Smartphone, RefreshCw, MailCheck } from "lucide-react";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

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

export default function ClientLogin() {
  const { user, login } = useAuth();
  const [, setLocation] = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [step, setStep] = useState<Step>("password");
  const [tempToken, setTempToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);

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
        google_failed: "Google sign-in failed. Please try again or use your email and password.",
        google_domain_not_allowed: "Your Google account domain is not permitted. Please contact support.",
        account_suspended: "Your account has been suspended. Please contact support.",
      };
      setInlineError(msgs[err] || "Sign-in error. Please try again.");
    }
  }, []);

  if (user) return <Redirect to={user.role === "admin" ? "/admin/dashboard" : "/client/dashboard"} />;

  const startCountdown = () => {
    setCountdown(60);
    const t = setInterval(() => setCountdown(c => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; }), 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);
    setLoading(true);
    try {
      const data = await apiFetch("/api/auth/login", undefined, { method: "POST", body: JSON.stringify({ email, password }) });
      if (data.user?.role !== "client") {
        setInlineError("This portal is for clients only. Please use the Admin Portal to sign in.");
        return;
      }
      if (data.requires2FA) {
        setTempToken(data.tempToken);
        setStep("2fa");
      } else {
        login(data.token);
        setLocation("/client/dashboard");
      }
    } catch (err: any) {
      let raw: any = {};
      try { raw = JSON.parse(err.message); } catch { /* not json */ }
      if (raw?.requiresVerification || err.message?.includes("verify")) {
        try {
          const res2 = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          const d2 = await res2.json();
          if (d2.requiresVerification && d2.tempToken) {
            setTempToken(d2.tempToken);
            setStep("verify");
            startCountdown();
            setInlineError(null);
            return;
          }
        } catch { /* fall through */ }
      }
      setInlineError(err.message || "Invalid email or password. Please try again.");
    } finally { setLoading(false); }
  };

  const handle2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);
    setLoading(true);
    try {
      const data = await apiFetch("/api/auth/2fa/verify", tempToken, { method: "POST", body: JSON.stringify({ totp }) });
      login(data.token);
      setLocation("/client/dashboard");
    } catch (err: any) {
      setInlineError(err.message || "Invalid code. Please try again.");
    } finally { setLoading(false); }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);
    setLoading(true);
    try {
      await apiFetch("/api/auth/verify-email", tempToken, { method: "POST", body: JSON.stringify({ code: verifyCode }) });
      const loginData = await apiFetch("/api/auth/login", undefined, { method: "POST", body: JSON.stringify({ email, password }) });
      login(loginData.token);
      setLocation("/client/dashboard");
    } catch (err: any) {
      setInlineError(err.message || "Invalid code. Please try again.");
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    setResending(true);
    setInlineError(null);
    try {
      await apiFetch("/api/auth/resend-verification", tempToken, { method: "POST" });
      startCountdown();
    } catch (err: any) {
      setInlineError(err.message || "Failed to resend code.");
    } finally { setResending(false); }
  };


  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-background">
      <div className="absolute inset-0 z-0">
        <img src={`${import.meta.env.BASE_URL}images/auth-bg.png`} alt="" className="w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background" />
      </div>

      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, type: "spring" }}
        className="w-full max-w-md z-10 p-4">
        <div className="glass-card p-8 rounded-3xl relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/30 rounded-full blur-[60px]" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-600/20 rounded-full blur-[60px]" />

          <div className="relative z-10 flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <img src={`${import.meta.env.BASE_URL}images/logo-icon.png`} alt="Nexgohost" className="w-16 h-16 drop-shadow-[0_0_15px_rgba(139,92,246,0.6)]" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center border-2 border-background">
                <UserCheck size={12} className="text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-display font-bold text-foreground text-center">
              {step === "verify" ? "Verify Your Email" : "Welcome Back"}
            </h1>
            <p className="text-muted-foreground text-center mt-1 text-sm">
              {step === "verify"
                ? `Enter the code sent to ${email}`
                : "Sign in to manage your hosting services"}
            </p>
            {step === "password" && (
              <div className="mt-3 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/25 flex items-center gap-1.5 text-xs text-green-400 font-medium">
                <UserCheck size={12} /> Client Portal
              </div>
            )}
          </div>

          {inlineError && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              className="relative z-10 mb-5 flex items-start gap-3 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-destructive">
              <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{inlineError}</span>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {step === "password" && (
              <motion.div key="pw" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10 space-y-4">
                {googleEnabled && (
                  <>
                    <GoogleSignInButton />
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-white/10" />
                      <span className="text-xs text-muted-foreground">or sign in with email</span>
                      <div className="flex-1 h-px bg-white/10" />
                    </div>
                  </>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground/80 ml-1">Email Address</label>
                    <Input type="email" required value={email} onChange={e => { setEmail(e.target.value); setInlineError(null); }} placeholder="john@example.com"
                      className="bg-background/50 border-white/10 h-12 rounded-xl text-base" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground/80 ml-1">Password</label>
                    <Input type="password" required value={password} onChange={e => { setPassword(e.target.value); setInlineError(null); }} placeholder="••••••••"
                      className="bg-background/50 border-white/10 h-12 rounded-xl text-base" />
                  </div>
                  <Button type="submit" disabled={loading}
                    className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/25">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="flex items-center gap-2">Sign In <ArrowRight className="w-4 h-4" /></span>}
                  </Button>
                </form>
              </motion.div>
            )}

            {step === "2fa" && (
              <motion.form key="2fa" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                onSubmit={handle2FA} className="relative z-10 space-y-5">
                <div className="text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Smartphone size={22} className="text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app</p>
                </div>
                <Input value={totp} onChange={e => { setTotp(e.target.value.replace(/\D/g, "").slice(0, 6)); setInlineError(null); }}
                  placeholder="000000" maxLength={6}
                  className="bg-background/50 border-white/10 h-14 text-center text-2xl font-mono tracking-[0.5em]" />
                <Button type="submit" disabled={loading || totp.length !== 6} className="w-full h-12 font-semibold bg-primary hover:bg-primary/90">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : "Verify Code"}
                </Button>
                <button type="button" onClick={() => { setStep("password"); setTotp(""); setInlineError(null); }}
                  className="w-full text-sm text-muted-foreground hover:text-foreground text-center">← Back to login</button>
              </motion.form>
            )}

            {step === "verify" && (
              <motion.div key="verify" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                className="relative z-10 space-y-5">
                <div className="text-center mb-2">
                  <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <MailCheck size={26} className="text-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground">Check your inbox for a 6-digit code. It expires in 10 minutes.</p>
                </div>
                <form onSubmit={handleVerify} className="space-y-4">
                  <Input value={verifyCode} onChange={e => { setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setInlineError(null); }}
                    placeholder="000000" maxLength={6}
                    className="bg-background/50 border-white/10 h-14 text-center text-2xl font-mono tracking-[0.5em]" />
                  <Button type="submit" disabled={loading || verifyCode.length !== 6} className="w-full h-12 font-semibold bg-primary hover:bg-primary/90">
                    {loading ? <Loader2 size={18} className="animate-spin" /> : "Verify & Sign In"}
                  </Button>
                </form>
                <div className="flex items-center justify-between text-sm">
                  <button type="button" onClick={() => { setStep("password"); setVerifyCode(""); setInlineError(null); }}
                    className="text-muted-foreground hover:text-foreground">← Back</button>
                  <button onClick={handleResend} disabled={resending || countdown > 0}
                    className="flex items-center gap-1 text-primary hover:underline disabled:opacity-50">
                    {resending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    {countdown > 0 ? `Resend in ${countdown}s` : "Resend Code"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {step === "password" && (
            <div className="mt-6 text-center relative z-10 space-y-2">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <a href="/register" className="text-primary font-medium hover:underline decoration-primary/50 underline-offset-4">Create an account</a>
              </p>
              <p className="text-sm text-muted-foreground">
                Are you an admin?{" "}
                <a href="/admin/login" className="text-primary font-medium hover:underline underline-offset-4 decoration-primary/50 inline-flex items-center gap-1">
                  <ShieldCheck size={13} /> Go to Admin Portal
                </a>
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
