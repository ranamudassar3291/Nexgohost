import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence, type HTMLMotionProps } from "framer-motion";
import {
  Server, Globe, ArrowRightLeft, ChevronRight, Search, Loader2,
  Check, X, ArrowLeft, Zap, Shield, Users, Database,
  Mail, HardDrive, Wifi, ShoppingCart, CheckCircle2,
  Star, Key, AlertCircle, Lock,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCart, type BillingCycle, CYCLE_LABELS, CYCLE_SUFFIX } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyProvider";

// ─── Types ────────────────────────────────────────────────────────────────────

type Flow = "hosting" | "domain" | "transfer";
type HostingTab = "shared" | "reseller" | "vps";
type DomainMode = "register" | "existing";

interface Plan {
  id: string; name: string; description: string | null; price: number;
  yearlyPrice: number | null; quarterlyPrice: number | null; semiannualPrice: number | null;
  renewalPrice: number | null; renewalEnabled: boolean;
  billingCycle: string; diskSpace: string; bandwidth: string;
  emailAccounts: number | null; databases: number | null; features: string[];
}

interface TldResult {
  tld: string; available: boolean; rdapStatus?: string;
  registrationPrice: number; register2YearPrice: number | null;
  register3YearPrice: number | null; renewalPrice: number;
}

interface TldPricing {
  tld: string; registrationPrice: number; register2YearPrice: number | null;
  register3YearPrice: number | null; renewalPrice: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const P = "#701AFE";
const P_HOVER = "#5e14d4";

function tok(): string | null { return localStorage.getItem("token"); }

function planPrice(plan: Plan, cycle: BillingCycle): number {
  if (cycle === "quarterly" && plan.quarterlyPrice) return plan.quarterlyPrice;
  if (cycle === "semiannual" && plan.semiannualPrice) return plan.semiannualPrice;
  if (cycle === "yearly" && plan.yearlyPrice) return plan.yearlyPrice;
  return plan.price;
}

function planCycles(plan: Plan): BillingCycle[] {
  const c: BillingCycle[] = ["monthly"];
  if (plan.quarterlyPrice) c.push("quarterly");
  if (plan.semiannualPrice) c.push("semiannual");
  if (plan.yearlyPrice) c.push("yearly");
  return c;
}

function classifyPlan(plan: Plan): HostingTab {
  const n = plan.name.toLowerCase();
  if (n.includes("reseller")) return "reseller";
  if (n.includes("vps") || n.includes("virtual")) return "vps";
  return "shared";
}

function cleanName(raw: string): string {
  return raw.trim().toLowerCase().split(".")[0].replace(/[^a-z0-9-]/g, "");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type MotionDivBase = Omit<HTMLMotionProps<"div">, "ref" | "children" | "key" | "className" | "style">;
const fade: MotionDivBase = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.22 },
};

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="text-center mb-10">
      <h2 className="text-[28px] sm:text-[34px] font-bold tracking-tight text-black leading-tight">{title}</h2>
      {sub && <p className="mt-2.5 text-[15px] text-gray-500 max-w-lg mx-auto leading-relaxed">{sub}</p>}
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-black transition-colors mb-7 font-medium">
      <ArrowLeft size={14} /> Back
    </button>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

