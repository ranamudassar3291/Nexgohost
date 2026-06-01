import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import {
  Globe, CreditCard, Key, Copy, RefreshCw, CheckCircle, AlertCircle,
  Loader2, ArrowRight, TrendingDown, Clock, RotateCcw, Network,
  Eye, EyeOff, Plus, DollarSign, Activity, Building2,
  AlertTriangle, Terminal, Code2, ChevronDown, ChevronUp,
  Shield, Zap, BookOpen, Package, ExternalLink, Search,
  BarChart3, Wallet, FileText,
} from "lucide-react";

type Tab = "overview" | "domains" | "api" | "pricing";

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

interface TldPricing {
  id: string; tld: string; retail_price: string; reseller_price: string;
}

function authHeaders() {
  const token = localStorage.getItem("token") || localStorage.getItem("noehost_token");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function statusBadge(s: string) {
  const m: Record<string, string> = {
    completed: "bg-emerald-50 text-emerald-700 border-emerald-100",
    processing: "bg-amber-50 text-amber-700 border-amber-100",
    failed: "bg-red-50 text-red-700 border-red-100",
    pending: "bg-sky-50 text-sky-700 border-sky-100",
  };
  return m[s] ?? "bg-gray-50 text-gray-600 border-gray-100";
}

const BRAND = "#5B5FEF";

const API_ENDPOINTS = [
  {
    method: "GET",
    path: "/api/reseller/v1/domains/check",
    title: "Check Domain Availability",
    desc: "Check if a domain name is available for registration.",
    params: [
      { name: "domain", type: "string", required: true, desc: "Domain name (e.g., example.com)" },
    ],
    example: `curl -X GET "https://noehost.com/api/reseller/v1/domains/check?domain=example.com" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
    response: `{ "available": true, "domain": "example.com", "price": 1700 }`,
  },
  {
    method: "POST",
    path: "/api/reseller/v1/domains/register",
    title: "Register a Domain",
    desc: "Register a new domain using your reseller balance.",
    params: [
      { name: "domain", type: "string", required: true, desc: "Full domain name (e.g., example.com)" },
      { name: "years", type: "number", required: false, desc: "Registration period (1–10). Default: 1" },
      { name: "ns1", type: "string", required: false, desc: "Primary nameserver" },
      { name: "ns2", type: "string", required: false, desc: "Secondary nameserver" },
    ],
    example: `curl -X POST "https://noehost.com/api/reseller/v1/domains/register" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"domain": "example.com", "years": 1}'`,
    response: `{ "success": true, "order_id": "ord_xxx", "domain": "example.com", "expires": "2027-06-01" }`,
  },
  {
    method: "POST",
    path: "/api/reseller/v1/domains/{order_id}/renew",
    title: "Renew a Domain",
    desc: "Renew an existing domain registration for another year.",
    params: [
      { name: "order_id", type: "string", required: true, desc: "Order ID from registration" },
      { name: "years", type: "number", required: false, desc: "Renewal years. Default: 1" },
    ],
    example: `curl -X POST "https://noehost.com/api/reseller/v1/domains/ord_xxx/renew" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{"years": 1}'`,
    response: `{ "success": true, "domain": "example.com", "new_expiry": "2028-06-01", "cost": 1700 }`,
  },
  {
    method: "PUT",
    path: "/api/reseller/v1/domains/{order_id}/nameservers",
    title: "Update Nameservers",
    desc: "Update the nameservers for a registered domain.",
    params: [
      { name: "ns1", type: "string", required: true, desc: "Primary nameserver" },
      { name: "ns2", type: "string", required: true, desc: "Secondary nameserver" },
      { name: "ns3", type: "string", required: false, desc: "Tertiary nameserver" },
      { name: "ns4", type: "string", required: false, desc: "Quaternary nameserver" },
    ],
    example: `curl -X PUT "https://noehost.com/api/reseller/v1/domains/ord_xxx/nameservers" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{"ns1": "ns1.yourdns.com", "ns2": "ns2.yourdns.com"}'`,
    response: `{ "success": true, "message": "Nameservers updated successfully" }`,
  },
  {
    method: "GET",
    path: "/api/reseller/v1/domains/{order_id}/epp",
    title: "Get EPP / Auth Code",
    desc: "Retrieve the EPP authorization code for domain transfer.",
    params: [
      { name: "order_id", type: "string", required: true, desc: "Order ID of the domain" },
    ],
    example: `curl -X GET "https://noehost.com/api/reseller/v1/domains/ord_xxx/epp" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
    response: `{ "epp_code": "Abc123XYZ!", "domain": "example.com" }`,
  },
  {
    method: "GET",
    path: "/api/reseller/v1/balance",
    title: "Get Account Balance",
    desc: "Retrieve your current reseller credit balance.",
    params: [],
    example: `curl -X GET "https://noehost.com/api/reseller/v1/balance" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
    response: `{ "balance": "15000.00", "currency": "PKR" }`,
  },
];

