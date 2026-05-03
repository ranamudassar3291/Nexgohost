import { useState, useEffect, useMemo } from "react";
import { useGetClientDashboard, useGetMe } from "@workspace/api-client-react";
import {
  Server, Globe, FileText, Ticket, ShoppingCart, Clock, DollarSign,
  Terminal, Mail, ExternalLink, Loader2, Wallet, Gift, AlertTriangle,
  Sparkles, Award, BookOpen, Megaphone, HardDrive, Wifi, CheckCircle2,
  Rocket, Lock, BadgeCheck, ShieldCheck, Zap, Star, RefreshCw, Globe2,
  PartyPopper, Search, X, ArrowRight, ChevronRight, RotateCcw,
  Cpu, MemoryStick, Activity, Shield, WifiOff, UnlockKeyhole,
} from "lucide-react";
import { WelcomeTour, useWelcomeTour } from "@/components/WelcomeTour";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useCurrency } from "@/context/CurrencyProvider";
import { fmtInvNum } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────────────────── */
interface Order {
  id: string; itemName: string; amount: number; billingCycle: string;
  status: string; paymentStatus: string; createdAt: string; type: string; domain: string | null;
}
interface HostingService {
  id: string; planName: string; domain: string | null; status: string;
  cpanelUrl: string | null; webmailUrl: string | null; username: string | null;
  nextDueDate: string | null; billingCycle: string; freeDomainAvailable: boolean;
  diskUsed?: string | null; bandwidthUsed?: string | null;
  twentyIPackageId?: string | null;
}
interface UsageData {
  disk: { usedFmt: string; limitFmt: string; pct: number };
  bandwidth: { usedFmt: string; limitFmt: string; pct: number };
}
interface DomainItem {
  id: string; name: string; tld: string; status: string; expiryDate: string | null;
  autoRenew?: boolean;
}
interface Announcement {
  id: string; title: string; message: string; type: string; isActive: boolean;
}
interface SetupProgress {
  step1: boolean; step2: boolean; step3: boolean;
  allComplete: boolean; primaryDomain: string | null;
  siteUrl: string | null; pct: number;
}

/* ─── Helpers ────────────────────────────────────────────────────── */
async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Request failed"); }
  return res.json();
}

const CONFETTI_COLORS = ["#4F46E5", "#6366F1", "#818CF8", "#F59E0B", "#10B981", "#3B82F6", "#EC4899", "#F97316"];
function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  const pieces = Array.from({ length: 32 }, (_, i) => ({
    id: i, color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: `${3 + (i * 3.1) % 94}%`, delay: `${(i * 0.08) % 1.8}s`,
    duration: `${1.8 + (i * 0.11) % 1.2}s`, size: i % 3 === 0 ? 10 : i % 3 === 1 ? 7 : 5,
    rotation: i % 2 === 0 ? "360deg" : "-360deg",
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10" aria-hidden>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: "absolute", top: "-12px", left: p.left,
          width: p.size, height: p.size, backgroundColor: p.color,
          borderRadius: p.id % 4 === 0 ? "50%" : "2px",
          animationName: "confettiFall", animationDuration: p.duration,
          animationDelay: p.delay, animationTimingFunction: "ease-in",
          animationIterationCount: "1", animationFillMode: "forwards",
        }} />
      ))}
      <style>{`@keyframes confettiFall { 0% { transform:translateY(0) rotate(0deg) scale(1); opacity:1; } 80% { opacity:1; } 100% { transform:translateY(340px) rotate(720deg) scale(0.6); opacity:0; } }`}</style>
    </div>
  );
}

/* ─── Site Health Types ──────────────────────────────────────────── */
interface SiteHealthService {
  serviceId: string; domain: string; planName: string; status: string;
  uptimePct: number; ssl: string; speedScore: number;
  cpuPct: number; ramPct: number; diskPct: number; bwPct: number;
}
interface SiteHealthData {
  services: SiteHealthService[];
  ai: { icon: string; text: string };
  savedAt: string;
}
interface HistorySeries { date: string; cpu: number; ram: number; speed: number; }
interface HistoryData { series: HistorySeries[]; days: string[]; }

