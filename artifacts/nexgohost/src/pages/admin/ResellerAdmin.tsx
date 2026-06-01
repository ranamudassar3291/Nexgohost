import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle, XCircle, RefreshCw, Loader2, Globe, DollarSign,
  Search, AlertCircle, Users, BarChart3, Key,
  TrendingDown, Save, Plus, Minus, Building2, Edit3,
  Shield, Package, Activity, ChevronDown, Eye, ExternalLink,
  Clock, Ban, Zap, X,
} from "lucide-react";

type AppTab = "applications" | "pricing" | "balance" | "orders";

interface ResellerProfile {
  id: string;
  user_id: string;
  business_name: string;
  monthly_volume: string | null;
  status: string;
  api_key: string | null;
  discount_slab_tier: number;
  created_at: string;
  client_name: string;
  client_email: string;
  balance: string;
}

interface TldPricing {
  id: string; tld: string; retail_price: string; reseller_price: string;
}

function authHeaders() {
  const token = localStorage.getItem("token") || localStorage.getItem("noehost_token");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

const BRAND = "#5B5FEF";

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, { cls: string; label: string }> = {
    active:    { cls: "bg-emerald-50 text-emerald-700 border-emerald-100", label: "Active" },
    pending:   { cls: "bg-amber-50 text-amber-700 border-amber-100", label: "Pending" },
    suspended: { cls: "bg-red-50 text-red-700 border-red-100", label: "Suspended" },
    declined:  { cls: "bg-gray-50 text-gray-500 border-gray-100", label: "Declined" },
  };
  const config = m[status] ?? { cls: "bg-gray-50 text-gray-500 border-gray-100", label: status };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border capitalize ${config.cls}`}>
      {config.label}
    </span>
  );
}

function TierBadge({ tier }: { tier: number }) {
  const labels = ["", "Starter", "Professional", "Enterprise"];
  const colors = ["", "text-sky-700 border-sky-100 bg-sky-50", "text-purple-700 border-purple-100 bg-purple-50", "text-amber-700 border-amber-100 bg-amber-50"];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black border ${colors[tier] ?? "bg-gray-50 text-gray-500 border-gray-100"}`}>
      Tier {tier} — {labels[tier] ?? "Custom"}
    </span>
  );
}

