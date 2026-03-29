import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { motion } from "framer-motion";
import { Server, ArrowLeft, Plus, X, Loader2, Cpu, MemoryStick, HardDrive, Wifi, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

const P = "#4F46E5";

function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token") ?? "";
  return fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
}

interface OsTemplate { id: string; name: string; version: string; iconUrl: string | null; isActive: boolean; }
interface VpsLocation { id: string; countryName: string; countryCode: string; flagIcon: string | null; isActive: boolean; }

const DEFAULT_FEATURES = [
  "Full Root Access",
  "DDoS Protection",
  "Dedicated IP",
  "SSD NVMe Storage",
  "99.9% Uptime SLA",
  "Instant Provisioning",
];

export default function AddVpsPlan() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: "", description: "",
    price: "", yearlyPrice: "",
    cpuCores: "2", ramGb: "2", storageGb: "40", bandwidthTb: "1",
    virtualization: "KVM",
    saveAmount: "",
    isActive: true, sortOrder: "0",
  });
  const [features, setFeatures] = useState<string[]>(["Full Root Access", "DDoS Protection", "Dedicated IP"]);
  const [newFeature, setNewFeature] = useState("");
  const [selectedOsIds, setSelectedOsIds] = useState<string[]>([]);
  const [selectedLocIds, setSelectedLocIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  const { data: osTemplates = [] } = useQuery<OsTemplate[]>({
    queryKey: ["admin-vps-os-templates"],
    queryFn: () => apiFetch("/api/admin/vps-os-templates").then(r => r.json()),
  });
  const { data: locations = [] } = useQuery<VpsLocation[]>({
    queryKey: ["admin-vps-locations"],
    queryFn: () => apiFetch("/api/admin/vps-locations").then(r => r.json()),
  });

  useEffect(() => {
    if (!isEdit) return;
    apiFetch(`/api/admin/vps-plans/${id}`).then(r => r.json()).then(data => {
      setForm({
        name: data.name || "", description: data.description || "",
        price: data.price != null ? String(data.price) : "",
        yearlyPrice: data.yearlyPrice != null ? String(data.yearlyPrice) : "",
        cpuCores: String(data.cpuCores ?? 2), ramGb: String(data.ramGb ?? 2),
        storageGb: String(data.storageGb ?? 40), bandwidthTb: String(data.bandwidthTb ?? 1),
        virtualization: data.virtualization || "KVM",
        saveAmount: data.saveAmount != null ? String(data.saveAmount) : "",
        isActive: data.isActive !== false, sortOrder: String(data.sortOrder ?? 0),
      });
      setFeatures(Array.isArray(data.features) ? data.features : []);
      setSelectedOsIds(Array.isArray(data.osTemplateIds) ? data.osTemplateIds : []);
      setSelectedLocIds(Array.isArray(data.locationIds) ? data.locationIds : []);
    }).finally(() => setFetching(false));
  }, [id, isEdit]);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  function toggleOs(osId: string) {
    setSelectedOsIds(prev => prev.includes(osId) ? prev.filter(x => x !== osId) : [...prev, osId]);
  }
  function toggleLoc(locId: string) {
    setSelectedLocIds(prev => prev.includes(locId) ? prev.filter(x => x !== locId) : [...prev, locId]);
  }
  function addFeature() {
    const f = newFeature.trim();
    if (f && !features.includes(f)) { setFeatures(prev => [...prev, f]); }
    setNewFeature("");
  }
  function removeFeature(f: string) { setFeatures(prev => prev.filter(x => x !== f)); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.price) { toast({ title: "Missing fields", description: "Name and monthly price are required.", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const body = {
        name: form.name, description: form.description || null,
        price: parseFloat(form.price),
        yearlyPrice: form.yearlyPrice ? parseFloat(form.yearlyPrice) : null,
        cpuCores: parseInt(form.cpuCores) || 1,
        ramGb: parseInt(form.ramGb) || 1,
        storageGb: parseInt(form.storageGb) || 20,
        bandwidthTb: parseFloat(form.bandwidthTb) || 1,
        virtualization: form.virtualization,
        features,
        osTemplateIds: selectedOsIds,
        locationIds: selectedLocIds,
        saveAmount: form.saveAmount ? parseFloat(form.saveAmount) : null,
        isActive: form.isActive,
        sortOrder: parseInt(form.sortOrder) || 0,
      };
      const url = isEdit ? `/api/admin/vps-plans/${id}` : "/api/admin/vps-plans";
      const method = isEdit ? "PUT" : "POST";
      const r = await apiFetch(url, { method, body: JSON.stringify(body) });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Save failed"); }
      toast({ title: isEdit ? "Plan updated" : "Plan created", description: `"${form.name}" saved successfully.` });
      setLocation("/admin/vps");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  if (fetching) return <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin" style={{ color: P }}/></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => setLocation("/admin/vps")}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft size={18} className="text-gray-600"/>
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${P}15` }}>
            <Server size={17} style={{ color: P }}/>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{isEdit ? "Edit VPS Plan" : "Add VPS Plan"}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic Info */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 text-[15px]">Plan Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-[12.5px] font-medium text-gray-600 mb-1.5">Plan Name *</label>
              <Input value={form.name} onChange={set("name")} placeholder="e.g. VPS Starter" required/>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[12.5px] font-medium text-gray-600 mb-1.5">Description</label>
              <textarea value={form.description} onChange={set("description")}
                placeholder="Short description for this plan..."
                rows={2} className="w-full px-3 py-2 rounded-xl border border-input bg-background text-[13px] focus:outline-none focus:ring-2 resize-none"
                style={{ focusRingColor: P }}/>
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-gray-600 mb-1.5">Monthly Price (Rs.) *</label>
              <Input type="number" min="0" step="0.01" value={form.price} onChange={set("price")} placeholder="1500" required/>
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-gray-600 mb-1.5">Yearly Price (Rs.)</label>
              <Input type="number" min="0" step="0.01" value={form.yearlyPrice} onChange={set("yearlyPrice")} placeholder="15000"/>
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-gray-600 mb-1.5">Save Amount (Rs.)</label>
              <Input type="number" min="0" step="0.01" value={form.saveAmount} onChange={set("saveAmount")} placeholder="Auto-calculated if blank"/>
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-gray-600 mb-1.5">Sort Order</label>
              <Input type="number" min="0" value={form.sortOrder} onChange={set("sortOrder")} placeholder="0"/>
            </div>
          </div>
        </div>

        {/* Hardware Specs */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 text-[15px]">Hardware Specifications</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { field: "cpuCores", label: "CPU Cores", icon: Cpu, placeholder: "2" },
              { field: "ramGb", label: "RAM (GB)", icon: MemoryStick, placeholder: "4" },
              { field: "storageGb", label: "Storage (GB)", icon: HardDrive, placeholder: "80" },
              { field: "bandwidthTb", label: "Bandwidth (TB)", icon: Wifi, placeholder: "1" },
            ].map(({ field, label, icon: Icon, placeholder }) => (
              <div key={field}>
                <label className="block text-[12.5px] font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
                  <Icon size={11} style={{ color: P }}/> {label}
                </label>
                <Input type="number" min="0" step={field === "bandwidthTb" ? "0.5" : "1"}
                  value={(form as any)[field]} onChange={set(field)} placeholder={placeholder}/>
              </div>
            ))}
          </div>
          <div>
            <label className="block text-[12.5px] font-medium text-gray-600 mb-1.5">Virtualization</label>
            <select value={form.virtualization} onChange={set("virtualization")}
              className="w-full sm:w-auto px-3 py-2 rounded-xl border border-input bg-background text-[13px] font-medium focus:outline-none">
              <option value="KVM">KVM</option>
              <option value="OpenVZ">OpenVZ</option>
              <option value="VMware">VMware</option>
              <option value="Hyper-V">Hyper-V</option>
            </select>
          </div>
        </div>

        {/* Features */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 text-[15px]">Features</h2>
          <div className="flex flex-wrap gap-2">
            {features.map(f => (
              <span key={f} className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-full border border-gray-200 bg-gray-50">
                {f}
                <button type="button" onClick={() => removeFeature(f)} className="hover:text-red-500 transition-colors">
                  <X size={10}/>
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={newFeature} onChange={e => setNewFeature(e.target.value)}
              placeholder="Add feature..." className="flex-1"
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addFeature(); } }}/>
            <Button type="button" variant="outline" size="sm" onClick={addFeature}>
              <Plus size={13} className="mr-1"/> Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <p className="text-[11.5px] text-gray-400 w-full">Quick add:</p>
            {DEFAULT_FEATURES.filter(f => !features.includes(f)).map(f => (
              <button key={f} type="button" onClick={() => setFeatures(prev => [...prev, f])}
                className="text-[11.5px] px-2.5 py-1 rounded-full border border-dashed border-gray-300 text-gray-500 hover:border-purple-400 hover:text-purple-600 transition-colors">
                + {f}
              </button>
            ))}
          </div>
        </div>

        {/* OS Templates */}
        {osTemplates.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-800 text-[15px]">Available OS Templates
              <span className="ml-2 text-[12px] font-normal text-gray-400">({selectedOsIds.length} selected)</span>
            </h2>
            <p className="text-[12px] text-gray-400">Leave all unselected to allow any OS.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {osTemplates.map(os => (
                <button key={os.id} type="button" onClick={() => toggleOs(os.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[12px] font-medium transition-all text-left ${
                    selectedOsIds.includes(os.id)
                      ? "border-purple-400 bg-purple-50 text-purple-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}>
                  {os.iconUrl && <img src={os.iconUrl} alt="" className="w-5 h-5 object-contain"/>}
                  <span className="truncate">{os.name} {os.version}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Locations */}
        {locations.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-800 text-[15px]">Available Locations
              <span className="ml-2 text-[12px] font-normal text-gray-400">({selectedLocIds.length} selected)</span>
            </h2>
            <p className="text-[12px] text-gray-400">Leave all unselected to allow any location.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {locations.map(loc => (
                <button key={loc.id} type="button" onClick={() => toggleLoc(loc.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[12px] font-medium transition-all text-left ${
                    selectedLocIds.includes(loc.id)
                      ? "border-purple-400 bg-purple-50 text-purple-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}>
                  {loc.flagIcon ? (
                    <span className="text-[18px]">{loc.flagIcon}</span>
                  ) : (
                    <span className="w-5 h-5 rounded-sm bg-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-500">
                      {loc.countryCode.toUpperCase().slice(0, 2)}
                    </span>
                  )}
                  <span className="truncate">{loc.countryName}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Status */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
              className="w-4 h-4 rounded" style={{ accentColor: P }}/>
            <div>
              <div className="text-[13.5px] font-semibold text-gray-800">Active (visible to clients)</div>
              <div className="text-[11.5px] text-gray-400">Disabled plans are hidden from the order flow.</div>
            </div>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => setLocation("/admin/vps")}>Cancel</Button>
          <Button type="submit" disabled={loading}
            className="flex-1 text-white" style={{ background: P }}>
            {loading ? <><Loader2 size={14} className="animate-spin mr-2"/> Saving…</> : <><Save size={14} className="mr-2"/> {isEdit ? "Save Changes" : "Create Plan"}</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