/* ─── Sparkline SVG ──────────────────────────────────────────────── */
function Sparkline({ values, color, height = 40 }: { values: number[]; color: string; height?: number }) {
  if (!values.length) return null;
  const W = 200; const H = height; const pad = 4;
  const max = Math.max(...values, 1); const min = 0;
  const range = max - min || 1;
  const pts = values.map((v, i) => ({
    x: pad + (i / (values.length - 1)) * (W - pad * 2),
    y: H - pad - ((v - min) / range) * (H - pad * 2),
  }));
  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaD = `${pathD} L ${pts[pts.length - 1].x.toFixed(1)} ${H - pad} L ${pts[0].x.toFixed(1)} ${H - pad} Z`;
  const gradId = `sp-${color.replace("#", "")}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradId})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      {pts.length > 0 && (
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2.5" fill={color} />
      )}
    </svg>
  );
}

/* ─── Uptime Gauge ────────────────────────────────────────────────── */
function UptimeGauge({ pct }: { pct: number }) {
  const r = 28; const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 99.5 ? "#10B981" : pct >= 98 ? "#F59E0B" : "#EF4444";
  return (
    <div className="relative w-20 h-20 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 68 68">
        <circle cx="34" cy="34" r={r} fill="none" stroke="#F3F4F6" strokeWidth="7" />
        <circle cx="34" cy="34" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeLinecap="round" strokeDasharray={circ}
          strokeDashoffset={circ - dash}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] font-black" style={{ color }}>{pct.toFixed(1)}%</span>
        <span className="text-[9px] font-medium" style={{ color: "#94A3B8" }}>uptime</span>
      </div>
    </div>
  );
}

/* ─── IP Unblock Banner ───────────────────────────────────────────── */
function IpUnblockBanner() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [detectedIp, setDetectedIp] = useState("");
  const [resultIp, setResultIp]     = useState("");
  const token   = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    fetch("/api/my/security/health-score", { headers })
      .then(r => r.json())
      .then(d => { if (d.detectedIp) setDetectedIp(d.detectedIp); })
      .catch(() => {});
  }, []);

  async function handleUnblock() {
    setStatus("loading");
    try {
      const res  = await fetch("/api/my/security/unblock-ip", { method: "POST", headers });
      const data = await res.json();
      if (data.success) { setStatus("done"); setResultIp(data.ip); }
      else               setStatus("error");
    } catch { setStatus("error"); }
  }

  const isDone  = status === "done";
  const isError = status === "error";

  return (
    <div style={{
      background: isDone
        ? "linear-gradient(135deg,#052e16,#14532d)"
        : "linear-gradient(135deg,#1E1B4B 0%,#312E81 55%,#1E1B4B 100%)",
      borderRadius: 16, overflow: "hidden", position: "relative",
      border: isDone ? "1px solid rgba(16,185,129,0.35)" : "1px solid rgba(99,102,241,0.3)",
      boxShadow: isDone ? "0 8px 32px rgba(16,185,129,0.15)" : "0 8px 32px rgba(79,70,229,0.2)",
      transition: "all 0.4s ease",
    }}>
      <div style={{ position:"absolute", top:-50, right:-50, width:220, height:220,
        background:"radial-gradient(circle,rgba(139,92,246,0.18),transparent 60%)",
        pointerEvents:"none" }} />

      <div className="relative px-5 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Icon badge */}
        <div style={{
          width:54, height:54, borderRadius:14, flexShrink:0, display:"flex",
          alignItems:"center", justifyContent:"center",
          background: isDone ? "rgba(16,185,129,0.2)" : isError ? "rgba(239,68,68,0.2)" : "rgba(99,102,241,0.22)",
          border: `1px solid ${isDone ? "rgba(16,185,129,0.4)" : isError ? "rgba(239,68,68,0.35)" : "rgba(139,92,246,0.4)"}`,
        }}>
          {status === "loading" ? <Loader2 size={22} className="animate-spin" style={{color:"#818CF8"}} />
            : isDone             ? <CheckCircle2 size={22} style={{color:"#10B981"}} />
            : isError            ? <WifiOff size={22} style={{color:"#F87171"}} />
            :                      <UnlockKeyhole size={22} style={{color:"#818CF8"}} />}
        </div>

        {/* Copy */}
        <div className="flex-1 min-w-0">
          {isDone ? <>
            <p style={{color:"#34D399", fontWeight:700, fontSize:15}}>IP Unblocked & Whitelisted</p>
            <p style={{color:"#6EE7B7", fontSize:13, marginTop:2}}>
              <code style={{background:"rgba(255,255,255,0.08)", padding:"1px 7px", borderRadius:5}}>{resultIp}</code>
              {" "}is now whitelisted in the firewall — site access restored.
            </p>
          </> : isError ? <>
            <p style={{color:"#FCA5A5", fontWeight:700, fontSize:15}}>Unblock Failed</p>
            <p style={{color:"#FDA4AF", fontSize:13, marginTop:2}}>Contact support if the issue persists.</p>
          </> : <>
            <p style={{color:"#ffffff", fontWeight:800, fontSize:15, letterSpacing:"-0.01em"}}>
              Can't access your site? <span style={{color:"#A5B4FC"}}>Unblock my IP instantly.</span>
            </p>
            <p style={{color:"#C7D2FE", fontSize:13, marginTop:2}}>
              Your IP{detectedIp
                ? <> <code style={{background:"rgba(255,255,255,0.1)", padding:"1px 6px", borderRadius:5, fontSize:12}}>{detectedIp}</code></>
                : ""} may be blocked by the server firewall. One click removes the block and logs it for the technical team.
            </p>
          </>}
        </div>

        {/* CTA */}
        {!isDone && (
          <button
            onClick={handleUnblock}
            disabled={status === "loading"}
            style={{
              flexShrink:0, padding:"10px 22px", borderRadius:10,
              background: status === "loading" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.13)",
              border:"1px solid rgba(255,255,255,0.22)", color:"#fff",
              fontWeight:700, fontSize:14, cursor: status==="loading" ? "not-allowed":"pointer",
              display:"flex", alignItems:"center", gap:8, whiteSpace:"nowrap",
              transition:"all 0.2s",
            }}
          >
            {status === "loading"
              ? <><Loader2 size={14} className="animate-spin"/>Unblocking…</>
              : <><UnlockKeyhole size={15}/>Unblock My IP</>}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Site Health Panel ───────────────────────────────────────────── */
function SiteHealthPanel() {
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const { data: health, isLoading: healthLoading, refetch, isFetching } = useQuery<SiteHealthData>({
    queryKey: ["my-site-health"],
    queryFn: () => fetch("/api/my/site-health", { headers }).then(r => r.json()),
    staleTime: 300_000,
    retry: false,
  });
  const { data: hist } = useQuery<HistoryData>({
    queryKey: ["my-site-health-history"],
    queryFn: () => fetch("/api/my/site-health/history", { headers }).then(r => r.json()),
    staleTime: 300_000,
    retry: false,
  });

  const services = health?.services ?? [];
  const primary = services[0];
  const cpuHistory  = hist?.series?.map(s => s.cpu)  ?? [];
  const ramHistory  = hist?.series?.map(s => s.ram)  ?? [];

  const sslColor  = primary?.ssl === "active" ? "#10B981" : "#F59E0B";
  const sslLabel  = primary?.ssl === "active" ? "Active" : primary?.ssl === "not_installed" ? "None" : (primary?.ssl ?? "—");
  const speedColor = !primary ? "#94A3B8" : primary.speedScore >= 85 ? "#10B981" : primary.speedScore >= 70 ? "#F59E0B" : "#EF4444";

  if (healthLoading) return (
    <div className="rounded-2xl flex items-center justify-center py-10" style={{ background: "#ffffff", border: "1px solid #E8EAED" }}>
      <Loader2 size={20} className="animate-spin" style={{ color: "#C7D2FE" }} />
    </div>
  );
  if (!services.length && !healthLoading) return null;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #E8EAED", borderRadius: "16px" }}>
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #F3F4F6", background: "#FAFBFF" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#EEF2FF" }}>
            <Activity size={14} style={{ color: "#4F46E5" }} />
          </div>
          <h2 className="font-display font-bold" style={{ fontSize: "15px", color: "#111827" }}>Site Health & Performance</h2>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-70"
          style={{ color: "#6B7280" }}
        >
          <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
          {health?.savedAt ? `Updated ${Math.round((Date.now() - new Date(health.savedAt).getTime()) / 60000)}m ago` : "Refresh"}
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Health Meter Row */}
        <div className="flex flex-wrap gap-4 items-center">
          {/* Uptime Gauge */}
          <div className="flex flex-col items-center gap-1">
            <UptimeGauge pct={primary?.uptimePct ?? 99.9} />
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#9CA3AF" }}>Uptime</span>
          </div>

          {/* Status Pills */}
          <div className="flex flex-col gap-2 flex-1 min-w-[160px]">
            {/* SSL */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: "#F8FAFC", border: "1px solid #E8EAED" }}>
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} style={{ color: sslColor }} />
                <span className="text-xs font-semibold" style={{ color: "#374151" }}>SSL Certificate</span>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: primary?.ssl === "active" ? "#ECFDF5" : "#FFFBEB", color: sslColor }}>
                {sslLabel}
              </span>
            </div>
            {/* Speed Score */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: "#F8FAFC", border: "1px solid #E8EAED" }}>
              <div className="flex items-center gap-2">
                <Zap size={14} style={{ color: speedColor }} />
                <span className="text-xs font-semibold" style={{ color: "#374151" }}>Speed Score</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "#E5E7EB" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${primary?.speedScore ?? 0}%`, background: speedColor }} />
                </div>
                <span className="text-xs font-bold tabular-nums" style={{ color: speedColor }}>{primary?.speedScore ?? "—"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* CPU & RAM Sparklines */}
        {(cpuHistory.length > 1 || ramHistory.length > 1) && (
          <div className="grid grid-cols-2 gap-3">
            {/* CPU */}
            <div className="rounded-xl p-3" style={{ background: "#F8FAFC", border: "1px solid #E8EAED" }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Cpu size={12} style={{ color: "#6366F1" }} />
                  <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#6B7280" }}>CPU</span>
                </div>
                <span className="text-[11px] font-black tabular-nums" style={{ color: "#4F46E5" }}>
                  {primary?.cpuPct.toFixed(0)}%
                </span>
              </div>
              <Sparkline values={cpuHistory} color="#6366F1" height={38} />
              <div className="flex justify-between mt-1">
                <span className="text-[10px]" style={{ color: "#94A3B8" }}>{hist?.series?.[0]?.date?.slice(5) ?? ""}</span>
                <span className="text-[10px]" style={{ color: "#94A3B8" }}>Today</span>
              </div>
            </div>
            {/* RAM */}
            <div className="rounded-xl p-3" style={{ background: "#F8FAFC", border: "1px solid #E8EAED" }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <MemoryStick size={12} style={{ color: "#10B981" }} />
                  <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#6B7280" }}>RAM</span>
                </div>
                <span className="text-[11px] font-black tabular-nums" style={{ color: "#059669" }}>
                  {primary?.ramPct.toFixed(0)}%
                </span>
              </div>
              <Sparkline values={ramHistory} color="#10B981" height={38} />
              <div className="flex justify-between mt-1">
                <span className="text-[10px]" style={{ color: "#94A3B8" }}>{hist?.series?.[0]?.date?.slice(5) ?? ""}</span>
                <span className="text-[10px]" style={{ color: "#94A3B8" }}>Today</span>
              </div>
            </div>
          </div>
        )}

        {/* Per-service quick stats (if multiple) */}
        {services.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {services.map(svc => (
              <div key={svc.serviceId} className="shrink-0 rounded-xl px-3 py-2 flex items-center gap-2.5 min-w-[160px]"
                style={{ background: "#F8FAFC", border: "1px solid #E8EAED" }}>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#EEF2FF" }}>
                  <Server size={11} style={{ color: "#4F46E5" }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold truncate" style={{ color: "#111827" }}>{svc.domain}</p>
                  <p className="text-[10px] tabular-nums" style={{ color: "#94A3B8" }}>{svc.uptimePct.toFixed(1)}% up · {svc.speedScore} score</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* AI Recommendation */}
        {health?.ai && (
          <div className="flex items-start gap-3 rounded-xl px-4 py-3"
            style={{ background: "linear-gradient(135deg,#EEF2FF,#E0E7FF)", border: "1px solid #C7D2FE" }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(99,102,241,0.15)" }}>
              <Sparkles size={15} style={{ color: "#4F46E5" }} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: "#6366F1" }}>AI Recommendation</p>
              <p className="text-sm leading-relaxed" style={{ color: "#312E81" }}>{health.ai.text}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Usage Bar (inline in service tile) ────────────────────────── */
function ServiceUsageBar({ serviceId }: { serviceId: string }) {
  const token = localStorage.getItem("token");
  const { data: usage } = useQuery<UsageData>({
    queryKey: ["hosting-usage", serviceId],
    queryFn: () => fetch(`/api/client/hosting/${serviceId}/usage`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.ok ? r.json() : null).catch(() => null),
    staleTime: 60_000, retry: false,
  });
  if (!usage?.disk || !usage?.bandwidth) return null;
  return (
    <div className="mt-3 space-y-1.5">
      {[
        { label: "Disk", pct: usage.disk.pct, used: usage.disk.usedFmt, limit: usage.disk.limitFmt, color: "#6366F1" },
        { label: "BW", pct: usage.bandwidth.pct, used: usage.bandwidth.usedFmt, limit: usage.bandwidth.limitFmt, color: "#10B981" },
      ].map(bar => (
        <div key={bar.label}>
          <div className="flex justify-between text-[10px] mb-0.5" style={{ color: "#94A3B8" }}>
            <span>{bar.label}</span>
            <span>{bar.used} / {bar.limit}</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "#F1F5F9" }}>
            <div className="h-full rounded-full transition-all" style={{
              width: `${Math.min(100, bar.pct)}%`,
              background: bar.pct >= 90 ? "#EF4444" : bar.pct >= 70 ? "#F59E0B" : bar.color,
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Status Badge ───────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    active:     { bg: "#ECFDF5", text: "#059669", dot: "#10B981", label: "Active" },
    suspended:  { bg: "#FFF7ED", text: "#C2410C", dot: "#F97316", label: "Suspended" },
    terminated: { bg: "#FEF2F2", text: "#B91C1C", dot: "#EF4444", label: "Terminated" },
    pending:    { bg: "#FFFBEB", text: "#B45309", dot: "#F59E0B", label: "Pending" },
  };
  const c = cfg[status] ?? { bg: "#F1F5F9", text: "#64748B", dot: "#94A3B8", label: status };
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: c.bg, color: c.text }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.dot }} />
      {c.label}
    </span>
  );
}

/* ─── Hosting Service Tile ───────────────────────────────────────── */
function HostingTile({ svc, onSso, ssoLoading }: {
  svc: HostingService;
  onSso: (id: string, type: "cpanel" | "webmail") => void;
  ssoLoading: Record<string, "cpanel" | "webmail" | null>;
}) {
  const is20i = !!(svc.twentyIPackageId || svc.cpanelUrl?.includes("my.20i.com") || svc.cpanelUrl?.includes("stackcp.com"));
  const cpBusy = ssoLoading[svc.id] === "cpanel";
  const wmBusy = ssoLoading[svc.id] === "webmail";
  const anyBusy = !!ssoLoading[svc.id];
  const isActive = svc.status === "active";

  return (
    <div
      className="relative flex flex-col rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: "#ffffff",
        border: "1px solid #E8EAED",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.04)",
        borderRadius: "16px",
      }}
    >
      {/* Card Header */}
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid #F3F4F6" }}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)" }}
          >
            <Server size={20} style={{ color: "#4F46E5" }} />
          </div>
          <StatusBadge status={svc.status} />
        </div>
        <h3
          className="font-display font-bold truncate"
          style={{ fontSize: "16px", color: "#111827", letterSpacing: "-0.01em" }}
          title={svc.domain || svc.planName}
        >
          {svc.domain || svc.planName}
        </h3>
        <p className="text-sm mt-0.5 truncate" style={{ color: "#6B7280" }}>
          {svc.planName}
          {svc.billingCycle && ` · ${svc.billingCycle}`}
        </p>
        {svc.nextDueDate && (
          <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: "#9CA3AF" }}>
            <Clock size={11} />
            Renews {format(new Date(svc.nextDueDate), "MMM d, yyyy")}
          </p>
        )}
        {isActive && <ServiceUsageBar serviceId={svc.id} />}
      </div>

      {/* Card Actions */}
      <div className="px-5 py-3.5 flex items-center gap-2 mt-auto" style={{ background: "#FAFAFA" }}>
        <Link href={`/client/hosting`} className="flex-1">
          <button
            className="w-full h-8 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)",
              color: "#fff",
              boxShadow: "0 2px 8px rgba(99,102,241,0.25)",
            }}
          >
            Manage
          </button>
        </Link>
        {isActive && (
          <button
            onClick={() => onSso(svc.id, "cpanel")}
            disabled={anyBusy}
            className="h-8 px-3 rounded-lg text-xs font-semibold border transition-all hover:border-orange-300"
            style={{ background: "#FFF7ED", color: "#C2410C", border: "1px solid #FED7AA" }}
            title={is20i ? "StackCP Login" : "cPanel Login"}
          >
            {cpBusy ? <Loader2 size={12} className="animate-spin" /> : (is20i ? "StackCP" : "cPanel")}
          </button>
        )}
        {isActive && (
          <button
            onClick={() => onSso(svc.id, "webmail")}
            disabled={anyBusy}
            className="h-8 px-3 rounded-lg text-xs font-semibold border transition-all hover:border-blue-300"
            style={{ background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}
            title="Webmail"
          >
            {wmBusy ? <Loader2 size={12} className="animate-spin" /> : <Mail size={13} />}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Domain Tile ────────────────────────────────────────────────── */
function DomainTile({ domain, navigate }: { domain: DomainItem; navigate: (path: string) => void }) {
  const expiry = domain.expiryDate ? new Date(domain.expiryDate) : null;
  const daysLeft = expiry ? Math.ceil((expiry.getTime() - Date.now()) / 86_400_000) : null;
  const expiring = daysLeft !== null && daysLeft <= 30;

  return (
    <div
      className="relative flex flex-col rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: "#ffffff",
        border: expiring ? "1px solid #FED7AA" : "1px solid #E8EAED",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.04)",
        borderRadius: "16px",
      }}
    >
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid #F3F4F6" }}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: expiring ? "linear-gradient(135deg,#FFF7ED,#FED7AA)" : "linear-gradient(135deg,#F0FDF4,#DCFCE7)" }}
          >
            <Globe size={20} style={{ color: expiring ? "#C2410C" : "#059669" }} />
          </div>
          <StatusBadge status={domain.status} />
        </div>
        <h3
          className="font-display font-bold"
          style={{ fontSize: "16px", color: "#111827", letterSpacing: "-0.01em", wordBreak: "break-all" }}
        >
          {domain.name}<span style={{ color: "#6B7280" }}>{domain.tld}</span>
        </h3>
        <div className="mt-2 space-y-1">
          {expiry && (
            <p className="text-xs flex items-center gap-1.5" style={{ color: expiring ? "#C2410C" : "#9CA3AF" }}>
              <Clock size={11} />
              {expiring
                ? `Expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}!`
                : `Expires ${format(expiry, "MMM d, yyyy")}`
              }
            </p>
          )}
          {domain.autoRenew !== undefined && (
            <p className="text-xs flex items-center gap-1.5" style={{ color: domain.autoRenew ? "#059669" : "#94A3B8" }}>
              <RotateCcw size={11} />
              Auto-Renew {domain.autoRenew ? "On" : "Off"}
            </p>
          )}
        </div>
      </div>
      <div className="px-5 py-3.5 flex gap-2 mt-auto" style={{ background: "#FAFAFA" }}>
        <button
          onClick={() => navigate(`/client/domains`)}
          className="flex-1 h-8 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: "linear-gradient(135deg,#4F46E5 0%,#6366F1 100%)",
            color: "#fff",
            boxShadow: "0 2px 8px rgba(99,102,241,0.25)",
          }}
        >
          Manage
        </button>
        {expiring && (
          <button
            onClick={() => navigate("/client/domains")}
            className="h-8 px-3 rounded-lg text-xs font-semibold border"
            style={{ background: "#FFF7ED", color: "#C2410C", border: "1px solid #FED7AA" }}
          >
            Renew
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Stat Card ──────────────────────────────────────────────────── */
function StatCard({ title, value, icon: Icon, href, color, highlight }: {
  title: string; value: number; icon: any; href: string; color: string; highlight?: boolean;
}) {
  return (
    <Link href={href}>
      <div
        className="flex items-center gap-4 p-5 rounded-2xl cursor-pointer transition-all duration-200 hover:-translate-y-0.5 group"
        style={{
          background: "#ffffff",
          border: highlight ? "1px solid #FCA5A5" : "1px solid #E8EAED",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          borderRadius: "16px",
        }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105"
          style={{ background: color + "15" }}
        >
          <Icon size={22} style={{ color }} />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-black" style={{ color: "#111827" }}>{value}</p>
          <p className="text-xs font-medium truncate" style={{ color: "#6B7280" }}>{title}</p>
        </div>
        <ChevronRight size={16} className="ml-auto shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" style={{ color: "#D1D5DB" }} />
      </div>
    </Link>
  );
}

/* ─── Section Header ─────────────────────────────────────────────── */
function SectionHeader({ title, icon: Icon, link, linkLabel, count }: {
  title: string; icon: any; link?: string; linkLabel?: string; count?: number;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#EEF2FF" }}>
          <Icon size={15} style={{ color: "#4F46E5" }} />
        </div>
        <h2 className="font-display font-bold" style={{ fontSize: "15px", color: "#111827" }}>
          {title}
          {count !== undefined && (
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#F3F4F6", color: "#6B7280" }}>
              {count}
            </span>
          )}
        </h2>
      </div>
      {link && linkLabel && (
        <Link href={link}>
          <span className="text-xs font-semibold flex items-center gap-1 transition-colors hover:opacity-70" style={{ color: "#4F46E5" }}>
            {linkLabel} <ArrowRight size={12} />
          </span>
        </Link>
      )}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */
export default function ClientDashboard() {
  const { show: showTour, dismiss: dismissTour } = useWelcomeTour();
  const { data: stats, isLoading } = useGetClientDashboard();
  const { data: user } = useGetMe();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();

  const [searchQuery, setSearchQuery] = useState("");
  const [ssoLoading, setSsoLoading] = useState<Record<string, "cpanel" | "webmail" | null>>({});

  const handleSsoLogin = async (serviceId: string, type: "cpanel" | "webmail") => {
    setSsoLoading(prev => ({ ...prev, [serviceId]: type }));
    try {
      const endpoint = type === "cpanel"
        ? `/api/client/hosting/${serviceId}/cpanel-login`
        : `/api/client/hosting/${serviceId}/webmail-login`;
      const result = await apiFetch(endpoint, { method: "POST" });
      if (result.url) window.open(result.url, "_blank");
      else throw new Error("No login URL returned");
    } catch (err: any) {
      toast({ title: `${type === "cpanel" ? "cPanel" : "Webmail"} Login Failed`, description: err.message, variant: "destructive" });
    } finally {
      setSsoLoading(prev => ({ ...prev, [serviceId]: null }));
    }
  };

  const { data: recentOrders = [] } = useQuery<Order[]>({
    queryKey: ["my-orders-dashboard"],
    queryFn: () => apiFetch("/api/orders").then(d => (d || []).slice(0, 5)),
  });
  const { data: creditsData } = useQuery<{ creditBalance: string }>({
    queryKey: ["my-credits"],
    queryFn: () => apiFetch("/api/my/credits"),
  });
  const creditBalance = parseFloat(creditsData?.creditBalance ?? "0");

  const { data: allServices = [] } = useQuery<HostingService[]>({
    queryKey: ["client-services-dashboard"],
    queryFn: () => apiFetch("/api/client/hosting").then(d => d || []),
  });
  const { data: allDomains = [] } = useQuery<DomainItem[]>({
    queryKey: ["client-domains-dashboard"],
    queryFn: () => apiFetch("/api/domains").then(d => d || []),
  });
  const { data: setupProgress } = useQuery<SetupProgress>({
    queryKey: ["client-setup-progress"],
    queryFn: () => apiFetch("/api/client/setup-progress"),
    refetchInterval: 30_000, staleTime: 20_000,
  });
  const [confettiActive, setConfettiActive] = useState(false);
  useEffect(() => {
    if (setupProgress?.allComplete) {
      setConfettiActive(true);
      const t = setTimeout(() => setConfettiActive(false), 3000);
      return () => clearTimeout(t);
    }
  }, [setupProgress?.allComplete]);

  const { data: announcements = [] } = useQuery<Announcement[]>({
    queryKey: ["public-announcements"],
    queryFn: () => fetch("/api/announcements").then(r => r.json()).then(d => (d.announcements || []).filter((a: Announcement) => a.isActive)),
    staleTime: 60_000,
  });

  /* ─── Search Filtering ─── */
  const q = searchQuery.trim().toLowerCase();
  const filteredServices = q
    ? allServices.filter(s => (s.domain ?? s.planName).toLowerCase().includes(q) || s.planName.toLowerCase().includes(q))
    : allServices;
  const filteredDomains = q
    ? allDomains.filter(d => `${d.name}${d.tld}`.toLowerCase().includes(q))
    : allDomains;

  /* ─── Derived State ─── */
  const activeServices = allServices.filter(s => s.status === "active");
  const freeDomainServices = allServices.filter(s => s.freeDomainAvailable && s.status === "active");
  const now = Date.now();
  const ALERT_DAYS = 15;
  const expiryAlerts = [
    ...allServices.filter(s => s.status === "active" && s.nextDueDate).map(s => {
      const daysLeft = Math.ceil((new Date(s.nextDueDate!).getTime() - now) / 86_400_000);
      return { name: s.domain || s.planName, type: "Hosting" as const, daysLeft };
    }).filter(s => s.daysLeft >= 0 && s.daysLeft <= ALERT_DAYS),
    ...allDomains.filter(d => d.status === "active" && d.expiryDate).map(d => {
      const daysLeft = Math.ceil((new Date(d.expiryDate!).getTime() - now) / 86_400_000);
      return { name: `${d.name}${d.tld}`, type: "Domain" as const, daysLeft };
    }).filter(d => d.daysLeft >= 0 && d.daysLeft <= ALERT_DAYS),
  ].sort((a, b) => a.daysLeft - b.daysLeft);

  const clientSince = user?.createdAt ? new Date(user.createdAt) : null;
  const daysSinceJoining = clientSince ? Math.floor((Date.now() - clientSince.getTime()) / 86_400_000) : 0;
  const isNewClient = daysSinceJoining <= 30;

  const pendingOrders = recentOrders.filter(o => o.status === "pending").length;

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return "Good morning";
    if (h >= 12 && h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-10 h-10 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mx-auto mb-3" />
        <p className="text-sm" style={{ color: "#94A3B8" }}>Loading your dashboard...</p>
      </div>
    </div>
  );
  if (!stats) return null;

  const hasResults = q ? (filteredServices.length > 0 || filteredDomains.length > 0) : true;

  return (
    <>
    <div className="space-y-6 pb-8">

      {/* ── Greeting + Search ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h1 className="font-display font-extrabold" style={{ fontSize: "22px", color: "#111827", letterSpacing: "-0.02em" }}>
            {greeting}, {user?.firstName}. Let's build something great today.
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>
            {activeServices.length > 0
              ? `${activeServices.length} service${activeServices.length === 1 ? "" : "s"} humming along — you're in good hands.`
              : "Your suite is empty — let's change that."
            }
          </p>
        </div>
        {/* Search */}
        <div className="relative sm:w-72">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#9CA3AF" }} />
          <input
            type="text"
            placeholder="Search your services and domains…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 rounded-xl text-sm font-medium transition-all focus:outline-none"
            style={{
              background: "#ffffff",
              border: "1px solid #E5E7EB",
              color: "#111827",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
            onFocus={e => { e.currentTarget.style.border = "1.5px solid #6366F1"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)"; }}
            onBlur={e => { e.currentTarget.style.border = "1px solid #E5E7EB"; e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)"; }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70">
              <X size={14} style={{ color: "#9CA3AF" }} />
            </button>
          )}
        </div>
      </div>

      {/* ── Announcements Marquee ── */}
      {!q && announcements.length > 0 && (
        <div
          className="flex items-center rounded-xl overflow-hidden"
          style={{ background: "#EEF2FF", border: "1px solid #C7D2FE" }}
        >
          <div className="flex items-center gap-1.5 shrink-0 px-4 py-2.5 font-bold text-xs uppercase tracking-widest whitespace-nowrap" style={{ color: "#4F46E5", borderRight: "1px solid #C7D2FE" }}>
            <Megaphone className="h-3.5 w-3.5" />
            <span>News</span>
          </div>
          <div className="overflow-hidden flex-1 relative py-2.5 px-4">
            <div className="flex gap-14 whitespace-nowrap" style={{ animation: `nexgo-marquee ${Math.max(18, announcements.length * 10)}s linear infinite` }}>
              {[...announcements, ...announcements].map((a, i) => (
                <span key={i} className="text-sm inline-flex items-center gap-2" style={{ color: "#312E81" }}>
                  <span className="font-bold">{a.title}</span>
                  <span style={{ opacity: 0.7 }}>{a.message}</span>
                  <span style={{ opacity: 0.3 }} className="mx-2">•</span>
                </span>
              ))}
            </div>
          </div>
          <style>{`@keyframes nexgo-marquee { 0% { transform:translateX(0); } 100% { transform:translateX(-50%); } }`}</style>
        </div>
      )}

      {/* ── Pending Orders Alert ── */}
      {!q && pendingOrders > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
          <Clock size={15} style={{ color: "#D97706" }} />
          <p className="text-sm font-medium" style={{ color: "#92400E" }}>
            <span className="font-bold">{pendingOrders}</span> order{pendingOrders > 1 ? "s" : ""} pending review — we'll notify you once it's approved.
          </p>
          <Link href="/client/orders" className="ml-auto">
            <span className="text-xs font-semibold" style={{ color: "#D97706" }}>View →</span>
          </Link>
        </div>
      )}

      {/* ── Expiry Alerts ── */}
      {!q && expiryAlerts.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #FED7AA", borderRadius: "16px" }}>
          <div className="flex items-center gap-3 px-5 py-3" style={{ background: "#FFF7ED", borderBottom: "1px solid #FED7AA" }}>
            <AlertTriangle size={15} style={{ color: "#C2410C" }} />
            <p className="text-sm font-bold" style={{ color: "#7C2D12" }}>
              {expiryAlerts.length} service{expiryAlerts.length > 1 ? "s" : ""} coming up for renewal — act now to stay online.
            </p>
          </div>
          <div style={{ background: "#ffffff" }}>
            {expiryAlerts.map((alert, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3" style={{ borderBottom: i < expiryAlerts.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: alert.type === "Hosting" ? "#EEF2FF" : "#F0FDF4" }}>
                    {alert.type === "Hosting" ? <Server size={14} style={{ color: "#4F46E5" }} /> : <Globe size={14} style={{ color: "#059669" }} />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "#111827" }}>{alert.name}</p>
                    <p className="text-xs" style={{ color: "#6B7280" }}>{alert.type}</p>
                  </div>
                </div>
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{
                    background: alert.daysLeft <= 3 ? "#FEF2F2" : alert.daysLeft <= 7 ? "#FFF7ED" : "#FFFBEB",
                    color: alert.daysLeft <= 3 ? "#B91C1C" : alert.daysLeft <= 7 ? "#C2410C" : "#B45309",
                  }}
                >
                  {alert.daysLeft === 0 ? "Expires today!" : `${alert.daysLeft}d left`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Stat Summary Cards ── */}
      {!q && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Services Running" value={stats.activeServices} icon={Server} href="/client/hosting" color="#4F46E5" />
          <StatCard title="Domains" value={stats.activeDomains} icon={Globe} href="/client/domains" color="#059669" />
          <StatCard title="Invoices Due" value={stats.unpaidInvoices} icon={FileText} href="/client/billing" color="#EF4444" highlight={stats.unpaidInvoices > 0} />
          <StatCard title="Support Cases" value={stats.openTickets} icon={Ticket} href="/client/tickets" color="#F59E0B" />
        </div>
      )}

      {/* ── Credit Balance ── */}
      {!q && creditBalance > 0 && (
        <Link href="/client/credits">
          <div
            className="flex items-center gap-4 p-5 rounded-2xl cursor-pointer transition-all hover:-translate-y-0.5"
            style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "16px" }}
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#D1FAE5" }}>
              <Wallet size={20} style={{ color: "#059669" }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold" style={{ color: "#064E3B" }}>Available Credit</p>
              <p className="text-xs mt-0.5" style={{ color: "#047857" }}>Apply your balance to any invoice in seconds.</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xl font-black" style={{ color: "#059669" }}>{formatPrice(creditBalance)}</p>
              <p className="text-xs" style={{ color: "#6EE7B7" }}>View Credits →</p>
            </div>
          </div>
        </Link>
      )}

      {/* ── Setup Wizard ── */}
      {!q && setupProgress && !setupProgress.allComplete && allDomains.length > 0 && (() => {
        const s1 = setupProgress.step1;
        const s2 = setupProgress.step2;
        const steps = [
          { label: "Claim Your Domain", icon: Globe, done: s1, desc: s1 ? setupProgress.primaryDomain ?? "Your domain is ready." : "Register a domain to get started.", cta: !s1 ? { label: "Get a Domain", href: "/client/domains" } : null, locked: false },
          { label: "Launch Hosting",   icon: Server, done: s2, desc: s2 ? "Hosting is live and running."       : "Connect your domain to a hosting plan.",   cta: !s2 ? { label: "Get Hosting", href: "/client/orders/new" } : null, locked: !s1 },
          { label: "You're Live",      icon: Rocket, done: false, desc: "Complete the steps above to go live.", cta: null, locked: !s1 || !s2 },
        ];
        return (
          <div className="rounded-2xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #E0E7FF", borderRadius: "16px" }}>
            <div className="flex items-center gap-3 px-5 py-3.5" style={{ background: "#EEF2FF", borderBottom: "1px solid #E0E7FF" }}>
              <Rocket size={15} style={{ color: "#4F46E5" }} />
              <p className="text-sm font-bold" style={{ color: "#312E81" }}>You're {setupProgress.pct}% of the way to launch — keep going.</p>
              <div className="flex-1 mx-4 h-1.5 rounded-full overflow-hidden" style={{ background: "#C7D2FE" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${setupProgress.pct}%`, background: "linear-gradient(90deg,#4F46E5,#6366F1)" }} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x" style={{ divideColor: "#F3F4F6" }}>
              {steps.map((step, i) => (
                <div key={i} className={`px-5 py-4 flex items-start gap-3 ${step.locked ? "opacity-40" : ""}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-2 ${step.done ? "border-green-300 bg-green-50" : step.locked ? "border-gray-200 bg-gray-50" : "border-indigo-300 bg-indigo-50"}`}>
                    {step.done ? <CheckCircle2 size={16} style={{ color: "#059669" }} /> : step.locked ? <Lock size={14} style={{ color: "#9CA3AF" }} /> : <step.icon size={14} style={{ color: "#4F46E5" }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold" style={{ color: "#111827" }}>{step.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>{step.desc}</p>
                    {step.cta && (
                      <Link href={step.cta.href}>
                        <button className="mt-2 h-7 px-3 rounded-lg text-xs font-bold text-white" style={{ background: "linear-gradient(135deg,#4F46E5,#6366F1)" }}>
                          {step.cta.label} →
                        </button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Celebration Card ── */}
      {!q && setupProgress?.allComplete && (
        <div className="relative rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg,#0f0523,#1a0540,#2d0a6b)", border: "1px solid rgba(99,102,241,0.4)", borderRadius: "16px" }}>
          <Confetti active={confettiActive} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 0%,rgba(112,26,254,0.45),transparent 70%)" }} />
          <div className="relative z-[1] p-8 text-center flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#4F46E5,#6366F1)", boxShadow: "0 0 40px rgba(99,102,241,0.6)" }}>
              <PartyPopper size={28} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">You're Live!</h2>
              <p className="text-violet-200 font-semibold mt-1">Your site is live and the world can find you.</p>
              {setupProgress.primaryDomain && (
                <a href={setupProgress.siteUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="text-sm text-violet-300 hover:text-white transition-colors underline underline-offset-2 mt-1 block">
                  {setupProgress.primaryDomain}
                </a>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/client/hosting"><button className="px-5 py-2.5 rounded-xl text-sm font-bold text-white border border-white/20" style={{ background: "linear-gradient(135deg,#4F46E5,#6366F1)" }}>Manage Website</button></Link>
              {setupProgress.siteUrl && <a href={setupProgress.siteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white border border-white/20 hover:bg-white/10 transition-all"><ExternalLink size={14} /> Open Site</a>}
            </div>
          </div>
        </div>
      )}

      {/* ── Free Domain Banners ── */}
      {!q && freeDomainServices.map(svc => (
        <div key={svc.id} className="relative rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg,#4F46E5,#7A6BFF)", borderRadius: "16px" }}>
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 90% 50%,rgba(255,255,255,0.1),transparent 55%)" }} />
          <div className="relative px-5 py-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)" }}>
              <Gift size={22} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-white">A free domain is waiting for you.</p>
              <p className="text-xs text-white/75 mt-0.5">Your annual plan includes one free domain registration — claim it before it expires.</p>
            </div>
            <button onClick={() => navigate(`/client/register-domain?claim_token=${svc.id}`)}
              className="shrink-0 px-4 py-2 rounded-xl text-sm font-bold text-white border border-white/25 hover:bg-white/10 transition-all">
              Claim My Domain →
            </button>
          </div>
        </div>
      ))}

      {/* ── IP Unblock Banner ── */}
      {!q && <IpUnblockBanner />}

      {/* ── Site Health & Performance ── */}
      {!q && <SiteHealthPanel />}

      {/* ── Hosting Services ── */}
      {filteredServices.length > 0 && (
        <div>
          <SectionHeader
            title="Your Hosting"
            icon={Server}
            link="/client/hosting"
            linkLabel="View All"
            count={q ? filteredServices.length : undefined}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredServices.map(svc => (
              <HostingTile key={svc.id} svc={svc} onSso={handleSsoLogin} ssoLoading={ssoLoading} />
            ))}
          </div>
        </div>
      )}

      {/* ── Domains ── */}
      {filteredDomains.length > 0 && (
        <div>
          <SectionHeader
            title="Your Domains"
            icon={Globe}
            link="/client/domains"
            linkLabel="View All"
            count={q ? filteredDomains.length : undefined}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDomains.map(domain => (
              <DomainTile key={domain.id} domain={domain} navigate={navigate} />
            ))}
          </div>
        </div>
      )}

      {/* ── No results ── */}
      {q && !hasResults && (
        <div className="py-16 text-center rounded-2xl" style={{ background: "#ffffff", border: "1px solid #E5E7EB", borderRadius: "16px" }}>
          <Search size={32} className="mx-auto mb-3" style={{ color: "#D1D5DB" }} />
          <p className="text-sm font-semibold" style={{ color: "#374151" }}>Nothing matches "{searchQuery}"</p>
          <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>Try a different name or browse your services above.</p>
          <button onClick={() => setSearchQuery("")} className="mt-4 text-sm font-semibold" style={{ color: "#4F46E5" }}>Clear search</button>
        </div>
      )}

      {/* ── New Client Guide ── */}
      {!q && isNewClient && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #E0E7FF", borderRadius: "16px" }}>
          <div className="flex items-center gap-3 px-5 py-3.5" style={{ background: "#EEF2FF", borderBottom: "1px solid #E0E7FF" }}>
            <Sparkles size={15} style={{ color: "#4F46E5" }} />
            <p className="text-sm font-bold" style={{ color: "#312E81" }}>New around here? Let us show you the ropes.</p>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { label: "Log in to your control panel", href: "/client/hosting" },
              { label: "Connect or transfer a domain", href: "/client/domains" },
              { label: "Create your business email", href: "/client/hosting" },
              { label: "Get help from our team", href: "/client/tickets" },
            ].map(g => (
              <Link key={g.label} href={g.href}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{ background: "#F8F8FF", border: "1px solid #E0E7FF", color: "#4F46E5" }}
              >
                <BookOpen size={13} className="shrink-0" />
                {g.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent Invoices + Orders ── */}
      {!q && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Invoices */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #E8EAED", borderRadius: "16px" }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #F3F4F6" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#ECFDF5" }}>
                  <DollarSign size={15} style={{ color: "#059669" }} />
                </div>
                <h3 className="font-display font-bold text-sm" style={{ color: "#111827" }}>Recent Invoices</h3>
              </div>
              <Link href="/client/billing"><span className="text-xs font-semibold flex items-center gap-1" style={{ color: "#4F46E5" }}>View All <ArrowRight size={11} /></span></Link>
            </div>
            <div>
              {!stats.recentInvoices?.length ? (
                <div className="py-10 text-center"><FileText size={28} className="mx-auto mb-2" style={{ color: "#E5E7EB" }} /><p className="text-sm" style={{ color: "#9CA3AF" }}>No invoices yet</p></div>
              ) : stats.recentInvoices.map(inv => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between px-5 py-3.5 cursor-pointer transition-colors hover:bg-gray-50"
                  style={{ borderBottom: "1px solid #F9FAFB" }}
                  onClick={() => navigate(`/client/invoices/${inv.id}`)}
                >
                  <div>
                    <p className="text-sm font-semibold font-mono" style={{ color: "#111827" }}>{fmtInvNum(inv.invoiceNumber)}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{formatPrice(Number(inv.total))}</p>
                  </div>
                  <span
                    className="px-2.5 py-1 rounded-full text-[11px] font-bold"
                    style={{
                      background: inv.status === "paid" ? "#ECFDF5" : inv.status === "unpaid" ? "#FEF2F2" : "#EFF6FF",
                      color: inv.status === "paid" ? "#059669" : inv.status === "unpaid" ? "#B91C1C" : "#1D4ED8",
                    }}
                  >
                    {inv.status === "payment_pending" ? "Pending" : inv.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Orders */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #E8EAED", borderRadius: "16px" }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #F3F4F6" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#EEF2FF" }}>
                  <ShoppingCart size={15} style={{ color: "#4F46E5" }} />
                </div>
                <h3 className="font-display font-bold text-sm" style={{ color: "#111827" }}>Recent Orders</h3>
              </div>
              <Link href="/client/orders"><span className="text-xs font-semibold flex items-center gap-1" style={{ color: "#4F46E5" }}>View All <ArrowRight size={11} /></span></Link>
            </div>
            <div>
              {recentOrders.length === 0 ? (
                <div className="py-10 text-center"><ShoppingCart size={28} className="mx-auto mb-2" style={{ color: "#E5E7EB" }} /><p className="text-sm" style={{ color: "#9CA3AF" }}>No orders yet</p></div>
              ) : recentOrders.map(order => (
                <div
                  key={order.id}
                  className="flex items-center justify-between px-5 py-3.5"
                  style={{ borderBottom: "1px solid #F9FAFB" }}
                >
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="text-sm font-semibold truncate" style={{ color: "#111827" }}>{order.itemName}</p>
                    {order.domain && <p className="text-xs font-mono mt-0.5 truncate" style={{ color: "#9CA3AF" }}>{order.domain}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-sm font-bold" style={{ color: "#111827" }}>{formatPrice(Number(order.amount))}</p>
                    <span
                      className="px-2.5 py-1 rounded-full text-[11px] font-bold"
                      style={{
                        background: order.status === "approved" ? "#ECFDF5" : order.status === "pending" ? "#FFFBEB" : "#F3F4F6",
                        color: order.status === "approved" ? "#059669" : order.status === "pending" ? "#B45309" : "#6B7280",
                      }}
                    >
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Recent Support Tickets ── */}
      {!q && stats.recentTickets && stats.recentTickets.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #E8EAED", borderRadius: "16px" }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #F3F4F6" }}>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#FFF7ED" }}>
                <Ticket size={15} style={{ color: "#C2410C" }} />
              </div>
              <h3 className="font-display font-bold text-sm" style={{ color: "#111827" }}>Support Tickets</h3>
            </div>
            <Link href="/client/tickets"><span className="text-xs font-semibold flex items-center gap-1" style={{ color: "#4F46E5" }}>View All <ArrowRight size={11} /></span></Link>
          </div>
          <div>
            {stats.recentTickets.map((ticket, i) => (
              <div
                key={ticket.id}
                className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
                style={{ borderBottom: i < stats.recentTickets!.length - 1 ? "1px solid #F9FAFB" : "none" }}
                onClick={() => navigate(`/client/tickets/${ticket.id}`)}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{ color: "#111827" }}>{ticket.subject}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>#{ticket.ticketNumber}</p>
                </div>
                <span
                  className="ml-3 px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 capitalize"
                  style={{ background: "#F3F4F6", color: "#6B7280" }}
                >
                  {ticket.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
    {showTour && <WelcomeTour onClose={dismissTour} />}
    </>
  );
}