export default function ResellerAdmin() {
  const [tab, setTab] = useState<AppTab>("applications");
  const [profiles, setProfiles] = useState<ResellerProfile[]>([]);
  const [profLoading, setProfLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<ResellerProfile | null>(null);
  const [approveTier, setApproveTier] = useState(1);

  const [pricing, setPricing] = useState<TldPricing[]>([]);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [editedPricing, setEditedPricing] = useState<Record<string, { retail: string; reseller: string }>>({});
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingMsg, setPricingMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [newTld, setNewTld] = useState({ tld: "", retail: "", reseller: "" });
  const [addingTld, setAddingTld] = useState(false);

  const [balEmail, setBalEmail] = useState("");
  const [balAmount, setBalAmount] = useState("");
  const [balType, setBalType] = useState<"credit" | "debit">("credit");
  const [balNotes, setBalNotes] = useState("");
  const [balLoading, setBalLoading] = useState(false);
  const [balMsg, setBalMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [balSearch, setBalSearch] = useState("");

  const fetchProfiles = useCallback(async () => {
    setProfLoading(true);
    try {
      const res = await fetch("/api/admin/resellers", { headers: authHeaders() });
      const data = await res.json();
      if (Array.isArray(data)) setProfiles(data);
    } catch {}
    setProfLoading(false);
  }, []);

  const fetchPricing = useCallback(async () => {
    setPricingLoading(true);
    try {
      const res = await fetch("/api/admin/resellers/pricing", { headers: authHeaders() });
      const data = await res.json();
      if (Array.isArray(data)) {
        setPricing(data);
        const init: typeof editedPricing = {};
        data.forEach((r: TldPricing) => { init[r.tld] = { retail: r.retail_price, reseller: r.reseller_price }; });
        setEditedPricing(init);
      }
    } catch {}
    setPricingLoading(false);
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);
  useEffect(() => { if (tab === "pricing") fetchPricing(); }, [tab, fetchPricing]);

  const approve = async (id: string, tier: number) => {
    setActionLoading(id); setActionMsg("");
    try {
      const res = await fetch(`/api/admin/resellers/${id}/approve`, {
        method: "PUT", headers: authHeaders(), body: JSON.stringify({ discountTier: tier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActionMsg("✓ Application approved. API key issued.");
      setSelectedProfile(null);
      fetchProfiles();
    } catch (err: any) { setActionMsg("✗ " + err.message); }
    setActionLoading(null);
  };

  const decline = async (id: string) => {
    if (!confirm("Decline this application?")) return;
    setActionLoading(id);
    try {
      await fetch(`/api/admin/resellers/${id}/decline`, { method: "PUT", headers: authHeaders() });
      setSelectedProfile(null);
      fetchProfiles();
    } catch {}
    setActionLoading(null);
  };

  const savePricing = async () => {
    setPricingSaving(true); setPricingMsg(null);
    try {
      const items = pricing.map(row => ({
        tld: row.tld,
        retailPrice: parseFloat(editedPricing[row.tld]?.retail ?? row.retail_price),
        resellerPrice: parseFloat(editedPricing[row.tld]?.reseller ?? row.reseller_price),
      }));
      const res = await fetch("/api/admin/resellers/pricing", { method: "PUT", headers: authHeaders(), body: JSON.stringify(items) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPricingMsg({ text: `${data.updated} pricing entries updated successfully.`, ok: true });
      fetchPricing();
    } catch (err: any) { setPricingMsg({ text: err.message, ok: false }); }
    setPricingSaving(false);
  };

  const adjustBalance = async () => {
    if (!balEmail || !balAmount) { setBalMsg({ text: "Email and amount are required.", ok: false }); return; }
    setBalLoading(true); setBalMsg(null);
    try {
      const res = await fetch("/api/admin/resellers/balance-adjust", {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ email: balEmail, amount: parseFloat(balAmount), type: balType, notes: balNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBalMsg({ text: `Balance updated. New balance: Rs. ${parseFloat(data.newBalance).toLocaleString()}`, ok: true });
      setBalEmail(""); setBalAmount(""); setBalNotes(""); fetchProfiles();
    } catch (err: any) { setBalMsg({ text: err.message, ok: false }); }
    setBalLoading(false);
  };

  const quickSetBalance = (profile: ResellerProfile) => {
    setBalEmail(profile.client_email);
    setTab("balance");
  };

  const filteredProfiles = profiles.filter(p => {
    const matchSearch = !search || p.business_name.toLowerCase().includes(search.toLowerCase()) || p.client_email.toLowerCase().includes(search.toLowerCase()) || p.client_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const fmt = (v: string | number) => {
    const n = parseFloat(String(v));
    return isNaN(n) ? "—" : `Rs. ${n.toLocaleString("en-PK", { minimumFractionDigits: 0 })}`;
  };

  const savings = (retail: string, reseller: string) => {
    const r = parseFloat(retail), p = parseFloat(reseller);
    if (!r || !p) return "0";
    return Math.round(((r - p) / r) * 100).toString();
  };

  const stats = {
    total: profiles.length,
    active: profiles.filter(p => p.status === "active").length,
    pending: profiles.filter(p => p.status === "pending").length,
    suspended: profiles.filter(p => p.status === "suspended").length,
    totalBalance: profiles.reduce((s, p) => s + parseFloat(p.balance || "0"), 0),
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 mb-1">Domain Reseller Management</h1>
          <p className="text-sm text-gray-500 font-medium">Manage reseller applications, TLD pricing, and account balances</p>
        </div>
        <button onClick={fetchProfiles} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">
          <RefreshCw size={14} className={profLoading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* ── Stats ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: "Total Resellers", value: stats.total, icon: Users, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Active", value: stats.active, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Pending Review", value: stats.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Suspended", value: stats.suspended, icon: Ban, color: "text-red-500", bg: "bg-red-50" },
          { label: "Total Balances", value: fmt(stats.totalBalance), icon: DollarSign, color: "text-purple-600", bg: "bg-purple-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest leading-tight">{label}</p>
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon size={15} className={color} />
              </div>
            </div>
            <div className={`text-xl font-black ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl w-fit mb-7">
        {([
          { id: "applications", label: "Applications", icon: Building2 },
          { id: "pricing",      label: "TLD Pricing",   icon: TrendingDown },
          { id: "balance",      label: "Balance Ops",   icon: DollarSign },
        ] as { id: AppTab; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              tab === id ? "bg-white shadow-sm border border-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon size={14} style={tab === id ? { color: BRAND } : {}} />
            {label}
            {id === "applications" && stats.pending > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs font-black">{stats.pending}</span>
            )}
          </button>
        ))}
      </div>

      {actionMsg && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium border flex items-center gap-2 ${
          actionMsg.startsWith("✓") ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
        }`}>
          {actionMsg.startsWith("✓") ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {actionMsg}
          <button onClick={() => setActionMsg("")} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* ── Tab: Applications ────────────────────────────────────────────────── */}
      {tab === "applications" && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Search + filter bar */}
          <div className="px-6 py-4 border-b border-gray-50 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                type="text"
                placeholder="Search by name or email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-700 placeholder-gray-300 focus:outline-none focus:border-indigo-200 transition-all"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {["all", "pending", "active", "suspended"].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all border ${
                    statusFilter === s ? "text-white border-transparent" : "bg-gray-50 text-gray-600 border-gray-100 hover:border-gray-200"
                  }`}
                  style={statusFilter === s ? { background: BRAND, borderColor: BRAND } : {}}
                >
                  {s === "all" ? `All (${profiles.length})` : `${s} (${profiles.filter(p => p.status === s).length})`}
                </button>
              ))}
            </div>
          </div>

          {profLoading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
              <Loader2 size={20} className="animate-spin" style={{ color: BRAND }} />
              <span className="text-sm font-medium">Loading resellers…</span>
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Users size={32} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium">No resellers found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {["Business", "Contact", "Tier", "Balance", "Volume", "Status", "Applied", "Actions"].map(h => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-black text-gray-400 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredProfiles.map((p, i) => (
                    <tr key={p.id} className={`hover:bg-gray-50/50 transition-colors ${i < filteredProfiles.length - 1 ? "border-b border-gray-50" : ""}`}>
                      <td className="px-5 py-4">
                        <div className="font-black text-gray-900 text-sm">{p.business_name}</div>
                        <div className="text-xs text-gray-400 font-medium mt-0.5 flex items-center gap-1">
                          <Key size={9} />{p.api_key ? "Key issued" : "No key"}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm font-bold text-gray-700">{p.client_name}</div>
                        <div className="text-xs text-gray-400 font-medium">{p.client_email}</div>
                      </td>
                      <td className="px-5 py-4">
                        <TierBadge tier={p.discount_slab_tier} />
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm font-black text-gray-900">{fmt(p.balance)}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs font-medium text-gray-500 bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">
                          {p.monthly_volume || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-4"><StatusBadge status={p.status} /></td>
                      <td className="px-5 py-4 text-xs text-gray-400 font-medium whitespace-nowrap">
                        {new Date(p.created_at).toLocaleDateString("en-PK")}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => { setSelectedProfile(p); setApproveTier(p.discount_slab_tier || 1); }}
                            className="px-2.5 py-1.5 rounded-lg border border-gray-100 text-xs font-bold text-gray-600 hover:border-indigo-200 hover:text-indigo-600 transition-all flex items-center gap-1"
                          >
                            <Eye size={10} /> View
                          </button>
                          {p.status === "pending" && (
                            <button
                              onClick={() => approve(p.id, p.discount_slab_tier || 1)}
                              disabled={actionLoading === p.id}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-all flex items-center gap-1 disabled:opacity-50"
                            >
                              {actionLoading === p.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                              Approve
                            </button>
                          )}
                          <button
                            onClick={() => quickSetBalance(p)}
                            className="px-2.5 py-1.5 rounded-lg border border-gray-100 text-xs font-bold text-gray-600 hover:border-purple-200 hover:text-purple-600 transition-all flex items-center gap-1"
                          >
                            <DollarSign size={10} /> Fund
                          </button>
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

      {/* ── Tab: Pricing ─────────────────────────────────────────────────────── */}
      {tab === "pricing" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-gray-900">TLD Pricing Configuration</h3>
                <p className="text-xs text-gray-400 font-medium mt-0.5">Edit retail and reseller prices for all domain extensions</p>
              </div>
              <button
                onClick={savePricing}
                disabled={pricingSaving}
                className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 shadow-sm"
                style={{ background: BRAND }}
              >
                {pricingSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {pricingSaving ? "Saving…" : "Save All Changes"}
              </button>
            </div>

            {pricingMsg && (
              <div className={`mx-6 mt-4 px-4 py-3 rounded-xl text-sm font-medium border flex items-center gap-2 ${
                pricingMsg.ok ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
              }`}>
                {pricingMsg.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                {pricingMsg.text}
              </div>
            )}

            {pricingLoading ? (
              <div className="flex items-center justify-center py-14 gap-3 text-gray-400">
                <Loader2 size={18} className="animate-spin" style={{ color: BRAND }} />
                <span className="text-sm">Loading pricing…</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-6 bg-gray-50 border-b border-gray-100 px-6 py-3">
                  {["Extension", "Register Price (PKR)", "Reseller Price (PKR)", "Savings %", "Margin", ""].map(h => (
                    <div key={h} className="text-xs font-black text-gray-400 uppercase tracking-widest">{h}</div>
                  ))}
                </div>
                {pricing.map((row, i) => {
                  const edited = editedPricing[row.tld] ?? { retail: row.retail_price, reseller: row.reseller_price };
                  const pct = savings(edited.retail, edited.reseller);
                  const margin = parseFloat(edited.retail) - parseFloat(edited.reseller);
                  return (
                    <div key={row.id} className={`grid grid-cols-6 items-center px-6 py-3.5 hover:bg-gray-50/50 transition-colors ${i < pricing.length - 1 ? "border-b border-gray-50" : ""}`}>
                      <div className="font-black text-gray-900 text-sm">{row.tld}</div>
                      <div>
                        <input
                          type="number"
                          value={edited.retail}
                          onChange={e => setEditedPricing(prev => ({ ...prev, [row.tld]: { ...prev[row.tld], retail: e.target.value } }))}
                          className="w-full px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-700 focus:outline-none focus:border-indigo-200 transition-all max-w-[120px]"
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          value={edited.reseller}
                          onChange={e => setEditedPricing(prev => ({ ...prev, [row.tld]: { ...prev[row.tld], reseller: e.target.value } }))}
                          className="w-full px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-700 focus:outline-none focus:border-emerald-200 transition-all max-w-[120px]"
                        />
                      </div>
                      <div>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black border ${
                          parseInt(pct) > 20 ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                          parseInt(pct) > 10 ? "bg-sky-50 text-sky-700 border-sky-100" :
                          "bg-gray-50 text-gray-500 border-gray-100"
                        }`}>
                          <TrendingDown size={9} /> {pct}% off
                        </span>
                      </div>
                      <div className="text-sm font-bold" style={{ color: isNaN(margin) || margin < 0 ? "#ef4444" : "#059669" }}>
                        Rs. {isNaN(margin) ? "—" : Math.round(margin).toLocaleString()}
                      </div>
                      <div>
                        <button
                          onClick={() => setEditedPricing(prev => ({ ...prev, [row.tld]: { retail: row.retail_price, reseller: row.reseller_price } }))}
                          className="text-xs text-gray-400 hover:text-gray-600 transition-colors font-medium underline underline-offset-2"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Add new TLD */}
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
            <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest mb-5">Add New TLD Extension</h3>
            <div className="flex gap-4 items-end flex-wrap">
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Extension</label>
                <input type="text" value={newTld.tld} onChange={e => setNewTld(n => ({ ...n, tld: e.target.value }))}
                  placeholder=".store" className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-mono text-gray-700 placeholder-gray-300 focus:outline-none focus:border-indigo-200 transition-all" />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Retail Price (PKR)</label>
                <input type="number" value={newTld.retail} onChange={e => setNewTld(n => ({ ...n, retail: e.target.value }))}
                  placeholder="2500" className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-indigo-200 transition-all" />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Reseller Price (PKR)</label>
                <input type="number" value={newTld.reseller} onChange={e => setNewTld(n => ({ ...n, reseller: e.target.value }))}
                  placeholder="2000" className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-indigo-200 transition-all" />
              </div>
              <button
                onClick={async () => {
                  if (!newTld.tld || !newTld.retail || !newTld.reseller) return;
                  setAddingTld(true);
                  const tld = newTld.tld.startsWith(".") ? newTld.tld : "." + newTld.tld;
                  try {
                    const items = [...pricing.map(r => ({
                      tld: r.tld,
                      retailPrice: parseFloat(editedPricing[r.tld]?.retail ?? r.retail_price),
                      resellerPrice: parseFloat(editedPricing[r.tld]?.reseller ?? r.reseller_price),
                    })), { tld, retailPrice: parseFloat(newTld.retail), resellerPrice: parseFloat(newTld.reseller) }];
                    const res = await fetch("/api/admin/resellers/pricing", { method: "PUT", headers: authHeaders(), body: JSON.stringify(items) });
                    if (res.ok) { setNewTld({ tld: "", retail: "", reseller: "" }); fetchPricing(); setPricingMsg({ text: `TLD ${tld} added.`, ok: true }); }
                  } catch {}
                  setAddingTld(false);
                }}
                disabled={addingTld || !newTld.tld || !newTld.retail || !newTld.reseller}
                className="px-5 py-3 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                style={{ background: BRAND }}
              >
                {addingTld ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Add TLD
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Balance Ops ─────────────────────────────────────────────────── */}
      {tab === "balance" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Adjust form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
              <h3 className="text-base font-black text-gray-900 mb-1">Adjust Reseller Balance</h3>
              <p className="text-xs text-gray-400 font-medium mb-6">Manually credit or debit a reseller's wallet</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Reseller Email <span className="text-red-400">*</span></label>
                  <input type="email" value={balEmail} onChange={e => setBalEmail(e.target.value)}
                    placeholder="reseller@company.com"
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-700 placeholder-gray-300 focus:outline-none focus:border-indigo-200 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Amount (PKR) <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">Rs.</span>
                    <input type="number" value={balAmount} onChange={e => setBalAmount(e.target.value)}
                      placeholder="5000"
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-700 placeholder-gray-300 focus:outline-none focus:border-indigo-200 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Operation Type</label>
                  <div className="flex gap-3">
                    <button onClick={() => setBalType("credit")} className={`flex-1 py-2.5 rounded-xl border text-sm font-bold transition-all flex items-center justify-center gap-2 ${balType === "credit" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-gray-50 border-gray-100 text-gray-600 hover:border-emerald-100"}`}>
                      <Plus size={14} /> Credit
                    </button>
                    <button onClick={() => setBalType("debit")} className={`flex-1 py-2.5 rounded-xl border text-sm font-bold transition-all flex items-center justify-center gap-2 ${balType === "debit" ? "bg-red-50 border-red-200 text-red-700" : "bg-gray-50 border-gray-100 text-gray-600 hover:border-red-100"}`}>
                      <Minus size={14} /> Debit
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Notes</label>
                  <input type="text" value={balNotes} onChange={e => setBalNotes(e.target.value)}
                    placeholder="e.g. Manual top-up per request"
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-700 placeholder-gray-300 focus:outline-none focus:border-indigo-200 transition-all" />
                </div>

                {balMsg && (
                  <div className={`px-4 py-3 rounded-xl text-sm font-medium border flex items-center gap-2 ${balMsg.ok ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"}`}>
                    {balMsg.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                    {balMsg.text}
                  </div>
                )}

                <button onClick={adjustBalance} disabled={balLoading || !balEmail || !balAmount}
                  className="w-full py-3.5 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                  style={{ background: BRAND }}>
                  {balLoading ? <Loader2 size={14} className="animate-spin" /> : <DollarSign size={14} />}
                  {balLoading ? "Processing…" : `${balType === "credit" ? "Add Credit" : "Deduct Balance"}`}
                </button>
              </div>
            </div>
          </div>

          {/* Reseller list with balances */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden h-full">
              <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-3">
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input type="text" placeholder="Filter resellers…" value={balSearch} onChange={e => setBalSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-700 placeholder-gray-300 focus:outline-none focus:border-indigo-200 transition-all" />
                </div>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: "520px" }}>
                {profiles.filter(p => p.status === "active" && (!balSearch || p.business_name.toLowerCase().includes(balSearch.toLowerCase()) || p.client_email.toLowerCase().includes(balSearch.toLowerCase()))).map((p, i, arr) => (
                  <div key={p.id} className={`flex items-center px-6 py-4 hover:bg-gray-50/50 transition-colors cursor-pointer ${i < arr.length - 1 ? "border-b border-gray-50" : ""}`} onClick={() => { setBalEmail(p.client_email); }}>
                    <div className="flex-1">
                      <div className="font-black text-gray-900 text-sm">{p.business_name}</div>
                      <div className="text-xs text-gray-400 font-medium">{p.client_email}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-gray-900">{fmt(p.balance)}</div>
                      <TierBadge tier={p.discount_slab_tier} />
                    </div>
                    <button onClick={e => { e.stopPropagation(); setBalEmail(p.client_email); setBalType("credit"); }}
                      className="ml-4 p-2 rounded-xl hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors" title="Quick credit">
                      <Plus size={14} />
                    </button>
                  </div>
                ))}
                {profiles.filter(p => p.status === "active").length === 0 && (
                  <div className="text-center py-12 text-gray-400 text-sm font-medium">No active resellers.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Modal ─────────────────────────────────────────────────────── */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-8 py-6 border-b border-gray-50">
              <h3 className="text-lg font-black text-gray-900">Reseller Details</h3>
              <button onClick={() => { setSelectedProfile(null); setActionMsg(""); }} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="px-8 py-6 space-y-4">
              {[
                { label: "Business Name", value: selectedProfile.business_name },
                { label: "Contact Name", value: selectedProfile.client_name },
                { label: "Email", value: selectedProfile.client_email },
                { label: "Monthly Volume", value: selectedProfile.monthly_volume || "Not specified" },
                { label: "Applied On", value: new Date(selectedProfile.created_at).toLocaleDateString("en-PK") },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-500 font-medium">{label}</span>
                  <span className="text-sm font-bold text-gray-800">{value}</span>
                </div>
              ))}
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500 font-medium">Status</span>
                <StatusBadge status={selectedProfile.status} />
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500 font-medium">Balance</span>
                <span className="text-sm font-black text-gray-900">{fmt(selectedProfile.balance)}</span>
              </div>
              {selectedProfile.status === "pending" && (
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Approve with Tier</label>
                  <div className="flex gap-2">
                    {[1, 2, 3].map(t => (
                      <button key={t} onClick={() => setApproveTier(t)}
                        className={`flex-1 py-2.5 rounded-xl border text-sm font-bold transition-all ${approveTier === t ? "text-white border-transparent" : "bg-gray-50 border-gray-100 text-gray-600"}`}
                        style={approveTier === t ? { background: BRAND } : {}}>
                        Tier {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-8 py-5 border-t border-gray-50 flex gap-3">
              {selectedProfile.status === "pending" && (
                <>
                  <button onClick={() => approve(selectedProfile.id, approveTier)} disabled={actionLoading === selectedProfile.id}
                    className="flex-1 py-3 rounded-xl text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: "#059669" }}>
                    {actionLoading === selectedProfile.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                    Approve — Tier {approveTier}
                  </button>
                  <button onClick={() => decline(selectedProfile.id)} disabled={actionLoading === selectedProfile.id}
                    className="flex-1 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                    <XCircle size={14} /> Decline
                  </button>
                </>
              )}
              {selectedProfile.status === "active" && (
                <button onClick={() => decline(selectedProfile.id)} disabled={actionLoading === selectedProfile.id}
                  className="flex-1 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                  <Ban size={14} /> Suspend Account
                </button>
              )}
              {selectedProfile.status === "suspended" && (
                <button onClick={() => approve(selectedProfile.id, selectedProfile.discount_slab_tier)} disabled={actionLoading === selectedProfile.id}
                  className="flex-1 py-3 rounded-xl text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: BRAND }}>
                  <Zap size={14} /> Reactivate
                </button>
              )}
              <button onClick={() => { setSelectedProfile(null); setActionMsg(""); }} className="px-6 py-3 rounded-xl border border-gray-100 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
