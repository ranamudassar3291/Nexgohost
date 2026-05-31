import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import {
  Globe, CreditCard, Key, Copy, RefreshCw, CheckCircle, AlertCircle,
  Loader2, ArrowRight, TrendingDown, Clock, RotateCcw, Network,
  Eye, EyeOff, Plus, DollarSign, Activity, Building2, ChevronRight,
  AlertTriangle, Terminal, Code2, FileCode2
} from "lucide-react";

type Tab = "balance" | "orders" | "api";

interface Profile {
  id: string;
  business_name: string;
  status: string;
  api_key: string | null;
  discount_slab_tier: number;
  balance: string;
  currency: string;
}

interface Order {
  id: string;
  domain_name: string;
  tld: string;
  action_type: string;
  cost: string;
  status: string;
  nameservers: string | null;
  created_at: string;
}

function authHeaders() {
  const token = localStorage.getItem("token") || localStorage.getItem("noehost_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    completed:  "bg-emerald-50 text-emerald-700 border-emerald-100",
    processing: "bg-amber-50 text-amber-700 border-amber-100",
    failed:     "bg-red-50 text-red-700 border-red-100",
  };
  return map[status] ?? "bg-gray-50 text-gray-600 border-gray-100";
}

export default function ResellerDashboard() {
  const [tab, setTab] = useState<Tab>("balance");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupMsg, setTopupMsg] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyRegenLoading, setKeyRegenLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [eppModal, setEppModal] = useState<{ id: string; code?: string } | null>(null);
  const [nsModal, setNsModal] = useState<{ id: string; ns: string[] } | null>(null);
  const [renewLoading, setRenewLoading] = useState<string | null>(null);
  const [renewMsg, setRenewMsg] = useState("");

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/my/reseller/profile", { headers: authHeaders() });
      const data = await res.json();
      setProfile(data.profile ?? null);
    } catch {}
    setLoading(false);
  }, []);

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await fetch("/api/my/reseller/orders", { headers: authHeaders() });
      const data = await res.json();
      if (Array.isArray(data)) setOrders(data);
    } catch {}
    setOrdersLoading(false);
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);
  useEffect(() => { if (tab === "orders") fetchOrders(); }, [tab, fetchOrders]);

  const doTopup = async (amt: number) => {
    setTopupLoading(true);
    setTopupMsg("");
    try {
      const res = await fetch("/api/my/reseller/funds/topup", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setTopupMsg(`✓ $${amt.toFixed(2)} credited. New balance: $${parseFloat(data.balance).toFixed(2)}`);
      fetchProfile();
    } catch (err: any) {
      setTopupMsg("✗ " + (err.message || "Top-up failed."));
    }
    setTopupLoading(false);
  };

  const regenKey = async () => {
    if (!confirm("Regenerate your API key? Your current key will stop working immediately.")) return;
    setKeyRegenLoading(true);
    try {
      const res = await fetch("/api/my/reseller/api-key/regenerate", {
        method: "POST", headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setProfile(p => p ? { ...p, api_key: data.apiKey } : p);
      }
    } catch {}
    setKeyRegenLoading(false);
  };

  const copyKey = () => {
    if (profile?.api_key) {
      navigator.clipboard.writeText(profile.api_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const fetchEpp = async (orderId: string) => {
    setEppModal({ id: orderId });
    try {
      const res = await fetch(`/api/my/reseller/orders/${orderId}/epp`, { headers: authHeaders() });
      const data = await res.json();
      setEppModal({ id: orderId, code: data.eppCode });
    } catch {
      setEppModal({ id: orderId, code: "Error fetching code." });
    }
  };

  const saveNs = async () => {
    if (!nsModal) return;
    try {
      await fetch(`/api/my/reseller/orders/${nsModal.id}/nameservers`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ ns1: nsModal.ns[0], ns2: nsModal.ns[1], ns3: nsModal.ns[2], ns4: nsModal.ns[3] }),
      });
      setNsModal(null);
      fetchOrders();
    } catch {}
  };

  const doRenew = async (orderId: string, domain: string) => {
    if (!confirm(`Renew ${domain}? Funds will be deducted from your balance.`)) return;
    setRenewLoading(orderId);
    setRenewMsg("");
    try {
      const res = await fetch(`/api/my/reseller/orders/${orderId}/renew`, {
        method: "POST", headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Renewal failed");
      setRenewMsg(`✓ Renewal initiated for ${domain}`);
      fetchProfile(); fetchOrders();
    } catch (err: any) {
      setRenewMsg("✗ " + err.message);
    }
    setRenewLoading(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3 text-gray-400">
        <Loader2 size={22} className="animate-spin text-[#7C3AED]" />
        <span className="text-sm font-medium">Loading reseller dashboard…</span>
      </div>
    );
  }

  // ── No profile: show application prompt ──────────────────────────────────────
  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#7C3AED]/8 flex items-center justify-center mx-auto mb-6">
          <Globe size={28} className="text-[#7C3AED]" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-3">Domain Reseller Program</h2>
        <p className="text-gray-500 font-medium mb-8 leading-relaxed">
          You don't have a reseller account yet. Apply on our public page to unlock
          wholesale pricing, a dedicated API key, and a domain management dashboard.
        </p>
        <Link
          to="/domain-reseller"
          className="inline-flex items-center gap-3 px-8 py-3.5 bg-[#7C3AED] text-white rounded-2xl font-bold text-sm shadow-[0_8px_30px_rgba(124,58,237,0.3)] hover:bg-[#6D28D9] transition-all"
        >
          View Reseller Program
          <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  // ── Pending state ─────────────────────────────────────────────────────────────
  if (profile.status === "pending") {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-6 border border-amber-100">
          <Clock size={28} className="text-amber-500" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-3">Application Under Review</h2>
        <p className="text-gray-500 font-medium leading-relaxed">
          Your application for <strong>{profile.business_name}</strong> is being reviewed.
          We'll activate your account within 24 hours and notify you by email.
        </p>
      </div>
    );
  }

  // ── Suspended state ───────────────────────────────────────────────────────────
  if (profile.status === "suspended") {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-6 border border-red-100">
          <AlertTriangle size={28} className="text-red-400" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-3">Account Suspended</h2>
        <p className="text-gray-500 font-medium">
          Your reseller account has been suspended. Please contact support for assistance.
        </p>
      </div>
    );
  }

  // ── Active dashboard ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-black text-gray-900">{profile.business_name}</h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-black">
              <CheckCircle size={11} />
              Active · Tier {profile.discount_slab_tier}
            </span>
          </div>
          <p className="text-sm text-gray-500 font-medium">Domain Reseller Dashboard</p>
        </div>
        <Link
          to="/domain-reseller"
          className="text-xs text-[#7C3AED] font-semibold hover:underline flex items-center gap-1"
        >
          <Globe size={13} />
          Public pricing
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl mb-8 w-fit">
        {([
          { id: "balance", label: "Credit Balance", icon: CreditCard },
          { id: "orders",  label: "Domain Portfolio", icon: Globe },
          { id: "api",     label: "API & Tools", icon: Key },
        ] as { id: Tab; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
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

      {/* ── Tab: Credit Balance ─────────────────────────────────────────────── */}
      {tab === "balance" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Balance card */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-[0_8px_30px_rgba(0,0,0,0.02)] h-full flex flex-col justify-between">
              <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
                  Available Reseller Funds
                </p>
                <div className="text-5xl font-black text-gray-900 mb-1">
                  ${parseFloat(profile.balance).toFixed(2)}
                </div>
                <p className="text-sm text-gray-400 font-medium">{profile.currency}</p>
              </div>
              <div className="mt-8 pt-6 border-t border-gray-50">
                <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                  <Activity size={13} className="text-[#7C3AED]" />
                  All renewals are auto-deducted from this balance
                </div>
              </div>
            </div>
          </div>

          {/* Top-up widget */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
              <h3 className="text-sm font-black text-gray-700 mb-5 uppercase tracking-widest">
                Add Funds
              </h3>
              <div className="flex gap-3 mb-5">
                {[50, 100, 250].map(amt => (
                  <button
                    key={amt}
                    onClick={() => { setTopupAmount(String(amt)); doTopup(amt); }}
                    disabled={topupLoading}
                    className="flex-1 py-3 rounded-xl border border-gray-100 text-sm font-black text-gray-700 hover:border-[#7C3AED]/40 hover:text-[#7C3AED] hover:bg-[#7C3AED]/4 transition-all disabled:opacity-50"
                  >
                    ${amt}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <DollarSign size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input
                    type="number"
                    min="1"
                    value={topupAmount}
                    onChange={e => setTopupAmount(e.target.value)}
                    placeholder="Custom amount"
                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#7C3AED]/40 focus:ring-2 focus:ring-[#7C3AED]/8 transition-all"
                  />
                </div>
                <button
                  onClick={() => doTopup(parseFloat(topupAmount) || 0)}
                  disabled={topupLoading || !topupAmount}
                  className="px-5 py-3 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                >
                  {topupLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Add
                </button>
              </div>
              {topupMsg && (
                <div className={`mt-4 px-4 py-3 rounded-xl text-sm font-medium border ${
                  topupMsg.startsWith("✓")
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                    : "bg-red-50 text-red-600 border-red-100"
                }`}>
                  {topupMsg}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Domain Portfolio ───────────────────────────────────────────── */}
      {tab === "orders" && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)] overflow-hidden">
          {renewMsg && (
            <div className={`px-6 py-3 text-sm font-medium border-b ${
              renewMsg.startsWith("✓")
                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                : "bg-red-50 text-red-600 border-red-100"
            }`}>
              {renewMsg}
            </div>
          )}
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest">
              Domain Portfolio
            </h3>
            <button onClick={fetchOrders} className="p-2 rounded-xl hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>

          {ordersLoading ? (
            <div className="flex items-center justify-center py-14 gap-3 text-gray-400">
              <Loader2 size={18} className="animate-spin text-[#7C3AED]" />
              <span className="text-sm font-medium">Loading portfolio…</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Globe size={32} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium">No domain orders yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-50">
                    {["Domain", "Extension", "Action", "Cost", "Status", "Date", "Actions"].map(h => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-black text-gray-400 uppercase tracking-widest">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, i) => (
                    <tr key={order.id} className={`hover:bg-[#7C3AED]/[0.02] transition-colors ${i < orders.length - 1 ? "border-b border-gray-50" : ""}`}>
                      <td className="px-5 py-4 text-sm font-black text-gray-800">{order.domain_name}</td>
                      <td className="px-5 py-4 text-sm text-gray-500 font-medium">{order.tld}</td>
                      <td className="px-5 py-4">
                        <span className="text-xs font-bold capitalize text-gray-600">{order.action_type}</span>
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-gray-700">
                        ${parseFloat(order.cost).toFixed(2)}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border capitalize ${statusBadge(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-400 font-medium whitespace-nowrap">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setNsModal({ id: order.id, ns: (order.nameservers || "").split(",").concat(["","","",""]).slice(0,4) })}
                            className="px-2.5 py-1.5 rounded-lg border border-gray-100 text-xs font-bold text-gray-600 hover:border-[#7C3AED]/30 hover:text-[#7C3AED] transition-all flex items-center gap-1"
                            title="Manage Nameservers"
                          >
                            <Network size={11} />
                            NS
                          </button>
                          <button
                            onClick={() => fetchEpp(order.id)}
                            className="px-2.5 py-1.5 rounded-lg border border-gray-100 text-xs font-bold text-gray-600 hover:border-[#7C3AED]/30 hover:text-[#7C3AED] transition-all flex items-center gap-1"
                            title="Fetch EPP Code"
                          >
                            <Key size={11} />
                            EPP
                          </button>
                          <button
                            onClick={() => doRenew(order.id, order.domain_name + order.tld)}
                            disabled={renewLoading === order.id}
                            className="px-2.5 py-1.5 rounded-lg border border-gray-100 text-xs font-bold text-gray-600 hover:border-[#7C3AED]/30 hover:text-[#7C3AED] transition-all flex items-center gap-1 disabled:opacity-40"
                            title="Renew Domain"
                          >
                            {renewLoading === order.id
                              ? <Loader2 size={11} className="animate-spin" />
                              : <RotateCcw size={11} />}
                            Renew
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

      {/* ── Tab: API & Tools ────────────────────────────────────────────────── */}
      {tab === "api" && (
        <div className="space-y-6">
          {/* API Key card */}
          <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
            <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest mb-6">
              API Credentials
            </h3>
            <div className="mb-4">
              <label className="block text-xs text-gray-400 font-black uppercase tracking-widest mb-2">
                Your API Key
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    type={showKey ? "text" : "password"}
                    readOnly
                    value={profile.api_key ?? "Not issued yet"}
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-mono text-gray-700 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => setShowKey(s => !s)}
                  className="p-3 rounded-xl border border-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  onClick={copyKey}
                  className="p-3 rounded-xl border border-gray-100 text-gray-400 hover:text-[#7C3AED] hover:border-[#7C3AED]/30 transition-all"
                >
                  {copied ? <CheckCircle size={16} className="text-emerald-500" /> : <Copy size={16} />}
                </button>
                <button
                  onClick={regenKey}
                  disabled={keyRegenLoading}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border border-[#7C3AED]/20 text-[#7C3AED] hover:bg-[#7C3AED]/4 font-bold text-xs transition-all disabled:opacity-50"
                >
                  {keyRegenLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  Regenerate
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400 font-medium">
              Keep this key private. Use it to authenticate API requests from your systems.
            </p>
          </div>

          {/* Code snippet */}
          <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-3 mb-5">
              <FileCode2 size={18} className="text-[#7C3AED]" />
              <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest">
                Domain Availability — Example Request
              </h3>
            </div>
            <div className="bg-gray-950 rounded-2xl p-5 overflow-x-auto">
              <pre className="text-xs font-mono text-emerald-400 leading-relaxed whitespace-pre">{`curl -s -X POST https://api.${window.location.host}/reseller/check \\
  -H "Content-Type: application/json" \\
  -H "X-Reseller-Key: ${profile.api_key ?? "YOUR_API_KEY"}" \\
  -d '{
    "domains": ["example.com", "mybrand.io"],
    "checkAvailability": true
  }'`}</pre>
              <pre className="text-xs font-mono text-gray-400 leading-relaxed whitespace-pre mt-4">{`// Response:
{
  "results": [
    { "domain": "example.com",  "available": false, "price": 9.99  },
    { "domain": "mybrand.io",   "available": true,  "price": 27.99 }
  ]
}`}</pre>
            </div>
          </div>
        </div>
      )}

      {/* ── EPP Modal ───────────────────────────────────────────────────────── */}
      {eppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_24px_80px_rgba(0,0,0,0.12)] w-full max-w-sm p-8">
            <h3 className="text-lg font-black text-gray-900 mb-4">EPP / Auth Code</h3>
            {!eppModal.code ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Loader2 size={16} className="animate-spin text-[#7C3AED]" />
                Fetching code…
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-3 font-mono text-sm text-gray-800 break-all mb-4">
                {eppModal.code}
              </div>
            )}
            <button
              onClick={() => setEppModal(null)}
              className="w-full py-3 rounded-xl border border-gray-100 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors mt-2"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Nameserver Modal ────────────────────────────────────────────────── */}
      {nsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_24px_80px_rgba(0,0,0,0.12)] w-full max-w-sm p-8">
            <h3 className="text-lg font-black text-gray-900 mb-5">Manage Nameservers</h3>
            <div className="space-y-3 mb-5">
              {nsModal.ns.map((ns, i) => (
                <div key={i}>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">
                    NS{i + 1}
                  </label>
                  <input
                    type="text"
                    value={ns}
                    onChange={e => {
                      const updated = [...nsModal.ns];
                      updated[i] = e.target.value;
                      setNsModal({ ...nsModal, ns: updated });
                    }}
                    placeholder={`ns${i + 1}.yourdomain.com`}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#7C3AED]/40 transition-all"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setNsModal(null)}
                className="flex-1 py-3 rounded-xl border border-gray-100 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveNs}
                className="flex-1 py-3 rounded-xl bg-[#7C3AED] text-white text-sm font-bold hover:bg-[#6D28D9] transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