const STEPS = ["Select Service", "Choose Plan", "Domain & Checkout"];

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex items-start justify-center mb-12 select-none">
      {STEPS.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={label} className="flex items-start">
            <div className="flex flex-col items-center w-[90px] sm:w-[120px]">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                done ? "bg-[#701AFE] text-white"
                : active ? "bg-[#701AFE] text-white ring-[3px] ring-[#701AFE]/20"
                : "bg-white border-2 border-gray-200 text-gray-400"}`}>
                {done ? <Check size={13} strokeWidth={2.5} /> : i + 1}
              </div>
              <span className={`mt-2 text-[11px] font-semibold text-center leading-tight ${
                active ? "text-[#701AFE]" : done ? "text-gray-600" : "text-gray-400"}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-12 sm:w-20 h-0.5 mt-3.5 transition-all duration-500 ${done ? "bg-[#701AFE]" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Pill Badge ───────────────────────────────────────────────────────────────

function Pill({ label, color = "gray" }: { label: string; color?: "gray" | "purple" }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
      color === "purple" ? "bg-[#701AFE]/10 text-[#701AFE]" : "bg-gray-100 text-gray-500"}`}>
      {label}
    </span>
  );
}

// ─── Feature Row ─────────────────────────────────────────────────────────────

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-2 text-[13px] text-gray-600">
      <span className="text-[#701AFE] shrink-0 w-4">{icon}</span>
      <span>{text}</span>
    </li>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OrderFlow() {
  const [, navigate] = useLocation();
  const { addItem } = useCart();
  const { formatPrice } = useCurrency();

  // Global wizard step: 0=category, 1=plan or domain or transfer, 2=domain-assoc, 3=checkout
  const [wizardStep, setWizardStep] = useState(0);
  const [flow, setFlow] = useState<Flow | null>(null);

  // Hosting
  const [hostingTab, setHostingTab] = useState<HostingTab>("shared");
  const [planCyclesMap, setPlanCyclesMap] = useState<Record<string, BillingCycle>>({});
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  // Step 2 — domain association
  const [domainMode, setDomainMode] = useState<DomainMode | null>(null);
  const [domainQuery, setDomainQuery] = useState("");
  const [domainChecking, setDomainChecking] = useState(false);
  const [domainResults, setDomainResults] = useState<TldResult[] | null>(null);
  const [existingDomain, setExistingDomain] = useState("");
  const [domainError, setDomainError] = useState("");
  const domainInputRef = useRef<HTMLInputElement>(null);

  // Step 1 — Register Domain flow
  const [regQuery, setRegQuery] = useState("");
  const [regChecking, setRegChecking] = useState(false);
  const [regResults, setRegResults] = useState<TldResult[] | null>(null);
  const [regError, setRegError] = useState("");
  const regInputRef = useRef<HTMLInputElement>(null);

  // Transfer
  const [transferDomain, setTransferDomain] = useState("");
  const [eppCode, setEppCode] = useState("");
  const [transferError, setTransferError] = useState("");

  // Plans query — only fetch when on hosting plan step
  const { data: allPlans = [], isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["order-plans"],
    queryFn: async () => {
      const r = await fetch("/api/packages", { headers: { Authorization: `Bearer ${tok() ?? ""}` } });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: flow === "hosting" && wizardStep >= 1,
    staleTime: 60_000,
  });

  // Public TLD pricing — used for domain search when not logged in
  const { data: tldPricing = [] } = useQuery<TldPricing[]>({
    queryKey: ["tld-pricing"],
    queryFn: async () => {
      const r = await fetch("/api/domains/pricing");
      return r.json();
    },
    enabled: flow === "domain" || (wizardStep === 2 && domainMode === "register"),
    staleTime: 300_000,
  });

  // Plans per tab
  const byTab = (tab: HostingTab) => {
    const filtered = allPlans.filter(p => classifyPlan(p) === tab);
    return filtered.length > 0 ? filtered : allPlans;
  };
  const displayPlans = byTab(hostingTab);

  function getCycle(planId: string): BillingCycle {
    return planCyclesMap[planId] ?? "monthly";
  }

  // ── Domain availability check ─────────────────────────────────────────────

  async function checkAvailability(name: string, setChecking: (v: boolean) => void, setResults: (v: TldResult[]) => void, setErr: (v: string) => void) {
    const clean = cleanName(name);
    if (!clean || clean.length < 2) { setErr("Please enter a valid domain name."); return; }
    setErr(""); setChecking(true); setResults([]);

    const token = tok();
    if (token) {
      try {
        const r = await fetch(`/api/domains/availability?domain=${encodeURIComponent(clean)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await r.json();
        if (!r.ok) { setErr(data.error || "Failed to check availability."); setChecking(false); return; }
        setResults(data.results ?? []);
      } catch {
        setErr("Network error. Please try again.");
      }
    } else {
      // Fallback: use public pricing (no real-time availability)
      const fakeResults: TldResult[] = tldPricing.filter(t => t.registrationPrice > 0).map(t => ({
        tld: t.tld, available: true, rdapStatus: "unknown",
        registrationPrice: t.registrationPrice,
        register2YearPrice: t.register2YearPrice,
        register3YearPrice: t.register3YearPrice,
        renewalPrice: t.renewalPrice,
      }));
      setResults(fakeResults);
    }
    setChecking(false);
  }

  // ── Redirect helpers ──────────────────────────────────────────────────────

  function goToCheckout(dest: string) {
    if (tok()) {
      navigate(dest);
    } else {
      sessionStorage.setItem("order_redirect", dest);
      navigate(`/register?next=${encodeURIComponent(dest)}`);
    }
  }

  // ── Plan selection ────────────────────────────────────────────────────────

  function handleSelectPlan(plan: Plan) {
    const cycle = getCycle(plan.id);
    addItem({
      planId: plan.id, planName: plan.name, billingCycle: cycle,
      monthlyPrice: plan.price,
      quarterlyPrice: plan.quarterlyPrice ?? undefined,
      semiannualPrice: plan.semiannualPrice ?? undefined,
      yearlyPrice: plan.yearlyPrice ?? undefined,
      renewalPrice: plan.renewalPrice ?? undefined,
      renewalEnabled: plan.renewalEnabled,
    });
    setSelectedPlan(plan);
    setWizardStep(2);
  }

  // ── Transfer submit ───────────────────────────────────────────────────────

  function handleTransferSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!transferDomain.includes(".")) { setTransferError("Enter a valid domain, e.g. example.com"); return; }
    if (!eppCode.trim()) { setTransferError("EPP/Auth code is required."); return; }
    setTransferError("");
    sessionStorage.setItem("transfer_domain", transferDomain);
    sessionStorage.setItem("transfer_epp", eppCode);
    goToCheckout("/client/domains?tab=transfers");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 0 — Category Selection
  // ─────────────────────────────────────────────────────────────────────────────

  function renderStep0() {
    const cards = [
      {
        id: "hosting" as Flow,
        icon: (
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="2" y="6" width="28" height="8" rx="3" fill={P} fillOpacity=".12"/>
            <rect x="2" y="18" width="28" height="8" rx="3" fill={P} fillOpacity=".12"/>
            <rect x="6" y="8.5" width="3" height="3" rx="1.5" fill={P}/>
            <rect x="11" y="8.5" width="3" height="3" rx="1.5" fill={P}/>
            <rect x="6" y="20.5" width="3" height="3" rx="1.5" fill={P}/>
            <rect x="11" y="20.5" width="3" height="3" rx="1.5" fill={P}/>
            <circle cx="24" cy="10" r="2" fill={P}/>
            <circle cx="24" cy="22" r="2" fill={P}/>
          </svg>
        ),
        badge: "Most Popular",
        title: "Web Hosting",
        subtitle: "Shared, Reseller, and VPS solutions.",
        bullets: ["cPanel & WHM included", "Free SSL Certificate", "NVMe SSD Storage", "99.9% Uptime Guarantee"],
        cta: "View Plans",
        popular: true,
      },
      {
        id: "domain" as Flow,
        icon: <Globe size={30} strokeWidth={1.5} style={{ color: P }} />,
        badge: null,
        title: "Register New Domain",
        subtitle: "Find the perfect name for your business.",
        bullets: ["50+ domain extensions", "WHOIS privacy included", "Auto-renewal options", "Full DNS management"],
        cta: "Search Domain",
        popular: false,
      },
      {
        id: "transfer" as Flow,
        icon: <ArrowRightLeft size={28} strokeWidth={1.5} style={{ color: P }} />,
        badge: null,
        title: "Transfer Domain",
        subtitle: "Move your domain to Noehost easily.",
        bullets: ["Free 1-year extension", "Keep your existing domain", "Easy EPP code transfer", "Best PKR rates"],
        cta: "Start Transfer",
        popular: false,
      },
    ];

    return (
      <motion.div key="step0" {...fade}>
        <SectionTitle
          title="What do you need today?"
          sub="Start with a category. Our setup wizard will guide you to the perfect plan."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {cards.map(card => (
            <button
              key={card.id}
              onClick={() => { setFlow(card.id); setWizardStep(1); }}
              className={`relative group text-left rounded-2xl p-7 flex flex-col gap-0 transition-all duration-200 focus:outline-none
                ${card.popular
                  ? "bg-white border-2 border-[#701AFE] shadow-lg shadow-[#701AFE]/10"
                  : "bg-white border border-gray-200 hover:border-[#701AFE] hover:shadow-lg hover:shadow-[#701AFE]/8"}`}
            >
              {card.popular && (
                <div className="absolute -top-3 left-6 flex items-center gap-1 px-3 py-0.5 bg-[#701AFE] text-white text-[11px] font-bold rounded-full tracking-wide">
                  <Star size={9} strokeWidth={2.5} /> MOST POPULAR
                </div>
              )}

              <div className="w-14 h-14 rounded-xl bg-[#701AFE]/8 flex items-center justify-center mb-5 group-hover:bg-[#701AFE]/14 transition-colors">
                {card.icon}
              </div>

              <div className="mb-1">
                {card.badge && <Pill label={card.badge} color="purple" />}
              </div>
              <h3 className="text-[18px] font-bold text-black mb-1.5 leading-snug">{card.title}</h3>
              <p className="text-[13px] text-gray-500 mb-5 leading-relaxed">{card.subtitle}</p>

              <ul className="space-y-2 mb-7">
                {card.bullets.map(b => (
                  <li key={b} className="flex items-center gap-2 text-[13px] text-gray-700">
                    <Check size={13} strokeWidth={2.5} className="text-[#701AFE] shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>

              <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#701AFE] group-hover:gap-3 transition-all mt-auto">
                {card.cta} <ChevronRight size={14} strokeWidth={2.5} />
              </div>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-6 mt-7 text-[12px] text-gray-400">
          <span className="flex items-center gap-1.5"><Lock size={11} /> Secure Checkout</span>
          <span>·</span>
          <span>30-day money-back guarantee</span>
          <span>·</span>
          <span>No setup fees</span>
        </div>
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1 — Hosting Plans (with tabs)
  // ─────────────────────────────────────────────────────────────────────────────

  const tabDefs: { id: HostingTab; label: string; icon: React.ReactNode; tagline: string }[] = [
    { id: "shared",   label: "Shared Hosting",   icon: <Globe size={15} />,   tagline: "Best for websites, blogs & small businesses" },
    { id: "reseller", label: "Reseller Hosting",  icon: <Users size={15} />,   tagline: "Start your own hosting business with WHM" },
    { id: "vps",      label: "VPS Server",        icon: <Zap size={15} />,     tagline: "Dedicated resources with root SSH access" },
  ];

  function renderHostingPlans() {
    return (
      <motion.div key="hosting-plans" {...fade}>
        <BackLink onClick={() => { setWizardStep(0); setFlow(null); }} />
        <SectionTitle title="Choose Your Plan" sub="Start small, scale effortlessly. Upgrade anytime." />

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-9">
          {tabDefs.map(t => (
            <button
              key={t.id}
              onClick={() => setHostingTab(t.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold border transition-all ${
                hostingTab === t.id
                  ? "bg-[#701AFE] text-white border-[#701AFE] shadow-sm shadow-[#701AFE]/30"
                  : "bg-white text-gray-600 border-gray-200 hover:border-[#701AFE]/50 hover:text-[#701AFE]"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab tagline */}
        <p className="text-center text-[13px] text-gray-400 -mt-4 mb-7">
          {tabDefs.find(t => t.id === hostingTab)?.tagline}
        </p>

        {/* Plans */}
        {plansLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={28} className="animate-spin text-[#701AFE]" />
            <p className="text-sm text-gray-400">Loading plans...</p>
          </div>
        ) : displayPlans.length === 0 ? (
          <div className="text-center py-20">
            <Server size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-400 text-sm">No plans available yet. Please check back soon.</p>
          </div>
        ) : (
          <div className={`grid gap-5 ${displayPlans.length === 1 ? "max-w-sm mx-auto" : displayPlans.length === 2 ? "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
            {displayPlans.map((plan, idx) => {
              const isPopular = displayPlans.length > 1 && (idx === 1 || (displayPlans.length === 2 && idx === 1));
              const cycle = getCycle(plan.id);
              const price = planPrice(plan, cycle);
              const cycles = planCycles(plan);
              const isSelected = selectedPlan?.id === plan.id;

              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-2xl bg-white transition-all ${
                    isPopular
                      ? "border-2 border-[#701AFE] shadow-xl shadow-[#701AFE]/12"
                      : "border border-gray-200 hover:border-[#701AFE]/60 hover:shadow-lg"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap flex items-center gap-1 bg-[#701AFE] text-white text-[11px] font-bold px-3.5 py-1 rounded-full shadow">
                      <Star size={9} strokeWidth={3} /> MOST POPULAR
                    </div>
                  )}

                  {/* Card header */}
                  <div className={`px-6 pt-7 pb-5 border-b ${isPopular ? "border-[#701AFE]/20" : "border-gray-100"}`}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <h3 className="text-[17px] font-bold text-black leading-tight">{plan.name}</h3>
                        {plan.description && <p className="text-[12px] text-gray-400 mt-0.5 leading-snug">{plan.description}</p>}
                      </div>
                      {isPopular && <Pill label="Best Value" color="purple" />}
                    </div>

                    {/* Billing cycle pills */}
                    {cycles.length > 1 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {cycles.map(c => (
                          <button
                            key={c}
                            onClick={() => setPlanCyclesMap(prev => ({ ...prev, [plan.id]: c }))}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                              cycle === c
                                ? "bg-[#701AFE] text-white border-[#701AFE]"
                                : "bg-gray-50 text-gray-500 border-gray-200 hover:border-[#701AFE]/50"
                            }`}
                          >
                            {CYCLE_LABELS[c]}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Price */}
                    <div className="flex items-end gap-1">
                      <span className="text-[38px] font-extrabold text-black leading-none tracking-tight">
                        {formatPrice(price)}
                      </span>
                      <span className="text-[13px] text-gray-400 mb-1">{CYCLE_SUFFIX[cycle]}</span>
                    </div>
                    {cycle !== "monthly" && (
                      <p className="text-[11px] text-gray-400 mt-0.5">{formatPrice(plan.price)}/mo billed {CYCLE_LABELS[cycle].toLowerCase()}</p>
                    )}
                  </div>

                  {/* Features */}
                  <div className="px-6 py-5 flex-1">
                    <ul className="space-y-2.5">
                      <Feature icon={<HardDrive size={13} />} text={`${plan.diskSpace} Storage`} />
                      <Feature icon={<Wifi size={13} />} text={`${plan.bandwidth} Bandwidth`} />
                      <Feature icon={<Mail size={13} />} text={`${plan.emailAccounts ?? "Unlimited"} Email Accounts`} />
                      <Feature icon={<Database size={13} />} text={`${plan.databases ?? "Unlimited"} Databases`} />
                      {(plan.features ?? []).slice(0, 5).map(f => (
                        <Feature key={f} icon={<Check size={13} />} text={f} />
                      ))}
                    </ul>
                  </div>

                  {/* CTA */}
                  <div className="px-6 pb-6">
                    <button
                      onClick={() => handleSelectPlan(plan)}
                      disabled={isSelected}
                      className={`w-full py-3 rounded-xl text-[14px] font-bold transition-all flex items-center justify-center gap-2 ${
                        isSelected
                          ? "bg-green-50 text-green-700 border-2 border-green-200"
                          : isPopular
                          ? "bg-[#701AFE] text-white hover:bg-[#5e14d4] shadow-lg shadow-[#701AFE]/25 active:scale-[0.98]"
                          : "bg-white text-[#701AFE] border-2 border-[#701AFE] hover:bg-[#701AFE]/5 active:scale-[0.98]"
                      }`}
                    >
                      {isSelected
                        ? <><CheckCircle2 size={15} /> Plan Selected</>
                        : <><ShoppingCart size={15} /> Select Plan</>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-[12px] text-gray-400 mt-6 flex items-center justify-center gap-1.5">
          <Shield size={12} /> 30-day money-back guarantee on all plans
        </p>
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1 — Register Domain Flow
  // ─────────────────────────────────────────────────────────────────────────────

  function renderRegisterDomain() {
    const searchedName = regResults ? cleanName(regQuery) : "";

    async function handleSearch(e: React.FormEvent) {
      e.preventDefault();
      await checkAvailability(regQuery, setRegChecking, setRegResults, setRegError);
    }

    return (
      <motion.div key="reg-domain" {...fade}>
        <BackLink onClick={() => { setWizardStep(0); setFlow(null); setRegResults(null); }} />
        <SectionTitle title="Find Your Domain" sub="Check availability across 50+ extensions in real-time." />

        <form onSubmit={handleSearch} className="max-w-xl mx-auto mb-8">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={regInputRef}
                value={regQuery}
                onChange={e => { setRegQuery(e.target.value); setRegResults(null); }}
                placeholder="yourname, mybusiness, brandname…"
                className="w-full pl-11 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-[#701AFE]/30 focus:border-[#701AFE] transition-all"
                autoFocus
              />
            </div>
            <button type="submit" disabled={regChecking || !regQuery.trim()}
              className="px-6 py-3 bg-[#701AFE] text-white rounded-xl text-[14px] font-bold hover:bg-[#5e14d4] disabled:opacity-60 shadow-md shadow-[#701AFE]/20 transition-all flex items-center gap-2">
              {regChecking ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Search
            </button>
          </div>
          {regError && <p className="mt-2 text-[13px] text-red-500 flex items-center gap-1.5"><AlertCircle size={13} /> {regError}</p>}
        </form>

        {/* Popular TLD chips (before search) */}
        {!regResults && !regChecking && tldPricing.length > 0 && (
          <div className="max-w-xl mx-auto text-center">
            <p className="text-[11px] text-gray-400 mb-2.5 uppercase tracking-wider font-semibold">Popular Extensions</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {tldPricing.slice(0, 10).map(t => (
                <span key={t.tld} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[12px] text-gray-600">
                  <span className="font-semibold">{t.tld}</span>
                  <span className="text-gray-400 ml-1">{formatPrice(t.registrationPrice)}/yr</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {regChecking && (
          <div className="flex flex-col items-center justify-center py-14 gap-2">
            <Loader2 size={24} className="animate-spin text-[#701AFE]" />
            <p className="text-[13px] text-gray-400">Checking availability…</p>
          </div>
        )}

        {regResults && !regChecking && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto space-y-2">
            {regResults.filter(r => r.registrationPrice > 0).slice(0, 8).map(r => (
              <div
                key={r.tld}
                className={`flex items-center justify-between px-5 py-3.5 bg-white rounded-xl border transition-all ${
                  r.available ? "border-gray-200 hover:border-[#701AFE]/40" : "border-gray-100 opacity-60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${r.available ? "bg-green-400" : "bg-red-400"}`} />
                  <div>
                    <span className="text-[15px] font-bold text-black">{searchedName}</span>
                    <span className="text-[15px] font-bold text-[#701AFE]">{r.tld}</span>
                    <span className={`ml-2.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      r.available ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
                    }`}>
                      {r.available ? "Available" : "Taken"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[14px] font-bold text-black">{formatPrice(r.registrationPrice)}/yr</span>
                  {r.available && (
                    <button
                      onClick={() => {
                        sessionStorage.setItem("domain_search", `${searchedName}${r.tld}`);
                        goToCheckout("/client/domains");
                      }}
                      className="px-4 py-1.5 bg-[#701AFE] text-white rounded-lg text-[12px] font-bold hover:bg-[#5e14d4] transition-all"
                    >
                      Add
                    </button>
                  )}
                </div>
              </div>
            ))}
            <p className="text-center text-[12px] text-gray-400 pt-2">
              {tok() ? "Availability checked in real-time via RDAP" : "Sign in for real-time availability checking"}
            </p>
          </motion.div>
        )}
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1 — Transfer Flow
  // ─────────────────────────────────────────────────────────────────────────────

  function renderTransfer() {
    return (
      <motion.div key="transfer" {...fade}>
        <BackLink onClick={() => { setWizardStep(0); setFlow(null); }} />
        <SectionTitle title="Transfer Your Domain" sub="Move your domain to Noehost. We'll extend it by 1 year for free." />

        <form onSubmit={handleTransferSubmit} className="max-w-md mx-auto space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Domain Name</label>
            <div className="relative">
              <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={transferDomain} onChange={e => setTransferDomain(e.target.value)}
                placeholder="example.com" autoFocus
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-[#701AFE]/30 focus:border-[#701AFE]" />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">EPP / Authorization Code</label>
            <div className="relative">
              <Key size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={eppCode} onChange={e => setEppCode(e.target.value)} type="text"
                placeholder="Paste your EPP code here"
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-[14px] font-mono focus:outline-none focus:ring-2 focus:ring-[#701AFE]/30 focus:border-[#701AFE]" />
            </div>
            <p className="text-[12px] text-gray-400 mt-1">Get this code from your current registrar's control panel.</p>
          </div>

          {transferError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-600">
              <X size={14} /> {transferError}
            </div>
          )}

          <div className="bg-[#faf8ff] border border-[#e8e0ff] rounded-xl p-4">
            <p className="text-[13px] font-semibold text-[#701AFE] mb-2">What happens next?</p>
            <ol className="space-y-1 text-[12px] text-gray-500 list-decimal list-inside">
              <li>We verify your domain and EPP code</li>
              <li>You confirm the transfer payment</li>
              <li>Transfer completes within 5–7 days</li>
              <li>Your domain gets a free 1-year extension</li>
            </ol>
          </div>

          <button type="submit"
            className="w-full py-3.5 bg-[#701AFE] text-white rounded-xl text-[14px] font-bold hover:bg-[#5e14d4] shadow-lg shadow-[#701AFE]/20 transition-all flex items-center justify-center gap-2">
            <ArrowRightLeft size={16} /> Continue Transfer
          </button>
        </form>
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 2 — Domain Association (after hosting plan selected)
  // ─────────────────────────────────────────────────────────────────────────────

  function renderDomainAssociation() {
    const searchedName = domainResults ? cleanName(domainQuery) : "";

    async function handleDomainSearch(e: React.FormEvent) {
      e.preventDefault();
      await checkAvailability(domainQuery, setDomainChecking, setDomainResults, setDomainError);
    }

    return (
      <motion.div key="domain-assoc" {...fade}>
        <BackLink onClick={() => { setWizardStep(1); setDomainMode(null); setDomainResults(null); }} />

        {/* Success notice */}
        <div className="max-w-md mx-auto mb-8">
          <div className="flex items-center gap-3 px-5 py-3.5 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle2 size={18} className="text-green-500 shrink-0" />
            <div>
              <p className="text-[13px] font-semibold text-green-800">
                {selectedPlan?.name} added to your cart!
              </p>
              <p className="text-[12px] text-green-600">Now choose what to do with your domain.</p>
            </div>
          </div>
        </div>

        <SectionTitle title="Set Up Your Domain" sub="Every hosting plan needs a domain. Choose an option below." />

        {/* Option cards */}
        {!domainMode && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto mb-6">
            {[
              {
                mode: "register" as DomainMode,
                icon: <Search size={22} style={{ color: P }} />,
                title: "Register a New Domain",
                desc: "Search for and register a fresh domain name for your site.",
                badge: "Most Popular",
              },
              {
                mode: "existing" as DomainMode,
                icon: <Globe size={22} style={{ color: P }} />,
                title: "Use an Existing Domain",
                desc: "I already own a domain and will point it to Noehost.",
                badge: null,
              },
            ].map(opt => (
              <button
                key={opt.mode}
                onClick={() => setDomainMode(opt.mode)}
                className="group text-left bg-white border border-gray-200 rounded-2xl p-5 hover:border-[#701AFE] hover:shadow-md hover:shadow-[#701AFE]/8 transition-all focus:outline-none"
              >
                <div className="w-11 h-11 bg-[#701AFE]/8 rounded-xl flex items-center justify-center mb-4 group-hover:bg-[#701AFE]/14 transition-colors">
                  {opt.icon}
                </div>
                {opt.badge && <Pill label={opt.badge} color="purple" />}
                <h3 className="text-[15px] font-bold text-black mt-1.5 mb-1">{opt.title}</h3>
                <p className="text-[12px] text-gray-500 leading-relaxed">{opt.desc}</p>
              </button>
            ))}

            {/* Skip option */}
            <button
              onClick={() => goToCheckout("/client/cart")}
              className="sm:col-span-2 text-center py-3 rounded-xl border border-dashed border-gray-300 text-[13px] text-gray-400 hover:border-[#701AFE]/40 hover:text-[#701AFE] transition-all"
            >
              Skip for now — I'll add a domain later
            </button>
          </div>
        )}

        {/* Register domain sub-step */}
        {domainMode === "register" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => { setDomainMode(null); setDomainResults(null); }} className="text-[13px] text-gray-400 hover:text-[#701AFE] transition-colors flex items-center gap-1">
                <ArrowLeft size={13} /> Change option
              </button>
            </div>

            <form onSubmit={handleDomainSearch} className="flex gap-2 mb-5">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  ref={domainInputRef}
                  value={domainQuery}
                  onChange={e => { setDomainQuery(e.target.value); setDomainResults(null); }}
                  placeholder="e.g. mybusiness, mystore…"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-[#701AFE]/30 focus:border-[#701AFE]"
                  autoFocus
                />
              </div>
              <button type="submit" disabled={domainChecking || !domainQuery.trim()}
                className="px-5 py-2.5 bg-[#701AFE] text-white rounded-xl text-[13px] font-bold hover:bg-[#5e14d4] disabled:opacity-60 flex items-center gap-1.5 transition-all">
                {domainChecking ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Check
              </button>
            </form>

            {domainError && <p className="text-[13px] text-red-500 mb-3 flex items-center gap-1.5"><AlertCircle size={13} /> {domainError}</p>}

            {domainChecking && <div className="text-center py-8"><Loader2 size={20} className="animate-spin text-[#701AFE] mx-auto" /></div>}

            {domainResults && !domainChecking && (
              <div className="space-y-2">
                {domainResults.filter(r => r.registrationPrice > 0).slice(0, 6).map(r => (
                  <div
                    key={r.tld}
                    className={`flex items-center justify-between px-4 py-3 bg-white rounded-xl border transition-all ${
                      r.available ? "border-gray-200 hover:border-[#701AFE]/40" : "border-gray-100 opacity-55"}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${r.available ? "bg-green-400" : "bg-red-400"}`} />
                      <div>
                        <span className="text-[14px] font-bold text-black">{searchedName}</span>
                        <span className="text-[14px] font-bold text-[#701AFE]">{r.tld}</span>
                        <span className={`ml-2 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${r.available ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                          {r.available ? "Available" : "Taken"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold">{formatPrice(r.registrationPrice)}/yr</span>
                      {r.available && (
                        <button
                          onClick={() => {
                            sessionStorage.setItem("domain_search", `${searchedName}${r.tld}`);
                            goToCheckout("/client/cart");
                          }}
                          className="px-3.5 py-1.5 bg-[#701AFE] text-white rounded-lg text-[12px] font-bold hover:bg-[#5e14d4] transition-all"
                        >
                          Select
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="text-center pt-2">
                  <button onClick={() => goToCheckout("/client/cart")} className="text-[13px] text-gray-400 hover:text-[#701AFE] underline transition-colors">
                    Skip domain, proceed to checkout
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Existing domain sub-step */}
        {domainMode === "existing" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setDomainMode(null)} className="text-[13px] text-gray-400 hover:text-[#701AFE] transition-colors flex items-center gap-1">
                <ArrowLeft size={13} /> Change option
              </button>
            </div>

            <div className="mb-3">
              <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Your domain name</label>
              <div className="relative">
                <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={existingDomain}
                  onChange={e => setExistingDomain(e.target.value)}
                  placeholder="example.com"
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-[#701AFE]/30 focus:border-[#701AFE]"
                />
              </div>
              <p className="text-[12px] text-gray-400 mt-1">You'll point your nameservers to us after checkout.</p>
            </div>

            <button
              onClick={() => {
                sessionStorage.setItem("existing_domain", existingDomain);
                goToCheckout("/client/cart");
              }}
              className="w-full py-3 bg-[#701AFE] text-white rounded-xl text-[14px] font-bold hover:bg-[#5e14d4] shadow-lg shadow-[#701AFE]/20 transition-all flex items-center justify-center gap-2"
            >
              <ShoppingCart size={15} /> Proceed to Checkout
            </button>
          </motion.div>
        )}
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Determine progress step
  // ─────────────────────────────────────────────────────────────────────────────

  const progressStep = wizardStep === 0 ? 0 : wizardStep === 1 ? 1 : 2;

  // ─────────────────────────────────────────────────────────────────────────────
  // Root render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#fafafa]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="text-[20px] font-extrabold text-[#701AFE] tracking-tight">
            Noehost
          </button>
          <div className="flex items-center gap-1.5 text-[12px] text-gray-400">
            <Lock size={12} /> <span className="hidden sm:inline">Secure Checkout</span>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <ProgressBar step={progressStep} />

        <AnimatePresence mode="wait">
          {wizardStep === 0 && renderStep0()}
          {wizardStep === 1 && flow === "hosting"  && renderHostingPlans()}
          {wizardStep === 1 && flow === "domain"   && renderRegisterDomain()}
          {wizardStep === 1 && flow === "transfer" && renderTransfer()}
          {wizardStep === 2 && flow === "hosting"  && renderDomainAssociation()}
        </AnimatePresence>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 bg-white mt-12 py-5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[12px] text-gray-400">
          <span>© 2026 Noehost · All rights reserved.</span>
          <div className="flex gap-4">
            <a href="/terms" className="hover:text-[#701AFE] transition-colors">Terms</a>
            <a href="/privacy" className="hover:text-[#701AFE] transition-colors">Privacy</a>
            <a href="/client/tickets/new" className="hover:text-[#701AFE] transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
