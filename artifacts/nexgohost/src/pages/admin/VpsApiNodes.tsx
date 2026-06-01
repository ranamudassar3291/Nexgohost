import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Server, Plus, Pencil, Trash2, Loader2, CheckCircle,
  AlertCircle, X, Eye, EyeOff, Zap, Globe, Key, Cpu,
} from "lucide-react";

const BRAND = "#7C3AED";

const PROVIDERS = [
  { value: "virtualizor", label: "Virtualizor",  icon: "⚡" },
  { value: "vultr",       label: "Vultr",         icon: "🔵" },
  { value: "hetzner",     label: "Hetzner Cloud", icon: "🔴" },
  { value: "proxmox",     label: "Proxmox VE",    icon: "🟠" },
  { value: "vmware",      label: "VMware vSphere", icon: "🟢" },
  { value: "custom",      label: "Custom API",    icon: "⚙️" },
];

const providerLabel = (v: string) => PROVIDERS.find(p => p.value === v)?.label ?? v;
const providerIcon  = (v: string) => PROVIDERS.find(p => p.value === v)?.icon ?? "🖥";

interface ApiNode {
  id: number;
  name: string;
  provider_type: string;
  api_ip: string;
  api_key: string | null;
  api_pass: string | null;
  api_hash: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

const EMPTY = {
  name: "", provider_type: "virtualizor", api_ip: "",
  api_key: "", api_pass: "", api_hash: "", is_active: true, notes: "",
};

function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token") ?? "";
  return fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  }).then(r => r.json());
}

