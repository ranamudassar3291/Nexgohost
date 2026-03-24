import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence, type HTMLMotionProps } from "framer-motion";
import {
  Server, Globe, ArrowRightLeft, ChevronRight, Check, X,
  Search, Loader2, Star, ArrowLeft, ShoppingCart, Receipt,
  HardDrive, Wifi, Mail, Database, Lock, AlertCircle,
  CheckCircle2, Key, Shield, Zap, Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCart, type BillingCycle, CYCLE_LABELS, CYCLE_SUFFIX, getItemPrice } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyProvider";

// ─── Types ────────────────────────────────────────────────────────────────────

type ServiceType = "hosting" | "domain" | "transfer";
type HostingTab  = "shared" | "reseller" | "vps";
type DomainMode  = "register" | "existing" | null;

interface Plan {
  id: string; name: string; description: string | null;
  price: number; yearlyPrice: number | null; quarterlyPrice: number | null;
  semiannualPrice: number | null; renewalPrice: number | null; renewalEnabled: boolean;
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

interface CartDomain { fullName: string; price: number; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const P       = "#701AFE";
const P_SOFT  = "rgba(112,26,254,0.08)";
const DOMAIN_KEY = "order_wizard_domain";

function tok() { return localStorage.getItem("token"); }

function planPrice(plan: Plan, cycle: BillingCycle): number {
  if (cycle === "quarterly"  && plan.quarterlyPrice)  return plan.quarterlyPrice;
  if (cycle === "semiannual" && plan.semiannualPrice) return plan.semiannualPrice;
  if (cycle === "yearly"     && plan.yearlyPrice)     return plan.yearlyPrice;
  return plan.price;
}

function planCycles(plan: Plan): BillingCycle[] {
  const c: BillingCycle[] = ["monthly"];
  if (plan.quarterlyPrice)  c.push("quarterly");
  if (plan.semiannualPrice) c.push("semiannual");
  if (plan.yearlyPrice)     c.push("yearly");
  return c;
}

function classifyPlan(plan: Plan): HostingTab {
  const n = plan.name.toLowerCase();
  if (n.includes("reseller")) return "reseller";
  if (n.includes("vps") || n.includes("virtual")) return "vps";
  return "shared";
}

function cleanName(raw: string) {
  return raw.trim().toLowerCase().split(".")[0].replace(/[^a-z0-9-]/g, "");
}

function loadDomain(): CartDomain | null {
  try { return JSON.parse(localStorage.getItem(DOMAIN_KEY) ?? "null"); }
  catch { return null; }
}

// ─── Animation ───────────────────────────────────────────────────────────────

type MotionDiv = Omit<HTMLMotionProps<"div">, "ref"|"children"|"key"|"className"|"style">;
const fade: MotionDiv = {
  initial:    { opacity: 0, y: 12 },
  animate:    { opacity: 1, y: 0  },
  exit:       { opacity: 0, y: -8 },
  transition: { duration: 0.18    },
};

// ─── Step Progress Bar ────────────────────────────────────────────────────────

const STEPS = [
  { label: "Choose Service" },
  { label: "Choose Plan"    },
  { label: "Domain & Config"},
  { label: "Checkout"       },
];

function StepBar({ active }: { active: number }) {
  return (
    <div className="overflow-x-auto -mx-1 px-1 mb-8">
      <div className="flex items-start justify-center min-w-[340px] gap-0">
        {STEPS.map((s, i) => {
          const done   = i < active;
          const cur    = i === active;
          return (
            <div key={s.label} className="flex items-start">
              <div className="flex flex-col items-center w-[72px] sm:w-24">
                {/* Circle */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold transition-all duration-300 ${
                  done ? "bg-[#701AFE] text-white"
                  : cur  ? "bg-[#701AFE] text-white ring-4 ring-[#701AFE]/18"
                  :         "bg-[#F3F4F6] text-gray-400"
                }`}>
                  {done ? <Check size={14} strokeWidth={2.5}/> : i + 1}
                </div>
                {/* Label */}
                <span className={`mt-1.5 text-[10px] sm:text-[11px] font-semibold text-center leading-tight ${
                  cur ? "text-[#701AFE]" : done ? "text-gray-500" : "text-gray-400"
                }`}>{s.label}</span>
              </div>
              {/* Connector */}
              {i < STEPS.length - 1 && (
                <div className={`w-8 sm:w-12 h-0.5 mt-4 shrink-0 transition-all duration-500 ${done ? "bg-[#701AFE]" : "bg-[#E5E7EB]"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Feature Row ─────────────────────────────────────────────────────────────

function Feat({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-2.5" style={{ gap: 10 }}>
      <Check size={13} strokeWidth={2.5} style={{ color: P, flexShrink: 0 }} />
      <span className="text-[13px] text-gray-600 leading-snug">{text}</span>
    </li>
  );
}

// ─── Order Summary Sidebar + Mobile Bar ──────────────────────────────────────

interface SidebarProps {
  service:  ServiceType | null;
  plan:     Plan | null;
  cycle:    BillingCycle;
  domain:   CartDomain | null;
  fmt:      (n: number) => string;
  onRmPlan: () => void;
  onRmDom:  () => void;
  onCheckout: () => void;
}

function Summary({ service, plan, cycle, domain, fmt, onRmPlan, onRmDom, onCheckout }: SidebarProps) {
  const planAmt = plan ? planPrice(plan, cycle) : 0;
  const domAmt  = domain ? domain.price : 0;
  const total   = planAmt + domAmt;
  const hasAny  = !!plan || !!domain;

  const serviceLabel: Record<ServiceType, string> = {
    hosting: "Web Hosting", domain: "Domain Registration", transfer: "Domain Transfer",
  };

  const inner = (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-gray-200 mb-3">
        <Receipt size={14} style={{ color: P }} />
        <span className="text-[12px] font-bold text-gray-700 uppercase tracking-wider">Your Order</span>
      </div>

      {/* Items */}
      <div className="space-y-2 mb-3">
        {/* Selected Service row (always shown if service chosen) */}
        {service && !plan && (
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-gray-400">Service</span>
            <span className="font-semibold text-gray-700">{serviceLabel[service]}</span>
          </div>
        )}

        {/* Plan row */}
        {plan && (
          <div className="flex items-start justify-between gap-2 bg-white border border-gray-200 rounded-xl p-2.5">
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-black truncate">{plan.name}</p>
              <p className="text-[11px] text-gray-400">{CYCLE_LABELS[cycle]}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[12px] font-bold">{fmt(planAmt)}</span>
              <button onClick={onRmPlan}
                className="w-4 h-4 rounded-full bg-gray-100 hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-gray-400 transition-colors">
                <X size={9}/>
              </button>
            </div>
          </div>
        )}

        {/* Domain row */}
        {domain && (
          <div className="flex items-start justify-between gap-2 bg-white border border-gray-200 rounded-xl p-2.5">
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-black truncate">{domain.fullName}</p>
              <p className="text-[11px] text-gray-400">Domain · 1 Year</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {domain.price > 0 && <span className="text-[12px] font-bold">{fmt(domAmt)}</span>}
              {domain.price === 0 && <span className="text-[11px] text-gray-400">Free</span>}
              <button onClick={onRmDom}
                className="w-4 h-4 rounded-full bg-gray-100 hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-gray-400 transition-colors">
                <X size={9}/>
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!hasAny && (
          <div className="py-4 flex flex-col items-center gap-2">
            <ShoppingCart size={22} className="text-gray-300"/>
            <p className="text-[11px] text-gray-400 text-center">No items yet.<br/>Select a service to begin.</p>
          </div>
        )}
      </div>

      {/* Total */}
      {hasAny && (
        <div className="border-t border-gray-200 pt-2.5 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-gray-500">Total</span>
            <span className="text-[17px] font-extrabold text-black">{fmt(total)}</span>
          </div>
          <p className="text-[10px] text-right text-gray-400 mt-0.5">Billed {CYCLE_LABELS[cycle].toLowerCase()}</p>
        </div>
      )}

      {/* CTA */}
      <button onClick={onCheckout} disabled={!hasAny}
        className={`w-full py-2.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 transition-all ${
          hasAny
            ? "text-white hover:opacity-90 active:scale-[0.98] shadow-lg"
            : "bg-gray-100 text-gray-400 cursor-not-allowed"
        }`}
        style={hasAny ? { background: P, boxShadow: `0 4px 16px ${P}33` } : {}}>
        <ShoppingCart size={13}/>
        {hasAny ? "Proceed to Checkout" : "Select a plan to continue"}
      </button>

      {hasAny && (
        <p className="text-[10px] text-gray-400 text-center mt-2 flex items-center justify-center gap-1">
          <Lock size={9}/> 30-day money-back guarantee
        </p>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <div className="sticky top-20 rounded-2xl border border-gray-200 overflow-hidden" style={{ background: "#FAFAFA" }}>
          {inner}
        </div>
      </div>

      {/* Mobile bottom bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 shadow-2xl">
        {hasAny ? (
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-black truncate">
                {plan?.name ?? domain?.fullName ?? ""}
                {plan && domain ? ` + ${domain.fullName}` : ""}
              </p>
              <p className="text-[11px] font-semibold" style={{ color: P }}>{fmt(total)} total</p>
            </div>
            <button onClick={onCheckout}
              className="shrink-0 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white flex items-center gap-1.5 transition-all"
              style={{ background: P }}>
              <ShoppingCart size={13}/> Checkout
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center px-4 py-3 gap-1.5">
            <ShoppingCart size={13} className="text-gray-400"/>
            <span className="text-[12px] text-gray-400">Select a plan to continue</span>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NewOrder() {
  const [, setLocation] = useLocation();
  const { addItem, removeItem } = useCart();
  const { formatPrice } = useCurrency();

  // Wizard state
  const [step,    setStep]    = useState(0);
  const [service, setService] = useState<ServiceType | null>(null);
  const [tabType, setTabType] = useState<HostingTab>("shared");

  // Plan state
  const [cycleMap,      setCycleMap]      = useState<Record<string, BillingCycle>>({});
  const [selectedPlan,  setSelectedPlan]  = useState<Plan | null>(null);

  // Domain state
  const [domainMode, setDomainMode] = useState<DomainMode>(null);
  const [domainQ,    setDomainQ]    = useState("");
  const [domChecking,setDomChecking]= useState(false);
  const [domResults, setDomResults] = useState<TldResult[] | null>(null);
  const [domError,   setDomError]   = useState("");
  const [existingDom,setExistingDom]= useState("");
  const domRef = useRef<HTMLInputElement>(null);

  // Transfer state
  const [txDomain, setTxDomain] = useState("");
  const [eppCode,  setEppCode]  = useState("");
  const [txError,  setTxError]  = useState("");

  // Cart domain (localStorage)
  const [cartDomain, setCartDomainRaw] = useState<CartDomain | null>(loadDomain);

  function setCartDomain(d: CartDomain | null) {
    setCartDomainRaw(d);
    if (d) localStorage.setItem(DOMAIN_KEY, JSON.stringify(d));
    else   localStorage.removeItem(DOMAIN_KEY);
  }

  // Plans query
  const { data: allPlans = [], isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["order-plans"],
    queryFn: async () => {
      const r = await fetch("/api/packages", { headers: { Authorization: `Bearer ${tok() ?? ""}` } });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: service === "hosting" && step >= 1,
    staleTime: 60_000,
  });

  // TLD pricing
  const { data: tldPricing = [] } = useQuery<TldPricing[]>({
    queryKey: ["tld-pricing"],
    queryFn: async () => (await fetch("/api/domains/pricing")).json(),
    enabled: service === "domain" || step === 2,
    staleTime: 300_000,
  });

  // Derived
  const byTab = (t: HostingTab) => {
    const f = allPlans.filter(p => classifyPlan(p) === t);
    return f.length > 0 ? f : allPlans;
  };
  const displayPlans = byTab(tabType);

  function getCycle(id: string): BillingCycle { return cycleMap[id] ?? "monthly"; }

  const currentCycle = selectedPlan ? getCycle(selectedPlan.id) : "monthly";
  const showSidebar  = step > 0 && service !== "transfer";

  // ── Domain availability ───────────────────────────────────────────────────

  async function checkDomain() {
    const clean = cleanName(domainQ);
    if (!clean || clean.length < 2) { setDomError("Enter a valid domain name."); return; }
    setDomError(""); setDomChecking(true); setDomResults(null);

    try {
      const token = tok();
      if (token) {
        const r = await fetch(`/api/domains/availability?domain=${encodeURIComponent(clean)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json();
        if (!r.ok) { setDomError(d.error || "Check failed."); }
        else setDomResults(d.results ?? []);
      } else {
        setDomResults(tldPricing.filter(t => t.registrationPrice > 0).map(t => ({
          tld: t.tld, available: true, rdapStatus: "unknown",
          registrationPrice: t.registrationPrice,
          register2YearPrice: t.register2YearPrice,
          register3YearPrice: t.register3YearPrice,
          renewalPrice: t.renewalPrice,
        })));
      }
    } catch { setDomError("Network error. Please try again."); }
    setDomChecking(false);
  }

  // ── Cart actions ──────────────────────────────────────────────────────────

  function selectPlan(plan: Plan) {
    if (selectedPlan) removeItem(selectedPlan.id);
    const cycle = getCycle(plan.id);
    addItem({
      planId: plan.id, planName: plan.name, billingCycle: cycle,
      monthlyPrice: plan.price,
      quarterlyPrice:  plan.quarterlyPrice  ?? undefined,
      semiannualPrice: plan.semiannualPrice ?? undefined,
      yearlyPrice:     plan.yearlyPrice     ?? undefined,
      renewalPrice:    plan.renewalPrice    ?? undefined,
      renewalEnabled:  plan.renewalEnabled,
    });
    setSelectedPlan(plan);
    setStep(2);
  }

  function removePlan() {
    if (selectedPlan) removeItem(selectedPlan.id);
    setSelectedPlan(null);
    setStep(1);
  }

  function doCheckout() {
    if (!selectedPlan && !cartDomain) return;
    setLocation("/client/cart");
  }

  function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!txDomain.includes(".")) { setTxError("Enter a valid domain, e.g. example.com"); return; }
    if (!eppCode.trim())         { setTxError("EPP/Auth code is required.");              return; }
    sessionStorage.setItem("transfer_domain", txDomain);
    sessionStorage.setItem("transfer_epp",    eppCode);
    setLocation("/client/domains?tab=transfers");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 0 — Choose Service
  // ─────────────────────────────────────────────────────────────────────────────

  const serviceCards = [
    {
      id: "hosting" as ServiceType,
      icon: <Server size={30} strokeWidth={1.6} style={{ color: P }}/>,
      title: "Web Hosting",
      desc: "Shared, Reseller, and VPS plans with cPanel & WHM included.",
      bullets: ["cPanel & WHM included", "Free SSL Certificate", "NVMe SSD Storage", "99.9% Uptime SLA"],
      cta: "View Plans", popular: true,
    },
    {
      id: "domain" as ServiceType,
      icon: <Globe size={30} strokeWidth={1.6} style={{ color: P }}/>,
      title: "Domain Registration",
      desc: "Register your perfect domain from 50+ extensions at the best PKR rates.",
      bullets: ["50+ TLD extensions", "WHOIS privacy free", "Auto-renewal support", "Full DNS control"],
      cta: "Search Domain", popular: false,
    },
    {
      id: "transfer" as ServiceType,
      icon: <ArrowRightLeft size={28} strokeWidth={1.6} style={{ color: P }}/>,
      title: "Domain Transfer",
      desc: "Move your domain to Noehost and get a free 1-year extension.",
      bullets: ["Free 1-year extension", "Keep your domain live", "Simple EPP transfer", "Best PKR pricing"],
      cta: "Start Transfer", popular: false,
    },
  ];

  function renderStep0() {
    return (
      <motion.div key="s0" {...fade}>
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-black mb-2" style={{ fontFamily: "'Inter', sans-serif" }}>
            What do you need today?
          </h1>
          <p className="text-[14px] text-gray-500">Select a service. Our wizard guides you step by step.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
          {serviceCards.map(card => (
            <button
              key={card.id}
              onClick={() => { setService(card.id); setStep(1); }}
              className="group relative text-left flex flex-col transition-all duration-200 focus:outline-none"
              style={{
                background: "#FFFFFF",
                borderRadius: 15,
                border: card.popular ? `2px solid ${P}` : "1px solid #E5E7EB",
                padding: "28px 24px",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 24px rgba(112,26,254,0.14)`;
                (e.currentTarget as HTMLElement).style.borderColor = P;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = "";
                (e.currentTarget as HTMLElement).style.borderColor = card.popular ? P : "#E5E7EB";
              }}
            >
              {card.popular && (
                <div className="absolute -top-3 left-5 flex items-center gap-1 px-3 py-0.5 text-white text-[11px] font-bold rounded-full"
                  style={{ background: P }}>
                  <Star size={9} strokeWidth={2.5}/> MOST POPULAR
                </div>
              )}

              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-colors"
                style={{ background: P_SOFT }}>
                {card.icon}
              </div>

              <h3 className="text-[18px] font-bold text-black mb-1.5">{card.title}</h3>
              <p className="text-[13px] text-gray-500 mb-5 leading-relaxed">{card.desc}</p>

              <ul className="space-y-2 mb-6 flex-1">
                {card.bullets.map(b => (
                  <li key={b} className="flex items-center gap-2 text-[13px] text-gray-600">
                    <Check size={12} strokeWidth={2.5} style={{ color: P, flexShrink: 0 }}/> {b}
                  </li>
                ))}
              </ul>

              <div className="flex items-center gap-1.5 text-[13px] font-bold" style={{ color: P }}>
                {card.cta} <ChevronRight size={14} strokeWidth={2.5}/>
              </div>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 mt-6 text-[12px] text-gray-400">
          <span className="flex items-center gap-1.5"><Lock size={11}/> Secure Checkout</span>
          <span className="hidden sm:inline">·</span>
          <span>30-day money-back guarantee</span>
          <span className="hidden sm:inline">·</span>
          <span>No setup fees</span>
        </div>
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1 — Choose Plan (Hostinger-style grid)
  // ─────────────────────────────────────────────────────────────────────────────

  const tabs: { id: HostingTab; label: string; icon: React.ReactNode }[] = [
    { id: "shared",   label: "Shared Hosting",  icon: <Globe size={13}/> },
    { id: "reseller", label: "Reseller Hosting", icon: <Users size={13}/> },
    { id: "vps",      label: "VPS Server",       icon: <Zap size={13}/> },
  ];

  function renderStep1() {
    return (
      <motion.div key="s1" {...fade}>
        <button onClick={() => { setStep(0); setService(null); }}
          className="inline-flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-black transition-colors mb-6 font-medium">
          <ArrowLeft size={13}/> Back
        </button>

        <div className="text-center mb-7">
          <h2 className="text-2xl sm:text-3xl font-bold text-black mb-1.5">Choose Your Plan</h2>
          <p className="text-[14px] text-gray-500">Start small and scale effortlessly. Upgrade anytime.</p>
        </div>

        {/* Tabs */}
        <div className="overflow-x-auto -mx-1 px-1 mb-6">
          <div className="flex gap-2 min-w-max justify-center">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTabType(t.id)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold border transition-all whitespace-nowrap"
                style={tabType === t.id
                  ? { background: P, color: "#fff", border: `1px solid ${P}`, boxShadow: `0 2px 12px ${P}44` }
                  : { background: "#fff", color: "#4B5563", border: "1px solid #E5E7EB" }
                }>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {plansLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={28} className="animate-spin" style={{ color: P }}/>
            <p className="text-[13px] text-gray-400">Loading plans…</p>
          </div>
        ) : displayPlans.length === 0 ? (
          <div className="text-center py-20">
            <Server size={32} className="mx-auto mb-3 text-gray-200"/>
            <p className="text-gray-400 text-sm">No plans available. Please check back soon.</p>
          </div>
        ) : (
          <div className={`grid gap-5 ${
            displayPlans.length === 1 ? "max-w-xs mx-auto" :
            displayPlans.length === 2 ? "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto" :
            "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          }`}>
            {displayPlans.map((plan, idx) => {
              const isRec  = displayPlans.length > 1 && idx === Math.floor(displayPlans.length / 2);
              const cycle  = getCycle(plan.id);
              const price  = planPrice(plan, cycle);
              const cycles = planCycles(plan);
              const isSel  = selectedPlan?.id === plan.id;

              return (
                <div key={plan.id} className="relative flex flex-col rounded-2xl bg-white transition-all"
                  style={{
                    border: isRec ? `2px solid ${P}` : "1px solid #E5E7EB",
                    boxShadow: isRec ? `0 8px 32px ${P}1A` : undefined,
                  }}>

                  {isRec && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap px-3.5 py-1 text-white text-[11px] font-bold rounded-full flex items-center gap-1 shadow"
                      style={{ background: P }}>
                      <Star size={9} strokeWidth={3}/> Recommended
                    </div>
                  )}

                  {/* Card Header */}
                  <div className={`px-5 pt-7 pb-4 border-b ${isRec ? "border-[#701AFE]/15" : "border-gray-100"}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-[17px] font-bold text-black leading-tight">{plan.name}</h3>
                      {isRec && (
                        <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white"
                          style={{ background: P }}>Best Value</span>
                      )}
                    </div>
                    {plan.description && (
                      <p className="text-[12px] text-gray-400 mb-3">{plan.description}</p>
                    )}

                    {/* Billing Cycle Pills */}
                    {cycles.length > 1 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {cycles.map(c => (
                          <button key={c}
                            onClick={() => setCycleMap(prev => ({ ...prev, [plan.id]: c }))}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all"
                            style={cycle === c
                              ? { background: P, color: "#fff", border: `1px solid ${P}` }
                              : { background: "#F9FAFB", color: "#6B7280", border: "1px solid #E5E7EB" }
                            }>
                            {CYCLE_LABELS[c]}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Price — big, Hostinger-style */}
                    <div className="flex items-end gap-1">
                      <span className="text-[40px] font-extrabold text-black leading-none">{formatPrice(price)}</span>
                      <span className="text-[14px] text-gray-400 mb-1">{CYCLE_SUFFIX[cycle]}</span>
                    </div>
                    {cycle !== "monthly" && (
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Billed as {formatPrice(price)} · {formatPrice(plan.price)}/mo equivalent
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <div className="px-5 py-4 flex-1">
                    <ul className="space-y-2.5">
                      <Feat text={`${plan.diskSpace} SSD Storage`}/>
                      <Feat text={`${plan.bandwidth} Bandwidth`}/>
                      <Feat text={`${plan.emailAccounts ?? "Unlimited"} Email Accounts`}/>
                      <Feat text={`${plan.databases ?? "Unlimited"} Databases`}/>
                      {(plan.features ?? []).slice(0, 5).map(f => <Feat key={f} text={f}/>)}
                    </ul>
                  </div>

                  {/* CTA button — full-width purple */}
                  <div className="px-5 pb-5">
                    <button
                      onClick={() => selectPlan(plan)}
                      disabled={isSel}
                      className="w-full py-3 rounded-xl text-[14px] font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                      style={isSel
                        ? { background: "#D1FAE5", color: "#065F46", cursor: "default" }
                        : { background: P, boxShadow: `0 4px 16px ${P}33` }
                      }
                    >
                      {isSel
                        ? <><CheckCircle2 size={15}/> Plan Selected</>
                        : <><ShoppingCart size={15}/> Get Started</>
                      }
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-center gap-1.5 mt-5 text-[12px] text-gray-400">
          <Shield size={12}/> 30-day money-back guarantee on all plans
        </div>
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1 — Domain Registration (standalone flow)
  // ─────────────────────────────────────────────────────────────────────────────

  function renderDomainReg() {
    const searched = domResults ? cleanName(domainQ) : "";

    return (
      <motion.div key="s1-dom" {...fade}>
        <button onClick={() => { setStep(0); setService(null); setDomResults(null); }}
          className="inline-flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-black transition-colors mb-6 font-medium">
          <ArrowLeft size={13}/> Back
        </button>

        <div className="text-center mb-7">
          <h2 className="text-2xl sm:text-3xl font-bold text-black mb-1.5">Find Your Domain</h2>
          <p className="text-[14px] text-gray-500">Check availability across 50+ extensions in real time.</p>
        </div>

        {/* Search bar */}
        <div className="max-w-2xl mx-auto mb-6">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input value={domainQ}
                onChange={e => { setDomainQ(e.target.value); setDomResults(null); }}
                onKeyDown={e => e.key === "Enter" && checkDomain()}
                placeholder="yourname, mybrand, mystore…"
                className="w-full pl-11 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-[14px] focus:outline-none transition-all"
                style={{ borderRadius: 12 }}
                onFocus={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.boxShadow = `0 0 0 3px ${P}22`; }}
                onBlur={e  => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = ""; }}
                autoFocus
              />
            </div>
            <button onClick={checkDomain} disabled={domChecking || !domainQ.trim()}
              className="w-full sm:w-auto px-6 py-3.5 text-white rounded-xl text-[14px] font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
              style={{ background: P, borderRadius: 12 }}>
              {domChecking ? <Loader2 size={16} className="animate-spin"/> : <Search size={16}/>}
              Check Availability
            </button>
          </div>
          {domError && <p className="mt-2 text-[13px] text-red-500 flex items-center gap-1.5"><AlertCircle size={13}/> {domError}</p>}
        </div>

        {/* Popular TLD pills (when no search yet) */}
        {!domResults && !domChecking && tldPricing.length > 0 && (
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-[11px] text-gray-400 uppercase tracking-widest font-semibold mb-2.5">Popular Extensions</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {tldPricing.slice(0, 8).map(t => (
                <span key={t.tld} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[12px] text-gray-600"
                  style={{ borderRadius: 10 }}>
                  <span className="font-bold">{t.tld}</span>
                  <span className="text-gray-400 ml-1">{formatPrice(t.registrationPrice)}/yr</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {domChecking && (
          <div className="flex flex-col items-center py-12 gap-2">
            <Loader2 size={22} className="animate-spin" style={{ color: P }}/>
            <p className="text-[13px] text-gray-400">Checking availability…</p>
          </div>
        )}

        {/* ── Results: Horizontal bar style (Hostinger) ── */}
        {domResults && !domChecking && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto space-y-2.5">
            {domResults.filter(r => r.registrationPrice > 0).slice(0, 8).map(r => (
              <div key={r.tld}
                className={`flex items-center justify-between px-4 py-3.5 bg-white rounded-xl border transition-all ${
                  r.available ? "border-gray-200 hover:border-[#701AFE]/30 hover:shadow-sm" : "border-gray-100 opacity-55"
                }`}
                style={{ borderRadius: 12 }}>

                {/* Left: domain name */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-[15px] font-bold text-black">{searched}</span>
                  <span className="text-[15px] font-bold" style={{ color: P }}>{r.tld}</span>
                </div>

                {/* Center: availability badge */}
                <div className="mx-4 shrink-0">
                  {r.available ? (
                    <span className="flex items-center gap-1 text-[12px] font-bold text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                      <Check size={11} strokeWidth={2.5}/> Available
                    </span>
                  ) : (
                    <span className="text-[12px] font-bold text-red-400 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
                      Taken
                    </span>
                  )}
                </div>

                {/* Right: price + button */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[14px] font-bold text-black">{formatPrice(r.registrationPrice)}/yr</span>
                  {r.available && (
                    <button
                      onClick={() => {
                        setCartDomain({ fullName: `${searched}${r.tld}`, price: r.registrationPrice });
                        setLocation("/client/cart");
                      }}
                      className="px-3.5 py-1.5 text-white text-[12px] font-bold rounded-lg flex items-center gap-1 transition-all hover:opacity-90"
                      style={{ background: P, borderRadius: 9 }}>
                      <ShoppingCart size={12}/> Add to Cart
                    </button>
                  )}
                </div>
              </div>
            ))}

            <p className="text-center text-[11px] text-gray-400 pt-1">
              Prices shown in PKR · Checked via RDAP
            </p>
          </motion.div>
        )}
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1 — Transfer
  // ─────────────────────────────────────────────────────────────────────────────

  function renderTransfer() {
    return (
      <motion.div key="s1-tx" {...fade}>
        <button onClick={() => { setStep(0); setService(null); }}
          className="inline-flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-black transition-colors mb-6 font-medium">
          <ArrowLeft size={13}/> Back
        </button>

        <div className="text-center mb-7">
          <h2 className="text-2xl sm:text-3xl font-bold text-black mb-1.5">Transfer Your Domain</h2>
          <p className="text-[14px] text-gray-500">Move to Noehost and get a free 1-year extension.</p>
        </div>

        <form onSubmit={handleTransfer} className="max-w-md mx-auto space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Domain Name</label>
            <div className="relative">
              <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input value={txDomain} onChange={e => setTxDomain(e.target.value)}
                placeholder="example.com" autoFocus
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-[14px] focus:outline-none"
                onFocus={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.boxShadow = `0 0 0 3px ${P}22`; }}
                onBlur={e  => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = ""; }}/>
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">EPP / Authorization Code</label>
            <div className="relative">
              <Key size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input value={eppCode} onChange={e => setEppCode(e.target.value)}
                placeholder="Paste your EPP code here" type="text"
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-[14px] font-mono focus:outline-none"
                onFocus={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.boxShadow = `0 0 0 3px ${P}22`; }}
                onBlur={e  => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = ""; }}/>
            </div>
            <p className="text-[12px] text-gray-400 mt-1">Find this in your current registrar's control panel.</p>
          </div>
          {txError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-600">
              <AlertCircle size={14}/> {txError}
            </div>
          )}
          <div className="rounded-xl p-4 text-[13px]" style={{ background: "#FAF8FF", border: "1px solid #EDE9FF" }}>
            <p className="font-semibold mb-2" style={{ color: P }}>What happens next?</p>
            <ol className="space-y-1 text-gray-500 list-decimal list-inside text-[12px]">
              <li>We verify your domain and EPP code</li>
              <li>You confirm the transfer payment in PKR</li>
              <li>Transfer completes within 5–7 days</li>
              <li>Domain gets a free 1-year extension</li>
            </ol>
          </div>
          <button type="submit"
            className="w-full py-3.5 text-white rounded-xl text-[14px] font-bold flex items-center justify-center gap-2 transition-all"
            style={{ background: P, boxShadow: `0 4px 16px ${P}33` }}>
            <ArrowRightLeft size={15}/> Continue Transfer
          </button>
        </form>
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 2 — Domain & Config (after hosting plan selected)
  // ─────────────────────────────────────────────────────────────────────────────

  function renderStep2() {
    const searched = domResults ? cleanName(domainQ) : "";

    async function handleDomSearch(e: React.FormEvent) {
      e.preventDefault();
      await checkDomain();
    }

    return (
      <motion.div key="s2" {...fade}>
        <button onClick={() => { setStep(1); setDomainMode(null); setDomResults(null); }}
          className="inline-flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-black transition-colors mb-6 font-medium">
          <ArrowLeft size={13}/> Back
        </button>

        {/* Plan added confirmation */}
        <div className="max-w-lg mx-auto mb-7">
          <div className="flex items-center gap-3 px-4 py-3.5 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle2 size={16} className="text-green-500 shrink-0"/>
            <div>
              <p className="text-[13px] font-semibold text-green-800">{selectedPlan?.name} added to your cart!</p>
              <p className="text-[12px] text-green-600">Now configure your domain.</p>
            </div>
          </div>
        </div>

        <div className="text-center mb-7">
          <h2 className="text-2xl sm:text-3xl font-bold text-black mb-1.5">Set Up Your Domain</h2>
          <p className="text-[14px] text-gray-500">Every hosting plan needs a domain. Choose an option below.</p>
        </div>

        {/* Mode selection */}
        {!domainMode && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto mb-5">
            {[
              { mode: "register" as NonNullable<DomainMode>, icon: <Search size={20} style={{ color: P }}/>, title: "Register a New Domain", desc: "Search and register a brand-new domain name." },
              { mode: "existing" as NonNullable<DomainMode>, icon: <Globe size={20} style={{ color: P }}/>,  title: "Use an Existing Domain", desc: "I already own a domain and will point it to Noehost." },
            ].map(opt => (
              <button key={opt.mode} onClick={() => setDomainMode(opt.mode)}
                className="group text-left bg-white border border-gray-200 rounded-2xl p-5 transition-all focus:outline-none"
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = P; (e.currentTarget as HTMLElement).style.boxShadow = `0 0 16px ${P}14`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#E5E7EB"; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: P_SOFT }}>
                  {opt.icon}
                </div>
                <h3 className="text-[14px] font-bold text-black mb-1">{opt.title}</h3>
                <p className="text-[12px] text-gray-500 leading-relaxed">{opt.desc}</p>
              </button>
            ))}

            <button onClick={() => setLocation("/client/cart")}
              className="sm:col-span-2 w-full py-3 rounded-xl border border-dashed border-gray-300 text-[13px] text-gray-400 hover:text-[#701AFE] hover:border-[#701AFE]/40 transition-all">
              Skip for now — add a domain later
            </button>
          </div>
        )}

        {/* Register mode */}
        {domainMode === "register" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto">
            <button onClick={() => { setDomainMode(null); setDomResults(null); }}
              className="flex items-center gap-1 text-[13px] text-gray-400 hover:text-black mb-4 transition-colors">
              <ArrowLeft size={13}/> Change option
            </button>

            {/* Search bar — same Hostinger horizontal style */}
            <form onSubmit={handleDomSearch} className="flex flex-col sm:flex-row gap-2 mb-5">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input ref={domRef} value={domainQ}
                  onChange={e => { setDomainQ(e.target.value); setDomResults(null); }}
                  placeholder="e.g. mybusiness, mystore…" autoFocus
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-[14px] focus:outline-none"
                  onFocus={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.boxShadow = `0 0 0 3px ${P}22`; }}
                  onBlur={e  => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = ""; }}
                />
              </div>
              <button type="submit" disabled={domChecking || !domainQ.trim()}
                className="w-full sm:w-auto px-5 py-3 text-white rounded-xl text-[13px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-60 transition-all"
                style={{ background: P }}>
                {domChecking ? <Loader2 size={14} className="animate-spin"/> : <Search size={14}/>} Check Availability
              </button>
            </form>

            {domError && <p className="text-[13px] text-red-500 mb-3 flex items-center gap-1.5"><AlertCircle size={13}/> {domError}</p>}
            {domChecking && <div className="text-center py-8"><Loader2 size={20} className="animate-spin mx-auto" style={{ color: P }}/></div>}

            {/* Hostinger-style horizontal result bars */}
            {domResults && !domChecking && (
              <div className="space-y-2.5">
                {domResults.filter(r => r.registrationPrice > 0).slice(0, 6).map(r => (
                  <div key={r.tld}
                    className={`flex items-center justify-between px-4 py-3.5 bg-white rounded-xl border transition-all ${
                      r.available ? "border-gray-200 hover:border-[#701AFE]/30" : "border-gray-100 opacity-55"}`}
                    style={{ borderRadius: 12 }}>
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <span className="text-[14px] font-bold text-black">{searched}</span>
                      <span className="text-[14px] font-bold" style={{ color: P }}>{r.tld}</span>
                    </div>
                    <div className="mx-3 shrink-0">
                      {r.available
                        ? <span className="flex items-center gap-1 text-[11px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full"><Check size={10} strokeWidth={2.5}/> Available</span>
                        : <span className="text-[11px] font-bold text-red-400 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">Taken</span>
                      }
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-[13px] font-bold">{formatPrice(r.registrationPrice)}/yr</span>
                      {r.available && (
                        <button
                          onClick={() => {
                            setCartDomain({ fullName: `${searched}${r.tld}`, price: r.registrationPrice });
                            setLocation("/client/cart");
                          }}
                          className="px-3 py-1.5 text-white text-[12px] font-bold rounded-lg flex items-center gap-1 hover:opacity-90 transition-all"
                          style={{ background: P, borderRadius: 8 }}>
                          <ShoppingCart size={11}/> Add to Cart
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="text-center pt-1">
                  <button onClick={() => setLocation("/client/cart")}
                    className="text-[13px] text-gray-400 hover:underline transition-colors" style={{ color: undefined }}>
                    Skip domain, go to checkout →
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Existing domain mode */}
        {domainMode === "existing" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto">
            <button onClick={() => setDomainMode(null)}
              className="flex items-center gap-1 text-[13px] text-gray-400 hover:text-black mb-4 transition-colors">
              <ArrowLeft size={13}/> Change option
            </button>
            <div className="mb-4">
              <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Your domain name</label>
              <div className="relative">
                <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input value={existingDom} onChange={e => setExistingDom(e.target.value)}
                  placeholder="example.com" autoFocus
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-[14px] focus:outline-none"
                  onFocus={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.boxShadow = `0 0 0 3px ${P}22`; }}
                  onBlur={e  => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = ""; }}
                />
              </div>
              <p className="text-[12px] text-gray-400 mt-1.5">You'll update nameservers to point to Noehost after checkout.</p>
            </div>
            <button
              onClick={() => {
                if (existingDom.trim()) setCartDomain({ fullName: existingDom.trim(), price: 0 });
                setLocation("/client/cart");
              }}
              className="w-full py-3 text-white rounded-xl text-[14px] font-bold flex items-center justify-center gap-2 transition-all"
              style={{ background: P, boxShadow: `0 4px 16px ${P}33` }}>
              <ShoppingCart size={15}/> Proceed to Checkout
            </button>
          </motion.div>
        )}
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Root render
  // ─────────────────────────────────────────────────────────────────────────────

  const progressStep = step === 0 ? 0 : step === 1 ? 1 : step === 2 ? 2 : 3;
  const hasMobileBar  = showSidebar;

  return (
    <div className={hasMobileBar ? "pb-20 lg:pb-0" : ""} style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Step progress bar */}
      <StepBar active={progressStep}/>

      {/* Two-column layout: content + sidebar */}
      <div className={showSidebar ? "lg:grid lg:grid-cols-[1fr_272px] lg:gap-8 lg:items-start" : ""}>

        {/* ── Main content ── */}
        <div>
          <AnimatePresence mode="wait">
            {step === 0                                  && renderStep0()}
            {step === 1 && service === "hosting"         && renderStep1()}
            {step === 1 && service === "domain"          && renderDomainReg()}
            {step === 1 && service === "transfer"        && renderTransfer()}
            {step === 2 && service === "hosting"         && renderStep2()}
          </AnimatePresence>
        </div>

        {/* ── Order summary (sidebar + mobile bar) ── */}
        {showSidebar && (
          <Summary
            service={service}
            plan={selectedPlan}
            cycle={currentCycle}
            domain={cartDomain}
            fmt={formatPrice}
            onRmPlan={removePlan}
            onRmDom={() => setCartDomain(null)}
            onCheckout={doCheckout}
          />
        )}
      </div>
    </div>
  );
}
