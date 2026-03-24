/**
 * /client/orders/new  —  4-Step Order Wizard
 * Step 0: Choose Service  |  Step 1: Plan & Billing  |  Step 2: Domain Setup  |  Step 3: Review & Payment
 */
import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence, type HTMLMotionProps } from "framer-motion";
import {
  Server, Globe, ArrowRightLeft, Check, X, Search, Loader2, Star,
  ArrowLeft, ShoppingCart, Receipt, HardDrive, Wifi, Mail, Database,
  Lock, AlertCircle, CheckCircle2, Key, Shield, Zap, Users, ChevronRight,
  CreditCard, Tag, Wallet, Building2, Landmark, Bitcoin, Smartphone,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCart, type BillingCycle, CYCLE_LABELS, CYCLE_SUFFIX } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyProvider";

// ─── Types ────────────────────────────────────────────────────────────────────

type ServiceType = "hosting" | "domain" | "transfer";
type HostingTab  = "shared" | "reseller" | "vps" | "wordpress";
type DomainMode  = "register" | "transfer" | "existing" | null;

interface Plan {
  id: string; name: string; description: string | null;
  price: number; yearlyPrice: number | null; quarterlyPrice: number | null;
  semiannualPrice: number | null; renewalPrice: number | null; renewalEnabled: boolean;
  billingCycle: string; diskSpace: string; bandwidth: string;
  emailAccounts: number | null; databases: number | null; features: string[];
}

interface TldResult {
  tld: string; available: boolean;
  registrationPrice: number; register2YearPrice: number | null;
  register3YearPrice: number | null; renewalPrice: number;
}

interface TldPricing {
  tld: string; registrationPrice: number; register2YearPrice: number | null;
  register3YearPrice: number | null; renewalPrice: number;
}

interface PaymentMethod {
  id: string; name: string; type: string; description: string | null;
  isSandbox: boolean;
  publicSettings: {
    bankName?: string; accountTitle?: string; accountNumber?: string; iban?: string;
    mobileNumber?: string; paypalEmail?: string; walletAddress?: string;
    cryptoType?: string; publishableKey?: string; instructions?: string;
  };
}

interface CartDomain { fullName: string; price: number; mode: DomainMode; }

// ─── Constants ────────────────────────────────────────────────────────────────

const P      = "#701AFE";
const PSHADOW= `0 4px 16px rgba(112,26,254,0.25)`;
const DOMAIN_KEY = "order_wizard_domain";

function tok() { return localStorage.getItem("token") ?? ""; }

function apiFetch(url: string, opts?: RequestInit) {
  return fetch(url, { ...opts, headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json", ...opts?.headers } });
}

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
  if (n.includes("wordpress") || n.includes("wp")) return "wordpress";
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

function saveDomain(d: CartDomain | null) {
  if (d) localStorage.setItem(DOMAIN_KEY, JSON.stringify(d));
  else   localStorage.removeItem(DOMAIN_KEY);
}

function savingsLabel(monthly: number, price: number, months: number): string | null {
  const fullPrice = monthly * months;
  if (fullPrice <= price || months < 2) return null;
  const pct = Math.round((1 - price / fullPrice) * 100);
  return pct > 0 ? `Save ${pct}%` : null;
}

// ─── Payment method icons ─────────────────────────────────────────────────────

function PayIcon({ type }: { type: string }) {
  switch (type) {
    case "jazzcash":    return <Smartphone size={20} style={{ color: "#f0612e" }}/>;
    case "easypaisa":  return <Smartphone size={20} style={{ color: "#3bb54a" }}/>;
    case "bank_transfer": return <Landmark size={20} style={{ color: "#1d4ed8" }}/>;
    case "stripe":     return <CreditCard size={20} style={{ color: "#635bff" }}/>;
    case "paypal":     return <Wallet size={20} style={{ color: "#003087" }}/>;
    case "crypto":     return <Bitcoin size={20} style={{ color: "#f7931a" }}/>;
    case "manual":     return <Building2 size={20} className="text-gray-500"/>;
    default:           return <CreditCard size={20} className="text-gray-400"/>;
  }
}

// ─── Animation ───────────────────────────────────────────────────────────────

type MotionBase = Omit<HTMLMotionProps<"div">, "ref"|"children"|"key"|"className"|"style">;
const fade: MotionBase = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.18 } };
const slideDown: MotionBase = { initial: { opacity: 0, y: -8, height: 0 }, animate: { opacity: 1, y: 0, height: "auto" }, exit: { opacity: 0, y: -8, height: 0 }, transition: { duration: 0.2 } };

// ─── Step Bar ─────────────────────────────────────────────────────────────────

const STEP_LABELS = ["Choose Service", "Plan & Billing", "Domain Setup", "Review & Pay"];

