import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, UserPlus, ShieldCheck, RefreshCw, Eye, EyeOff, Gift } from "lucide-react";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

async function apiFetch(url: string, token: string | null, opts?: RequestInit) {
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts?.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Request failed");
  return data;
}

export default function Register() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [formData, setFormData] = useState({ firstName: "", lastName: "", email: "", password: "", company: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<"form" | "verify">("form");
  const [tempToken, setTempToken] = useState("");
  const [code, setCode] = useState("");
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);
  const [refCode, setRefCode] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/google/config")
      .then(r => r.json())
      .then(d => setGoogleEnabled(d.configured ?? !!d.clientId))
      .catch(() => setGoogleEnabled(false));

    // Read referral code from URL params (?ref=code)
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      setRefCode(ref);
      localStorage.setItem("referralCode", ref);
      // Track the click
      fetch("/api/affiliate/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: ref }),
      }).catch(() => {});
    } else {
      // Check localStorage for previously stored referral code
      const stored = localStorage.getItem("referralCode");
      if (stored) setRefCode(stored);
    }
  }, []);

  const startCountdown = () => {
    setCountdown(60);
    const t = setInterval(() => setCountdown(c => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; }), 1000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
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
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
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

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-background py-10">
      {/* Clean gradient background — no image */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[300px] bg-purple-700/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-indigo-600/8 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl z-10 px-4"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-primary to-purple-600 rounded-2xl shadow-lg shadow-primary/30 mb-4">
            <img src={`${import.meta.env.BASE_URL}images/logo-icon.png`} alt="Noehost" className="w-9 h-9" />
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground">Create Account</h1>
          <p className="text-muted-foreground mt-1 text-sm">Join Noehost to deploy and manage your infrastructure</p>
        </div>

        <div className="bg-card border border-border rounded-3xl shadow-2xl shadow-black/20 overflow-hidden">
          <AnimatePresence mode="wait">
            {step === "form" ? (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-8 md:p-10">

                {refCode && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-xl text-sm text-green-400 mb-6">
                    <Gift size={15} className="shrink-0" />
                    <span>You were referred by a friend. Welcome bonus may apply!</span>
                  </div>
                )}

                {googleEnabled && (
                  <div className="mb-6">
                    <GoogleSignInButton label="Sign up with Google" />
                    <div className="flex items-center gap-3 mt-5">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground">or register with email</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  </div>
                )}

                <form onSubmit={handleRegister} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground/80">First Name *</label>
                      <Input name="firstName" required value={formData.firstName} onChange={handleChange}
                        className="bg-background border-border h-11 rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground/80">Last Name *</label>
                      <Input name="lastName" required value={formData.lastName} onChange={handleChange}
                        className="bg-background border-border h-11 rounded-xl" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground/80">Email Address *</label>
                      <Input type="email" name="email" required value={formData.email} onChange={handleChange}
                        className="bg-background border-border h-11 rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground/80">Password *</label>
                      <div className="relative">
                        <Input type={showPassword ? "text" : "password"} name="password" required value={formData.password} onChange={handleChange}
                          className="bg-background border-border h-11 rounded-xl pr-12" />
                        <button type="button" onClick={() => setShowPassword(p => !p)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground/80">Company Name</label>
                      <Input name="company" value={formData.company} onChange={handleChange}
                        className="bg-background border-border h-11 rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground/80">Phone Number</label>
                      <Input name="phone" value={formData.phone} onChange={handleChange}
                        className="bg-background border-border h-11 rounded-xl" />
                    </div>
                  </div>
                  <Button type="submit" disabled={loading}
                    className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/25">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="flex items-center gap-2"><UserPlus className="w-5 h-5" /> Create Account</span>}
                  </Button>
                </form>
                <p className="mt-6 text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <a href="/client/login" className="text-primary font-medium hover:underline underline-offset-4">Sign in</a>
                </p>
              </motion.div>
            ) : (
              <motion.div key="verify" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="p-8 md:p-10 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <ShieldCheck size={32} className="text-primary" />
                </div>
                <h2 className="text-2xl font-display font-bold text-foreground">Verify Your Email</h2>
                <p className="text-muted-foreground mt-2 mb-8 text-sm">
                  We sent a 6-digit code to <span className="text-foreground font-medium">{formData.email}</span>
                </p>
                <form onSubmit={handleVerify} className="space-y-5 text-left">
                  <Input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000" maxLength={6}
                    className="bg-background border-border h-14 text-center text-2xl font-mono tracking-[0.5em]" />
                  <Button type="submit" disabled={loading || code.length !== 6} className="w-full h-12 font-semibold bg-primary hover:bg-primary/90">
                    {loading ? <Loader2 size={18} className="animate-spin" /> : "Verify & Activate Account"}
                  </Button>
                </form>
                <div className="mt-5 flex items-center justify-center gap-2 text-sm">
                  <span className="text-muted-foreground">Didn't receive it?</span>
                  <button onClick={handleResend} disabled={resending || countdown > 0}
                    className="flex items-center gap-1 text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed">
                    {resending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    {countdown > 0 ? `Resend in ${countdown}s` : "Resend Code"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
