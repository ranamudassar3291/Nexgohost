import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Globe, CheckCircle, ArrowRight, TrendingDown, Key, Layers,
  AlertCircle, Loader2, Building2, X, Zap, Shield, Server,
  BarChart3, Users, ChevronRight, Sparkles, Star, Code2,
  Clock, RefreshCw, Lock, DollarSign, Package,
} from "lucide-react";

interface TldPricing {
  id: string;
  tld: string;
  retail_price: string;
  reseller_price: string;
}

const TIERS = [
  {
    name: "Starter",
    tier: 1,
    domains: "1–10 / month",
    highlight: false,
    features: ["Wholesale pricing", "REST API access", "DNS management", "EPP code retrieval", "Email support"],
    badge: null,
  },
  {
    name: "Professional",
    tier: 2,
    domains: "11–50 / month",
    highlight: true,
    features: ["Everything in Starter", "5% extra discount", "Priority support", "Bulk import tools", "Custom nameservers", "Renewal automation"],
    badge: "Most Popular",
  },
  {
    name: "Enterprise",
    tier: 3,
    domains: "50+ / month",
    highlight: false,
    features: ["Everything in Professional", "10% extra discount", "Dedicated account manager", "White-label portal", "SLA guarantee", "Custom billing cycles"],
    badge: "Best Value",
  },
];

const FEATURES = [
  { icon: Key, title: "Whitelabel API", desc: "Full REST API with your own credentials. Integrate domain registrations directly into any application or reseller panel." },
  { icon: TrendingDown, title: "Tiered Pricing", desc: "Three discount slabs. The more you register, the lower your cost per domain — up to 35% below retail." },
  { icon: Globe, title: "60+ TLD Extensions", desc: "Register .com, .pk, .net, .org, .co, .io and many more. All popular extensions at wholesale rates." },
  { icon: Shield, title: "WHOIS Privacy", desc: "Offer WHOIS privacy to your clients at no extra cost. Protect registrant details automatically." },
  { icon: RefreshCw, title: "Auto-Renewals", desc: "Set up automatic renewals from your reseller balance. Never lose a domain due to expiry again." },
  { icon: Code2, title: "Full API Docs", desc: "Comprehensive API documentation with code examples in 5 languages. Get integrated in minutes." },
];

const STEPS = [
  { n: "01", title: "Apply Online", desc: "Fill out a quick application with your business name and expected monthly volume. No credit card required." },
  { n: "02", title: "Get Approved", desc: "Our team reviews your application within 24 hours. Once approved, your API key and reseller balance are activated." },
  { n: "03", title: "Start Reselling", desc: "Use our API or dashboard to register domains at wholesale prices and resell to your clients at any markup you choose." },
];