function EndpointCard({ ep }: { ep: typeof API_ENDPOINTS[0] }) {
  const [open, setOpen] = useState(false);
  const [copiedEx, setCopiedEx] = useState(false);

  const mColor: Record<string, string> = {
    GET: "bg-sky-50 text-sky-700 border-sky-200",
    POST: "bg-emerald-50 text-emerald-700 border-emerald-200",
    PUT: "bg-amber-50 text-amber-700 border-amber-200",
    DELETE: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase border ${mColor[ep.method] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
          {ep.method}
        </span>
        <code className="text-sm font-mono font-bold text-gray-700 flex-1">{ep.path}</code>
        <span className="text-xs text-gray-400 font-medium hidden md:block">{ep.title}</span>
        {open ? <ChevronUp size={15} className="text-gray-400 shrink-0" /> : <ChevronDown size={15} className="text-gray-400 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-gray-50 px-5 py-5 space-y-5 bg-gray-50/50">
          <p className="text-sm text-gray-600 font-medium">{ep.desc}</p>

          {ep.params.length > 0 && (
            <div>
              <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Parameters</div>
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="grid grid-cols-4 bg-gray-50 px-4 py-2 border-b border-gray-100 text-xs font-black text-gray-400 uppercase tracking-widest">
                  <div>Name</div><div>Type</div><div>Required</div><div>Description</div>
                </div>
                {ep.params.map(p => (
                  <div key={p.name} className="grid grid-cols-4 px-4 py-2.5 text-sm border-b border-gray-50 last:border-0">
                    <code className="font-mono font-bold text-gray-800">{p.name}</code>
                    <code className="font-mono text-purple-600 text-xs">{p.type}</code>
                    <span className={`text-xs font-bold ${p.required ? "text-red-500" : "text-gray-400"}`}>
                      {p.required ? "required" : "optional"}
                    </span>
                    <span className="text-gray-500">{p.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-black text-gray-400 uppercase tracking-widest">Example Request</div>
              <button
                onClick={() => { navigator.clipboard.writeText(ep.example); setCopiedEx(true); setTimeout(() => setCopiedEx(false), 2000); }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200 transition-colors"
              >
                {copiedEx ? <CheckCircle size={11} className="text-emerald-500" /> : <Copy size={11} />}
                {copiedEx ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="bg-gray-900 text-green-300 text-xs rounded-xl p-4 overflow-x-auto font-mono leading-relaxed">
              {ep.example}
            </pre>
          </div>

          <div>
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Sample Response</div>
            <pre className="bg-gray-900 text-cyan-300 text-xs rounded-xl p-4 overflow-x-auto font-mono leading-relaxed">
              {ep.response}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResellerDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [pricing, setPricing] = useState<TldPricing[]>([]);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupMsg, setTopupMsg] = useState<{text: string; ok: boolean} | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [keyRegenLoading, setKeyRegenLoading] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [eppModal, setEppModal] = useState<{ id: string; code?: string } | null>(null);
  const [nsModal, setNsModal] = useState<{ id: string; ns: string[] } | null>(null);
  const [renewLoading, setRenewLoading] = useState<string | null>(null);
  const [renewMsg, setRenewMsg] = useState<{text: string; ok: boolean} | null>(null);
  const [domainSearch, setDomainSearch] = useState("");

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

  const fetchPricing = useCallback(async () => {
    setPricingLoading(true);
    try {
      const res = await fetch("/api/reseller/pricing");
      const data = await res.json();
      if (Array.isArray(data)) setPricing(data);
    } catch {}
    setPricingLoading(false);
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);
  useEffect(() => { if (tab === "domains") fetchOrders(); }, [tab, fetchOrders]);
  useEffect(() => { if (tab === "pricing") fetchPricing(); }, [tab, fetchPricing]);

  const doTopup = async (amt: number) => {
    if (!amt || amt <= 0) return;
    setTopupLoading(true); setTopupMsg(null);
    try {
      const res = await fetch("/api/my/reseller/funds/topup", {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setTopupMsg({ text: `Rs. ${amt.toLocaleString()} added. New balance: Rs. ${parseFloat(data.balance).toLocaleString()}`, ok: true });
      setTopupAmount("");
      fetchProfile();
    } catch (err: any) {
      setTopupMsg({ text: err.message || "Top-up failed.", ok: false });
    }
    setTopupLoading(false);
  };

  const regenKey = async () => {
    if (!confirm("Regenerate API key? Your current key will stop working immediately.")) return;
    setKeyRegenLoading(true);
    try {
      const res = await fetch("/api/my/reseller/api-key/regenerate", { method: "POST", headers: authHeaders() });
      const data = await res.json();
      if (data.success) setProfile(p => p ? { ...p, api_key: data.apiKey } : p);
    } catch {}
    setKeyRegenLoading(false);
  };

  const copyKey = () => {
    if (profile?.api_key) {
      navigator.clipboard.writeText(profile.api_key);
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    }
  };

  const fetchEpp = async (orderId: string) => {
    setEppModal({ id: orderId });
    try {
      const res = await fetch(`/api/my/reseller/orders/${orderId}/epp`, { headers: authHeaders() });
      const data = await res.json();
      setEppModal({ id: orderId, code: data.eppCode || data.epp_code || "N/A" });
    } catch { setEppModal({ id: orderId, code: "Error fetching code." }); }
  };

  const saveNs = async () => {
    if (!nsModal) return;
    try {
      await fetch(`/api/my/reseller/orders/${nsModal.id}/nameservers`, {
        method: "PUT", headers: authHeaders(),
        body: JSON.stringify({ ns1: nsModal.ns[0], ns2: nsModal.ns[1], ns3: nsModal.ns[2], ns4: nsModal.ns[3] }),
      });
      setNsModal(null); fetchOrders();
    } catch {}
  };

  const doRenew = async (orderId: string, domain: string) => {
    if (!confirm(`Renew ${domain}? Cost will be deducted from your balance.`)) return;
    setRenewLoading(orderId); setRenewMsg(null);
    try {
      const res = await fetch(`/api/my/reseller/orders/${orderId}/renew`, { method: "POST", headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Renewal failed");
      setRenewMsg({ text: `Renewal initiated for ${domain}`, ok: true });
      fetchProfile(); fetchOrders();
    } catch (err: any) {
      setRenewMsg({ text: err.message, ok: false });
    }
    setRenewLoading(null);
  };

  const fmt = (v: string | number) => {
    const n = parseFloat(String(v));
    return isNaN(n) ? "—" : `Rs. ${n.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const savings = (retail: string, reseller: string) => {
    const r = parseFloat(retail), p = parseFloat(reseller);
    if (!r || !p) return "0";
    return Math.round(((r - p) / r) * 100).toString();
  };

  const tierLabel = (t: number) =>
    t === 1 ? "Starter" : t === 2 ? "Professional" : t === 3 ? "Enterprise" : `Tier ${t}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3 text-gray-400">
        <Loader2 size={22} className="animate-spin" style={{ color: BRAND }} />
        <span className="text-sm font-medium">Loading reseller dashboard…</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-lg mx-auto px-6 py-20 text-center">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-indigo-100" style={{ background: `${BRAND}12` }}>
          <Globe size={34} style={{ color: BRAND }} />
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-3">Domain Reseller Program</h2>
        <p className="text-gray-500 font-medium mb-8 leading-relaxed">
          You don't have a reseller account yet. Apply to unlock wholesale pricing,
          a dedicated API key, and full domain management dashboard.
        </p>
        <Link
          to="/domain-reseller"
          className="inline-flex items-center gap-3 px-8 py-4 text-white rounded-2xl font-bold text-sm shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
          style={{ background: BRAND }}
        >
          View Reseller Program <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  if (profile.status === "pending") {
    return (
      <div className="max-w-lg mx-auto px-6 py-20 text-center">
        <div className="w-20 h-20 rounded-3xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-6">
          <Clock size={34} className="text-amber-500" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-3">Application Under Review</h2>
        <p className="text-gray-500 font-medium leading-relaxed">
          Your application for <strong>{profile.business_name}</strong> is being reviewed.
          We'll activate your account within 24 hours and notify you by email.
        </p>
      </div>
    );
  }

  if (profile.status === "suspended") {
    return (
      <div className="max-w-lg mx-auto px-6 py-20 text-center">
        <div className="w-20 h-20 rounded-3xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={34} className="text-red-400" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-3">Account Suspended</h2>
        <p className="text-gray-500 font-medium">Contact support to restore your account.</p>
      </div>
    );
  }

  const filteredOrders = orders.filter(o =>
    !domainSearch || `${o.domain_name}${o.tld}`.toLowerCase().includes(domainSearch.toLowerCase()),
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${BRAND}15` }}>
              <Building2 size={19} style={{ color: BRAND }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900">{profile.business_name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-black">
                  <CheckCircle size={10} /> Active
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-black" style={{ borderColor: `${BRAND}30`, color: BRAND, background: `${BRAND}08` }}>
                  {tierLabel(profile.discount_slab_tier)} — Tier {profile.discount_slab_tier}
                </span>
              </div>
            </div>
          </div>
        </div>
        <Link to="/domain-reseller" className="text-xs font-semibold hover:underline flex items-center gap-1" style={{ color: BRAND }}>
          <ExternalLink size={13} /> Public Pricing
        </Link>
      </div>

      {/* ── Stats Row ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Wallet, label: "Reseller Balance", value: fmt(profile.balance), sub: profile.currency || "PKR", color: "text-emerald-600", bg: "bg-emerald-50" },
          { icon: Globe, label: "Total Domains", value: String(orders.length || "—"), sub: "in portfolio", color: "text-indigo-600", bg: "bg-indigo-50" },
          { icon: BarChart3, label: "Discount Tier", value: `Tier ${profile.discount_slab_tier}`, sub: tierLabel(profile.discount_slab_tier), color: "text-purple-600", bg: "bg-purple-50" },
          { icon: Key, label: "API Status", value: profile.api_key ? "Active" : "Not Set", sub: profile.api_key ? "Key issued" : "Contact admin", color: profile.api_key ? "text-emerald-600" : "text-amber-600", bg: profile.api_key ? "bg-emerald-50" : "bg-amber-50" },
        ].map(({ icon: Icon, label, value, sub, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest leading-tight">{label}</p>
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon size={15} className={color} />
              </div>
            </div>
            <div className="text-xl font-black text-gray-900">{value}</div>
            <div className="text-xs text-gray-400 font-medium mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl w-fit mb-8 flex-wrap">
        {([
          { id: "overview", label: "Balance & Funds", icon: Wallet },
          { id: "domains",  label: "Domain Portfolio", icon: Globe },
          { id: "api",      label: "API & Docs", icon: Code2 },
          { id: "pricing",  label: "My Pricing", icon: TrendingDown },
        ] as { id: Tab; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              tab === id ? "bg-white shadow-sm border border-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon size={14} style={tab === id ? { color: BRAND } : {}} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Balance & Funds ─────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Balance card */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm h-full flex flex-col">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Available Balance</p>
              <div className="text-5xl font-black text-gray-900 mb-1 tracking-tight">
                {fmt(profile.balance)}
              </div>
              <p className="text-sm text-gray-400 font-medium mb-6">{profile.currency || "PKR"}</p>
              <div className="mt-auto pt-6 border-t border-gray-50 space-y-3">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Activity size={12} style={{ color: BRAND }} />
                  Domain registrations auto-deducted from this balance
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Shield size={12} className="text-emerald-500" />
                  Balance secured in your reseller wallet
                </div>
              </div>
            </div>
          </div>

          {/* Top-up */}
          <div className="lg:col-span-3 space-y-5">
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
              <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest mb-5">Add Funds</h3>
              <p className="text-xs text-gray-400 font-medium mb-4">
                Add credit to your reseller wallet to register and renew domains. Contact admin or use the quick amounts below.
              </p>
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[2000, 5000, 10000].map(amt => (
                  <button
                    key={amt}
                    onClick={() => doTopup(amt)}
                    disabled={topupLoading}
                    className="py-3 rounded-xl border border-gray-100 text-sm font-black text-gray-700 hover:border-indigo-200 hover:text-indigo-600 hover:bg-indigo-50 transition-all disabled:opacity-50"
                  >
                    Rs. {amt.toLocaleString()}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">Rs.</span>
                  <input
                    type="number"
                    min="1"
                    value={topupAmount}
                    onChange={e => setTopupAmount(e.target.value)}
                    placeholder="Custom amount"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-700 placeholder-gray-300 focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 transition-all"
                  />
                </div>
                <button
                  onClick={() => doTopup(parseFloat(topupAmount) || 0)}
                  disabled={topupLoading || !topupAmount}
                  className="px-5 py-3 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                  style={{ background: BRAND }}
                >
                  {topupLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Add Funds
                </button>
              </div>
              {topupMsg && (
                <div className={`mt-4 px-4 py-3 rounded-xl text-sm font-medium border flex items-center gap-2 ${
                  topupMsg.ok ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
                }`}>
                  {topupMsg.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                  {topupMsg.text}
                </div>
              )}
            </div>

            {/* Tier info */}
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
              <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest mb-4">Your Tier Benefits</h3>
              <div className="space-y-2.5">
                {[
                  { label: "Current Tier", value: `Tier ${profile.discount_slab_tier} — ${tierLabel(profile.discount_slab_tier)}`, highlight: true },
                  { label: "Domain Discount", value: profile.discount_slab_tier === 1 ? "Standard wholesale" : profile.discount_slab_tier === 2 ? "5% extra discount" : "10% extra discount", highlight: false },
                  { label: "API Access", value: "Full REST API", highlight: false },
                  { label: "Support", value: profile.discount_slab_tier >= 3 ? "Dedicated manager" : "Priority email", highlight: false },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-500 font-medium">{r.label}</span>
                    <span className={`text-sm font-bold ${r.highlight ? "" : "text-gray-700"}`} style={r.highlight ? { color: BRAND } : {}}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Domain Portfolio ────────────────────────────────────────────── */}
      {tab === "domains" && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          {renewMsg && (
            <div className={`px-6 py-3 text-sm font-medium border-b flex items-center gap-2 ${renewMsg.ok ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"}`}>
              {renewMsg.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              {renewMsg.text}
            </div>
          )}
          <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-4">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                type="text"
                placeholder="Search domains…"
                value={domainSearch}
                onChange={e => setDomainSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-700 placeholder-gray-300 focus:outline-none focus:border-indigo-200 transition-all"
              />
            </div>
            <button onClick={fetchOrders} className="p-2.5 rounded-xl hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors" title="Refresh">
              <RefreshCw size={14} className={ordersLoading ? "animate-spin" : ""} />
            </button>
            <span className="text-xs text-gray-400 font-medium">{filteredOrders.length} domain{filteredOrders.length !== 1 ? "s" : ""}</span>
          </div>

          {ordersLoading ? (
            <div className="flex items-center justify-center py-14 gap-3 text-gray-400">
              <Loader2 size={18} className="animate-spin" style={{ color: BRAND }} />
              <span className="text-sm font-medium">Loading portfolio…</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-16">
              <Globe size={36} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium text-gray-400">
                {domainSearch ? "No domains match your search." : "No domain orders yet."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {["Domain", "Type", "Cost", "Status", "Date", "Actions"].map(h => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-black text-gray-400 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((o, i) => (
                    <tr key={o.id} className={`hover:bg-gray-50/50 transition-colors ${i < filteredOrders.length - 1 ? "border-b border-gray-50" : ""}`}>
                      <td className="px-5 py-4">
                        <div className="font-black text-gray-900 text-sm">{o.domain_name}<span className="text-gray-400">{o.tld}</span></div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs font-bold capitalize text-gray-500 bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">{o.action_type}</span>
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-gray-700">{fmt(o.cost)}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border capitalize ${statusBadge(o.status)}`}>{o.status}</span>
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-400 font-medium whitespace-nowrap">
                        {new Date(o.created_at).toLocaleDateString("en-PK")}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setNsModal({ id: o.id, ns: (o.nameservers || "").split(",").concat(["","","",""]).slice(0,4) })}
                            className="px-2.5 py-1.5 rounded-lg border border-gray-100 text-xs font-bold text-gray-600 hover:border-indigo-200 hover:text-indigo-600 transition-all flex items-center gap-1">
                            <Network size={10} /> NS
                          </button>
                          <button onClick={() => fetchEpp(o.id)}
                            className="px-2.5 py-1.5 rounded-lg border border-gray-100 text-xs font-bold text-gray-600 hover:border-indigo-200 hover:text-indigo-600 transition-all flex items-center gap-1">
                            <Key size={10} /> EPP
                          </button>
                          <button onClick={() => doRenew(o.id, o.domain_name + o.tld)} disabled={renewLoading === o.id}
                            className="px-2.5 py-1.5 rounded-lg border border-gray-100 text-xs font-bold text-gray-600 hover:border-indigo-200 hover:text-indigo-600 transition-all flex items-center gap-1 disabled:opacity-40">
                            {renewLoading === o.id ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />} Renew
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

      {/* ── Tab: API & Docs ──────────────────────────────────────────────────── */}
      {tab === "api" && (
        <div className="space-y-6">
          {/* API Key card */}
          <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-black text-gray-900 mb-1">API Credentials</h3>
                <p className="text-sm text-gray-400 font-medium">Use this key in the Authorization header for all API requests.</p>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${BRAND}12` }}>
                <Key size={18} style={{ color: BRAND }} />
              </div>
            </div>

            {profile.api_key ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 font-black uppercase tracking-widest mb-2">Your API Key</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <input
                        type={showKey ? "text" : "password"}
                        readOnly
                        value={profile.api_key}
                        className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-mono text-gray-700 pr-10"
                      />
                      <button onClick={() => setShowKey(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                        {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <button onClick={copyKey} className="px-4 py-3 rounded-xl border border-gray-100 text-sm font-bold text-gray-600 hover:border-indigo-200 hover:text-indigo-600 transition-all flex items-center gap-2">
                      {keyCopied ? <CheckCircle size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      {keyCopied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                    <Shield size={12} className="text-emerald-500" />
                    Keep this key secret — treat it like a password.
                  </div>
                  <button onClick={regenKey} disabled={keyRegenLoading} className="flex items-center gap-2 text-xs font-bold text-red-500 hover:text-red-600 transition-colors disabled:opacity-50">
                    {keyRegenLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    Regenerate Key
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <AlertCircle size={24} className="text-amber-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500 font-medium">API key not yet issued. Contact admin to activate your key.</p>
              </div>
            )}
          </div>

          {/* Quick-start */}
          <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center">
                <Terminal size={16} className="text-green-400" />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900">Quick Start</h3>
                <p className="text-xs text-gray-400 font-medium">Base URL: <code className="text-indigo-600 font-mono">https://noehost.com</code></p>
              </div>
            </div>
            <pre className="bg-gray-900 text-green-300 text-xs rounded-xl p-4 overflow-x-auto font-mono leading-relaxed">
{`# Authentication: pass your API key in the Authorization header
# Replace YOUR_API_KEY with the key shown above

curl -X GET "https://noehost.com/api/reseller/v1/balance" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"

# Expected response:
# { "balance": "15000.00", "currency": "PKR" }`}
            </pre>
          </div>

          {/* Endpoint list */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <BookOpen size={16} style={{ color: BRAND }} />
              <h3 className="text-base font-black text-gray-900">API Reference</h3>
            </div>
            <div className="space-y-2">
              {API_ENDPOINTS.map(ep => <EndpointCard key={ep.path} ep={ep} />)}
            </div>
          </div>

          {/* Error codes */}
          <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
            <h3 className="text-base font-black text-gray-900 mb-5">HTTP Status Codes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { code: "200", label: "OK", desc: "Request succeeded" },
                { code: "400", label: "Bad Request", desc: "Invalid parameters or missing fields" },
                { code: "401", label: "Unauthorized", desc: "Missing or invalid API key" },
                { code: "402", label: "Payment Required", desc: "Insufficient reseller balance" },
                { code: "404", label: "Not Found", desc: "Resource does not exist" },
                { code: "429", label: "Rate Limited", desc: "Too many requests — slow down" },
                { code: "500", label: "Server Error", desc: "Internal server error — retry later" },
              ].map(({ code, label, desc }) => (
                <div key={code} className="flex items-start gap-3 p-3 rounded-xl border border-gray-50 bg-gray-50/50">
                  <code className={`px-2 py-0.5 rounded-lg text-xs font-black border ${
                    code.startsWith("2") ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                    code.startsWith("4") ? "bg-amber-50 text-amber-700 border-amber-100" :
                    "bg-red-50 text-red-700 border-red-100"
                  }`}>
                    {code}
                  </code>
                  <div>
                    <div className="text-sm font-bold text-gray-800">{label}</div>
                    <div className="text-xs text-gray-400">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: My Pricing ──────────────────────────────────────────────────── */}
      {tab === "pricing" && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-gray-900">Your Reseller Pricing</h3>
              <p className="text-xs text-gray-400 font-medium mt-0.5">Prices at your current Tier {profile.discount_slab_tier} discount</p>
            </div>
            <button onClick={fetchPricing} className="p-2 rounded-xl hover:bg-gray-50 text-gray-400 transition-colors" title="Refresh">
              <RefreshCw size={14} className={pricingLoading ? "animate-spin" : ""} />
            </button>
          </div>

          {pricingLoading ? (
            <div className="flex items-center justify-center py-14 gap-3 text-gray-400">
              <Loader2 size={18} className="animate-spin" style={{ color: BRAND }} />
              <span className="text-sm font-medium">Loading pricing…</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-5 bg-gray-50 border-b border-gray-100 px-6 py-3">
                {["Extension", "Register Price", "Your Cost", "You Save", "Margin Potential"].map(h => (
                  <div key={h} className="text-xs font-black text-gray-400 uppercase tracking-widest">{h}</div>
                ))}
              </div>
              {pricing.map((row, i) => {
                const pct = savings(row.retail_price, row.reseller_price);
                const retail = parseFloat(row.retail_price);
                const cost = parseFloat(row.reseller_price);
                const margin = isNaN(retail) || isNaN(cost) ? 0 : Math.round(retail - cost);
                return (
                  <div key={row.id} className={`grid grid-cols-5 items-center px-6 py-4 hover:bg-gray-50/50 transition-colors ${i < pricing.length - 1 ? "border-b border-gray-50" : ""}`}>
                    <div className="font-black text-gray-900 text-sm">{row.tld}</div>
                    <div className="text-sm text-gray-400 font-medium line-through">{fmt(row.retail_price)}</div>
                    <div className="text-sm font-black text-gray-900">{fmt(row.reseller_price)}/yr</div>
                    <div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-black">
                        <TrendingDown size={10} /> {pct}% off
                      </span>
                    </div>
                    <div className="text-sm font-bold text-indigo-600">
                      Rs. {margin.toLocaleString()} / domain
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* ── EPP Modal ───────────────────────────────────────────────────────── */}
      {eppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl w-full max-w-sm p-8 relative">
            <h3 className="text-lg font-black text-gray-900 mb-4">EPP / Auth Code</h3>
            {!eppModal.code ? (
              <div className="flex items-center justify-center py-4 gap-2 text-gray-400">
                <Loader2 size={16} className="animate-spin" style={{ color: BRAND }} />
                <span className="text-sm">Fetching code…</span>
              </div>
            ) : (
              <div>
                <code className="block w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 text-gray-800 font-mono text-sm font-bold text-center mb-4">
                  {eppModal.code}
                </code>
                <button onClick={() => { navigator.clipboard.writeText(eppModal.code!); }} className="w-full py-2.5 rounded-xl border border-gray-100 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                  <Copy size={14} /> Copy Code
                </button>
              </div>
            )}
            <button onClick={() => setEppModal(null)} className="mt-3 w-full py-2.5 rounded-xl text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors">Close</button>
          </div>
        </div>
      )}

      {/* ── NS Modal ────────────────────────────────────────────────────────── */}
      {nsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl w-full max-w-sm p-8">
            <h3 className="text-lg font-black text-gray-900 mb-5">Update Nameservers</h3>
            <div className="space-y-3 mb-6">
              {["Primary (NS1)", "Secondary (NS2)", "NS3 (optional)", "NS4 (optional)"].map((lbl, idx) => (
                <div key={idx}>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5">{lbl}</label>
                  <input
                    type="text"
                    value={nsModal.ns[idx] || ""}
                    onChange={e => { const ns = [...nsModal.ns]; ns[idx] = e.target.value; setNsModal({ ...nsModal, ns }); }}
                    placeholder={`ns${idx + 1}.example.com`}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm font-mono text-gray-700 placeholder-gray-300 focus:outline-none focus:border-indigo-200 transition-all"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setNsModal(null)} className="flex-1 py-3 rounded-xl border border-gray-100 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={saveNs} className="flex-1 py-3 rounded-xl text-white text-sm font-bold transition-all" style={{ background: BRAND }}>Save Nameservers</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
