import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence, type HTMLMotionProps } from "framer-motion";
import {
  Server, Globe, ArrowRightLeft, ChevronRight, Search, Loader2,
  Check, X, ArrowLeft, Zap, Shield, Users, Database,
  Mail, HardDrive, Wifi, ShoppingCart, CheckCircle2,
  Star, Key, AlertCircle, Lock, Receipt, Trash2,
  LayoutGrid, MonitorCog, Copy,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCart, type BillingCycle, CYCLE_LABELS, CYCLE_SUFFIX } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyProvider";

// ─── Types ────────────────────────────────────────────────────────────────────

type Flow = "hosting" | "domain" | "transfer";
type DomainMode = "register" | "existing";
type HostingSubStep = "groups" | "plans";

interface ProductGroup {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface Plan {
  id: string; name: string; description: string | null;
  groupId: string | null;
  price: number;
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

interface CartDomain { fullName: string; price: number; }

// ─── Constants ────────────────────────────────────────────────────────────────

const P = "#701AFE";
const DOMAIN_STORAGE_KEY = "order_wizard_domain";

function tok(): string | null { return localStorage.getItem("token"); }

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

function cleanName(raw: string): string {
  return raw.trim().toLowerCase().split(".")[0].replace(/[^a-z0-9-]/g, "");
}

function loadDomainFromStorage(): CartDomain | null {
  try {
    const raw = localStorage.getItem(DOMAIN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  });
}

// ─── Group config ─────────────────────────────────────────────────────────────
// Visual metadata for each product group slug
const GROUP_META: Record<string, {
  icon: React.ReactNode;
  color: string;
  tagline: string;
  bullets: string[];
  badge?: string;
}> = {
  "shared-hosting": {
    icon: <Server size={26} strokeWidth={1.6} />,
    color: "#701AFE",
    tagline: "Perfect for websites, blogs & small businesses",
    bullets: ["cPanel Included", "Free SSL Certificate", "NVMe SSD Storage", "99.9% Uptime Guarantee"],
    badge: "Most Popular",
  },
  "wordpress-hosting": {
    icon: (
      <svg width="26" height="26" viewBox="0 0 120 120" fill="none">
        <circle cx="60" cy="60" r="56" stroke="#701AFE" strokeWidth="8"/>
        <path d="M9 60C9 31.8 31.8 9 60 9" stroke="#701AFE" strokeWidth="5" strokeLinecap="round"/>
        <text x="22" y="78" fontSize="62" fontWeight="bold" fill="#701AFE" fontFamily="Georgia,serif">W</text>
      </svg>
    ),
    color: "#0073aa",
    tagline: "Managed WordPress with LiteSpeed & LSCache",
    bullets: ["One-Click WordPress Install", "LSCache Pre-installed", "Daily Backups", "Managed WP Updates"],
  },
  "reseller-hosting": {
    icon: <Users size={26} strokeWidth={1.6} />,
    color: "#701AFE",
    tagline: "Start your own hosting business with WHM",
    bullets: ["WHM Control Panel", "White-Label Ready", "WHMCS-Compatible", "Private Nameservers"],
  },
  "vps-hosting": {
    icon: <Zap size={26} strokeWidth={1.6} />,
    color: "#701AFE",
    tagline: "Dedicated resources with full root SSH access",
    bullets: ["Full Root Access", "Dedicated IP", "NVMe SSD Storage", "Scalable Resources"],
  },
};

// ─── Motion ───────────────────────────────────────────────────────────────────

type MotionDivBase = Omit<HTMLMotionProps<"div">, "ref" | "children" | "key" | "className" | "style">;
const fade: MotionDivBase = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8  },
  transition: { duration: 0.2 },
};

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="text-center mb-9">
      <h2 className="text-2xl sm:text-[32px] font-bold tracking-tight text-black leading-tight">{title}</h2>
      {sub && <p className="mt-2.5 text-[14px] sm:text-[15px] text-gray-500 max-w-lg mx-auto leading-relaxed">{sub}</p>}
    </div>
  );
}

function BackLink({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-black transition-colors mb-6 font-medium">
      <ArrowLeft size={14} /> {label}
    </button>
  );
}

