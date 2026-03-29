import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Server, Search, CheckCircle2, XCircle, Clock, Cpu, MemoryStick, HardDrive, Key, Globe, User, Save, Eye, EyeOff, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const P = "#4F46E5";

function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token") ?? "";
  return fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
}

interface VpsService {
  id: string;
  clientId: string;
  clientEmail: string | null;
  clientName: string | null;
  companyName: string | null;
  planId: string;
  planName: string;
  hostname: string | null;
  dedicatedIp: string | null;
  sshUsername: string | null;
  sshPassword: string | null;
  status: string;
  billingCycle: string | null;
  nextDueDate: string | null;
  startDate: string | null;
  autoRenew: boolean | null;
  cpuCores: number;
  ramGb: number;
  storageGb: number;
  bandwidthTb: number | null;
  createdAt: string;
}

const STATUS_STYLES: Record<string, { color: string; icon: typeof CheckCircle2; label: string }> = {
  active:    { color: "text-green-600 bg-green-50 border-green-200",   icon: CheckCircle2, label: "Active" },
  suspended: { color: "text-amber-600 bg-amber-50 border-amber-200",   icon: Clock,        label: "Suspended" },
  terminated:{ color: "text-red-500 bg-red-50 border-red-200",         icon: XCircle,      label: "Terminated" },
  pending:   { color: "text-blue-600 bg-blue-50 border-blue-200",      icon: Clock,        label: "Pending" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES["pending"];
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${s.color}`}>
      <Icon size={10}/>{s.label}
    </span>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast({ title: "Copied!", description: value });
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700">
      {copied ? <Check size={12} className="text-green-500"/> : <Copy size={12}/>}
    </button>
  );
}

function ServiceRow({ svc }: { svc: VpsService }) {
  const [expanded, setExpanded] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    hostname: svc.hostname ?? "",
    dedicatedIp: svc.dedicatedIp ?? "",
    sshUsername: svc.sshUsername ?? "",
    sshPassword: svc.sshPassword ?? "",
    status: svc.status,
  });

  const updateMutation = useMutation({
    mutationFn: () => apiFetch(`/api/admin/vps-services/${svc.id}`, {
      method: "PUT",
      body: JSON.stringify({
        hostname: form.hostname || null,
        dedicatedIp: form.dedicatedIp || null,
        sshUsername: form.sshUsername || null,
        sshPassword: form.sshPassword || null,
        status: form.status,
      }),
    }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Saved", description: "VPS service updated successfully." });
      qc.invalidateQueries({ queryKey: ["admin-vps-services"] });
    },
    onError: () => toast({ title: "Error", description: "Could not save changes.", variant: "destructive" }),
  });

  const dueDate = svc.nextDueDate ? new Date(svc.nextDueDate).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" }) : "–";

  return (
    <div className={`bg-white rounded-2xl border transition-all ${expanded ? "border-violet-200 shadow-sm" : "border-gray-200"}`}>
      {/* Collapsed row */}
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${P}12` }}>
          <Server size={15} style={{ color: P }}/>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-[13px]">{svc.planName}</span>
            <StatusBadge status={svc.status}/>
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-[11.5px] text-gray-500 flex items-center gap-1">
              <User size={10}/> {svc.clientName ?? svc.clientEmail ?? "Unknown"}
            </span>
            {svc.dedicatedIp && (
              <span className="text-[11.5px] text-gray-500 flex items-center gap-1">
                <Globe size={10}/> {svc.dedicatedIp}
              </span>
            )}
            {svc.hostname && (
              <span className="text-[11.5px] text-gray-400 font-mono">{svc.hostname}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <div className="text-[11px] text-gray-400">Due</div>
            <div className="text-[12px] font-medium text-gray-700">{dueDate}</div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <span className="flex items-center gap-0.5"><Cpu size={10}/> {svc.cpuCores}vCPU</span>
            <span className="flex items-center gap-0.5"><MemoryStick size={10}/> {svc.ramGb}GB</span>
            <span className="flex items-center gap-0.5"><HardDrive size={10}/> {svc.storageGb}GB</span>
          </div>
          {expanded ? <ChevronUp size={14} className="text-gray-400"/> : <ChevronDown size={14} className="text-gray-400"/>}
        </div>
      </div>

      {/* Expanded config panel */}
      {expanded && (
        <div className="border-t border-gray-100 p-4" onClick={e => e.stopPropagation()}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-[11px] font-semibold text-gray-600 mb-1 flex items-center gap-1"><Globe size={10}/> Hostname</label>
              <div className="flex gap-1">
                <Input value={form.hostname} onChange={e => setForm(f => ({ ...f, hostname: e.target.value }))}
                  placeholder="e.g. vps01.noehost.com" className="text-[12px] h-8"/>
                {svc.hostname && <CopyButton value={svc.hostname}/>}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-600 mb-1 flex items-center gap-1"><Globe size={10}/> Dedicated IP</label>
              <div className="flex gap-1">
                <Input value={form.dedicatedIp} onChange={e => setForm(f => ({ ...f, dedicatedIp: e.target.value }))}
                  placeholder="e.g. 103.22.45.67" className="text-[12px] h-8"/>
                {svc.dedicatedIp && <CopyButton value={svc.dedicatedIp}/>}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-600 mb-1 flex items-center gap-1"><User size={10}/> SSH / Root Username</label>
              <div className="flex gap-1">
                <Input value={form.sshUsername} onChange={e => setForm(f => ({ ...f, sshUsername: e.target.value }))}
                  placeholder="e.g. root" className="text-[12px] h-8"/>
                {svc.sshUsername && <CopyButton value={svc.sshUsername}/>}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-600 mb-1 flex items-center gap-1"><Key size={10}/> SSH / Root Password</label>
              <div className="flex gap-1">
                <div className="relative flex-1">
                  <Input
                    type={showPass ? "text" : "password"}
                    value={form.sshPassword}
                    onChange={e => setForm(f => ({ ...f, sshPassword: e.target.value }))}
                    placeholder="Root password"
                    className="text-[12px] h-8 pr-8"
                  />
                  <button onClick={() => setShowPass(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                    {showPass ? <EyeOff size={12}/> : <Eye size={12}/>}
                  </button>
                </div>
                {svc.sshPassword && <CopyButton value={svc.sshPassword}/>}
              </div>
            </div>
          </div>

          {/* Status selector */}
          <div className="flex items-center gap-3 mb-4">
            <label className="text-[11px] font-semibold text-gray-600">Status:</label>
            {["active", "suspended", "pending", "terminated"].map(st => (
              <button key={st} onClick={() => setForm(f => ({ ...f, status: st }))}
                className={`text-[11px] px-3 py-1 rounded-full border font-medium transition-colors ${
                  form.status === st
                    ? "text-white border-transparent"
                    : "text-gray-500 border-gray-200 hover:border-violet-300"
                }`}
                style={form.status === st ? { background: P } : {}}>
                {st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="text-[11px] text-gray-400">
              Client: <span className="text-gray-600">{svc.clientEmail}</span>
              {svc.billingCycle && <> · <span className="capitalize">{svc.billingCycle}</span></>}
              {svc.autoRenew && <> · <span className="text-green-600">Auto-renew ON</span></>}
            </div>
            <Button size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}
              style={{ background: P }} className="text-white hover:opacity-90 h-8 text-[12px]">
              <Save size={12} className="mr-1.5"/>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VpsServices() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: rawServices, isLoading } = useQuery<VpsService[]>({
    queryKey: ["admin-vps-services"],
    queryFn: async () => {
      const r = await apiFetch("/api/admin/vps-services");
      const d = await r.json();
      return Array.isArray(d) ? d : [];
    },
  });
  const services: VpsService[] = Array.isArray(rawServices) ? rawServices : [];

  const filtered = services.filter(svc => {
    const matchStatus = statusFilter === "all" || svc.status === statusFilter;
    const s = search.toLowerCase();
    const matchSearch = !s ||
      svc.clientEmail?.toLowerCase().includes(s) ||
      svc.clientName?.toLowerCase().includes(s) ||
      svc.hostname?.toLowerCase().includes(s) ||
      svc.dedicatedIp?.toLowerCase().includes(s) ||
      svc.planName?.toLowerCase().includes(s);
    return matchStatus && matchSearch;
  });

  const stats = {
    total: services.length,
    active: services.filter(s => s.status === "active").length,
    suspended: services.filter(s => s.status === "suspended").length,
    pending: services.filter(s => s.status === "pending").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${P}15` }}>
            <Server size={20} style={{ color: P }}/>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">VPS Services</h1>
            <p className="text-sm text-gray-500">{stats.total} VPS services · {stats.active} active</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: P },
          { label: "Active", value: stats.active, color: "#22c55e" },
          { label: "Suspended", value: stats.suspended, color: "#f59e0b" },
          { label: "Pending", value: stats.pending, color: "#3b82f6" },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-3.5">
            <div className="text-2xl font-extrabold" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-[11.5px] text-gray-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search client, hostname, IP..." className="pl-8 text-[13px] h-9"/>
        </div>
        <div className="flex gap-1.5">
          {["all", "active", "suspended", "pending", "terminated"].map(st => (
            <button key={st} onClick={() => setStatusFilter(st)}
              className={`text-[11.5px] px-3 py-1.5 rounded-lg border font-medium transition-colors capitalize ${
                statusFilter === st ? "text-white border-transparent" : "text-gray-600 border-gray-200 hover:border-violet-300 bg-white"
              }`}
              style={statusFilter === st ? { background: P } : {}}>
              {st === "all" ? "All" : st}
            </button>
          ))}
        </div>
      </div>

      {/* Services list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-200 rounded-lg shrink-0"/>
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-1/3"/>
                  <div className="h-2.5 bg-gray-100 rounded w-1/2"/>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: `${P}10` }}>
            <Server size={22} style={{ color: P }}/>
          </div>
          <h3 className="font-semibold text-gray-800 mb-1">No VPS services found</h3>
          <p className="text-sm text-gray-500">
            {search || statusFilter !== "all"
              ? "Try adjusting your filters."
              : "No VPS services have been ordered yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(svc => <ServiceRow key={svc.id} svc={svc}/>)}
        </div>
      )}
    </div>
  );
}
