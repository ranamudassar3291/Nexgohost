import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Server, Cpu, MemoryStick, HardDrive, Wifi, Power, RotateCcw,
  Terminal, Shield, Globe, Activity, CheckCircle2, XCircle,
  AlertCircle, RefreshCw, ChevronRight, ArrowLeft, Loader2,
  Database, Network, Settings, Clock, Calendar, Zap, Lock,
  MonitorPlay, HardDriveDownload, Info, ChevronDown,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useCurrency } from "@/context/CurrencyProvider";

const P = "#701AFE";

interface VpsService {
  id: string; planId: string; planName: string; domain: string | null;
  status: string; serverIp: string | null; billingCycle: string | null;
  nextDueDate: string | null; startDate: string | null; expiryDate: string | null;
  autoRenew: boolean; cpuCores: number; ramGb: number; storageGb: number;
  bandwidthTb: number | null; virtualization: string;
  location: { countryName: string; countryCode: string; flagIcon: string; city: string | null; datacenter: string | null; networkSpeed: string; latencyMs: number } | null;
  os: { id: string; name: string; version: string; iconUrl: string | null } | null;
  availableOs: { id: string; name: string; version: string; iconUrl: string | null }[];
  stats: { cpuPercent: number; ramPercent: number; diskPercent: number; bandwidthIn: number; bandwidthOut: number; uptimeSeconds: number; networkIn: string; networkOut: string };
  features: string[];
}

interface LiveStats { cpuPercent: number; ramPercent: number; timestamp: string; }

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { color: string; bg: string; dot: string; label: string }> = {
    active:    { color: "#10B981", bg: "#D1FAE5", dot: "#10B981", label: "Online" },
    suspended: { color: "#EF4444", bg: "#FEE2E2", dot: "#EF4444", label: "Suspended" },
    pending:   { color: "#F59E0B", bg: "#FEF3C7", dot: "#F59E0B", label: "Provisioning" },
    cancelled: { color: "#6B7280", bg: "#F3F4F6", dot: "#9CA3AF", label: "Cancelled" },
  };
  const c = configs[status] ?? configs.pending;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
      style={{ background: c.bg, color: c.color }}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: c.dot }}/>
      {c.label}
    </span>
  );
}

