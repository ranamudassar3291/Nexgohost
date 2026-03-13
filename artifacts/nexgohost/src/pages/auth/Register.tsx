import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, UserPlus, ShieldCheck, RefreshCw } from "lucide-react";

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
  const [step, setStep] = useState<"form" | "verify">("form");
  const [tempToken, setTempToken] = useState("");
  const [code, setCode] = useState("");
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);

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
      const data = await apiFetch("/api/auth/register", null, { method: "POST", body: JSON.stringify(formData) });
      setTempToken(data.token);
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
      toast({ title: "Email verified!", description: "Welcome to Nexgohost." });
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
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-background py-12">
      <div className="absolute inset-0 z-0">
        <img 
          src={`${import.meta.env.BASE_URL}images/auth-bg.png`} 
          alt="Abstract Background" 
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/90 to-background" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl z-10 p-4"
      >
        <div className="glass-card p-8 md:p-10 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[80px]" />
          
          <AnimatePresence mode="wait">
            {step === "form" ? (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10">
                <div className="mb-8">
                  <h1 className="text-3xl font-display font-bold text-foreground">Create Account</h1>
                  <p className="text-muted-foreground mt-2">Join Nexgohost to deploy and manage your infrastructure.</p>
                </div>
                <form onSubmit={handleRegister} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground/80">First Name *</label>
                      <Input name="firstName" required value={formData.firstName} onChange={handleChange} className="bg-background/50 border-white/10 h-11" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground/80">Last Name *</label>
                      <Input name="lastName" required value={formData.lastName} onChange={handleChange} className="bg-background/50 border-white/10 h-11" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground/80">Email Address *</label>
                      <Input type="email" name="email" required value={formData.email} onChange={handleChange} className="bg-background/50 border-white/10 h-11" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground/80">Password *</label>
                      <Input type="password" name="password" required value={formData.password} onChange={handleChange} className="bg-background/50 border-white/10 h-11" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground/80">Company Name</label>
                      <Input name="company" value={formData.company} onChange={handleChange} className="bg-background/50 border-white/10 h-11" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground/80">Phone Number</label>
                      <Input name="phone" value={formData.phone} onChange={handleChange} className="bg-background/50 border-white/10 h-11" />
                    </div>
                  </div>
                  <Button type="submit" disabled={loading}
                    className="w-full h-12 mt-2 text-base font-semibold rounded-xl bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="flex items-center gap-2"><UserPlus className="w-5 h-5" /> Complete Registration</span>}
                  </Button>
                </form>
                <p className="mt-8 text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <a href="/login" className="text-primary font-medium hover:underline underline-offset-4">Sign in</a>
                </p>
              </motion.div>
            ) : (
              <motion.div key="verify" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="relative z-10 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <ShieldCheck size={32} className="text-primary" />
                </div>
                <h1 className="text-2xl font-display font-bold text-foreground">Verify Your Email</h1>
                <p className="text-muted-foreground mt-2 mb-8">
                  We sent a 6-digit code to <span className="text-foreground font-medium">{formData.email}</span>. Enter it below.
                </p>
                <form onSubmit={handleVerify} className="space-y-5 text-left">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground/80">Verification Code</label>
                    <Input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000" maxLength={6}
                      className="bg-background/50 border-white/10 h-14 text-center text-2xl font-mono tracking-[0.5em]" />
                    <p className="text-xs text-muted-foreground">Code expires in 10 minutes</p>
                  </div>
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
