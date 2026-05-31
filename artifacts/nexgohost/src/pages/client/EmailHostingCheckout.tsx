import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, ArrowRight, ArrowLeft, Check, Loader2, Shield,
  Globe, ChevronRight, HardDrive, Users, Lock, X, Eye, EyeOff,
  CheckCircle2, Info, Star, CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const API = "/api";

function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token") || localStorage.getItem("noehost_token");
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers ?? {}),
    },
  }).then(async (r) => {
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Request failed");
    return d;
  });
}

interface EmailPackage {
  id: string;
  name: string;
  max_storage_gb: number;
  max_mailboxes: number;
  price: number;
  yearly_price: number | null;
  is_popular: boolean;
}

function isLoggedIn() {
  return !!(localStorage.getItem("token") || localStorage.getItem("noehost_token"));
}

function validateDomain(d: string): string | null {
  const clean = d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!clean) return "Domain is required";
  const domainReg = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/;
  if (!domainReg.test(clean)) return "Enter a valid domain (e.g. yourname.com)";
  return null;
}

const STEPS = ["Plan", "Domain", "Review & Order"];

export default function EmailHostingCheckout() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const preselectedId = params.get("plan");
  const { toast } = useToast();

  const [step, setStep] = useState(0); // 0=plan, 1=domain, 2=review+auth
  const [packages, setPackages] = useState<EmailPackage[]>([]);
  const [pkgLoading, setPkgLoading] = useState(true);
  const [selectedPkg, setSelectedPkg] = useState<EmailPackage | null>(null);
  const [billing, setBilling] = useState<"monthly" | "yearly">("yearly");
  const [domain, setDomain] = useState("");
  const [domainError, setDomainError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Auth state
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({ email: "", password: "", name: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    apiFetch(`${API}/email-packages`).then(data => {
      setPackages(data);
      if (preselectedId) {
        const found = data.find((p: EmailPackage) => p.id === preselectedId);
        if (found) { setSelectedPkg(found); setStep(1); }
      }
    }).catch(() => {}).finally(() => setPkgLoading(false));
  }, []);

  function getPrice(pkg: EmailPackage): number {
    return billing === "yearly" && pkg.yearly_price
      ? Number(pkg.yearly_price) / 12
      : Number(pkg.price);
  }

  function getSave(pkg: EmailPackage): number | null {
    if (!pkg.yearly_price) return null;
    const monthly = Number(pkg.price);
    const ymo = Number(pkg.yearly_price) / 12;
    return Math.round((1 - ymo / monthly) * 100);
  }

  function handleSelectPlan(pkg: EmailPackage) {
    setSelectedPkg(pkg);
    setStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleDomainNext() {
    const err = validateDomain(domain);
    if (err) { setDomainError(err); return; }
    setDomainError(null);
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleAuth() {
    if (!authForm.email || !authForm.password) {
      toast({ title: "Fill in all fields", variant: "destructive" });
      return;
    }
    setAuthLoading(true);
    try {
      const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body: any = { email: authForm.email, password: authForm.password };
      if (authMode === "register") body.name = authForm.name;
      const data = await apiFetch(endpoint, { method: "POST", body: JSON.stringify(body) });
      const token = data.token || data.accessToken;
      if (token) {
        localStorage.setItem("token", token);
        localStorage.setItem("noehost_token", token);
        toast({ title: authMode === "login" ? "Logged in" : "Account created" });
      }
    } catch (e: any) {
      toast({ title: "Auth failed", description: e.message, variant: "destructive" });
    } finally {
      setAuthLoading(false);
    }
  }

  async function handlePlaceOrder() {
    if (!selectedPkg || !domain) return;

    if (!isLoggedIn()) {
      toast({ title: "Please sign in first", variant: "destructive" });
      return;
    }

    const err = validateDomain(domain);
    if (err) { toast({ title: err, variant: "destructive" }); return; }

    setSubmitting(true);
    try {
      const order = await apiFetch(`${API}/my/email-orders`, {
        method: "POST",
        body: JSON.stringify({
          package_id: selectedPkg.id,
          domain_name: domain.trim().toLowerCase(),
          billing_cycle: billing,
        }),
      });
      toast({ title: "Order placed! Configuring DNS…" });
      navigate(`/checkout/email-hosting/dns/${order.id}`);
    } catch (e: any) {
      toast({ title: "Order failed", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const totalPrice = selectedPkg
    ? billing === "yearly" && selectedPkg.yearly_price
      ? Number(selectedPkg.yearly_price)
      : Number(selectedPkg.price)
    : 0;

  return (
    <div className="min-h-screen" style={{ background: "#ffffff" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #f0f0f0", background: "#fff" }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => step === 0 ? navigate("/business-email") : setStep(s => s - 1)}
            className="p-2 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5" style={{ color: "#7C3AED" }} />
            <span className="font-bold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              NoeMail Checkout
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 text-sm font-medium ${i === step ? "text-violet-700" : i < step ? "text-emerald-600" : "text-gray-400"}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                    ${i === step ? "bg-violet-600 text-white" : i < step ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-400"}`}>
                    {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className="hidden sm:block">{s}</span>
                </div>
                {i < STEPS.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">

          {/* ── STEP 0: Plan Selection ── */}
          {step === 0 && (
            <motion.div key="step0" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
              <div className="text-center mb-10">
                <h1 className="text-3xl font-black text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Choose your NoeMail plan
                </h1>
                <p className="text-gray-500 mt-2">Professional business email with your own domain.</p>

                {/* Billing toggle */}
                <div className="flex items-center justify-center gap-3 mt-6">
                  <span className={`text-sm font-medium ${billing === "monthly" ? "text-gray-900" : "text-gray-400"}`}>Monthly</span>
                  <button onClick={() => setBilling(b => b === "monthly" ? "yearly" : "monthly")}
                    className="relative w-12 h-6 rounded-full transition-colors"
                    style={{ background: billing === "yearly" ? "#7C3AED" : "#D1D5DB" }}>
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${billing === "yearly" ? "translate-x-6" : "translate-x-0.5"}`} />
                  </button>
                  <span className={`text-sm font-medium ${billing === "yearly" ? "text-gray-900" : "text-gray-400"}`}>
                    Yearly <span className="text-xs font-bold text-violet-600 ml-1">Save up to 45%</span>
                  </span>
                </div>
              </div>

              {pkgLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
              ) : (
                <div className="grid md:grid-cols-3 gap-6">
                  {packages.map((pkg, i) => {
                    const price = getPrice(pkg);
                    const save = getSave(pkg);
                    return (
                      <motion.div key={pkg.id}
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                        onClick={() => handleSelectPlan(pkg)}
                        className={`relative rounded-2xl p-6 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 ${pkg.is_popular
                          ? "shadow-xl border-2"
                          : "border"
                        }`}
                        style={{
                          borderColor: pkg.is_popular ? "#7C3AED" : "#E5E7EB",
                          background: "#fff",
                        }}>
                        {pkg.is_popular && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <span className="text-xs font-bold text-white px-3 py-1 rounded-full flex items-center gap-1"
                              style={{ background: "#7C3AED" }}>
                              <Star className="w-3 h-3" /> Most Popular
                            </span>
                          </div>
                        )}
                        <div className="font-bold text-gray-900 text-lg mb-1">{pkg.name}</div>
                        <div className="flex items-end gap-1 mb-1">
                          <span className="text-3xl font-black" style={{ color: "#111827" }}>
                            PKR {Math.round(price).toLocaleString()}
                          </span>
                          <span className="text-sm text-gray-400 mb-1">/mo</span>
                        </div>
                        {billing === "yearly" && save && (
                          <div className="text-xs font-medium mb-4" style={{ color: "#7C3AED" }}>
                            Save {save}% · billed PKR {Number(pkg.yearly_price).toLocaleString()}/yr
                          </div>
                        )}
                        <div className="space-y-2 mb-5 mt-3">
                          {[
                            { icon: HardDrive, text: `${pkg.max_storage_gb} GB storage` },
                            { icon: Users, text: pkg.max_mailboxes === 999 ? "Unlimited mailboxes" : `${pkg.max_mailboxes} mailboxes` },
                            { icon: Mail, text: "Custom domain email" },
                            { icon: Shield, text: "SSL encrypted" },
                          ].map(f => (
                            <div key={f.text} className="flex items-center gap-2 text-sm text-gray-600">
                              <f.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#7C3AED" }} />
                              {f.text}
                            </div>
                          ))}
                        </div>
                        <button className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all"
                          style={{
                            background: pkg.is_popular ? "#7C3AED" : "#F5F3FF",
                            color: pkg.is_popular ? "#fff" : "#7C3AED",
                          }}>
                          Get Started <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
              {packages.length === 0 && !pkgLoading && (
                <div className="text-center py-20 text-gray-400">
                  <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No plans available yet. Check back soon.</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ── STEP 1: Domain Setup ── */}
          {step === 1 && selectedPkg && (
            <motion.div key="step1" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="max-w-xl mx-auto">
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: "#F5F3FF" }}>
                  <Globe className="w-7 h-7" style={{ color: "#7C3AED" }} />
                </div>
                <h2 className="text-2xl font-black text-gray-900">Link your domain to NoeMail</h2>
                <p className="text-gray-500 mt-2 text-sm">
                  Your mailboxes will use this domain — e.g. you@<strong>yourdomain.com</strong>
                </p>
              </div>

              <div className="bg-white rounded-2xl p-8" style={{ border: "1px solid #E5E7EB", boxShadow: "0 8px 30px rgba(0,0,0,0.04)" }}>
                {/* Selected plan summary */}
                <div className="flex items-center justify-between p-4 rounded-xl mb-6"
                  style={{ background: "#F5F3FF" }}>
                  <div>
                    <div className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Selected Plan</div>
                    <div className="font-bold text-gray-900">{selectedPkg.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-gray-900">
                      PKR {Math.round(getPrice(selectedPkg)).toLocaleString()}<span className="text-xs font-medium text-gray-400">/mo</span>
                    </div>
                    <button className="text-xs text-violet-600 underline" onClick={() => setStep(0)}>Change</button>
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  <label className="text-sm font-semibold text-gray-700 block">Your domain</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      className="w-full pl-10 pr-4 py-3.5 rounded-xl text-sm outline-none transition-all"
                      style={{
                        border: `1px solid ${domainError ? "#F87171" : domain && !domainError ? "#34D399" : "#E5E7EB"}`,
                        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                      }}
                      placeholder="yourdomain.com"
                      value={domain}
                      onChange={e => { setDomain(e.target.value); setDomainError(null); }}
                      onKeyDown={e => e.key === "Enter" && handleDomainNext()}
                    />
                  </div>
                  {domainError && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5" /> {domainError}
                    </p>
                  )}
                  {domain && !domainError && (
                    <p className="text-xs text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Your email will be: you@{cleanDomain}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 flex items-center gap-1 pt-1">
                    <Info className="w-3.5 h-3.5" /> Domain must already be registered. We'll guide you to point DNS records after setup.
                  </p>
                </div>

                <Button className="w-full py-3 font-bold text-base rounded-xl gap-2"
                  style={{ background: "#7C3AED" }}
                  onClick={handleDomainNext}>
                  Continue <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── STEP 2: Review + Auth + Place Order ── */}
          {step === 2 && selectedPkg && (
            <motion.div key="step2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="grid md:grid-cols-5 gap-8">

              {/* Left — Order Review */}
              <div className="md:col-span-3 space-y-6">
                <div className="rounded-2xl p-6" style={{ border: "1px solid #E5E7EB", background: "#fff", boxShadow: "0 8px 30px rgba(0,0,0,0.04)" }}>
                  <h2 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
                    <CreditCard className="w-5 h-5" style={{ color: "#7C3AED" }} /> Order Review
                  </h2>

                  {/* Line items */}
                  <div className="space-y-3 mb-5">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-gray-800">{selectedPkg.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {billing === "yearly" ? "Annual billing" : "Monthly billing"} · {cleanDomain}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-800">
                          PKR {Math.round(getPrice(selectedPkg)).toLocaleString()}<span className="text-xs text-gray-400">/mo</span>
                        </div>
                        {billing === "yearly" && selectedPkg.yearly_price && (
                          <div className="text-xs text-gray-400">
                            PKR {Number(selectedPkg.yearly_price).toLocaleString()} billed now
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400 py-2 border-t border-gray-50">
                      <Mail className="w-3.5 h-3.5" /> {selectedPkg.max_mailboxes} mailboxes
                      <HardDrive className="w-3.5 h-3.5 ml-2" /> {selectedPkg.max_storage_gb} GB storage
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
                    <span className="font-bold text-gray-700">Total due today</span>
                    <span className="text-2xl font-black" style={{ color: "#111827" }}>
                      PKR {totalPrice.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    {billing === "yearly" ? "Annual subscription — renews in 12 months." : "Monthly subscription — renews every 30 days."}
                    {" "}30-day money-back guarantee.
                  </p>
                </div>

                {/* Guarantees */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: Shield, text: "30-day guarantee" },
                    { icon: Lock, text: "SSL encrypted" },
                    { icon: CheckCircle2, text: "24/7 support" },
                  ].map(g => (
                    <div key={g.text} className="rounded-xl p-3 text-center text-xs text-gray-500 flex flex-col items-center gap-1.5"
                      style={{ background: "#FAFAFA", border: "1px solid #F0F0F0" }}>
                      <g.icon className="w-5 h-5" style={{ color: "#7C3AED" }} />
                      {g.text}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right — Auth gate or Place Order */}
              <div className="md:col-span-2">
                {!isLoggedIn() ? (
                  <div className="rounded-2xl p-6" style={{ border: "1px solid #E5E7EB", background: "#fff", boxShadow: "0 8px 30px rgba(0,0,0,0.04)" }}>
                    <h3 className="font-bold text-gray-900 mb-1">Sign in to complete</h3>
                    <p className="text-sm text-gray-400 mb-5">Your order will be linked to your account immediately.</p>

                    {/* Auth mode toggle */}
                    <div className="flex bg-gray-50 rounded-xl p-1 mb-5">
                      {(["login", "register"] as const).map(m => (
                        <button key={m} onClick={() => setAuthMode(m)}
                          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${authMode === m ? "bg-white shadow text-gray-900" : "text-gray-400"}`}>
                          {m === "login" ? "Sign In" : "Create Account"}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-3 mb-4">
                      {authMode === "register" && (
                        <input
                          className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                          style={{ border: "1px solid #E5E7EB" }}
                          placeholder="Full name"
                          value={authForm.name}
                          onChange={e => setAuthForm(f => ({ ...f, name: e.target.value }))}
                        />
                      )}
                      <input
                        type="email"
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                        style={{ border: "1px solid #E5E7EB" }}
                        placeholder="Email address"
                        value={authForm.email}
                        onChange={e => setAuthForm(f => ({ ...f, email: e.target.value }))}
                      />
                      <div className="relative">
                        <input
                          type={showPwd ? "text" : "password"}
                          className="w-full px-4 py-3 rounded-xl text-sm outline-none pr-10"
                          style={{ border: "1px solid #E5E7EB" }}
                          placeholder="Password"
                          value={authForm.password}
                          onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))}
                          onKeyDown={e => e.key === "Enter" && handleAuth()}
                        />
                        <button type="button" onClick={() => setShowPwd(p => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                          {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <Button onClick={handleAuth} disabled={authLoading} className="w-full py-3 rounded-xl font-bold gap-2 mb-4"
                      style={{ background: "#7C3AED" }}>
                      {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      {authMode === "login" ? "Sign In to Profile" : "Create New Account"}
                    </Button>
                    <p className="text-xs text-gray-400 text-center">
                      Signing in instantly links your domain order to your account.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl p-6 space-y-4" style={{ border: "1px solid #E5E7EB", background: "#fff", boxShadow: "0 8px 30px rgba(0,0,0,0.04)" }}>
                    <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                      <CheckCircle2 className="w-5 h-5" /> Signed in — ready to order
                    </div>
                    <Button onClick={handlePlaceOrder} disabled={submitting}
                      className="w-full py-3.5 rounded-xl font-bold text-base gap-2"
                      style={{ background: "#7C3AED" }}>
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Place Order — PKR {totalPrice.toLocaleString()}
                    </Button>
                    <p className="text-xs text-gray-400 text-center">
                      30-day money-back guarantee. No hidden fees.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