function Pill({ label, color = "gray" }: { label: string; color?: "gray" | "purple" | "blue" }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
      color === "purple" ? "bg-[#701AFE]/10 text-[#701AFE]"
      : color === "blue" ? "bg-blue-50 text-blue-600"
      : "bg-gray-100 text-gray-500"
    }`}>
      {label}
    </span>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-2 text-[13px] text-gray-600">
      <Check size={12} className="text-[#701AFE] shrink-0" />
      <span>{text}</span>
    </li>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

const STEPS = ["Select Service", "Choose Group", "Select Plan", "Domain & Checkout"];

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="overflow-x-auto pb-1 mb-10 -mx-2 px-2">
      <div className="flex items-start justify-center min-w-[320px]">
        {STEPS.map((label, i) => {
          const done   = i < step;
          const active = i === step;
          return (
            <div key={label} className="flex items-start">
              <div className="flex flex-col items-center w-20 sm:w-24">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  done   ? "bg-[#701AFE] text-white"
                  : active ? "bg-[#701AFE] text-white ring-[3px] ring-[#701AFE]/20"
                  : "bg-white border-2 border-gray-200 text-gray-400"}`}>
                  {done ? <Check size={13} strokeWidth={2.5} /> : i + 1}
                </div>
                <span className={`mt-1.5 text-[10px] sm:text-[11px] font-semibold text-center leading-tight ${
                  active ? "text-[#701AFE]" : done ? "text-gray-500" : "text-gray-400"}`}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-6 sm:w-10 h-0.5 mt-3.5 shrink-0 transition-all duration-500 ${done ? "bg-[#701AFE]" : "bg-gray-200"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Order Summary ────────────────────────────────────────────────────────────

interface OrderSummaryProps {
  plan: Plan | null;
  planCycle: BillingCycle;
  domain: CartDomain | null;
  formatPrice: (n: number) => string;
  onRemovePlan: () => void;
  onRemoveDomain: () => void;
  onCheckout: () => void;
}

function OrderSummary({ plan, planCycle, domain, formatPrice, onRemovePlan, onRemoveDomain, onCheckout }: OrderSummaryProps) {
  const planAmt   = plan   ? planPrice(plan, planCycle) : 0;
  const domainAmt = domain ? domain.price : 0;
  const total     = planAmt + domainAmt;
  const hasItems  = !!plan || !!domain;

  const content = (
    <>
      <div className="flex items-center gap-2 mb-4">
        <Receipt size={15} className="text-[#701AFE]" />
        <h3 className="text-[13px] font-bold text-black uppercase tracking-wider">Order Summary</h3>
      </div>

      {!hasItems ? (
        <div className="flex flex-col items-center justify-center py-5 text-center">
          <ShoppingCart size={24} className="text-gray-300 mb-2" />
          <p className="text-[12px] text-gray-400 leading-relaxed">No items yet.<br/>Select a plan to begin.</p>
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          {plan && (
            <div className="flex items-start justify-between gap-2 p-2.5 bg-white rounded-xl border border-gray-200">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-black truncate">{plan.name}</p>
                <p className="text-[11px] text-gray-400">{CYCLE_LABELS[planCycle]}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[12px] font-bold text-black">{formatPrice(planAmt)}</span>
                <button onClick={onRemovePlan} className="w-5 h-5 rounded-full bg-gray-100 hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-gray-400 transition-colors">
                  <X size={10} />
                </button>
              </div>
            </div>
          )}
          {domain && (
            <div className="flex items-start justify-between gap-2 p-2.5 bg-white rounded-xl border border-gray-200">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-black truncate">{domain.fullName}</p>
                <p className="text-[11px] text-gray-400">Domain · 1 Year</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[12px] font-bold text-black">{formatPrice(domainAmt)}</span>
                <button onClick={onRemoveDomain} className="w-5 h-5 rounded-full bg-gray-100 hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-gray-400 transition-colors">
                  <X size={10} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {hasItems && (
        <div className="border-t border-gray-200 pt-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-gray-600">Subtotal</span>
            <span className="text-[16px] font-extrabold text-black">{formatPrice(total)}</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5 text-right">{CYCLE_LABELS[planCycle]} billing</p>
        </div>
      )}

      <button
        onClick={onCheckout}
        disabled={!hasItems}
        className={`w-full py-3 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 transition-all ${
          hasItems
            ? "bg-[#701AFE] text-white hover:bg-[#5e14d4] shadow-lg shadow-[#701AFE]/20 active:scale-[0.98]"
            : "bg-gray-100 text-gray-400 cursor-not-allowed"
        }`}
      >
        <ShoppingCart size={14} />
        {hasItems ? "Continue to Checkout" : "Select a plan to continue"}
      </button>

      {hasItems && (
        <p className="text-[11px] text-gray-400 text-center mt-2.5 flex items-center justify-center gap-1">
          <Lock size={10} /> Secure · 30-day money-back
        </p>
      )}
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <div className="sticky top-20 bg-[#F8F9FA] border border-gray-200 rounded-2xl p-4">
          {content}
        </div>
      </div>

      {/* Mobile bottom bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-gray-200 bg-white shadow-2xl">
        {hasItems ? (
          <div className="flex items-center gap-3 px-4 py-3 max-w-lg mx-auto">
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-black truncate">
                {plan?.name}{domain ? (plan ? ` + ${domain.fullName}` : domain.fullName) : ""}
              </p>
              <p className="text-[11px] text-[#701AFE] font-semibold">{formatPrice(total)} total</p>
            </div>
            <button onClick={onCheckout}
              className="shrink-0 px-5 py-2.5 bg-[#701AFE] text-white text-[13px] font-bold rounded-xl hover:bg-[#5e14d4] shadow-lg shadow-[#701AFE]/20 transition-all flex items-center gap-1.5">
              <ShoppingCart size={13} /> Checkout
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
            <p className="text-[12px] text-gray-400 flex items-center gap-1.5"><ShoppingCart size={13} /> Select a plan to continue</p>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OrderFlow() {
  const [, navigate] = useLocation();
  const { addItem, removeItem } = useCart();
  const { formatPrice } = useCurrency();

  // Wizard state
  const [wizardStep,      setWizardStep]      = useState(0);
  const [flow,            setFlow]            = useState<Flow | null>(null);
  const [hostingSubStep,  setHostingSubStep]  = useState<HostingSubStep>("groups");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Plan selection
  const [planCyclesMap, setPlanCyclesMap] = useState<Record<string, BillingCycle>>({});
  const [selectedPlan,  setSelectedPlan]  = useState<Plan | null>(null);

  // Domain cart
  const [cartDomain, setCartDomainState] = useState<CartDomain | null>(loadDomainFromStorage);
  function setCartDomain(d: CartDomain | null) {
    setCartDomainState(d);
    if (d) localStorage.setItem(DOMAIN_STORAGE_KEY, JSON.stringify(d));
    else   localStorage.removeItem(DOMAIN_STORAGE_KEY);
  }

  // Domain association (step 3)
  const [domainMode,    setDomainMode]    = useState<DomainMode | null>(null);
  const [domainQuery,   setDomainQuery]   = useState("");
  const [domainChecking,setDomainChecking]= useState(false);
  const [domainResults, setDomainResults] = useState<TldResult[] | null>(null);
  const [existingDomain,setExistingDomain]= useState("");
  const [domainError,   setDomainError]   = useState("");
  const domainInputRef = useRef<HTMLInputElement>(null);

  // Register domain flow
  const [regQuery,    setRegQuery]    = useState("");
  const [regChecking, setRegChecking] = useState(false);
  const [regResults,  setRegResults]  = useState<TldResult[] | null>(null);
  const [regError,    setRegError]    = useState("");
  const regInputRef = useRef<HTMLInputElement>(null);

  // Transfer
  const [transferDomain, setTransferDomain] = useState("");
  const [eppCode,        setEppCode]        = useState("");
  const [transferError,  setTransferError]  = useState("");

  // Copy link feedback
  const [copiedPlanId, setCopiedPlanId] = useState<string | null>(null);

  // Progress step mapping
  // step 0 = category, step 1 = group selection, step 2 = plan, step 3 = domain
  // For domain/transfer flows, step 1 = main flow
  const progressStep = (() => {
    if (wizardStep === 0) return 0;
    if (flow === "hosting") {
      if (hostingSubStep === "groups") return 1;
      if (hostingSubStep === "plans")  return 2;
      return 3; // domain association
    }
    return 1;
  })();

  // ── API Queries ───────────────────────────────────────────────────────────

  const { data: productGroups = [], isLoading: groupsLoading } = useQuery<ProductGroup[]>({
    queryKey: ["public-product-groups"],
    queryFn: async () => {
      const r = await fetch("/api/product-groups");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: flow === "hosting",
    staleTime: 120_000,
  });

  const { data: allPlans = [], isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["order-plans"],
    queryFn: async () => {
      const r = await fetch("/api/packages", {
        headers: { Authorization: `Bearer ${tok() ?? ""}` },
      });
      if (!r.ok) throw new Error("Failed");
      const plans = await r.json();
      return plans.map((p: any) => ({
        ...p,
        price:           Number(p.price)           || 0,
        yearlyPrice:     p.yearlyPrice     ? Number(p.yearlyPrice)     : null,
        quarterlyPrice:  p.quarterlyPrice  ? Number(p.quarterlyPrice)  : null,
        semiannualPrice: p.semiannualPrice ? Number(p.semiannualPrice) : null,
        renewalPrice:    p.renewalPrice    ? Number(p.renewalPrice)    : null,
      }));
    },
    enabled: flow === "hosting" && hostingSubStep === "plans",
    staleTime: 60_000,
  });

  const { data: tldPricing = [] } = useQuery<TldPricing[]>({
    queryKey: ["tld-pricing"],
    queryFn: async () => {
      const r = await fetch("/api/domains/pricing");
      return r.json();
    },
    enabled: flow === "domain" || wizardStep === 3,
    staleTime: 300_000,
  });

  // Plans for selected group (VPS excluded from hosting groups)
  const displayPlans = selectedGroupId
    ? allPlans.filter(p => p.groupId === selectedGroupId && Number(p.price) > 0)
    : [];

  function getCycle(planId: string): BillingCycle {
    return planCyclesMap[planId] ?? "monthly";
  }

  // ── Domain availability ───────────────────────────────────────────────────

  async function checkAvailability(
    name: string,
    setChecking: (v: boolean) => void,
    setResults:  (v: TldResult[]) => void,
    setErr:      (v: string) => void,
  ) {
    const clean = cleanName(name);
    if (!clean || clean.length < 2) { setErr("Please enter a valid domain name."); return; }
    setErr(""); setChecking(true); setResults([]);

    const token = tok();
    if (token) {
      try {
        const r    = await fetch(`/api/domains/availability?domain=${encodeURIComponent(clean)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await r.json();
        if (!r.ok) { setErr(data.error || "Failed to check."); setChecking(false); return; }
        setResults(data.results ?? []);
      } catch { setErr("Network error. Please try again."); }
    } else {
      setResults(tldPricing.filter(t => t.registrationPrice > 0).map(t => ({
        tld: t.tld, available: true, rdapStatus: "unknown",
        registrationPrice: Number(t.registrationPrice),
        register2YearPrice: t.register2YearPrice,
        register3YearPrice: t.register3YearPrice,
        renewalPrice: Number(t.renewalPrice),
      })));
    }
    setChecking(false);
  }

  // ── Navigation helpers ────────────────────────────────────────────────────

  function goToCheckout(dest: string) {
    if (tok()) navigate(dest);
    else {
      sessionStorage.setItem("order_redirect", dest);
      navigate(`/register?next=${encodeURIComponent(dest)}`);
    }
  }

  // ── Cart actions ──────────────────────────────────────────────────────────

  function handleSelectPlan(plan: Plan) {
    const cycle = getCycle(plan.id);
    if (selectedPlan) removeItem(selectedPlan.id);
    addItem({
      planId: plan.id, planName: plan.name, billingCycle: cycle,
      monthlyPrice:    plan.price,
      quarterlyPrice:  plan.quarterlyPrice  ?? undefined,
      semiannualPrice: plan.semiannualPrice ?? undefined,
      yearlyPrice:     plan.yearlyPrice     ?? undefined,
      renewalPrice:    plan.renewalPrice    ?? undefined,
      renewalEnabled:  plan.renewalEnabled,
    });
    setSelectedPlan(plan);
    setWizardStep(3);
  }

  function handleRemovePlan() {
    if (selectedPlan) removeItem(selectedPlan.id);
    setSelectedPlan(null);
    setHostingSubStep("plans");
    setWizardStep(2);
  }

  function handleCheckout() {
    if (!selectedPlan && !cartDomain) return;
    if (flow === "domain" || (!selectedPlan && cartDomain)) {
      const name = cartDomain?.fullName || "";
      sessionStorage.setItem("domain_search", name);
      goToCheckout("/client/domains");
    } else {
      goToCheckout("/client/cart");
    }
  }

  function handleCopyLink(planId: string) {
    const link = `${window.location.origin}/order/add/${planId}`;
    copyToClipboard(link);
    setCopiedPlanId(planId);
    setTimeout(() => setCopiedPlanId(null), 2000);
  }

  // ── Transfer submit ───────────────────────────────────────────────────────

  function handleTransferSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!transferDomain.includes(".")) { setTransferError("Enter a valid domain, e.g. example.com"); return; }
    if (!eppCode.trim()) { setTransferError("EPP/Auth code is required."); return; }
    setTransferError("");
    sessionStorage.setItem("transfer_domain", transferDomain);
    sessionStorage.setItem("transfer_epp",    eppCode);
    goToCheckout("/client/domains?tab=transfers");
  }

  // ── Sidebar visibility ────────────────────────────────────────────────────

  const showSidebar  = wizardStep >= 2 && flow === "hosting";
  const currentCycle = selectedPlan ? getCycle(selectedPlan.id) : "monthly";

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 0 — Category Selection
  // ─────────────────────────────────────────────────────────────────────────

  function renderStep0() {
    const cards = [
      {
        id: "hosting" as Flow, popular: true,
        icon: (
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
            <rect x="2" y="6"  width="28" height="8" rx="3" fill={P} fillOpacity=".12"/>
            <rect x="2" y="18" width="28" height="8" rx="3" fill={P} fillOpacity=".12"/>
            <rect x="6" y="8.5"  width="3" height="3" rx="1.5" fill={P}/>
            <rect x="11" y="8.5" width="3" height="3" rx="1.5" fill={P}/>
            <rect x="6" y="20.5"  width="3" height="3" rx="1.5" fill={P}/>
            <rect x="11" y="20.5" width="3" height="3" rx="1.5" fill={P}/>
            <circle cx="24" cy="10" r="2" fill={P}/>
            <circle cx="24" cy="22" r="2" fill={P}/>
          </svg>
        ),
        title: "Web Hosting",
        subtitle: "Shared, WordPress & Reseller hosting solutions.",
        bullets: ["cPanel & WHM included", "Free SSL Certificate", "NVMe SSD Storage", "99.9% Uptime Guarantee"],
        cta: "View Plans",
      },
      {
        id: "domain" as Flow, popular: false,
        icon: <Globe size={28} strokeWidth={1.5} style={{ color: P }} />,
        title: "Register New Domain",
        subtitle: "Find the perfect name for your business.",
        bullets: ["50+ domain extensions", "WHOIS privacy included", "Auto-renewal options", "Full DNS management"],
        cta: "Search Domain",
      },
      {
        id: "transfer" as Flow, popular: false,
        icon: <ArrowRightLeft size={26} strokeWidth={1.5} style={{ color: P }} />,
        title: "Transfer Domain",
        subtitle: "Move your domain to Noehost easily.",
        bullets: ["Free 1-year extension", "Keep your existing domain", "Easy EPP code transfer", "Best PKR rates"],
        cta: "Start Transfer",
      },
    ];

    return (
      <motion.div key="step0" {...fade}>
        <SectionTitle
          title="What do you need today?"
          sub="Start with a category. Our wizard will guide you to the perfect plan."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(card => (
            <button
              key={card.id}
              onClick={() => {
                setFlow(card.id);
                setHostingSubStep("groups");
                setSelectedGroupId(null);
                setWizardStep(1);
              }}
              className={`relative group text-left rounded-2xl p-6 sm:p-7 flex flex-col transition-all duration-200 focus:outline-none
                ${card.popular
                  ? "bg-white border-2 border-[#701AFE] shadow-lg shadow-[#701AFE]/10"
                  : "bg-white border border-gray-200 hover:border-[#701AFE] hover:shadow-lg hover:shadow-[#701AFE]/8"}`}
            >
              {card.popular && (
                <div className="absolute -top-3 left-6 flex items-center gap-1 bg-[#701AFE] text-white text-[10px] font-bold px-3 py-1 rounded-full shadow">
                  <Star size={8} strokeWidth={3} /> MOST ORDERED
                </div>
              )}

              <div className="w-12 h-12 rounded-xl bg-[#701AFE]/8 flex items-center justify-center mb-4 group-hover:bg-[#701AFE]/14 transition-colors">
                {card.icon}
              </div>

              <h3 className="text-[16px] font-bold text-black mb-1 leading-tight">{card.title}</h3>
              <p className="text-[12px] text-gray-400 mb-4 leading-relaxed">{card.subtitle}</p>

              <ul className="space-y-2 mb-5 flex-1">
                {card.bullets.map(b => (
                  <li key={b} className="flex items-center gap-2 text-[12px] text-gray-600">
                    <Check size={12} strokeWidth={2.5} className="text-[#701AFE] shrink-0" /> {b}
                  </li>
                ))}
              </ul>

              <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#701AFE] mt-auto group-hover:gap-2.5 transition-all">
                {card.cta} <ChevronRight size={14} strokeWidth={2.5} />
              </div>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mt-6 text-[12px] text-gray-400">
          <span className="flex items-center gap-1.5"><Lock size={11} /> Secure Checkout</span>
          <span className="hidden sm:inline">·</span>
          <span>30-day money-back guarantee</span>
          <span className="hidden sm:inline">·</span>
          <span>No setup fees</span>
        </div>
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1 — Hosting Group Selection
  // ─────────────────────────────────────────────────────────────────────────

  function renderHostingGroups() {
    // Only show web hosting groups (exclude VPS from this page since VPS has its own flow)
    const webGroups = productGroups.filter(g =>
      g.isActive && g.slug !== "vps-hosting"
    );

    return (
      <motion.div key="hosting-groups" {...fade}>
        <BackLink onClick={() => { setWizardStep(0); setFlow(null); }} />
        <SectionTitle
          title="Choose Hosting Type"
          sub="Select the hosting solution that fits your needs. All plans include free SSL, cPanel access, and 99.9% uptime."
        />

        {groupsLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={28} className="animate-spin text-[#701AFE]" />
            <p className="text-sm text-gray-400">Loading hosting options…</p>
          </div>
        ) : (
          <div className={`grid gap-5 ${
            webGroups.length === 1 ? "max-w-sm mx-auto" :
            webGroups.length === 2 ? "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto" :
            "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          }`}>
            {webGroups.map((group, idx) => {
              const meta   = GROUP_META[group.slug] || GROUP_META["shared-hosting"];
              const isMain = idx === 0;

              return (
                <button
                  key={group.id}
                  onClick={() => {
                    setSelectedGroupId(group.id);
                    setHostingSubStep("plans");
                    setWizardStep(2);
                  }}
                  className={`relative group text-left rounded-2xl p-6 flex flex-col transition-all duration-200 focus:outline-none
                    ${isMain
                      ? "bg-white border-2 border-[#701AFE] shadow-xl shadow-[#701AFE]/12"
                      : "bg-white border border-gray-200 hover:border-[#701AFE] hover:shadow-lg hover:shadow-[#701AFE]/8"}`}
                >
                  {meta.badge && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap flex items-center gap-1 bg-[#701AFE] text-white text-[11px] font-bold px-3.5 py-1 rounded-full shadow">
                      <Star size={9} strokeWidth={3} /> {meta.badge}
                    </div>
                  )}

                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${
                    isMain ? "bg-[#701AFE]/12" : "bg-[#701AFE]/8 group-hover:bg-[#701AFE]/14"
                  }`} style={{ color: P }}>
                    {meta.icon}
                  </div>

                  <h3 className="text-[17px] font-bold text-black mb-1 leading-tight">{group.name}</h3>
                  <p className="text-[12px] text-gray-400 mb-4 leading-relaxed">{meta.tagline}</p>

                  <ul className="space-y-2 mb-5 flex-1">
                    {meta.bullets.map(b => (
                      <li key={b} className="flex items-center gap-2 text-[12px] text-gray-600">
                        <Check size={12} strokeWidth={2.5} className="text-[#701AFE] shrink-0" /> {b}
                      </li>
                    ))}
                  </ul>

                  <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#701AFE] mt-auto group-hover:gap-2.5 transition-all">
                    View Plans <ChevronRight size={14} strokeWidth={2.5} />
                  </div>
                </button>
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

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2 — Plan Selection (for selected group)
  // ─────────────────────────────────────────────────────────────────────────

  function renderHostingPlans() {
    const selectedGroup = productGroups.find(g => g.id === selectedGroupId);
    const groupName     = selectedGroup?.name ?? "Hosting";
    const groupSlug     = selectedGroup?.slug ?? "shared-hosting";
    const isWordPress   = groupSlug === "wordpress-hosting";
    const isReseller    = groupSlug === "reseller-hosting";

    return (
      <motion.div key="hosting-plans" {...fade}>
        <BackLink
          onClick={() => { setHostingSubStep("groups"); setWizardStep(1); }}
          label={`← Back to Hosting Types`}
        />
        <SectionTitle
          title={groupName + " Plans"}
          sub={
            isWordPress  ? "Managed WordPress with LiteSpeed, LSCache & daily backups." :
            isReseller   ? "Start your reseller hosting business with WHM & white-label branding." :
            "Reliable shared hosting with cPanel, free SSL & NVMe SSD storage."
          }
        />

        {plansLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={28} className="animate-spin text-[#701AFE]" />
            <p className="text-sm text-gray-400">Loading plans…</p>
          </div>
        ) : displayPlans.length === 0 ? (
          <div className="text-center py-20">
            <Server size={36} className="mx-auto mb-3 text-gray-200" />
            <p className="text-gray-400 text-sm">No plans available. Please check back soon.</p>
          </div>
        ) : (
          <div className={`grid gap-4 sm:gap-5 ${
            displayPlans.length === 1 ? "max-w-xs mx-auto" :
            displayPlans.length === 2 ? "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto" :
            "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          }`}>
            {displayPlans.map((plan, idx) => {
              const isPopular  = displayPlans.length > 1 && idx === Math.floor(displayPlans.length / 2);
              const cycle      = getCycle(plan.id);
              const price      = planPrice(plan, cycle);
              const cycles     = planCycles(plan);
              const isSelected = selectedPlan?.id === plan.id;

              return (
                <div key={plan.id} className={`relative flex flex-col rounded-2xl bg-white transition-all ${
                  isPopular
                    ? "border-2 border-[#701AFE] shadow-xl shadow-[#701AFE]/12"
                    : "border border-gray-200 hover:border-[#701AFE]/60 hover:shadow-lg"
                }`}>

                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap flex items-center gap-1 bg-[#701AFE] text-white text-[11px] font-bold px-3.5 py-1 rounded-full shadow">
                      <Star size={9} strokeWidth={3} /> MOST POPULAR
                    </div>
                  )}

                  {/* Header */}
                  <div className={`px-5 pt-6 pb-4 border-b ${isPopular ? "border-[#701AFE]/20" : "border-gray-100"}`}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="text-[16px] font-bold text-black leading-tight">{plan.name}</h3>
                      {isPopular && <Pill label="Best Value" color="purple" />}
                    </div>

                    {/* Billing cycle selector */}
                    {cycles.length > 1 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {cycles.map(c => (
                          <button key={c}
                            onClick={() => setPlanCyclesMap(prev => ({ ...prev, [plan.id]: c }))}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                              cycle === c
                                ? "bg-[#701AFE] text-white border-[#701AFE]"
                                : "bg-gray-50 text-gray-500 border-gray-200 hover:border-[#701AFE]/50"
                            }`}>
                            {CYCLE_LABELS[c]}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Price */}
                    <div className="flex items-end gap-1">
                      <span className="text-[34px] sm:text-[38px] font-extrabold text-black leading-none">
                        {formatPrice(Number(price) || 0)}
                      </span>
                      <span className="text-[13px] text-gray-400 mb-1">{CYCLE_SUFFIX[cycle]}</span>
                    </div>
                    {cycle !== "monthly" && (
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {formatPrice(Number(plan.price) || 0)}/mo billed {CYCLE_LABELS[cycle].toLowerCase()}
                      </p>
                    )}
                    {plan.yearlyPrice && cycle === "monthly" && (
                      <p className="text-[11px] text-green-600 mt-0.5 font-medium">
                        Save up to {Math.round((1 - Number(plan.yearlyPrice) / (Number(plan.price) * 12)) * 100)}% yearly
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <div className="px-5 py-4 flex-1">
                    <ul className="space-y-2.5">
                      <Feature text={`${plan.diskSpace || "Unlimited"} Storage`} />
                      <Feature text={`${plan.bandwidth || "Unlimited"} Bandwidth`} />
                      {isReseller ? (
                        <>
                          <Feature text={`${plan.emailAccounts ?? "Unlimited"} cPanel Accounts`} />
                          <Feature text="WHM Control Panel" />
                        </>
                      ) : (
                        <>
                          <Feature text={`${plan.emailAccounts ?? "Unlimited"} Email Accounts`} />
                          <Feature text={`${plan.databases ?? "Unlimited"} Databases`} />
                        </>
                      )}
                      {(plan.features ?? []).slice(0, isWordPress ? 4 : 3).map(f => (
                        <Feature key={f} text={f} />
                      ))}
                    </ul>
                  </div>

                  {/* CTA buttons */}
                  <div className="px-5 pb-5 space-y-2">
                    <button
                      onClick={() => handleSelectPlan(plan)}
                      disabled={isSelected}
                      className={`w-full py-3 rounded-xl text-[14px] font-bold transition-all flex items-center justify-center gap-2 ${
                        isSelected
                          ? "bg-green-50 text-green-700 border-2 border-green-200"
                          : isPopular
                          ? "bg-[#701AFE] text-white hover:bg-[#5e14d4] shadow-lg shadow-[#701AFE]/20 active:scale-[0.98]"
                          : "bg-white text-[#701AFE] border-2 border-[#701AFE] hover:bg-[#701AFE]/5 active:scale-[0.98]"
                      }`}>
                      {isSelected
                        ? <><CheckCircle2 size={15} /> Plan Selected</>
                        : <><ShoppingCart size={15} /> Order Now</>}
                    </button>

                    {/* Direct link copy button */}
                    <button
                      onClick={() => handleCopyLink(plan.id)}
                      className="w-full py-2 rounded-xl text-[12px] font-medium border border-gray-200 text-gray-500 hover:border-[#701AFE]/40 hover:text-[#701AFE] transition-all flex items-center justify-center gap-1.5">
                      {copiedPlanId === plan.id ? (
                        <><CheckCircle2 size={12} className="text-green-500" /> Link Copied!</>
                      ) : (
                        <><Copy size={12} /> Copy Direct Link</>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-[12px] text-gray-400 mt-5 flex items-center justify-center gap-1.5">
          <Shield size={12} /> 30-day money-back guarantee on all plans
        </p>
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1 — Register Domain Flow
  // ─────────────────────────────────────────────────────────────────────────

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

        <form onSubmit={handleSearch} className="max-w-xl mx-auto mb-7">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input ref={regInputRef} value={regQuery}
                onChange={e => { setRegQuery(e.target.value); setRegResults(null); }}
                placeholder="yourname, mybusiness, brandname…"
                className="w-full pl-11 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-[#701AFE]/30 focus:border-[#701AFE] transition-all"
                autoFocus />
            </div>
            <button type="submit" disabled={regChecking || !regQuery.trim()}
              className="w-full sm:w-auto px-6 py-3.5 bg-[#701AFE] text-white rounded-xl text-[14px] font-bold hover:bg-[#5e14d4] disabled:opacity-60 shadow-md shadow-[#701AFE]/20 transition-all flex items-center justify-center gap-2">
              {regChecking ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Search
            </button>
          </div>
          {regError && <p className="mt-2 text-[13px] text-red-500 flex items-center gap-1.5"><AlertCircle size={13} /> {regError}</p>}
        </form>

        {!regResults && !regChecking && tldPricing.length > 0 && (
          <div className="max-w-xl mx-auto text-center">
            <p className="text-[11px] text-gray-400 mb-2.5 uppercase tracking-wider font-semibold">Popular Extensions</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {tldPricing.slice(0, 8).map(t => (
                <span key={t.tld} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[12px] text-gray-600">
                  <span className="font-semibold">{t.tld}</span>
                  <span className="text-gray-400 ml-1">{formatPrice(Number(t.registrationPrice))}/yr</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {regChecking && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Loader2 size={22} className="animate-spin text-[#701AFE]" />
            <p className="text-[13px] text-gray-400">Checking availability…</p>
          </div>
        )}

        {regResults && !regChecking && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto space-y-2">
            {regResults.filter(r => r.registrationPrice > 0).slice(0, 8).map(r => (
              <div key={r.tld}
                className={`flex items-center justify-between px-4 py-3.5 bg-white rounded-xl border transition-all ${
                  r.available ? "border-gray-200 hover:border-[#701AFE]/40" : "border-gray-100 opacity-60"}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${r.available ? "bg-green-400" : "bg-red-400"}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-0.5 flex-wrap">
                      <span className="text-[14px] font-bold text-black">{searchedName}</span>
                      <span className="text-[14px] font-bold text-[#701AFE]">{r.tld}</span>
                    </div>
                    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
                      r.available ? "text-green-600" : "text-red-400"}`}>
                      {r.available ? "Available" : "Taken"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <span className="text-[13px] sm:text-[14px] font-bold text-black">{formatPrice(Number(r.registrationPrice))}/yr</span>
                  {r.available && (
                    <button
                      onClick={() => {
                        setCartDomain({ fullName: `${searchedName}${r.tld}`, price: r.registrationPrice });
                        handleCheckout();
                      }}
                      className="px-3.5 py-1.5 bg-[#701AFE] text-white rounded-lg text-[12px] font-bold hover:bg-[#5e14d4] transition-all">
                      Add
                    </button>
                  )}
                </div>
              </div>
            ))}
            <p className="text-center text-[11px] text-gray-400 pt-1">
              {tok() ? "Availability checked in real-time via RDAP" : "Sign in for real-time availability checking"}
            </p>
          </motion.div>
        )}
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1 — Transfer Flow
  // ─────────────────────────────────────────────────────────────────────────

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
              <input value={transferDomain} onChange={e => setTransferDomain(e.target.value)} placeholder="example.com" autoFocus
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-[#701AFE]/30 focus:border-[#701AFE]" />
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">EPP / Authorization Code</label>
            <div className="relative">
              <Key size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={eppCode} onChange={e => setEppCode(e.target.value)} type="text" placeholder="Paste your EPP code here"
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

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3 — Domain Association (after plan selected)
  // ─────────────────────────────────────────────────────────────────────────

  function renderDomainAssociation() {
    const searchedName = domainResults ? cleanName(domainQuery) : "";

    async function handleDomainSearch(e: React.FormEvent) {
      e.preventDefault();
      await checkAvailability(domainQuery, setDomainChecking, setDomainResults, setDomainError);
    }

    return (
      <motion.div key="domain-assoc" {...fade}>
        <BackLink onClick={() => { setWizardStep(2); setDomainMode(null); setDomainResults(null); }} />

        {/* Plan selected success notice */}
        <div className="max-w-md mx-auto mb-7">
          <div className="flex items-center gap-3 px-4 py-3.5 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle2 size={17} className="text-green-500 shrink-0" />
            <div>
              <p className="text-[13px] font-semibold text-green-800">{selectedPlan?.name} added to your cart!</p>
              <p className="text-[12px] text-green-600">Now set up your domain to complete the order.</p>
            </div>
          </div>
        </div>

        <SectionTitle title="Set Up Your Domain" sub="Every hosting plan needs a domain. Choose an option below." />

        {!domainMode && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto mb-5">
            {[
              {
                mode: "register" as DomainMode,
                icon: <Search size={20} style={{ color: P }} />,
                title: "Register a New Domain",
                desc: "Search and register a fresh domain name for your site.",
                badge: "Recommended",
              },
              {
                mode: "existing" as DomainMode,
                icon: <Globe size={20} style={{ color: P }} />,
                title: "Use an Existing Domain",
                desc: "I already own a domain and will point it to Noehost.",
                badge: null,
              },
            ].map(opt => (
              <button key={opt.mode as string} onClick={() => setDomainMode(opt.mode)}
                className="group text-left bg-white border border-gray-200 rounded-2xl p-5 hover:border-[#701AFE] hover:shadow-md hover:shadow-[#701AFE]/8 transition-all focus:outline-none">
                <div className="w-10 h-10 bg-[#701AFE]/8 rounded-xl flex items-center justify-center mb-3 group-hover:bg-[#701AFE]/14 transition-colors">
                  {opt.icon}
                </div>
                {opt.badge && <Pill label={opt.badge} color="purple" />}
                <h3 className="text-[14px] font-bold text-black mt-1.5 mb-1">{opt.title}</h3>
                <p className="text-[12px] text-gray-500 leading-relaxed">{opt.desc}</p>
              </button>
            ))}
            <button onClick={() => goToCheckout("/client/cart")}
              className="sm:col-span-2 w-full py-3 rounded-xl border border-dashed border-gray-300 text-[13px] text-gray-400 hover:border-[#701AFE]/40 hover:text-[#701AFE] transition-all">
              Skip for now — I'll add a domain later
            </button>
          </div>
        )}

        {/* Register sub-step */}
        {domainMode === "register" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto">
            <button onClick={() => { setDomainMode(null); setDomainResults(null); }}
              className="flex items-center gap-1 text-[13px] text-gray-400 hover:text-[#701AFE] mb-4 transition-colors">
              <ArrowLeft size={13} /> Change option
            </button>

            <form onSubmit={handleDomainSearch} className="flex flex-col sm:flex-row gap-2 mb-5">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input ref={domainInputRef} value={domainQuery}
                  onChange={e => { setDomainQuery(e.target.value); setDomainResults(null); }}
                  placeholder="e.g. mybusiness, mystore…" autoFocus
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-[#701AFE]/30 focus:border-[#701AFE]" />
              </div>
              <button type="submit" disabled={domainChecking || !domainQuery.trim()}
                className="w-full sm:w-auto px-5 py-3 bg-[#701AFE] text-white rounded-xl text-[13px] font-bold hover:bg-[#5e14d4] disabled:opacity-60 flex items-center justify-center gap-1.5 transition-all">
                {domainChecking ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Check
              </button>
            </form>

            {domainError && <p className="text-[13px] text-red-500 mb-3 flex items-center gap-1.5"><AlertCircle size={13} /> {domainError}</p>}
            {domainChecking && <div className="text-center py-8"><Loader2 size={20} className="animate-spin text-[#701AFE] mx-auto" /></div>}

            {domainResults && !domainChecking && (
              <div className="space-y-2">
                {domainResults.filter(r => r.registrationPrice > 0).slice(0, 6).map(r => (
                  <div key={r.tld}
                    className={`flex items-center justify-between px-4 py-3 bg-white rounded-xl border transition-all ${
                      r.available ? "border-gray-200 hover:border-[#701AFE]/40" : "border-gray-100 opacity-55"}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${r.available ? "bg-green-400" : "bg-red-400"}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-0.5 flex-wrap">
                          <span className="text-[14px] font-bold text-black">{searchedName}</span>
                          <span className="text-[14px] font-bold text-[#701AFE]">{r.tld}</span>
                        </div>
                        <span className={`text-[11px] font-semibold ${r.available ? "text-green-600" : "text-red-400"}`}>
                          {r.available ? "Available" : "Taken"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      <span className="text-[13px] font-bold text-black">{formatPrice(Number(r.registrationPrice))}/yr</span>
                      {r.available && (
                        <button
                          onClick={() => {
                            setCartDomain({ fullName: `${searchedName}${r.tld}`, price: r.registrationPrice });
                            goToCheckout("/client/cart");
                          }}
                          className="px-3 py-1.5 bg-[#701AFE] text-white rounded-lg text-[12px] font-bold hover:bg-[#5e14d4] transition-all">
                          Add + Checkout
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Existing domain sub-step */}
        {domainMode === "existing" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto">
            <button onClick={() => { setDomainMode(null); setExistingDomain(""); setDomainError(""); }}
              className="flex items-center gap-1 text-[13px] text-gray-400 hover:text-[#701AFE] mb-4 transition-colors">
              <ArrowLeft size={13} /> Change option
            </button>

            <div className="bg-[#faf8ff] border border-[#e8e0ff] rounded-xl p-4 mb-4">
              <p className="text-[12px] text-[#701AFE] font-semibold mb-1">Point your domain to Noehost</p>
              <p className="text-[12px] text-gray-500">Update your domain's nameservers to:</p>
              <div className="mt-2 space-y-1 font-mono text-[12px] text-gray-700">
                <p className="bg-white rounded px-3 py-1.5 border border-gray-200">ns1.noehost.com</p>
                <p className="bg-white rounded px-3 py-1.5 border border-gray-200">ns2.noehost.com</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Your Domain Name</label>
              <div className="relative">
                <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={existingDomain}
                  onChange={e => { setExistingDomain(e.target.value); setDomainError(""); }}
                  placeholder="yourdomain.com" autoFocus
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-[#701AFE]/30 focus:border-[#701AFE]" />
              </div>
              {domainError && <p className="mt-1.5 text-[12px] text-red-500 flex items-center gap-1"><AlertCircle size={12} /> {domainError}</p>}
            </div>

            <button
              onClick={() => {
                if (!existingDomain.includes(".")) { setDomainError("Please enter a valid domain name, e.g. yourdomain.com"); return; }
                sessionStorage.setItem("hosting_domain", existingDomain);
                goToCheckout("/client/cart");
              }}
              className="w-full py-3.5 bg-[#701AFE] text-white rounded-xl text-[14px] font-bold hover:bg-[#5e14d4] shadow-lg shadow-[#701AFE]/20 transition-all flex items-center justify-center gap-2">
              Continue to Checkout <ChevronRight size={16} />
            </button>
          </motion.div>
        )}
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render router
  // ─────────────────────────────────────────────────────────────────────────

  function renderMain() {
    if (wizardStep === 0) return renderStep0();

    if (flow === "domain")   return renderRegisterDomain();
    if (flow === "transfer") return renderTransfer();

    if (flow === "hosting") {
      if (wizardStep === 1) return renderHostingGroups();
      if (wizardStep === 2) return renderHostingPlans();
      if (wizardStep === 3) return renderDomainAssociation();
    }

    return renderStep0();
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <span className="text-[22px] font-extrabold" style={{ color: P }}>Noehost</span>
          <span className="text-[22px] font-extrabold text-gray-800"> Order</span>
        </div>

        <ProgressBar step={progressStep} />

        <div className="flex gap-6 items-start">
          {/* Main content */}
          <div className={showSidebar ? "flex-1 min-w-0" : "w-full"}>
            <AnimatePresence mode="wait">
              {renderMain()}
            </AnimatePresence>
          </div>

          {/* Order summary sidebar */}
          {showSidebar && (
            <div className="w-64 shrink-0">
              <OrderSummary
                plan={selectedPlan}
                planCycle={currentCycle}
                domain={cartDomain}
                formatPrice={formatPrice}
                onRemovePlan={handleRemovePlan}
                onRemoveDomain={() => setCartDomain(null)}
                onCheckout={handleCheckout}
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile padding for bottom bar */}
      {showSidebar && <div className="lg:hidden h-20" />}
    </div>
  );
}
