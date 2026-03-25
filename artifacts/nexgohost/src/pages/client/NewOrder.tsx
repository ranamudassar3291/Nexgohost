/**
 * /client/orders/new  —  4-step Distraction-Free Checkout Wizard
 *
 * Step 1 (Service) → Step 2 (Plan & Billing) → Step 3 (Domain Setup) → Step 4 (Review & Pay)
 *
 * Layout: rendered inside CheckoutLayout (no sidebar, no dashboard header).
 * Plans / Groups: fetched live from Admin DB — nothing is hardcoded.
 * Free domain: shown when plan.freeDomainEnabled && cycle === "yearly".
 * Pricing: 100% dynamic from API, inc. TLD pricing from admin TLD table.
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence, type HTMLMotionProps } from "framer-motion";
import {
  Server, Globe, ArrowRightLeft, Check, X, Search, Loader2,
  Star, ArrowLeft, ShoppingCart, Receipt, Lock,
  AlertCircle, CheckCircle2, Key, Shield, Zap, Users, ChevronRight,
  CreditCard, Tag, Wallet, Landmark, Bitcoin, Smartphone, Gift,
  ChevronUp, ChevronDown, RefreshCw, Cpu, MemoryStick, HardDrive, Wifi, MonitorCog,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCart, type BillingCycle, CYCLE_LABELS, CYCLE_SUFFIX } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyProvider";

// ─── Types ────────────────────────────────────────────────────────────────────

type ServiceType = "hosting" | "domain" | "transfer" | "vps";
type DomainMode  = "register" | "transfer" | "existing" | null;

interface ProductGroup {
  id: string; name: string; slug: string; description: string | null;
  isActive: boolean; sortOrder: number;
}

interface Plan {
  id: string; name: string; description: string | null;
  groupId: string | null;
  price: number; yearlyPrice: number | null; quarterlyPrice: number | null;
  semiannualPrice: number | null;
  renewalEnabled: boolean; renewalPrice: number | null;
  billingCycle: string; diskSpace: string; bandwidth: string;
  emailAccounts: number | null; databases: number | null;
  features: string[];
  freeDomainEnabled: boolean; freeDomainTlds: string[];
  saveAmount: number | null;
}

interface TldResult {
  tld: string; available: boolean;
  registrationPrice: number; renewalPrice: number;
  register2YearPrice: number | null; register3YearPrice: number | null;
  isFreeWithHosting?: boolean;
}

interface TldPricing {
  tld: string; registrationPrice: number; renewalPrice: number;
  register2YearPrice: number | null; register3YearPrice: number | null;
  transferPrice: number;
}

interface PaymentMethod {
  id: string; name: string; type: string; description: string | null;
  isSandbox: boolean;
  publicSettings: {
    bankName?: string; accountTitle?: string; accountNumber?: string;
    mobileNumber?: string; paypalEmail?: string; walletAddress?: string;
    cryptoType?: string; publishableKey?: string; instructions?: string;
    iban?: string;
  };
}

interface CartDomain { fullName: string; price: number; originalPrice?: number; mode: DomainMode; }

interface VpsPlan {
  id: string; name: string; description: string | null;
  price: number; yearlyPrice: number | null;
  cpuCores: number; ramGb: number; storageGb: number; bandwidthTb: number | null;
  virtualization: string | null; features: string[]; saveAmount: number | null;
  osTemplateIds: string[]; locationIds: string[]; isActive: boolean;
}
interface VpsOsTemplate { id: string; name: string; version: string; iconUrl: string | null; }
interface VpsLocation { id: string; countryName: string; countryCode: string; flagIcon: string | null; }

// ─── Constants ────────────────────────────────────────────────────────────────

const P        = "#701AFE";
const PSHADOW  = `0 4px 20px rgba(112,26,254,0.28)`;
const DOMAIN_KEY = "order_wizard_domain";

const STEP_LABELS = ["Service", "Plan & Billing", "Domain Setup", "Review & Pay"];

function tok() { return localStorage.getItem("token") ?? ""; }

function apiFetch(url: string, opts?: RequestInit) {
  return fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
}

// ─── Price helpers ─────────────────────────────────────────────────────────────

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

function savingsPct(monthly: number, price: number, months: number): number {
  if (months <= 1) return 0;
  return Math.round((1 - price / (monthly * months)) * 100);
}

function cycleMonths(c: BillingCycle): number {
  return c === "yearly" ? 12 : c === "semiannual" ? 6 : c === "quarterly" ? 3 : 1;
}

function cleanName(raw: string) {
  return raw.trim().toLowerCase().split(".")[0].replace(/[^a-z0-9-]/g, "");
}

function loadDomain(): CartDomain | null {
  try { return JSON.parse(localStorage.getItem(DOMAIN_KEY) ?? "null"); } catch { return null; }
}
function saveDomain(d: CartDomain | null) {
  if (d) localStorage.setItem(DOMAIN_KEY, JSON.stringify(d));
  else   localStorage.removeItem(DOMAIN_KEY);
}

// ─── Animations ───────────────────────────────────────────────────────────────

type MotionBase = Omit<HTMLMotionProps<"div">, "ref"|"children"|"key"|"className"|"style">;
const fade: MotionBase     = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 },  exit: { opacity: 0, y: -8 }, transition: { duration: 0.2 } };
const slideUp: MotionBase  = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 },  exit: { opacity: 0, y: 12 }, transition: { duration: 0.2 } };

// ─── Step Progress Bar ────────────────────────────────────────────────────────

function StepBar({ active, labels }: { active: number; labels?: string[] }) {
  const displayLabels = labels ?? STEP_LABELS;
  return (
    <div className="overflow-x-auto pb-1 mb-8">
      <div className="flex items-start justify-center min-w-[360px]">
        {displayLabels.map((label, i) => {
          const done = i < active; const cur = i === active;
          return (
            <div key={label} className="flex items-start">
              <div className="flex flex-col items-center w-[76px] sm:w-[90px]">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  done ? "bg-[#701AFE] text-white shadow-md" :
                  cur  ? "bg-[#701AFE] text-white ring-4 ring-[#701AFE]/25 shadow-md" :
                         "bg-gray-100 text-gray-400"
                }`}>
                  {done ? <Check size={15} strokeWidth={2.5}/> : i + 1}
                </div>
                <span className={`mt-1.5 text-[11px] font-semibold text-center leading-tight ${cur ? "text-[#701AFE]" : done ? "text-gray-600" : "text-gray-400"}`}>
                  {label}
                </span>
              </div>
              {i < displayLabels.length - 1 && (
                <div className={`w-10 sm:w-14 h-0.5 mt-[18px] shrink-0 transition-colors duration-500 ${done ? "bg-[#701AFE]" : "bg-gray-200"}`}/>
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
    <li className="flex items-start gap-2.5">
      <Check size={13} strokeWidth={2.5} className="mt-0.5 shrink-0" style={{ color: P }}/>
      <span className="text-[13px] text-gray-600 leading-snug">{text}</span>
    </li>
  );
}

// ─── Payment icon ─────────────────────────────────────────────────────────────

function PayIcon({ type }: { type: string }) {
  switch (type) {
    case "jazzcash":      return <Smartphone size={20} style={{ color: "#f0612e" }}/>;
    case "easypaisa":    return <Smartphone size={20} style={{ color: "#3bb54a" }}/>;
    case "bank_transfer":return <Landmark   size={20} style={{ color: "#1d4ed8" }}/>;
    case "stripe":       return <CreditCard size={20} style={{ color: "#635bff" }}/>;
    case "paypal":       return <Wallet     size={20} style={{ color: "#003087" }}/>;
    case "crypto":       return <Bitcoin    size={20} style={{ color: "#f7931a" }}/>;
    default:             return <CreditCard size={20} className="text-gray-400"/>;
  }
}

// ─── Slim primary button ──────────────────────────────────────────────────────

function PrimaryBtn({ label, onClick, disabled, loading, icon }: {
  label: string; onClick?: () => void; disabled?: boolean; loading?: boolean; icon?: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={disabled || loading}
      className="flex items-center gap-2 px-7 py-3 rounded-xl text-[14px] font-bold text-white transition-all active:scale-[0.98]"
      style={disabled || loading
        ? { background: "#E5E7EB", color: "#9CA3AF", cursor: "not-allowed" }
        : { background: P, boxShadow: PSHADOW }}>
      {loading && <Loader2 size={15} className="animate-spin"/>}
      {!loading && icon}
      {label}
      {!loading && !disabled && <ChevronRight size={15}/>}
    </button>
  );
}

// ─── Mobile Expandable Order Summary Bar ─────────────────────────────────────

interface MobileSummaryProps {
  plan: Plan | null; cycle: BillingCycle; domain: CartDomain | null;
  freeDomain: boolean; fmt: (n: number) => string;
  ctaLabel: string; canContinue: boolean; onContinue: () => void;
  loading?: boolean;
  vpsPlan?: VpsPlan | null; vpsCycle?: "monthly" | "yearly"; vpsPrice?: number;
}

function MobileSummaryBar({ plan, cycle, domain, freeDomain, fmt, ctaLabel, canContinue, onContinue, loading, vpsPlan, vpsCycle, vpsPrice }: MobileSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const planAmt  = plan ? planPrice(plan, cycle) : 0;
  const domAmt   = freeDomain ? 0 : (domain?.price ?? 0);
  const total    = vpsPlan ? (vpsPrice ?? 0) : planAmt + domAmt;
  const hasItems = !!plan || !!domain || !!vpsPlan;

  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-40">
      <AnimatePresence>
        {expanded && hasItems && (
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white border-t border-gray-200 rounded-t-3xl shadow-2xl px-5 pt-4 pb-2"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[13px] font-bold text-gray-800 uppercase tracking-wider">Order Summary</span>
              <button onClick={() => setExpanded(false)} className="text-gray-400 hover:text-gray-600"><ChevronDown size={18}/></button>
            </div>
            {vpsPlan && (
              <div className="flex justify-between items-center py-2.5 border-b border-gray-100">
                <div>
                  <p className="text-[13px] font-semibold text-black">{vpsPlan.name}</p>
                  <p className="text-[11px] text-gray-400">VPS · {vpsCycle === "yearly" ? "Yearly" : "Monthly"}</p>
                </div>
                <span className="text-[14px] font-extrabold">{fmt(vpsPrice ?? 0)}</span>
              </div>
            )}
            {plan && !vpsPlan && (
              <div className="flex justify-between items-center py-2.5 border-b border-gray-100">
                <div>
                  <p className="text-[13px] font-semibold text-black">{plan.name}</p>
                  <p className="text-[11px] text-gray-400">{CYCLE_LABELS[cycle]}</p>
                </div>
                <span className="text-[14px] font-extrabold">{fmt(planAmt)}</span>
              </div>
            )}
            {domain && (
              <div className="flex justify-between items-center py-2.5 border-b border-gray-100">
                <div>
                  <p className="text-[13px] font-semibold text-black">{domain.fullName}</p>
                  <p className="text-[11px] text-gray-400">
                    {freeDomain ? "🎁 Free Domain Included" : domain.mode === "transfer" ? "Domain Transfer · 1-yr ext." : "Domain · 1 Year"}
                  </p>
                </div>
                <span className="text-[14px] font-extrabold">
                  {freeDomain
                    ? <div className="text-right">
                        {domain.originalPrice && domain.originalPrice > 0 && (
                          <span className="block text-[10px] text-gray-400 line-through">{fmt(domain.originalPrice)}</span>
                        )}
                        <span className="text-green-600 font-extrabold">FREE</span>
                      </div>
                    : fmt(domain.price)}
                </span>
              </div>
            )}
            {plan?.renewalPrice && (
              <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1"><RefreshCw size={10}/> Renews at {fmt(plan.renewalPrice)}/year</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white border-t border-gray-200 shadow-xl">
        {hasItems ? (
          <div className="flex items-center gap-3 px-4 py-2.5">
            <button onClick={() => setExpanded(!expanded)} className="flex-1 min-w-0 text-left group">
              <div className="flex items-center gap-1">
                <p className="text-[12px] font-bold text-black truncate">
                  {vpsPlan?.name ?? plan?.name ?? domain?.fullName ?? ""}
                  {plan && domain && !vpsPlan ? ` + ${domain.fullName}` : ""}
                </p>
                {expanded ? <ChevronDown size={13} className="text-gray-400 shrink-0"/> : <ChevronUp size={13} className="text-gray-400 shrink-0"/>}
              </div>
              <p className="text-[13px] font-extrabold" style={{ color: P }}>{fmt(total)} <span className="text-[11px] font-medium text-gray-400">/ {vpsPlan ? (vpsCycle === "yearly" ? "year" : "month") : CYCLE_LABELS[cycle].toLowerCase()}</span></p>
            </button>
            <button onClick={onContinue} disabled={!canContinue || loading}
              className="shrink-0 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white flex items-center gap-1.5 transition-all"
              style={canContinue && !loading ? { background: P, boxShadow: `0 2px 12px ${P}40` } : { background: "#E5E7EB", color: "#9CA3AF" }}>
              {loading ? <Loader2 size={13} className="animate-spin"/> : null}
              {ctaLabel}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 px-4 py-3">
            <ShoppingCart size={14} className="text-gray-300"/>
            <span className="text-[12px] text-gray-400">Select a plan to continue</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Desktop Order Summary Sidebar ───────────────────────────────────────────

interface SidebarProps {
  plan: Plan | null; pendingPlan: Plan | null;
  cycle: BillingCycle; pendingCycle: BillingCycle;
  domain: CartDomain | null; freeDomain: boolean;
  step: number; fmt: (n: number) => string;
  onRmPlan: () => void; onRmDom: () => void;
  ctaLabel: string; canContinue: boolean; onContinue: () => void; loading?: boolean;
  // VPS
  vpsPlan?: VpsPlan | null; vpsCycle?: "monthly" | "yearly"; vpsPrice?: number;
  onRmVps?: () => void;
}

function Sidebar({ plan, pendingPlan, cycle, pendingCycle, domain, freeDomain, step, fmt, onRmPlan, onRmDom, ctaLabel, canContinue, onContinue, loading, vpsPlan, vpsCycle, vpsPrice, onRmVps }: SidebarProps) {
  const activePlan  = plan ?? pendingPlan;
  const activeCycle = plan ? cycle : pendingCycle;
  const planAmt     = activePlan ? planPrice(activePlan, activeCycle) : 0;
  const domAmt      = freeDomain ? 0 : (domain?.price ?? 0);
  const total       = vpsPlan ? (vpsPrice ?? 0) : planAmt + domAmt;
  const hasItems    = !!activePlan || !!domain || !!vpsPlan;
  const renewAt     = activePlan?.renewalPrice ?? activePlan?.yearlyPrice ?? null;

  return (
    <div className="hidden lg:block">
      <div className="sticky top-20 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Receipt size={14} style={{ color: P }}/>
          <span className="text-[12px] font-bold text-gray-600 uppercase tracking-wider">Order Summary</span>
        </div>

        <div className="p-4 space-y-2">
          {!hasItems && (
            <div className="flex flex-col items-center py-8 gap-2">
              <ShoppingCart size={24} className="text-gray-200"/>
              <p className="text-[12px] text-gray-400 text-center">No items yet.<br/>Select a plan to begin.</p>
            </div>
          )}

          {/* VPS plan row */}
          {vpsPlan && (
            <div className="flex items-start justify-between gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-black truncate">
                  <Cpu size={10} className="inline mr-1" style={{ color: P }}/>{vpsPlan.name}
                </p>
                <p className="text-[11px] text-gray-400">{vpsCycle === "yearly" ? "Yearly" : "Monthly"} billing · VPS</p>
                <p className="text-[10.5px] text-gray-400">{vpsPlan.cpuCores} vCPU · {vpsPlan.ramGb}GB RAM · {vpsPlan.storageGb}GB NVMe</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[13px] font-extrabold">{fmt(vpsPrice ?? 0)}</span>
                {onRmVps && (
                  <button onClick={onRmVps} className="w-4 h-4 rounded-full bg-gray-200 hover:bg-red-100 hover:text-red-500 flex items-center justify-center text-gray-400 transition-colors">
                    <X size={9}/>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Plan row */}
          {activePlan && !vpsPlan && (
            <div className="flex items-start justify-between gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-black truncate">{activePlan.name}</p>
                <p className="text-[11px] text-gray-400">{CYCLE_LABELS[activeCycle]}</p>
                {!plan && pendingPlan && <p className="text-[10px] font-semibold mt-0.5" style={{ color: P }}>Choose billing below ↓</p>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[13px] font-extrabold">{fmt(planAmt)}</span>
                {plan && (
                  <button onClick={onRmPlan} className="w-4 h-4 rounded-full bg-gray-200 hover:bg-red-100 hover:text-red-500 flex items-center justify-center text-gray-400 transition-colors">
                    <X size={9}/>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Domain row */}
          {domain && (
            <div className="flex items-start justify-between gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-black truncate">{domain.fullName}</p>
                <p className="text-[11px] text-gray-400">
                  {freeDomain ? "🎁 Free Domain Included" : domain.mode === "transfer" ? "Domain Transfer" : "Domain · 1 Year"}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {freeDomain
                  ? <div className="text-right">
                      {domain.originalPrice && domain.originalPrice > 0 && (
                        <span className="block text-[10px] text-gray-400 line-through">{fmt(domain.originalPrice)}</span>
                      )}
                      <span className="text-[12px] font-extrabold text-green-600">FREE</span>
                    </div>
                  : <span className="text-[13px] font-extrabold">{fmt(domain.price)}</span>}
                <button onClick={onRmDom} className="w-4 h-4 rounded-full bg-gray-200 hover:bg-red-100 hover:text-red-500 flex items-center justify-center text-gray-400 transition-colors">
                  <X size={9}/>
                </button>
              </div>
            </div>
          )}
        </div>

        {hasItems && (
          <div className="px-4 pb-2">
            {/* Renewal note */}
            {renewAt && (
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-3 px-1">
                <RefreshCw size={10}/> Renews at {fmt(renewAt)}/year
              </div>
            )}
            {/* Total */}
            <div className="border-t border-gray-200 pt-3 mb-3">
              <div className="flex justify-between items-baseline">
                <span className="text-[13px] font-semibold text-gray-500">Total</span>
                <span className="text-[20px] font-extrabold text-black">{fmt(total)}</span>
              </div>
              <p className="text-[11px] text-right text-gray-400 mt-0.5">
                per {vpsPlan ? (vpsCycle === "yearly" ? "year" : "month") : CYCLE_LABELS[activeCycle].toLowerCase()}
              </p>
            </div>
          </div>
        )}

        {/* CTA */}
        {step >= 1 && (
          <div className="px-4 pb-5">
            <button onClick={onContinue} disabled={!canContinue || loading}
              className="w-full py-3 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 transition-all"
              style={canContinue && !loading ? { background: P, color: "#fff", boxShadow: PSHADOW } : { background: "#F3F4F6", color: "#9CA3AF", cursor: "not-allowed" }}>
              {loading ? <Loader2 size={14} className="animate-spin"/> : <ShoppingCart size={13}/>}
              {canContinue ? ctaLabel : step === 2 ? "Choose a domain option" : step === 3 ? "Select a payment method" : "Select a plan to continue"}
            </button>
            {canContinue && (
              <p className="text-[10px] text-gray-400 text-center mt-2.5 flex items-center justify-center gap-1">
                <Lock size={9}/> 30-day money-back guarantee
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface NewOrderProps {
  /** Pre-filter plan step to a specific admin group ID (/order/group/:id) */
  initialGroupId?: string;
  /** Auto-select a specific plan and skip to domain step (/order/add/:id) */
  initialPackageId?: string;
  /** Auto-select a VPS plan by ID and skip straight to configure step (/order/vps/:id) */
  initialVpsPlanId?: string;
}

export default function NewOrder({ initialGroupId, initialPackageId, initialVpsPlanId }: NewOrderProps = {}) {
  const [, setLocation] = useLocation();
  const { addItem, removeItem } = useCart();
  const { formatPrice } = useCurrency();

  // Direct-link modes: skip step 0 (service selection) when params are present
  const isDirectLink   = !!(initialGroupId || initialPackageId);
  const isVpsDirectLink = !!initialVpsPlanId;

  // ── Wizard state ──────────────────────────────────────────────────────────
  // When coming from /order/add/:id → jump straight to domain step (2)
  // When coming from /order/group/:id → start at plan step (1)
  // When coming from /order/vps/:id → jump to VPS configure step (2)
  const [step,    setStep]    = useState<0|1|2|3>(isVpsDirectLink ? 2 : initialPackageId ? 2 : isDirectLink ? 1 : 0);
  const [service, setService] = useState<ServiceType | null>(isVpsDirectLink ? "vps" : isDirectLink ? "hosting" : null);

  // While waiting for /order/add/:id plan to load, show spinner
  const [directLinkReady, setDirectLinkReady] = useState(!initialPackageId);
  const [directLinkError, setDirectLinkError] = useState("");

  // Groups & Plan
  const [selectedGroup,  setSelectedGroup]  = useState<ProductGroup | null>(null);
  const [pendingPlan,    setPendingPlan]     = useState<Plan | null>(null);
  const [pendingCycle,   setPendingCycle]    = useState<BillingCycle>("yearly");
  const [selectedPlan,   setSelectedPlan]   = useState<Plan | null>(null);
  const [selectedCycle,  setSelectedCycle]  = useState<BillingCycle>("yearly");

  // Free domain
  const freeDomainEligible = !!selectedPlan?.freeDomainEnabled && selectedCycle === "yearly";
  const [freeDomainClaimed, setFreeDomainClaimed] = useState(false);

  // Domain
  const [domainMode,  setDomainMode]  = useState<DomainMode>(null);
  const [domainQ,     setDomainQ]     = useState("");
  const [domChecking, setDomChecking] = useState(false);
  const [domResults,  setDomResults]  = useState<TldResult[] | null>(null);
  const [domError,    setDomError]    = useState("");
  const [existingDom, setExistingDom] = useState("");
  const [txDomain,    setTxDomain]    = useState("");
  const [eppCode,     setEppCode]     = useState("");
  const [domainNs,    setDomainNs]    = useState(["ns1.noehost.com", "ns2.noehost.com"]);
  const [cartDomain,  setCartDomainRaw] = useState<CartDomain | null>(loadDomain);

  // Force-free domain: if plan has freeDomainEnabled AND cycle is yearly AND mode is register
  // the domain is ALWAYS free — no TLD restriction applied
  const isDomForceFree = freeDomainEligible && cartDomain?.mode === "register";

  // Payment & order
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [promoCode,       setPromoCode]        = useState("");
  const [orderError,      setOrderError]        = useState("");

  // Promo validation state
  const [promoApplied,   setPromoApplied]   = useState(false);
  const [promoDiscount,  setPromoDiscount]  = useState(0);
  const [promoLoading,   setPromoLoading]   = useState(false);
  const [promoError,     setPromoError]     = useState("");

  // Domain-first upsell: after user picks a domain in the domain/transfer flow,
  // show "Want to add hosting?" before moving to checkout
  const [domainPendingUpsell, setDomainPendingUpsell] = useState(false);

  // VPS flow
  const [selectedVpsPlan,   setSelectedVpsPlan]   = useState<VpsPlan | null>(null);
  const [vpsSelectedCycle,  setVpsSelectedCycle]  = useState<"monthly" | "yearly">("yearly");
  const [selectedOsTemplate, setSelectedOsTemplate] = useState<VpsOsTemplate | null>(null);
  const [selectedLocation,  setSelectedLocation]  = useState<VpsLocation | null>(null);

  function setCartDomain(d: CartDomain | null) { setCartDomainRaw(d); saveDomain(d); }

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: groups = [], isLoading: groupsLoading } = useQuery<ProductGroup[]>({
    queryKey: ["product-groups"],
    queryFn: async () => (await fetch("/api/product-groups")).json(),
    enabled: service === "hosting" && step >= 1,
    staleTime: 120_000,
  });

  const { data: allPlans = [], isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["order-plans"],
    queryFn: async () => (await fetch("/api/packages")).json(),
    enabled: service === "hosting" && step >= 1,
    staleTime: 60_000,
  });

  const { data: tldPricing = [] } = useQuery<TldPricing[]>({
    queryKey: ["tld-pricing"],
    queryFn: async () => (await fetch("/api/domains/pricing")).json(),
    enabled: service === "domain" || service === "transfer" || step >= 2,
    staleTime: 300_000,
  });

  const { data: paymentMethods = [] } = useQuery<PaymentMethod[]>({
    queryKey: ["payment-methods"],
    queryFn: async () => (await apiFetch("/api/payment-methods")).json(),
    enabled: step === 3,
    staleTime: 60_000,
  });

  const { data: creditData } = useQuery<{ creditBalance: string }>({
    queryKey: ["my-credits"],
    queryFn: () => apiFetch("/api/my/credits"),
    enabled: step === 3,
    staleTime: 30_000,
  });
  const creditBalance = parseFloat(creditData?.creditBalance ?? "0");

  const { data: vpsPlans = [], isLoading: vpsPlansLoading } = useQuery<VpsPlan[]>({
    queryKey: ["vps-plans"],
    queryFn: () => fetch("/api/vps-plans").then(r => r.json()),
    enabled: service === "vps" || isVpsDirectLink,
    staleTime: 120_000,
  });
  const { data: vpsOsTemplates = [] } = useQuery<VpsOsTemplate[]>({
    queryKey: ["vps-os-templates"],
    queryFn: () => fetch("/api/vps-os-templates").then(r => r.json()),
    enabled: (service === "vps" && step >= 2) || (isVpsDirectLink && step >= 2),
    staleTime: 120_000,
  });
  const { data: vpsLocations = [] } = useQuery<VpsLocation[]>({
    queryKey: ["vps-locations"],
    queryFn: () => fetch("/api/vps-locations").then(r => r.json()),
    enabled: (service === "vps" && step >= 2) || (isVpsDirectLink && step >= 2),
    staleTime: 120_000,
  });

  // ── Direct-link auto-selection effects ────────────────────────────────────

  // /order/group/:id — pre-select the matching group once groups load
  useEffect(() => {
    if (!initialGroupId || groups.length === 0 || selectedGroup) return;
    const grp = groups.find(g => g.id === initialGroupId);
    if (grp) setSelectedGroup(grp);
  }, [initialGroupId, groups, selectedGroup]);

  // /order/add/:id — auto-select plan + yearly cycle + skip to domain step
  useEffect(() => {
    if (!initialPackageId || allPlans.length === 0 || selectedPlan) return;
    const plan = allPlans.find((p, idx) => p.id === initialPackageId || String(idx + 1) === initialPackageId);
    if (!plan) {
      setDirectLinkError(`Package "${initialPackageId}" was not found or is no longer available.`);
      setDirectLinkReady(true);
      return;
    }
    const cycles = (["monthly","quarterly","semiannual","yearly"] as BillingCycle[])
      .filter(c => planPrice(plan, c) > 0);
    const cycle: BillingCycle = cycles.includes("yearly") ? "yearly" : (cycles[0] ?? "yearly");
    setPendingPlan(plan);
    setPendingCycle(cycle);
    setSelectedPlan(plan);
    setSelectedCycle(cycle);
    addItem({ id: plan.id, name: plan.name, price: planPrice(plan, cycle), cycle });
    setDirectLinkReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPackageId, allPlans]);

  // /order/vps/:id — auto-select VPS plan and jump to configure step
  useEffect(() => {
    if (!initialVpsPlanId || vpsPlans.length === 0 || selectedVpsPlan) return;
    const plan = vpsPlans.find(p => p.id === initialVpsPlanId);
    if (plan) {
      setSelectedVpsPlan(plan);
      setVpsSelectedCycle("yearly");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialVpsPlanId, vpsPlans]);

  // ── Derived ───────────────────────────────────────────────────────────────

  // Plans filtered by selected group
  const displayPlans = selectedGroup
    ? allPlans.filter(p => p.groupId === selectedGroup.id)
    : allPlans;

  // Auto-select first group when groups load (only when NOT using initialGroupId)
  if (groups.length > 0 && !selectedGroup && service === "hosting" && !initialGroupId) {
    setSelectedGroup(groups[0]);
  }

  // Whether the user is on a domain-only checkout (no hosting plan in cart)
  const isDomainOnly = !selectedPlan && !!cartDomain;

  // Step completion gates
  const step1Complete = !!pendingPlan;
  const step2Complete = domainMode !== null;
  const _vpsPrice = selectedVpsPlan
    ? (vpsSelectedCycle === "yearly" && selectedVpsPlan.yearlyPrice ? selectedVpsPlan.yearlyPrice : selectedVpsPlan.price)
    : 0;
  const _step3Total = service === "vps" && selectedVpsPlan
    ? Math.max(0, _vpsPrice - promoDiscount)
    : Math.max(0, (selectedPlan ? planPrice(selectedPlan, selectedCycle) : 0) + (isDomForceFree ? 0 : (cartDomain?.price ?? 0)) - promoDiscount);
  const _walletSufficient = paymentMethodId !== "credits" || creditBalance >= _step3Total;
  const step3Complete = !!paymentMethodId && (!!selectedPlan || !!cartDomain || (service === "vps" && !!selectedVpsPlan)) && _walletSufficient;
  const activeCycle   = step >= 2 ? selectedCycle : pendingCycle;
  const showSidebar   = (step >= 1 && (service === "hosting" || service === "vps")) || step === 3;

  function ctaLabel() {
    if (step === 1 && service === "vps") return "Configure Server";
    if (step === 1) return "Continue to Domain Setup";
    if (step === 2 && service === "vps") return "Continue to Payment";
    if (step === 2) return "Continue to Payment";
    if (step === 3) return (isDomainOnly || (service === "vps" && selectedVpsPlan)) ? "Place Order" : isDomainOnly ? "Complete Domain Order" : "Place Order";
    return "Continue";
  }
  function canContinue() {
    if (step === 1 && service === "vps") return !!selectedVpsPlan;
    if (step === 1) return step1Complete;
    if (step === 2 && service === "vps") return !!selectedOsTemplate && !!selectedLocation;
    if (step === 2) return step2Complete;
    if (step === 3) return step3Complete;
    return false;
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  function clickPlan(plan: Plan) {
    if (pendingPlan?.id === plan.id) { setPendingPlan(null); return; }
    setPendingPlan(plan);
    const cycles = planCycles(plan);
    // Default to yearly if available (best value)
    setPendingCycle(cycles.includes("yearly") ? "yearly" : cycles[0]);
  }

  function confirmStep1() {
    if (!pendingPlan) return;
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
    setFreeDomainClaimed(false);
    setDomainMode(null); setCartDomain(null); setDomResults(null);
    setPromoApplied(false); setPromoDiscount(0); setPromoCode(""); setPromoError("");
    setStep(2);
  }

  function removePlan() {
    if (selectedPlan) removeItem(selectedPlan.id);
    setSelectedPlan(null); setPendingPlan(null); setStep(1);
  }

  async function checkDomain() {
    const clean = cleanName(domainQ);
    if (!clean || clean.length < 2) { setDomError("Enter a valid domain name (letters & numbers only)."); return; }
    setDomError(""); setDomChecking(true); setDomResults(null);
    try {
      const r = await apiFetch(`/api/domains/availability?domain=${encodeURIComponent(clean)}`);
      const d = await r.json();
      if (!r.ok) setDomError(d.error || "Check failed.");
      else       setDomResults(d.results ?? []);
    } catch {
      // Offline fallback — show all TLDs
      setDomResults(tldPricing.filter(t => t.registrationPrice > 0).map(t => ({
        tld: t.tld, available: true,
        registrationPrice: t.registrationPrice,
        renewalPrice: t.renewalPrice,
        register2YearPrice: t.register2YearPrice,
        register3YearPrice: t.register3YearPrice,
      })));
    }
    setDomChecking(false);
  }

  function selectDomain(name: string, price: number, mode: DomainMode, originalPrice?: number) {
    // Price is pre-computed by the caller (0 for free-eligible TLDs, market price otherwise)
    setCartDomain({ fullName: name, price, originalPrice: originalPrice ?? price, mode });
    setDomainMode(mode ?? "register");
  }

  function handleSidebarContinue() {
    if (step === 1 && service === "hosting") confirmStep1();
    else if (step === 1 && service === "vps") { if (selectedVpsPlan) setStep(2); }
    else if (step === 2) setStep(3);
    else if (step === 3) { setOrderError(""); orderMutation.mutate(); }
  }

  // ── Promo code validation ──────────────────────────────────────────────────
  async function handleApplyPromo() {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoError("");
    setPromoApplied(false);
    setPromoDiscount(0);
    try {
      const planAmt = selectedPlan ? planPrice(selectedPlan, selectedCycle) : 0;
      const domAmt = isDomForceFree ? 0 : (cartDomain?.price ?? 0);
      const amount = planAmt + domAmt;
      const params = new URLSearchParams({ code: promoCode.trim(), amount: String(amount), serviceType: "hosting" });
      if (selectedPlan?.groupId) params.set("groupId", selectedPlan.groupId);
      if (cartDomain?.fullName) {
        const tld = cartDomain.fullName.includes(".") ? cartDomain.fullName.slice(cartDomain.fullName.indexOf(".")) : "";
        if (tld) params.set("tld", tld);
      }
      const res = await fetch(`/api/promo-codes/validate?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || data.error) { setPromoError(data.error || "Invalid promo code"); return; }
      setPromoDiscount(data.discountAmount ?? 0);
      setPromoApplied(true);
    } catch {
      setPromoError("Failed to validate promo code");
    } finally {
      setPromoLoading(false);
    }
  }

  // ── Order submission ──────────────────────────────────────────────────────

  const orderMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPlan && !cartDomain && !(service === "vps" && selectedVpsPlan)) throw new Error("Nothing in cart");

      const body: Record<string, unknown> = { paymentMethodId };

      // VPS order
      if (service === "vps" && selectedVpsPlan) {
        body.vpsPlanId    = selectedVpsPlan.id;
        body.billingCycle = vpsSelectedCycle;
        body.vpsOsTemplate = selectedOsTemplate ? `${selectedOsTemplate.name} ${selectedOsTemplate.version}` : null;
        body.vpsLocation   = selectedLocation?.countryName ?? null;
        if (promoCode.trim()) body.promoCode = promoCode.trim();
        const r = await apiFetch("/api/checkout", { method: "POST", body: JSON.stringify(body) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Checkout failed");
        return d;
      }

      if (selectedPlan) {
        body.packageId    = selectedPlan.id;
        body.billingCycle = selectedCycle;
      }
      if (promoCode.trim()) body.promoCode = promoCode.trim();
      if (cartDomain) {
        body.domain         = cartDomain.fullName;
        body.registerDomain = cartDomain.mode === "register";
        body.transferDomain = cartDomain.mode === "transfer";
        body.freeDomain     = isDomForceFree;
        body.domainAmount   = isDomForceFree ? 0 : cartDomain.price;
        if (cartDomain.mode === "transfer" && eppCode.trim()) body.eppCode = eppCode.trim();
        if (cartDomain.mode === "register") body.nameservers = domainNs.map(n => n.trim().toLowerCase()).filter(Boolean);
      }

      const r = await apiFetch("/api/checkout", { method: "POST", body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Checkout failed");
      return d;
    },
    onSuccess: (data) => {
      if (selectedPlan) removeItem(selectedPlan.id);
      setCartDomain(null);
      setLocation(`/client/invoices/${data.invoiceId}`);
    },
    onError: (err: Error) => {
      if (err.message === "Unauthorized" || err.message.toLowerCase().includes("unauthorized") || err.message.includes("401")) {
        setLocation(`/client/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      } else {
        setOrderError(err.message);
      }
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 0 — Choose Service
  // ─────────────────────────────────────────────────────────────────────────────

  function renderStep0() {
    const cards = [
      {
        id: "hosting" as ServiceType, popular: true,
        icon: <Server size={26} strokeWidth={1.6} style={{ color: P }}/>,
        title: "Web Hosting",
        desc: "Shared, Reseller, VPS & WordPress with cPanel, WHM, free SSL.",
        bullets: ["cPanel & WHM included", "NVMe SSD Storage", "Free SSL Certificates", "99.9% Uptime SLA"],
      },
      {
        id: "domain" as ServiceType, popular: false,
        icon: <Globe size={24} strokeWidth={1.6} style={{ color: P }}/>,
        title: "Domain Registration",
        desc: "Register from 50+ TLDs at real PKR prices from our admin settings.",
        bullets: ["50+ TLD extensions", "Free WHOIS Privacy", "Auto-renewal available", "Full DNS control"],
      },
      {
        id: "transfer" as ServiceType, popular: false,
        icon: <ArrowRightLeft size={22} strokeWidth={1.6} style={{ color: P }}/>,
        title: "Domain Transfer",
        desc: "Move your domain to Noehost and receive a free 1-year extension.",
        bullets: ["Free 1-year extension", "Keep your domain live", "Simple EPP process", "Lower renewal prices"],
      },
      {
        id: "vps" as ServiceType, popular: false,
        icon: <Cpu size={22} strokeWidth={1.6} style={{ color: P }}/>,
        title: "VPS Hosting",
        desc: "KVM-powered cloud servers with full root access, dedicated IP, and DDoS protection.",
        bullets: ["Full Root Access", "DDoS Protection", "Dedicated IP", "NVMe SSD Storage"],
      },
    ];

    return (
      <motion.div key="s0" {...fade}>
        <div className="text-center mb-8 max-w-xl mx-auto">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">What would you like to order?</h1>
          <p className="text-gray-500 text-[15px]">Choose a service category to get started. We'll guide you step by step.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {cards.map(c => (
            <button key={c.id} onClick={() => { setService(c.id); setStep(1); }}
              className="relative text-left flex flex-col rounded-2xl bg-white transition-all duration-200 focus:outline-none group"
              style={{ border: c.popular ? `2px solid ${P}` : "1px solid #E5E7EB", padding: "24px 20px 20px" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = P; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 24px rgba(112,26,254,0.12)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = c.popular ? P : "#E5E7EB"; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}>
              {c.popular && (
                <div className="absolute -top-3.5 left-5 flex items-center gap-1 px-3 py-0.5 text-white text-[11px] font-bold rounded-full shadow-md" style={{ background: P }}>
                  <Star size={9} strokeWidth={2.5}/> MOST POPULAR
                </div>
              )}
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 shrink-0" style={{ background: "rgba(112,26,254,0.08)" }}>
                {c.icon}
              </div>
              <h3 className="text-[16px] font-bold text-gray-900 mb-1.5">{c.title}</h3>
              <p className="text-[13px] text-gray-500 mb-4 leading-relaxed">{c.desc}</p>
              <ul className="space-y-2 mb-5 flex-1">
                {c.bullets.map(b => (
                  <li key={b} className="flex items-center gap-2 text-[12.5px] text-gray-600">
                    <Check size={11} strokeWidth={2.5} style={{ color: P, flexShrink: 0 }}/>{b}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-1 text-[13px] font-bold mt-auto" style={{ color: P }}>
                Get started <ChevronRight size={13} strokeWidth={2.5}/>
              </div>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-4 mt-8 text-[12px] text-gray-400">
          <span className="flex items-center gap-1.5"><Lock size={11}/> Secure Checkout</span>
          <span>·</span>
          <span>30-day money-back guarantee</span>
          <span>·</span>
          <span>No hidden fees</span>
          <span>·</span>
          <span>PKR pricing</span>
        </div>
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1 — Plan & Billing (Hosting flow)
  // ─────────────────────────────────────────────────────────────────────────────

  function renderStep1Hosting() {
    const pendingCycles = pendingPlan ? planCycles(pendingPlan) : [];

    return (
      <motion.div key="s1-host" {...fade}>
        {!isDirectLink && (
          <button onClick={() => { setStep(0); setService(null); setPendingPlan(null); }}
            className="inline-flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-700 mb-6 font-medium transition-colors">
            <ArrowLeft size={13}/> Back to services
          </button>
        )}
        {initialGroupId && selectedGroup && (
          <div className="mb-5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-semibold border"
            style={{ background: `${P}10`, border: `1px solid ${P}30`, color: P }}>
            <Star size={11} fill={P} stroke="none"/>
            Viewing: {selectedGroup.name}
          </div>
        )}
        <div className="text-center mb-7">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-1.5">Choose Your Hosting Plan</h2>
          <p className="text-[14px] text-gray-500">Click a plan, then confirm your billing period below.</p>
        </div>

        {/* ── Product Group Tabs (from DB) ── */}
        {groupsLoading ? (
          <div className="flex justify-center mb-6"><Loader2 size={16} className="animate-spin text-gray-300"/></div>
        ) : groups.length > 0 ? (
          <div className="overflow-x-auto mb-2 -mx-1 px-1">
            <div className="flex gap-2 justify-center min-w-max">
              {groups.map(g => (
                <button key={g.id}
                  onClick={() => { setSelectedGroup(g); setPendingPlan(null); }}
                  className="px-4 py-2.5 rounded-xl text-[13px] font-semibold border transition-all whitespace-nowrap focus:outline-none"
                  style={selectedGroup?.id === g.id
                    ? { background: P, color: "#fff", border: `1px solid ${P}`, boxShadow: `0 2px 12px ${P}40` }
                    : { background: "#fff", color: "#4B5563", border: "1px solid #E5E7EB" }}>
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {selectedGroup?.description && (
          <p className="text-center text-[12px] text-gray-400 mb-6">{selectedGroup.description}</p>
        )}

        {/* ── Plan Cards ── */}
        {plansLoading ? (
          <div className="flex flex-col items-center py-20 gap-3">
            <Loader2 size={28} className="animate-spin" style={{ color: P }}/>
            <p className="text-[13px] text-gray-400">Loading plans…</p>
          </div>
        ) : displayPlans.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl bg-white max-w-lg mx-auto">
            <Server size={32} className="mx-auto mb-3 text-gray-200"/>
            <p className="text-[14px] font-semibold text-gray-400">No plans in this category</p>
            <p className="text-[12px] text-gray-300 mt-1">Check back later or choose a different category above.</p>
          </div>
        ) : (
          <div className={`grid gap-4 ${
            displayPlans.length === 1 ? "max-w-xs mx-auto" :
            displayPlans.length === 2 ? "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto" :
            "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          }`}>
            {displayPlans.map((plan, idx) => {
              const isRec   = displayPlans.length > 1 && idx === Math.floor(displayPlans.length / 2);
              const isSel   = pendingPlan?.id === plan.id;
              const monthly = plan.price;
              const dispPrice = planPrice(plan, isSel ? pendingCycle : "monthly");

              return (
                <button key={plan.id} onClick={() => clickPlan(plan)}
                  className="relative flex flex-col text-left rounded-2xl bg-white transition-all focus:outline-none"
                  style={{
                    border: isSel ? `2px solid ${P}` : isRec ? `2px solid ${P}` : "1px solid #E5E7EB",
                    boxShadow: isSel ? `0 0 0 4px ${P}18, 0 8px 24px ${P}16` : isRec ? `0 4px 20px ${P}14` : "",
                  }}>

                  {/* Badge */}
                  {(isRec || isSel) && !isSel && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap px-3.5 py-1 text-white text-[11px] font-bold rounded-full shadow-md flex items-center gap-1" style={{ background: P }}>
                      <Star size={9} strokeWidth={3}/> Recommended
                    </div>
                  )}
                  {isSel && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap px-3.5 py-1 text-white text-[11px] font-bold rounded-full shadow-md flex items-center gap-1" style={{ background: P }}>
                      <Check size={10} strokeWidth={2.5}/> Selected — Pick Billing Below
                    </div>
                  )}

                  {/* Header */}
                  <div className={`px-5 pt-7 pb-4 ${isSel ? "border-b border-[#701AFE]/15" : "border-b border-gray-100"}`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-[15px] font-bold text-gray-900">{plan.name}</h3>
                      {isRec && !isSel && <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: P }}>Best Value</span>}
                    </div>
                    {plan.description && <p className="text-[12px] text-gray-400 mb-2">{plan.description}</p>}
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {plan.freeDomainEnabled && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 w-fit">
                          <Gift size={11}/> Free domain with Yearly
                        </div>
                      )}
                      {(() => {
                        const manualSave = (plan as any).saveAmount;
                        const yearlyP = planPrice(plan, "yearly");
                        const autoSave = (plan.price > 0 && yearlyP > 0) ? (plan.price * 12) - yearlyP : 0;
                        const displaySave = manualSave > 0 ? Number(manualSave) : autoSave;
                        return displaySave > 0 ? (
                          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-white w-fit"
                            style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
                            Save {formatPrice(displaySave)}
                          </div>
                        ) : null;
                      })()}
                    </div>
                    <div className="flex items-end gap-1 mt-3">
                      <span className="text-[38px] font-extrabold text-gray-900 leading-none">{formatPrice(monthly)}</span>
                      <span className="text-[13px] text-gray-400 mb-1.5">/mo</span>
                    </div>
                    <p className="text-[11px] text-gray-400">Starting price · billing cycle selected below</p>
                  </div>

                  {/* Features */}
                  <div className="px-5 py-4 flex-1">
                    <ul className="space-y-2.5">
                      <Feat text={`${plan.diskSpace} NVMe SSD Storage`}/>
                      <Feat text={`${plan.bandwidth} Bandwidth`}/>
                      <Feat text={`${plan.emailAccounts ?? "Unlimited"} Email Accounts`}/>
                      <Feat text={`${plan.databases ?? "Unlimited"} MySQL Databases`}/>
                      {(plan.features ?? []).slice(0, 4).map(f => <Feat key={f} text={f}/>)}
                    </ul>
                  </div>

                  <div className="px-5 pb-5">
                    <div className={`w-full py-2.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-1.5 transition-all`}
                      style={isSel
                        ? { background: P, color: "#fff" }
                        : { background: "#F8F9FA", color: P, border: `1.5px solid ${P}30` }}>
                      {isSel ? <><Check size={13} strokeWidth={2.5}/> Selected</> : "Select Plan"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Billing Cycle Panel ── slides in after plan click ── */}
        <AnimatePresence>
          {pendingPlan && (
            <motion.div key="billing" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="mt-6">
              <div className="p-5 bg-white rounded-2xl border-2" style={{ borderColor: P }}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1 h-5 rounded-full" style={{ background: P }}/>
                  <h3 className="text-[14px] font-bold text-gray-900">
                    Billing Cycle for <span style={{ color: P }}>{pendingPlan.name}</span>
                  </h3>
                </div>
                <p className="text-[12px] text-gray-400 mb-4 ml-3">Annual plans include the biggest discounts and best value.</p>

                <div className={`grid gap-3 ${pendingCycles.length <= 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
                  {pendingCycles.map(c => {
                    const price   = planPrice(pendingPlan, c);
                    const months  = cycleMonths(c);
                    const pct     = savingsPct(pendingPlan.price, price, months);
                    const isYearly = c === "yearly";
                    const chosen  = pendingCycle === c;
                    return (
                      <button key={c} onClick={() => setPendingCycle(c)}
                        className="relative flex flex-col items-center p-4 rounded-2xl border-2 transition-all focus:outline-none"
                        style={chosen ? { borderColor: P, background: `${P}08` } : { borderColor: "#E5E7EB", background: "#fff" }}>
                        {/* Best value / save badge */}
                        {isYearly && (
                          <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-0.5 text-[10px] font-bold rounded-full text-white shadow"
                            style={{ background: "#16a34a" }}>
                            {pct > 0 ? `Save ${pct}%` : "Best Value"}
                          </span>
                        )}
                        {!isYearly && pct > 0 && (
                          <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-0.5 text-[10px] font-bold rounded-full text-white shadow"
                            style={{ background: "#6b7280" }}>
                            Save {pct}%
                          </span>
                        )}
                        <span className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: chosen ? P : "#6B7280" }}>
                          {CYCLE_LABELS[c]}
                        </span>
                        <span className="text-[22px] font-extrabold leading-none mb-0.5" style={{ color: chosen ? P : "#111" }}>
                          {formatPrice(price)}
                        </span>
                        <span className="text-[11px]" style={{ color: chosen ? P : "#9CA3AF" }}>{CYCLE_SUFFIX[c]}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Free domain note */}
                {pendingPlan.freeDomainEnabled && pendingCycle === "yearly" && (
                  <div className="mt-4 flex items-center gap-2.5 p-3 rounded-xl border border-green-200 bg-green-50 text-green-700 text-[12.5px]">
                    <Gift size={15} className="shrink-0"/>
                    <div>
                      <span className="font-bold">You qualify for a FREE domain!</span>
                      <span className="text-green-600 ml-1">Choose it in the Domain step.</span>
                    </div>
                  </div>
                )}

                {/* Renewal note */}
                {pendingPlan.renewalPrice && (
                  <p className="mt-3 text-[11px] text-gray-400 flex items-center gap-1.5">
                    <RefreshCw size={10}/> Renews at {formatPrice(pendingPlan.renewalPrice)}/year after first term.
                  </p>
                )}

                <div className="flex justify-end mt-5">
                  <PrimaryBtn label="Confirm Plan & Continue" onClick={confirmStep1}/>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!pendingPlan && displayPlans.length > 0 && (
          <p className="text-center text-[12px] text-gray-400 mt-6 flex items-center justify-center gap-2">
            <Shield size={12}/> 30-day money-back guarantee · Cancel anytime
          </p>
        )}
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1 — Domain Search flow
  // ─────────────────────────────────────────────────────────────────────────────

  function renderStep1Domain() {
    const searched = domResults ? cleanName(domainQ) : "";

    return (
      <motion.div key="s1-dom" {...fade}>
        <button onClick={() => { setStep(0); setService(null); setDomResults(null); }}
          className="inline-flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-700 mb-6 font-medium transition-colors">
          <ArrowLeft size={13}/> Back
        </button>
        <div className="text-center mb-7">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-1.5">Find Your Domain</h2>
          <p className="text-[14px] text-gray-500">Prices are from our admin TLD settings — always up to date.</p>
        </div>
        <div className="max-w-2xl mx-auto mb-7">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input value={domainQ} onChange={e => { setDomainQ(e.target.value); setDomResults(null); }}
                onKeyDown={e => e.key === "Enter" && checkDomain()}
                placeholder="mybrand, mystore, yourbusiness…"
                className="w-full pl-11 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-[14px] focus:outline-none transition-all"
                onFocus={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.boxShadow = `0 0 0 3px ${P}20`; }}
                onBlur={e  => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = ""; }}
                autoFocus/>
            </div>
            <button onClick={checkDomain} disabled={domChecking || !domainQ.trim()}
              className="w-full sm:w-auto px-6 py-3.5 text-white rounded-xl text-[14px] font-bold flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: P, boxShadow: PSHADOW }}>
              {domChecking ? <Loader2 size={16} className="animate-spin"/> : <Search size={16}/>}
              Check Availability
            </button>
          </div>
          {domError && <p className="mt-2 text-[13px] text-red-500 flex items-center gap-1.5"><AlertCircle size={13}/> {domError}</p>}
        </div>

        {/* Idle TLD price pills */}
        {!domResults && !domChecking && tldPricing.length > 0 && (
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-[11px] text-gray-400 uppercase tracking-widest font-bold mb-3">Popular Extensions</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {tldPricing.slice(0, 12).map(t => (
                <span key={t.tld} className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-[12px]">
                  <span className="font-bold text-gray-800">{t.tld}</span>
                  <span className="text-gray-400 ml-1">{formatPrice(t.registrationPrice)}/yr</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {domChecking && <div className="text-center py-12"><Loader2 size={24} className="animate-spin mx-auto" style={{ color: P }}/></div>}

        {domResults && !domChecking && (
          <motion.div {...slideUp} className="max-w-2xl mx-auto space-y-2">
            {domResults.filter(r => r.registrationPrice > 0).slice(0, 10).map(r => (
              <div key={r.tld}
                className={`flex items-center gap-3 justify-between px-4 py-3.5 bg-white rounded-xl border transition-all ${
                  r.available ? "border-gray-200 hover:border-[#701AFE]/30" : "border-gray-100 opacity-50"
                }`}>
                <div className="flex items-center gap-0.5 flex-1 min-w-0">
                  <span className="text-[15px] font-bold text-gray-900">{searched}</span>
                  <span className="text-[15px] font-bold" style={{ color: P }}>{r.tld}</span>
                </div>
                <div className="shrink-0">
                  {r.available
                    ? <span className="flex items-center gap-1 text-[11px] font-bold text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full"><Check size={10} strokeWidth={2.5}/> Available</span>
                    : <span className="text-[11px] font-bold text-red-400 bg-red-50 border border-red-100 px-2.5 py-1 rounded-full">Taken</span>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-[14px] font-extrabold text-gray-900">{formatPrice(r.registrationPrice)}/yr</p>
                    <p className="text-[10px] text-gray-400">Renews {formatPrice(r.renewalPrice)}/yr</p>
                  </div>
                  {r.available && (
                    <button
                      onClick={() => {
                        selectDomain(`${searched}${r.tld}`, r.registrationPrice, "register");
                        setDomainPendingUpsell(true);
                      }}
                      className="px-4 py-2 text-white text-[12px] font-bold rounded-xl flex items-center gap-1.5 hover:opacity-90 transition-all"
                      style={{ background: P }}>
                      <ShoppingCart size={13}/> Add to Cart
                    </button>
                  )}
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* ── Upsell: "Add hosting?" after domain is added to cart ── */}
        <AnimatePresence>
          {domainPendingUpsell && cartDomain && (
            <motion.div key="upsell" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
              className="mt-6 p-5 bg-white rounded-2xl border-2" style={{ borderColor: P }}>
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${P}12` }}>
                  <CheckCircle2 size={22} className="text-green-500"/>
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-bold text-gray-900 mb-0.5">
                    <span className="font-extrabold" style={{ color: P }}>{cartDomain.fullName}</span> added to cart!
                  </p>
                  <p className="text-[13px] text-gray-500 mb-4">Would you also like to add web hosting for this domain?</p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => { setDomainPendingUpsell(false); setService("hosting"); }}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all"
                      style={{ background: P, boxShadow: PSHADOW }}>
                      <Server size={14}/> Yes, Add Hosting
                    </button>
                    <button
                      onClick={() => { setDomainPendingUpsell(false); setStep(3); }}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold border border-gray-200 text-gray-600 hover:border-gray-300 transition-all">
                      <Receipt size={14}/> No, Go to Checkout
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1 — Transfer flow
  // ─────────────────────────────────────────────────────────────────────────────

  function renderStep1Transfer() {
    function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      if (!txDomain.includes(".") || !eppCode.trim()) return;
      sessionStorage.setItem("transfer_epp", eppCode);
      // Look up the authoritative transfer price from TLD pricing table
      const tld = txDomain.slice(txDomain.indexOf(".")).toLowerCase();
      const tldRow = tldPricing.find(t => t.tld === tld);
      const transferPrice = tldRow?.transferPrice ?? tldRow?.registrationPrice ?? 0;
      selectDomain(txDomain, transferPrice, "transfer");
      setDomainPendingUpsell(true);
    }
    return (
      <motion.div key="s1-tx" {...fade}>
        <button onClick={() => { setStep(0); setService(null); }}
          className="inline-flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-700 mb-6 font-medium transition-colors">
          <ArrowLeft size={13}/> Back
        </button>
        <div className="text-center mb-7">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-1.5">Domain Transfer</h2>
          <p className="text-[14px] text-gray-500">Transfer to Noehost and receive a free 1-year extension.</p>
        </div>
        <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Domain Name</label>
            <div className="relative">
              <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input value={txDomain} onChange={e => setTxDomain(e.target.value)} placeholder="example.com" autoFocus
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-[14px] focus:outline-none"
                onFocus={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.boxShadow = `0 0 0 3px ${P}20`; }}
                onBlur={e  => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = ""; }}/>
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">EPP / Authorization Code</label>
            <div className="relative">
              <Key size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input value={eppCode} onChange={e => setEppCode(e.target.value)} placeholder="Paste EPP code here"
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-[14px] font-mono focus:outline-none"
                onFocus={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.boxShadow = `0 0 0 3px ${P}20`; }}
                onBlur={e  => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = ""; }}/>
            </div>
            <p className="text-[12px] text-gray-400 mt-1">Available from your current registrar's control panel.</p>
          </div>
          <div className="p-4 rounded-xl text-[12.5px] text-gray-600" style={{ background: "#FAF8FF", border: "1px solid #EDE9FF" }}>
            <p className="font-bold mb-2" style={{ color: P }}>What happens next?</p>
            <ol className="list-decimal list-inside space-y-1 text-gray-500">
              <li>We verify your domain & EPP code</li>
              <li>You confirm payment in PKR</li>
              <li>Transfer completes in 5–7 days</li>
              <li>Domain gets a free 1-year extension</li>
            </ol>
          </div>
          <button type="submit" disabled={!txDomain.includes(".") || !eppCode.trim()}
            className="w-full py-3.5 text-white rounded-xl text-[14px] font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
            style={{ background: P, boxShadow: PSHADOW }}>
            <ArrowRightLeft size={15}/> Continue with Transfer
          </button>
        </form>

        {/* ── Upsell: "Add hosting?" after transfer domain is added ── */}
        <AnimatePresence>
          {domainPendingUpsell && cartDomain && (
            <motion.div key="tx-upsell" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
              className="mt-6 p-5 bg-white rounded-2xl border-2" style={{ borderColor: P }}>
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${P}12` }}>
                  <CheckCircle2 size={22} className="text-green-500"/>
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-bold text-gray-900 mb-0.5">
                    Transfer for <span className="font-extrabold" style={{ color: P }}>{cartDomain.fullName}</span> queued!
                  </p>
                  <p className="text-[13px] text-gray-500 mb-4">Would you also like to add hosting for this domain?</p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => { setDomainPendingUpsell(false); setService("hosting"); }}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all"
                      style={{ background: P, boxShadow: PSHADOW }}>
                      <Server size={14}/> Yes, Add Hosting
                    </button>
                    <button
                      onClick={() => { setDomainPendingUpsell(false); setStep(3); }}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold border border-gray-200 text-gray-600 hover:border-gray-300 transition-all">
                      <Receipt size={14}/> No, Go to Checkout
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // VPS — STEP 1: Choose Plan  (Hostinger-style)
  // ─────────────────────────────────────────────────────────────────────────────

  function renderStep1Vps() {
    const allPlans = vpsPlans;
    const midIdx   = Math.floor(allPlans.length / 2);

    // Compute save-percentage for the yearly toggle badge
    const maxSavePct = allPlans.reduce((best, plan) => {
      if (!plan.yearlyPrice || !plan.price) return best;
      const pct = Math.round((1 - plan.yearlyPrice / (plan.price * 12)) * 100);
      return pct > best ? pct : best;
    }, 0);

    return (
      <motion.div key="vps1" {...fade}>
        {/* Hero header */}
        <div className="text-center mb-8 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 text-[12px] font-bold px-4 py-1.5 rounded-full mb-4 border border-purple-200">
            <Zap size={11} className="fill-current"/> KVM-Powered Cloud Servers
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-3 leading-tight">
            High-Performance <span style={{ color: P }}>VPS Hosting</span>
          </h1>
          <p className="text-gray-500 text-[15px]">
            Full root access · Dedicated IP · DDoS protection · Instant setup
          </p>
        </div>

        {vpsPlansLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {[1,2,3].map(i => <div key={i} className="h-80 bg-gray-100 rounded-3xl animate-pulse"/>)}
          </div>
        ) : allPlans.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Server size={36} className="mx-auto mb-3 opacity-30"/>
            No VPS plans available yet. Please check back soon.
          </div>
        ) : (
          <>
            {/* Billing cycle toggle — prominent with save badge */}
            <div className="flex flex-col items-center gap-2 mb-8">
              <div className="inline-flex bg-gray-100 rounded-2xl p-1.5 gap-1">
                <button onClick={() => setVpsSelectedCycle("monthly")}
                  className="relative px-8 py-2.5 rounded-xl text-[13px] font-bold transition-all"
                  style={vpsSelectedCycle === "monthly"
                    ? { background: "#fff", color: "#111", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }
                    : { color: "#9CA3AF" }}>
                  Monthly
                </button>
                <button onClick={() => setVpsSelectedCycle("yearly")}
                  className="relative px-8 py-2.5 rounded-xl text-[13px] font-bold transition-all"
                  style={vpsSelectedCycle === "yearly"
                    ? { background: P, color: "#fff", boxShadow: PSHADOW }
                    : { color: "#9CA3AF" }}>
                  Yearly
                  {maxSavePct > 0 && (
                    <span className="absolute -top-2.5 -right-2.5 text-[10px] font-extrabold bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded-full leading-none">
                      -{maxSavePct}%
                    </span>
                  )}
                </button>
              </div>
              {vpsSelectedCycle === "yearly" && maxSavePct > 0 && (
                <motion.p {...fade} className="text-[12px] text-green-600 font-semibold flex items-center gap-1">
                  <Check size={11} strokeWidth={2.5}/> You save up to {maxSavePct}% with annual billing
                </motion.p>
              )}
            </div>

            {/* Plan cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto items-stretch">
              {allPlans.map((plan, i) => {
                const monthlyPrice = plan.price;
                const yearlyPrice  = plan.yearlyPrice;
                const displayPrice = vpsSelectedCycle === "yearly" && yearlyPrice ? yearlyPrice : monthlyPrice;
                const monthlyEquiv = vpsSelectedCycle === "yearly" && yearlyPrice ? yearlyPrice / 12 : monthlyPrice;
                const saveAmt      = plan.saveAmount ?? (yearlyPrice != null ? Math.max(0, monthlyPrice * 12 - yearlyPrice) : null);
                const savePct      = yearlyPrice && monthlyPrice ? Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100) : 0;
                const isSelected   = selectedVpsPlan?.id === plan.id;
                const isPopular    = i === midIdx && allPlans.length > 1;

                return (
                  <motion.button key={plan.id}
                    onClick={() => setSelectedVpsPlan(isSelected ? null : plan)}
                    className="relative flex flex-col rounded-3xl text-left focus:outline-none overflow-hidden"
                    style={isPopular
                      ? {
                          background: `linear-gradient(145deg, #7B2FFF 0%, #5010D0 60%, #3D0BA8 100%)`,
                          boxShadow: `0 20px 60px ${P}45`,
                          border: isSelected ? "2.5px solid #fff" : "2.5px solid rgba(255,255,255,0.25)",
                          padding: "32px 24px 24px",
                        }
                      : {
                          background: isSelected ? `linear-gradient(145deg, ${P}08, ${P}03)` : "#fff",
                          border: isSelected ? `2.5px solid ${P}` : "1.5px solid #E5E7EB",
                          boxShadow: isSelected ? `0 12px 40px ${P}22` : "0 2px 8px rgba(0,0,0,0.04)",
                          padding: "24px 20px 20px",
                        }}
                    whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.18 }}>

                    {/* Popular ribbon */}
                    {isPopular && (
                      <div className="absolute top-0 left-0 right-0 py-1.5 text-center text-[10.5px] font-extrabold text-white/90 uppercase tracking-widest"
                        style={{ background: "rgba(255,255,255,0.12)", letterSpacing: "0.12em" }}>
                        ⚡ Most Popular
                      </div>
                    )}
                    {isPopular && <div className="h-5"/>}

                    {/* Selected badge */}
                    {isSelected && (
                      <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold"
                        style={{ background: isPopular ? "rgba(255,255,255,0.25)" : P, color: "#fff" }}>
                        <Check size={8}/> Selected
                      </div>
                    )}

                    {/* Yearly save badge */}
                    {!isSelected && vpsSelectedCycle === "yearly" && savePct > 0 && (
                      <div className="absolute top-3 right-3 text-[10px] font-extrabold px-2 py-0.5 rounded-full"
                        style={isPopular
                          ? { background: "rgba(255,220,50,0.9)", color: "#7a4200" }
                          : { background: "#FEF3C7", color: "#92400E" }}>
                        Save {savePct}%
                      </div>
                    )}

                    {/* Plan header */}
                    <div className="mb-4">
                      <h3 className={`text-[15px] font-extrabold mb-1 ${isPopular ? "text-white" : "text-gray-900"}`}>
                        {plan.name}
                      </h3>
                      {plan.description && (
                        <p className={`text-[11.5px] leading-snug ${isPopular ? "text-white/70" : "text-gray-400"}`}>
                          {plan.description}
                        </p>
                      )}
                    </div>

                    {/* Price block */}
                    <div className="mb-5">
                      {vpsSelectedCycle === "yearly" && yearlyPrice && monthlyPrice > 0 && (
                        <div className={`text-[11.5px] line-through mb-0.5 ${isPopular ? "text-white/50" : "text-gray-400"}`}>
                          {formatPrice(monthlyPrice)}/mo
                        </div>
                      )}
                      <div className="flex items-end gap-1.5">
                        <span className={`text-[36px] font-extrabold leading-none tracking-tight ${isPopular ? "text-white" : "text-gray-900"}`}>
                          {formatPrice(monthlyEquiv)}
                        </span>
                        <span className={`text-[13px] font-medium mb-1 ${isPopular ? "text-white/70" : "text-gray-400"}`}>/mo</span>
                      </div>
                      {vpsSelectedCycle === "yearly" && yearlyPrice && (
                        <div className={`text-[11px] mt-1 font-medium ${isPopular ? "text-white/75" : "text-gray-400"}`}>
                          Billed {formatPrice(yearlyPrice)}/year
                          {saveAmt != null && saveAmt > 0 && (
                            <span className={`ml-1.5 font-extrabold ${isPopular ? "text-yellow-300" : "text-green-600"}`}>
                              · Save {formatPrice(saveAmt)}
                            </span>
                          )}
                        </div>
                      )}
                      {vpsSelectedCycle === "monthly" && (
                        <div className={`text-[10.5px] mt-1 ${isPopular ? "text-white/60" : "text-gray-400"}`}>
                          Billed monthly · No contract
                        </div>
                      )}
                    </div>

                    {/* Specs — 2×2 grid */}
                    <div className="grid grid-cols-2 gap-2 mb-5">
                      {[
                        { icon: Cpu,          label: `${plan.cpuCores} vCPU${plan.cpuCores !== 1 ? "s" : ""}` },
                        { icon: MemoryStick,  label: `${plan.ramGb} GB RAM` },
                        { icon: HardDrive,    label: `${plan.storageGb} GB NVMe` },
                        { icon: Wifi,         label: `${plan.bandwidthTb ?? 1} TB BW` },
                      ].map(({ icon: Icon, label }) => (
                        <div key={label} className="flex items-center gap-1.5 rounded-xl px-2.5 py-2"
                          style={isPopular
                            ? { background: "rgba(255,255,255,0.12)" }
                            : { background: `${P}09`, border: `1px solid ${P}18` }}>
                          <Icon size={12} className={isPopular ? "text-white/80" : ""} style={isPopular ? {} : { color: P }} />
                          <span className={`text-[11.5px] font-semibold ${isPopular ? "text-white/90" : "text-gray-700"}`}>{label}</span>
                        </div>
                      ))}
                    </div>

                    {/* KVM badge */}
                    <div className={`text-[10px] font-bold uppercase tracking-widest mb-4 ${isPopular ? "text-white/50" : "text-gray-400"}`}>
                      {plan.virtualization ?? "KVM"} Virtualization
                    </div>

                    {/* Features list */}
                    <div className="space-y-2 mb-5 flex-1">
                      {plan.features.slice(0, 5).map(f => (
                        <div key={f} className={`flex items-center gap-2 text-[12px] ${isPopular ? "text-white/85" : "text-gray-600"}`}>
                          <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                            style={isPopular ? { background: "rgba(255,255,255,0.2)" } : { background: `${P}18` }}>
                            <Check size={9} strokeWidth={2.5} className={isPopular ? "text-white" : ""} style={isPopular ? {} : { color: P }}/>
                          </div>
                          {f}
                        </div>
                      ))}
                    </div>

                    {/* CTA button */}
                    <div className="w-full py-3 rounded-2xl text-[13px] font-extrabold text-center transition-all mt-auto"
                      style={isPopular
                        ? (isSelected
                            ? { background: "rgba(255,255,255,0.25)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.5)" }
                            : { background: "#fff", color: P })
                        : (isSelected
                            ? { background: P, color: "#fff", boxShadow: PSHADOW }
                            : { background: `${P}10`, color: P, border: `1.5px solid ${P}30` })}>
                      {isSelected ? "✓ Plan Selected" : "Get Started →"}
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Trust bar */}
            <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 mt-10 text-[12px] text-gray-400">
              {[
                { icon: Shield, text: "DDoS Protected" },
                { icon: Zap,    text: "Instant Setup" },
                { icon: Key,    text: "Full Root Access" },
                { icon: Lock,   text: "30-Day Guarantee" },
                { icon: Globe,  text: "99.9% Uptime SLA" },
              ].map(({ icon: Icon, text }) => (
                <span key={text} className="flex items-center gap-1.5">
                  <Icon size={11} style={{ color: P }}/> {text}
                </span>
              ))}
            </div>
          </>
        )}
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // VPS — STEP 2: Configure Server (OS + Location)
  // ─────────────────────────────────────────────────────────────────────────────

  function renderStep2Vps() {
    const allOs = vpsOsTemplates.length > 0 ? vpsOsTemplates : [
      { id: "ubuntu-22", name: "Ubuntu", version: "22.04 LTS", iconUrl: "https://cdn.simpleicons.org/ubuntu/E95420" },
      { id: "ubuntu-20", name: "Ubuntu", version: "20.04 LTS", iconUrl: "https://cdn.simpleicons.org/ubuntu/E95420" },
      { id: "debian-12", name: "Debian", version: "12 Bookworm", iconUrl: "https://cdn.simpleicons.org/debian/A81D33" },
      { id: "centos-9",  name: "CentOS", version: "Stream 9",    iconUrl: "https://cdn.simpleicons.org/centos/262577" },
      { id: "win-2022",  name: "Windows Server", version: "2022", iconUrl: "https://cdn.simpleicons.org/windows/0078D4" },
    ];
    const allLocs = vpsLocations.length > 0 ? vpsLocations : [
      { id: "us", countryName: "United States", countryCode: "US", flagIcon: "🇺🇸" },
      { id: "de", countryName: "Germany",        countryCode: "DE", flagIcon: "🇩🇪" },
      { id: "gb", countryName: "United Kingdom", countryCode: "GB", flagIcon: "🇬🇧" },
      { id: "sg", countryName: "Singapore",      countryCode: "SG", flagIcon: "🇸🇬" },
    ];
    return (
      <motion.div key="vps2" {...fade}>
        <div className="text-center mb-6 max-w-xl mx-auto">
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Configure Your Server</h1>
          <p className="text-gray-500 text-[14px]">Choose the operating system and data center location for your VPS.</p>
        </div>

        {/* OS Selection */}
        <div className="mb-8">
          <h2 className="text-[15px] font-bold text-gray-800 mb-3 flex items-center gap-2">
            <MonitorCog size={16} style={{ color: P }}/> Operating System
            {selectedOsTemplate && <span className="text-[12px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓ {selectedOsTemplate.name} {selectedOsTemplate.version}</span>}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {allOs.map(os => {
              const isSelected = selectedOsTemplate?.id === os.id;
              return (
                <button key={os.id} onClick={() => setSelectedOsTemplate(isSelected ? null : os as VpsOsTemplate)}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl border bg-white text-center transition-all duration-200"
                  style={isSelected
                    ? { border: `2px solid ${P}`, background: `${P}08`, boxShadow: `0 4px 16px ${P}20` }
                    : { border: "1px solid #E5E7EB" }}>
                  {os.iconUrl ? (
                    <img src={os.iconUrl} alt={os.name} className="w-9 h-9 object-contain"/>
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-gray-200 flex items-center justify-center text-gray-400">
                      <MonitorCog size={16}/>
                    </div>
                  )}
                  <div>
                    <div className="text-[12.5px] font-bold text-gray-800">{os.name}</div>
                    <div className="text-[11px] text-gray-400">{os.version}</div>
                  </div>
                  {isSelected && <div className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: P }}>Selected</div>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Location Selection */}
        <div className="mb-8">
          <h2 className="text-[15px] font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Globe size={16} style={{ color: P }}/> Data Center Location
            {selectedLocation && <span className="text-[12px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓ {selectedLocation.countryName}</span>}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {allLocs.map(loc => {
              const isSelected = selectedLocation?.id === loc.id;
              return (
                <button key={loc.id} onClick={() => setSelectedLocation(isSelected ? null : loc as VpsLocation)}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border bg-white text-left transition-all duration-200"
                  style={isSelected
                    ? { border: `2px solid ${P}`, background: `${P}08`, boxShadow: `0 4px 16px ${P}20` }
                    : { border: "1px solid #E5E7EB" }}>
                  <span className="text-[24px] leading-none">{loc.flagIcon ?? "🌐"}</span>
                  <div>
                    <div className="text-[12.5px] font-bold text-gray-800">{loc.countryName}</div>
                    <div className="text-[11px] text-gray-400">{loc.countryCode}</div>
                  </div>
                  {isSelected && <Check size={12} style={{ color: P }} className="ml-auto shrink-0"/>}
                </button>
              );
            })}
          </div>
        </div>

        {(!selectedOsTemplate || !selectedLocation) && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[12.5px] text-amber-700 flex items-center gap-2">
            <AlertCircle size={13}/>
            {!selectedOsTemplate && !selectedLocation
              ? "Please select an OS and a data center location to continue."
              : !selectedOsTemplate ? "Please select an operating system."
              : "Please select a data center location."}
          </div>
        )}
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 2 — Domain Setup
  // ─────────────────────────────────────────────────────────────────────────────

  function renderStep2() {
    const searched = domResults ? cleanName(domainQ) : "";

    return (
      <motion.div key="s2" {...fade}>
        <button onClick={() => { setStep(1); setDomainMode(null); setDomResults(null); }}
          className="inline-flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-700 mb-6 font-medium transition-colors">
          <ArrowLeft size={13}/> Back to plan
        </button>

        {/* Plan confirmation */}
        <div className="flex items-center gap-3 p-3.5 mb-7 bg-green-50 border border-green-200 rounded-xl max-w-lg">
          <CheckCircle2 size={17} className="text-green-500 shrink-0"/>
          <div>
            <p className="text-[13px] font-semibold text-green-800">{selectedPlan?.name} · {CYCLE_LABELS[selectedCycle]} plan added</p>
            <p className="text-[12px] text-green-600">Now set up your domain.</p>
          </div>
        </div>

        <div className="text-center mb-7">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-1.5">Domain Setup</h2>
          <p className="text-[14px] text-gray-500">Choose how to connect a domain to your hosting plan.</p>
        </div>

        {/* Option cards — free domain-aware */}
        {!domainMode && (
          <div className={`grid grid-cols-1 gap-3 mb-5 ${freeDomainEligible ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
            {/* Free domain card — only when eligible */}
            {freeDomainEligible && (
              <button
                onClick={() => { setFreeDomainClaimed(true); setDomainMode("register"); setDomResults(null); }}
                className="text-left rounded-2xl p-5 transition-all focus:outline-none col-span-1 sm:col-span-2 border-2"
                style={{ background: "linear-gradient(135deg,#f0fdf4,#dcfce7)", borderColor: "#16a34a" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(22,163,74,0.18)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = ""; }}>
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                    <Gift size={22} className="text-green-600"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-[15px] font-extrabold text-green-900">🎁 Claim My Free Domain</h3>
                      <span className="text-[10px] font-bold text-white bg-green-600 px-2 py-0.5 rounded-full">FREE</span>
                    </div>
                    <p className="text-[12.5px] text-green-700 leading-relaxed">
                      Your yearly plan includes one free domain registration.
                      {(() => {
                        const _planTlds = selectedPlan?.freeDomainTlds ?? [];
                        const _effTlds = _planTlds.length > 0 ? _planTlds : [".com", ".net", ".org", ".pk", ".net.pk", ".org.pk", ".co"];
                        return ` Eligible extensions: ${_effTlds.join(", ")}`;
                      })()}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-[20px] font-extrabold text-green-600">FREE</span>
                    <p className="text-[10px] text-green-500">1st year included</p>
                  </div>
                </div>
              </button>
            )}

            {/* Register with payment */}
            <button
              onClick={() => { setFreeDomainClaimed(false); setDomainMode("register"); setDomResults(null); }}
              className="text-left bg-white border border-gray-200 rounded-2xl p-5 transition-all focus:outline-none"
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = P; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 16px rgba(112,26,254,0.10)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#E5E7EB"; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "rgba(112,26,254,0.08)" }}>
                <Search size={18} style={{ color: P }}/>
              </div>
              <h3 className="text-[14px] font-bold text-gray-900 mb-1">Register New Domain</h3>
              <p className="text-[12px] text-gray-500 leading-relaxed">
                {freeDomainEligible ? "Pay & register a different domain (keep free domain for later)." : "Search and register a new domain."}
              </p>
            </button>

            {/* Transfer */}
            <button
              onClick={() => setDomainMode("transfer")}
              className="text-left bg-white border border-gray-200 rounded-2xl p-5 transition-all focus:outline-none"
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = P; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 16px rgba(112,26,254,0.10)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#E5E7EB"; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "rgba(112,26,254,0.08)" }}>
                <ArrowRightLeft size={18} style={{ color: P }}/>
              </div>
              <h3 className="text-[14px] font-bold text-gray-900 mb-1">Transfer Domain</h3>
              <p className="text-[12px] text-gray-500 leading-relaxed">Move an existing domain with EPP code.</p>
            </button>

            {/* Use existing */}
            <button
              onClick={() => setDomainMode("existing")}
              className="text-left bg-white border border-gray-200 rounded-2xl p-5 transition-all focus:outline-none"
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = P; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 16px rgba(112,26,254,0.10)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#E5E7EB"; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "rgba(112,26,254,0.08)" }}>
                <Globe size={18} style={{ color: P }}/>
              </div>
              <h3 className="text-[14px] font-bold text-gray-900 mb-1">Use Existing Domain</h3>
              <p className="text-[12px] text-gray-500 leading-relaxed">I already own a domain — I'll update nameservers.</p>
            </button>
          </div>
        )}

        <AnimatePresence>
          {/* Register / Free domain search */}
          {domainMode === "register" && (
            <motion.div key="reg" {...fade} className="max-w-xl">
              <button onClick={() => { setDomainMode(null); setDomResults(null); setFreeDomainClaimed(false); }}
                className="flex items-center gap-1 text-[13px] text-gray-400 hover:text-gray-700 mb-4 font-medium transition-colors">
                <ArrowLeft size={13}/> Change option
              </button>
              {freeDomainClaimed ? (
                <div className="flex flex-wrap items-start gap-2 p-3 mb-4 bg-green-50 border border-green-200 rounded-xl text-[12.5px] font-semibold text-green-700">
                  <Gift size={14} className="shrink-0 mt-0.5"/> 
                  <span className="flex-1">
                    Free domain — search below to claim it at no charge!{" "}
                    <span className="font-normal text-green-600">
                      Eligible: {(() => { const _p = selectedPlan?.freeDomainTlds ?? []; return (_p.length > 0 ? _p : [".com",".net",".org",".pk",".net.pk",".org.pk",".co"]).join(", "); })()}
                    </span>
                  </span>
                </div>
              ) : freeDomainEligible ? (
                <div className="flex items-center gap-2 p-3 mb-4 bg-amber-50 border border-amber-200 rounded-xl text-[12.5px] text-amber-700">
                  <Gift size={14} className="shrink-0"/> Your free domain slot is saved for later — you are paying for this registration.
                </div>
              ) : null}
              <form onSubmit={e => { e.preventDefault(); checkDomain(); }} className="flex flex-col sm:flex-row gap-2 mb-5">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                  <input value={domainQ} onChange={e => { setDomainQ(e.target.value); setDomResults(null); }}
                    placeholder="e.g. mybusiness, mystore…" autoFocus
                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-[14px] focus:outline-none"
                    onFocus={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.boxShadow = `0 0 0 3px ${P}20`; }}
                    onBlur={e  => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = ""; }}/>
                </div>
                <button type="submit" disabled={domChecking || !domainQ.trim()}
                  className="w-full sm:w-auto px-5 py-3 text-white rounded-xl text-[13px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
                  style={{ background: freeDomainClaimed ? "#16a34a" : P }}>
                  {domChecking ? <Loader2 size={14} className="animate-spin"/> : <Search size={14}/>} Check
                </button>
              </form>
              {domError && <p className="text-[13px] text-red-500 mb-3 flex items-center gap-1.5"><AlertCircle size={13}/> {domError}</p>}
              {domChecking && <div className="text-center py-6"><Loader2 size={20} className="animate-spin" style={{ color: freeDomainClaimed ? "#16a34a" : P }}/></div>}
              {domResults && !domChecking && (() => {
                const DEFAULT_FREE_TLDS = [".com", ".net", ".org", ".pk", ".net.pk", ".org.pk", ".co"];
                const planFreeTlds = selectedPlan?.freeDomainTlds ?? [];
                const allResults = domResults.filter(r => r.registrationPrice > 0);
                const visibleResults = allResults.slice(0, 8);
                const eligibleTldLabels = planFreeTlds.length > 0
                  ? planFreeTlds
                  : visibleResults.filter(r => r.isFreeWithHosting).map(r => r.tld).length > 0
                    ? visibleResults.filter(r => r.isFreeWithHosting).map(r => r.tld)
                    : DEFAULT_FREE_TLDS;
                return (
                  <div className="space-y-2">
                    {freeDomainClaimed && (
                      <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl bg-green-50 border border-green-200 mb-3">
                        <Gift size={14} className="text-green-600 shrink-0 mt-0.5"/>
                        <p className="text-[12px] text-green-700 leading-relaxed">
                          <span className="font-bold">Free Domain Offer:</span> Extensions eligible at Rs. 0 — <span className="font-semibold">{eligibleTldLabels.join(", ")}</span>. Other extensions charge their regular price.
                        </p>
                      </div>
                    )}
                    {visibleResults.length === 0 && (
                      <p className="text-[13px] text-gray-400 text-center py-4">No results found. Try a different name.</p>
                    )}
                    {visibleResults.map(r => {
                      const DEFAULT_FREE_TLDS = [".com", ".net", ".org", ".pk", ".net.pk", ".org.pk", ".co"];
                      const isFreeByPlan  = planFreeTlds.length > 0 && planFreeTlds.includes(r.tld);
                      const isFreeByTld   = planFreeTlds.length === 0 && (DEFAULT_FREE_TLDS.includes(r.tld) || (r.isFreeWithHosting ?? false));
                      const isFreeExt     = freeDomainClaimed && freeDomainEligible && (isFreeByPlan || isFreeByTld);
                      const domainPrice   = isFreeExt ? 0 : r.registrationPrice;
                      return (
                        <div key={r.tld}
                          className={`flex items-center gap-3 justify-between px-4 py-3 bg-white rounded-xl border transition-all ${
                            r.available
                              ? isFreeExt ? "border-green-200 hover:border-green-400" : "border-gray-200 hover:border-[#701AFE]/30"
                              : "opacity-45 border-gray-100"
                          }`}>
                          <div className="flex items-center gap-0.5 flex-1 min-w-0">
                            <span className="text-[14px] font-bold text-gray-900">{searched}</span>
                            <span className="text-[14px] font-bold" style={{ color: isFreeExt ? "#16a34a" : P }}>{r.tld}</span>
                            {freeDomainClaimed && (
                              <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isFreeExt ? "bg-green-100 text-green-700" : "bg-orange-50 text-orange-500"}`}>
                                {isFreeExt ? "✓ Free Eligible" : "Regular Price"}
                              </span>
                            )}
                          </div>
                          <div className="shrink-0">
                            {r.available
                              ? <span className="flex items-center gap-1 text-[11px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full"><Check size={10} strokeWidth={2.5}/> Available</span>
                              : <span className="text-[11px] font-bold text-red-400 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">Taken</span>}
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0">
                            <div className="text-right">
                              {isFreeExt
                                ? <>
                                    <p className="text-[11px] text-gray-400 line-through">{formatPrice(r.registrationPrice)}</p>
                                    <p className="text-[13px] font-extrabold text-green-600">FREE</p>
                                  </>
                                : <p className="text-[13px] font-extrabold">{formatPrice(r.registrationPrice)}/yr</p>}
                              <p className="text-[10px] text-gray-400">Renews {formatPrice(r.renewalPrice)}/yr</p>
                            </div>
                            {r.available && (
                              <button
                                onClick={() => { selectDomain(`${searched}${r.tld}`, domainPrice, "register", r.registrationPrice); setStep(3); }}
                                className="px-3.5 py-1.5 text-white text-[12px] font-bold rounded-xl flex items-center gap-1 hover:opacity-90"
                                style={{ background: isFreeExt ? "#16a34a" : P }}>
                                {isFreeExt ? <Gift size={11}/> : <ShoppingCart size={11}/>}
                                {isFreeExt ? "Claim Free" : "Select"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </motion.div>
          )}

          {/* Transfer */}
          {domainMode === "transfer" && (
            <motion.div key="tx2" {...fade} className="max-w-md">
              <button onClick={() => setDomainMode(null)} className="flex items-center gap-1 text-[13px] text-gray-400 hover:text-gray-700 mb-4 font-medium transition-colors"><ArrowLeft size={13}/> Change option</button>
              <div className="space-y-4">
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Domain to Transfer</label>
                  <div className="relative">
                    <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                    <input value={txDomain} onChange={e => setTxDomain(e.target.value)} placeholder="example.com" autoFocus
                      className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-[14px] focus:outline-none"
                      onFocus={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.boxShadow = `0 0 0 3px ${P}20`; }}
                      onBlur={e  => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = ""; }}/>
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">EPP / Auth Code</label>
                  <div className="relative">
                    <Key size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                    <input value={eppCode} onChange={e => setEppCode(e.target.value)} placeholder="Paste EPP code"
                      className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-[14px] font-mono focus:outline-none"
                      onFocus={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.boxShadow = `0 0 0 3px ${P}20`; }}
                      onBlur={e  => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = ""; }}/>
                  </div>
                </div>
                <button onClick={() => { if (!txDomain.includes(".")) return; const _tld = txDomain.slice(txDomain.indexOf(".")).toLowerCase(); const _row = tldPricing.find(t => t.tld === _tld); const _txPrice = _row?.transferPrice ?? _row?.registrationPrice ?? 0; setCartDomain({ fullName: txDomain, price: _txPrice, mode: "transfer" }); setDomainMode("transfer"); setStep(3); }}
                  disabled={!txDomain.includes(".")}
                  className="w-full py-3 text-white rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: P }}>
                  <ArrowRightLeft size={14}/> Continue with Transfer
                </button>
              </div>
            </motion.div>
          )}

          {/* Existing domain */}
          {domainMode === "existing" && (
            <motion.div key="ex" {...fade} className="max-w-md">
              <button onClick={() => setDomainMode(null)} className="flex items-center gap-1 text-[13px] text-gray-400 hover:text-gray-700 mb-4 font-medium transition-colors"><ArrowLeft size={13}/> Change option</button>
              <div>
                <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Your Domain Name</label>
                <div className="relative mb-3">
                  <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                  <input value={existingDom} onChange={e => setExistingDom(e.target.value)} placeholder="example.com" autoFocus
                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-[14px] focus:outline-none"
                    onFocus={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.boxShadow = `0 0 0 3px ${P}20`; }}
                    onBlur={e  => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = ""; }}/>
                </div>
                <p className="text-[12px] text-gray-400 mb-4">You'll update nameservers to point to Noehost after checkout.</p>
                <button
                  onClick={() => { setCartDomain({ fullName: existingDom.trim() || "existing", price: 0, mode: "existing" }); setDomainMode("existing"); setStep(3); }}
                  disabled={!existingDom.includes(".")}
                  className="w-full py-3 text-white rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: P }}>
                  <Globe size={14}/> Continue with This Domain
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!domainMode && (
          <div className="text-center mt-4">
            <button
              onClick={() => { setDomainMode("existing"); setCartDomain(null); setStep(3); }}
              className="text-[13px] text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors">
              Skip for now — I'll add a domain later
            </button>
          </div>
        )}
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 3 — Review & Pay
  // ─────────────────────────────────────────────────────────────────────────────

  function renderStep3() {
    const planAmt   = selectedPlan ? planPrice(selectedPlan, selectedCycle) : 0;
    const isDomFree = isDomForceFree;
    const domAmt    = isDomFree ? 0 : (cartDomain?.price ?? 0);
    const subtotal  = planAmt + domAmt;
    const total     = Math.max(0, subtotal - promoDiscount);
    const renewAt   = selectedPlan?.renewalPrice ?? selectedPlan?.yearlyPrice ?? null;

    return (
      <motion.div key="s3" {...fade}>
        <button
          onClick={() => isDomainOnly ? setStep(1) : setStep(2)}
          className="inline-flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-700 mb-6 font-medium transition-colors">
          <ArrowLeft size={13}/> {isDomainOnly ? "Back to domain search" : "Back to domain setup"}
        </button>
        <div className="text-center mb-7">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-1.5">Review & Pay</h2>
          <p className="text-[14px] text-gray-500">Confirm your order and pick a payment method.</p>
        </div>

        <div className="space-y-5 max-w-2xl">
          {/* ── Order breakdown ── */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <span className="text-[12px] font-bold text-gray-500 uppercase tracking-wider">Order Breakdown</span>
            </div>
            <div className="divide-y divide-gray-100">
              {selectedPlan && (
                <div className="flex items-start justify-between px-5 py-4">
                  <div>
                    <p className="text-[14px] font-bold text-gray-900">{selectedPlan.name}</p>
                    <p className="text-[12px] text-gray-400">{CYCLE_LABELS[selectedCycle]} billing</p>
                    {renewAt && (
                      <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                        <RefreshCw size={10}/> Renews at {formatPrice(renewAt)}/year
                      </p>
                    )}
                    {(() => {
                      const saveAmt = (selectedPlan as any).saveAmount > 0
                        ? Number((selectedPlan as any).saveAmount)
                        : selectedCycle === "yearly" && selectedPlan.price > 0
                          ? (selectedPlan.price * 12) - planAmt
                          : 0;
                      return saveAmt > 0 ? (
                        <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-lg text-[10.5px] font-bold text-white"
                          style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                          🎉 You save {formatPrice(saveAmt)}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-[16px] font-extrabold text-gray-900">{formatPrice(planAmt)}</p>
                    <p className="text-[11px] text-gray-400">per {CYCLE_LABELS[selectedCycle].toLowerCase()}</p>
                  </div>
                </div>
              )}
              {cartDomain && (
                <div className="flex items-start justify-between px-5 py-4">
                  <div>
                    <p className="text-[14px] font-bold text-gray-900">{cartDomain.fullName}</p>
                    <p className="text-[12px] text-gray-400">
                      {cartDomain.mode === "register" ? "Domain Registration · 1 Year" :
                       cartDomain.mode === "transfer"  ? "Domain Transfer · includes 1-year extension" :
                       "Existing domain (nameservers update)"}
                    </p>
                    {isDomFree && (
                      <p className="text-[11px] text-green-600 mt-1 flex items-center gap-1 font-semibold">
                        <Gift size={10}/> Selected extension ({cartDomain.fullName.includes(".") ? cartDomain.fullName.slice(cartDomain.fullName.indexOf(".")) : ""}) is eligible for your Free Domain offer
                      </p>
                    )}
                    {!isDomFree && freeDomainEligible && freeDomainClaimed && cartDomain.mode === "register" && (
                      <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1 font-semibold">
                        <AlertCircle size={10}/> Selected extension ({cartDomain.fullName.includes(".") ? cartDomain.fullName.slice(cartDomain.fullName.indexOf(".")) : ""}) is not included in the Free Domain offer
                      </p>
                    )}
                    {!isDomFree && cartDomain.mode === "register" && !freeDomainClaimed && (
                      <p className="text-[11px] text-gray-400 mt-1">Renewal price shown during checkout annually.</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    {isDomFree
                      ? <>
                          {cartDomain.originalPrice && cartDomain.originalPrice > 0 && (
                            <p className="text-[12px] text-gray-400 line-through">{formatPrice(cartDomain.originalPrice)}</p>
                          )}
                          <p className="text-[16px] font-extrabold text-green-600">FREE</p>
                          <p className="text-[11px] text-green-500 font-semibold">Rs. 0.00</p>
                        </>
                      : <p className="text-[16px] font-extrabold text-gray-900">{formatPrice(cartDomain.price)}</p>
                    }
                  </div>
                </div>
              )}
              {promoApplied && promoDiscount > 0 && (
                <div className="flex items-center justify-between px-5 py-3 bg-green-50/50">
                  <div className="flex items-center gap-2">
                    <Tag size={13} className="text-green-600"/>
                    <span className="text-[13px] font-semibold text-green-700">Promo: {promoCode}</span>
                  </div>
                  <span className="text-[14px] font-bold text-green-600">-{formatPrice(promoDiscount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between px-5 py-4 bg-gray-50">
                <span className="text-[15px] font-extrabold text-gray-900">Total Due Today</span>
                <span className="text-[22px] font-extrabold text-gray-900">{formatPrice(total)}</span>
              </div>
            </div>
          </div>

          {/* ── Nameservers (domain registration only) ── */}
          {cartDomain && cartDomain.mode === "register" && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-1">Nameservers</p>
              <p className="text-[12px] text-gray-400 mb-3">Default nameservers are pre-filled. Change them if you'd like to use custom nameservers.</p>
              <div className="space-y-2.5">
                {domainNs.map((ns, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[12px] font-mono font-semibold text-gray-400 w-8 shrink-0">NS{i + 1}</span>
                    <input
                      value={ns}
                      onChange={e => setDomainNs(prev => prev.map((v, idx) => idx === i ? e.target.value : v))}
                      placeholder={`ns${i + 1}.example.com`}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-[13px] font-mono focus:outline-none"
                      onFocus={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.boxShadow = `0 0 0 3px ${P}20`; }}
                      onBlur={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = ""; }}
                    />
                    {domainNs.length > 2 && (
                      <button type="button" onClick={() => setDomainNs(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-gray-300 hover:text-red-400 transition-colors text-[18px] leading-none">×</button>
                    )}
                  </div>
                ))}
                {domainNs.length < 4 && (
                  <button type="button"
                    onClick={() => setDomainNs(prev => [...prev, ""])}
                    className="text-[12px] font-semibold mt-1 transition-colors"
                    style={{ color: P }}>
                    + Add nameserver
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Promo code ── */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-3">Promo Code (Optional)</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="Enter promo code"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-[13px] font-mono uppercase focus:outline-none"
                  onFocus={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.boxShadow = `0 0 0 3px ${P}20`; }}
                  onBlur={e  => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = ""; }}/>
              </div>
              <button onClick={handleApplyPromo} disabled={promoLoading || !promoCode.trim()}
                className="px-4 py-2.5 text-[13px] font-semibold rounded-xl border transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                style={promoApplied
                  ? { borderColor: "#16a34a", background: "#f0fdf4", color: "#16a34a" }
                  : { borderColor: "#E5E7EB", background: "#fff", color: "#4B5563" }}>
                {promoLoading ? <Loader2 size={13} className="animate-spin"/> : promoApplied ? <Check size={13}/> : null}
                {promoApplied ? "Applied" : "Apply"}
              </button>
            </div>
            {promoError && (
              <p className="mt-2 text-[12px] text-red-500 flex items-center gap-1">
                <AlertCircle size={11}/> {promoError}
              </p>
            )}
            {promoApplied && promoDiscount > 0 && (
              <p className="mt-2 text-[12px] text-green-600 flex items-center gap-1 font-semibold">
                <CheckCircle2 size={11}/> Promo applied! You save {formatPrice(promoDiscount)}.
              </p>
            )}
          </div>

          {/* ── Payment methods ── */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <span className="text-[12px] font-bold text-gray-500 uppercase tracking-wider">Payment Method</span>
            </div>
            <div className="p-4 space-y-3">
              {/* Pay via Wallet */}
              {(() => {
                const _walletPlanAmt = selectedPlan ? planPrice(selectedPlan, selectedCycle) : 0;
                const _walletDomAmt  = isDomForceFree ? 0 : (cartDomain?.price ?? 0);
                const _walletTotal   = Math.max(0, _walletPlanAmt + _walletDomAmt - promoDiscount);
                const hasSufficient  = creditBalance >= _walletTotal;
                const showWallet     = creditBalance > 0 || true; // always show wallet option
                return showWallet ? (
                  <div>
                    <button
                      onClick={() => {
                        if (!hasSufficient && _walletTotal > 0) return;
                        setPaymentMethodId(paymentMethodId === "credits" ? null : "credits");
                      }}
                      disabled={!hasSufficient && _walletTotal > 0}
                      className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all focus:outline-none disabled:cursor-not-allowed"
                      style={paymentMethodId === "credits"
                        ? { borderColor: P, background: `${P}07` }
                        : hasSufficient || _walletTotal === 0
                          ? { borderColor: "#E5E7EB", background: "#fff" }
                          : { borderColor: "#E5E7EB", background: "#F9FAFB", opacity: 0.75 }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: paymentMethodId === "credits" ? `${P}15` : "#F3F4F6" }}>
                        <Wallet size={18} style={{ color: paymentMethodId === "credits" ? P : "#6B7280" }}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-bold text-gray-900">Pay with Wallet Balance</p>
                          {hasSufficient && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: P }}>INSTANT</span>
                          )}
                        </div>
                        <p className="text-[11px] mt-0.5 font-semibold" style={{ color: creditBalance > 0 ? (hasSufficient ? "#16a34a" : "#dc2626") : "#6B7280" }}>
                          {creditBalance > 0 ? `${formatPrice(creditBalance)} available` : "Rs. 0 available"}
                          {!hasSufficient && _walletTotal > 0 && ` — need ${formatPrice(_walletTotal - creditBalance)} more`}
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${paymentMethodId === "credits" ? "" : "border-gray-300"}`}
                        style={paymentMethodId === "credits" ? { background: P, borderColor: P } : {}}>
                        {paymentMethodId === "credits" && <Check size={10} strokeWidth={3} className="text-white"/>}
                      </div>
                    </button>
                    {!hasSufficient && _walletTotal > 0 && (
                      <div className="mt-2 flex items-center gap-2 text-[11.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                        <AlertCircle size={12} className="shrink-0"/>
                        Insufficient balance.{" "}
                        <a href="/client/billing" className="underline font-semibold hover:text-amber-900" onClick={e => { e.preventDefault(); setLocation("/client/billing"); }}>
                          Add Funds
                        </a>
                        {" "}to use wallet payment.
                      </div>
                    )}
                  </div>
                ) : null;
              })()}

              {paymentMethods.length === 0 && creditBalance === 0 ? (
                <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-xl text-[13px] text-amber-700">
                  <AlertCircle size={14}/> No payment methods configured. Please contact support.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {paymentMethods.map(pm => {
                    const isSel = paymentMethodId === pm.id;
                    return (
                      <button key={pm.id} onClick={() => setPaymentMethodId(isSel ? null : pm.id)}
                        className="flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all focus:outline-none"
                        style={isSel ? { borderColor: P, background: `${P}07` } : { borderColor: "#E5E7EB", background: "#fff" }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: isSel ? `${P}15` : "#F3F4F6" }}>
                          <PayIcon type={pm.type}/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-bold text-gray-900">{pm.name}</p>
                            {pm.isSandbox && <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">Test</span>}
                          </div>
                          {pm.description && <p className="text-[11px] text-gray-400 truncate mt-0.5">{pm.description}</p>}
                          {(pm.type === "jazzcash" || pm.type === "easypaisa") && pm.publicSettings.mobileNumber && (
                            <p className="text-[11px] text-gray-500 mt-0.5 font-medium">Send to: {pm.publicSettings.mobileNumber}</p>
                          )}
                          {pm.type === "bank_transfer" && pm.publicSettings.bankName && (
                            <p className="text-[11px] text-gray-500 mt-0.5">{pm.publicSettings.bankName} · {pm.publicSettings.accountTitle}</p>
                          )}
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${isSel ? "" : "border-gray-300"}`}
                          style={isSel ? { background: P, borderColor: P } : {}}>
                          {isSel && <Check size={10} strokeWidth={3} className="text-white"/>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Error ── */}
          {orderError && (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-600">
              <AlertCircle size={14}/> {orderError}
            </div>
          )}

          {/* ── Place order ── */}
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
            <PrimaryBtn
              label="Place Order"
              onClick={() => { setOrderError(""); orderMutation.mutate(); }}
              disabled={!step3Complete || orderMutation.isPending}
              loading={orderMutation.isPending}
            />
            <p className="text-[12px] text-gray-400 flex items-center gap-1.5">
              <Lock size={11}/> SSL secured · 30-day money-back guarantee
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Root render
  // ─────────────────────────────────────────────────────────────────────────────

  const isFreeDom = isDomForceFree;

  // Direct-link: show spinner while plan is being fetched + auto-selected
  if (!directLinkReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <Loader2 size={36} className="animate-spin" style={{ color: P }}/>
        <p className="text-[14px] text-gray-500">Loading your package…</p>
      </div>
    );
  }

  // Direct-link: plan ID not found
  if (directLinkError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
        <AlertCircle size={40} className="text-red-400"/>
        <p className="text-[16px] font-semibold text-gray-800">Package not found</p>
        <p className="text-[13px] text-gray-500 max-w-xs">{directLinkError}</p>
        <button onClick={() => setLocation("/client/orders/new")}
          className="mt-2 px-6 py-2.5 rounded-xl text-[13px] font-bold text-white"
          style={{ background: P }}>
          Browse all plans
        </button>
      </div>
    );
  }

  return (
    <div className={showSidebar ? "pb-24 lg:pb-0" : ""}>
      <StepBar active={step} labels={service === "vps" ? ["Service", "Choose Plan", "Configure", "Review & Pay"] : undefined}/>

      <div className={showSidebar ? "lg:grid lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_300px] lg:gap-8 lg:items-start" : ""}>

        {/* ── Main content ── */}
        <div>
          <AnimatePresence mode="wait">
            {step === 0                           && renderStep0()}
            {step === 1 && service === "hosting"  && renderStep1Hosting()}
            {step === 1 && service === "domain"   && renderStep1Domain()}
            {step === 1 && service === "transfer" && renderStep1Transfer()}
            {step === 1 && service === "vps"      && renderStep1Vps()}
            {step === 2 && service === "vps"      && renderStep2Vps()}
            {step === 2 && service !== "vps"      && renderStep2()}
            {step === 3                           && renderStep3()}
          </AnimatePresence>
        </div>

        {/* ── Desktop sidebar ── */}
        {showSidebar && (
          <Sidebar
            plan={selectedPlan}
            pendingPlan={pendingPlan}
            cycle={selectedCycle}
            pendingCycle={pendingCycle}
            domain={cartDomain}
            freeDomain={isFreeDom}
            step={step}
            fmt={formatPrice}
            onRmPlan={removePlan}
            onRmDom={() => setCartDomain(null)}
            ctaLabel={ctaLabel()}
            canContinue={canContinue()}
            onContinue={handleSidebarContinue}
            loading={orderMutation.isPending}
            vpsPlan={service === "vps" ? selectedVpsPlan : null}
            vpsCycle={vpsSelectedCycle}
            vpsPrice={_vpsPrice}
            onRmVps={() => setSelectedVpsPlan(null)}
          />
        )}
      </div>

      {/* ── Mobile expandable bottom bar ── */}
      {showSidebar && (
        <MobileSummaryBar
          plan={selectedPlan ?? pendingPlan}
          cycle={selectedPlan ? selectedCycle : pendingCycle}
          domain={cartDomain}
          freeDomain={isFreeDom}
          fmt={formatPrice}
          ctaLabel={ctaLabel()}
          canContinue={canContinue()}
          onContinue={handleSidebarContinue}
          loading={orderMutation.isPending}
          vpsPlan={service === "vps" ? selectedVpsPlan : null}
          vpsCycle={vpsSelectedCycle}
          vpsPrice={_vpsPrice}
        />
      )}
    </div>
  );
}
