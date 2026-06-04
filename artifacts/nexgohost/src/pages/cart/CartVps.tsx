/**
 * /cart/vps — VPS Plan Cart Page
 * Flow: Plan → Region → OS → Configure → Payment
 */
import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import {
  Zap, Globe, Cpu, MemoryStick, HardDrive, Wifi, Server, Check, ChevronRight,
  Lock, Shield, Tag, X, CreditCard, Landmark, Smartphone, Bitcoin, Wallet,
  Loader2, AlertCircle, CheckCircle2, Eye, EyeOff, Shuffle, ArrowRight,
  Terminal, Key, Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/context/CurrencyProvider";
import { useAuth } from "@/hooks/use-auth";

const BRAND = "#6B46C1";
const G = "linear-gradient(135deg,#6B46C1 0%,#8B5CF6 100%)";

type Cycle = "monthly" | "quarterly" | "semiannual" | "yearly";
const CYCLE_LABELS: Record<Cycle, string> = { monthly: "Monthly", quarterly: "3 Months", semiannual: "6 Months", yearly: "Yearly" };
const CYCLE_MONTHS: Record<Cycle, number> = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 };

interface VpsPlan {
  id: string; name: string; description: string | null;
  price: number; yearlyPrice: number | null; quarterlyPrice: number | null; semiannualPrice: number | null;
  cpuCores: number; ramGb: number; storageGb: number; bandwidthTb: number | null;
  virtualization: string; features: string[]; isActive: boolean; saveAmount: number | null;
  isPopular?: boolean;
}
interface OsTemplate { id: string; name: string; version: string; iconUrl: string | null; category?: string; }
interface Location { id: string; countryName: string; countryCode: string; flagIcon: string | null; city: string | null; datacenter: string | null; latencyMs: number; }
interface PaymentMethod { id: string; name: string; type: string; description: string | null; isSandbox: boolean; }

function authHeaders() {
  const t = localStorage.getItem("token") || localStorage.getItem("noehost_token") || "";
  return { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}
async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, { ...opts, headers: { ...authHeaders(), ...opts?.headers } });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || "Request failed");
  return d;
}
function PaymentIcon({ type }: { type: string }) {
  if (type === "stripe" || type === "card") return <CreditCard size={16} className="text-blue-500"/>;
  if (type === "bank_transfer" || type === "bank") return <Landmark size={16} className="text-gray-500"/>;
  if (type === "mobile_wallet" || type === "easypaisa" || type === "jazzcash") return <Smartphone size={16} className="text-green-500"/>;
  if (type === "crypto") return <Bitcoin size={16} className="text-amber-500"/>;
  return <CreditCard size={16} className="text-gray-400"/>;
}

function planPrice(p: VpsPlan, cycle: Cycle): number {
  if (cycle === "quarterly" && p.quarterlyPrice) return p.quarterlyPrice;
  if (cycle === "semiannual" && p.semiannualPrice) return p.semiannualPrice;
  if (cycle === "yearly" && p.yearlyPrice) return p.yearlyPrice;
  return p.price * CYCLE_MONTHS[cycle];
}

function generatePassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => chars[b % chars.length]).join("");
}

type Step = "plan" | "region" | "os" | "configure" | "review" | "payment";

