import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Server, Cpu, MemoryStick, HardDrive, Power, RotateCcw,
  Play, Square, RefreshCw, Eye, EyeOff, Copy, CheckCheck,
  AlertCircle, Loader2, ArrowLeft, Zap, Shield, Globe,
  Activity, CreditCard, Terminal, MonitorPlay, Clock,
  ChevronRight, Lock, Wifi, MapPin, PackageOpen,
} from "lucide-react";

const BRAND = "#7C3AED";

interface VpsOrder {
  id: number;
  userId: string;
  packageName: string | null;
  ipAddress: string | null;
  rootPassword: string | null;
  selectedLocation: string | null;
  operatingSystem: string | null;
  billingCycle: string | null;
  renewalPrice: string | null;
  vpsReferenceId: string | null;
  serverStatus: string;
  cpuCores: number;
  ramGb: number;
  storageGb: number;
  nextDueDate: string | null;
  createdAt: string;
}

interface Stats {
  cpuPercent: number;
  ramPercent: number;
  diskPercent: number;
  networkIn: string;
  networkOut: string;
  uptimeSeconds: number;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  active:       { label: "Online",       color: "#10B981", bg: "#D1FAE5", dot: "#10B981" },
  provisioning: { label: "Provisioning", color: "#F59E0B", bg: "#FEF3C7", dot: "#F59E0B" },
  stopped:      { label: "Stopped",      color: "#EF4444", bg: "#FEE2E2", dot: "#EF4444" },
  suspended:    { label: "Suspended",    color: "#6B7280", bg: "#F3F4F6", dot: "#9CA3AF" },
};

const OS_OPTIONS = [
  "Ubuntu 24.04 LTS",
  "Ubuntu 22.04 LTS",
  "Debian 12",
  "AlmaLinux 9",
  "Rocky Linux 9",
  "Windows Server 2022",
  "n8n Automation Stack",
  "Docker + Portainer",
];

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_MAP[status] ?? STATUS_MAP.provisioning;
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black"
      style={{ background: c.bg, color: c.color }}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: c.dot }} />
      {c.label}
    </span>
  );
}

