import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Server, Globe, ArrowRightLeft, ChevronRight, Search, Loader2,
  CheckCircle, ShoppingCart, ArrowLeft, Star, Zap, Shield, Users,
  Database, Mail, HardDrive, Wifi, Check, X, Key,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCart, type BillingCycle, CYCLE_LABELS, CYCLE_SUFFIX } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyProvider";

// ─── Types ────────────────────────────────────────────────────────────────────

type Flow = "hosting" | "domain" | "transfer";
type HostingType = "shared" | "reseller" | "vps";
type HostingStep = "type" | "plans" | "domain-choice";
type DomainPeriod = 1 | 2 | 3;

interface Plan {
  id: string; name: string; description: string | null; price: number;
  yearlyPrice: number | null; quarterlyPrice: number | null; semiannualPrice: number | null;
  renewalPrice: number | null; renewalEnabled: boolean;
  billingCycle: string; diskSpace: string; bandwidth: string;
  emailAccounts: number | null; databases: number | null; features: string[];
}

interface TldPricing {
  tld: string; registrationPrice: number; register2YearPrice: number | null;
  register3YearPrice: number | null; renewalPrice: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToken(): string | null {
  return localStorage.getItem("token");
}

function getPrice(plan: Plan, cycle: BillingCycle): number {
  if (cycle === "quarterly" && plan.quarterlyPrice) return plan.quarterlyPrice;
  if (cycle === "semiannual" && plan.semiannualPrice) return plan.semiannualPrice;
  if (cycle === "yearly" && plan.yearlyPrice) return plan.yearlyPrice;
  return plan.price;
}

function availableCycles(plan: Plan): BillingCycle[] {
  const c: BillingCycle[] = ["monthly"];
  if (plan.quarterlyPrice) c.push("quarterly");
  if (plan.semiannualPrice) c.push("semiannual");
  if (plan.yearlyPrice) c.push("yearly");
  return c;
}

function classifyPlan(plan: Plan): HostingType {
  const n = plan.name.toLowerCase();
  if (n.includes("reseller")) return "reseller";
  if (n.includes("vps") || n.includes("virtual")) return "vps";
  return "shared";
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

const STEPS = ["Choose Service", "Customize", "Checkout"];

function ProgressBar({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                i < current
                  ? "bg-[#701AFE] text-white"
                  : i === current
                  ? "bg-[#701AFE] text-white ring-4 ring-[#701AFE]/20"
                  : "bg-gray-100 text-gray-400 border border-gray-200"
              }`}
            >
              {i < current ? <Check size={14} /> : i + 1}
            </div>
            <span
              className={`text-xs font-medium whitespace-nowrap ${
                i <= current ? "text-[#701AFE]" : "text-gray-400"
              }`}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`w-16 sm:w-24 h-0.5 mb-5 mx-1 transition-all ${
                i < current ? "bg-[#701AFE]" : "bg-gray-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Section Heading ──────────────────────────────────────────────────────────

function Heading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="text-center mb-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{title}</h1>
      {subtitle && <p className="text-gray-500 text-sm sm:text-base max-w-xl mx-auto">{subtitle}</p>}
    </div>
  );
}

// ─── Back Button ─────────────────────────────────────────────────────────────

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#701AFE] transition-colors mb-6"
    >
      <ArrowLeft size={15} /> Back
    </button>
  );
}

// ─── Slide animation ──────────────────────────────────────────────────────────

