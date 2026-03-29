import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Server, Plus, Pencil, Trash2, Eye, EyeOff, Cpu, MemoryStick, HardDrive, Wifi, CheckCircle2, XCircle, Globe, MonitorCog, Copy, Check, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/context/CurrencyProvider";

const P = "#4F46E5";

function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token") ?? "";
  return fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
}

interface VpsPlan {
  id: string; name: string; description: string | null;
  price: number; yearlyPrice: number | null;
  cpuCores: number; ramGb: number; storageGb: number; bandwidthTb: number | null;
  virtualization: string | null; features: string[]; saveAmount: number | null;
  osTemplateIds: string[]; locationIds: string[]; isActive: boolean; sortOrder: number;
}

function CopyOrderLink({ planId }: { planId: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const link = `${window.location.origin}/order/vps/${planId}`;
  const handleCopy = () => {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      toast({ title: "Order Link Copied!", description: link });
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="border border-dashed border-gray-200 rounded-lg px-3 py-1.5 flex items-center gap-2">
      <span className="text-[10.5px] text-gray-400 truncate flex-1 font-mono">/order/vps/{planId.slice(0, 8)}…</span>
      <button onClick={handleCopy}
        className="flex items-center gap-1 text-[10.5px] font-semibold shrink-0 transition-colors"
        style={{ color: copied ? "#22c55e" : P }}>
        {copied ? <><Check size={10}/> Copied</> : <><Copy size={10}/> Copy Link</>}
      </button>
    </div>
  );
}

export default function VpsPlans() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const qc = useQueryClient();

  const { data: plans = [], isLoading } = useQuery<VpsPlan[]>({
    queryKey: ["admin-vps-plans"],
    queryFn: () => apiFetch("/api/admin/vps-plans").then(r => r.json()),
  });

  const toggleMutation = useMutation({
    mutationFn: (plan: VpsPlan) =>
      apiFetch(`/api/admin/vps-plans/${plan.id}`, {
        method: "PUT", body: JSON.stringify({ isActive: !plan.isActive }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-vps-plans"] }),
    onError: () => toast({ title: "Error", description: "Could not update plan", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/vps-plans/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-vps-plans"] });
      toast({ title: "Deleted", description: "VPS plan removed." });
    },
    onError: () => toast({ title: "Error", description: "Could not delete plan", variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${P}15` }}>
            <Server size={20} style={{ color: P }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">VPS Plans</h1>
            <p className="text-sm text-gray-500">{plans.length} plan{plans.length !== 1 ? "s" : ""} configured</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setLocation("/admin/vps/services")}>
            <List size={14} className="mr-1.5"/> VPS Services
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLocation("/admin/vps/os-templates")}>
            <MonitorCog size={14} className="mr-1.5"/> OS Templates
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLocation("/admin/vps/locations")}>
            <Globe size={14} className="mr-1.5"/> Locations
          </Button>
          <Button size="sm" onClick={() => setLocation("/admin/vps/add")}
            style={{ background: P }} className="text-white hover:opacity-90">
            <Plus size={14} className="mr-1.5"/> Add VPS Plan
          </Button>
        </div>
      </div>

      {/* Plan grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-2/3 mb-3"/>
              <div className="h-3 bg-gray-100 rounded w-full mb-6"/>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[1,2,3,4].map(j => <div key={j} className="h-10 bg-gray-100 rounded-xl"/>)}
              </div>
            </div>
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: `${P}10` }}>
            <Server size={22} style={{ color: P }}/>
          </div>
          <h3 className="font-semibold text-gray-800 mb-1">No VPS plans yet</h3>
          <p className="text-sm text-gray-500 mb-4">Create your first VPS plan to offer cloud servers to clients.</p>
          <Button size="sm" onClick={() => setLocation("/admin/vps/add")} style={{ background: P }} className="text-white">
            <Plus size={13} className="mr-1.5"/> Create First Plan
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {plans.map((plan, i) => (
              <motion.div key={plan.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`bg-white rounded-2xl border p-5 flex flex-col gap-4 ${plan.isActive ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900 text-[15px]">{plan.name}</h3>
                      {plan.saveAmount != null && plan.saveAmount > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          Save Rs. {Number(plan.saveAmount).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {plan.description && <p className="text-[12px] text-gray-500 line-clamp-1">{plan.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleMutation.mutate(plan)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                      title={plan.isActive ? "Disable" : "Enable"}>
                      {plan.isActive ? <Eye size={13} className="text-green-600"/> : <EyeOff size={13} className="text-gray-400"/>}
                    </button>
                    <button onClick={() => setLocation(`/admin/vps/${plan.id}/edit`)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                      <Pencil size={13} className="text-gray-500"/>
                    </button>
                    <button onClick={() => { if (confirm(`Delete "${plan.name}"?`)) deleteMutation.mutate(plan.id); }}
                      className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                      <Trash2 size={13} className="text-red-400"/>
                    </button>
                  </div>
                </div>

                {/* Pricing */}
                <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[18px] font-extrabold text-gray-900">{formatPrice(plan.price)}</span>
                    <span className="text-[11px] text-gray-400">/mo</span>
                    {plan.yearlyPrice && (
                      <span className="text-[11px] text-gray-400 ml-1">· {formatPrice(plan.yearlyPrice)}/yr</span>
                    )}
                  </div>
                  <div className="text-[10.5px] text-gray-400 mt-0.5 uppercase tracking-wide">
                    {plan.virtualization ?? "KVM"} Virtualization
                  </div>
                </div>

                {/* Specs */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: Cpu, label: `${plan.cpuCores} vCPU${plan.cpuCores > 1 ? "s" : ""}` },
                    { icon: MemoryStick, label: `${plan.ramGb} GB RAM` },
                    { icon: HardDrive, label: `${plan.storageGb} GB NVMe` },
                    { icon: Wifi, label: `${plan.bandwidthTb ?? 1} TB BW` },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-1.5 bg-white border border-gray-100 rounded-lg px-2.5 py-1.5">
                      <Icon size={11} style={{ color: P }} className="shrink-0"/>
                      <span className="text-[11.5px] font-medium text-gray-700">{label}</span>
                    </div>
                  ))}
                </div>

                {/* Status */}
                <div className="flex items-center gap-2 text-[11.5px]">
                  {plan.isActive
                    ? <><CheckCircle2 size={12} className="text-green-500"/> <span className="text-green-600 font-medium">Active</span></>
                    : <><XCircle size={12} className="text-gray-400"/> <span className="text-gray-400">Disabled</span></>
                  }
                  <span className="text-gray-300">·</span>
                  <span className="text-gray-400">{plan.osTemplateIds.length} OS · {plan.locationIds.length} locations</span>
                </div>

                {/* Order link */}
                <CopyOrderLink planId={plan.id}/>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
