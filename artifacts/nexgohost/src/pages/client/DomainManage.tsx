import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Globe, CheckCircle2, Lock, ChevronRight, RefreshCw,
  Network, ShieldCheck, Eye, Key, Copy, CheckCheck, Loader2,
  Plus, Trash2, Server, ExternalLink, AlertTriangle, RotateCcw, Save,
  Sparkles, PartyPopper, Timer,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/context/CurrencyProvider";

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token") || "";
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers },
  });
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) throw new Error(`Server error (${res.status})`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || "Request failed");
  return data;
}

interface MyDomain {
  id: string; name: string; tld: string; status: string;
  registrationDate: string | null; expiryDate: string | null;
  autoRenew: boolean; nameservers: string[] | null;
  lockStatus: string | null; eppCode: string | null;
  isIn60DayLock: boolean; daysRemainingInLock: number;
  lockOverrideByAdmin: boolean; registrationAgeDays: number;
  renewalPrice?: number; registrationPrice?: number;
}

interface DnsRecord { id: string; type: string; name: string; value: string; ttl?: number; }

const TLD_COLORS: Record<string, { bg: string; text: string }> = {
  ".com": { bg: "#1a73e8", text: "#fff" }, ".net": { bg: "#0f9d58", text: "#fff" },
  ".org": { bg: "#8430d6", text: "#fff" }, ".co": { bg: "#e67c00", text: "#fff" },
  ".io": { bg: "#1a1a2e", text: "#e0e0ff" }, ".uk": { bg: "#012169", text: "#fff" },
  ".pk": { bg: "#01411c", text: "#fff" }, ".us": { bg: "#3c3b6e", text: "#fff" },
  ".de": { bg: "#000000", text: "#fff" }, ".in": { bg: "#FF9933", text: "#fff" },
  ".ae": { bg: "#00732f", text: "#fff" }, ".biz": { bg: "#b5451b", text: "#fff" },
  ".blog": { bg: "#21759b", text: "#fff" }, ".co.uk": { bg: "#003087", text: "#fff" },
  ".com.pk": { bg: "#01411c", text: "#fff" }, ".eu": { bg: "#003399", text: "#ffcc00" },
  ".info": { bg: "#2aa0d4", text: "#fff" },
};

function LargeExpiryRing({ daysLeft, registrationDate }: { daysLeft: number | null; registrationDate?: string | null }) {
  const size = 200;
  if (daysLeft === null) return null;
  const regDate = registrationDate ? new Date(registrationDate) : null;
  const total = regDate
    ? Math.round((Date.now() - regDate.getTime()) / 86400000) + Math.max(0, daysLeft)
    : 365;
  const pct = Math.max(0, Math.min(100, (Math.max(0, daysLeft) / Math.max(1, total)) * 100));
  const cx = size / 2;
  const r = size * 0.38;
  const sw = size * 0.07;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = daysLeft < 0 ? "#ef4444" : daysLeft < 30 ? "#ef4444" : daysLeft < 90 ? "#f59e0b" : "#22c55e";
  const glow = daysLeft < 0 ? "rgba(239,68,68,0.25)" : daysLeft < 30 ? "rgba(245,158,11,0.25)" : "rgba(34,197,94,0.20)";

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)", filter: `drop-shadow(0 0 12px ${glow})` }}>
        <circle cx={cx} cy={cx} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={sw} fill="none" />
        <circle cx={cx} cy={cx} r={r} stroke={color} strokeWidth={sw} fill="none"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black leading-none" style={{ color }}>
          {daysLeft < 0 ? Math.abs(daysLeft) : daysLeft}
        </span>
        <span className="text-[11px] font-semibold text-muted-foreground mt-0.5">
          {daysLeft < 0 ? "days ago" : "days left"}
        </span>
      </div>
    </div>
  );
}

const EPP_REASONS = [
  "Better Pricing at New Registrar",
  "Moving Registrar",
  "Support Issue",
  "Business Sale or Acquisition",
  "Consolidating Domains",
  "Other",
];