export default function CartVps() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();

  const params = new URLSearchParams(search);
  const preselectedId = params.get("plan") || params.get("id") || "";

  const [step, setStep] = useState<Step>("plan");
  const [plans, setPlans] = useState<VpsPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<VpsPlan | null>(null);
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [osTemplates, setOsTemplates] = useState<OsTemplate[]>([]);
  const [selectedOs, setSelectedOs] = useState<OsTemplate | null>(null);
  const [hostname, setHostname] = useState("");
  const [rootPassword, setRootPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sshKey, setSshKey] = useState("");
  const [weeklyBackups, setWeeklyBackups] = useState(false);
  const BACKUP_PRICE = 299;

  // Payment
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [pmLoading, setPmLoading] = useState(false);
  const [selectedPm, setSelectedPm] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [applyCredits, setApplyCredits] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);
  const [placing, setPlacing] = useState(false);

  const stateRestored = useRef(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/vps-plans").then(r => r.json()),
      fetch("/api/vps-locations").then(r => r.json()),
      fetch("/api/vps-os-templates").then(r => r.json()),
    ]).then(([plans, locs, oses]) => {
      const formatted = (plans as VpsPlan[]).map((p, i) => ({ ...p, isPopular: i === 1 }));
      setPlans(formatted);
      setLocations(locs);
      setOsTemplates(oses);
      // Restore pre-login state saved to localStorage
      if (!stateRestored.current) {
        stateRestored.current = true;
        try {
          const saved = localStorage.getItem("cart_vps_state");
          if (saved) {
            const s = JSON.parse(saved);
            localStorage.removeItem("cart_vps_state");
            if (s.planId) {
              const pre = formatted.find(p => String(p.id) === String(s.planId));
              if (pre) setSelectedPlan(pre);
            }
            if (s.cycle) setCycle(s.cycle);
            if (s.hostname) setHostname(s.hostname);
            if (s.weeklyBackups !== undefined) setWeeklyBackups(s.weeklyBackups);
            if (s.promoCode) setPromoCode(s.promoCode);
            if (s.locationId && locs.length) {
              const loc = locs.find((l: any) => String(l.id) === String(s.locationId));
              if (loc) setSelectedLocation(loc);
            }
            if (s.osId && oses.length) {
              const os = oses.find((o: any) => String(o.id) === String(s.osId));
              if (os) setSelectedOs(os);
            }
            return;
          }
        } catch {}
      }
      if (preselectedId) {
        const pre = formatted.find(p => p.id === preselectedId);
        if (pre) { setSelectedPlan(pre); setStep("region"); }
      } else if (formatted.length > 1) {
        setSelectedPlan(formatted[1]);
      }
    }).catch(console.warn).finally(() => setPlansLoading(false));
  }, []);

  useEffect(() => {
    if (step === "payment") {
      setPmLoading(true);
      apiFetch("/api/payment-methods").then(setPaymentMethods).catch(() => []).finally(() => setPmLoading(false));
      if (user) apiFetch("/api/my/credits").then(d => setCreditBalance(Number(d.balance || 0))).catch(() => {});
    }
  }, [step, user]);

  // Auto-set hostname from plan name
  useEffect(() => {
    if (selectedPlan && !hostname) {
      setHostname(`vps-${selectedPlan.name.toLowerCase().replace(/\s+/g, "-")}-${Math.floor(Math.random() * 1000)}`);
    }
  }, [selectedPlan]);

  const applyPromo = async () => {
    if (!promoCode.trim() || !selectedPlan) return;
    setPromoLoading(true); setPromoError("");
    try {
      const amount = planPrice(selectedPlan, cycle);
      const res = await fetch(`/api/promo-codes/validate?code=${promoCode.trim()}&amount=${amount}&serviceType=vps&billingCycle=${cycle}`);
      const d = await res.json();
      if (!res.ok || d.error) { setPromoError(d.error || "Invalid promo code"); return; }
      setPromoDiscount(d.discountAmount || Math.round(amount * (d.discountPercent / 100)));
      setPromoApplied(true);
      toast({ title: "Promo applied!" });
    } catch { setPromoError("Could not validate code"); }
    finally { setPromoLoading(false); }
  };

  const saveCartState = () => {
    localStorage.setItem("cart_vps_state", JSON.stringify({
      planId: selectedPlan?.id, cycle, locationId: selectedLocation?.id, osId: selectedOs?.id,
      hostname, weeklyBackups, promoCode,
      // rootPassword intentionally NOT persisted — never store credentials in localStorage
    }));
  };

  const placeOrder = async () => {
    if (!user) {
      saveCartState();
      localStorage.setItem("postLoginRedirect", "/cart/vps");
      navigate("/client/login?redirect=/cart/vps");
      return;
    }
    if (!selectedPm && !applyCredits) { toast({ title: "Select a payment method", variant: "destructive" }); return; }
    if (!rootPassword) { toast({ title: "Root password required", variant: "destructive" }); return; }
    setPlacing(true);
    try {
      const body: any = {
        vpsPlanId: selectedPlan!.id,
        billingCycle: cycle,
        vpsOsTemplate: selectedOs?.name,
        vpsLocation: selectedLocation?.countryName,
        vpsHostname: hostname,
        vpsRootUser: "root",
        vpsRootPassword: rootPassword,
        vpsPublicKey: sshKey.trim() || undefined,
        vpsWeeklyBackups: weeklyBackups,
        vpsAutoRenew: true,
        paymentMethodId: selectedPm || undefined,
        applyCredits,
      };
      if (promoApplied) body.promoCode = promoCode;
      const d = await apiFetch("/api/checkout", { method: "POST", body: JSON.stringify(body) });
      // Generic payment gateway routing: SafePay, RapidGateway, then manual invoice
      const pm = paymentMethods.find(p => p.id === selectedPm);
      if (d.invoiceId && pm) {
        if (pm.type === "safepay") {
          try {
            const sp = await apiFetch("/api/payments/safepay/initiate", { method: "POST", body: JSON.stringify({ invoiceId: d.invoiceId }) });
            if (sp.checkoutUrl) { window.location.href = sp.checkoutUrl; return; }
          } catch {}
        } else if (pm.type === "rapidgateway") {
          try {
            const rg = await apiFetch("/api/payments/rapidgateway/initiate", { method: "POST", body: JSON.stringify({ invoiceId: d.invoiceId }) });
            if (rg.checkoutUrl) { window.location.href = rg.checkoutUrl; return; }
          } catch {}
        }
      }
      toast({ title: "VPS order placed!", description: "Your server will be provisioned shortly." });
      navigate(d.invoiceId ? `/dashboard/invoices/${d.invoiceId}` : "/dashboard/invoices");
    } catch (err: any) {
      toast({ title: "Order failed", description: err.message, variant: "destructive" });
    } finally { setPlacing(false); }
  };

  const basePrice = selectedPlan ? planPrice(selectedPlan, cycle) : 0;
  const backupAddOn = weeklyBackups ? BACKUP_PRICE * CYCLE_MONTHS[cycle] : 0;
  const subtotal = basePrice + backupAddOn;
  const total = Math.max(0, subtotal - promoDiscount - (applyCredits ? Math.min(creditBalance, subtotal) : 0));

  const STEPS: { key: Step; label: string }[] = [
    { key: "plan", label: "Plan" },
    { key: "region", label: "Region" },
    { key: "os", label: "OS" },
    { key: "configure", label: "Configure" },
    { key: "review", label: "Review" },
    { key: "payment", label: "Payment" },
  ];
  const stepIdx = STEPS.findIndex(s => s.key === step);

  function goStep(s: Step) {
    const idx = STEPS.findIndex(x => x.key === s);
    if (idx <= stepIdx || (s === "region" && selectedPlan)) setStep(s);
  }

  // Group OS by category
  const osGroups: Record<string, OsTemplate[]> = {};
  for (const os of osTemplates) {
    const cat = os.category || (os.name.toLowerCase().includes("ubuntu") || os.name.toLowerCase().includes("debian") ? "Linux" : os.name.toLowerCase().includes("windows") ? "Windows" : os.name.toLowerCase().includes("n8n") ? "Applications" : "Other");
    if (!osGroups[cat]) osGroups[cat] = [];
    osGroups[cat].push(os);
  }
  // Add n8n if not in templates
  const hasN8n = osTemplates.some(o => o.name.toLowerCase().includes("n8n"));

  return (
    <div className="min-h-screen bg-[#F8F9FB]" style={{ fontFamily: "'Inter','Plus Jakarta Sans',sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href={user ? "/dashboard" : "/"} className="flex items-center gap-2 no-underline">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-white text-[15px]" style={{ background: G }}>N</div>
            <span className="text-[17px] font-extrabold text-gray-900">Noehost</span>
          </a>
          <div className="flex items-center gap-4 text-[12px] text-gray-500">
            <span className="hidden sm:flex items-center gap-1"><Shield size={13} className="text-green-500"/> SSL Secured</span>
            <span className="flex items-center gap-1"><Lock size={12} style={{ color: BRAND }}/> Secure Checkout</span>
          </div>
        </div>
      </header>

      {/* Step bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-0 overflow-x-auto">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center shrink-0">
              <button onClick={() => goStep(s.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${step === s.key ? "text-white" : stepIdx > i ? "text-purple-600" : "text-gray-400"}`}
                style={{ background: step === s.key ? G : undefined }}>
                <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold ${step === s.key ? "bg-white/30 text-white" : stepIdx > i ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-500"}`}>
                  {stepIdx > i ? <Check size={10}/> : i+1}
                </span>
                {s.label}
              </button>
              {i < STEPS.length - 1 && <ChevronRight size={14} className="text-gray-200 mx-0.5"/>}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 min-w-0">

            {/* Step 1: Plan */}
            {step === "plan" && (
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Choose Your VPS Plan</h1>
                <p className="text-gray-500 mb-5 text-[14px]">KVM virtualization, SSD NVMe storage, dedicated resources.</p>
                <div className="flex items-center gap-2 mb-6 flex-wrap">
                  {(["monthly","quarterly","semiannual","yearly"] as Cycle[]).map(c => (
                    <button key={c} onClick={() => setCycle(c)}
                      className="px-4 py-1.5 rounded-full text-[13px] font-semibold border-2 transition-all"
                      style={{ borderColor: cycle === c ? BRAND : "#E5E7EB", background: cycle === c ? BRAND : "#fff", color: cycle === c ? "#fff" : "#6B7280" }}>
                      {CYCLE_LABELS[c]}
                      {c === "yearly" && <span className="ml-1 text-[10px] bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded-full font-bold">SAVE</span>}
                    </button>
                  ))}
                </div>
                {plansLoading ? (
                  <div className="flex items-center justify-center h-40"><Loader2 size={28} className="animate-spin text-purple-400"/></div>
                ) : plans.length === 0 ? (
                  <div className="text-center py-16 text-gray-400"><Zap size={40} className="mx-auto mb-3 text-gray-200"/><p>No VPS plans found.</p></div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {plans.map(plan => {
                      const price = planPrice(plan, cycle);
                      const sel = selectedPlan?.id === plan.id;
                      return (
                        <button key={plan.id} onClick={() => setSelectedPlan(plan)}
                          className="w-full text-left rounded-2xl border-2 p-5 transition-all relative"
                          style={{ borderColor: sel ? BRAND : plan.isPopular ? "#E9D5FF" : "#E5E7EB", background: sel ? "#FAF5FF" : "#fff", boxShadow: sel ? `0 0 0 4px #EDE9FE` : undefined }}>
                          {plan.isPopular && <span className="absolute -top-3 left-5 px-3 py-0.5 rounded-full text-[11px] font-bold text-white" style={{ background: G }}>⭐ Popular</span>}
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-bold text-gray-900 text-[15px]">{plan.name}</div>
                              <div className="text-[11px] text-gray-500 mt-0.5">{plan.virtualization} · KVM</div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-extrabold text-[18px]" style={{ color: BRAND }}>{formatPrice(price)}</div>
                              <div className="text-[11px] text-gray-400">{CYCLE_LABELS[cycle].toLowerCase()}</div>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-1.5 text-[12px] text-gray-600">
                            <span className="flex items-center gap-1"><Cpu size={11} className="text-purple-400"/>{plan.cpuCores} vCPU</span>
                            <span className="flex items-center gap-1"><MemoryStick size={11} className="text-blue-400"/>{plan.ramGb} GB RAM</span>
                            <span className="flex items-center gap-1"><HardDrive size={11} className="text-orange-400"/>{plan.storageGb} GB SSD</span>
                            <span className="flex items-center gap-1"><Wifi size={11} className="text-green-400"/>{plan.bandwidthTb ?? "∞"} TB BW</span>
                          </div>
                          {plan.features?.slice(0,3).map((f, i) => (
                            <div key={i} className="mt-1.5 text-[11px] text-gray-400 flex items-center gap-1"><Check size={9} className="text-green-500"/>{f}</div>
                          ))}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="mt-8 flex justify-end">
                  <button onClick={() => selectedPlan && setStep("region")} disabled={!selectedPlan}
                    className="px-8 py-3 rounded-xl text-white font-bold text-[15px] flex items-center gap-2 disabled:opacity-40 hover:scale-[1.02] transition-all"
                    style={{ background: G }}>
                    Select Region <ArrowRight size={18}/>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Region */}
            {step === "region" && (
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Select Data Center</h1>
                <p className="text-gray-500 mb-6 text-[14px]">Choose the region closest to your target audience.</p>
                {locations.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Globe size={36} className="mx-auto mb-3 text-gray-200"/>
                    <p className="font-semibold">No locations configured yet.</p>
                    <p className="text-[13px] mt-1">You can specify a preferred region in the notes during checkout.</p>
                    <button onClick={() => setStep("os")} className="mt-4 px-6 py-2.5 rounded-xl text-white font-semibold" style={{ background: G }}>Continue →</button>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {locations.map(loc => {
                      const sel = selectedLocation?.id === loc.id;
                      return (
                        <button key={loc.id} onClick={() => setSelectedLocation(loc)}
                          className="flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left"
                          style={{ borderColor: sel ? BRAND : "#E5E7EB", background: sel ? "#FAF5FF" : "#fff" }}>
                          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-2xl shrink-0">
                            {loc.flagIcon || "🌐"}
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-[14px] text-gray-900">{loc.countryName}</div>
                            {loc.city && <div className="text-[12px] text-gray-500">{loc.city}{loc.datacenter ? ` · ${loc.datacenter}` : ""}</div>}
                            <div className="text-[11px] text-gray-400 mt-0.5">~{loc.latencyMs}ms latency</div>
                          </div>
                          {sel && <CheckCircle2 size={20} style={{ color: BRAND }}/>}
                        </button>
                      );
                    })}
                  </div>
                )}
                {locations.length > 0 && (
                  <div className="mt-8 flex items-center justify-between">
                    <button onClick={() => setStep("plan")} className="px-5 py-2.5 rounded-xl text-gray-600 font-semibold text-[14px] border border-gray-200 hover:bg-gray-50">← Back</button>
                    <button onClick={() => selectedLocation && setStep("os")} disabled={!selectedLocation}
                      className="px-8 py-3 rounded-xl text-white font-bold text-[15px] flex items-center gap-2 disabled:opacity-40 hover:scale-[1.02] transition-all"
                      style={{ background: G }}>
                      Select OS <ArrowRight size={18}/>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: OS */}
            {step === "os" && (
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Choose Operating System</h1>
                <p className="text-gray-500 mb-6 text-[14px]">Select the OS you want pre-installed on your VPS.</p>
                {osTemplates.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Server size={36} className="mx-auto mb-3 text-gray-200"/>
                    <p className="font-semibold">No OS templates configured.</p>
                    <p className="text-[13px] mt-1">Our team will contact you to arrange an OS.</p>
                    <button onClick={() => setStep("configure")} className="mt-4 px-6 py-2.5 rounded-xl text-white font-semibold" style={{ background: G }}>Continue →</button>
                  </div>
                ) : (
                  <>
                    {Object.entries(osGroups).map(([cat, oses]) => (
                      <div key={cat} className="mb-6">
                        <div className="text-[12px] font-bold text-gray-500 uppercase tracking-wide mb-3">{cat}</div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {oses.map(os => {
                            const sel = selectedOs?.id === os.id;
                            return (
                              <button key={os.id} onClick={() => setSelectedOs(os)}
                                className="flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left"
                                style={{ borderColor: sel ? BRAND : "#E5E7EB", background: sel ? "#FAF5FF" : "#fff" }}>
                                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 text-lg overflow-hidden">
                                  {os.iconUrl ? <img src={os.iconUrl} alt={os.name} className="w-7 h-7 object-contain"/> : "🐧"}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-[13px] text-gray-900 truncate">{os.name}</div>
                                  <div className="text-[11px] text-gray-400">{os.version}</div>
                                </div>
                                {sel && <CheckCircle2 size={16} style={{ color: BRAND }}/>}
                              </button>
                            );
                          })}
                          {/* n8n app option */}
                          {cat === "Applications" && !hasN8n && (
                            <button onClick={() => setSelectedOs({ id: "n8n", name: "n8n", version: "Latest", iconUrl: null })}
                              className="flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left"
                              style={{ borderColor: selectedOs?.id === "n8n" ? BRAND : "#E5E7EB", background: selectedOs?.id === "n8n" ? "#FAF5FF" : "#fff" }}>
                              <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center shrink-0 text-lg">⚡</div>
                              <div>
                                <div className="font-semibold text-[13px] text-gray-900">n8n</div>
                                <div className="text-[11px] text-gray-400">Workflow Automation</div>
                              </div>
                              {selectedOs?.id === "n8n" && <CheckCircle2 size={16} style={{ color: BRAND }}/>}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {!hasN8n && Object.keys(osGroups).length > 0 && (
                      <div className="mb-6">
                        <div className="text-[12px] font-bold text-gray-500 uppercase tracking-wide mb-3">Applications</div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          <button onClick={() => setSelectedOs({ id: "n8n", name: "n8n", version: "Latest", iconUrl: null })}
                            className="flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left"
                            style={{ borderColor: selectedOs?.id === "n8n" ? BRAND : "#E5E7EB", background: selectedOs?.id === "n8n" ? "#FAF5FF" : "#fff" }}>
                            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center shrink-0 text-lg">⚡</div>
                            <div>
                              <div className="font-semibold text-[13px] text-gray-900">n8n</div>
                              <div className="text-[11px] text-gray-400">Workflow Automation</div>
                            </div>
                            {selectedOs?.id === "n8n" && <CheckCircle2 size={16} style={{ color: BRAND }}/>}
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="mt-8 flex items-center justify-between">
                      <button onClick={() => setStep("region")} className="px-5 py-2.5 rounded-xl text-gray-600 font-semibold text-[14px] border border-gray-200 hover:bg-gray-50">← Back</button>
                      <button onClick={() => selectedOs && setStep("configure")} disabled={!selectedOs}
                        className="px-8 py-3 rounded-xl text-white font-bold text-[15px] flex items-center gap-2 disabled:opacity-40 hover:scale-[1.02] transition-all"
                        style={{ background: G }}>
                        Configure Server <ArrowRight size={18}/>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 4: Configure */}
            {step === "configure" && (
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Server Configuration</h1>
                <p className="text-gray-500 mb-6 text-[14px]">Set your hostname, root password, and optional add-ons.</p>
                <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5 shadow-sm">
                  {/* Hostname */}
                  <div>
                    <label className="block text-[13px] font-semibold text-gray-700 mb-2">Hostname</label>
                    <div className="relative">
                      <Terminal size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
                      <input value={hostname} onChange={e => setHostname(e.target.value.replace(/[^a-zA-Z0-9.-]/g, "").toLowerCase())}
                        placeholder="my-server.example.com"
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-[14px] outline-none focus:border-purple-400 font-mono"/>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">Alphanumeric and hyphens only. Used as the server's hostname.</p>
                  </div>

                  {/* Root user (read-only) */}
                  <div>
                    <label className="block text-[13px] font-semibold text-gray-700 mb-2">Root User</label>
                    <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-[14px] font-mono text-gray-500">
                      <Key size={14} className="text-gray-400"/>
                      root
                      <span className="ml-auto text-[11px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Fixed</span>
                    </div>
                  </div>

                  {/* Root password */}
                  <div>
                    <label className="block text-[13px] font-semibold text-gray-700 mb-2">Root Password</label>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input type={showPassword ? "text" : "password"} value={rootPassword} onChange={e => setRootPassword(e.target.value)}
                          placeholder="Min 12 characters, mixed case + numbers"
                          className="w-full pl-4 pr-10 py-3 border border-gray-200 rounded-xl text-[14px] outline-none focus:border-purple-400 font-mono"/>
                        <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showPassword ? <EyeOff size={15}/> : <Eye size={15}/>}
                        </button>
                      </div>
                      <button onClick={() => setRootPassword(generatePassword())}
                        className="px-4 py-3 rounded-xl border border-gray-200 text-[13px] text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 shrink-0">
                        <Shuffle size={14}/> Generate
                      </button>
                    </div>
                    {rootPassword && (() => {
                      const hasUpper = /[A-Z]/.test(rootPassword);
                      const hasLower = /[a-z]/.test(rootPassword);
                      const hasNum = /[0-9]/.test(rootPassword);
                      const hasSpec = /[^A-Za-z0-9]/.test(rootPassword);
                      const len = rootPassword.length;
                      const score = (len >= 8 ? 1 : 0) + (hasUpper ? 1 : 0) + (hasLower ? 1 : 0) + (hasNum ? 1 : 0) + (hasSpec ? 1 : 0) + (len >= 16 ? 1 : 0);
                      const level = score <= 2 ? "Weak" : score === 3 ? "Fair" : score === 4 ? "Strong" : "Very Strong";
                      const colors: Record<string, string> = { Weak: "#EF4444", Fair: "#F59E0B", Strong: "#10B981", "Very Strong": "#059669" };
                      const widths: Record<string, string> = { Weak: "25%", Fair: "50%", Strong: "75%", "Very Strong": "100%" };
                      return (
                        <div className="mt-2">
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-gray-400">Password strength</span>
                            <span className="font-semibold" style={{ color: colors[level] }}>{level}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-300" style={{ width: widths[level], background: colors[level] }}/>
                          </div>
                        </div>
                      );
                    })()}
                    <p className="text-[11px] text-gray-400 mt-1">Use a strong password. You can change it later via the dashboard.</p>
                  </div>

                  {/* SSH Key */}
                  <div>
                    <label className="block text-[13px] font-semibold text-gray-700 mb-2">
                      SSH Public Key <span className="font-normal text-gray-400">(Optional)</span>
                    </label>
                    <textarea value={sshKey} onChange={e => setSshKey(e.target.value)}
                      placeholder="ssh-rsa AAAAB3Nza... user@machine"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-[12px] outline-none focus:border-purple-400 font-mono resize-none"
                      rows={3}/>
                    <p className="text-[11px] text-gray-400 mt-1">Paste your <code className="text-gray-600">~/.ssh/id_rsa.pub</code> content for password-less login.</p>
                  </div>

                  {/* Backups add-on */}
                  <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={weeklyBackups} onChange={e => setWeeklyBackups(e.target.checked)} className="w-4 h-4 accent-purple-600"/>
                      <div className="flex-1">
                        <div className="font-semibold text-[13px] text-gray-800">Weekly Automatic Backups</div>
                        <div className="text-[12px] text-gray-500">Keep 4 rolling backups · One-click restore</div>
                      </div>
                      <div className="font-bold text-[13px]" style={{ color: BRAND }}>+{formatPrice(BACKUP_PRICE)}/mo</div>
                    </label>
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-between">
                  <button onClick={() => setStep("os")} className="px-5 py-2.5 rounded-xl text-gray-600 font-semibold text-[14px] border border-gray-200 hover:bg-gray-50">← Back</button>
                  <button onClick={() => hostname && rootPassword && setStep("review")} disabled={!hostname || !rootPassword}
                    className="px-8 py-3 rounded-xl text-white font-bold text-[15px] flex items-center gap-2 disabled:opacity-40 hover:scale-[1.02] transition-all"
                    style={{ background: G }}>
                    Review Order <ArrowRight size={18}/>
                  </button>
                </div>
              </div>
            )}

            {/* Step 5: Review */}
            {step === "review" && selectedPlan && (
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Review Your Order</h1>
                <p className="text-gray-500 mb-6 text-[14px]">Double-check everything before payment.</p>
                <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4 shadow-sm">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide">Plan</span>
                    <span className="font-bold text-gray-900">{selectedPlan.name}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide">Billing</span>
                    <span className="font-semibold text-gray-800">{cycle.charAt(0).toUpperCase() + cycle.slice(1)}</span>
                  </div>
                  {selectedLocation && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide">Location</span>
                      <span className="font-semibold text-gray-800">{selectedLocation.countryName} — {selectedLocation.city}</span>
                    </div>
                  )}
                  {selectedOs && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide">OS</span>
                      <span className="font-semibold text-gray-800">{selectedOs.name} {selectedOs.version}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide">Hostname</span>
                    <span className="font-mono text-[13px] text-gray-800">{hostname}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide">Root Password</span>
                    <span className="font-mono text-[13px] text-gray-400">{'•'.repeat(Math.min(rootPassword.length, 12))}</span>
                  </div>
                  {weeklyBackups && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide">Backups</span>
                      <span className="font-semibold text-emerald-600">✓ Weekly (+{formatPrice(BACKUP_PRICE)}/mo)</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-[14px] font-bold text-gray-700">Total</span>
                    <span className="text-[20px] font-extrabold" style={{ color: BRAND }}>{formatPrice(total)}</span>
                  </div>
                </div>
                <div className="mt-8 flex items-center justify-between">
                  <button onClick={() => setStep("configure")} className="px-5 py-2.5 rounded-xl text-gray-600 font-semibold text-[14px] border border-gray-200 hover:bg-gray-50">← Back</button>
                  <button onClick={() => setStep("payment")}
                    className="px-8 py-3 rounded-xl text-white font-bold text-[15px] flex items-center gap-2 hover:scale-[1.02] transition-all"
                    style={{ background: G }}>
                    Proceed to Payment <ArrowRight size={18}/>
                  </button>
                </div>
              </div>
            )}

            {/* Step 6: Payment */}
            {step === "payment" && (
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Payment</h1>
                <p className="text-gray-500 mb-6 text-[14px]">Complete your VPS order.</p>
                {!user && (
                  <div className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                    <AlertCircle size={18} className="text-amber-500 mt-0.5 shrink-0"/>
                    <div>
                      <div className="font-semibold text-amber-800 text-[13px]">Sign in to complete your order</div>
                      <button onClick={() => { localStorage.setItem("postLoginRedirect", "/cart/vps"); navigate("/client/login?redirect=/cart/vps"); }}
                        className="mt-1.5 text-[12px] font-bold text-white px-4 py-1.5 rounded-lg" style={{ background: G }}>
                        Sign In / Register
                      </button>
                    </div>
                  </div>
                )}
                {/* Promo */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
                  <div className="font-semibold text-gray-800 text-[14px] mb-3 flex items-center gap-2"><Tag size={15} style={{ color: BRAND }}/> Promo Code</div>
                  {promoApplied ? (
                    <div className="flex items-center gap-2 text-emerald-600 font-semibold text-[13px]">
                      <CheckCircle2 size={16}/> {promoCode.toUpperCase()} — {formatPrice(promoDiscount)} off
                      <button onClick={() => { setPromoApplied(false); setPromoDiscount(0); setPromoCode(""); }} className="ml-auto text-gray-400"><X size={14}/></button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input value={promoCode} onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError(""); }}
                        placeholder="Enter promo code" className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-[13px] outline-none focus:border-purple-400"/>
                      <button onClick={applyPromo} disabled={promoLoading || !promoCode.trim()}
                        className="px-4 py-2 rounded-xl text-white text-[13px] font-semibold disabled:opacity-50" style={{ background: G }}>
                        {promoLoading ? <Loader2 size={14} className="animate-spin"/> : "Apply"}
                      </button>
                    </div>
                  )}
                  {promoError && <p className="text-red-500 text-[12px] mt-1">{promoError}</p>}
                </div>
                {/* Credits */}
                {user && creditBalance > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={applyCredits} onChange={e => setApplyCredits(e.target.checked)} className="w-4 h-4 accent-purple-600"/>
                      <div>
                        <div className="font-semibold text-gray-800 text-[13px] flex items-center gap-1.5"><Wallet size={14} className="text-purple-500"/> Apply Credits</div>
                        <div className="text-[12px] text-gray-400">Balance: {formatPrice(creditBalance)}</div>
                      </div>
                    </label>
                  </div>
                )}
                {/* Payment methods */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
                  <div className="font-semibold text-gray-800 text-[14px] mb-3">Payment Method</div>
                  {pmLoading ? <div className="flex items-center gap-2 text-gray-400 text-[13px]"><Loader2 size={14} className="animate-spin"/> Loading…</div>
                    : paymentMethods.length === 0 ? <p className="text-gray-400 text-[13px]">No payment methods available.</p>
                    : (
                      <div className="grid gap-2">
                        {paymentMethods.map(pm => (
                          <button key={pm.id} onClick={() => setSelectedPm(pm.id)}
                            className="flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left"
                            style={{ borderColor: selectedPm === pm.id ? BRAND : "#E5E7EB", background: selectedPm === pm.id ? "#FAF5FF" : "#fff" }}>
                            <PaymentIcon type={pm.type}/>
                            <div>
                              <div className="font-semibold text-[13px] text-gray-800">{pm.name}</div>
                              {pm.description && <div className="text-[11px] text-gray-400">{pm.description}</div>}
                            </div>
                            {pm.isSandbox && <span className="ml-auto text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">TEST</span>}
                            {selectedPm === pm.id && <CheckCircle2 size={16} className="ml-auto" style={{ color: BRAND }}/>}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
                <div className="flex items-center justify-between">
                  <button onClick={() => setStep("configure")} className="px-5 py-2.5 rounded-xl text-gray-600 font-semibold text-[14px] border border-gray-200 hover:bg-gray-50">← Back</button>
                  <button onClick={placeOrder} disabled={placing || (!selectedPm && !applyCredits)}
                    className="px-8 py-3 rounded-xl text-white font-bold text-[16px] flex items-center gap-2 disabled:opacity-40 hover:scale-[1.02] transition-all"
                    style={{ background: G }}>
                    {placing ? <Loader2 size={18} className="animate-spin"/> : <Lock size={18}/>}
                    {placing ? "Ordering…" : `Pay ${formatPrice(total)}`}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-80 shrink-0">
            <div className="sticky top-20 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="font-bold text-gray-900 text-[15px] mb-4 flex items-center gap-2"><Zap size={16} className="text-amber-400"/> VPS Summary</div>
              {selectedPlan ? (
                <>
                  <div className="rounded-xl bg-purple-50 border border-purple-100 p-3 mb-3">
                    <div className="font-bold text-gray-900 text-[14px]">{selectedPlan.name}</div>
                    <div className="text-[12px] text-gray-500 mt-0.5">{CYCLE_LABELS[cycle]} billing</div>
                    <div className="font-extrabold text-[17px] mt-2" style={{ color: BRAND }}>{formatPrice(planPrice(selectedPlan, cycle))}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[12px] text-gray-600 mb-3">
                    <span className="flex items-center gap-1"><Cpu size={11} className="text-purple-400"/>{selectedPlan.cpuCores} vCPU</span>
                    <span className="flex items-center gap-1"><MemoryStick size={11} className="text-blue-400"/>{selectedPlan.ramGb} GB RAM</span>
                    <span className="flex items-center gap-1"><HardDrive size={11} className="text-orange-400"/>{selectedPlan.storageGb} GB SSD</span>
                    <span className="flex items-center gap-1"><Wifi size={11} className="text-green-400"/>{selectedPlan.bandwidthTb ?? "∞"} TB</span>
                  </div>
                  {selectedLocation && (
                    <div className="text-[12px] text-gray-600 mb-2 flex items-center gap-1.5">
                      <Globe size={11} className="text-blue-400"/> {selectedLocation.countryName}{selectedLocation.city ? `, ${selectedLocation.city}` : ""}
                    </div>
                  )}
                  {selectedOs && (
                    <div className="text-[12px] text-gray-600 mb-3 flex items-center gap-1.5">
                      <Server size={11} className="text-gray-400"/> {selectedOs.name} {selectedOs.version}
                    </div>
                  )}
                  <div className="border-t border-gray-100 pt-3 space-y-1.5 text-[13px]">
                    <div className="flex justify-between text-gray-600"><span>VPS Plan</span><span>{formatPrice(planPrice(selectedPlan, cycle))}</span></div>
                    {weeklyBackups && <div className="flex justify-between text-gray-600"><span>Backups Add-on</span><span>+{formatPrice(backupAddOn)}</span></div>}
                    {promoApplied && <div className="flex justify-between text-emerald-600"><span>Promo</span><span>-{formatPrice(promoDiscount)}</span></div>}
                    {applyCredits && <div className="flex justify-between text-purple-600"><span>Credits</span><span>-{formatPrice(Math.min(creditBalance, subtotal))}</span></div>}
                    <div className="flex justify-between font-extrabold text-gray-900 text-[15px] pt-2 border-t border-gray-100"><span>Total</span><span style={{ color: BRAND }}>{formatPrice(total)}</span></div>
                  </div>
                  <div className="mt-4 space-y-1.5">
                    {["Full Root Access","KVM Virtualization","DDoS Protection","24/7 Support"].map(f => (
                      <div key={f} className="flex items-center gap-2 text-[11px] text-gray-500"><Check size={11} className="text-green-500 shrink-0"/>{f}</div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-6 text-gray-400 text-[13px]"><Zap size={28} className="mx-auto mb-2 text-gray-200"/><p>Select a plan to see summary</p></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
