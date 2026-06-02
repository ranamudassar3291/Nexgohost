import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useBranding } from "@/hooks/use-branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowRight, Smartphone, MailCheck } from "lucide-react";

async function apiFetch(url: string, token?: string, opts?: RequestInit) {
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts?.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Request failed");
  return data;
}

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { logoUrl, siteName } = useBranding();
  const nextUrl = new URLSearchParams(window.location.search).get("next") || new URLSearchParams(window.location.search).get("redirect") || "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [step, setStep] = useState<"password" | "2fa" | "verify">("password");
  const [tempToken, setTempToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await apiFetch("/api/auth/login", undefined, {
        method: "POST", body: JSON.stringify({ email, password }),
      });
      if (data.requires2FA) {
        setTempToken(data.tempToken);
        setStep("2fa");
      } else if (data.requiresVerification) {
        setTempToken(data.tempToken);
        setStep("verify");
      } else {
        login(data.token);
        toast({ title: "Welcome back!", description: "Successfully logged in." });
        setLocation(nextUrl || (data.user?.role === "admin" ? "/admin/dashboard" : "/dashboard"));
      }
    } catch (err: any) {
      let raw: any = {};
      try { raw = JSON.parse(err.message); } catch {}
      if (raw?.requiresVerification) {
        try {
          const res2 = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
          const d2 = await res2.json();
          if (d2.requiresVerification && d2.tempToken) {
            setTempToken(d2.tempToken);
            setStep("verify");
            return;
          }
        } catch {}
      }
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handle2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await apiFetch("/api/auth/2fa/verify", tempToken, {
        method: "POST", body: JSON.stringify({ totp }),
      });
      login(data.token);
      toast({ title: "Welcome back!" });
      setLocation(nextUrl || (data.user?.role === "admin" ? "/admin/dashboard" : "/dashboard"));
    } catch (err: any) {
      toast({ title: "Invalid code", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/api/auth/verify-email", tempToken, { method: "POST", body: JSON.stringify({ code: verifyCode }) });
      const data = await apiFetch("/api/auth/login", undefined, { method: "POST", body: JSON.stringify({ email, password }) });
      login(data.token);
      toast({ title: "Email verified", description: "You are now signed in." });
      setLocation(nextUrl || (data.user?.role === "admin" ? "/admin/dashboard" : "/dashboard"));
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await apiFetch("/api/auth/resend-verification", tempToken, { method: "POST" });
      toast({ title: "Code resent", description: `Check ${email} for the verification code.` });
    } catch (err: any) {
      toast({ title: "Resend failed", description: err.message, variant: "destructive" });
    } finally { setResending(false); }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-background">
      {/* Abstract Background Image */}
      <div className="absolute inset-0 z-0">
        <img 
          src={`${import.meta.env.BASE_URL}images/auth-bg.png`} 
          alt="Abstract Server Background" 
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, type: "spring" }}
        className="w-full max-w-md z-10 p-4"
      >
        <div className="glass-card p-8 rounded-3xl relative overflow-hidden">
          {/* Subtle glow effect inside card */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/30 rounded-full blur-[60px]" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-600/20 rounded-full blur-[60px]" />

          <div className="relative z-10 flex flex-col items-center mb-8">
            {logoUrl ? (
              <img src={logoUrl} alt={siteName} className="w-16 h-16 mb-4 object-contain drop-shadow-[0_0_15px_rgba(139,92,246,0.6)]" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-16 h-16 mb-4 rounded-2xl bg-primary flex items-center justify-center text-white text-2xl font-black">
                {siteName?.[0] ?? "N"}
              </div>
            )}
            <h1 className="text-3xl font-display font-bold text-foreground text-center">Welcome Back</h1>
            <p className="text-muted-foreground text-center mt-2">Sign in to manage your hosting</p>
          </div>

          <AnimatePresence mode="wait">
            {step === "password" ? (
              <motion.form key="pw" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onSubmit={handleSubmit} className="relative z-10 space-y-5">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground/80 ml-1">Email Address</label>
                  <Input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="admin@noehost.com"
                    className="bg-background/50 border-white/10 focus:border-primary h-12 rounded-xl text-base" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground/80 ml-1">Password</label>
                  <Input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-background/50 border-white/10 focus:border-primary h-12 rounded-xl text-base" />
                </div>
                <Button type="submit" disabled={loading}
                  className="w-full h-12 text-base font-semibold rounded-xl bg-primary hover:bg-primary/90 shadow-sm">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="flex items-center gap-2">Sign In <ArrowRight className="w-4 h-4" /></span>}
                </Button>
              </motion.form>
            ) : step === "verify" ? (
              <motion.form key="verify" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                onSubmit={handleVerify} className="relative z-10 space-y-5">
                <div className="text-center mb-2">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <MailCheck size={22} className="text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to your email</p>
                </div>
                <Input value={verifyCode} onChange={e => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000" maxLength={6}
                  className="bg-background/50 border-white/10 h-14 text-center text-2xl font-mono tracking-[0.5em]" />
                <Button type="submit" disabled={loading || verifyCode.length !== 6}
                  className="w-full h-12 font-semibold rounded-xl bg-primary hover:bg-primary/90">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify & sign in"}
                </Button>
                <button type="button" onClick={handleResend} disabled={resending}
                  className="w-full text-sm text-muted-foreground hover:text-foreground text-center">
                  {resending ? "Resending..." : "Resend code"}
                </button>
              </motion.form>
            ) : (
              <motion.form key="2fa" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                onSubmit={handle2FA} className="relative z-10 space-y-5">
                <div className="text-center mb-2">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Smartphone size={22} className="text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app</p>
                </div>
                <Input value={totp} onChange={e => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000" maxLength={6}
                  className="bg-background/50 border-white/10 h-14 text-center text-2xl font-mono tracking-[0.5em]" />
                <Button type="submit" disabled={loading || totp.length !== 6}
                  className="w-full h-12 font-semibold rounded-xl bg-primary hover:bg-primary/90">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify Code"}
                </Button>
                <button type="button" onClick={() => setStep("password")} className="w-full text-sm text-muted-foreground hover:text-foreground text-center">
                  ← Back to login
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {step === "password" && (
            <p className="mt-6 text-center text-sm text-muted-foreground relative z-10">
              Don't have an account?{" "}
              <a href="/register" className="text-primary font-medium hover:underline decoration-primary/50 underline-offset-4">Create an account</a>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