function ResourceBar({
  label, icon: Icon, value, max, unit, color = BRAND,
}: {
  label: string; icon: any; value: number; max: number; unit: string; color?: string;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const barColor = pct > 85 ? "#EF4444" : pct > 65 ? "#F59E0B" : color;
  const [animated, setAnimated] = useState(0);
  const ref = useRef(false);

  useEffect(() => {
    if (ref.current) return;
    ref.current = true;
    const start = Date.now();
    const duration = 1200;
    const frame = () => {
      const progress = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimated(Math.round(eased * pct));
      if (progress < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [pct]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${BRAND}12` }}>
            <Icon size={16} style={{ color: BRAND }} />
          </div>
          <span className="text-sm font-bold text-gray-700">{label}</span>
        </div>
        <span className="text-base font-black" style={{ color: barColor }}>{animated}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 mb-2 overflow-hidden">
        <div
          className="h-2 rounded-full transition-none"
          style={{ width: `${animated}%`, background: barColor }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400 font-medium">
        <span>{Math.round((value / 100) * max * 10) / 10} {unit} used</span>
        <span>{max} {unit} total</span>
      </div>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">
      {copied ? <CheckCheck size={13} className="text-emerald-500" /> : <Copy size={13} />}
    </button>
  );
}

function UptimeDisplay({ seconds }: { seconds: number }) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return <span>{d}d {h}h {m}m</span>;
}

export default function VpsManagePage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [, navigate] = useLocation();
  const { token } = useAuth();

  const [order, setOrder] = useState<VpsOrder | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [showRebuild, setShowRebuild] = useState(false);
  const [rebuildOs, setRebuildOs] = useState("");
  const [rebuildConfirm, setRebuildConfirm] = useState("");
  const [renewLoading, setRenewLoading] = useState(false);

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const fetchOrder = async () => {
    try {
      const r = await fetch(`/api/my/vps-orders/${orderId}`, { headers: authHeaders });
      if (!r.ok) throw new Error((await r.json()).error || "Not found");
      const d = await r.json();
      setOrder(d.order);
      setStats(d.stats);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token || !orderId) return;
    fetchOrder();
    const iv = setInterval(() => {
      fetch(`/api/my/vps-orders/${orderId}`, { headers: authHeaders })
        .then(r => r.ok ? r.json() : null)
        .then(d => d && (setOrder(d.order), setStats(d.stats)))
        .catch(() => {});
    }, 15000);
    return () => clearInterval(iv);
  }, [token, orderId]);

  const doAction = async (action: "restart" | "stop" | "start") => {
    setActionLoading(action);
    try {
      const r = await fetch(`/api/my/vps-orders/${orderId}/power`, {
        method: "POST", headers: authHeaders, body: JSON.stringify({ action }),
      });
      const d = await r.json();
      setActionMsg(d.message || `${action} initiated`);
      setTimeout(() => setActionMsg(null), 8000);
      await fetchOrder();
    } catch { setActionMsg("Action failed, please retry."); }
    finally { setActionLoading(null); }
  };

  const doRebuild = async () => {
    if (!rebuildOs || rebuildConfirm !== "REBUILD") return;
    setActionLoading("rebuild");
    try {
      const r = await fetch(`/api/my/vps-orders/${orderId}/rebuild`, {
        method: "POST", headers: authHeaders, body: JSON.stringify({ operatingSystem: rebuildOs }),
      });
      const d = await r.json();
      setActionMsg(d.message || "Rebuild initiated");
      setShowRebuild(false);
      setRebuildConfirm("");
      setTimeout(() => setActionMsg(null), 10000);
      await fetchOrder();
    } catch { setActionMsg("Rebuild failed."); }
    finally { setActionLoading(null); }
  };

  const doRenew = async () => {
    setRenewLoading(true);
    try {
      const r = await fetch(`/api/my/vps-orders/${orderId}/renew`, {
        method: "POST", headers: authHeaders,
      });
      const d = await r.json();
      if (d.invoiceId) {
        navigate(`/dashboard/invoices/${d.invoiceId}`);
      } else {
        setActionMsg(d.message || "Renewal invoice created");
        setTimeout(() => setActionMsg(null), 6000);
      }
    } catch { setActionMsg("Renewal failed."); }
    finally { setRenewLoading(false); }
  };

  if (!token) return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
      <div className="text-center">
        <Lock size={36} className="text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Please log in to manage your server.</p>
        <button onClick={() => navigate("/login")} className="mt-4 px-6 py-2.5 rounded-xl text-white text-sm font-bold" style={{ background: BRAND }}>
          Sign In
        </button>
      </div>
    </div>
  );

  if (loading) return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
      <div className="text-center">
        <Loader2 size={36} className="animate-spin mx-auto mb-3" style={{ color: BRAND }} />
        <p className="text-gray-500 text-sm font-medium">Loading server details…</p>
      </div>
    </div>
  );

  // ── Provisioning pending state (order exists but no IP / vps_reference_id yet) ──
  if (order && (order.serverStatus === "provisioning" || !order.ipAddress)) return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-[0_1px_6px_rgba(0,0,0,0.03)]">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-4">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-gray-400 hover:text-gray-700 transition-colors text-sm font-medium">
            <ArrowLeft size={16} /> Dashboard
          </button>
          <div className="w-px h-4 bg-gray-100" />
          <span className="text-sm font-black text-gray-900">{order.packageName ?? `VPS #${order.id}`}</span>
          <StatusBadge status="provisioning" />
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-16 flex flex-col items-center text-center gap-6">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{ background: `${BRAND}10` }}>
          <Loader2 size={36} className="animate-spin" style={{ color: BRAND }} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Your VPS is being configured</h2>
          <p className="text-gray-500 font-medium max-w-md mx-auto text-sm leading-relaxed">
            Our team is provisioning your server. An IP address and credentials will appear here once setup is complete — typically within a few minutes.
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-6 w-full max-w-sm text-left space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400 font-medium">Plan</span>
            <span className="font-bold text-gray-800">{order.packageName ?? "VPS"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400 font-medium">Location</span>
            <span className="font-bold text-gray-800">{order.selectedLocation ?? "Pending"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400 font-medium">OS</span>
            <span className="font-bold text-gray-800">{order.operatingSystem ?? "Pending"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400 font-medium">Specs</span>
            <span className="font-bold text-gray-800">{order.cpuCores} vCPU · {order.ramGb} GB RAM · {order.storageGb} GB SSD</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400 font-medium">Order ID</span>
            <span className="font-mono text-xs text-gray-500 font-bold">#{order.id}</span>
          </div>
        </div>
        <p className="text-xs text-gray-300 font-medium">This page refreshes automatically every 15 seconds.</p>
        <button onClick={() => fetchOrder()}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-gray-100 bg-white text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors shadow-sm">
          <RefreshCw size={14} /> Check Now
        </button>
      </main>
    </div>
  );

  if (error || !order) return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_8px_32px_rgba(0,0,0,0.06)] p-10 max-w-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={24} className="text-red-400" />
        </div>
        <p className="text-gray-900 font-black text-lg mb-1">VPS Not Found</p>
        <p className="text-gray-400 text-sm mb-6 font-medium">{error || "This VPS order does not exist or you don't have access to it."}</p>
        <button onClick={() => navigate("/dashboard")} className="w-full px-6 py-3 rounded-xl bg-gray-50 border border-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-100 transition-colors">
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );

  const cpu  = stats?.cpuPercent  ?? 0;
  const ram  = stats?.ramPercent  ?? 0;
  const disk = stats?.diskPercent ?? 0;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* ── Top nav bar ─────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-[0_1px_6px_rgba(0,0,0,0.03)]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-gray-400 hover:text-gray-700 transition-colors text-sm font-medium">
              <ArrowLeft size={16} /> Dashboard
            </button>
            <div className="w-px h-4 bg-gray-100" />
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${BRAND}12` }}>
                <Server size={14} style={{ color: BRAND }} />
              </div>
              <span className="text-sm font-black text-gray-900">{order.packageName ?? `VPS #${order.id}`}</span>
            </div>
            <StatusBadge status={order.serverStatus} />
          </div>
          <button
            onClick={doRenew}
            disabled={renewLoading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-black shadow-[0_4px_14px_rgba(124,58,237,0.3)] hover:shadow-[0_6px_20px_rgba(124,58,237,0.4)] hover:-translate-y-0.5 transition-all disabled:opacity-50"
            style={{ background: BRAND }}
          >
            {renewLoading ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
            💳 Renew Server Subscription
          </button>
        </div>
      </header>

      {/* ── Alert banner ────────────────────────────────────────────────────── */}
      {actionMsg && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-medium shadow-sm">
            <Activity size={15} className="shrink-0" />
            {actionMsg}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* ── SECTION A: Server Identity Grid ─────────────────────────────── */}
        <div>
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Server Identity</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* Status */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Activity size={15} className="text-emerald-500" />
                </div>
                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Status</span>
              </div>
              <StatusBadge status={order.serverStatus} />
              {stats && order.serverStatus === "active" && (
                <div className="mt-3 text-xs text-gray-400 font-medium flex items-center gap-1.5">
                  <Clock size={11} />
                  <UptimeDisplay seconds={stats.uptimeSeconds} />
                </div>
              )}
            </div>

            {/* IP Address */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-sky-50 flex items-center justify-center">
                  <Wifi size={15} className="text-sky-500" />
                </div>
                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">IP Address</span>
              </div>
              {order.ipAddress ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-black text-gray-900">{order.ipAddress}</span>
                  <CopyButton value={order.ipAddress} />
                </div>
              ) : (
                <span className="text-sm text-gray-300 font-medium">Assigning…</span>
              )}
              {order.selectedLocation && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                  <MapPin size={11} />
                  {order.selectedLocation}
                </div>
              )}
            </div>

            {/* Operating System */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
                  <MonitorPlay size={15} style={{ color: BRAND }} />
                </div>
                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">OS / Image</span>
              </div>
              <span className="text-sm font-black text-gray-900">{order.operatingSystem ?? "—"}</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="px-2 py-0.5 rounded-md bg-gray-50 border border-gray-100 text-[11px] font-bold text-gray-500">
                  {order.cpuCores}vCPU
                </span>
                <span className="px-2 py-0.5 rounded-md bg-gray-50 border border-gray-100 text-[11px] font-bold text-gray-500">
                  {order.ramGb}GB RAM
                </span>
                <span className="px-2 py-0.5 rounded-md bg-gray-50 border border-gray-100 text-[11px] font-bold text-gray-500">
                  {order.storageGb}GB SSD
                </span>
              </div>
            </div>

            {/* Root Credentials */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                    <Lock size={15} className="text-amber-500" />
                  </div>
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Root Login</span>
                </div>
                <button onClick={() => setShowPass(v => !v)} className="p-1.5 rounded-lg hover:bg-gray-50 transition-colors text-gray-400">
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 w-10">User</span>
                  <span className="font-mono text-xs font-black text-gray-800 bg-gray-50 px-2 py-0.5 rounded">root</span>
                  <CopyButton value="root" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 w-10">Pass</span>
                  {order.rootPassword ? (
                    <>
                      <span className="font-mono text-xs font-black text-gray-800 bg-gray-50 px-2 py-0.5 rounded max-w-[100px] truncate">
                        {showPass ? order.rootPassword : "••••••••••••••••"}
                      </span>
                      <CopyButton value={order.rootPassword} />
                    </>
                  ) : (
                    <span className="text-xs text-gray-300">Not set yet</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION B: Action Operations Bar ────────────────────────────── */}
        <div>
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Infrastructure Controls</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-5">
            <div className="flex flex-wrap gap-3">

              {/* Restart */}
              <button
                onClick={() => doAction("restart")}
                disabled={!!actionLoading || order.serverStatus === "provisioning"}
                className="flex items-center gap-2.5 px-5 py-3 rounded-xl bg-gray-50 border border-gray-100 text-gray-700 text-sm font-bold hover:bg-blue-50 hover:border-blue-100 hover:text-blue-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {actionLoading === "restart" ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
                🔄 Restart Server
              </button>

              {/* Stop */}
              <button
                onClick={() => doAction("stop")}
                disabled={!!actionLoading || order.serverStatus !== "active"}
                className="flex items-center gap-2.5 px-5 py-3 rounded-xl bg-gray-50 border border-gray-100 text-gray-700 text-sm font-bold hover:bg-red-50 hover:border-red-100 hover:text-red-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {actionLoading === "stop" ? <Loader2 size={15} className="animate-spin" /> : <Square size={15} />}
                ⏹ Stop Server
              </button>

              {/* Start */}
              <button
                onClick={() => doAction("start")}
                disabled={!!actionLoading || order.serverStatus === "active"}
                className="flex items-center gap-2.5 px-5 py-3 rounded-xl bg-gray-50 border border-gray-100 text-gray-700 text-sm font-bold hover:bg-emerald-50 hover:border-emerald-100 hover:text-emerald-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {actionLoading === "start" ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                ⚡ Start Server
              </button>

              {/* Rebuild */}
              <button
                onClick={() => { setShowRebuild(true); setRebuildOs(""); setRebuildConfirm(""); }}
                disabled={!!actionLoading}
                className="flex items-center gap-2.5 px-5 py-3 rounded-xl bg-gray-50 border border-gray-100 text-gray-700 text-sm font-bold hover:bg-amber-50 hover:border-amber-100 hover:text-amber-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {actionLoading === "rebuild" ? <Loader2 size={15} className="animate-spin" /> : <PackageOpen size={15} />}
                ⚙️ Rebuild / OS Reinstall
              </button>

              {/* SSH hint */}
              <div className="ml-auto flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
                <Terminal size={14} className="text-gray-400" />
                {order.ipAddress ? (
                  <code className="text-xs font-mono text-gray-500">ssh root@{order.ipAddress}</code>
                ) : (
                  <span className="text-xs text-gray-400">IP pending…</span>
                )}
                {order.ipAddress && <CopyButton value={`ssh root@${order.ipAddress}`} />}
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION C: Resource Analytics ───────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Resource Utilisation</h2>
            {order.serverStatus === "active" && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live · refreshes every 15s
              </div>
            )}
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <ResourceBar label="CPU Overhead"       icon={Cpu}       value={cpu}  max={100} unit="%" />
            <ResourceBar label="RAM Consumption"    icon={MemoryStick} value={ram} max={100} unit="%" color="#6366F1" />
            <ResourceBar label="Disk Storage"       icon={HardDrive} value={disk} max={100} unit="%" color="#10B981" />
          </div>

          {/* Network */}
          {stats && order.serverStatus === "active" && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
                  <Wifi size={17} className="text-sky-500" />
                </div>
                <div>
                  <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-0.5">Network In</div>
                  <div className="text-base font-black text-gray-900">{stats.networkIn}</div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                  <Globe size={17} style={{ color: BRAND }} />
                </div>
                <div>
                  <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-0.5">Network Out</div>
                  <div className="text-base font-black text-gray-900">{stats.networkOut}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Billing Overview ──────────────────────────────────────────────── */}
        <div>
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Billing & Renewal</h2>
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
            <div className="grid sm:grid-cols-3 gap-6 mb-6">
              <div>
                <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5">Billing Cycle</div>
                <div className="text-sm font-black text-gray-900 capitalize">{order.billingCycle ?? "Monthly"}</div>
                {order.billingCycle === "yearly" && (
                  <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-black">
                    <Zap size={9} /> Save 45% vs Monthly
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5">Renewal Price</div>
                <div className="text-sm font-black text-gray-900">
                  {order.renewalPrice ? `PKR ${parseFloat(order.renewalPrice).toLocaleString()}` : "—"}
                  <span className="text-xs text-gray-400 font-medium ml-1">/ {order.billingCycle ?? "mo"}</span>
                </div>
              </div>
              <div>
                <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5">Next Due Date</div>
                <div className="text-sm font-black text-gray-900">
                  {order.nextDueDate ? new Date(order.nextDueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                </div>
              </div>
            </div>
            <button
              onClick={doRenew}
              disabled={renewLoading}
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl text-white text-sm font-black shadow-[0_4px_14px_rgba(124,58,237,0.3)] hover:shadow-[0_8px_24px_rgba(124,58,237,0.4)] hover:-translate-y-0.5 transition-all disabled:opacity-50"
              style={{ background: BRAND }}
            >
              {renewLoading ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
              💳 Renew Server Subscription
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

      </main>

      {/* ── Rebuild Modal ────────────────────────────────────────────────────── */}
      {showRebuild && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_32px_80px_rgba(0,0,0,0.18)] w-full max-w-md">
            <div className="px-8 pt-8 pb-0">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-4">
                <PackageOpen size={22} className="text-amber-600" />
              </div>
              <h3 className="text-lg font-black text-gray-900 mb-1">Rebuild / OS Reinstall</h3>
              <p className="text-sm text-gray-500 font-medium mb-6">
                This will <strong className="text-red-600">wipe all data</strong> on the server and redeploy a fresh OS image. This action cannot be undone.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
                    Select New OS / Stack
                  </label>
                  <select value={rebuildOs} onChange={e => setRebuildOs(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-800 focus:outline-none focus:border-[#7C3AED]/40 focus:ring-2 focus:ring-[#7C3AED]/8 transition-all"
                  >
                    <option value="">Select OS image…</option>
                    {OS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
                    Type <span className="text-red-500">REBUILD</span> to confirm
                  </label>
                  <input type="text" value={rebuildConfirm} onChange={e => setRebuildConfirm(e.target.value)}
                    placeholder="REBUILD"
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-mono font-black text-gray-800 placeholder-gray-300 focus:outline-none focus:border-red-300 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="px-8 py-6 flex items-center justify-end gap-3">
              <button onClick={() => setShowRebuild(false)}
                className="px-5 py-2.5 rounded-xl border border-gray-100 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={doRebuild}
                disabled={!rebuildOs || rebuildConfirm !== "REBUILD" || actionLoading === "rebuild"}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-500 text-white text-sm font-black hover:bg-red-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {actionLoading === "rebuild" ? <Loader2 size={14} className="animate-spin" /> : <PackageOpen size={14} />}
                Rebuild Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
