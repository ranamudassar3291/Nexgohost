import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Globe, Plus, Trash2, ArrowLeft, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const P = "#4F46E5";

function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token") ?? "";
  return fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
}

interface VpsLocation { id: string; countryName: string; countryCode: string; flagIcon: string | null; isActive: boolean; }

const PRESETS = [
  { countryName: "United States", countryCode: "US", flagIcon: "🇺🇸" },
  { countryName: "United Kingdom", countryCode: "GB", flagIcon: "🇬🇧" },
  { countryName: "Germany", countryCode: "DE", flagIcon: "🇩🇪" },
  { countryName: "Netherlands", countryCode: "NL", flagIcon: "🇳🇱" },
  { countryName: "Singapore", countryCode: "SG", flagIcon: "🇸🇬" },
  { countryName: "Japan", countryCode: "JP", flagIcon: "🇯🇵" },
  { countryName: "Australia", countryCode: "AU", flagIcon: "🇦🇺" },
  { countryName: "Pakistan", countryCode: "PK", flagIcon: "🇵🇰" },
  { countryName: "India", countryCode: "IN", flagIcon: "🇮🇳" },
  { countryName: "France", countryCode: "FR", flagIcon: "🇫🇷" },
];

export default function VpsLocations() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ countryName: "", countryCode: "", flagIcon: "", isActive: true });

  const { data: locations = [], isLoading } = useQuery<VpsLocation[]>({
    queryKey: ["admin-vps-locations"],
    queryFn: () => apiFetch("/api/admin/vps-locations").then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string | null; data: any }) =>
      apiFetch(id ? `/api/admin/vps-locations/${id}` : "/api/admin/vps-locations", {
        method: id ? "PUT" : "POST", body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-vps-locations"] });
      setShowForm(false); setEditId(null);
      setForm({ countryName: "", countryCode: "", flagIcon: "", isActive: true });
      toast({ title: editId ? "Updated" : "Added", description: "Location saved." });
    },
    onError: () => toast({ title: "Error", description: "Could not save location", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/vps-locations/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-vps-locations"] }); toast({ title: "Deleted" }); },
  });

  function startEdit(loc: VpsLocation) {
    setEditId(loc.id);
    setForm({ countryName: loc.countryName, countryCode: loc.countryCode, flagIcon: loc.flagIcon || "", isActive: loc.isActive });
    setShowForm(true);
  }

  function addPreset(p: typeof PRESETS[0]) {
    saveMutation.mutate({ id: null, data: { ...p, isActive: true } });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => setLocation("/admin/vps")} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft size={18} className="text-gray-600"/>
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${P}15` }}>
            <Globe size={17} style={{ color: P }}/>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Data Center Locations</h1>
        </div>
        <Button size="sm" onClick={() => { setEditId(null); setForm({ countryName: "", countryCode: "", flagIcon: "", isActive: true }); setShowForm(true); }}
          className="ml-auto text-white" style={{ background: P }}>
          <Plus size={13} className="mr-1.5"/> Add Location
        </Button>
      </div>

      {/* Presets */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <p className="text-[12.5px] font-semibold text-gray-600 mb-3">Quick Add Locations</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => {
            const exists = locations.some(l => l.countryCode === p.countryCode);
            return (
              <button key={p.countryCode} onClick={() => !exists && addPreset(p)}
                disabled={exists || saveMutation.isPending}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[12px] font-medium transition-all ${
                  exists ? "border-gray-100 bg-gray-50 text-gray-300 cursor-default" : "border-gray-200 hover:border-purple-400 hover:bg-purple-50 hover:text-purple-700 cursor-pointer"
                }`}>
                <span className="text-[16px]">{p.flagIcon}</span>
                {p.countryName}
                {exists && <Check size={10} className="text-green-400"/>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <h3 className="font-semibold text-gray-800">{editId ? "Edit Location" : "Add Location"}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Country Name *</label>
                <Input value={form.countryName} onChange={e => setForm(f => ({ ...f, countryName: e.target.value }))} placeholder="United States"/>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Country Code *</label>
                <Input value={form.countryCode} onChange={e => setForm(f => ({ ...f, countryCode: e.target.value.toUpperCase().slice(0, 3) }))} placeholder="US" maxLength={3}/>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Flag Emoji</label>
                <Input value={form.flagIcon} onChange={e => setForm(f => ({ ...f, flagIcon: e.target.value }))} placeholder="🇺🇸"/>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</Button>
              <Button size="sm" onClick={() => saveMutation.mutate({ id: editId, data: form })}
                disabled={!form.countryName || !form.countryCode || saveMutation.isPending}
                className="text-white" style={{ background: P }}>
                {saveMutation.isPending ? "Saving…" : editId ? "Save" : "Add"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : locations.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No locations yet. Add one above.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {locations.map(loc => (
              <div key={loc.id} className="flex items-center gap-3 px-4 py-3">
                {loc.flagIcon ? (
                  <span className="text-[20px]">{loc.flagIcon}</span>
                ) : (
                  <div className="w-7 h-7 rounded bg-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-500">
                    {loc.countryCode.slice(0, 2)}
                  </div>
                )}
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-gray-800">{loc.countryName}</div>
                  <div className="text-[11.5px] text-gray-400">{loc.countryCode}</div>
                </div>
                <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${loc.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                  {loc.isActive ? "Active" : "Off"}
                </span>
                <button onClick={() => startEdit(loc)} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <Pencil size={12} className="text-gray-400"/>
                </button>
                <button onClick={() => { if (confirm(`Delete ${loc.countryName}?`)) deleteMutation.mutate(loc.id); }}
                  className="p-1.5 rounded-lg hover:bg-red-50">
                  <Trash2 size={12} className="text-red-400"/>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
