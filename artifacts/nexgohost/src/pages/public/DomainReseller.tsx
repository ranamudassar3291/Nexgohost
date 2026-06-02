import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Globe, CheckCircle, ArrowRight, TrendingDown, Key, Layers,
  AlertCircle, Loader2, Building2, X, Zap, Shield,
  ChevronRight, Sparkles, Star, Code2, Lock, DollarSign,
  Users, Package, RefreshCw, ServerCog, BookOpen, ChevronLeft,
  Rocket, Crown, BadgeCheck, BarChart3,
} from "lucide-react";

interface TldPricing {
  id: string; tld: string; retail_price: string; reseller_price: string;
}

const BRAND = "#7C3AED";

const TIERS = [
  {
    id: "starter",
    name: "Starter Reseller",
    popular: false,
    deposit: "PKR 15,000",
    depositUsd: "$50",
    volume: "1–10 Domains / Month",
    exampleTld: ".com at $11.50 / year",
    icon: Rocket,
    color: "text-sky-600",
    bg: "bg-sky-50",
    border: "border-sky-100",
    accent: "#0EA5E9",
    features: [
      "Free API Access (REST)",
      "WHMCS Module Included",
      "White-label Branding",
      "DNS Management Panel",
      "EPP Code Retrieval",
      "Email Support",
    ],
  },
  {
    id: "professional",
    name: "Professional Reseller",
    popular: true,
    deposit: "PKR 75,000",
    depositUsd: "$250",
    volume: "11–50 Domains / Month",
    exampleTld: ".com at $10.25 / year",
    icon: Crown,
    color: "text-[#7C3AED]",
    bg: "bg-[#7C3AED]/8",
    border: "border-[#7C3AED]/20",
    accent: "#7C3AED",
    features: [
      "All Starter Features",
      "Mid-Tier Wholesale Pricing",
      "Dedicated API Support Manager",
      "Blesta Integration Support",
      "Priority Ticket Queue",
      "Bulk Domain Import Tools",
      "Custom Nameserver Setup",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise / Wholesale",
    popular: false,
    deposit: "PKR 150,000+",
    depositUsd: "$500+",
    volume: "51+ Domains / Month",
    exampleTld: ".com at $9.10 / year",
    icon: BadgeCheck,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-100",
    accent: "#D97706",
    features: [
      "All Professional Features",
      "Core Wholesale Cost Pricing",
      "VIP API Router Priority",
      "Custom TLD Promotions",
      "Free Billing Software License",
      "Dedicated Account Manager",
      "SLA with Uptime Guarantee",
      "Custom Rate Negotiation",
    ],
  },
];

const FEATURES = [
  { icon: Code2, title: "REST API Access", desc: "Full programmatic control over registrations, renewals, DNS, and EPP codes. SDKs for PHP, Node, Python." },
  { icon: ServerCog, title: "WHMCS & Blesta Ready", desc: "Plug-and-play modules for both platforms. Deploy a white-label registrar in under 30 minutes." },
  { icon: Shield, title: "White-label Storefronts", desc: "Remove all Noehost branding. Present under your own brand with custom domain and logo." },
  { icon: Globe, title: "60+ TLD Extensions", desc: ".com, .pk, .net, .org, .io, .co, .store and 50+ more at wholesale rates available from day one." },
  { icon: RefreshCw, title: "Auto-Renewal Engine", desc: "Fund-based auto-renewals ensure your portfolio never expires. Configure per-domain or globally." },
  { icon: BookOpen, title: "API Documentation", desc: "Comprehensive docs with code examples, Postman collection, and sandbox testing environment." },
];

const COUNTRIES = [
  "Pakistan", "United Arab Emirates", "Saudi Arabia", "United Kingdom",
  "United States", "India", "Bangladesh", "Canada", "Australia", "Germany",
  "France", "Netherlands", "Singapore", "Malaysia", "Nigeria", "Kenya", "Other",
];

type Step = 1 | 2 | 3;

interface FormData {
  businessName: string;
  websiteUrl: string;
  targetMarket: string;
  monthlyVolume: string;
  currentRegistrar: string;
  billingSoftware: string[];
  selectedTier: string;
  depositConfirmed: boolean;
}

export default function DomainReseller() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [pricing, setPricing] = useState<TldPricing[]>([]);
  const [loadingPricing, setLoadingPricing] = useState(true);

  const [showApply, setShowApply] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormData>({
    businessName: "", websiteUrl: "", targetMarket: "",
    monthlyVolume: "", currentRegistrar: "", billingSoftware: [],
    selectedTier: "starter", depositConfirmed: false,
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
    return isNaN(n) ? "—" : `Rs. ${n.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const openApply = () => {
    if (!user) { navigate("/login?next=/domain-reseller"); return; }
    setStep(1); setApplyStatus("idle"); setApplyMsg("");
    setShowApply(true);
  };

  const openApplyWithTier = (tier: string) => {
    setForm(f => ({ ...f, selectedTier: tier }));
    openApply();
  };

  const toggleSoftware = (s: string) => {
    setForm(f => ({
      ...f,
      billingSoftware: f.billingSoftware.includes(s)
        ? f.billingSoftware.filter(x => x !== s)
        : [...f.billingSoftware, s],
    }));
  };

  const canNext = () => {
    if (step === 1) return form.businessName.trim().length > 0 && form.targetMarket.length > 0;
    if (step === 2) return form.monthlyVolume.length > 0;
    if (step === 3) return form.selectedTier.length > 0 && form.depositConfirmed;
    return false;
  };

  const submitApply = async () => {
    setApplyLoading(true); setApplyStatus("idle");
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("noehost_token");
      const res = await fetch("/api/reseller/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          businessName: form.businessName,
          websiteUrl: form.websiteUrl,
          targetMarket: form.targetMarket,
          monthlyVolume: form.monthlyVolume,
          currentRegistrar: form.currentRegistrar,
          billingSoftware: form.billingSoftware.join(", "),
          selectedTier: form.selectedTier,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setApplyStatus("success");
      setApplyMsg(data.existing
        ? "You already have a reseller account — we'll review your details."
        : "Application submitted! Our team will review and activate your account within 24 hours.");
    } catch (err: any) {
      setApplyStatus("error"); setApplyMsg(err.message || "Something went wrong.");
    } finally { setApplyLoading(false); }
  };

  return (
    <div className="bg-[#fafafa] min-h-screen font-sans">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative bg-white border-b border-gray-100 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(124,58,237,0.06)_0%,_transparent_60%)] pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-50 rounded-full blur-3xl opacity-60 pointer-events-none translate-x-1/2 -translate-y-1/2" />

        <div className="max-w-6xl mx-auto px-6 py-24 grid md:grid-cols-2 gap-14 items-center relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#7C3AED]/8 border border-[#7C3AED]/15 mb-8">
              <Sparkles size={13} className="text-[#7C3AED]" />
              <span className="text-xs font-black text-[#7C3AED] tracking-widest uppercase">Domain Reseller Program</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-gray-900 leading-[1.1] mb-5 tracking-tight">
              Launch Your Own<br />
              <span className="text-[#7C3AED]">Domain & Hosting</span><br />
              Business Globally.
            </h1>
            <p className="text-base text-gray-500 leading-relaxed mb-8 font-medium max-w-lg">
              Automated API access, white-label storefronts, and premium WHMCS/Blesta integrations
              with zero infrastructure overhead.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={openApply}
                className="inline-flex items-center gap-3 px-8 py-4 text-white rounded-2xl font-bold text-sm transition-all shadow-[0_8px_30px_rgba(124,58,237,0.35)] hover:shadow-[0_12px_40px_rgba(124,58,237,0.45)] hover:-translate-y-0.5"
                style={{ background: BRAND }}
              >
                Apply for Reseller Account
                <ArrowRight size={17} />
              </button>
              {user && (
                <Link to="/dashboard/reseller" className="inline-flex items-center gap-3 px-8 py-4 bg-gray-50 border border-gray-200 text-gray-700 rounded-2xl font-bold text-sm hover:bg-gray-100 transition-all">
                  <BarChart3 size={17} /> My Dashboard
                </Link>
              )}
            </div>
            <p className="mt-4 text-xs text-gray-400 font-medium">Free to apply · Approval within 24 hours · No setup fees</p>
          </div>

          {/* Right: trust stats */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Users, val: "500+", label: "Active Resellers", color: "text-[#7C3AED]", bg: "bg-[#7C3AED]/8" },
              { icon: Globe, val: "60+", label: "TLD Extensions", color: "text-sky-600", bg: "bg-sky-50" },
              { icon: Zap, val: "99.9%", label: "API Uptime SLA", color: "text-amber-600", bg: "bg-amber-50" },
              { icon: DollarSign, val: "35%", label: "Max Discount Off Retail", color: "text-emerald-600", bg: "bg-emerald-50" },
              { icon: Code2, val: "5 SDKs", label: "Languages Supported", color: "text-rose-500", bg: "bg-rose-50" },
              { icon: Lock, val: "ICANN", label: "Accredited Registry", color: "text-indigo-600", bg: "bg-indigo-50" },
            ].map(({ icon: Icon, val, label, color, bg }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                  <Icon size={18} className={color} />
                </div>
                <div>
                  <div className="text-lg font-black text-gray-900">{val}</div>
                  <div className="text-xs text-gray-400 font-medium leading-tight">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tier Cards ───────────────────────────────────────────────────────── */}
      <section className="py-20 px-6" id="plans">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-100 shadow-sm mb-5">
              <Layers size={13} className="text-[#7C3AED]" />
              <span className="text-xs font-black text-gray-500 uppercase tracking-widest">International Slab Engine</span>
            </div>
            <h2 className="text-4xl font-black text-gray-900 mb-3 tracking-tight">Choose Your Reseller Tier</h2>
            <p className="text-gray-500 font-medium max-w-xl mx-auto">
              Three volume-based slabs with graduated pricing. Your tier unlocks automatically when you maintain the minimum wallet balance.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {TIERS.map(tier => {
              const Icon = tier.icon;
              return (
                <div
                  key={tier.id}
                  className={`relative bg-white rounded-3xl border-2 ${
                    tier.popular ? "border-[#7C3AED]/40 shadow-[0_8px_40px_rgba(124,58,237,0.12)]" : "border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
                  } flex flex-col overflow-hidden transition-all hover:-translate-y-1 hover:shadow-[0_16px_50px_rgba(0,0,0,0.08)]`}
                >
                  {tier.popular && (
                    <div className="bg-[#7C3AED] text-white text-xs font-black py-2 text-center tracking-widest uppercase">
                      ★ Most Popular
                    </div>
                  )}
                  {!tier.popular && tier.id === "enterprise" && (
                    <div className="bg-amber-500 text-white text-xs font-black py-2 text-center tracking-widest uppercase">
                      ✦ Best Wholesale Value
                    </div>
                  )}

                  <div className="p-8 flex-1 flex flex-col">
                    {/* Header */}
                    <div className="flex items-start gap-4 mb-6">
                      <div className={`w-12 h-12 rounded-2xl ${tier.bg} ${tier.border} border flex items-center justify-center shrink-0`}>
                        <Icon size={22} className={tier.color} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-gray-900 leading-tight">{tier.name}</h3>
                        <p className="text-xs text-gray-400 font-medium mt-1">{tier.volume}</p>
                      </div>
                    </div>

                    {/* Deposit requirement */}
                    <div className={`${tier.bg} ${tier.border} border rounded-2xl px-5 py-4 mb-5`}>
                      <div className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">
                        Minimum Wallet Deposit
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black" style={{ color: tier.accent }}>{tier.deposit}</span>
                        <span className="text-sm text-gray-400 font-bold">({tier.depositUsd})</span>
                      </div>
                      <div className="text-xs text-gray-400 font-medium mt-1">Initial account fund to unlock this tier</div>
                    </div>

                    {/* Pricing example */}
                    <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 mb-6">
                      <TrendingDown size={14} className="text-emerald-500 shrink-0" />
                      <div>
                        <div className="text-xs font-black text-gray-500 uppercase tracking-widest">Pricing Benchmark</div>
                        <div className="text-sm font-bold text-gray-800">{tier.exampleTld}</div>
                      </div>
                    </div>

                    {/* Feature list */}
                    <ul className="space-y-2.5 flex-1 mb-7">
                      {tier.features.map(f => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600 font-medium">
                          <CheckCircle size={15} className="shrink-0 mt-0.5" style={{ color: tier.accent }} />
                          {f}
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <button
                      onClick={() => openApplyWithTier(tier.id)}
                      className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                        tier.popular
                          ? "text-white shadow-[0_6px_20px_rgba(124,58,237,0.35)] hover:shadow-[0_10px_30px_rgba(124,58,237,0.45)]"
                          : "hover:opacity-90"
                      }`}
                      style={{
                        background: tier.popular ? BRAND : `${tier.accent}15`,
                        color: tier.popular ? "#fff" : tier.accent,
                        border: tier.popular ? "none" : `1.5px solid ${tier.accent}30`,
                      }}
                    >
                      Apply as {tier.name.split(" ")[0]}
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-center text-xs text-gray-400 font-medium">
            * Tier upgrades apply automatically when wallet balance meets the slab threshold. Prices are in PKR; USD equivalent shown for reference.
          </p>
        </div>
      </section>

      {/* ── Pricing Matrix ────────────────────────────────────────────────────── */}
      <section className="py-16 px-6 bg-white border-t border-b border-gray-100" id="pricing">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">Live TLD Pricing Matrix</h2>
            <p className="text-gray-500 font-medium text-sm">Real-time reseller prices. Register price shown for comparison — your savings auto-calculated.</p>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="grid grid-cols-4 bg-gray-50 border-b border-gray-100 px-6 py-4">
              {["Extension", "Register Price", "Your Cost", "Saving"].map(h => (
                <div key={h} className="text-xs font-black text-gray-400 uppercase tracking-widest">{h}</div>
              ))}
            </div>
            {loadingPricing ? (
              <div className="flex items-center justify-center py-14 gap-3 text-gray-400">
                <Loader2 size={18} className="animate-spin text-[#7C3AED]" />
                <span className="text-sm font-medium">Loading live pricing…</span>
              </div>
            ) : pricing.length === 0 ? (
              <div className="text-center py-14 text-gray-400 text-sm font-medium">No pricing configured yet.</div>
            ) : (
              pricing.map((row, i) => {
                const pct = savings(row.retail_price, row.reseller_price);
                return (
                  <div key={row.id} className={`grid grid-cols-4 items-center px-6 py-4 hover:bg-[#7C3AED]/[0.02] transition-colors ${i < pricing.length - 1 ? "border-b border-gray-50" : ""}`}>
                    <div className="font-black text-gray-900 text-sm">{row.tld}</div>
                    <div className="text-sm text-gray-400 font-medium line-through">{fmt(row.retail_price)}/yr</div>
                    <div className="text-sm font-black text-gray-900">{fmt(row.reseller_price)}/yr</div>
                    <div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-black">
                        <TrendingDown size={10} /> {pct}% off
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <p className="mt-4 text-center text-xs text-gray-400">All prices in PKR. Volume-tiered discounts on top of base reseller pricing.</p>
        </div>
      </section>

      {/* ── Feature Grid ──────────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">Enterprise-Grade Reseller Infrastructure</h2>
            <p className="text-gray-500 font-medium">Everything you need to run a professional domain registrar business.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl border border-gray-100 p-7 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:border-[#7C3AED]/20 hover:shadow-[0_8px_30px_rgba(124,58,237,0.07)] transition-all group">
                <div className="w-11 h-11 rounded-xl bg-[#7C3AED]/8 flex items-center justify-center mb-5 group-hover:bg-[#7C3AED]/14 transition-colors">
                  <Icon size={20} className="text-[#7C3AED]" />
                </div>
                <h3 className="font-black text-gray-900 mb-2 text-sm tracking-tight">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed font-medium">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────────────── */}
      <section className="py-16 px-6 bg-white border-t border-gray-100">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">How It Works</h2>
            <p className="text-gray-500 font-medium">Go live as a domain reseller in three steps.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-7 left-[36%] right-[36%] border-t-2 border-dashed border-gray-100" />
            {[
              { n: "01", title: "Apply Online", desc: "Submit our enterprise questionnaire with your business details, market, and billing platform. Takes under 3 minutes." },
              { n: "02", title: "Fund Your Wallet", desc: "Deposit the minimum slab amount to unlock your pricing tier. Funds are used for domain registrations and renewals." },
              { n: "03", title: "Start Reselling", desc: "Use our API or white-label dashboard to register domains at wholesale cost and sell at any markup you choose." },
            ].map(({ n, title, desc }) => (
              <div key={n} className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#7C3AED]/8 border border-[#7C3AED]/15 flex items-center justify-center mx-auto mb-5 relative z-10">
                  <span className="text-xl font-black text-[#7C3AED]">{n}</span>
                </div>
                <h3 className="text-base font-black text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed font-medium">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-[#7C3AED] rounded-3xl p-10 text-center relative overflow-hidden shadow-[0_20px_60px_rgba(124,58,237,0.3)]">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(255,255,255,0.12)_0%,_transparent_60%)] pointer-events-none" />
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center mx-auto mb-6">
                <Globe size={26} className="text-white" />
              </div>
              <h2 className="text-3xl font-black text-white mb-4 tracking-tight">Ready to Launch Your Domain Business?</h2>
              <p className="text-purple-200 font-medium mb-8 max-w-lg mx-auto leading-relaxed">
                Join 500+ resellers who trust our platform. Apply in minutes — no credit card needed to start.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button onClick={openApply} className="inline-flex items-center justify-center gap-3 px-9 py-4 bg-white text-[#7C3AED] rounded-2xl font-black text-sm transition-all hover:bg-gray-50 shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                  Apply Now — It's Free <ArrowRight size={17} />
                </button>
                {user && (
                  <Link to="/dashboard/reseller" className="inline-flex items-center justify-center gap-3 px-9 py-4 bg-white/10 border border-white/20 text-white rounded-2xl font-bold text-sm hover:bg-white/15 transition-all">
                    <BarChart3 size={17} /> Go to Dashboard
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Multi-Step Application Modal ─────────────────────────────────────── */}
      {showApply && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_32px_80px_rgba(0,0,0,0.18)] w-full max-w-xl relative overflow-hidden">
            {/* Close */}
            <button onClick={() => setShowApply(false)} className="absolute top-5 right-5 z-10 p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
              <X size={18} />
            </button>

            {applyStatus === "success" ? (
              <div className="px-10 py-14 text-center">
                <div className="w-20 h-20 rounded-3xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle size={36} className="text-emerald-500" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-3">Application Submitted!</h3>
                <p className="text-gray-500 font-medium leading-relaxed mb-8 max-w-sm mx-auto">{applyMsg}</p>
                <button onClick={() => setShowApply(false)} className="px-8 py-3.5 text-white rounded-2xl font-bold text-sm" style={{ background: BRAND }}>
                  Got it
                </button>
              </div>
            ) : (
              <>
                {/* Progress header */}
                <div className="px-8 pt-8 pb-6 border-b border-gray-50">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-[#7C3AED]/8 flex items-center justify-center">
                      <Building2 size={19} className="text-[#7C3AED]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-gray-900">Reseller Application</h3>
                      <p className="text-xs text-gray-400 font-medium">Step {step} of 3</p>
                    </div>
                  </div>

                  {/* Step indicator */}
                  <div className="flex items-center gap-2">
                    {([1, 2, 3] as Step[]).map(s => (
                      <div key={s} className="flex-1 flex items-center gap-2">
                        <div className={`flex-1 h-1.5 rounded-full transition-all ${s <= step ? "bg-[#7C3AED]" : "bg-gray-100"}`} />
                        {s < 3 && <div className={`w-1.5 h-1.5 rounded-full transition-all ${s < step ? "bg-[#7C3AED]" : "bg-gray-200"}`} />}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-1.5 text-xs font-bold text-gray-400">
                    <span style={{ color: step >= 1 ? BRAND : undefined }}>Business Identity</span>
                    <span style={{ color: step >= 2 ? BRAND : undefined }}>Volume & Platform</span>
                    <span style={{ color: step >= 3 ? BRAND : undefined }}>Tier Commitment</span>
                  </div>
                </div>

                <div className="px-8 py-6 space-y-5" style={{ minHeight: "340px" }}>
                  {/* ── STEP 1: Business Identity ── */}
                  {step === 1 && (
                    <>
                      <div>
                        <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
                          Legal Business / Trading Name <span className="text-red-400">*</span>
                        </label>
                        <input type="text" value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                          placeholder="e.g. Acme Web Solutions Pvt. Ltd."
                          className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-800 placeholder-gray-300 focus:outline-none focus:border-[#7C3AED]/40 focus:ring-2 focus:ring-[#7C3AED]/8 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
                          Corporate Website URL <span className="text-gray-300 font-medium">(optional)</span>
                        </label>
                        <input type="url" value={form.websiteUrl} onChange={e => setForm(f => ({ ...f, websiteUrl: e.target.value }))}
                          placeholder="https://yourcompany.com"
                          className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-800 placeholder-gray-300 focus:outline-none focus:border-[#7C3AED]/40 focus:ring-2 focus:ring-[#7C3AED]/8 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
                          Primary Target Country / Market <span className="text-red-400">*</span>
                        </label>
                        <select value={form.targetMarket} onChange={e => setForm(f => ({ ...f, targetMarket: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-800 focus:outline-none focus:border-[#7C3AED]/40 transition-all"
                        >
                          <option value="">Select your primary market…</option>
                          {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </>
                  )}

                  {/* ── STEP 2: Volume & Platform ── */}
                  {step === 2 && (
                    <>
                      <div>
                        <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
                          Estimated Monthly Domain Registrations <span className="text-red-400">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          {["1–10", "11–50", "51–200", "200+"].map(v => (
                            <button key={v} onClick={() => setForm(f => ({ ...f, monthlyVolume: v }))}
                              className={`py-3 rounded-xl border text-sm font-bold transition-all ${
                                form.monthlyVolume === v ? "text-white border-transparent" : "bg-gray-50 border-gray-100 text-gray-700 hover:border-[#7C3AED]/30"
                              }`}
                              style={form.monthlyVolume === v ? { background: BRAND } : {}}
                            >
                              {v} / month
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
                          Current Domain Registrar / Provider
                        </label>
                        <input type="text" value={form.currentRegistrar} onChange={e => setForm(f => ({ ...f, currentRegistrar: e.target.value }))}
                          placeholder="e.g. GoDaddy, Namecheap, None"
                          className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-800 placeholder-gray-300 focus:outline-none focus:border-[#7C3AED]/40 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
                          Billing Automation Platform <span className="text-gray-300 font-medium">(select all that apply)</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2.5">
                          {["WHMCS", "Blesta", "Custom API", "Custom Storefront"].map(s => (
                            <button key={s} onClick={() => toggleSoftware(s)}
                              className={`py-2.5 px-4 rounded-xl border text-sm font-bold text-left transition-all flex items-center gap-2 ${
                                form.billingSoftware.includes(s) ? "border-transparent text-white" : "bg-gray-50 border-gray-100 text-gray-700 hover:border-[#7C3AED]/30"
                              }`}
                              style={form.billingSoftware.includes(s) ? { background: BRAND } : {}}
                            >
                              {form.billingSoftware.includes(s) ? <CheckCircle size={13} className="text-white shrink-0" /> : <div className="w-3.5 h-3.5 rounded border border-gray-200 shrink-0" />}
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── STEP 3: Tier Commitment ── */}
                  {step === 3 && (
                    <>
                      <div>
                        <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-3">
                          Choose Your Commitment Tier <span className="text-red-400">*</span>
                        </label>
                        <div className="space-y-2.5">
                          {TIERS.map(t => (
                            <button key={t.id} onClick={() => setForm(f => ({ ...f, selectedTier: t.id }))}
                              className={`w-full text-left px-5 py-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
                                form.selectedTier === t.id
                                  ? "border-[#7C3AED] bg-[#7C3AED]/4"
                                  : "border-gray-100 bg-gray-50 hover:border-[#7C3AED]/30"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-xl ${t.bg} ${t.border} border flex items-center justify-center shrink-0`}>
                                  <t.icon size={15} className={t.color} />
                                </div>
                                <div>
                                  <div className="text-sm font-black text-gray-900">{t.name}</div>
                                  <div className="text-xs text-gray-400 font-medium">{t.volume} · {t.deposit} deposit</div>
                                </div>
                              </div>
                              {form.selectedTier === t.id && (
                                <CheckCircle size={18} className="text-[#7C3AED] shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      <label className={`flex items-start gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer ${
                        form.depositConfirmed ? "bg-[#7C3AED]/4 border-[#7C3AED]/20" : "bg-gray-50 border-gray-100 hover:border-[#7C3AED]/20"
                      }`}>
                        <input type="checkbox" checked={form.depositConfirmed} onChange={e => setForm(f => ({ ...f, depositConfirmed: e.target.checked }))} className="mt-0.5 accent-[#7C3AED]" />
                        <span className="text-sm text-gray-600 font-medium leading-relaxed">
                          I understand that I must deposit the minimum initial slab funds into my wallet balance to unlock my API pricing tier and reseller account.
                        </span>
                      </label>

                      {applyStatus === "error" && (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium">
                          <AlertCircle size={15} /> {applyMsg}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Footer nav */}
                <div className="px-8 py-5 border-t border-gray-50 flex items-center justify-between">
                  <button
                    onClick={() => step > 1 ? setStep((step - 1) as Step) : setShowApply(false)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-100 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all"
                  >
                    <ChevronLeft size={15} />
                    {step === 1 ? "Cancel" : "Back"}
                  </button>

                  {step < 3 ? (
                    <button
                      onClick={() => setStep((step + 1) as Step)}
                      disabled={!canNext()}
                      className="flex items-center gap-2 px-7 py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: BRAND }}
                    >
                      Continue <ChevronRight size={15} />
                    </button>
                  ) : (
                    <button
                      onClick={submitApply}
                      disabled={applyLoading || !canNext()}
                      className="flex items-center gap-2 px-7 py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-40 shadow-[0_4px_16px_rgba(124,58,237,0.35)]"
                      style={{ background: BRAND }}
                    >
                      {applyLoading ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />}
                      {applyLoading ? "Submitting…" : "Submit Application"}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
