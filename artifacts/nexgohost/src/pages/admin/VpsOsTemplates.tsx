import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { MonitorCog, Plus, Trash2, ArrowLeft, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const P = "#701AFE";

function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token") ?? "";
  return fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
}

interface OsTemplate { id: string; name: string; version: string; iconUrl: string | null; isActive: boolean; }

const PRESETS = [
  { name: "Ubuntu", version: "22.04 LTS", iconUrl: "https://cdn.simpleicons.org/ubuntu/E95420" },
  { name: "Ubuntu", version: "20.04 LTS", iconUrl: "https://cdn.simpleicons.org/ubuntu/E95420" },
  { name: "Debian", version: "12 Bookworm", iconUrl: "https://cdn.simpleicons.org/debian/A81D33" },
  { name: "CentOS", version: "Stream 9", iconUrl: "https://cdn.simpleicons.org/centos/262577" },
  { name: "AlmaLinux", version: "9", iconUrl: "https://cdn.simpleicons.org/almalinux/ACE3B0" },
  { name: "Windows Server", version: "2022", iconUrl: "https://cdn.simpleicons.org/windows/0078D4" },
  { name: "Windows Server", version: "2019", iconUrl: "https://cdn.simpleicons.org/windows/0078D4" },
  { name: "Rocky Linux", version: "9", iconUrl: "https://cdn.simpleicons.org/rockylinux/10B981" },
];

export default function VpsOsTemplates() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", version: "", iconUrl: "", isActive: true });

  const { data: templates = [], isLoading } = useQuery<OsTemplate[]>({
    queryKey: ["admin-vps-os-templates"],
    queryFn: () => apiFetch("/api/admin/vps-os-templates").then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string | null; data: any }) =>
      apiFetch(id ? `/api/admin/vps-os-templates/${id}` : "/api/admin/vps-os-templates", {
        method: id ? "PUT" : "POST", body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-vps-os-templates"] });
      setShowForm(false); setEditId(null);
      setForm({ name: "", version: "", iconUrl: "", isActive: true });
      toast({ title: editId ? "Updated" : "Added", description: "OS template saved." });
    },
    onError: () => toast({ title: "Error", description: "Could not save template", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/vps-os-templates/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-vps-os-templates"] }); toast({ title: "Deleted" }); },
  });

  function startEdit(t: OsTemplate) {
    setEditId(t.id);
    setForm({ name: t.name, version: t.version, iconUrl: t.iconUrl || "", isActive: t.isActive });
    setShowForm(true);
  }

  function addPreset(p: typeof PRESETS[0]) {
    saveMutation.mutate({ id: null, data: { name: p.name, version: p.version, iconUrl: p.iconUrl, isActive: true } });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => setLocation("/admin/vps")} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft size={18} className="text-gray-600"/>
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${P}15` }}>
            <MonitorCog size={17} style={{ color: P }}/>
          </div>
          <h1 className="text-xl font-bold text-gray-900">OS Templates</h1>
        </div>
        <Button size="sm" onClick={() => { setEditId(null); setForm({ name: "", version: "", iconUrl: "", isActive: true }); setShowForm(true); }}
          className="ml-auto text-white" style={{ background: P }}>
          <Plus size={13} className="mr-1.5"/> Add OS
        </Button>
      </div>

      {/* Preset quick-add */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <p className="text-[12.5px] font-semibold text-gray-600 mb-3">Quick Add Presets</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => {
            const exists = templates.some(t => t.name === p.name && t.version === p.version);
            return (
              <button key={`${p.name}-${p.version}`} onClick={() => !exists && addPreset(p)}
                disabled={exists || saveMutation.isPending}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[12px] font-medium transition-all ${
                  exists ? "border-gray-100 bg-gray-50 text-gray-300 cursor-default" : "border-gray-200 hover:border-purple-400 hover:bg-purple-50 hover:text-purple-700 cursor-pointer"
                }`}>
                <img src={p.iconUrl} alt={p.name} className="w-4 h-4 object-contain"/>
                {p.name} {p.version}
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
            <h3 className="font-semibold text-gray-800">{editId ? "Edit OS Template" : "Add OS Template"}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1.5">OS Name *</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ubuntu"/>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Version *</label>
                <Input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="22.04 LTS"/>
              </div>
              <div className="col-span-2">
                <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Icon URL</label>
                <Input value={form.iconUrl} onChange={e => setForm(f => ({ ...f, iconUrl: e.target.value }))} placeholder="https://..."/>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</Button>
              <Button size="sm" onClick={() => saveMutation.mutate({ id: editId, data: form })}
                disabled={!form.name || !form.version || saveMutation.isPending}
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
        ) : templates.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No OS templates yet. Add one above.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {templates.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                {t.iconUrl ? (
                  <img src={t.iconUrl} alt={t.name} className="w-6 h-6 object-contain"/>
                ) : (
                  <div className="w-6 h-6 rounded bg-gray-200"/>
                )}
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-gray-800">{t.name}</div>
                  <div className="text-[11.5px] text-gray-400">{t.version}</div>
                </div>
                <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${t.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                  {t.isActive ? "Active" : "Off"}
                </span>
                <button onClick={() => startEdit(t)} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <Pencil size={12} className="text-gray-400"/>
                </button>
                <button onClick={() => { if (confirm(`Delete "${t.name} ${t.version}"?`)) deleteMutation.mutate(t.id); }}
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