export default function DomainReseller() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [pricing, setPricing] = useState<TldPricing[]>([]);
  const [loadingPricing, setLoadingPricing] = useState(true);
  const [showApply, setShowApply] = useState(false);
  const [applyForm, setApplyForm] = useState({
    businessName: "", monthlyVolume: "", website: "", contactPhone: "", notes: "",
  });
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyStatus, setApplyStatus] = useState<"idle" | "success" | "error">("idle");
  const [applyMsg, setApplyMsg] = useState("");

  useEffect(() => {
    fetch("/api/reseller/pricing")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setPricing(d); })
      .catch(() => {})
      .finally(() => setLoadingPricing(false));
  }, []);

  const savings = (retail: string, reseller: string) => {
    const r = parseFloat(retail), p = parseFloat(reseller);
    if (!r || !p) return "0";
    return Math.round(((r - p) / r) * 100).toString();
  };

  const fmt = (v: string) => {
    const n = parseFloat(v);
    if (isNaN(n)) return "—";
    return `Rs. ${n.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const handleApply = () => {
    if (!user) { navigate("/client/login?next=/domain-reseller"); return; }
    setShowApply(true);
  };

  const submitApply = async () => {
    if (!applyForm.businessName.trim()) {
      setApplyMsg("Please enter your business name."); setApplyStatus("error"); return;
    }
    setApplyLoading(true); setApplyStatus("idle");
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("noehost_token");
      const res = await fetch("/api/reseller/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ businessName: applyForm.businessName, monthlyVolume: applyForm.monthlyVolume }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setApplyStatus("success");
      setApplyMsg(data.existing
        ? "You already have an active application — we'll review it shortly."
        : "Application submitted! Our team will review and activate your account within 24 hours.");
    } catch (err: any) {
      setApplyStatus("error"); setApplyMsg(err.message || "Something went wrong.");
    } finally { setApplyLoading(false); }
  };

  return (
    <div className="bg-[#050612] text-white font-sans min-h-screen">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-28 pb-24">
        <div className="absolute inset-0 bg-gradient-to-br from-[#7C3AED]/20 via-transparent to-[#06B6D4]/10 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[#7C3AED]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Floating TLD badges */}
        <div className="absolute top-32 left-[8%] hidden xl:flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm font-bold text-slate-300 backdrop-blur-sm animate-pulse" style={{ animationDelay: "0s", animationDuration: "3s" }}>.com</div>
        <div className="absolute top-52 left-[4%] hidden xl:flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm font-bold text-purple-400 backdrop-blur-sm animate-pulse" style={{ animationDelay: "0.8s", animationDuration: "4s" }}>.pk</div>
        <div className="absolute top-40 right-[6%] hidden xl:flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm font-bold text-cyan-400 backdrop-blur-sm animate-pulse" style={{ animationDelay: "0.4s", animationDuration: "3.5s" }}>.net</div>
        <div className="absolute top-64 right-[10%] hidden xl:flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm font-bold text-slate-300 backdrop-blur-sm animate-pulse" style={{ animationDelay: "1.2s", animationDuration: "4.5s" }}>.io</div>
        <div className="absolute top-80 left-[7%] hidden xl:flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm font-bold text-emerald-400 backdrop-blur-sm animate-pulse" style={{ animationDelay: "0.6s", animationDuration: "3.8s" }}>.org</div>
        <div className="absolute top-96 right-[5%] hidden xl:flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm font-bold text-amber-400 backdrop-blur-sm animate-pulse" style={{ animationDelay: "1s", animationDuration: "4.2s" }}>.co</div>

        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#7C3AED]/15 border border-[#7C3AED]/30 mb-8">
            <Sparkles size={13} className="text-purple-400" />
            <span className="text-xs font-semibold text-purple-300 tracking-widest uppercase">Domain Reseller Program</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black leading-[1.05] mb-6 tracking-tight">
            Sell Domains Under
            <br />
            <span className="bg-gradient-to-r from-[#A78BFA] via-[#7C3AED] to-[#06B6D4] bg-clip-text text-transparent">
              Your Own Brand
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Access wholesale pricing on 60+ domain extensions, manage your portfolio with a
            professional REST API, and grow your reseller business with tiered volume discounts.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-14">
            <button
              onClick={handleApply}
              className="inline-flex items-center justify-center gap-3 px-10 py-4 bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] hover:from-[#6D28D9] hover:to-[#5B21B6] text-white rounded-2xl font-bold text-base transition-all shadow-[0_8px_30px_rgba(124,58,237,0.4)] hover:shadow-[0_12px_40px_rgba(124,58,237,0.5)] hover:-translate-y-0.5"
            >
              Apply Now — Free
              <ArrowRight size={18} />
            </button>
            {user && (
              <Link
                to="/client/reseller"
                className="inline-flex items-center justify-center gap-3 px-10 py-4 bg-white/5 border border-white/10 hover:border-white/20 text-white rounded-2xl font-bold text-base transition-all hover:-translate-y-0.5"
              >
                <BarChart3 size={18} />
                Go to Dashboard
              </Link>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
            {[
              { label: "TLD Extensions", value: "60+" },
              { label: "Approval Time", value: "24h" },
              { label: "Max Discount", value: "35%" },
              { label: "API Uptime", value: "99.9%" },
            ].map(s => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-center">
                <div className="text-2xl font-black text-white mb-1">{s.value}</div>
                <div className="text-xs text-slate-500 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing Table ─────────────────────────────────────────────────────── */}
      <section className="py-20 px-6" id="pricing">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-5">
              <DollarSign size={13} className="text-emerald-400" />
              <span className="text-xs font-semibold text-slate-400 tracking-widest uppercase">Live Pricing</span>
            </div>
            <h2 className="text-4xl font-black text-white mb-3 tracking-tight">Wholesale Domain Pricing</h2>
            <p className="text-slate-400 font-medium max-w-xl mx-auto">
              Real-time reseller prices from our registry. Retail price shown for comparison — your savings are automatic.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-sm">
            {/* Table header */}
            <div className="grid grid-cols-5 bg-white/5 border-b border-white/10 px-6 py-4">
              {["Extension", "Register Price", "Reseller Price", "Your Savings", "Action"].map(h => (
                <div key={h} className="text-xs font-black text-slate-500 uppercase tracking-widest">{h}</div>
              ))}
            </div>

            {loadingPricing ? (
              <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
                <Loader2 size={20} className="animate-spin text-purple-400" />
                <span className="text-sm font-medium">Loading pricing data…</span>
              </div>
            ) : pricing.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-sm font-medium">
                No pricing configured yet.
              </div>
            ) : (
              pricing.map((row, i) => {
                const pct = savings(row.retail_price, row.reseller_price);
                return (
                  <div
                    key={row.id}
                    className={`grid grid-cols-5 items-center px-6 py-4 hover:bg-white/[0.03] transition-colors ${i < pricing.length - 1 ? "border-b border-white/5" : ""}`}
                  >
                    <div className="font-black text-white text-sm">{row.tld}</div>
                    <div className="text-sm text-slate-500 font-medium line-through">{fmt(row.retail_price)}/yr</div>
                    <div className="text-sm font-black text-emerald-400">{fmt(row.reseller_price)}/yr</div>
                    <div>
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-xs font-black">
                        <TrendingDown size={10} />
                        {pct}% off
                      </span>
                    </div>
                    <div>
                      <button
                        onClick={handleApply}
                        className="px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold hover:bg-purple-500/20 transition-all"
                      >
                        Register
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <p className="mt-4 text-center text-xs text-slate-600 font-medium">
            * All prices in PKR (Pakistani Rupees). Volume-tiered discounts apply at higher slabs. Enterprise rates available on request.
          </p>
        </div>
      </section>

      {/* ── 3 Tier Plans ──────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gradient-to-b from-transparent to-white/[0.02]" id="plans">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-5">
              <Layers size={13} className="text-purple-400" />
              <span className="text-xs font-semibold text-slate-400 tracking-widest uppercase">Reseller Tiers</span>
            </div>
            <h2 className="text-4xl font-black text-white mb-3 tracking-tight">Choose Your Tier</h2>
            <p className="text-slate-400 font-medium">Start small, scale up. Your discount tier upgrades automatically as your volume grows.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {TIERS.map(tier => (
              <div
                key={tier.name}
                className={`relative rounded-3xl p-8 flex flex-col transition-all hover:-translate-y-1 ${
                  tier.highlight
                    ? "bg-gradient-to-b from-[#7C3AED]/30 to-[#7C3AED]/10 border-2 border-[#7C3AED]/60 shadow-[0_0_40px_rgba(124,58,237,0.2)]"
                    : "bg-white/5 border border-white/10"
                }`}
              >
                {tier.badge && (
                  <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-black ${
                    tier.highlight ? "bg-[#7C3AED] text-white" : "bg-amber-500 text-black"
                  }`}>
                    {tier.badge}
                  </div>
                )}
                <div className="mb-6">
                  <div className={`text-xs font-black uppercase tracking-widest mb-2 ${tier.highlight ? "text-purple-300" : "text-slate-500"}`}>
                    Tier {tier.tier}
                  </div>
                  <h3 className="text-2xl font-black text-white mb-1">{tier.name}</h3>
                  <p className="text-sm text-slate-400 font-medium">{tier.domains}</p>
                </div>
                <ul className="space-y-3 flex-1 mb-8">
                  {tier.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                      <CheckCircle size={15} className={`mt-0.5 shrink-0 ${tier.highlight ? "text-purple-400" : "text-emerald-500"}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={handleApply}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                    tier.highlight
                      ? "bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-[0_8px_20px_rgba(124,58,237,0.4)]"
                      : "bg-white/5 border border-white/10 hover:border-white/20 text-white"
                  }`}
                >
                  Apply for Tier {tier.tier}
                  <ArrowRight size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Grid ─────────────────────────────────────────────────────── */}
      <section className="py-20 px-6" id="features">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-5">
              <Zap size={13} className="text-amber-400" />
              <span className="text-xs font-semibold text-slate-400 tracking-widest uppercase">Platform Features</span>
            </div>
            <h2 className="text-4xl font-black text-white mb-3 tracking-tight">Everything You Need to Scale</h2>
            <p className="text-slate-400 font-medium">Professional-grade tools built specifically for domain resellers.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="bg-white/5 border border-white/10 rounded-2xl p-7 hover:border-purple-500/30 hover:bg-white/[0.07] transition-all group"
              >
                <div className="w-11 h-11 rounded-xl bg-[#7C3AED]/20 flex items-center justify-center mb-5 group-hover:bg-[#7C3AED]/30 transition-colors">
                  <Icon size={20} className="text-purple-400" />
                </div>
                <h3 className="font-black text-white mb-2 text-sm tracking-tight">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-white/[0.02] border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-black text-white mb-3 tracking-tight">How It Works</h2>
            <p className="text-slate-400 font-medium">Get started in three simple steps.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-8 left-[calc(33%+1rem)] right-[calc(33%+1rem)] h-px bg-gradient-to-r from-purple-500/30 to-purple-500/30 border-t border-dashed border-white/10" />
            {STEPS.map(({ n, title, desc }) => (
              <div key={n} className="text-center relative">
                <div className="w-16 h-16 rounded-2xl bg-[#7C3AED]/20 border border-[#7C3AED]/30 flex items-center justify-center mx-auto mb-6 relative z-10">
                  <span className="text-xl font-black text-purple-400">{n}</span>
                </div>
                <h3 className="text-lg font-black text-white mb-3">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust Badges ──────────────────────────────────────────────────────── */}
      <section className="py-16 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Lock, label: "ICANN Accredited", sub: "Fully licensed registry" },
              { icon: Shield, label: "Secure API", sub: "TLS 1.3 encryption" },
              { icon: Clock, label: "24h Approval", sub: "Fast onboarding" },
              { icon: Star, label: "Trusted by 500+", sub: "Resellers globally" },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-4">
                <div className="w-9 h-9 rounded-xl bg-[#7C3AED]/20 flex items-center justify-center shrink-0">
                  <Icon size={17} className="text-purple-400" />
                </div>
                <div>
                  <div className="text-sm font-black text-white">{label}</div>
                  <div className="text-xs text-slate-500">{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Apply CTA ─────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#7C3AED]/15 to-[#06B6D4]/10 pointer-events-none" />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <div className="w-20 h-20 rounded-3xl bg-[#7C3AED]/20 border border-[#7C3AED]/30 flex items-center justify-center mx-auto mb-8">
            <Globe size={36} className="text-purple-400" />
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-5 tracking-tight">
            Ready to Start Reselling?
          </h2>
          <p className="text-slate-400 font-medium mb-10 max-w-xl mx-auto leading-relaxed">
            Applications are reviewed within 24 hours. Once approved, your API credentials and
            reseller dashboard are instantly activated — no setup fees.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleApply}
              className="inline-flex items-center justify-center gap-3 px-10 py-4 bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] hover:from-[#6D28D9] hover:to-[#5B21B6] text-white rounded-2xl font-bold text-base transition-all shadow-[0_8px_30px_rgba(124,58,237,0.4)] hover:-translate-y-0.5"
            >
              Apply Now — It's Free
              <ArrowRight size={18} />
            </button>
            <a
              href="https://wa.me/923000000000"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-3 px-10 py-4 bg-white/5 border border-white/10 hover:border-white/20 text-white rounded-2xl font-bold text-base transition-all hover:-translate-y-0.5"
            >
              <Users size={18} />
              Talk to Sales
            </a>
          </div>
          {user && (
            <p className="mt-8">
              <Link to="/client/reseller" className="text-purple-400 text-sm font-semibold hover:text-purple-300 underline underline-offset-4">
                Go to my Reseller Dashboard →
              </Link>
            </p>
          )}
        </div>
      </section>

      {/* ── Apply Modal ───────────────────────────────────────────────────────── */}
      {showApply && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0D0D1A] border border-white/10 rounded-3xl shadow-[0_32px_80px_rgba(0,0,0,0.6)] w-full max-w-lg p-8 relative">
            <button
              onClick={() => { setShowApply(false); setApplyStatus("idle"); }}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="mb-7">
              <div className="w-12 h-12 rounded-xl bg-[#7C3AED]/20 flex items-center justify-center mb-4">
                <Building2 size={22} className="text-purple-400" />
              </div>
              <h3 className="text-xl font-black text-white mb-1">Apply for Reseller Access</h3>
              <p className="text-sm text-slate-400">Tell us about your business. Approval within 24 hours — no fees.</p>
            </div>

            {applyStatus === "success" ? (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                  <CheckCircle size={30} className="text-emerald-400" />
                </div>
                <p className="text-slate-300 font-medium text-sm leading-relaxed max-w-xs">{applyMsg}</p>
                <button
                  onClick={() => { setShowApply(false); setApplyStatus("idle"); }}
                  className="mt-2 px-8 py-3 bg-[#7C3AED] text-white rounded-xl text-sm font-bold hover:bg-[#6D28D9] transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                    Business / Brand Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={applyForm.businessName}
                    onChange={e => setApplyForm(f => ({ ...f, businessName: e.target.value }))}
                    placeholder="e.g. Acme Web Solutions"
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm font-medium placeholder-slate-600 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/10 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                    Expected Monthly Domain Registrations
                  </label>
                  <select
                    value={applyForm.monthlyVolume}
                    onChange={e => setApplyForm(f => ({ ...f, monthlyVolume: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#0D0D1A] text-white text-sm font-medium focus:outline-none focus:border-purple-500/50 transition-all"
                  >
                    <option value="">Select expected volume…</option>
                    <option value="1-10">1–10 per month (Tier 1 — Starter)</option>
                    <option value="11-50">11–50 per month (Tier 2 — Professional)</option>
                    <option value="50+">50+ per month (Tier 3 — Enterprise)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                    Your Website <span className="text-slate-600">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={applyForm.website}
                    onChange={e => setApplyForm(f => ({ ...f, website: e.target.value }))}
                    placeholder="https://yourcompany.com"
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm font-medium placeholder-slate-600 focus:outline-none focus:border-purple-500/50 transition-all"
                  />
                </div>

                {applyStatus === "error" && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
                    <AlertCircle size={15} />
                    {applyMsg}
                  </div>
                )}

                <button
                  onClick={submitApply}
                  disabled={applyLoading}
                  className="w-full py-3.5 bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] hover:from-[#6D28D9] hover:to-[#5B21B6] disabled:opacity-60 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 mt-2 shadow-[0_8px_20px_rgba(124,58,237,0.3)]"
                >
                  {applyLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  {applyLoading ? "Submitting…" : "Submit Application"}
                </button>
                <p className="text-center text-xs text-slate-600">
                  By applying you agree to our{" "}
                  <Link to="/terms-and-conditions" className="text-purple-400 hover:underline">Terms of Service</Link>
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