export default function VpsApiNodes() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ApiNode | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [showKeys, setShowKeys] = useState<Record<number, boolean>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const { data, isLoading } = useQuery<{ nodes: ApiNode[] }>({
    queryKey: ["vps-api-nodes"],
    queryFn: () => apiFetch("/api/admin/vps/api-nodes"),
  });

  const showFlash = (type: "ok" | "err", text: string) => {
    setFlash({ type, text });
    setTimeout(() => setFlash(null), 5000);
  };

  const saveMutation = useMutation({
    mutationFn: () => editing
      ? apiFetch(`/api/admin/vps/api-nodes/${editing.id}`, { method: "PUT", body: JSON.stringify(form) })
      : apiFetch("/api/admin/vps/api-nodes", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: (d) => {
      if (d.error) { showFlash("err", d.error); return; }
      showFlash("ok", editing ? `"${form.name}" updated.` : `"${form.name}" added to API nodes.`);
      qc.invalidateQueries({ queryKey: ["vps-api-nodes"] });
      setShowForm(false); setEditing(null); setForm(EMPTY);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/vps/api-nodes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      showFlash("ok", "Node removed.");
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ["vps-api-nodes"] });
    },
  });

  const openAdd = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (n: ApiNode) => {
    setEditing(n);
    setForm({ name: n.name, provider_type: n.provider_type, api_ip: n.api_ip, api_key: n.api_key ?? "", api_pass: n.api_pass ?? "", api_hash: n.api_hash ?? "", is_active: n.is_active, notes: n.notes ?? "" });
    setShowForm(true);
  };

  const nodes = data?.nodes ?? [];

  return (
    <div className="p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${BRAND}12` }}>
              <Zap size={16} style={{ color: BRAND }} />
            </div>
            VPS API Nodes
          </h2>
          <p className="text-sm text-gray-500 font-medium mt-1 ml-11.5">
            Connect Virtualizor, Vultr, Hetzner, or custom API providers for automated VPS provisioning.
          </p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-black shadow-[0_4px_14px_rgba(124,58,237,0.25)] hover:-translate-y-0.5 transition-all"
          style={{ background: BRAND }}>
          <Plus size={14} /> Add Node
        </button>
      </div>

      {/* Flash */}
      {flash && (
        <div className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border text-sm font-medium ${
          flash.type === "ok" ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-red-50 border-red-100 text-red-600"
        }`}>
          {flash.type === "ok" ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {flash.text}
        </div>
      )}

      {/* Add / Edit Form */}
      {showForm && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_8px_32px_rgba(0,0,0,0.06)] p-7">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-black text-gray-900">
              {editing ? `Edit Node — ${editing.name}` : "Add New API Node"}
            </h3>
            <button onClick={() => { setShowForm(false); setEditing(null); setForm(EMPTY); }}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-400">
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Node Name *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Main Virtualizor Node"
                  className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold text-gray-800 placeholder-gray-300 focus:outline-none focus:border-purple-300 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Provider Type</label>
                <select value={form.provider_type} onChange={e => setForm(f => ({ ...f, provider_type: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold text-gray-700 focus:outline-none focus:border-purple-300 transition-all"
                >
                  {PROVIDERS.map(p => (
                    <option key={p.value} value={p.value}>{p.icon} {p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Master IP / API Endpoint *</label>
              <input type="text" value={form.api_ip} onChange={e => setForm(f => ({ ...f, api_ip: e.target.value }))}
                placeholder="e.g. 192.168.1.100  or  api.hetzner.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-mono font-bold text-gray-800 placeholder-gray-300 focus:outline-none focus:border-purple-300 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">API Key / Access Token</label>
              <input type="password" value={form.api_key} onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                placeholder="••••••••••••••••"
                className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-mono text-gray-700 placeholder-gray-400 focus:outline-none focus:border-purple-300 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">API Password / Secret</label>
              <input type="password" value={form.api_pass} onChange={e => setForm(f => ({ ...f, api_pass: e.target.value }))}
                placeholder="••••••••••••••••"
                className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-mono text-gray-700 placeholder-gray-400 focus:outline-none focus:border-purple-300 transition-all"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">API Hash / Bearer Token (Virtualizor)</label>
              <input type="password" value={form.api_hash} onChange={e => setForm(f => ({ ...f, api_hash: e.target.value }))}
                placeholder="Leave blank if not applicable"
                className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-mono text-gray-700 placeholder-gray-400 focus:outline-none focus:border-purple-300 transition-all"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Notes</label>
              <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Frankfurt node, 128GB RAM, 20i mapped"
                className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-700 placeholder-gray-300 focus:outline-none focus:border-purple-300 transition-all"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#7C3AED]"></div>
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-800">Active</div>
                  <div className="text-xs text-gray-400">Inactive nodes cannot be selected for provisioning.</div>
                </div>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-7 pt-5 border-t border-gray-50">
            <button onClick={() => saveMutation.mutate()}
              disabled={!form.name.trim() || !form.api_ip.trim() || saveMutation.isPending}
              className="flex items-center gap-2 px-7 py-3 rounded-xl text-white text-sm font-black disabled:opacity-40 shadow-[0_4px_14px_rgba(124,58,237,0.3)] transition-all"
              style={{ background: BRAND }}>
              {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              {editing ? "Save Changes" : "Add Node"}
            </button>
            <button onClick={() => { setShowForm(false); setEditing(null); setForm(EMPTY); }}
              className="px-5 py-3 rounded-xl border border-gray-100 text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Nodes List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
          <Loader2 size={20} className="animate-spin" style={{ color: BRAND }} />
          <span className="text-sm font-medium">Loading API nodes…</span>
        </div>
      ) : nodes.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 py-16 text-center">
          <Cpu size={36} className="text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 font-medium text-sm mb-1">No API nodes configured yet.</p>
          <p className="text-gray-300 text-xs mb-5">Add your first Virtualizor or cloud provider to enable automated provisioning.</p>
          <button onClick={openAdd} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-black" style={{ background: BRAND }}>
            <Plus size={14} /> Add First Node
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {nodes.map(node => (
            <div key={node.id} className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  {/* Provider icon */}
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-xl border border-gray-100 bg-gray-50">
                    {providerIcon(node.provider_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-base font-black text-gray-900">{node.name}</span>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full border" style={{
                        background: `${BRAND}10`, color: BRAND, borderColor: `${BRAND}20`
                      }}>{providerLabel(node.provider_type)}</span>
                      {node.is_active ? (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600">● Active</span>
                      ) : (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-50 border border-gray-100 text-gray-400">○ Inactive</span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2.5">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                        <Globe size={11} className="text-gray-300" />
                        <span className="font-mono">{node.api_ip}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                        <Key size={11} className="text-gray-300" />
                        {showKeys[node.id]
                          ? <span className="font-mono">{node.api_key ?? "—"}</span>
                          : <span>API Key: ••••••••</span>
                        }
                        <button onClick={() => setShowKeys(s => ({ ...s, [node.id]: !s[node.id] }))}
                          className="text-gray-300 hover:text-gray-500 transition-colors">
                          {showKeys[node.id] ? <EyeOff size={10} /> : <Eye size={10} />}
                        </button>
                      </div>
                      {node.notes && (
                        <div className="text-xs text-gray-400 font-medium">{node.notes}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => openEdit(node)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-100 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors">
                    <Pencil size={11} /> Edit
                  </button>
                  {deleteId === node.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-red-500 font-bold">Delete?</span>
                      <button onClick={() => deleteMutation.mutate(node.id)}
                        className="px-2 py-1 rounded-lg bg-red-500 text-white text-xs font-black hover:bg-red-600 transition-colors">
                        {deleteMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : "Yes"}
                      </button>
                      <button onClick={() => setDeleteId(null)}
                        className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteId(node.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-100 text-xs font-bold text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 size={11} /> Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
