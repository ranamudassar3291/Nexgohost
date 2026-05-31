import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Globe, CheckCircle, Zap, Shield, Server, ArrowRight,
  ChevronDown, TrendingDown, Users, Key, Layers, AlertCircle,
  Loader2, Building2, BarChart3, X
} from "lucide-react";

interface TldPricing {
  id: string;
  tld: string;
  retail_price: string;
  reseller_price: string;
}

export default function DomainReseller() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [pricing, setPricing] = useState<TldPricing[]>([]);
  const [loadingPricing, setLoadingPricing] = useState(true);
  const [showApply, setShowApply] = useState(false);
  const [applyForm, setApplyForm] = useState({ businessName: "", monthlyVolume: "" });
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyStatus, setApplyStatus] = useState<"idle" | "success" | "error">("idle");
  const [applyMsg, setApplyMsg] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/reseller/pricing", { headers: { "User-Agent": "Mozilla/5.0" } })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setPricing(d); })
      .catch(() => {})
      .finally(() => setLoadingPricing(false));
  }, []);

  const savings = (retail: string, reseller: string) => {
    const r = parseFloat(retail);
    const p = parseFloat(reseller);
    if (!r || !p) return "0";
    return Math.round(((r - p) / r) * 100).toString();
  };

  const handleApplyClick = () => {
    if (!user) {
      navigate("/client/login?next=/domain-reseller");
      return;
    }
    setShowApply(true);
  };

  const submitApply = async () => {
    if (!applyForm.businessName.trim()) {
      setApplyMsg("Please enter your business name.");
      setApplyStatus("error");
      return;
    }
    setApplyLoading(true);
    setApplyStatus("idle");
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("noehost_token");
      const res = await fetch("/api/reseller/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          businessName: applyForm.businessName,
          monthlyVolume: applyForm.monthlyVolume,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setApplyStatus("success");
      setApplyMsg(data.existing
        ? "You already have an active application. We'll review it shortly."
        : "Application submitted! Our team will review and respond within 24 hours.");
    } catch (err: any) {
      setApplyStatus("error");
      setApplyMsg(err.message || "Something went wrong.");
    } finally {
      setApplyLoading(false);
    }
  };

  return (
    <div className="bg-[#fafafa] min-h-screen font-sans">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#7C3AED]/8 border border-[#7C3AED]/15 mb-8">
            <Globe size={14} className="text-[#7C3AED]" />
            <span className="text-xs font-semibold text-[#7C3AED] tracking-widest uppercase">
              Domain Reseller Program
            </span>
          </div>
          <h1 className="text-5xl font-black text-gray-900 leading-tight mb-6 tracking-tight">
            Sell Domains Under<br />
            <span className="text-[#7C3AED]">Your Own Brand</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
            Access wholesale pricing on 8+ domain extensions, manage your portfolio
            with a professional API, and grow your business with tiered volume discounts.
          </p>
          <button
            onClick={handleApplyClick}
            className="inline-flex items-center gap-3 px-10 py-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-2xl font-bold text-base transition-all shadow-[0_8px_30px_rgba(124,58,237,0.35)] hover:shadow-[0_12px_40px_rgba(124,58,237,0.45)] hover:-translate-y-0.5"
          >
            Apply Now
            <ArrowRight size={18} />
          </button>
          <p className="mt-4 text-sm text-gray-400 font-medium">
            Free to apply · Approval within 24 hours
          </p>
        </div>
      </section>

      {/* ── Pricing Matrix ────────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">
              Reseller Pricing Matrix
            </h2>
            <p className="text-gray-500 font-medium">
              Real-time pricing pulled from our system — your savings calculated automatically.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)] overflow-hidden">
            <div className="grid grid-cols-4 bg-gray-50 border-b border-gray-100 px-6 py-4">
              {["Extension", "Standard Retail", "Reseller Price", "You Save"].map(h => (
                <div key={h} className="text-xs font-black text-gray-400 uppercase tracking-widest">
                  {h}
                </div>
              ))}
            </div>
            {loadingPricing ? (
              <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
                <Loader2 size={20} className="animate-spin text-[#7C3AED]" />
                <span className="text-sm font-medium">Loading pricing data…</span>
              </div>
            ) : pricing.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm font-medium">
                No pricing configured yet.
              </div>
            ) : (
              pricing.map((row, i) => {
                const saved = savings(row.retail_price, row.reseller_price);
                return (
                  <div
                    key={row.id}
                    className={`grid grid-cols-4 items-center px-6 py-4 transition-colors hover:bg-[#7C3AED]/[0.02] ${i < pricing.length - 1 ? "border-b border-gray-50" : ""}`}
                  >
                    <div className="font-black text-gray-800 text-sm">{row.tld}</div>
                    <div className="text-sm text-gray-400 font-medium line-through">
                      ${parseFloat(row.retail_price).toFixed(2)}/yr
                    </div>
                    <div className="text-sm font-black text-gray-900">
                      ${parseFloat(row.reseller_price).toFixed(2)}/yr
                    </div>
                    <div>
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-black">
                        <TrendingDown size={11} />
                        {saved}% off
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <p className="mt-4 text-center text-xs text-gray-400 font-medium">
            * Volume-tiered discounts apply at higher slabs. Contact us after applying for enterprise rates.
          </p>
        </div>
      </section>

      {/* ── Feature Cards ─────────────────────────────────────────────────────── */}
      <section className="py-8 pb-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: Key,
                title: "Whitelabel API Access",
                desc: "A unique API credential scoped to your account. Integrate domain availability checks and registrations into any system.",
              },
              {
                icon: Layers,
                title: "Tiered Volume Pricing",
                desc: "Three discount slabs based on monthly registrations. The more you sell, the lower your cost per domain.",
              },
              {
                icon: Globe,
                title: "Instant DNS & EPP Management",
                desc: "Update nameservers, fetch auth/EPP codes, and manage renewals directly from your reseller dashboard — no manual intervention.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="bg-white rounded-2xl border border-gray-100 p-7 shadow-[0_8px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.04)] hover:border-[#7C3AED]/20 transition-all group"
              >
                <div className="w-11 h-11 rounded-xl bg-[#7C3AED]/8 flex items-center justify-center mb-5 group-hover:bg-[#7C3AED]/12 transition-colors">
                  <Icon size={20} className="text-[#7C3AED]" />
                </div>
                <h3 className="font-black text-gray-900 mb-2 text-sm tracking-tight">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed font-medium">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Apply CTA ─────────────────────────────────────────────────────────── */}
      <section className="bg-white border-t border-gray-100 py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">
            Ready to start reselling?
          </h2>
          <p className="text-gray-500 font-medium mb-8">
            Applications are reviewed within 24 hours. Once approved, your reseller dashboard
            and API credentials are activated instantly.
          </p>
          <button
            onClick={handleApplyClick}
            className="inline-flex items-center gap-3 px-10 py-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-2xl font-bold text-base transition-all shadow-[0_8px_30px_rgba(124,58,237,0.35)]"
          >
            Apply Now
            <ArrowRight size={18} />
          </button>
          {user && (
            <div className="mt-6">
              <Link
                to="/client/reseller"
                className="text-[#7C3AED] text-sm font-semibold hover:underline"
              >
                Go to my Reseller Dashboard →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Apply Modal ───────────────────────────────────────────────────────── */}
      {showApply && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <div
            ref={modalRef}
            className="bg-white rounded-3xl border border-gray-100 shadow-[0_24px_80px_rgba(0,0,0,0.12)] w-full max-w-md p-8 relative"
          >
            <button
              onClick={() => { setShowApply(false); setApplyStatus("idle"); }}
              className="absolute top-5 right-5 p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="mb-7">
              <div className="w-11 h-11 rounded-xl bg-[#7C3AED]/8 flex items-center justify-center mb-4">
                <Building2 size={20} className="text-[#7C3AED]" />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-1">Apply for Reseller Access</h3>
              <p className="text-sm text-gray-500 font-medium">
                Tell us about your business. We'll activate your account within 24 hours.
              </p>
            </div>

            {applyStatus === "success" ? (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                  <CheckCircle size={28} className="text-emerald-500" />
                </div>
                <p className="text-gray-700 font-medium text-sm leading-relaxed">{applyMsg}</p>
                <button
                  onClick={() => { setShowApply(false); setApplyStatus("idle"); }}
                  className="mt-2 px-6 py-2.5 bg-[#7C3AED] text-white rounded-xl text-sm font-bold"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-gray-700 uppercase tracking-widest mb-2">
                    Business Entity Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={applyForm.businessName}
                    onChange={e => setApplyForm(f => ({ ...f, businessName: e.target.value }))}
                    placeholder="e.g. Acme Web Solutions LLC"
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-gray-900 text-sm font-medium placeholder-gray-300 focus:outline-none focus:border-[#7C3AED]/40 focus:ring-2 focus:ring-[#7C3AED]/8 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-700 uppercase tracking-widest mb-2">
                    Expected Monthly Domain Registrations
                  </label>
                  <select
                    value={applyForm.monthlyVolume}
                    onChange={e => setApplyForm(f => ({ ...f, monthlyVolume: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-gray-900 text-sm font-medium focus:outline-none focus:border-[#7C3AED]/40 focus:ring-2 focus:ring-[#7C3AED]/8 transition-all"
                  >
                    <option value="">Select a range…</option>
                    <option value="1-10">1–10 per month (Tier 1)</option>
                    <option value="11-50">11–50 per month (Tier 2)</option>
                    <option value="50+">50+ per month (Tier 3 — Enterprise)</option>
                  </select>
                </div>

                {applyStatus === "error" && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium">
                    <AlertCircle size={15} />
                    {applyMsg}
                  </div>
                )}

                <button
                  onClick={submitApply}
                  disabled={applyLoading}
                  className="w-full py-3.5 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-60 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 mt-2"
                >
                  {applyLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  {applyLoading ? "Submitting…" : "Submit Application"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
