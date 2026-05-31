import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle, XCircle, RefreshCw, Loader2, Globe, DollarSign,
  Search, ChevronDown, AlertCircle, Users, BarChart3, Key,
  TrendingDown, Edit3, Save, X, Plus, Minus, Building2
} from "lucide-react";

type AppTab = "applications" | "pricing" | "balance";

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
  id: string;
  tld: string;
  retail_price: string;
  reseller_price: string;
}

function authHeaders() {
  const token = localStorage.getItem("token") || localStorage.getItem("noehost_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function statusBadge(status: string) {
  const m: Record<string, string> = {
    active:    "bg-emerald-50 text-emerald-700 border-emerald-100",
    pending:   "bg-amber-50 text-amber-700 border-amber-100",
    suspended: "bg-red-50 text-red-700 border-red-100",
  };
  return m[status] ?? "bg-gray-50 text-gray-600 border-gray-100";
}

export default function ResellerAdmin() {
  const [tab, setTab] = useState<AppTab>("applications");
  const [profiles, setProfiles] = useState<ResellerProfile[]>([]);
  const [profLoading, setProfLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState("");

  const [pricing, setPricing] = useState<TldPricing[]>([]);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [editedPricing, setEditedPricing] = useState<Record<string, { retail: string; reseller: string }>>({});
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingMsg, setPricingMsg] = useState("");

  const [balEmail, setBalEmail] = useState("");
  const [balAmount, setBalAmount] = useState("");
  const [balType, setBalType] = useState<"credit" | "debit">("credit");
  const [balNotes, setBalNotes] = useState("");
  const [balLoading, setBalLoading] = useState(false);
  const [balMsg, setBalMsg] = useState("");

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
        data.forEach((r: TldPricing) => {
          init[r.tld] = { retail: r.retail_price, reseller: r.reseller_price };
        });
        setEditedPricing(init);
      }
    } catch {}
    setPricingLoading(false);
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);
  useEffect(() => { if (tab === "pricing") fetchPricing(); }, [tab, fetchPricing]);

  const approve = async (id: string, tier: number) => {
    setActionLoading(id);
    setActionMsg("");
    try {
      const res = await fetch(`/api/admin/resellers/${id}/approve`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ discountTier: tier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActionMsg("✓ Application approved. API key issued.");
      fetchProfiles();
    } catch (err: any) {
      setActionMsg("✗ " + err.message);
    }
    setActionLoading(null);
  };

  const decline = async (id: string) => {
    if (!confirm("Decline this application?")) return;
    setActionLoading(id);
    try {
      await fetch(`/api/admin/resellers/${id}/decline`, { method: "PUT", headers: authHeaders() });
      fetchProfiles();
    } catch {}
    setActionLoading(null);
  };

  const savePricing = async () => {
    setPricingSaving(true);
    setPricingMsg("");
    try {
      const items = pricing.map(row => ({
        tld: row.tld,
        retailPrice: parseFloat(editedPricing[row.tld]?.retail ?? row.retail_price),
        resellerPrice: parseFloat(editedPricing[row.tld]?.reseller ?? row.reseller_price),
      }));
      const res = await fetch("/api/admin/resellers/pricing", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(items),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPricingMsg(`✓ ${data.updated} pricing entries updated.`);
      fetchPricing();
    } catch (err: any) {
      setPricingMsg("✗ " + err.message);
    }
    setPricingSaving(false);
  };

  const adjustBalance = async () => {
    if (!balEmail || !balAmount) {
      setBalMsg("✗ Email and amount are required.");
      return;
    }
    setBalLoading(true);
    setBalMsg("");
    try {
      const res = await fetch("/api/admin/resellers/balance-adjust", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ email: balEmail, amount: parseFloat(balAmount), type: balType, notes: balNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBalMsg(`✓ Balance updated. New balance: $${parseFloat(data.newBalance).toFixed(2)}`);
      setBalEmail(""); setBalAmount(""); setBalNotes(""); fetchProfiles();
    } catch (err: any) {
      setBalMsg("✗ " + err.message);
    }
    setBalLoading(false);
  };

  const filteredProfiles = profiles.filter(p => {
    const matchSearch = !search || p.business_name.toLowerCase().includes(search.toLowerCase()) || p.client_email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: profiles.length,
    active: profiles.filter(p => p.status === "active").length,
    pending: profiles.filter(p => p.status === "pending").length,
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-gray-900 mb-1">Domain Reseller Administration</h1>
        <p className="text-sm text-gray-500 font-medium">Manage applications, pricing, and reseller accounts</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total Resellers", value: stats.total, icon: Users, color: "text-gray-900" },
          { label: "Active Accounts", value: stats.active, icon: CheckCircle, color: "text-emerald-600" },
          { label: "Pending Review", value: stats.pending, icon: AlertCircle, color: "text-amber-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{label}</p>
              <Icon size={16} className={color} />
            </div>
            <div className={`text-3xl font-black ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl w-fit mb-7">
        {([
          { id: "applications", label: "Applications Pipeline", icon: Building2 },
          { id: "pricing",      label: "TLD Pricing Config",   icon: TrendingDown },
          { id: "balance",      label: "Balance Override",      icon: DollarSign },
        ] as { id: AppTab; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              tab === id
                ? "bg-white text-[#7C3AED] shadow-sm border border-gray-100"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Applications Pipeline ─────────────────────────────────────────────── */}
      {tab === "applications" && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)] overflow-hidden">
          {/* Toolbar */}
          <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by business or email…"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#7C3AED]/40 transition-all"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-700 focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
            <button onClick={fetchProfiles} className="p-2.5 rounded-xl hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>

          {actionMsg && (
            <div className={`px-6 py-3 text-sm font-medium border-b ${
              actionMsg.startsWith("✓") ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
            }`}>
              {actionMsg}
            </div>
          )}

          {profLoading ? (
            <div className="flex items-center justify-center py-14 gap-3 text-gray-400">
              <Loader2 size={18} className="animate-spin text-[#7C3AED]" />
              <span className="text-sm font-medium">Loading resellers…</span>
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Users size={32} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium">No reseller applications found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-50">
                    {["Business", "Client", "Volume", "Tier", "Balance", "Status", "Applied", "Actions"].map(h => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredProfiles.map((p, i) => (
                    <tr key={p.id} className={`hover:bg-[#7C3AED]/[0.02] transition-colors ${i < filteredProfiles.length - 1 ? "border-b border-gray-50" : ""}`}>
                      <td className="px-5 py-4 font-black text-gray-800 text-sm">{p.business_name}</td>
                      <td className="px-5 py-4">
                        <div className="text-sm font-medium text-gray-700">{p.client_name}</div>
                        <div className="text-xs text-gray-400">{p.client_email}</div>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-500 font-medium">{p.monthly_volume || "—"}</td>
                      <td className="px-5 py-4 text-sm font-bold text-gray-700">T{p.discount_slab_tier}</td>
                      <td className="px-5 py-4 text-sm font-black text-gray-800">${parseFloat(p.balance).toFixed(2)}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black border capitalize ${statusBadge(p.status)}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-400 whitespace-nowrap">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        {p.status === "pending" ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => approve(p.id, p.discount_slab_tier)}
                              disabled={actionLoading === p.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-black hover:bg-emerald-100 transition-colors disabled:opacity-50"
                            >
                              {actionLoading === p.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                              Approve
                            </button>
                            <button
                              onClick={() => decline(p.id)}
                              disabled={actionLoading === p.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs font-black hover:bg-red-100 transition-colors disabled:opacity-50"
                            >
                              <XCircle size={11} />
                              Decline
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 font-medium">
                            {p.status === "active" ? "—" : (
                              <button
                                onClick={() => approve(p.id, p.discount_slab_tier)}
                                disabled={actionLoading === p.id}
                                className="text-[#7C3AED] hover:underline text-xs font-bold"
                              >
                                Reactivate
                              </button>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TLD Pricing Configurator ──────────────────────────────────────────── */}
      {tab === "pricing" && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)] overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest">
              Global TLD Base Price Configurator
            </h3>
            <button
              onClick={savePricing}
              disabled={pricingSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all"
            >
              {pricingSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save All Changes
            </button>
          </div>

          {pricingMsg && (
            <div className={`px-6 py-3 text-sm font-medium border-b ${
              pricingMsg.startsWith("✓") ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
            }`}>
              {pricingMsg}
            </div>
          )}

          {pricingLoading ? (
            <div className="flex items-center justify-center py-14 gap-3 text-gray-400">
              <Loader2 size={18} className="animate-spin text-[#7C3AED]" />
              <span className="text-sm font-medium">Loading pricing…</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 bg-gray-50 border-b border-gray-50 px-6 py-3.5">
                {["Extension", "Standard Retail ($/yr)", "Reseller Price ($/yr)", "You Save %"].map(h => (
                  <div key={h} className="text-xs font-black text-gray-400 uppercase tracking-widest">{h}</div>
                ))}
              </div>
              {pricing.map((row, i) => {
                const edited = editedPricing[row.tld] ?? { retail: row.retail_price, reseller: row.reseller_price };
                const retail = parseFloat(edited.retail) || 0;
                const reseller = parseFloat(edited.reseller) || 0;
                const saved = retail > 0 ? Math.round(((retail - reseller) / retail) * 100) : 0;
                return (
                  <div key={row.id} className={`grid grid-cols-4 items-center px-6 py-4 hover:bg-[#7C3AED]/[0.02] transition-colors ${i < pricing.length - 1 ? "border-b border-gray-50" : ""}`}>
                    <div className="font-black text-gray-800 text-sm">{row.tld}</div>
                    <div className="pr-4">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-300 font-bold">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={edited.retail}
                          onChange={e => setEditedPricing(p => ({ ...p, [row.tld]: { ...edited, retail: e.target.value } }))}
                          className="w-full pl-6 pr-3 py-2 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-700 focus:outline-none focus:border-[#7C3AED]/40 transition-all"
                        />
                      </div>
                    </div>
                    <div className="pr-4">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-300 font-bold">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={edited.reseller}
                          onChange={e => setEditedPricing(p => ({ ...p, [row.tld]: { ...edited, reseller: e.target.value } }))}
                          className="w-full pl-6 pr-3 py-2 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-700 focus:outline-none focus:border-[#7C3AED]/40 transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black border ${saved > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-gray-50 text-gray-400 border-gray-100"}`}>
                        <TrendingDown size={10} />
                        {saved}% off
                      </span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* ── Balance Override ──────────────────────────────────────────────────── */}
      {tab === "balance" && (
        <div className="max-w-lg">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)] p-8">
            <div className="flex items-center gap-3 mb-7">
              <div className="w-10 h-10 rounded-xl bg-[#7C3AED]/8 flex items-center justify-center">
                <DollarSign size={18} className="text-[#7C3AED]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-gray-800">Account Balance Override</h3>
                <p className="text-xs text-gray-400 font-medium">Manually adjust any reseller's funds balance</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
                  Reseller Email Address
                </label>
                <input
                  type="email"
                  value={balEmail}
                  onChange={e => setBalEmail(e.target.value)}
                  placeholder="reseller@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#7C3AED]/40 focus:ring-2 focus:ring-[#7C3AED]/8 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
                    Amount (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 font-bold text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={balAmount}
                      onChange={e => setBalAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#7C3AED]/40 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
                    Operation
                  </label>
                  <div className="flex rounded-xl border border-gray-100 overflow-hidden">
                    <button
                      onClick={() => setBalType("credit")}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-black transition-all ${balType === "credit" ? "bg-[#7C3AED] text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}
                    >
                      <Plus size={12} /> Credit
                    </button>
                    <button
                      onClick={() => setBalType("debit")}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-black border-l border-gray-100 transition-all ${balType === "debit" ? "bg-red-500 text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}
                    >
                      <Minus size={12} /> Debit
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
                  Internal Notes (optional)
                </label>
                <input
                  type="text"
                  value={balNotes}
                  onChange={e => setBalNotes(e.target.value)}
                  placeholder="e.g. Manual correction for failed renewal"
                  className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#7C3AED]/40 transition-all"
                />
              </div>

              {balMsg && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border ${
                  balMsg.startsWith("✓") ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
                }`}>
                  {balMsg.startsWith("✓") ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                  {balMsg}
                </div>
              )}

              <button
                onClick={adjustBalance}
                disabled={balLoading}
                className="w-full py-3.5 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
              >
                {balLoading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                {balLoading ? "Processing…" : "Apply Balance Adjustment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
