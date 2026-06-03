import { useState, useEffect, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, ArrowRight, ArrowLeft, Check, Loader2, Shield,
  Globe, ChevronRight, HardDrive, Users, Lock,
  CheckCircle2, Info, Star, CreditCard, Building2,
  Receipt, Download, Copy, ExternalLink, Zap, Search,
  RefreshCw, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const API = "/api";
const SESSION_KEY = "noemail_checkout";

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
  id: string; name: string; max_storage_gb: number;
  max_mailboxes: number; price: number; yearly_price: number | null; is_popular: boolean;
}

interface PlacedInvoice {
  invoiceNumber: string; invoiceId: string; orderId: string;
  domain: string; packageName: string; amount: number; billing: string;
  status: string; dueDate?: string;
}

function isLoggedIn() {
  return !!(localStorage.getItem("token") || localStorage.getItem("noehost_token"));
}

function validateDomain(d: string): string | null {
  const clean = d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!clean) return "Domain is required";
  const reg = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/;
  if (!reg.test(clean)) return "Enter a valid domain (e.g. yourbusiness.com)";
  return null;
}

function cleanDomainStr(d: string) {
  return d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

const STEPS = ["Choose Plan", "Your Domain", "Review & Pay"];

export default function EmailHostingCheckout() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const preselectedId = params.get("plan");
  const resumeStep = params.get("step");
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [packages, setPackages] = useState<EmailPackage[]>([]);
  const [pkgLoading, setPkgLoading] = useState(true);
  const [selectedPkg, setSelectedPkg] = useState<EmailPackage | null>(null);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  // Domain step
  const [domainType, setDomainType] = useState<"existing" | "new" | null>(null);
  const [domain, setDomain] = useState("");
  const [domainError, setDomainError] = useState<string | null>(null);
  // New domain search
  const [newDomainQuery, setNewDomainQuery] = useState("");
  const [newDomainSearching, setNewDomainSearching] = useState(false);
  const [newDomainAvailable, setNewDomainAvailable] = useState<boolean | null>(null);

  // Review step
  const [payMethod, setPayMethod] = useState<"safepay" | "bank">("bank");
  const [submitting, setSubmitting] = useState(false);

  // Invoice display
  const [invoice, setInvoice] = useState<PlacedInvoice | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Load packages ─────────────────────────────────────────────────────────
  useEffect(() => {
    apiFetch(`${API}/email-packages`).then(data => {
      setPackages(data);
      if (preselectedId) {
        const found = data.find((p: EmailPackage) => p.id === preselectedId);
        if (found) setSelectedPkg(found);
      }
    }).catch(() => {}).finally(() => setPkgLoading(false));
  }, []);

  // ── Restore session after login redirect ──────────────────────────────────
  useEffect(() => {
    if (resumeStep === "2") {
      try {
        const saved = sessionStorage.getItem(SESSION_KEY);
        if (saved) {
          const s = JSON.parse(saved);
          if (s.pkgId && packages.length) {
            const found = packages.find(p => p.id === s.pkgId);
            if (found) setSelectedPkg(found);
          }
          if (s.domain) setDomain(s.domain);
          if (s.domainType) setDomainType(s.domainType);
          if (s.billing) setBilling(s.billing);
          setStep(2);
          sessionStorage.removeItem(SESSION_KEY);
        }
      } catch {}
    }
  }, [packages, resumeStep]);

  function getPrice(pkg: EmailPackage) {
    return billing === "yearly" && pkg.yearly_price ? Number(pkg.yearly_price) / 12 : Number(pkg.price);
  }

  function getSave(pkg: EmailPackage) {
    if (!pkg.yearly_price) return null;
    return Math.round((1 - (Number(pkg.yearly_price) / 12) / Number(pkg.price)) * 100);
  }

  function handleSelectPlan(pkg: EmailPackage) {
    setSelectedPkg(pkg);
    setStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function checkNewDomain() {
    const q = cleanDomainStr(newDomainQuery);
    if (!q || !q.includes(".")) {
      toast({ title: "Enter a full domain e.g. mycompany.com", variant: "destructive" });
      return;
    }
    setNewDomainSearching(true);
    setNewDomainAvailable(null);
    try {
      const res = await fetch(`${API}/domain-check?domain=${encodeURIComponent(q)}`);
      const d = await res.json();
      const avail = d.available ?? d.status === "available" ?? false;
      setNewDomainAvailable(avail);
      if (avail) {
        setDomain(q);
        setDomainType("new");
        toast({ title: `${q} is available!`, description: "Domain will be registered during checkout." });
      }
    } catch {
      setNewDomainAvailable(false);
    } finally {
      setNewDomainSearching(false);
    }
  }

  function handleDomainContinue() {
    if (domainType === "new") {
      if (!newDomainAvailable || !domain) {
        toast({ title: "Search and confirm an available domain first", variant: "destructive" });
        return;
      }
    } else {
      const err = validateDomain(domain);
      if (err) { setDomainError(err); return; }
      setDomainError(null);
    }

    if (!isLoggedIn()) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        pkgId: selectedPkg?.id,
        domain,
        domainType,
        billing,
      }));
      navigate(`/client/login?redirect=/checkout/email-hosting?step=2`);
      return;
    }
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handlePlaceOrder() {
    if (!selectedPkg || !domain) return;
    if (!isLoggedIn()) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ pkgId: selectedPkg.id, domain, domainType, billing }));
      navigate(`/client/login?redirect=/checkout/email-hosting?step=2`);
      return;
    }

    setSubmitting(true);
    try {
      const order = await apiFetch(`${API}/my/email-orders`, {
        method: "POST",
        body: JSON.stringify({
          package_id: selectedPkg.id,
          domain_name: cleanDomainStr(domain),
          billing_cycle: billing,
        }),
      });

      if (payMethod === "safepay") {
        try {
          const pay = await apiFetch(`${API}/payments/safepay/initiate`, {
            method: "POST",
            body: JSON.stringify({ invoiceId: order.invoiceId }),
          });
          if (pay?.checkoutUrl) {
            window.location.href = pay.checkoutUrl;
            return;
          }
        } catch {
          setPayMethod("bank");
        }
      }

      setInvoice({
        invoiceNumber: order.invoiceNumber ?? order.invoice_number ?? `NOE-${Date.now()}`,
        invoiceId: order.invoiceId ?? order.invoice_id ?? "",
        orderId: order.orderId ?? order.id ?? "",
        domain: cleanDomainStr(domain),
        packageName: selectedPkg.name,
        amount: billing === "yearly" && selectedPkg.yearly_price ? Number(selectedPkg.yearly_price) : Number(selectedPkg.price),
        billing,
        status: "pending_payment",
        dueDate: new Date(Date.now() + 7 * 86400000).toLocaleDateString("en-PK"),
      });
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      toast({ title: "Order failed", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const cleanDom = cleanDomainStr(domain);
  const totalPrice = selectedPkg
    ? billing === "yearly" && selectedPkg.yearly_price ? Number(selectedPkg.yearly_price) : Number(selectedPkg.price)
    : 0;

  return (
    <div className="min-h-screen" style={{ background: "#f8f8ff" }}>
      {/* ── Header ── */}
      <div style={{ borderBottom: "1px solid #ede9fe", background: "#fff" }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => step === 0 ? navigate("/business-email") : step > 2 ? navigate("/dashboard") : setStep(s => s - 1)}
            className="p-2 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#7C3AED" }}>
              <Mail className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              NoeMail Checkout
            </span>
          </div>

          {/* Step indicators — hide on invoice step */}
          {step < 3 && (
            <div className="ml-auto flex items-center gap-2">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 text-sm font-medium ${i === step ? "text-violet-700" : i < step ? "text-emerald-600" : "text-gray-400"}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === step ? "bg-violet-600 text-white" : i < step ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-400"}`}>
                      {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
                    </div>
                    <span className="hidden sm:block">{s}</span>
                  </div>
                  {i < STEPS.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">

          {/* ══ STEP 0: Plan Selection ══ */}
          {step === 0 && (
            <motion.div key="step0" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4"
                  style={{ background: "#F5F3FF", color: "#7C3AED" }}>
                  <Mail className="w-3.5 h-3.5" /> Professional Business Email
                </div>
                <h1 className="text-3xl font-black text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Choose your NoeMail plan
                </h1>
                <p className="text-gray-500 mt-2">Custom domain email — yourname@yourdomain.com</p>
                <div className="flex items-center justify-center gap-3 mt-6">
                  <span className={`text-sm font-medium ${billing === "monthly" ? "text-gray-900" : "text-gray-400"}`}>Monthly</span>
                  <button onClick={() => setBilling(b => b === "monthly" ? "yearly" : "monthly")}
                    className="relative w-12 h-6 rounded-full transition-colors"
                    style={{ background: billing === "yearly" ? "#7C3AED" : "#D1D5DB" }}>
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${billing === "yearly" ? "translate-x-6" : "translate-x-0.5"}`} />
                  </button>
                  <span className={`text-sm font-medium ${billing === "yearly" ? "text-gray-900" : "text-gray-400"}`}>
                    Yearly <span className="text-xs font-bold ml-1" style={{ color: "#7C3AED" }}>Save up to 45%</span>
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
                        className="relative rounded-2xl p-6 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all"
                        style={{ border: `2px solid ${pkg.is_popular ? "#7C3AED" : "#E5E7EB"}`, background: "#fff" }}>
                        {pkg.is_popular && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <span className="text-xs font-bold text-white px-3 py-1 rounded-full flex items-center gap-1" style={{ background: "#7C3AED" }}>
                              <Star className="w-3 h-3" /> Most Popular
                            </span>
                          </div>
                        )}
                        <div className="font-bold text-gray-900 text-lg mb-1">{pkg.name}</div>
                        <div className="flex items-end gap-1 mb-1">
                          <span className="text-3xl font-black text-gray-900">PKR {Math.round(price).toLocaleString()}</span>
                          <span className="text-sm text-gray-400 mb-1">/mo</span>
                        </div>
                        {billing === "yearly" && save && (
                          <div className="text-xs font-semibold mb-4" style={{ color: "#7C3AED" }}>
                            Save {save}% · PKR {Number(pkg.yearly_price).toLocaleString()}/yr
                          </div>
                        )}
                        <div className="space-y-2 my-4">
                          {[
                            { icon: HardDrive, text: `${pkg.max_storage_gb} GB Storage` },
                            { icon: Users, text: pkg.max_mailboxes === 999 ? "Unlimited Mailboxes" : `${pkg.max_mailboxes} Mailboxes` },
                            { icon: Mail, text: "Custom Domain Email" },
                            { icon: Shield, text: "SSL + DKIM + DMARC" },
                          ].map(f => (
                            <div key={f.text} className="flex items-center gap-2 text-sm text-gray-600">
                              <f.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#7C3AED" }} />
                              {f.text}
                            </div>
                          ))}
                        </div>
                        <button className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all"
                          style={{ background: pkg.is_popular ? "#7C3AED" : "#F5F3FF", color: pkg.is_popular ? "#fff" : "#7C3AED" }}>
                          Select Plan <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
              {packages.length === 0 && !pkgLoading && (
                <div className="text-center py-20 text-gray-400">
                  <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No plans available yet. Please check back soon.</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ══ STEP 1: Domain Choice ══ */}
          {step === 1 && selectedPkg && (
            <motion.div key="step1" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "#F5F3FF" }}>
                  <Globe className="w-7 h-7" style={{ color: "#7C3AED" }} />
                </div>
                <h2 className="text-2xl font-black text-gray-900">Set up your domain</h2>
                <p className="text-gray-500 mt-2 text-sm">Your emails will be: you@<strong>yourdomain.com</strong></p>
              </div>

              {/* Plan mini summary */}
              <div className="flex items-center justify-between px-4 py-3 rounded-xl mb-6"
                style={{ background: "#F5F3FF", border: "1px solid #DDD6FE" }}>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#7C3AED" }}>Selected Plan</div>
                  <div className="font-bold text-gray-900">{selectedPkg.name}</div>
                </div>
                <div className="text-right">
                  <div className="font-black text-gray-900">PKR {Math.round(getPrice(selectedPkg)).toLocaleString()}<span className="text-xs font-medium text-gray-400">/mo</span></div>
                  <button className="text-xs underline" style={{ color: "#7C3AED" }} onClick={() => setStep(0)}>Change</button>
                </div>
              </div>

              {/* Two domain options */}
              {!domainType && (
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  {/* Register new domain */}
                  <button
                    onClick={() => setDomainType("new")}
                    className="group text-left p-5 rounded-2xl border-2 hover:border-violet-400 hover:shadow-md transition-all"
                    style={{ borderColor: "#E5E7EB", background: "#fff" }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"
                      style={{ background: "#F5F3FF" }}>
                      <Search className="w-5 h-5" style={{ color: "#7C3AED" }} />
                    </div>
                    <div className="font-bold text-gray-900 mb-1">Register New Domain</div>
                    <div className="text-sm text-gray-500">Search and register a brand-new domain. We'll handle the registration for you.</div>
                    <div className="mt-3 text-xs font-semibold inline-flex items-center gap-1" style={{ color: "#7C3AED" }}>
                      Search availability <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </button>

                  {/* Use existing domain */}
                  <button
                    onClick={() => setDomainType("existing")}
                    className="group text-left p-5 rounded-2xl border-2 hover:border-violet-400 hover:shadow-md transition-all"
                    style={{ borderColor: "#E5E7EB", background: "#fff" }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"
                      style={{ background: "#F5F3FF" }}>
                      <Globe className="w-5 h-5" style={{ color: "#7C3AED" }} />
                    </div>
                    <div className="font-bold text-gray-900 mb-1">I Already Have a Domain</div>
                    <div className="text-sm text-gray-500">Use a domain you already own. We'll show you how to configure DNS records.</div>
                    <div className="mt-3 text-xs font-semibold inline-flex items-center gap-1" style={{ color: "#7C3AED" }}>
                      Enter domain <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </button>
                </div>
              )}

              {/* Register new domain form */}
              {domainType === "new" && (
                <div className="bg-white rounded-2xl p-6 mb-4" style={{ border: "1px solid #E5E7EB" }}>
                  <button onClick={() => { setDomainType(null); setNewDomainAvailable(null); setDomain(""); }}
                    className="text-xs text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to options
                  </button>
                  <div className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Search className="w-4 h-4" style={{ color: "#7C3AED" }} /> Search for a domain
                  </div>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      className="flex-1 px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ border: "1px solid #E5E7EB" }}
                      placeholder="e.g. mycompany.com"
                      value={newDomainQuery}
                      onChange={e => { setNewDomainQuery(e.target.value); setNewDomainAvailable(null); }}
                      onKeyDown={e => e.key === "Enter" && checkNewDomain()}
                    />
                    <Button onClick={checkNewDomain} disabled={newDomainSearching}
                      className="px-5 py-3 rounded-xl font-semibold gap-2" style={{ background: "#7C3AED" }}>
                      {newDomainSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      Check
                    </Button>
                  </div>

                  {newDomainAvailable === true && (
                    <div className="flex items-center gap-2 p-3 rounded-xl mb-3" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm font-medium text-emerald-700"><strong>{cleanDomainStr(newDomainQuery)}</strong> is available!</span>
                    </div>
                  )}
                  {newDomainAvailable === false && (
                    <div className="flex items-center gap-2 p-3 rounded-xl mb-3" style={{ background: "#FFF7ED", border: "1px solid #FED7AA" }}>
                      <AlertCircle className="w-4 h-4 text-orange-500" />
                      <span className="text-sm text-orange-700">Domain is taken. Try a different name or extension.</span>
                    </div>
                  )}

                  <Button
                    className="w-full py-3 font-bold rounded-xl gap-2"
                    style={{ background: newDomainAvailable ? "#7C3AED" : "#E5E7EB", color: newDomainAvailable ? "#fff" : "#9CA3AF" }}
                    disabled={!newDomainAvailable}
                    onClick={handleDomainContinue}>
                    Continue with {domain || "domain"} <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* Existing domain form */}
              {domainType === "existing" && (
                <div className="bg-white rounded-2xl p-6 mb-4" style={{ border: "1px solid #E5E7EB" }}>
                  <button onClick={() => { setDomainType(null); setDomain(""); setDomainError(null); }}
                    className="text-xs text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to options
                  </button>
                  <div className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Globe className="w-4 h-4" style={{ color: "#7C3AED" }} /> Enter your domain
                  </div>
                  <div className="space-y-2 mb-5">
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        className="w-full pl-10 pr-4 py-3.5 rounded-xl text-sm outline-none transition-all"
                        style={{ border: `1px solid ${domainError ? "#F87171" : domain && !domainError ? "#34D399" : "#E5E7EB"}` }}
                        placeholder="yourdomain.com"
                        value={domain}
                        onChange={e => { setDomain(e.target.value); setDomainError(null); }}
                        onKeyDown={e => e.key === "Enter" && handleDomainContinue()}
                      />
                    </div>
                    {domainError && <p className="text-xs text-red-500 flex items-center gap-1"><Info className="w-3.5 h-3.5" /> {domainError}</p>}
                    {domain && !domainError && (
                      <p className="text-xs text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Emails will be: you@{cleanDomainStr(domain)}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 flex items-center gap-1 pt-1">
                      <Info className="w-3.5 h-3.5" /> We'll guide you to update DNS records after setup — takes 2 mins.
                    </p>
                  </div>
                  <Button className="w-full py-3 font-bold text-base rounded-xl gap-2"
                    style={{ background: "#7C3AED" }} onClick={handleDomainContinue}>
                    Continue <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* Auth notice */}
              {domainType && !isLoggedIn() && (
                <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{ background: "#F5F3FF", border: "1px solid #DDD6FE" }}>
                  <Lock className="w-4 h-4 flex-shrink-0" style={{ color: "#7C3AED" }} />
                  <span className="text-gray-600">You'll be asked to sign in or create an account — your domain selection will be saved automatically.</span>
                </div>
              )}
            </motion.div>
          )}

          {/* ══ STEP 2: Review + Payment ══ */}
          {step === 2 && selectedPkg && (
            <motion.div key="step2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="grid md:grid-cols-5 gap-8">

              {/* Left — Order Review */}
              <div className="md:col-span-3 space-y-5">
                {/* Order Summary */}
                <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E5E7EB", boxShadow: "0 8px 30px rgba(0,0,0,0.04)" }}>
                  <h2 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
                    <Receipt className="w-5 h-5" style={{ color: "#7C3AED" }} /> Order Summary
                  </h2>

                  {/* Billing period toggle */}
                  <div className="flex items-center justify-between p-3 rounded-xl mb-5"
                    style={{ background: "#F9F9FF", border: "1px solid #EDE9FE" }}>
                    <div className="text-sm font-semibold text-gray-700">Billing</div>
                    <div className="flex items-center gap-2.5">
                      <span className={`text-xs font-semibold ${billing === "monthly" ? "text-gray-900" : "text-gray-400"}`}>Monthly</span>
                      <button onClick={() => setBilling(b => b === "monthly" ? "yearly" : "monthly")}
                        className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
                        style={{ background: billing === "yearly" ? "#7C3AED" : "#D1D5DB" }}>
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${billing === "yearly" ? "translate-x-5" : "translate-x-0.5"}`} />
                      </button>
                      <span className={`text-xs font-semibold ${billing === "yearly" ? "text-violet-700" : "text-gray-400"}`}>
                        Yearly {selectedPkg.yearly_price && <span className="text-violet-500">(Save {getSave(selectedPkg)}%)</span>}
                      </span>
                    </div>
                  </div>

                  {/* Line items */}
                  <div className="space-y-3 mb-5">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-gray-800">{selectedPkg.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {billing === "yearly" ? "Annual billing" : "Monthly billing"} · {cleanDom || "your domain"}
                        </div>
                        <div className="text-xs text-gray-400 flex items-center gap-2 mt-1">
                          <Mail className="w-3 h-3" /> {selectedPkg.max_mailboxes === 999 ? "Unlimited" : selectedPkg.max_mailboxes} mailboxes
                          <HardDrive className="w-3 h-3 ml-1" /> {selectedPkg.max_storage_gb} GB
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-800">PKR {Math.round(getPrice(selectedPkg)).toLocaleString()}<span className="text-xs text-gray-400">/mo</span></div>
                        {billing === "yearly" && selectedPkg.yearly_price && (
                          <div className="text-xs text-gray-400">PKR {Number(selectedPkg.yearly_price).toLocaleString()}/yr</div>
                        )}
                      </div>
                    </div>

                    {/* Domain badge */}
                    {cleanDom && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                        style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                        <Globe className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="font-medium text-emerald-700">{cleanDom}</span>
                        <span className="text-emerald-500">
                          {domainType === "new" ? "(new registration)" : "(existing domain)"}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-gray-700">Total due today</div>
                      <div className="text-xs text-gray-400">{billing === "yearly" ? "One annual payment" : "First monthly payment"}</div>
                    </div>
                    <span className="text-2xl font-black text-gray-900">PKR {totalPrice.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">30-day money-back guarantee. Cancel anytime.</p>
                </div>

                {/* Trust badges */}
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

              {/* Right — Payment Method + CTA */}
              <div className="md:col-span-2 space-y-4">
                <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E5E7EB", boxShadow: "0 8px 30px rgba(0,0,0,0.04)" }}>
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <CreditCard className="w-5 h-5" style={{ color: "#7C3AED" }} /> Payment Method
                  </h3>

                  <div className="space-y-3 mb-5">
                    {/* Safepay */}
                    <button
                      onClick={() => setPayMethod("safepay")}
                      className="w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3"
                      style={{ borderColor: payMethod === "safepay" ? "#7C3AED" : "#E5E7EB", background: payMethod === "safepay" ? "#F5F3FF" : "#fff" }}>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${payMethod === "safepay" ? "border-violet-600" : "border-gray-300"}`}>
                        {payMethod === "safepay" && <div className="w-2 h-2 rounded-full bg-violet-600" />}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-800 flex items-center gap-2">
                          <Zap className="w-4 h-4" style={{ color: "#7C3AED" }} /> Safepay
                          <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "#ECFDF5", color: "#059669" }}>Instant</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">Credit/debit card, JazzCash, EasyPaisa</div>
                      </div>
                    </button>

                    {/* Bank Transfer */}
                    <button
                      onClick={() => setPayMethod("bank")}
                      className="w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3"
                      style={{ borderColor: payMethod === "bank" ? "#7C3AED" : "#E5E7EB", background: payMethod === "bank" ? "#F5F3FF" : "#fff" }}>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${payMethod === "bank" ? "border-violet-600" : "border-gray-300"}`}>
                        {payMethod === "bank" && <div className="w-2 h-2 rounded-full bg-violet-600" />}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-800 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-600" /> Bank Transfer
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">Manual bank transfer — invoice generated on confirm</div>
                      </div>
                    </button>
                  </div>

                  <Button
                    className="w-full py-4 font-bold text-base rounded-xl gap-2 shadow-lg"
                    style={{ background: "#7C3AED" }}
                    disabled={submitting}
                    onClick={handlePlaceOrder}>
                    {submitting
                      ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing…</>
                      : <><Check className="w-5 h-5" /> Confirm Order — PKR {totalPrice.toLocaleString()}</>}
                  </Button>
                  <p className="text-center text-xs text-gray-400 mt-3 flex items-center justify-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> Secured & encrypted checkout
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ══ STEP 3: Invoice ══ */}
          {step === 3 && invoice && (
            <motion.div key="step3" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="max-w-xl mx-auto">

              {/* Success header */}
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: "#F0FDF4", border: "2px solid #BBF7D0" }}>
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </motion.div>
                <h2 className="text-2xl font-black text-gray-900">Order Placed Successfully!</h2>
                <p className="text-gray-500 mt-2 text-sm">Your NoeMail order has been received. Complete payment to activate.</p>
              </div>

              {/* Invoice card */}
              <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E5E7EB", boxShadow: "0 12px 40px rgba(0,0,0,0.08)" }}>
                {/* Invoice header */}
                <div className="px-6 pt-6 pb-4" style={{ background: "linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)" }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-violet-200 text-xs font-semibold uppercase tracking-wider mb-1">Invoice</div>
                      <div className="text-white text-2xl font-black">{invoice.invoiceNumber}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-violet-200 text-xs mb-1">Due Date</div>
                      <div className="text-white font-semibold">{invoice.dueDate}</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                    <div>
                      <div className="text-violet-200 text-xs mb-0.5">Amount Due</div>
                      <div className="text-white text-3xl font-black">PKR {invoice.amount.toLocaleString()}</div>
                    </div>
                    <div className="px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>
                      ⏳ Pending Payment
                    </div>
                  </div>
                </div>

                {/* Invoice body */}
                <div className="p-6 space-y-4">
                  {[
                    { label: "Plan", value: invoice.packageName },
                    { label: "Domain", value: invoice.domain },
                    { label: "Billing Cycle", value: invoice.billing === "yearly" ? "Annual (12 months)" : "Monthly" },
                    { label: "Order ID", value: invoice.orderId?.slice(0, 16) + "…" },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between items-center py-2 border-b border-gray-50">
                      <span className="text-sm text-gray-500">{r.label}</span>
                      <span className="text-sm font-semibold text-gray-800">{r.value}</span>
                    </div>
                  ))}
                </div>

                {/* Payment instructions */}
                <div className="mx-6 mb-6 p-4 rounded-xl" style={{ background: "#FFF7ED", border: "1px solid #FED7AA" }}>
                  <div className="text-sm font-bold text-orange-800 mb-2 flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> Bank Transfer Details
                  </div>
                  <div className="space-y-1 text-xs text-orange-700">
                    <div className="flex justify-between"><span>Bank:</span><span className="font-semibold">MCB Bank</span></div>
                    <div className="flex justify-between"><span>Account Name:</span><span className="font-semibold">Noehost Pvt Ltd</span></div>
                    <div className="flex justify-between"><span>Account No:</span><span className="font-semibold font-mono">0123-4567-8901-23</span></div>
                    <div className="flex justify-between"><span>Reference:</span><span className="font-semibold font-mono">{invoice.invoiceNumber}</span></div>
                  </div>
                </div>

                {/* Actions */}
                <div className="px-6 pb-6 flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => {
                      navigator.clipboard.writeText(invoice.invoiceNumber);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}>
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copied!" : "Copy Invoice No."}
                  </Button>
                  <Button
                    className="flex-1 gap-2"
                    style={{ background: "#7C3AED" }}
                    onClick={() => navigate("/dashboard/billing")}>
                    <ExternalLink className="w-4 h-4" /> View in Billing
                  </Button>
                </div>
              </div>

              {/* Next steps */}
              <div className="mt-6 p-5 rounded-2xl" style={{ border: "1px solid #DDD6FE", background: "#F5F3FF" }}>
                <div className="font-semibold text-violet-900 mb-3 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /> What happens next?
                </div>
                <div className="space-y-2">
                  {[
                    "Complete the bank transfer using the details above",
                    "Send payment screenshot to support@noehost.com",
                    "Our team will activate your email hosting within 2 hours",
                    "You'll receive DNS setup instructions via email",
                  ].map((s, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm text-violet-800">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                        style={{ background: "#7C3AED", color: "#fff" }}>{i + 1}</div>
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