const slide = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
  transition: { duration: 0.22 },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OrderFlow() {
  const [, navigate] = useLocation();
  const { addItem } = useCart();
  const { formatPrice } = useCurrency();

  // Step state
  const [step, setStep] = useState(0);
  const [flow, setFlow] = useState<Flow | null>(null);

  // Hosting sub-state
  const [hostingStep, setHostingStep] = useState<HostingStep>("type");
  const [hostingType, setHostingType] = useState<HostingType>("shared");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [cycles, setCycles] = useState<Record<string, BillingCycle>>({});
  const [addedId, setAddedId] = useState<string | null>(null);

  // Domain state
  const [domainInput, setDomainInput] = useState("");
  const [domainSearch, setDomainSearch] = useState<string | null>(null);
  const [domainPeriod, setDomainPeriod] = useState<DomainPeriod>(1);
  const domainRef = useRef<HTMLInputElement>(null);

  // Transfer state
  const [transferDomain, setTransferDomain] = useState("");
  const [eppCode, setEppCode] = useState("");
  const [transferError, setTransferError] = useState("");

  // Plans query
  const { data: plans = [], isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["order-plans"],
    queryFn: async () => {
      const r = await fetch("/api/packages", {
        headers: { Authorization: `Bearer ${getToken() || ""}` },
      });
      return r.json();
    },
    enabled: flow === "hosting" && hostingStep !== "type",
  });

  // Domain pricing query
  const { data: tldPricing = [], isLoading: pricingLoading } = useQuery<TldPricing[]>({
    queryKey: ["domain-pricing"],
    queryFn: async () => {
      const r = await fetch("/api/domains/pricing");
      return r.json();
    },
    enabled: flow === "domain",
  });

  // Filter plans by hosting type
  const filteredPlans = plans.filter(p => classifyPlan(p) === hostingType);
  const displayPlans = filteredPlans.length > 0 ? filteredPlans : plans;

  // Domain search results
  const searchedName = domainSearch
    ? domainSearch.toLowerCase().split(".")[0].replace(/[^a-z0-9-]/g, "")
    : "";
  const domainResults = domainSearch
    ? tldPricing.filter(t => t.registrationPrice > 0).slice(0, 8)
    : [];

  // ── Navigation helpers ───────────────────────────────────────────────────

  function goCheckout(type: "cart" | "domain" | "transfer") {
    const token = getToken();
    const redirectMap = { cart: "/client/cart", domain: "/client/domains", transfer: "/client/domains?tab=transfers" };
    const dest = redirectMap[type];
    if (token) {
      navigate(dest);
    } else {
      sessionStorage.setItem("order_redirect", dest);
      navigate(`/register?next=${encodeURIComponent(dest)}`);
    }
  }

  function selectFlow(f: Flow) {
    setFlow(f);
    setStep(1);
  }

  function getCycle(planId: string): BillingCycle {
    return cycles[planId] ?? "monthly";
  }

  function handleAddPlan(plan: Plan) {
    const cycle = getCycle(plan.id);
    addItem({
      planId: plan.id,
      planName: plan.name,
      billingCycle: cycle,
      monthlyPrice: plan.price,
      quarterlyPrice: plan.quarterlyPrice ?? undefined,
      semiannualPrice: plan.semiannualPrice ?? undefined,
      yearlyPrice: plan.yearlyPrice ?? undefined,
      renewalPrice: plan.renewalPrice ?? undefined,
      renewalEnabled: plan.renewalEnabled,
    });
    setSelectedPlan(plan);
    setAddedId(plan.id);
    setHostingStep("domain-choice");
  }

  function handleDomainSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!domainInput.trim()) return;
    setDomainSearch(domainInput.trim());
  }

  function handleDomainContinue() {
    const name = domainSearch || domainInput;
    sessionStorage.setItem("domain_search", name);
    goCheckout("domain");
  }

  function handleTransferContinue() {
    if (!transferDomain || !eppCode) return;
    sessionStorage.setItem("transfer_domain", transferDomain);
    sessionStorage.setItem("transfer_epp", eppCode);
    goCheckout("transfer");
  }

  // ── Render: Step 0 — Group Selection ────────────────────────────────────

  function renderStep0() {
    const cards = [
      {
        id: "hosting" as Flow,
        icon: <Server size={36} className="text-[#701AFE]" />,
        title: "Hosting Services",
        subtitle: "Shared · Reseller · VPS",
        description: "Get a complete hosting solution with cPanel, one-click WordPress, email accounts, and free SSL.",
        highlights: ["⚡ NVMe SSD Storage", "📧 Unlimited Emails", "🔒 Free SSL Certificate", "🚀 99.9% Uptime SLA"],
        cta: "Browse Plans",
      },
      {
        id: "domain" as Flow,
        icon: <Globe size={36} className="text-[#701AFE]" />,
        title: "Register a Domain",
        subtitle: ".com · .net · .pk · .org and 50+ more",
        description: "Search and register your perfect domain name. Competitive prices in PKR with auto-renewal.",
        highlights: ["🌐 50+ Domain Extensions", "🛡️ WHOIS Privacy Free", "🔄 Auto-Renew Option", "📋 Full DNS Control"],
        cta: "Search Domain",
      },
      {
        id: "transfer" as Flow,
        icon: <ArrowRightLeft size={36} className="text-[#701AFE]" />,
        title: "Transfer a Domain",
        subtitle: "Move your domain to Noehost",
        description: "Transfer your existing domain to Noehost for better prices, faster support, and unified management.",
        highlights: ["🆓 Free 1-Year Extension", "⚙️ Easy Transfer Process", "💬 Full Support Included", "🏷️ Best PKR Rates"],
        cta: "Start Transfer",
      },
    ];

    return (
      <motion.div key="step0" {...slide}>
        <Heading
          title="What would you like to do?"
          subtitle="Choose a service to get started. Our team is available 24/7 to help you set up."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {cards.map(card => (
            <button
              key={card.id}
              onClick={() => selectFlow(card.id)}
              className="group text-left bg-white border border-gray-200 rounded-2xl p-6 hover:border-[#701AFE] hover:shadow-lg hover:shadow-[#701AFE]/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#701AFE]/40"
            >
              <div className="w-16 h-16 bg-[#701AFE]/8 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-[#701AFE]/15 transition-colors">
                {card.icon}
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-0.5">{card.title}</h2>
              <p className="text-xs text-[#701AFE] font-semibold mb-3">{card.subtitle}</p>
              <p className="text-sm text-gray-500 mb-4 leading-relaxed">{card.description}</p>
              <ul className="space-y-1.5 mb-5">
                {card.highlights.map(h => (
                  <li key={h} className="text-xs text-gray-600">{h}</li>
                ))}
              </ul>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#701AFE] group-hover:gap-3 transition-all">
                {card.cta} <ChevronRight size={15} />
              </div>
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">
          30-day money-back guarantee · No setup fees · Cancel anytime
        </p>
      </motion.div>
    );
  }

  // ── Render: Step 1 — Hosting Type ───────────────────────────────────────

  function renderHostingType() {
    const types: { id: HostingType; icon: React.ReactNode; title: string; tagline: string; for: string; specs: string[] }[] = [
      {
        id: "shared",
        icon: <Globe size={28} className="text-[#701AFE]" />,
        title: "Shared Hosting",
        tagline: "Best for blogs, portfolios & small businesses",
        for: "Beginners & Small Sites",
        specs: ["cPanel included", "Free SSL", "Unlimited emails", "1-click WordPress"],
      },
      {
        id: "reseller",
        icon: <Users size={28} className="text-[#701AFE]" />,
        title: "Reseller Hosting",
        tagline: "Start your own hosting business with WHM",
        for: "Web Agencies & Freelancers",
        specs: ["WHM access", "Create client accounts", "WHMCS-ready", "White-label support"],
      },
      {
        id: "vps",
        icon: <Zap size={28} className="text-[#701AFE]" />,
        title: "VPS Server",
        tagline: "Dedicated resources with full root access",
        for: "Developers & Power Users",
        specs: ["Dedicated CPU/RAM", "Root SSH access", "Custom OS", "SSD NVMe storage"],
      },
    ];

    return (
      <motion.div key="hosting-type" {...slide}>
        <BackBtn onClick={() => { setStep(0); setFlow(null); }} />
        <Heading
          title="Choose Hosting Type"
          subtitle="Select the hosting solution that best fits your needs."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {types.map(t => (
            <button
              key={t.id}
              onClick={() => { setHostingType(t.id); setHostingStep("plans"); }}
              className="group text-left bg-white border border-gray-200 rounded-2xl p-6 hover:border-[#701AFE] hover:shadow-lg hover:shadow-[#701AFE]/10 transition-all focus:outline-none focus:ring-2 focus:ring-[#701AFE]/40"
            >
              <div className="w-12 h-12 bg-[#701AFE]/8 rounded-xl flex items-center justify-center mb-4 group-hover:bg-[#701AFE]/15 transition-colors">
                {t.icon}
              </div>
              <div className="inline-block px-2.5 py-0.5 bg-gray-100 rounded-full text-xs text-gray-500 mb-3">{t.for}</div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">{t.title}</h3>
              <p className="text-sm text-gray-500 mb-4 leading-relaxed">{t.tagline}</p>
              <ul className="space-y-1.5">
                {t.specs.map(s => (
                  <li key={s} className="flex items-center gap-2 text-xs text-gray-600">
                    <CheckCircle size={13} className="text-[#701AFE] shrink-0" /> {s}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#701AFE] mt-5 group-hover:gap-3 transition-all">
                View Plans <ChevronRight size={15} />
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    );
  }

  // ── Render: Step 1 — Plans ───────────────────────────────────────────────

  function renderPlans() {
    const typeLabel: Record<HostingType, string> = {
      shared: "Shared Hosting",
      reseller: "Reseller Hosting",
      vps: "VPS Server",
    };

    return (
      <motion.div key="plans" {...slide}>
        <BackBtn onClick={() => setHostingStep("type")} />
        <Heading
          title={`${typeLabel[hostingType]} Plans`}
          subtitle="Choose the plan that fits your needs. You can upgrade anytime."
        />
        {plansLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={32} className="animate-spin text-[#701AFE]" />
          </div>
        ) : displayPlans.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Server size={40} className="mx-auto mb-3 opacity-40" />
            <p>No plans available yet. Please check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {displayPlans.map((plan, idx) => {
              const isPopular = idx === 1 || displayPlans.length === 1;
              const cycle = getCycle(plan.id);
              const price = getPrice(plan, cycle);
              const planCycles = availableCycles(plan);
              const isAdded = addedId === plan.id;

              return (
                <div
                  key={plan.id}
                  className={`relative bg-white rounded-2xl p-6 flex flex-col gap-4 transition-all ${
                    isPopular
                      ? "border-2 border-[#701AFE] shadow-lg shadow-[#701AFE]/15"
                      : "border border-gray-200 hover:border-[#701AFE]/50 hover:shadow-md"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 bg-[#701AFE] text-white text-xs font-bold rounded-full">
                      <Star size={10} /> Most Popular
                    </div>
                  )}

                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                    {plan.description && <p className="text-xs text-gray-500 mt-0.5">{plan.description}</p>}
                  </div>

                  {planCycles.length > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      {planCycles.map(c => (
                        <button
                          key={c}
                          onClick={() => setCycles(prev => ({ ...prev, [plan.id]: c }))}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                            cycle === c
                              ? "bg-[#701AFE] text-white border-[#701AFE]"
                              : "bg-white text-gray-500 border-gray-200 hover:border-[#701AFE]/40"
                          }`}
                        >
                          {CYCLE_LABELS[c]}
                        </button>
                      ))}
                    </div>
                  )}

                  <div>
                    <p className="text-4xl font-bold text-gray-900">
                      {formatPrice(price)}
                      <span className="text-base font-normal text-gray-400">{CYCLE_SUFFIX[cycle]}</span>
                    </p>
                  </div>

                  <ul className="space-y-2 border-t border-gray-100 pt-3">
                    {[
                      { icon: <HardDrive size={13} />, text: `${plan.diskSpace} Storage` },
                      { icon: <Wifi size={13} />, text: `${plan.bandwidth} Bandwidth` },
                      { icon: <Mail size={13} />, text: `${plan.emailAccounts ?? 10} Email Accounts` },
                      { icon: <Database size={13} />, text: `${plan.databases ?? 5} Databases` },
                      ...(plan.features ?? []).slice(0, 4).map(f => ({ icon: <Check size={13} />, text: f })),
                    ].map(({ icon, text }) => (
                      <li key={text} className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="text-[#701AFE] shrink-0">{icon}</span> {text}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleAddPlan(plan)}
                    disabled={isAdded}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold mt-auto flex items-center justify-center gap-2 transition-all ${
                      isAdded
                        ? "bg-green-100 text-green-700 border border-green-200"
                        : isPopular
                        ? "bg-[#701AFE] text-white hover:bg-[#5e14d4] shadow-lg shadow-[#701AFE]/25"
                        : "bg-white text-[#701AFE] border-2 border-[#701AFE] hover:bg-[#701AFE]/5"
                    }`}
                  >
                    {isAdded ? (
                      <><CheckCircle size={15} /> Plan Selected</>
                    ) : (
                      <><ShoppingCart size={15} /> Select Plan</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    );
  }

  // ── Render: Step 1 — Domain Choice (after plan selected) ─────────────────

  function renderDomainChoice() {
    return (
      <motion.div key="domain-choice" {...slide}>
        <BackBtn onClick={() => setHostingStep("plans")} />
        <Heading
          title="Almost done — choose your domain"
          subtitle={selectedPlan ? `${selectedPlan.name} has been added to your cart.` : ""}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
          {[
            {
              icon: <Globe size={24} className="text-[#701AFE]" />,
              title: "Register a New Domain",
              desc: "Search and register a fresh domain name.",
              onClick: () => { setStep(2); navigate("/client/domains?tab=register"); },
            },
            {
              icon: <Server size={24} className="text-[#701AFE]" />,
              title: "Use an Existing Domain",
              desc: "I already have a domain and will update nameservers.",
              onClick: () => goCheckout("cart"),
            },
            {
              icon: <ArrowRightLeft size={24} className="text-[#701AFE]" />,
              title: "Skip for Now",
              desc: "Proceed to checkout. Add a domain later.",
              onClick: () => goCheckout("cart"),
            },
          ].map(opt => (
            <button
              key={opt.title}
              onClick={opt.onClick}
              className="group text-left bg-white border border-gray-200 rounded-2xl p-5 hover:border-[#701AFE] hover:shadow-md hover:shadow-[#701AFE]/10 transition-all focus:outline-none focus:ring-2 focus:ring-[#701AFE]/30"
            >
              <div className="w-10 h-10 bg-[#701AFE]/8 rounded-xl flex items-center justify-center mb-3 group-hover:bg-[#701AFE]/15 transition-colors">
                {opt.icon}
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-1">{opt.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{opt.desc}</p>
            </button>
          ))}
        </div>
        <div className="mt-8 text-center">
          <button
            onClick={() => goCheckout("cart")}
            className="inline-flex items-center gap-2 px-8 py-3 bg-[#701AFE] text-white rounded-xl text-sm font-bold hover:bg-[#5e14d4] shadow-lg shadow-[#701AFE]/25 transition-all"
          >
            <ShoppingCart size={16} /> Proceed to Checkout
          </button>
        </div>
      </motion.div>
    );
  }

  // ── Render: Step 1 — Domain Search ──────────────────────────────────────

  function renderDomainSearch() {
    const periods: DomainPeriod[] = [1, 2, 3];
    const periodLabels: Record<DomainPeriod, string> = { 1: "1 Year", 2: "2 Years", 3: "3 Years" };

    function getPeriodPrice(t: TldPricing, p: DomainPeriod): number {
      if (p === 2 && t.register2YearPrice) return t.register2YearPrice;
      if (p === 3 && t.register3YearPrice) return t.register3YearPrice;
      return t.registrationPrice;
    }

    return (
      <motion.div key="domain-search" {...slide}>
        <BackBtn onClick={() => { setStep(0); setFlow(null); }} />
        <Heading
          title="Find your perfect domain"
          subtitle="Search for your domain name. We'll check availability across 50+ extensions."
        />

        <form onSubmit={handleDomainSearch} className="max-w-2xl mx-auto mb-8">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={domainRef}
                value={domainInput}
                onChange={e => setDomainInput(e.target.value)}
                placeholder="e.g. mybusiness, myname, mystore..."
                className="w-full pl-11 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#701AFE]/40 focus:border-[#701AFE]"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-[#701AFE] text-white rounded-xl text-sm font-bold hover:bg-[#5e14d4] shadow-md shadow-[#701AFE]/25 transition-all whitespace-nowrap"
            >
              Search
            </button>
          </div>
        </form>

        {pricingLoading && (
          <div className="flex justify-center py-10">
            <Loader2 size={28} className="animate-spin text-[#701AFE]" />
          </div>
        )}

        {domainSearch && !pricingLoading && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex flex-wrap gap-2 justify-center mb-5">
              {periods.map(p => (
                <button
                  key={p}
                  onClick={() => setDomainPeriod(p)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    domainPeriod === p
                      ? "bg-[#701AFE] text-white border-[#701AFE]"
                      : "bg-white text-gray-600 border-gray-200 hover:border-[#701AFE]/40"
                  }`}
                >
                  {periodLabels[p]}
                </button>
              ))}
            </div>

            <div className="space-y-2 max-w-2xl mx-auto">
              {domainResults.map(tld => {
                const price = getPeriodPrice(tld, domainPeriod);
                return (
                  <div
                    key={tld.tld}
                    className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-3.5 hover:border-[#701AFE]/40 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 bg-[#701AFE]/8 rounded-lg flex items-center justify-center text-xs font-bold text-[#701AFE]">
                        {tld.tld.slice(1, 3).toUpperCase()}
                      </span>
                      <div>
                        <span className="text-sm font-semibold text-gray-900">{searchedName}</span>
                        <span className="text-sm font-bold text-[#701AFE]">{tld.tld}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-900">{formatPrice(price)}/yr</span>
                      <button
                        onClick={() => {
                          setDomainInput(`${searchedName}${tld.tld}`);
                          handleDomainContinue();
                        }}
                        className="px-4 py-1.5 bg-[#701AFE] text-white rounded-lg text-xs font-bold hover:bg-[#5e14d4] transition-all"
                      >
                        Add to Cart
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-center mt-6">
              <button
                onClick={handleDomainContinue}
                className="inline-flex items-center gap-2 text-sm text-[#701AFE] font-semibold hover:underline"
              >
                Continue without selecting a TLD <ChevronRight size={15} />
              </button>
            </div>
          </motion.div>
        )}

        {!domainSearch && !pricingLoading && tldPricing.length > 0 && (
          <div className="max-w-2xl mx-auto">
            <p className="text-xs text-gray-400 text-center mb-3">Popular extensions</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {tldPricing.slice(0, 10).map(t => (
                <span
                  key={t.tld}
                  className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 hover:border-[#701AFE]/40 cursor-default"
                >
                  {t.tld} · {formatPrice(t.registrationPrice)}/yr
                </span>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  // ── Render: Step 1 — Transfer ────────────────────────────────────────────

  function renderTransfer() {
    function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      if (!transferDomain.includes(".")) { setTransferError("Please enter a valid domain name, e.g. example.com"); return; }
      if (!eppCode.trim()) { setTransferError("EPP/Auth code is required for domain transfer."); return; }
      setTransferError("");
      handleTransferContinue();
    }

    return (
      <motion.div key="transfer" {...slide}>
        <BackBtn onClick={() => { setStep(0); setFlow(null); }} />
        <Heading
          title="Transfer your domain to Noehost"
          subtitle="Enter your domain name and the EPP/Authorization code from your current registrar."
        />
        <form onSubmit={handleSubmit} className="max-w-xl mx-auto space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Domain Name</label>
            <div className="relative">
              <Globe size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={transferDomain}
                onChange={e => setTransferDomain(e.target.value)}
                placeholder="example.com"
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#701AFE]/40 focus:border-[#701AFE]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">EPP / Authorization Code</label>
            <div className="relative">
              <Key size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={eppCode}
                onChange={e => setEppCode(e.target.value)}
                type="text"
                placeholder="Paste your EPP code here"
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#701AFE]/40 focus:border-[#701AFE] font-mono"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">You can get this from your current domain registrar's control panel.</p>
          </div>
          {transferError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              <X size={15} className="shrink-0 mt-0.5" /> {transferError}
            </div>
          )}
          <div className="bg-[#f8f6ff] border border-[#e0d9ff] rounded-xl p-4 text-sm text-gray-600">
            <p className="font-semibold text-[#701AFE] mb-2 flex items-center gap-2"><Shield size={14} /> What happens next?</p>
            <ol className="space-y-1 text-xs text-gray-500 list-decimal list-inside">
              <li>We verify your domain and EPP code</li>
              <li>You confirm payment for the transfer</li>
              <li>Transfer completes within 5–7 days</li>
              <li>Your domain is extended by 1 year for free</li>
            </ol>
          </div>
          <button
            type="submit"
            className="w-full py-3.5 bg-[#701AFE] text-white rounded-xl text-sm font-bold hover:bg-[#5e14d4] shadow-lg shadow-[#701AFE]/25 transition-all flex items-center justify-center gap-2"
          >
            <ArrowRightLeft size={16} /> Continue Transfer
          </button>
        </form>
      </motion.div>
    );
  }

  // ── Render: Step 2 — Checkout Redirect ──────────────────────────────────

  function renderCheckout() {
    const isLoggedIn = !!getToken();
    return (
      <motion.div key="checkout" {...slide} className="text-center py-8">
        <div className="w-16 h-16 bg-[#701AFE]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShoppingCart size={28} className="text-[#701AFE]" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Ready to checkout!</h2>
        <p className="text-gray-500 text-sm mb-8 max-w-sm mx-auto">
          {isLoggedIn
            ? "You're logged in. Complete your order from your cart."
            : "Create a free account or log in to complete your order."}
        </p>
        {isLoggedIn ? (
          <button
            onClick={() => navigate("/client/cart")}
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#701AFE] text-white rounded-xl font-bold text-sm hover:bg-[#5e14d4] shadow-lg shadow-[#701AFE]/25 transition-all"
          >
            <ShoppingCart size={16} /> Go to Cart
          </button>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate("/register")}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#701AFE] text-white rounded-xl font-bold text-sm hover:bg-[#5e14d4] shadow-lg shadow-[#701AFE]/25 transition-all"
            >
              Create Free Account
            </button>
            <button
              onClick={() => navigate("/client/login")}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-[#701AFE] border-2 border-[#701AFE] rounded-xl font-bold text-sm hover:bg-[#701AFE]/5 transition-all"
            >
              Sign In
            </button>
          </div>
        )}
      </motion.div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  const currentProgressStep =
    step === 0 ? 0
    : (flow === "hosting" && (hostingStep === "domain-choice")) ? 2
    : step === 2 ? 2
    : 1;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="text-2xl font-extrabold text-[#701AFE] tracking-tight"
          >
            Noehost
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 hidden sm:block">🔒 Secure Checkout</span>
            <Shield size={16} className="text-gray-300" />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-10">
        <ProgressBar current={currentProgressStep} />

        <AnimatePresence mode="wait">
          {step === 0 && renderStep0()}

          {step === 1 && flow === "hosting" && hostingStep === "type" && renderHostingType()}
          {step === 1 && flow === "hosting" && hostingStep === "plans" && renderPlans()}
          {step === 1 && flow === "hosting" && hostingStep === "domain-choice" && renderDomainChoice()}
          {step === 1 && flow === "domain" && renderDomainSearch()}
          {step === 1 && flow === "transfer" && renderTransfer()}

          {step === 2 && renderCheckout()}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white mt-10 py-6">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
          <span>© 2026 Noehost. All rights reserved.</span>
          <div className="flex gap-4">
            <a href="/privacy" className="hover:text-[#701AFE]">Privacy Policy</a>
            <a href="/terms" className="hover:text-[#701AFE]">Terms of Service</a>
            <a href="/client/tickets/new" className="hover:text-[#701AFE]">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