export default function DomainManage() {
  const [, params] = useRoute("/client/domains/manage/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const queryClient = useQueryClient();
  const domainId = params?.id ?? "";

  const [section, setSection] = useState<"dns" | "nameservers" | null>(null);
  const [lockLoading, setLockLoading] = useState(false);
  const [autoRenewLoading, setAutoRenewLoading] = useState(false);
  const [lockStatus, setLockStatus] = useState<string | null>(null);
  const [autoRenewState, setAutoRenewState] = useState<boolean | null>(null);
  const [eppVisible, setEppVisible] = useState(false);
  const [eppCode, setEppCode] = useState<string | null>(null);
  const [eppCopied, setEppCopied] = useState(false);
  const [eppReasonModal, setEppReasonModal] = useState(false);
  const [eppReason, setEppReason] = useState("");
  const [eppFetching, setEppFetching] = useState(false);

  const [nameservers, setNameservers] = useState<string[]>(["ns1.noehost.com", "ns2.noehost.com"]);
  const [nsEditing, setNsEditing] = useState(false);
  const [nsSaving, setNsSaving] = useState(false);

  const [dnsNew, setDnsNew] = useState({ type: "A", name: "", value: "", ttl: 3600 });
  const [dnsAdding, setDnsAdding] = useState(false);
  const [dnsDeleting, setDnsDeleting] = useState<string | null>(null);
  const [showAddDns, setShowAddDns] = useState(false);

  const { data: allDomains = [], isLoading: domainLoading } = useQuery<MyDomain[]>({
    queryKey: ["my-domains"],
    queryFn: () => apiFetch("/api/domains"),
  });

  const domain: MyDomain | undefined = allDomains.find(d => d.id === domainId);

  useEffect(() => {
    if (domain) {
      setLockStatus(s => s ?? (domain.lockStatus ?? "locked"));
      setAutoRenewState(s => s !== null ? s : domain.autoRenew);
      if (domain.nameservers?.length) setNameservers(domain.nameservers);
    }
  }, [domain]);

  const { data: dnsRecords = [], refetch: refetchDns, isLoading: dnsLoading } = useQuery<DnsRecord[]>({
    queryKey: ["domain-dns", domainId],
    queryFn: () => apiFetch(`/api/domains/${domainId}/dns`),
    enabled: !!domainId && section === "dns",
    retry: false,
  });

  const { data: hostingServices = [] } = useQuery<Array<{ id: string; domain: string | null; status: string }>>({
    queryKey: ["client-services-domains"],
    queryFn: () => apiFetch("/api/client/hosting"),
    retry: false,
  });

  if (domainLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 size={32} className="animate-spin text-primary" />
        <p className="text-muted-foreground">Loading domain…</p>
      </div>
    );
  }

  if (!domain) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Globe size={48} className="text-muted-foreground opacity-30" />
        <p className="font-semibold text-foreground">Domain not found</p>
        <button onClick={() => navigate("/client/domains")}
          className="text-sm text-primary hover:underline flex items-center gap-1.5">
          <ArrowLeft size={14} /> Back to Domains
        </button>
      </div>
    );
  }

  const expiryDate = domain.expiryDate ? new Date(domain.expiryDate) : null;
  const daysLeft = expiryDate ? Math.floor((expiryDate.getTime() - Date.now()) / 86400000) : null;
  const fullName = `${domain.name}${domain.tld}`;
  const tldColor = TLD_COLORS[domain.tld] ?? { bg: "#4b5563", text: "#fff" };
  const tldLabel = domain.tld.startsWith(".") ? domain.tld.slice(1).toUpperCase() : domain.tld.toUpperCase();
  const isActive = domain.status === "active";
  const isExpired = domain.status === "expired";
  const hasHosting = hostingServices.some(
    s => s.status === "active" && s.domain?.toLowerCase() === fullName.toLowerCase()
  );
  const hasValidNameservers = (domain.nameservers ?? []).filter(ns => ns?.trim()).length >= 2;
  const isWebsiteLive = hasHosting && hasValidNameservers;
  const setupComplete = isActive && hasHosting && isWebsiteLive;
  const currentLock = lockStatus ?? domain.lockStatus ?? "locked";
  const isLocked = currentLock === "locked";
  const currentAutoRenew = autoRenewState !== null ? autoRenewState : domain.autoRenew;

  const ringColor = daysLeft === null ? "#22c55e"
    : daysLeft < 0 ? "#ef4444"
    : daysLeft < 30 ? "#ef4444"
    : daysLeft < 90 ? "#f59e0b"
    : "#22c55e";

  const statusMap: Record<string, { label: string; cls: string }> = {
    active: { label: "Active", cls: "bg-green-500/10 text-green-400 border-green-500/20" },
    expired: { label: "Expired", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
    pending: { label: "Pending", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
    suspended: { label: "Suspended", cls: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
    transferred: { label: "Transferred", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    cancelled: { label: "Cancelled", cls: "bg-secondary text-muted-foreground border-border" },
    grace_period: { label: "Grace Period", cls: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
    redemption_period: { label: "Redemption Period", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    pending_delete: { label: "Pending Delete", cls: "bg-red-700/10 text-red-500 border-red-700/20" },
    client_hold: { label: "Client Hold", cls: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  };
  const statusInfo = statusMap[domain.status] ?? { label: domain.status, cls: "bg-secondary text-muted-foreground border-border" };

  // Lifecycle lock: disable DNS/NS management for critical lifecycle states
  const isLifecycleLocked = ["redemption_period", "pending_delete", "client_hold"].includes(domain.status);

  async function handleToggleLock() {
    if (isLocked && domain.isIn60DayLock && !domain.lockOverrideByAdmin) {
      toast({ title: "Transfer Lock Cannot Be Removed", description: `${domain.daysRemainingInLock} day(s) remaining in 60-day lock period.`, variant: "destructive" });
      return;
    }
    setLockLoading(true);
    try {
      const data = await apiFetch(`/api/domains/${domainId}/lock`, { method: "PUT" });
      setLockStatus(data.lockStatus);
      if (data.lockStatus === "unlocked" && data.eppCode) setEppCode(data.eppCode);
      toast({ title: data.lockStatus === "locked" ? "Transfer Lock Enabled" : "Transfer Lock Disabled" });
      queryClient.invalidateQueries({ queryKey: ["my-domains"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLockLoading(false); }
  }

  async function handleToggleAutoRenew() {
    setAutoRenewLoading(true);
    const next = !currentAutoRenew;
    try {
      await apiFetch(`/api/domains/${domainId}/auto-renew`, { method: "PUT", body: JSON.stringify({ autoRenew: next }) });
      setAutoRenewState(next);
      toast({ title: `Auto-Renew ${next ? "enabled" : "disabled"}` });
      queryClient.invalidateQueries({ queryKey: ["my-domains"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setAutoRenewLoading(false); }
  }

  async function handleSaveNameservers() {
    const ns = nameservers.map(n => n.trim()).filter(Boolean);
    if (ns.length < 2) { toast({ title: "Minimum 2 nameservers required", variant: "destructive" }); return; }
    setNsSaving(true);
    try {
      await apiFetch(`/api/domains/${domainId}/nameservers`, { method: "PUT", body: JSON.stringify({ nameservers: ns }) });
      toast({ title: "Nameservers updated" });
      setNsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["my-domains"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setNsSaving(false); }
  }

  async function handleAddDns() {
    if (!dnsNew.name || !dnsNew.value) { toast({ title: "Name and value are required", variant: "destructive" }); return; }
    setDnsAdding(true);
    try {
      await apiFetch(`/api/domains/${domainId}/dns`, { method: "POST", body: JSON.stringify(dnsNew) });
      toast({ title: "DNS record added" });
      setDnsNew({ type: "A", name: "", value: "", ttl: 3600 });
      setShowAddDns(false);
      refetchDns();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setDnsAdding(false); }
  }

  async function handleDeleteDns(recordId: string) {
    if (!confirm("Delete this DNS record?")) return;
    setDnsDeleting(recordId);
    try {
      await apiFetch(`/api/domains/${domainId}/dns/${recordId}`, { method: "DELETE" });
      toast({ title: "DNS record deleted" });
      refetchDns();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setDnsDeleting(null); }
  }

  function handleFetchEpp() {
    if (eppCode) { setEppVisible(v => !v); return; }
    setEppReason("");
    setEppReasonModal(true);
  }

  async function handleConfirmEppReason() {
    if (!eppReason) { toast({ title: "Select a transfer reason", variant: "destructive" }); return; }
    setEppFetching(true);
    try {
      const data = await apiFetch(`/api/domains/${domainId}/epp`, {
        method: "GET",
      });
      setEppCode(data.eppCode ?? null);
      setEppVisible(true);
      setEppReasonModal(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setEppFetching(false); }
  }

  async function copyEpp() {
    if (!eppCode) return;
    await navigator.clipboard.writeText(eppCode);
    setEppCopied(true);
    setTimeout(() => setEppCopied(false), 2000);
  }

  return (
    <div className="space-y-6 pb-10">

      {/* ── Back nav ── */}
      <button onClick={() => navigate("/client/domains")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft size={15} /> Back to Domains
      </button>

      {/* ── Hero: Ring + Domain Info ── */}
      <div className="rounded-2xl border border-border overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(112,26,254,0.06) 0%, rgba(155,81,224,0.03) 50%, transparent 100%)" }}>
        <div className="px-6 py-8 flex flex-col sm:flex-row items-center gap-8">

          {/* Ring */}
          <div className="shrink-0">
            <LargeExpiryRing daysLeft={daysLeft} registrationDate={domain.registrationDate} />
          </div>

          {/* Domain Details */}
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-3 mb-3">
              <div style={{ background: tldColor.bg, color: tldColor.text }}
                className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm shrink-0">
                {tldLabel}
              </div>
              <div>
                <h1 className="text-2xl font-black font-mono text-foreground tracking-tight">{fullName}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${statusInfo.cls}`}>
                    {statusInfo.label}
                  </span>
                  {currentAutoRenew && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                      Auto-Renew ON
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Registered</p>
                <p className="font-medium text-foreground">
                  {domain.registrationDate ? format(new Date(domain.registrationDate), "MMM d, yyyy") : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Expires</p>
                <p className="font-medium" style={{ color: ringColor }}>
                  {expiryDate ? format(expiryDate, "MMM d, yyyy") : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Registrar</p>
                <p className="font-medium text-foreground capitalize">{(domain as any).registrar || "Noehost"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3-Mark Setup Wizard ── */}
      {setupComplete ? (
        <div className="rounded-2xl overflow-hidden border border-green-500/30 relative"
          style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(112,26,254,0.06) 100%)" }}>
          <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 60px rgba(34,197,94,0.07)" }} />
          <div className="px-6 py-5 flex items-center gap-4 relative">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)" }}>
              <PartyPopper size={24} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-lg font-black text-foreground">🎉 Website Live!</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                <span className="font-mono font-semibold text-foreground">{fullName}</span> is active, hosted, and live on the internet.
              </p>
            </div>
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2.5 h-2.5 rounded-full bg-green-400" style={{ animation: `pulse 1s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
              <p className="text-[9px] text-green-400 font-bold uppercase tracking-wider">3/3 Done</p>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-green-500/15 border-t border-green-500/20">
            {[
              { label: "Domain Setup", note: "Registered ✓" },
              { label: "Hosting Active", note: "Running ✓" },
              { label: "Launch Complete", note: "Website live ✓" },
            ].map(step => (
              <div key={step.label} className="px-4 py-3 flex flex-col items-center text-center gap-1.5">
                <CheckCircle2 size={16} className="text-green-400" />
                <div>
                  <p className="text-[10px] font-bold text-foreground">{step.label}</p>
                  <p className="text-[9px] text-green-400 font-semibold">{step.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-primary/20 overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(112,26,254,0.05) 0%, rgba(155,81,224,0.02) 100%)" }}>
          <div className="px-5 py-3.5 border-b border-primary/10 flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #701AFE, #9B51E0)" }}>
              <Globe size={12} className="text-white" />
            </div>
            <p className="text-sm font-bold text-foreground">Website Setup</p>
            <span className="ml-auto text-xs font-semibold text-primary">
              {[isActive, hasHosting, isWebsiteLive].filter(Boolean).length}/3 Complete
            </span>
          </div>

          <div className="grid grid-cols-3 divide-x divide-primary/10">
            {/* Step 1: Domain Setup */}
            <div className="px-4 py-4 flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-500/15 border border-green-500/30">
                <CheckCircle2 size={18} className="text-green-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Domain Setup</p>
                <p className="text-[10px] text-green-400 font-medium mt-0.5">Registered ✓</p>
              </div>
            </div>

            {/* Step 2: Buy Hosting */}
            <div className={`px-4 py-4 flex flex-col items-center text-center gap-2 ${!hasHosting ? "bg-primary/[0.03]" : ""}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all
                ${hasHosting ? "bg-green-500/15 border border-green-500/30"
                : isActive ? "bg-primary/15 border border-primary/30 animate-pulse"
                : "bg-secondary border border-border opacity-60"}`}>
                {hasHosting ? <CheckCircle2 size={18} className="text-green-400" />
                  : isActive ? <ChevronRight size={18} className="text-primary" />
                  : <Lock size={15} className="text-muted-foreground" />}
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Buy Hosting</p>
                {hasHosting
                  ? <p className="text-[10px] text-green-400 font-medium mt-0.5">Active ✓</p>
                  : isActive
                  ? <button onClick={() => navigate("/client/orders/new")}
                      className="text-[10px] text-primary font-semibold hover:underline mt-0.5 flex items-center gap-0.5 mx-auto">
                      Get Hosting <ExternalLink size={9} />
                    </button>
                  : <p className="text-[10px] text-muted-foreground mt-0.5">Requires active domain</p>}
              </div>
            </div>

            {/* Step 3: Launch Website — auto-completes when hosting + valid nameservers */}
            <div className="px-4 py-4 flex flex-col items-center text-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all
                ${isWebsiteLive ? "bg-green-500/15 border border-green-500/30"
                : hasHosting ? "bg-amber-500/15 border border-amber-500/30 animate-pulse"
                : "bg-secondary border border-border opacity-50"}`}>
                {isWebsiteLive ? <CheckCircle2 size={18} className="text-green-400" />
                  : hasHosting ? <Network size={16} className="text-amber-400" />
                  : <Lock size={15} className="text-muted-foreground" />}
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Launch Website</p>
                {isWebsiteLive
                  ? <p className="text-[10px] text-green-400 font-semibold mt-0.5">Live ✓</p>
                  : hasHosting
                  ? <button onClick={() => setSection("nameservers")}
                      className="text-[10px] text-amber-400 font-semibold hover:underline mt-0.5">
                      Set nameservers →
                    </button>
                  : <p className="text-[10px] text-muted-foreground mt-0.5">Unlocks with hosting</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Expiry Warning ── */}
      {daysLeft !== null && daysLeft < 30 && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${daysLeft < 0 ? "bg-red-500/5 border-red-500/25" : "bg-amber-500/5 border-amber-500/25"}`}>
          <AlertTriangle size={16} className={daysLeft < 0 ? "text-red-400 shrink-0 mt-0.5" : "text-amber-400 shrink-0 mt-0.5"} />
          <div>
            <p className="text-sm font-semibold" style={{ color: daysLeft < 0 ? "#f87171" : "#fbbf24" }}>
              {daysLeft < 0 ? `Domain expired ${Math.abs(daysLeft)} days ago` : `Expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {daysLeft < 0 ? "Renew immediately to restore your domain." : "Renew now to avoid service interruption."}
            </p>
          </div>
        </div>
      )}

      {/* ── Lifecycle Warning Banner ── */}
      {isLifecycleLocked && (
        <div className={`rounded-xl border px-4 py-4 flex items-start gap-3 ${
          domain.status === "pending_delete"
            ? "bg-red-500/5 border-red-500/30"
            : domain.status === "redemption_period"
            ? "bg-amber-500/5 border-amber-500/30"
            : "bg-slate-500/5 border-slate-500/30"
        }`}>
          <AlertTriangle size={18} className={`shrink-0 mt-0.5 ${
            domain.status === "pending_delete" ? "text-red-500"
            : domain.status === "redemption_period" ? "text-amber-400"
            : "text-slate-400"
          }`} />
          <div>
            <p className={`text-sm font-bold ${
              domain.status === "pending_delete" ? "text-red-400"
              : domain.status === "redemption_period" ? "text-amber-400"
              : "text-slate-400"
            }`}>
              {domain.status === "pending_delete" && "🚨 Critical: Domain Pending Deletion"}
              {domain.status === "redemption_period" && "⚠ Domain in Redemption Period"}
              {domain.status === "client_hold" && "Domain on Client Hold"}
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {domain.status === "pending_delete" && "Your domain is in the final deletion stage. DNS and nameserver management are disabled. Contact support immediately."}
              {domain.status === "redemption_period" && "Your domain is in the ICANN Redemption Period. A restore fee applies to recover it. DNS and nameserver management are disabled until the domain is restored."}
              {domain.status === "client_hold" && "This domain has been placed on hold by an administrator. DNS and nameserver management are disabled. Contact support for assistance."}
            </p>
          </div>
        </div>
      )}

      {/* ── Modular Control Grid ── */}
      <div>
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Domain Controls</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">

          {/* Manage DNS */}
          <button
            onClick={() => {
              if (isLifecycleLocked) { toast({ title: "DNS Management Disabled", description: "DNS management is unavailable during lifecycle restriction. Contact support.", variant: "destructive" }); return; }
              setSection(s => s === "dns" ? null : "dns");
            }}
            className={`flex flex-col items-start gap-3 p-4 rounded-2xl border transition-all text-left group
              ${isLifecycleLocked ? "opacity-50 cursor-not-allowed border-border bg-card" : section === "dns" ? "border-primary/40 bg-primary/5" : "border-border bg-card hover:border-primary/30 hover:bg-primary/[0.02]"}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors
              ${section === "dns" && !isLifecycleLocked ? "bg-primary/20" : "bg-secondary"}`}>
              <Network size={18} className={section === "dns" && !isLifecycleLocked ? "text-primary" : "text-muted-foreground"} />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Manage DNS</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{isLifecycleLocked ? "Unavailable" : "A, CNAME, MX, TXT records"}</p>
            </div>
          </button>

          {/* Nameservers */}
          <button
            onClick={() => {
              if (isLifecycleLocked) { toast({ title: "Nameserver Management Disabled", description: "Nameserver management is unavailable during lifecycle restriction. Contact support.", variant: "destructive" }); return; }
              setSection(s => s === "nameservers" ? null : "nameservers");
            }}
            className={`flex flex-col items-start gap-3 p-4 rounded-2xl border transition-all text-left group
              ${isLifecycleLocked ? "opacity-50 cursor-not-allowed border-border bg-card" : section === "nameservers" ? "border-primary/40 bg-primary/5" : "border-border bg-card hover:border-primary/30 hover:bg-primary/[0.02]"}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors
              ${section === "nameservers" && !isLifecycleLocked ? "bg-primary/20" : "bg-secondary"}`}>
              <Server size={18} className={section === "nameservers" && !isLifecycleLocked ? "text-primary" : "text-muted-foreground"} />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Nameservers</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-mono truncate w-full">{isLifecycleLocked ? "Unavailable" : "ns1.noehost.com"}</p>
            </div>
          </button>

          {/* WHOIS Privacy */}
          <button
            onClick={() => toast({ title: "WHOIS Privacy", description: "Your WHOIS data is protected by default on all Noehost domains." })}
            className="flex flex-col items-start gap-3 p-4 rounded-2xl border border-border bg-card hover:border-primary/30 hover:bg-primary/[0.02] transition-all text-left group">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <Eye size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">WHOIS Privacy</p>
              <p className="text-[10px] text-green-400 font-semibold mt-0.5">Protected ✓</p>
            </div>
          </button>

          {/* Transfer Lock */}
          {domain.isIn60DayLock && !domain.lockOverrideByAdmin ? (
            <div className="flex flex-col items-start gap-3 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 text-left cursor-not-allowed opacity-90">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <Timer size={18} className="text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Transfer Lock</p>
                <p className="text-[10px] font-semibold text-amber-400 mt-0.5">🔒 Locked</p>
                <div className="mt-1.5 px-2 py-0.5 bg-amber-500/15 border border-amber-500/25 rounded-full w-fit">
                  <p className="text-[9px] font-bold text-amber-400 whitespace-nowrap">
                    Transfer Guard Active: {domain.daysRemainingInLock}d left
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <button onClick={handleToggleLock} disabled={lockLoading}
              className="flex flex-col items-start gap-3 p-4 rounded-2xl border border-border bg-card hover:border-primary/30 hover:bg-primary/[0.02] transition-all text-left group disabled:opacity-60">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                {lockLoading
                  ? <Loader2 size={18} className="animate-spin text-muted-foreground" />
                  : <ShieldCheck size={18} className={isLocked ? "text-green-400" : "text-red-400"} />}
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Transfer Lock</p>
                <p className={`text-[10px] font-semibold mt-0.5 ${isLocked ? "text-green-400" : "text-red-400"}`}>
                  {isLocked ? "🔒 Protected" : "🔓 Unlocked"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {isLocked ? "Tap to unlock for transfer" : "Tap to re-lock"}
                </p>
              </div>
            </button>
          )}

          {/* Auto-Renew */}
          <button onClick={handleToggleAutoRenew} disabled={autoRenewLoading}
            className="flex flex-col items-start gap-3 p-4 rounded-2xl border border-border bg-card hover:border-primary/30 hover:bg-primary/[0.02] transition-all text-left group disabled:opacity-60">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              {autoRenewLoading
                ? <Loader2 size={18} className="animate-spin text-muted-foreground" />
                : <RotateCcw size={18} className={currentAutoRenew ? "text-primary" : "text-muted-foreground"} />}
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Auto-Renew</p>
              <p className={`text-[10px] font-semibold mt-0.5 ${currentAutoRenew ? "text-primary" : "text-muted-foreground"}`}>
                {currentAutoRenew ? "ON — tap to disable" : "OFF — tap to enable"}
              </p>
            </div>
          </button>

          {/* EPP Code */}
          <button onClick={isLocked ? undefined : handleFetchEpp}
            disabled={isLocked}
            className={`flex flex-col items-start gap-3 p-4 rounded-2xl border transition-all text-left group
              ${isLocked ? "border-border bg-card opacity-50 cursor-not-allowed" : "border-border bg-card hover:border-primary/30 hover:bg-primary/[0.02]"}`}>
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <Key size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">EPP Code</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {isLocked ? "Unlock transfer first" : eppVisible ? "Tap to hide" : "Select reason → reveal"}
              </p>
            </div>
          </button>

        </div>
      </div>

      {/* ── EPP Code Display ── */}
      {eppVisible && eppCode && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/5 border border-amber-500/25 rounded-xl">
          <Key size={14} className="text-amber-400 shrink-0" />
          <code className="flex-1 font-mono text-sm text-foreground tracking-widest">{eppCode}</code>
          <button onClick={copyEpp}
            className="p-2 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors">
            {eppCopied ? <CheckCheck size={14} /> : <Copy size={14} />}
          </button>
        </div>
      )}

      {/* ── Nameservers Section ── */}
      {section === "nameservers" && (
        <div className="rounded-2xl border border-primary/20 bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server size={15} className="text-primary" />
              <p className="text-sm font-bold text-foreground">Nameservers</p>
            </div>
            {!nsEditing
              ? <button onClick={() => setNsEditing(true)}
                  className="text-xs font-semibold text-primary hover:underline">Edit</button>
              : <div className="flex items-center gap-2">
                  <button onClick={() => setNsEditing(false)}
                    className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                  <button onClick={handleSaveNameservers} disabled={nsSaving}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg, #701AFE, #9B51E0)" }}>
                    {nsSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    Save
                  </button>
                </div>}
          </div>
          <div className="p-5 space-y-3">
            {nameservers.map((ns, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-black text-primary">{i + 1}</span>
                </div>
                {nsEditing
                  ? <input
                      className="flex-1 px-3 py-2 bg-secondary border border-border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                      value={ns}
                      onChange={e => setNameservers(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                    />
                  : <p className="text-sm font-mono text-foreground flex-1">{ns}</p>}
                {nsEditing && nameservers.length > 2 && (
                  <button onClick={() => setNameservers(prev => prev.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            {nsEditing && nameservers.length < 5 && (
              <button onClick={() => setNameservers(prev => [...prev, ""])}
                className="flex items-center gap-2 text-xs text-primary hover:underline font-medium mt-1">
                <Plus size={12} /> Add Nameserver
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── DNS Management Section ── */}
      {section === "dns" && (
        <div className="rounded-2xl border border-primary/20 bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network size={15} className="text-primary" />
              <p className="text-sm font-bold text-foreground">DNS Records</p>
            </div>
            <button onClick={() => setShowAddDns(v => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
              style={{ background: "linear-gradient(135deg, #701AFE, #9B51E0)" }}>
              <Plus size={12} /> Add Record
            </button>
          </div>

          {showAddDns && (
            <div className="px-5 py-4 border-b border-border bg-primary/[0.02] space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Type</label>
                  <select
                    className="w-full px-3 py-2 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={dnsNew.type}
                    onChange={e => setDnsNew(p => ({ ...p, type: e.target.value }))}>
                    {["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Name</label>
                  <input className="w-full px-3 py-2 bg-card border border-border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="@ or subdomain" value={dnsNew.name}
                    onChange={e => setDnsNew(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Value</label>
                  <input className="w-full px-3 py-2 bg-card border border-border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="IP or target" value={dnsNew.value}
                    onChange={e => setDnsNew(p => ({ ...p, value: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">TTL</label>
                  <input type="number" className="w-full px-3 py-2 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={dnsNew.ttl}
                    onChange={e => setDnsNew(p => ({ ...p, ttl: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAddDns(false)} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5">Cancel</button>
                <button onClick={handleAddDns} disabled={dnsAdding}
                  className="flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 rounded-lg text-white disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #701AFE, #9B51E0)" }}>
                  {dnsAdding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Save Record
                </button>
              </div>
            </div>
          )}

          {dnsLoading ? (
            <div className="flex justify-center p-10">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : dnsRecords.length === 0 ? (
            <div className="p-10 text-center">
              <Network size={36} className="text-muted-foreground opacity-30 mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">No DNS records yet</p>
              <p className="text-xs text-muted-foreground mt-1">Add your first record above.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              <div className="grid grid-cols-[80px_1fr_1fr_80px_40px] gap-3 px-5 py-2 bg-secondary/30">
                {["Type", "Name", "Value", "TTL", ""].map(h => (
                  <p key={h} className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{h}</p>
                ))}
              </div>
              {dnsRecords.map(rec => (
                <div key={rec.id} className="grid grid-cols-[80px_1fr_1fr_80px_40px] gap-3 items-center px-5 py-3">
                  <span className="text-xs font-black text-primary font-mono bg-primary/10 px-2 py-0.5 rounded-md w-fit">{rec.type}</span>
                  <p className="text-xs font-mono text-foreground truncate">{rec.name}</p>
                  <p className="text-xs font-mono text-muted-foreground truncate">{rec.value}</p>
                  <p className="text-xs text-muted-foreground">{rec.ttl ?? 3600}s</p>
                  <button onClick={() => handleDeleteDns(rec.id)} disabled={dnsDeleting === rec.id}
                    className="text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-50 flex items-center justify-center">
                    {dnsDeleting === rec.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Domain Info Card ── */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-sm font-bold text-foreground mb-4">Domain Information</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {[
            { label: "Full Domain", value: fullName },
            { label: "Status", value: statusInfo.label },
            { label: "Transfer Lock", value: isLocked ? "Locked 🔒" : "Unlocked 🔓" },
            { label: "Auto-Renew", value: currentAutoRenew ? "Enabled" : "Disabled" },
            { label: "Registration", value: domain.registrationDate ? format(new Date(domain.registrationDate), "MMM d, yyyy") : "—" },
            { label: "Expires", value: expiryDate ? format(expiryDate, "MMM d, yyyy") : "—" },
          ].map(item => (
            <div key={item.label}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{item.label}</p>
              <p className="font-medium text-foreground mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── TLD Variation Suggestions ── */}
      <div className="rounded-2xl border border-primary/15 overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(112,26,254,0.04) 0%, rgba(155,81,224,0.02) 100%)" }}>
        <div className="px-5 py-3 border-b border-primary/10 flex items-center gap-2">
          <Sparkles size={14} className="text-primary" />
          <div>
            <p className="text-sm font-bold text-foreground">Secure Your Brand</p>
            <p className="text-[10px] text-muted-foreground">Register {domain.name} in other extensions</p>
          </div>
        </div>
        <div className="p-4 flex flex-wrap gap-2.5">
          {[".net", ".org", ".pk", ".co", ".info", ".biz", ".io", ".com.pk"].filter(t => t !== domain.tld).slice(0, 6).map(tld => (
            <button
              key={tld}
              onClick={() => navigate(`/client/domains?tab=order&domain=${encodeURIComponent(domain.name + tld)}`)}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-card border border-border rounded-xl hover:border-primary/40 transition-colors group"
            >
              <div style={{
                background: ({".com":"#1a73e8",".net":"#0f9d58",".org":"#8430d6",".pk":"#01411c",".co":"#e67c00",".io":"#1a1a2e",".info":"#2aa0d4",".biz":"#b5451b",".com.pk":"#01411c"}[tld] ?? "#4b5563"),
                color: "#fff"
              }} className="w-8 h-8 rounded-lg flex items-center justify-center text-[9px] font-black shrink-0">
                {tld.replace(".", "").replace(".", "").toUpperCase().slice(0, 5)}
              </div>
              <div>
                <p className="text-xs font-bold text-foreground font-mono">{domain.name}{tld}</p>
                <p className="text-[9px] text-primary font-semibold group-hover:underline">Check →</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── EPP Transfer Reason Modal ── */}
      {eppReasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #701AFE, #9B51E0)" }}>
                <Key size={14} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Request EPP Code</p>
                <p className="text-[10px] text-muted-foreground">Select a transfer reason to continue</p>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-muted-foreground">
                Per ICANN policy, a transfer reason is required before an EPP/Auth code is revealed. This is logged for security.
              </p>
              <div className="space-y-2">
                {EPP_REASONS.map(reason => (
                  <button
                    key={reason}
                    onClick={() => setEppReason(reason)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      eppReason === reason
                        ? "border-primary/50 bg-primary/10 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80"
                    }`}
                  >
                    {eppReason === reason && <span className="text-primary mr-2">✓</span>}
                    {reason}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setEppReasonModal(false)}
                  className="flex-1 px-4 py-2 text-sm text-muted-foreground border border-border rounded-xl hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmEppReason}
                  disabled={!eppReason || eppFetching}
                  className="flex-1 px-4 py-2 text-sm font-bold text-white rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #701AFE, #9B51E0)" }}
                >
                  {eppFetching ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
                  Reveal EPP Code
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