function ResourceBar({ label, value, max, unit, color = P, icon: Icon }:
  { label: string; value: number; max: number; unit: string; color?: string; icon: any }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const barColor = pct > 85 ? "#EF4444" : pct > 65 ? "#F59E0B" : color;
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${P}10` }}>
            <Icon size={14} style={{ color: P }}/>
          </div>
          <span className="text-[13px] font-semibold text-gray-700">{label}</span>
        </div>
        <span className="text-[13px] font-bold" style={{ color: barColor }}>{pct}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 mb-1.5">
        <motion.div className="h-2 rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, background: barColor }}
          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-gray-400">
        <span>{value.toFixed(1)} {unit} used</span>
        <span>{max} {unit} total</span>
      </div>
    </div>
  );
}

function UptimeDisplay({ seconds }: { seconds: number }) {
  const days  = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins  = Math.floor((seconds % 3600) / 60);
  return <span>{days}d {hours}h {mins}m</span>;
}

function OsIcon({ os }: { os: VpsService["os"] }) {
  if (!os) return <Server size={20} className="text-gray-400"/>;
  if (os.iconUrl) {
    return <img src={os.iconUrl} alt={os.name} className="w-5 h-5 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}/>;
  }
  return <Server size={20} style={{ color: P }}/>;
}

type PowerAction = "reboot" | "on" | "off" | "reset";

export default function VpsManage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { token } = useAuth();
  const { formatPrice } = useCurrency();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"overview" | "console" | "backups" | "firewall" | "settings">("overview");
  const [reinstallOpen, setReinstallOpen] = useState(false);
  const [selectedOs, setSelectedOs] = useState<string>("");
  const [powerMsg, setPowerMsg] = useState<string | null>(null);
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);
  const [confirmPower, setConfirmPower] = useState<PowerAction | null>(null);

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const { data: svc, isLoading, error } = useQuery<VpsService>({
    queryKey: ["vps-service", id],
    queryFn: () => fetch(`/api/my/vps-services/${id}`, { headers }).then(r => {
      if (!r.ok) throw new Error("Not found");
      return r.json();
    }),
    enabled: !!token && !!id,
    refetchInterval: 30000,
  });

  // Poll live stats every 8 seconds
  useEffect(() => {
    if (!token || !id || svc?.status !== "active") return;
    const fetchStats = () =>
      fetch(`/api/my/vps-services/${id}/stats`, { headers })
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setLiveStats(d))
        .catch(() => {});
    fetchStats();
    const interval = setInterval(fetchStats, 8000);
    return () => clearInterval(interval);
  }, [token, id, svc?.status]);

  const powerMutation = useMutation({
    mutationFn: async (action: PowerAction) => {
      if (action === "reboot") {
        return fetch(`/api/my/vps-services/${id}/reboot`, { method: "POST", headers }).then(r => r.json());
      }
      return fetch(`/api/my/vps-services/${id}/power`, {
        method: "POST", headers, body: JSON.stringify({ action }),
      }).then(r => r.json());
    },
    onSuccess: (data) => {
      setPowerMsg(data.message);
      setConfirmPower(null);
      qc.invalidateQueries({ queryKey: ["vps-service", id] });
      setTimeout(() => setPowerMsg(null), 8000);
    },
  });

  const reinstallMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/my/vps-services/${id}/reinstall`, {
        method: "POST", headers, body: JSON.stringify({ osTemplateId: selectedOs }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      setReinstallOpen(false);
      setPowerMsg(data.message);
      setTimeout(() => setPowerMsg(null), 12000);
    },
  });

  const cpuPct  = liveStats?.cpuPercent  ?? svc?.stats.cpuPercent  ?? 0;
  const ramPct  = liveStats?.ramPercent  ?? svc?.stats.ramPercent  ?? 0;
  const diskPct = svc?.stats.diskPercent ?? 0;

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={36} className="animate-spin" style={{ color: P }}/>
        <p className="text-gray-500 text-sm">Loading VPS details…</p>
      </div>
    </div>
  );

  if (error || !svc) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <AlertCircle size={48} className="text-red-400 mx-auto mb-4"/>
        <h2 className="text-xl font-bold text-gray-900 mb-2">VPS Not Found</h2>
        <p className="text-gray-500 mb-6">This VPS service could not be found or you don't have access.</p>
        <button onClick={() => setLocation("/client/hosting")}
          className="px-6 py-3 rounded-xl font-bold text-white text-sm"
          style={{ background: P }}>
          Back to Services
        </button>
      </div>
    </div>
  );

  const tabs = [
    { key: "overview",  label: "Overview",   icon: Activity },
    { key: "console",   label: "Console",    icon: Terminal },
    { key: "backups",   label: "Backups",    icon: Database },
    { key: "firewall",  label: "Firewall",   icon: Shield },
    { key: "settings",  label: "Settings",   icon: Settings },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 pt-4 pb-1 text-[12px] text-gray-400">
            <button onClick={() => setLocation("/client/hosting")} className="hover:text-gray-600 flex items-center gap-1">
              <ArrowLeft size={12}/> Services
            </button>
            <ChevronRight size={10}/>
            <span className="text-gray-600 font-medium">{svc.planName}</span>
          </div>

          {/* Server identity row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: `linear-gradient(135deg, ${P} 0%, #9B59FE 100%)` }}>
                <Server size={22} className="text-white"/>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-[18px] font-extrabold text-gray-900">{svc.planName}</h1>
                  <StatusBadge status={svc.status}/>
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {svc.serverIp && (
                    <span className="text-[12px] text-gray-500 font-mono flex items-center gap-1">
                      <Network size={10}/> {svc.serverIp}
                    </span>
                  )}
                  {svc.location && (
                    <span className="text-[12px] text-gray-500 flex items-center gap-1">
                      {svc.location.flagIcon} {svc.location.city ?? svc.location.countryName}
                    </span>
                  )}
                  {svc.os && (
                    <span className="text-[12px] text-gray-500 flex items-center gap-1.5">
                      <OsIcon os={svc.os}/> {svc.os.name} {svc.os.version}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Power controls */}
            <div className="flex items-center gap-2">
              <button onClick={() => setConfirmPower("reboot")}
                disabled={svc.status !== "active" || powerMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-all">
                <RotateCcw size={13}/> Reboot
              </button>
              {svc.status === "active" ? (
                <button onClick={() => setConfirmPower("off")}
                  disabled={powerMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-[12px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40 transition-all">
                  <Power size={13}/> Power Off
                </button>
              ) : (
                <button onClick={() => setConfirmPower("on")}
                  disabled={powerMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold text-white disabled:opacity-40 transition-all"
                  style={{ background: "#10B981" }}>
                  <Power size={13}/> Power On
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 overflow-x-auto">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setActiveTab(key as any)}
                className="flex items-center gap-1.5 px-4 py-3 text-[13px] font-semibold whitespace-nowrap border-b-2 transition-all"
                style={activeTab === key
                  ? { borderColor: P, color: P }
                  : { borderColor: "transparent", color: "#6B7280" }}>
                <Icon size={13}/> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Power action notification ── */}
      <AnimatePresence>
        {powerMsg && (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
            <div className="flex items-start gap-3 p-4 rounded-2xl border"
              style={{ background: "#EFF6FF", borderColor: "#BFDBFE" }}>
              <Info size={16} className="text-blue-500 shrink-0 mt-0.5"/>
              <p className="text-[13px] text-blue-700 font-medium">{powerMsg}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Resource usage */}
            <section>
              <h2 className="text-[14px] font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Activity size={14} style={{ color: P }}/> Resource Usage
                {liveStats && (
                  <span className="text-[10px] text-green-500 font-normal flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/> Live
                  </span>
                )}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <ResourceBar
                  label="CPU" icon={Cpu}
                  value={cpuPct} max={100} unit="%"
                />
                <ResourceBar
                  label="RAM" icon={MemoryStick}
                  value={(ramPct / 100) * svc.ramGb} max={svc.ramGb} unit="GB"
                />
                <ResourceBar
                  label="Disk" icon={HardDrive}
                  value={(diskPct / 100) * svc.storageGb} max={svc.storageGb} unit="GB"
                />
                <ResourceBar
                  label="Bandwidth" icon={Wifi}
                  value={svc.stats.bandwidthIn + svc.stats.bandwidthOut} max={svc.bandwidthTb ?? 1} unit="TB"
                  color="#10B981"
                />
              </div>
            </section>

            {/* Server info + Quick actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Server details */}
              <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl p-5">
                <h2 className="text-[14px] font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Server size={14} style={{ color: P }}/> Server Details
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: "IP Address",     value: svc.serverIp ?? "Assigning…",          icon: Network },
                    { label: "Virtualization", value: svc.virtualization,                     icon: Cpu },
                    { label: "CPU Cores",      value: `${svc.cpuCores} vCPU${svc.cpuCores !== 1 ? "s" : ""}`, icon: Cpu },
                    { label: "RAM",            value: `${svc.ramGb} GB DDR4 ECC`,             icon: MemoryStick },
                    { label: "Storage",        value: `${svc.storageGb} GB NVMe SSD`,         icon: HardDrive },
                    { label: "Bandwidth",      value: `${svc.bandwidthTb ?? 1} TB / month`,   icon: Wifi },
                    { label: "Network Speed",  value: svc.location?.networkSpeed ?? "1 Gbps", icon: Zap },
                    { label: "Uptime",         value: svc.status === "active"
                        ? <UptimeDisplay seconds={svc.stats.uptimeSeconds}/> : "Offline",      icon: Clock },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: `${P}05` }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${P}15` }}>
                        <Icon size={12} style={{ color: P }}/>
                      </div>
                      <div>
                        <p className="text-[10.5px] text-gray-400 font-medium uppercase tracking-wide">{label}</p>
                        <p className="text-[13px] font-semibold text-gray-800 mt-0.5">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right column: Location + OS + Billing */}
              <div className="space-y-4">
                {/* Location */}
                {svc.location && (
                  <div className="bg-white border border-gray-100 rounded-2xl p-5">
                    <h3 className="text-[13px] font-bold text-gray-900 mb-3 flex items-center gap-1.5">
                      <Globe size={13} style={{ color: P }}/> Data Center
                    </h3>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-4xl">{svc.location.flagIcon}</span>
                      <div>
                        <p className="text-[14px] font-bold text-gray-900">{svc.location.countryName}</p>
                        <p className="text-[12px] text-gray-500">{svc.location.city}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-[12px] text-gray-500">
                      <p><span className="font-semibold text-gray-700">Datacenter:</span> {svc.location.datacenter}</p>
                      <p><span className="font-semibold text-gray-700">Network:</span> {svc.location.networkSpeed}</p>
                      <p><span className="font-semibold text-gray-700">Avg Latency:</span> ~{svc.location.latencyMs} ms</p>
                    </div>
                  </div>
                )}

                {/* OS */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5">
                  <h3 className="text-[13px] font-bold text-gray-900 mb-3 flex items-center gap-1.5">
                    <MonitorPlay size={13} style={{ color: P }}/> Operating System
                  </h3>
                  {svc.os ? (
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-gray-100">
                        <OsIcon os={svc.os}/>
                      </div>
                      <div>
                        <p className="text-[14px] font-bold text-gray-900">{svc.os.name}</p>
                        <p className="text-[12px] text-gray-500">{svc.os.version}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[13px] text-gray-400 mb-4">No OS installed</p>
                  )}
                  <button onClick={() => { setSelectedOs(svc.os?.id ?? ""); setReinstallOpen(true); }}
                    className="w-full py-2 rounded-xl border border-dashed border-gray-300 text-[12px] font-semibold text-gray-500 hover:border-purple-300 hover:text-purple-600 transition-all flex items-center justify-center gap-1.5">
                    <HardDriveDownload size={12}/> Reinstall OS
                  </button>
                </div>

                {/* Billing */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5">
                  <h3 className="text-[13px] font-bold text-gray-900 mb-3 flex items-center gap-1.5">
                    <Calendar size={13} style={{ color: P }}/> Billing
                  </h3>
                  <div className="space-y-2 text-[12px]">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Plan</span>
                      <span className="font-semibold text-gray-800">{svc.planName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Cycle</span>
                      <span className="font-semibold text-gray-800 capitalize">{svc.billingCycle ?? "Monthly"}</span>
                    </div>
                    {svc.nextDueDate && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Next Due</span>
                        <span className="font-semibold text-gray-800">
                          {new Date(svc.nextDueDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Auto-Renew</span>
                      <span className={`font-semibold ${svc.autoRenew ? "text-green-600" : "text-red-500"}`}>
                        {svc.autoRenew ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Network traffic */}
            <section className="bg-white border border-gray-100 rounded-2xl p-5">
              <h2 className="text-[14px] font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Network size={14} style={{ color: P }}/> Network Traffic
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Inbound Speed",  value: svc.stats.networkIn,  icon: "↓", color: "#10B981" },
                  { label: "Outbound Speed", value: svc.stats.networkOut, icon: "↑", color: P },
                  { label: "Total In",       value: `${svc.stats.bandwidthIn} TB`, icon: "↓", color: "#10B981" },
                  { label: "Total Out",      value: `${svc.stats.bandwidthOut} TB`, icon: "↑", color: P },
                ].map(({ label, value, icon, color }) => (
                  <div key={label} className="p-3 rounded-xl text-center" style={{ background: `${color}08` }}>
                    <div className="text-[20px] font-bold mb-0.5" style={{ color }}>{icon}</div>
                    <p className="text-[13px] font-bold text-gray-900">{value}</p>
                    <p className="text-[10.5px] text-gray-400">{label}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Features */}
            {svc.features.length > 0 && (
              <section className="bg-white border border-gray-100 rounded-2xl p-5">
                <h2 className="text-[14px] font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <CheckCircle2 size={14} style={{ color: P }}/> Included Features
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {svc.features.map(f => (
                    <div key={f} className="flex items-center gap-2 text-[12.5px] text-gray-700">
                      <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: `${P}15` }}>
                        <CheckCircle2 size={9} style={{ color: P }}/>
                      </div>
                      {f}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </motion.div>
        )}

        {/* ── CONSOLE TAB ── */}
        {activeTab === "console" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-white border border-gray-100 rounded-2xl p-6">
            <div className="text-center max-w-lg mx-auto py-8">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "#111" }}>
                <Terminal size={28} className="text-green-400"/>
              </div>
              <h2 className="text-[18px] font-bold text-gray-900 mb-2">SSH Console Access</h2>
              <p className="text-[13px] text-gray-500 mb-6">
                Connect to your VPS via SSH from any terminal. Use your server's IP address and root credentials.
              </p>
              {svc.serverIp && (
                <div className="bg-gray-900 rounded-xl p-4 text-left mb-6 font-mono text-[13px]">
                  <p className="text-gray-400 text-[10px] mb-2 uppercase tracking-widest">SSH Command</p>
                  <p className="text-green-400">ssh root@{svc.serverIp}</p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left text-[12px]">
                {[
                  { icon: Lock, title: "Default Port", desc: "Port 22 (standard SSH)" },
                  { icon: Shield, title: "Root Access", desc: "Full administrative control" },
                  { icon: Zap, title: "Instant Connect", desc: "No VPN or gateway required" },
                  { icon: Activity, title: "Key Auth", desc: "Use SSH keys for security" },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex items-start gap-2.5 p-3 rounded-xl" style={{ background: `${P}06` }}>
                    <Icon size={13} style={{ color: P }} className="mt-0.5 shrink-0"/>
                    <div>
                      <p className="font-bold text-gray-800">{title}</p>
                      <p className="text-gray-500">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── BACKUPS TAB ── */}
        {activeTab === "backups" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-white border border-gray-100 rounded-2xl p-6">
            <div className="text-center max-w-md mx-auto py-8">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: `${P}10` }}>
                <Database size={28} style={{ color: P }}/>
              </div>
              <h2 className="text-[18px] font-bold text-gray-900 mb-2">Automated Backups</h2>
              <p className="text-[13px] text-gray-500 mb-6">
                Your plan includes weekly automated backups stored securely offsite. Upgrade to get daily or hourly backups.
              </p>
              <div className="space-y-3">
                {["Plan includes weekly backups", "7-day retention period", "One-click restore available", "Encrypted at rest"].map(f => (
                  <div key={f} className="flex items-center gap-2 text-[13px] text-gray-700 justify-center">
                    <CheckCircle2 size={14} style={{ color: "#10B981" }}/> {f}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── FIREWALL TAB ── */}
        {activeTab === "firewall" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-white border border-gray-100 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
                <Shield size={16} style={{ color: P }}/> Firewall Rules
              </h2>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-100 text-green-700">
                DDoS Protection Active
              </span>
            </div>
            <div className="space-y-2">
              {[
                { port: "22",   protocol: "TCP", source: "Any",  action: "Allow", desc: "SSH" },
                { port: "80",   protocol: "TCP", source: "Any",  action: "Allow", desc: "HTTP" },
                { port: "443",  protocol: "TCP", source: "Any",  action: "Allow", desc: "HTTPS" },
                { port: "3306", protocol: "TCP", source: "Any",  action: "Deny",  desc: "MySQL (blocked)" },
                { port: "5432", protocol: "TCP", source: "Any",  action: "Deny",  desc: "PostgreSQL (blocked)" },
                { port: "All",  protocol: "ICMP",source: "Any",  action: "Allow", desc: "Ping" },
              ].map(({ port, protocol, source, action, desc }) => (
                <div key={port + desc} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 text-[12.5px]">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-gray-700 w-12">{port}</span>
                    <span className="text-gray-400">{protocol}</span>
                    <span className="text-gray-500">{desc}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">from {source}</span>
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${action === "Allow" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {action}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-4">
              * Enterprise DDoS protection is automatically enabled on all VPS plans at no extra cost.
              Contact support to add custom firewall rules.
            </p>
          </motion.div>
        )}

        {/* ── SETTINGS TAB ── */}
        {activeTab === "settings" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {[
              {
                title: "Reinstall Operating System",
                desc: "Completely wipe and reinstall the OS. All data on the server will be permanently deleted.",
                icon: HardDriveDownload, danger: false,
                action: () => { setSelectedOs(svc.os?.id ?? ""); setReinstallOpen(true); },
                label: "Reinstall OS",
              },
              {
                title: "Request Hard Reset",
                desc: "Force restart the virtual machine. Use only if the server is unresponsive.",
                icon: RotateCcw, danger: false,
                action: () => setConfirmPower("reset"),
                label: "Hard Reset",
              },
              {
                title: "Cancel Service",
                desc: "Cancel this VPS plan at the end of your billing period. All data will be lost.",
                icon: XCircle, danger: true,
                action: () => setLocation(`/client/hosting/${id}`),
                label: "Request Cancellation",
              },
            ].map(({ title, desc, icon: Icon, danger, action, label }) => (
              <div key={title} className={`bg-white border rounded-2xl p-5 ${danger ? "border-red-100" : "border-gray-100"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${danger ? "bg-red-50" : ""}`}
                      style={!danger ? { background: `${P}10` } : {}}>
                      <Icon size={16} style={{ color: danger ? "#EF4444" : P }}/>
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-gray-900">{title}</p>
                      <p className="text-[12px] text-gray-500 mt-0.5">{desc}</p>
                    </div>
                  </div>
                  <button onClick={action}
                    className="shrink-0 px-4 py-2 rounded-xl text-[12px] font-bold transition-all"
                    style={danger
                      ? { background: "#FEE2E2", color: "#EF4444" }
                      : { background: `${P}10`, color: P }}>
                    {label}
                  </button>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {/* ── Power Confirm Modal ── */}
      <AnimatePresence>
        {confirmPower && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setConfirmPower(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="text-center mb-5">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: confirmPower === "off" ? "#FEE2E2" : `${P}10` }}>
                  {confirmPower === "off" ? <Power size={24} className="text-red-500"/> :
                   confirmPower === "on"  ? <Power size={24} style={{ color: "#10B981" }}/> :
                   <RotateCcw size={24} style={{ color: P }}/>}
                </div>
                <h3 className="text-[16px] font-bold text-gray-900 mb-1">
                  {confirmPower === "off" ? "Power Off Server?" :
                   confirmPower === "on"  ? "Power On Server?" :
                   confirmPower === "reboot" ? "Reboot Server?" : "Hard Reset Server?"}
                </h3>
                <p className="text-[12px] text-gray-500">
                  {confirmPower === "off" ? "Your server will be shut down. All running processes will stop." :
                   confirmPower === "on"  ? "Your server will start booting up." :
                   confirmPower === "reboot" ? "Your server will gracefully restart. ~30 second downtime." :
                   "A hard reset forces the VM to restart immediately. May cause data loss."}
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setConfirmPower(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[13px] font-semibold text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (confirmPower === "reboot") powerMutation.mutate("reboot");
                    else powerMutation.mutate(confirmPower as PowerAction);
                  }}
                  disabled={powerMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white flex items-center justify-center gap-2"
                  style={{ background: confirmPower === "off" ? "#EF4444" : confirmPower === "on" ? "#10B981" : P }}>
                  {powerMutation.isPending ? <Loader2 size={14} className="animate-spin"/> : null}
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Reinstall OS Modal ── */}
      <AnimatePresence>
        {reinstallOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setReinstallOpen(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <h3 className="text-[17px] font-bold text-gray-900 mb-1 flex items-center gap-2">
                <HardDriveDownload size={18} style={{ color: P }}/> Reinstall Operating System
              </h3>
              <div className="flex items-start gap-2 p-3 rounded-xl mb-4 text-[12px]"
                style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
                <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5"/>
                <p className="text-red-700">
                  <strong>Warning:</strong> Reinstalling will permanently erase all data on the server.
                  This action cannot be undone.
                </p>
              </div>

              <p className="text-[13px] font-semibold text-gray-700 mb-3">Select OS:</p>

              {/* Group OS by name */}
              {(() => {
                const grouped = svc.availableOs.reduce((acc, os) => {
                  if (!acc[os.name]) acc[os.name] = [];
                  acc[os.name].push(os);
                  return acc;
                }, {} as Record<string, typeof svc.availableOs>);

                return Object.entries(grouped).map(([name, templates]) => (
                  <div key={name} className="mb-3">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{name}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {templates.map(os => (
                        <button key={os.id} onClick={() => setSelectedOs(os.id)}
                          className="flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all text-[12.5px] font-medium"
                          style={selectedOs === os.id
                            ? { borderColor: P, background: `${P}08`, color: P }
                            : { borderColor: "#E5E7EB", color: "#374151" }}>
                          {os.iconUrl ? (
                            <img
                              src={os.iconUrl}
                              alt={os.name}
                              className="w-5 h-5 object-contain shrink-0"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                            />
                          ) : (
                            <Server size={14} className="shrink-0"/>
                          )}
                          {os.name} {os.version}
                          {selectedOs === os.id && <CheckCircle2 size={13} className="ml-auto shrink-0" style={{ color: P }}/>}
                        </button>
                      ))}
                    </div>
                  </div>
                ));
              })()}

              <div className="flex gap-3 mt-5 pt-4 border-t border-gray-100">
                <button onClick={() => setReinstallOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[13px] font-semibold text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={() => reinstallMutation.mutate()}
                  disabled={!selectedOs || reinstallMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: "#EF4444" }}>
                  {reinstallMutation.isPending ? <Loader2 size={14} className="animate-spin"/> : <HardDriveDownload size={14}/>}
                  Reinstall Now
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
