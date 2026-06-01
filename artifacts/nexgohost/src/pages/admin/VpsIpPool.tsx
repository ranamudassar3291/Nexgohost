import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  Network, Plus, Trash2, RefreshCw, AlertCircle, Loader2,
  CheckCircle, Server, Globe, MapPin, Wifi, X,
  UploadCloud, ChevronDown, Info, Lock, Unlock,
} from "lucide-react";

const BRAND = "#7C3AED";

const LOCATIONS = [
  "Germany", "United States", "United Kingdom",
  "Netherlands", "Singapore", "France", "Canada", "Australia",
];

interface PoolIp {
  id: number;
  ip_address: string;
  gateway: string | null;
  netmask: string | null;
  dns_servers: string | null;
  display_location: string;
  is_allocated: boolean;
  order_id: number | null;
  notes: string | null;
  created_at: string;
  package_name?: string;
  user_email?: string;
}

interface PoolStats {
  total: string; available: string; allocated: string; locations: string;
}

type Tab = "pool" | "add" | "bulk";

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-5 flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}12` }}>
        <Icon size={19} style={{ color }} />
      </div>
      <div>
        <div className="text-2xl font-black text-gray-900">{value}</div>
        <div className="text-xs text-gray-400 font-medium uppercase tracking-widest">{label}</div>
      </div>
    </div>
  );
}

export default function VpsIpPool() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("pool");
  const [locationFilter, setLocationFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [releaseConfirm, setReleaseConfirm] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Add single IP form
  const [addForm, setAddForm] = useState({ ipAddress: "", gateway: "", netmask: "255.255.255.0", dnsServers: "8.8.8.8,8.8.4.4", displayLocation: "Germany", notes: "" });
  // Bulk add
  const [bulkLines, setBulkLines] = useState("");
  const [bulkLocation, setBulkLocation] = useState("Germany");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const { data, isLoading, refetch } = useQuery<{ ips: PoolIp[]; stats: PoolStats }>({
    queryKey: ["vps-ip-pool"],
    queryFn: () => fetch("/api/admin/vps/ip-pool", { headers }).then(r => r.json()),
    enabled: !!token,
    refetchInterval: 30000,
  });

  const flash = (type: "ok" | "err", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 5000);
  };

  const addMutation = useMutation({
    mutationFn: () => fetch("/api/admin/vps/ip-pool", { method: "POST", headers, body: JSON.stringify({ ...addForm }) }).then(r => r.json()),
    onSuccess: (d) => {
      if (d.error) { flash("err", d.error); return; }
      flash("ok", `IP ${addForm.ipAddress} added to pool.`);
      setAddForm({ ipAddress: "", gateway: "", netmask: "255.255.255.0", dnsServers: "8.8.8.8,8.8.4.4", displayLocation: "Germany", notes: "" });
      qc.invalidateQueries({ queryKey: ["vps-ip-pool"] });
      setTab("pool");
    },
  });

  const bulkMutation = useMutation({
    mutationFn: () => fetch("/api/admin/vps/ip-pool/bulk", { method: "POST", headers, body: JSON.stringify({ lines: bulkLines, defaultLocation: bulkLocation }) }).then(r => r.json()),
    onSuccess: (d) => {
      if (d.error) { flash("err", d.error); return; }
      flash("ok", `Bulk import: ${d.inserted} IPs added, ${d.skipped} skipped (duplicates).`);
      setBulkLines("");
      qc.invalidateQueries({ queryKey: ["vps-ip-pool"] });
      setTab("pool");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/vps/ip-pool/${id}`, { method: "DELETE", headers }).then(r => r.json()),
    onSuccess: (d) => {
      setDeleteConfirm(null);
      if (d.error) { flash("err", d.error); return; }
      flash("ok", "IP removed from pool.");
      qc.invalidateQueries({ queryKey: ["vps-ip-pool"] });
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/vps/ip-pool/${id}/release`, { method: "POST", headers }).then(r => r.json()),
    onSuccess: () => {
      setReleaseConfirm(null);
      flash("ok", "IP released back to pool.");
      qc.invalidateQueries({ queryKey: ["vps-ip-pool"] });
    },
  });

  const ips = data?.ips ?? [];
  const stats = data?.stats;

  const filtered = ips.filter(ip => {
    if (locationFilter && ip.display_location !== locationFilter) return false;
    if (statusFilter === "available" && ip.is_allocated) return false;
    if (statusFilter === "allocated" && !ip.is_allocated) return false;
    return true;
  });

  const locations = [...new Set(ips.map(ip => ip.display_location))].sort();

  return (
    <div className="min-h-screen bg-[#fafafa] p-6">
      <div className="max-w-6xl mx-auto">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-7">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${BRAND}12` }}>
                <Network size={20} style={{ color: BRAND }} />
              </div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">VPS IP Pool Manager</h1>
            </div>
            <p className="text-sm text-gray-500 font-medium ml-13 pl-0.5">
              Dynamic network allocation adapter — manage subnet IPs for all VPS server deployments.
            </p>
          </div>
          <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-100 bg-white text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors shadow-sm">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* ── Flash message ────────────────────────────────────────────────── */}
        {msg && (
          <div className={`mb-5 flex items-center gap-3 px-5 py-3.5 rounded-2xl border text-sm font-medium ${
            msg.type === "ok" ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-red-50 border-red-100 text-red-600"
          }`}>
            {msg.type === "ok" ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            {msg.text}
          </div>
        )}

        {/* ── Stats ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          <StatCard icon={Wifi}    label="Total IPs"  value={stats?.total     ?? "—"} color="#6366F1" />
          <StatCard icon={CheckCircle} label="Available" value={stats?.available ?? "—"} color="#10B981" />
          <StatCard icon={Lock}    label="Allocated"  value={stats?.allocated  ?? "—"} color="#F59E0B" />
          <StatCard icon={Globe}   label="Locations"  value={stats?.locations  ?? "—"} color={BRAND} />
        </div>

        {/* ── Architecture note ───────────────────────────────────────────── */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 flex gap-3 mb-7">
          <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700 font-medium leading-relaxed">
            <strong>How IP allocation works:</strong> When admin activates a VPS order, the engine first tries to assign an IP matching the client's selected location. If that location is exhausted, it falls back to any available IP in the pool. If the pool is empty, the order is created in <code className="bg-blue-100 px-1 rounded text-xs">provisioning</code> state — add IPs here then manually assign via the Orders panel. To plug in Anycast or external subnets in the future, simply import the IPs here with their gateway/netmask — no code changes needed.
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="flex border-b border-gray-100">
            {([
              { id: "pool" as Tab, label: "IP Pool", icon: Network },
              { id: "add" as Tab,  label: "Add IP",  icon: Plus },
              { id: "bulk" as Tab, label: "Bulk Import", icon: UploadCloud },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-black border-b-2 transition-all ${
                  tab === id ? "border-[#7C3AED] text-[#7C3AED] bg-[#7C3AED]/2" : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>

          {/* ── Pool Table Tab ─────────────────────────────────────────────── */}
          {tab === "pool" && (
            <div>
              {/* Filters */}
              <div className="flex flex-wrap gap-3 px-6 py-4 border-b border-gray-50">
                <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-700 focus:outline-none focus:border-[#7C3AED]/30 transition-all"
                >
                  <option value="">All Locations</option>
                  {locations.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-700 focus:outline-none focus:border-[#7C3AED]/30 transition-all"
                >
                  <option value="">All Status</option>
                  <option value="available">Available</option>
                  <option value="allocated">Allocated</option>
                </select>
                <div className="ml-auto text-xs text-gray-400 font-medium flex items-center">
                  {filtered.length} IPs shown
                </div>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
                  <Loader2 size={20} className="animate-spin" style={{ color: BRAND }} />
                  <span className="text-sm font-medium">Loading IP pool…</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-16 text-center">
                  <Network size={36} className="text-gray-200 mx-auto mb-4" />
                  <p className="text-gray-400 font-medium text-sm">No IPs in pool yet.</p>
                  <button onClick={() => setTab("add")} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold" style={{ background: BRAND }}>
                    <Plus size={14} /> Add First IP
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        {["IP Address", "Gateway", "Netmask", "DNS", "Location", "Status", "Assigned To", "Actions"].map(h => (
                          <th key={h} className="text-left px-5 py-3 text-[11px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((ip, i) => (
                        <tr key={ip.id} className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors ${i === filtered.length - 1 ? "border-0" : ""}`}>
                          <td className="px-5 py-3.5">
                            <span className="font-mono text-sm font-black text-gray-900">{ip.ip_address}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="font-mono text-xs text-gray-500">{ip.gateway ?? "—"}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="font-mono text-xs text-gray-500">{ip.netmask ?? "—"}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="font-mono text-xs text-gray-500">{ip.dns_servers ?? "—"}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <MapPin size={11} className="text-gray-300" />
                              <span className="text-sm font-bold text-gray-700">{ip.display_location}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            {ip.is_allocated ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-100 text-amber-700 text-xs font-black">
                                <Lock size={9} /> Allocated
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-black">
                                <CheckCircle size={9} /> Available
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            {ip.order_id ? (
                              <div>
                                <div className="text-xs font-black text-gray-700">Order #{ip.order_id}</div>
                                {ip.user_email && <div className="text-[11px] text-gray-400 font-medium">{ip.user_email}</div>}
                                {ip.package_name && <div className="text-[11px] text-gray-400">{ip.package_name}</div>}
                              </div>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              {ip.is_allocated ? (
                                releaseConfirm === ip.id ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-amber-600 font-bold">Release?</span>
                                    <button onClick={() => releaseMutation.mutate(ip.id)} className="px-2 py-1 rounded-lg bg-amber-500 text-white text-xs font-black hover:bg-amber-600 transition-colors">
                                      {releaseMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : "Yes"}
                                    </button>
                                    <button onClick={() => setReleaseConfirm(null)} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                                      <X size={12} />
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => setReleaseConfirm(ip.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-100 bg-amber-50 text-amber-600 text-xs font-bold hover:bg-amber-100 transition-colors">
                                    <Unlock size={11} /> Release
                                  </button>
                                )
                              ) : (
                                deleteConfirm === ip.id ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-red-500 font-bold">Delete?</span>
                                    <button onClick={() => deleteMutation.mutate(ip.id)} className="px-2 py-1 rounded-lg bg-red-500 text-white text-xs font-black hover:bg-red-600 transition-colors">
                                      {deleteMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : "Yes"}
                                    </button>
                                    <button onClick={() => setDeleteConfirm(null)} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                                      <X size={12} />
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => setDeleteConfirm(ip.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-100 bg-red-50 text-red-500 text-xs font-bold hover:bg-red-100 transition-colors">
                                    <Trash2 size={11} /> Remove
                                  </button>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Add Single IP Tab ──────────────────────────────────────────── */}
          {tab === "add" && (
            <div className="p-8 max-w-lg">
              <h3 className="text-base font-black text-gray-900 mb-6">Add Single IP to Pool</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">IP Address <span className="text-red-400">*</span></label>
                  <input type="text" value={addForm.ipAddress} onChange={e => setAddForm(f => ({ ...f, ipAddress: e.target.value }))}
                    placeholder="e.g. 185.220.101.45"
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-mono font-bold text-gray-800 placeholder-gray-300 focus:outline-none focus:border-[#7C3AED]/40 focus:ring-2 focus:ring-[#7C3AED]/8 transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Gateway</label>
                    <input type="text" value={addForm.gateway} onChange={e => setAddForm(f => ({ ...f, gateway: e.target.value }))}
                      placeholder="e.g. 185.220.101.1"
                      className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-mono font-medium text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#7C3AED]/40 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Netmask</label>
                    <input type="text" value={addForm.netmask} onChange={e => setAddForm(f => ({ ...f, netmask: e.target.value }))}
                      placeholder="255.255.255.0"
                      className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-mono font-medium text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#7C3AED]/40 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">DNS Servers</label>
                  <input type="text" value={addForm.dnsServers} onChange={e => setAddForm(f => ({ ...f, dnsServers: e.target.value }))}
                    placeholder="8.8.8.8,8.8.4.4"
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-mono font-medium text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#7C3AED]/40 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Display Location</label>
                  <select value={addForm.displayLocation} onChange={e => setAddForm(f => ({ ...f, displayLocation: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold text-gray-700 focus:outline-none focus:border-[#7C3AED]/40 transition-all"
                  >
                    {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <p className="text-xs text-gray-400 mt-1.5 font-medium">This is the location shown to clients at checkout. The physical server remains on your parent node.</p>
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Notes (optional)</label>
                  <input type="text" value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="e.g. Anycast, subnet block B, etc."
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#7C3AED]/40 transition-all"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 mt-7">
                <button
                  onClick={() => addMutation.mutate()}
                  disabled={!addForm.ipAddress.trim() || addMutation.isPending}
                  className="flex items-center gap-2 px-7 py-3 rounded-xl text-white text-sm font-black disabled:opacity-40 shadow-[0_4px_14px_rgba(124,58,237,0.3)] transition-all"
                  style={{ background: BRAND }}
                >
                  {addMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Add to Pool
                </button>
                <button onClick={() => setTab("pool")} className="px-5 py-3 rounded-xl border border-gray-100 text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── Bulk Import Tab ────────────────────────────────────────────── */}
          {tab === "bulk" && (
            <div className="p-8 max-w-lg">
              <h3 className="text-base font-black text-gray-900 mb-2">Bulk Import IPs</h3>
              <p className="text-sm text-gray-500 font-medium mb-6">
                Paste one IP per line. Optional format per line: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">ip,gateway,netmask,dns,location</code>
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">IP Lines <span className="text-red-400">*</span></label>
                  <textarea
                    value={bulkLines}
                    onChange={e => setBulkLines(e.target.value)}
                    rows={10}
                    placeholder={`185.220.101.45,185.220.101.1,255.255.255.0,8.8.8.8,Germany
185.220.101.46,185.220.101.1,255.255.255.0,8.8.8.8,Germany
104.21.45.10,104.21.45.1,255.255.255.0,1.1.1.1,United States
2.16.120.30,2.16.120.1,255.255.255.0,8.8.8.8,United Kingdom`}
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-mono text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#7C3AED]/40 resize-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Default Location (for lines without location)</label>
                  <select value={bulkLocation} onChange={e => setBulkLocation(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold text-gray-700 focus:outline-none focus:border-[#7C3AED]/40 transition-all"
                  >
                    {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-7">
                <button
                  onClick={() => bulkMutation.mutate()}
                  disabled={!bulkLines.trim() || bulkMutation.isPending}
                  className="flex items-center gap-2 px-7 py-3 rounded-xl text-white text-sm font-black disabled:opacity-40 shadow-[0_4px_14px_rgba(124,58,237,0.3)] transition-all"
                  style={{ background: BRAND }}
                >
                  {bulkMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                  Import IPs
                </button>
                <button onClick={() => setTab("pool")} className="px-5 py-3 rounded-xl border border-gray-100 text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