function StepBar({ active }: { active: number }) {
  return (
    <div className="overflow-x-auto -mx-2 px-2 mb-8">
      <div className="flex items-start justify-center min-w-[360px]">
        {STEP_LABELS.map((label, i) => {
          const done = i < active;
          const cur  = i === active;
          return (
            <div key={label} className="flex items-start">
              <div className="flex flex-col items-center w-[76px] sm:w-24">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold transition-all duration-300 ${
                  done ? "bg-[#701AFE] text-white" : cur ? "bg-[#701AFE] text-white ring-4 ring-[#701AFE]/20" : "bg-gray-100 text-gray-400"
                }`}>
                  {done ? <Check size={14} strokeWidth={2.5}/> : i + 1}
                </div>
                <span className={`mt-1.5 text-[10px] sm:text-[11px] font-semibold text-center leading-tight ${
                  cur ? "text-[#701AFE]" : done ? "text-gray-500" : "text-gray-400"
                }`}>{label}</span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`w-8 sm:w-12 h-0.5 mt-4 shrink-0 transition-colors duration-500 ${done ? "bg-[#701AFE]" : "bg-gray-200"}`}/>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Feature row ─────────────────────────────────────────────────────────────

function Feat({ text }: { text: string }) {
  return (
    <li className="flex items-center" style={{ gap: 10 }}>
      <Check size={13} strokeWidth={2.5} style={{ color: P, flexShrink: 0 }}/>
      <span className="text-[13px] text-gray-600">{text}</span>
    </li>
  );
}

// ─── Continue button ──────────────────────────────────────────────────────────

interface ContinueProps { label: string; onClick: () => void; disabled?: boolean; loading?: boolean; }
function ContinueBtn({ label, onClick, disabled, loading }: ContinueProps) {
  return (
    <div className="flex justify-end pt-6 mt-4 border-t border-gray-100">
      <button onClick={onClick} disabled={disabled || loading}
        className="flex items-center gap-2 px-7 py-3 rounded-xl text-[14px] font-bold text-white transition-all active:scale-[0.98]"
        style={disabled || loading ? { background: "#E5E7EB", color: "#9CA3AF", cursor: "not-allowed" } : { background: P, boxShadow: PSHADOW }}>
        {loading && <Loader2 size={15} className="animate-spin"/>}
        {label} {!loading && !disabled && <ChevronRight size={15}/>}
      </button>
    </div>
  );
}

// ─── Order Summary Sidebar ────────────────────────────────────────────────────

interface SummaryProps {
  plan: Plan | null; pendingPlan: Plan | null; cycle: BillingCycle; domain: CartDomain | null;
  step: number; fmt: (n: number) => string;
  onRmPlan: () => void; onRmDom: () => void;
  onContinue: () => void; canContinue: boolean;
  ctaLabel: string;
}

function Summary({ plan, pendingPlan, cycle, domain, step, fmt, onRmPlan, onRmDom, onContinue, canContinue, ctaLabel }: SummaryProps) {
  const activePlan = plan ?? pendingPlan;
  const planAmt    = activePlan ? planPrice(activePlan, cycle) : 0;
  const domAmt     = domain?.price ?? 0;
  const total      = planAmt + domAmt;
  const hasItems   = !!activePlan || !!domain;

  const inner = (
    <div className="p-4">
      <div className="flex items-center gap-2 pb-3 mb-3 border-b border-gray-200">
        <Receipt size={14} style={{ color: P }}/>
        <span className="text-[12px] font-bold text-gray-700 uppercase tracking-wider">Order Summary</span>
      </div>

      <div className="space-y-2 mb-3 min-h-[64px]">
        {!hasItems && (
          <div className="flex flex-col items-center py-5 gap-2">
            <ShoppingCart size={22} className="text-gray-300"/>
            <p className="text-[11px] text-gray-400 text-center">Select a plan to see<br/>your order summary.</p>
          </div>
        )}

        {activePlan && (
          <div className="flex items-start justify-between gap-2 p-2.5 bg-white border border-gray-200 rounded-xl">
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-black truncate">{activePlan.name}</p>
              <p className="text-[11px] text-gray-400">{CYCLE_LABELS[cycle]}</p>
              {!plan && pendingPlan && (
                <p className="text-[10px] mt-0.5 font-semibold" style={{ color: P }}>Confirming…</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[13px] font-extrabold text-black">{fmt(planAmt)}</span>
              {plan && <button onClick={onRmPlan} className="w-4 h-4 rounded-full bg-gray-100 hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-gray-400 transition-colors"><X size={9}/></button>}
            </div>
          </div>
        )}

        {domain && (
          <div className="flex items-start justify-between gap-2 p-2.5 bg-white border border-gray-200 rounded-xl">
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-black truncate">{domain.fullName}</p>
              <p className="text-[11px] text-gray-400">Domain · 1 Year</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {domain.price > 0
                ? <span className="text-[13px] font-extrabold text-black">{fmt(domAmt)}</span>
                : <span className="text-[11px] text-gray-400 font-semibold">Free</span>}
              <button onClick={onRmDom} className="w-4 h-4 rounded-full bg-gray-100 hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-gray-400 transition-colors"><X size={9}/></button>
            </div>
          </div>
        )}
      </div>

      {hasItems && (
        <div className="border-t border-gray-200 pt-3 mb-3">
          <div className="flex justify-between items-center">
            <span className="text-[13px] font-semibold text-gray-500">Total</span>
            <span className="text-[18px] font-extrabold text-black">{fmt(total)}</span>
          </div>
          <p className="text-[10px] text-right text-gray-400 mt-0.5">Billed {CYCLE_LABELS[cycle].toLowerCase()}</p>
        </div>
      )}

      {step >= 1 && (
        <button onClick={onContinue} disabled={!canContinue}
          className="w-full py-3 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          style={canContinue ? { background: P, color: "#fff", boxShadow: PSHADOW } : { background: "#F3F4F6", color: "#9CA3AF", cursor: "not-allowed" }}>
          <ShoppingCart size={13}/>
          {canContinue ? ctaLabel : "Select a plan to continue"}
        </button>
      )}

      {canContinue && (
        <p className="text-[10px] text-gray-400 text-center mt-2 flex items-center justify-center gap-1">
          <Lock size={9}/> 30-day money-back guarantee
        </p>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sticky sidebar */}
      <div className="hidden lg:block">
        <div className="sticky top-20 rounded-2xl border border-gray-200 overflow-hidden" style={{ background: "#FAFAFA" }}>
          {inner}
        </div>
      </div>

      {/* Mobile fixed bottom bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 shadow-xl">
        {hasItems ? (
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-black truncate">{activePlan?.name ?? domain?.fullName}</p>
              <p className="text-[11px] font-semibold" style={{ color: P }}>{fmt(total)}</p>
            </div>
            <button onClick={onContinue} disabled={!canContinue}
              className="shrink-0 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all"
              style={canContinue ? { background: P } : { background: "#E5E7EB", color: "#9CA3AF" }}>
              {ctaLabel}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 px-4 py-3">
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

  // ── Wizard state ──────────────────────────────────────────────────────────
  const [step,       setStep]       = useState<0|1|2|3>(0);
  const [service,    setService]    = useState<ServiceType | null>(null);
  const [hostingTab, setHostingTab] = useState<HostingTab>("shared");

  // Plan & billing
  const [pendingPlan,   setPendingPlan]   = useState<Plan | null>(null);    // clicked but not confirmed
  const [pendingCycle,  setPendingCycle]  = useState<BillingCycle>("monthly");
  const [selectedPlan,  setSelectedPlan]  = useState<Plan | null>(null);    // confirmed & in cart
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>("monthly");

  // Domain
  const [domainMode,  setDomainMode]  = useState<DomainMode>(null);
  const [domainQ,     setDomainQ]     = useState("");
  const [domChecking, setDomChecking] = useState(false);
  const [domResults,  setDomResults]  = useState<TldResult[] | null>(null);
  const [domError,    setDomError]    = useState("");
  const [existingDom, setExistingDom] = useState("");
  const [txDomain,    setTxDomain]    = useState("");
  const [eppCode,     setEppCode]     = useState("");
  const [txError,     setTxError]     = useState("");
  const [cartDomain,  setCartDomainRaw] = useState<CartDomain | null>(loadDomain);

  // Payment
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [promoCode,       setPromoCode]        = useState("");
  const [orderError,      setOrderError]        = useState("");

  function setCartDomain(d: CartDomain | null) { setCartDomainRaw(d); saveDomain(d); }

  // ── Data fetching ─────────────────────────────────────────────────────────

  const { data: allPlans = [], isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["order-plans"],
    queryFn: async () => (await apiFetch("/api/packages")).json(),
    enabled: service === "hosting" && step >= 1,
    staleTime: 60_000,
  });

  const { data: tldPricing = [] } = useQuery<TldPricing[]>({
    queryKey: ["tld-pricing"],
    queryFn: async () => (await fetch("/api/domains/pricing")).json(),
    enabled: service === "domain" || step >= 2,
    staleTime: 300_000,
  });

  const { data: paymentMethods = [] } = useQuery<PaymentMethod[]>({
    queryKey: ["payment-methods"],
    queryFn: async () => (await apiFetch("/api/payment-methods")).json(),
    enabled: step === 3,
    staleTime: 60_000,
  });

  // ── Derived state ─────────────────────────────────────────────────────────

  const byTab = (t: HostingTab) => {
    const f = allPlans.filter(p => classifyPlan(p) === t);
    return f.length > 0 ? f : (t === "shared" ? allPlans : []);
  };
  const displayPlans = byTab(hostingTab);

  // Which tabs have plans?
  const availableTabs = (["shared","reseller","vps","wordpress"] as HostingTab[]).filter(t => byTab(t).length > 0);

  // Step completion flags
  const step1Complete = !!pendingPlan;
  const step2Complete = domainMode !== null;
  const step3Complete = !!paymentMethodId;

  const currentCycle   = step >= 2 ? selectedCycle : pendingCycle;
  const showSidebar    = step >= 1 && service !== "transfer";

  // Sidebar CTA
  const getSidebarCta = () => {
    if (step === 1) return "Continue to Domain Setup";
    if (step === 2) return "Continue to Payment";
    if (step === 3) return "Place Order";
    return "Continue";
  };

  const canSidebarContinue = () => {
    if (step === 1) return step1Complete;
    if (step === 2) return step2Complete;
    if (step === 3) return step3Complete;
    return false;
  };

  // ── Handlers ─────────────────────────────────────────────────────────────

  function clickPlan(plan: Plan) {
    // Toggle off if same plan clicked again
    if (pendingPlan?.id === plan.id) { setPendingPlan(null); return; }
    setPendingPlan(plan);
    // Default to best cycle available
    const cycles = planCycles(plan);
    setPendingCycle(cycles.includes("yearly") ? "yearly" : cycles[0]);
  }

  function confirmStep1() {
    if (!pendingPlan) return;
    // Replace cart item if different plan
    if (selectedPlan && selectedPlan.id !== pendingPlan.id) removeItem(selectedPlan.id);
    addItem({
      planId: pendingPlan.id, planName: pendingPlan.name, billingCycle: pendingCycle,
      monthlyPrice:    pendingPlan.price,
      quarterlyPrice:  pendingPlan.quarterlyPrice  ?? undefined,
      semiannualPrice: pendingPlan.semiannualPrice ?? undefined,
      yearlyPrice:     pendingPlan.yearlyPrice     ?? undefined,
      renewalPrice:    pendingPlan.renewalPrice    ?? undefined,
      renewalEnabled:  pendingPlan.renewalEnabled,
    });
    setSelectedPlan(pendingPlan);
    setSelectedCycle(pendingCycle);
    setStep(2);
  }

  function confirmStep2() {
    // Domain was already set (or skipped)
    setStep(3);
  }

  function removePlan() {
    if (selectedPlan) removeItem(selectedPlan.id);
    setSelectedPlan(null); setPendingPlan(null);
    setStep(1);
  }

  async function checkDomain() {
    const clean = cleanName(domainQ);
    if (!clean || clean.length < 2) { setDomError("Enter a valid domain name."); return; }
    setDomError(""); setDomChecking(true); setDomResults(null);
    try {
      const r = await apiFetch(`/api/domains/availability?domain=${encodeURIComponent(clean)}`);
      const d = await r.json();
      if (!r.ok) { setDomError(d.error || "Check failed."); }
      else setDomResults(d.results ?? []);
    } catch {
      // Fallback: show TLD pricing without real-time availability
      setDomResults(tldPricing.filter(t => t.registrationPrice > 0).map(t => ({
        tld: t.tld, available: true,
        registrationPrice: t.registrationPrice,
        register2YearPrice: t.register2YearPrice,
        register3YearPrice: t.register3YearPrice,
        renewalPrice: t.renewalPrice,
      })));
    }
    setDomChecking(false);
  }

  // ── Order submission ──────────────────────────────────────────────────────

  const orderMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPlan) throw new Error("No plan selected");
      const body: Record<string, unknown> = {
        packageId:       selectedPlan.id,
        billingCycle:    selectedCycle,
        paymentMethodId: paymentMethodId,
      };
      if (promoCode.trim()) body.promoCode = promoCode.trim();
      if (cartDomain) {
        body.domain          = cartDomain.fullName;
        body.registerDomain  = cartDomain.mode === "register";
        body.domainAmount    = cartDomain.price;
      }
      const r = await apiFetch("/api/checkout", { method: "POST", body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Checkout failed");
      return d;
    },
    onSuccess: (data) => {
      removeItem(selectedPlan!.id);
      setCartDomain(null);
      setLocation(`/client/invoices/${data.invoiceId}`);
    },
    onError: (err: Error) => {
      setOrderError(err.message);
    },
  });

  function handleSidebarContinue() {
    if (step === 1) confirmStep1();
    else if (step === 2) confirmStep2();
    else if (step === 3) { setOrderError(""); orderMutation.mutate(); }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 0 — Choose Service
  // ─────────────────────────────────────────────────────────────────────────────

  function renderStep0() {
    const cards = [
      {
        id: "hosting"  as ServiceType, popular: true,
        icon: <Server size={28} strokeWidth={1.6} style={{ color: P }}/>,
        title: "Web Hosting",
        desc: "Shared, Reseller, VPS, and WordPress hosting with cPanel & WHM.",
        bullets: ["cPanel & WHM included", "Free SSL Certificate", "NVMe SSD Storage", "99.9% Uptime SLA"],
        cta: "View Plans",
      },
      {
        id: "domain" as ServiceType, popular: false,
        icon: <Globe size={26} strokeWidth={1.6} style={{ color: P }}/>,
        title: "Domain Registration",
        desc: "Register your perfect domain from 50+ extensions at best PKR rates.",
        bullets: ["50+ TLD extensions", "WHOIS privacy free", "Auto-renewal support", "Full DNS control"],
        cta: "Search Domain",
      },
      {
        id: "transfer" as ServiceType, popular: false,
        icon: <ArrowRightLeft size={24} strokeWidth={1.6} style={{ color: P }}/>,
        title: "Domain Transfer",
        desc: "Move your domain to Noehost and get a free 1-year extension.",
        bullets: ["Free 1-year extension", "Keep domain live", "Simple EPP transfer", "Admin panel access"],
        cta: "Start Transfer",
      },
    ];

    return (
      <motion.div key="s0" {...fade}>
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-black mb-2">What do you need today?</h1>
          <p className="text-[14px] text-gray-500">Select a service type to get started.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
          {cards.map(c => (
            <button key={c.id} onClick={() => { setService(c.id); setStep(1); }}
              className="group relative text-left flex flex-col rounded-2xl bg-white transition-all duration-200 focus:outline-none"
              style={{ border: c.popular ? `2px solid ${P}` : "1px solid #E5E7EB", borderRadius: 16, padding: "24px 22px" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = P; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 24px rgba(112,26,254,0.12)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = c.popular ? P : "#E5E7EB"; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}>
              {c.popular && (
                <div className="absolute -top-3 left-5 flex items-center gap-1 px-3 py-0.5 text-white text-[11px] font-bold rounded-full" style={{ background: P }}>
                  <Star size={9} strokeWidth={2.5}/> MOST POPULAR
                </div>
              )}
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(112,26,254,0.08)" }}>
                {c.icon}
              </div>
              <h3 className="text-[17px] font-bold text-black mb-1">{c.title}</h3>
              <p className="text-[13px] text-gray-500 mb-4 leading-relaxed">{c.desc}</p>
              <ul className="space-y-2 mb-5 flex-1">
                {c.bullets.map(b => (
                  <li key={b} className="flex items-center gap-2 text-[13px] text-gray-600">
                    <Check size={12} strokeWidth={2.5} style={{ color: P, flexShrink: 0 }}/> {b}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-1.5 text-[13px] font-bold mt-auto" style={{ color: P }}>
                {c.cta} <ChevronRight size={14} strokeWidth={2.5}/>
              </div>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-3 sm:gap-6 mt-6 text-[12px] text-gray-400">
          <span className="flex items-center gap-1.5"><Lock size={11}/> Secure Checkout</span>
          <span className="hidden sm:inline">·</span>
          <span>30-day money-back guarantee</span>
          <span className="hidden sm:inline">·</span>
          <span>No setup fees · PKR currency</span>
        </div>
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1 — Plan & Billing (Hosting)
  // ─────────────────────────────────────────────────────────────────────────────

  const TAB_META: Record<HostingTab, { label: string; icon: React.ReactNode; tagline: string }> = {
    shared:    { label: "Shared",    icon: <Globe size={13}/>,  tagline: "Best for websites, blogs & small businesses" },
    reseller:  { label: "Reseller",  icon: <Users size={13}/>,  tagline: "Start your own hosting business with WHM" },
    vps:       { label: "VPS",       icon: <Zap size={13}/>,    tagline: "Dedicated resources with full root access" },
    wordpress: { label: "WordPress", icon: <Server size={13}/>, tagline: "Managed WordPress with one-click installs & staging" },
  };

  function renderStep1() {
    const pendingCycles = pendingPlan ? planCycles(pendingPlan) : [];

    return (
      <motion.div key="s1" {...fade}>
        <button onClick={() => { setStep(0); setService(null); setPendingPlan(null); }}
          className="inline-flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-black transition-colors mb-6 font-medium">
          <ArrowLeft size={13}/> Back
        </button>
        <div className="text-center mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-black mb-1.5">Choose Your Plan</h2>
          <p className="text-[14px] text-gray-500">Click a plan to select it, then confirm your billing cycle below.</p>
        </div>

        {/* Hosting type tabs */}
        <div className="overflow-x-auto -mx-1 px-1 mb-2">
          <div className="flex gap-2 min-w-max justify-center">
            {availableTabs.map(t => (
              <button key={t} onClick={() => { setHostingTab(t); setPendingPlan(null); }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold border transition-all whitespace-nowrap"
                style={hostingTab === t
                  ? { background: P, color: "#fff", border: `1px solid ${P}`, boxShadow: `0 2px 12px ${P}40` }
                  : { background: "#fff", color: "#4B5563", border: "1px solid #E5E7EB" }}>
                {TAB_META[t].icon} {TAB_META[t].label} Hosting
              </button>
            ))}
          </div>
        </div>
        <p className="text-center text-[12px] text-gray-400 mb-6">{TAB_META[hostingTab].tagline}</p>

        {/* Plan cards */}
        {plansLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={28} className="animate-spin" style={{ color: P }}/><p className="text-[13px] text-gray-400">Loading plans…</p>
          </div>
        ) : displayPlans.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
            <Server size={32} className="mx-auto mb-3 text-gray-200"/>
            <p className="text-gray-400 text-sm">No plans in this category yet.</p>
          </div>
        ) : (
          <div className={`grid gap-4 ${
            displayPlans.length === 1 ? "max-w-xs mx-auto" :
            displayPlans.length === 2 ? "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto" :
            "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          }`}>
            {displayPlans.map((plan, idx) => {
              const isRec  = displayPlans.length > 1 && idx === Math.floor(displayPlans.length / 2);
              const isSel  = pendingPlan?.id === plan.id;
              const price  = planPrice(plan, isSel ? pendingCycle : "monthly");

              return (
                <button key={plan.id} onClick={() => clickPlan(plan)}
                  className="relative flex flex-col rounded-2xl bg-white text-left transition-all focus:outline-none"
                  style={{
                    border: isSel ? `2px solid ${P}` : isRec ? `2px solid ${P}` : "1px solid #E5E7EB",
                    boxShadow: isSel ? `0 0 0 3px ${P}20, 0 8px 24px ${P}18` : isRec ? `0 8px 24px ${P}14` : undefined,
                  }}>

                  {isRec && !isSel && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap px-3.5 py-1 text-white text-[11px] font-bold rounded-full flex items-center gap-1 shadow" style={{ background: P }}>
                      <Star size={9} strokeWidth={3}/> Recommended
                    </div>
                  )}
                  {isSel && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap px-3.5 py-1 text-white text-[11px] font-bold rounded-full flex items-center gap-1 shadow" style={{ background: P }}>
                      <Check size={11} strokeWidth={2.5}/> Selected — Choose Billing Below
                    </div>
                  )}

                  {/* Header */}
                  <div className={`px-5 pt-7 pb-4 border-b ${isSel ? "border-[#701AFE]/20" : "border-gray-100"}`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-[16px] font-bold text-black">{plan.name}</h3>
                      {isRec && <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white" style={{ background: P }}>Best Value</span>}
                    </div>
                    {plan.description && <p className="text-[12px] text-gray-400 mb-3">{plan.description}</p>}
                    <div className="flex items-end gap-1 mt-3">
                      <span className="text-[36px] font-extrabold text-black leading-none">{formatPrice(price)}</span>
                      <span className="text-[13px] text-gray-400 mb-1">/mo</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">Starting price · choose billing cycle below</p>
                  </div>

                  {/* Features */}
                  <div className="px-5 py-4 flex-1">
                    <ul className="space-y-2.5">
                      <Feat text={`${plan.diskSpace} SSD Storage`}/>
                      <Feat text={`${plan.bandwidth} Bandwidth`}/>
                      <Feat text={`${plan.emailAccounts ?? "Unlimited"} Email Accounts`}/>
                      <Feat text={`${plan.databases ?? "Unlimited"} Databases`}/>
                      {hostingTab === "wordpress" && (
                        <><Feat text="One-Click WordPress Install"/>
                          <Feat text="Staging Environment"/>
                          <Feat text="WP Auto-Updates"/></>
                      )}
                      {(plan.features ?? []).slice(0, 4).map(f => <Feat key={f} text={f}/>)}
                    </ul>
                  </div>

                  {/* CTA */}
                  <div className="px-5 pb-5">
                    <div className={`w-full py-2.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 transition-all ${isSel ? "text-white" : ""}`}
                      style={isSel
                        ? { background: P }
                        : { background: "#F9FAFB", color: P, border: `1px solid ${P}30` }}>
                      {isSel ? <><Check size={14} strokeWidth={2.5}/> Plan Selected</> : <>Click to Select</>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Billing Cycle Selector ── slides in when a plan is clicked ── */}
        <AnimatePresence>
          {pendingPlan && (
            <motion.div key="billing" {...slideDown} className="overflow-hidden">
              <div className="mt-6 p-5 bg-white border-2 rounded-2xl" style={{ borderColor: P }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-5 rounded-full" style={{ background: P }}/>
                  <h3 className="text-[14px] font-bold text-black">Choose Billing Cycle for <span style={{ color: P }}>{pendingPlan.name}</span></h3>
                </div>
                <div className={`grid gap-3 ${pendingCycles.length <= 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
                  {pendingCycles.map(c => {
                    const price   = planPrice(pendingPlan, c);
                    const saving  = savingsLabel(pendingPlan.price, price, c === "yearly" ? 12 : c === "semiannual" ? 6 : c === "quarterly" ? 3 : 1);
                    const isChosen = pendingCycle === c;
                    return (
                      <button key={c} onClick={() => setPendingCycle(c)}
                        className="relative flex flex-col items-center p-3.5 rounded-xl border-2 transition-all font-semibold focus:outline-none"
                        style={isChosen ? { borderColor: P, background: `${P}0A` } : { borderColor: "#E5E7EB", background: "#fff" }}>
                        {saving && (
                          <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 text-[10px] font-bold rounded-full text-white" style={{ background: "#16a34a" }}>{saving}</span>
                        )}
                        <span className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: isChosen ? P : "#6B7280" }}>{CYCLE_LABELS[c]}</span>
                        <span className="text-[20px] font-extrabold" style={{ color: isChosen ? P : "#111" }}>{formatPrice(price)}</span>
                        <span className="text-[11px]" style={{ color: isChosen ? P : "#9CA3AF" }}>{CYCLE_SUFFIX[c]}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-end mt-4">
                  <ContinueBtn label="Confirm Plan & Continue" onClick={confirmStep1} disabled={!pendingPlan}/>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!pendingPlan && displayPlans.length > 0 && (
          <p className="text-center text-[12px] text-gray-400 mt-5 flex items-center justify-center gap-1.5">
            <Shield size={12}/> 30-day money-back guarantee · Upgrade or cancel anytime
          </p>
        )}
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1 — Domain Registration flow
  // ─────────────────────────────────────────────────────────────────────────────

  function renderStep1Domain() {
    const searched = domResults ? cleanName(domainQ) : "";

    return (
      <motion.div key="s1-dom" {...fade}>
        <button onClick={() => { setStep(0); setService(null); setDomResults(null); }}
          className="inline-flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-black transition-colors mb-6 font-medium">
          <ArrowLeft size={13}/> Back
        </button>
        <div className="text-center mb-7">
          <h2 className="text-2xl sm:text-3xl font-bold text-black mb-1.5">Find Your Domain</h2>
          <p className="text-[14px] text-gray-500">Search across 50+ extensions. Prices pulled from admin settings.</p>
        </div>

        <div className="max-w-2xl mx-auto mb-6">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input value={domainQ} onChange={e => { setDomainQ(e.target.value); setDomResults(null); }}
                onKeyDown={e => e.key === "Enter" && checkDomain()}
                placeholder="yourname, mybrand, mystore…"
                className="w-full pl-11 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-[14px] focus:outline-none transition-all"
                onFocus={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.boxShadow = `0 0 0 3px ${P}22`; }}
                onBlur={e  => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = ""; }}
                autoFocus/>
            </div>
            <button onClick={checkDomain} disabled={domChecking || !domainQ.trim()}
              className="w-full sm:w-auto px-6 py-3.5 text-white rounded-xl text-[14px] font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
              style={{ background: P }}>
              {domChecking ? <Loader2 size={16} className="animate-spin"/> : <Search size={16}/>} Check Availability
            </button>
          </div>
          {domError && <p className="mt-2 text-[13px] text-red-500 flex items-center gap-1.5"><AlertCircle size={13}/> {domError}</p>}
        </div>

        {/* TLD price pills while idle */}
        {!domResults && !domChecking && tldPricing.length > 0 && (
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-[11px] text-gray-400 uppercase tracking-widest font-semibold mb-2.5">Popular Extensions</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {tldPricing.slice(0, 10).map(t => (
                <span key={t.tld} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[12px] text-gray-600">
                  <span className="font-bold">{t.tld}</span>
                  <span className="text-gray-400 ml-1">{formatPrice(t.registrationPrice)}/yr</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {domChecking && <div className="text-center py-12"><Loader2 size={22} className="animate-spin mx-auto" style={{ color: P }}/></div>}

        {/* Horizontal result bars */}
        {domResults && !domChecking && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-2.5">
            {domResults.filter(r => r.registrationPrice > 0).slice(0, 10).map(r => (
              <div key={r.tld}
                className={`flex items-center justify-between px-4 py-3.5 bg-white rounded-xl border transition-all ${r.available ? "border-gray-200 hover:border-[#701AFE]/30" : "border-gray-100 opacity-50"}`}>
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <span className="text-[15px] font-bold text-black">{searched}</span>
                  <span className="text-[15px] font-bold" style={{ color: P }}>{r.tld}</span>
                </div>
                <div className="mx-4 shrink-0">
                  {r.available
                    ? <span className="flex items-center gap-1 text-[11px] font-bold text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full"><Check size={10} strokeWidth={2.5}/> Available</span>
                    : <span className="text-[11px] font-bold text-red-400 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">Taken</span>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[14px] font-bold text-black">{formatPrice(r.registrationPrice)}/yr</span>
                  {r.available && (
                    <button
                      onClick={() => { setCartDomain({ fullName: `${searched}${r.tld}`, price: r.registrationPrice, mode: "register" }); setLocation("/client/cart"); }}
                      className="px-3.5 py-1.5 text-white text-[12px] font-bold rounded-lg flex items-center gap-1 hover:opacity-90 transition-all"
                      style={{ background: P }}>
                      <ShoppingCart size={12}/> Add to Cart
                    </button>
                  )}
                </div>
              </div>
            ))}
            <p className="text-center text-[11px] text-gray-400 pt-1">Prices from admin TLD settings · Updated in real-time</p>
          </motion.div>
        )}
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1 — Transfer flow
  // ─────────────────────────────────────────────────────────────────────────────

  function renderStep1Transfer() {
    function handleTransfer(e: React.FormEvent) {
      e.preventDefault();
      if (!txDomain.includes(".")) { setTxError("Enter a valid domain, e.g. example.com"); return; }
      if (!eppCode.trim())         { setTxError("EPP/Auth code is required.");              return; }
      sessionStorage.setItem("transfer_domain", txDomain);
      sessionStorage.setItem("transfer_epp",    eppCode);
      setLocation("/client/domains?tab=transfers");
    }

    return (
      <motion.div key="s1-tx" {...fade}>
        <button onClick={() => { setStep(0); setService(null); }}
          className="inline-flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-black transition-colors mb-6 font-medium">
          <ArrowLeft size={13}/> Back
        </button>
        <div className="text-center mb-7">
          <h2 className="text-2xl sm:text-3xl font-bold text-black mb-1.5">Transfer Your Domain</h2>
          <p className="text-[14px] text-gray-500">Move to Noehost and receive a free 1-year extension.</p>
        </div>
        <form onSubmit={handleTransfer} className="max-w-md mx-auto space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Domain Name</label>
            <div className="relative">
              <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input value={txDomain} onChange={e => setTxDomain(e.target.value)} placeholder="example.com" autoFocus
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-[14px] focus:outline-none"
                onFocus={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.boxShadow = `0 0 0 3px ${P}22`; }}
                onBlur={e  => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = ""; }}/>
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">EPP / Authorization Code</label>
            <div className="relative">
              <Key size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input value={eppCode} onChange={e => setEppCode(e.target.value)} placeholder="Paste EPP code here" className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-[14px] font-mono focus:outline-none"
                onFocus={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.boxShadow = `0 0 0 3px ${P}22`; }}
                onBlur={e  => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = ""; }}/>
            </div>
            <p className="text-[12px] text-gray-400 mt-1">Get this from your current registrar's control panel.</p>
          </div>
          {txError && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-600"><AlertCircle size={14}/> {txError}</div>}
          <div className="rounded-xl p-4 text-[13px]" style={{ background: "#FAF8FF", border: "1px solid #EDE9FF" }}>
            <p className="font-semibold mb-1.5" style={{ color: P }}>What happens next?</p>
            <ol className="space-y-1 text-gray-500 list-decimal list-inside text-[12px]">
              <li>We verify your domain and EPP code</li><li>You confirm the transfer payment in PKR</li>
              <li>Transfer completes within 5–7 days</li><li>Domain gets a free 1-year extension</li>
            </ol>
          </div>
          <button type="submit" className="w-full py-3.5 text-white rounded-xl text-[14px] font-bold flex items-center justify-center gap-2" style={{ background: P, boxShadow: PSHADOW }}>
            <ArrowRightLeft size={15}/> Continue Transfer
          </button>
        </form>
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 2 — Domain Setup (after hosting plan confirmed)
  // ─────────────────────────────────────────────────────────────────────────────

  function renderStep2() {
    const searched = domResults ? cleanName(domainQ) : "";

    async function handleDomSearch(e: React.FormEvent) { e.preventDefault(); await checkDomain(); }

    const optCards: { mode: NonNullable<DomainMode>; icon: React.ReactNode; title: string; desc: string }[] = [
      { mode: "register", icon: <Search size={20} style={{ color: P }}/>, title: "Register New Domain", desc: "Search and register a new domain for your site." },
      { mode: "transfer", icon: <ArrowRightLeft size={20} style={{ color: P }}/>, title: "Transfer Domain", desc: "Move an existing domain here with EPP code." },
      { mode: "existing", icon: <Globe size={20} style={{ color: P }}/>, title: "Use Existing Domain", desc: "I already own a domain and will update nameservers." },
    ];

    return (
      <motion.div key="s2" {...fade}>
        <button onClick={() => { setStep(1); setDomainMode(null); setDomResults(null); }}
          className="inline-flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-black transition-colors mb-6 font-medium">
          <ArrowLeft size={13}/> Back
        </button>

        {/* Plan confirmation badge */}
        <div className="flex items-center gap-3 p-3.5 mb-7 bg-green-50 border border-green-200 rounded-xl max-w-lg">
          <CheckCircle2 size={17} className="text-green-500 shrink-0"/>
          <div>
            <p className="text-[13px] font-semibold text-green-800">{selectedPlan?.name} · {CYCLE_LABELS[selectedCycle]} added</p>
            <p className="text-[12px] text-green-600">Now set up your domain.</p>
          </div>
        </div>

        <div className="text-center mb-7">
          <h2 className="text-2xl sm:text-3xl font-bold text-black mb-1.5">Domain Setup</h2>
          <p className="text-[14px] text-gray-500">Choose how to connect a domain to your hosting plan.</p>
        </div>

        {/* Option cards (always visible) */}
        {!domainMode && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            {optCards.map(opt => (
              <button key={opt.mode} onClick={() => { setDomainMode(opt.mode); setDomResults(null); }}
                className="group text-left bg-white border border-gray-200 rounded-2xl p-5 transition-all focus:outline-none"
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = P; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 16px rgba(112,26,254,0.10)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#E5E7EB"; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "rgba(112,26,254,0.08)" }}>{opt.icon}</div>
                <h3 className="text-[14px] font-bold text-black mb-1">{opt.title}</h3>
                <p className="text-[12px] text-gray-500 leading-relaxed">{opt.desc}</p>
              </button>
            ))}
          </div>
        )}

        {/* Sub-panels */}
        <AnimatePresence>
          {domainMode === "register" && (
            <motion.div key="reg" {...fade} className="max-w-xl">
              <button onClick={() => { setDomainMode(null); setDomResults(null); }} className="flex items-center gap-1 text-[13px] text-gray-400 hover:text-black mb-4"><ArrowLeft size={13}/> Change option</button>
              <form onSubmit={handleDomSearch} className="flex flex-col sm:flex-row gap-2 mb-5">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                  <input value={domainQ} onChange={e => { setDomainQ(e.target.value); setDomResults(null); }}
                    placeholder="e.g. mybusiness…" autoFocus
                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-[14px] focus:outline-none"
                    onFocus={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.boxShadow = `0 0 0 3px ${P}22`; }}
                    onBlur={e  => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = ""; }}/>
                </div>
                <button type="submit" disabled={domChecking || !domainQ.trim()}
                  className="w-full sm:w-auto px-5 py-3 text-white rounded-xl text-[13px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-60" style={{ background: P }}>
                  {domChecking ? <Loader2 size={14} className="animate-spin"/> : <Search size={14}/>} Check
                </button>
              </form>
              {domError && <p className="text-[13px] text-red-500 mb-3 flex items-center gap-1.5"><AlertCircle size={13}/> {domError}</p>}
              {domChecking && <div className="text-center py-6"><Loader2 size={20} className="animate-spin" style={{ color: P }}/></div>}
              {domResults && !domChecking && (
                <div className="space-y-2.5">
                  {domResults.filter(r => r.registrationPrice > 0).slice(0, 6).map(r => (
                    <div key={r.tld} className={`flex items-center justify-between px-4 py-3 bg-white rounded-xl border transition-all ${r.available ? "border-gray-200 hover:border-[#701AFE]/30" : "opacity-50 border-gray-100"}`}>
                      <div className="flex items-center gap-0.5 flex-1 min-w-0">
                        <span className="text-[14px] font-bold text-black">{searched}</span>
                        <span className="text-[14px] font-bold" style={{ color: P }}>{r.tld}</span>
                      </div>
                      <div className="mx-3 shrink-0">
                        {r.available ? <span className="flex items-center gap-1 text-[11px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full"><Check size={10} strokeWidth={2.5}/> Available</span>
                          : <span className="text-[11px] font-bold text-red-400 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">Taken</span>}
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="text-[13px] font-bold">{formatPrice(r.registrationPrice)}/yr</span>
                        {r.available && (
                          <button onClick={() => { setCartDomain({ fullName: `${searched}${r.tld}`, price: r.registrationPrice, mode: "register" }); confirmStep2(); }}
                            className="px-3 py-1.5 text-white text-[12px] font-bold rounded-lg flex items-center gap-1 hover:opacity-90" style={{ background: P }}>
                            <ShoppingCart size={11}/> Select
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {domainMode === "transfer" && (
            <motion.div key="tx" {...fade} className="max-w-md">
              <button onClick={() => setDomainMode(null)} className="flex items-center gap-1 text-[13px] text-gray-400 hover:text-black mb-4"><ArrowLeft size={13}/> Change option</button>
              <div className="space-y-4">
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Domain to Transfer</label>
                  <div className="relative">
                    <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                    <input value={txDomain} onChange={e => setTxDomain(e.target.value)} placeholder="example.com" autoFocus
                      className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-[14px] focus:outline-none"
                      onFocus={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.boxShadow = `0 0 0 3px ${P}22`; }}
                      onBlur={e  => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = ""; }}/>
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">EPP / Authorization Code</label>
                  <div className="relative">
                    <Key size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                    <input value={eppCode} onChange={e => setEppCode(e.target.value)} placeholder="Paste EPP code"
                      className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-[14px] font-mono focus:outline-none"
                      onFocus={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.boxShadow = `0 0 0 3px ${P}22`; }}
                      onBlur={e  => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = ""; }}/>
                  </div>
                </div>
                <button onClick={() => {
                    if (!txDomain.includes(".")) return;
                    setCartDomain({ fullName: txDomain, price: 0, mode: "transfer" });
                    confirmStep2();
                  }}
                  disabled={!txDomain.includes(".")}
                  className="w-full py-3 text-white rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: P }}>
                  <ArrowRightLeft size={14}/> Continue with Transfer
                </button>
              </div>
            </motion.div>
          )}

          {domainMode === "existing" && (
            <motion.div key="ex" {...fade} className="max-w-md">
              <button onClick={() => setDomainMode(null)} className="flex items-center gap-1 text-[13px] text-gray-400 hover:text-black mb-4"><ArrowLeft size={13}/> Change option</button>
              <div>
                <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Your Domain Name</label>
                <div className="relative mb-3">
                  <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                  <input value={existingDom} onChange={e => setExistingDom(e.target.value)} placeholder="example.com" autoFocus
                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-[14px] focus:outline-none"
                    onFocus={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.boxShadow = `0 0 0 3px ${P}22`; }}
                    onBlur={e  => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = ""; }}/>
                </div>
                <p className="text-[12px] text-gray-400 mb-4">You'll update nameservers to point to Noehost after checkout.</p>
                <button onClick={() => {
                    setCartDomain({ fullName: existingDom.trim() || "existing-domain", price: 0, mode: "existing" });
                    confirmStep2();
                  }}
                  disabled={!existingDom.includes(".")}
                  className="w-full py-3 text-white rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: P }}>
                  <Globe size={14}/> Continue with This Domain
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Skip link */}
        {!domainMode && (
          <div className="text-center mt-2">
            <button onClick={() => { setDomainMode("existing"); setCartDomain(null); confirmStep2(); }}
              className="text-[13px] text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors">
              Skip for now — I'll add a domain later
            </button>
          </div>
        )}
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 3 — Review & Payment
  // ─────────────────────────────────────────────────────────────────────────────

  function renderStep3() {
    const planAmt   = selectedPlan ? planPrice(selectedPlan, selectedCycle) : 0;
    const domAmt    = cartDomain?.price ?? 0;
    const total     = planAmt + domAmt;

    return (
      <motion.div key="s3" {...fade}>
        <button onClick={() => setStep(2)}
          className="inline-flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-black transition-colors mb-6 font-medium">
          <ArrowLeft size={13}/> Back
        </button>
        <div className="text-center mb-7">
          <h2 className="text-2xl sm:text-3xl font-bold text-black mb-1.5">Review & Payment</h2>
          <p className="text-[14px] text-gray-500">Confirm your order details and choose a payment method.</p>
        </div>

        <div className="space-y-6">
          {/* Order review card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h3 className="text-[13px] font-bold text-gray-600 uppercase tracking-wider mb-4">Order Details</h3>
            <div className="space-y-3">
              {selectedPlan && (
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div>
                    <p className="text-[14px] font-semibold text-black">{selectedPlan.name}</p>
                    <p className="text-[12px] text-gray-400">{CYCLE_LABELS[selectedCycle]} billing</p>
                  </div>
                  <span className="text-[16px] font-extrabold text-black">{formatPrice(planAmt)}</span>
                </div>
              )}
              {cartDomain && (
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div>
                    <p className="text-[14px] font-semibold text-black">{cartDomain.fullName}</p>
                    <p className="text-[12px] text-gray-400">
                      {cartDomain.mode === "register" ? "New domain · 1 Year" : cartDomain.mode === "transfer" ? "Domain transfer" : "Existing domain"}
                    </p>
                  </div>
                  <span className="text-[16px] font-extrabold text-black">
                    {cartDomain.price > 0 ? formatPrice(cartDomain.price) : <span className="text-green-600">Free</span>}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[15px] font-bold text-black">Total</span>
                <span className="text-[22px] font-extrabold text-black">{formatPrice(total)}</span>
              </div>
            </div>
          </div>

          {/* Promo code */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h3 className="text-[13px] font-bold text-gray-600 uppercase tracking-wider mb-3">Promo Code (optional)</h3>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="Enter promo code"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-[13px] font-mono uppercase focus:outline-none"
                  onFocus={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.boxShadow = `0 0 0 3px ${P}22`; }}
                  onBlur={e  => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = ""; }}/>
              </div>
              <button className="px-4 py-2.5 text-[13px] font-semibold rounded-xl border border-gray-200 text-gray-600 bg-white hover:border-[#701AFE]/40 hover:text-[#701AFE] transition-all">
                Apply
              </button>
            </div>
          </div>

          {/* Payment methods */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h3 className="text-[13px] font-bold text-gray-600 uppercase tracking-wider mb-4">Payment Method</h3>
            {paymentMethods.length === 0 ? (
              <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-xl text-[13px] text-amber-700">
                <AlertCircle size={14}/> No payment methods configured yet. Please contact support.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {paymentMethods.map(pm => {
                  const isSel = paymentMethodId === pm.id;
                  return (
                    <button key={pm.id} onClick={() => setPaymentMethodId(isSel ? null : pm.id)}
                      className="flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all focus:outline-none"
                      style={isSel ? { borderColor: P, background: `${P}08` } : { borderColor: "#E5E7EB", background: "#fff" }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: isSel ? `${P}15` : "#F3F4F6" }}>
                        <PayIcon type={pm.type}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-black leading-tight">
                          {pm.name} {pm.isSandbox && <span className="text-[10px] font-semibold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full ml-1">Test</span>}
                        </p>
                        {pm.description && <p className="text-[11px] text-gray-400 truncate">{pm.description}</p>}
                        {pm.type === "jazzcash" && pm.publicSettings.mobileNumber && (
                          <p className="text-[11px] text-gray-500 mt-0.5">Send to: {pm.publicSettings.mobileNumber}</p>
                        )}
                        {pm.type === "easypaisa" && pm.publicSettings.mobileNumber && (
                          <p className="text-[11px] text-gray-500 mt-0.5">Send to: {pm.publicSettings.mobileNumber}</p>
                        )}
                        {pm.type === "bank_transfer" && pm.publicSettings.bankName && (
                          <p className="text-[11px] text-gray-500 mt-0.5">{pm.publicSettings.bankName}</p>
                        )}
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${isSel ? "border-[#701AFE]" : "border-gray-300"}`} style={isSel ? { background: P } : {}}>
                        {isSel && <Check size={9} strokeWidth={3} className="text-white"/>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {orderError && (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-600">
              <AlertCircle size={14}/> {orderError}
            </div>
          )}

          <ContinueBtn
            label="Place Order"
            onClick={() => { setOrderError(""); orderMutation.mutate(); }}
            disabled={!step3Complete || orderMutation.isPending}
            loading={orderMutation.isPending}
          />
        </div>
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Root render
  // ─────────────────────────────────────────────────────────────────────────────

  const barStep = step;

  return (
    <div className={showSidebar ? "pb-20 lg:pb-0" : ""} style={{ fontFamily: "'Inter', 'Public Sans', sans-serif" }}>
      <StepBar active={barStep}/>

      <div className={showSidebar ? "lg:grid lg:grid-cols-[1fr_280px] lg:gap-8 lg:items-start" : ""}>

        {/* ── Main Content ── */}
        <div>
          <AnimatePresence mode="wait">
            {step === 0                                && renderStep0()}
            {step === 1 && service === "hosting"       && renderStep1()}
            {step === 1 && service === "domain"        && renderStep1Domain()}
            {step === 1 && service === "transfer"      && renderStep1Transfer()}
            {step === 2 && service === "hosting"       && renderStep2()}
            {step === 3                                && renderStep3()}
          </AnimatePresence>
        </div>

        {/* ── Order Summary Sidebar ── */}
        {showSidebar && (
          <Summary
            plan={selectedPlan}
            pendingPlan={pendingPlan}
            cycle={currentCycle}
            domain={cartDomain}
            step={step}
            fmt={formatPrice}
            onRmPlan={removePlan}
            onRmDom={() => setCartDomain(null)}
            onContinue={handleSidebarContinue}
            canContinue={canSidebarContinue()}
            ctaLabel={getSidebarCta()}
          />
        )}
      </div>
    </div>
  );
}
