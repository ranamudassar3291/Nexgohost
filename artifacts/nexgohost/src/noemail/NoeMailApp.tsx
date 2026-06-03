import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Eye, EyeOff, Loader2, LogOut, ChevronRight, Plus,
  HardDrive, Users, Globe, Trash2, Copy, Check, ChevronDown,
  Shield, Server, RefreshCw, ExternalLink, ArrowLeft, Zap,
  AlertCircle, X, CheckCircle2, Clock, XCircle, ShoppingCart,
  Star, Info,
} from "lucide-react";

const API = "https://noehost.com/api";

function apiFetch(url: string, opts?: RequestInit, token?: string | null) {
  const t = token || localStorage.getItem("noemail_token") || localStorage.getItem("token") || localStorage.getItem("noehost_token");
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(opts?.headers ?? {}),
    },
  }).then(async (r) => {
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Request failed");
    return d;
  });
}

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      className="ml-1 p-1 text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-violet-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
    active: { label: "Active", icon: CheckCircle2, color: "#059669", bg: "#ECFDF5", border: "#6EE7B7" },
    pending_payment: { label: "Awaiting Payment", icon: Clock, color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE" },
    pending_dns: { label: "Pending DNS", icon: Clock, color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
    suspended: { label: "Suspended", icon: XCircle, color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
  };
  const c = cfg[status] ?? { label: status, icon: Clock, color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB" };
  const Icon = c.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      <Icon className="w-3 h-3" />{c.label}
    </span>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar({ user, onLogout, onBack }: { user: any; onLogout: () => void; onBack?: () => void }) {
  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-800">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
              <Mail className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg tracking-tight">Noemail</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <div className="text-sm font-semibold text-gray-800">{user.name || user.email}</div>
                <div className="text-xs text-gray-400">{user.email}</div>
              </div>
              <button onClick={onLogout}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors font-medium">
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          ) : (
            <a href="https://noehost.com/client/login"
              className="flex items-center gap-1.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 px-4 py-2 rounded-lg transition-colors">
              Login to Noemail
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────
function LoginPage({ onLogin }: { onLogin: (user: any, token: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch(`${API}/auth/login`, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }, "");
      if (!data.token) throw new Error("Invalid response");
      localStorage.setItem("noemail_token", data.token);
      onLogin(data.user, data.token);
    } catch (e: any) {
      setError(e.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-violet-100/60 rounded-full blur-3xl -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-violet-50 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />
      </div>

      <Navbar user={null} onLogout={() => {}} />

      <div className="relative flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="w-full max-w-md">

          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-violet-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-200">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Login to webmail</h1>
            <p className="text-gray-500 mt-2 text-sm">Access and manage your business email</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8">
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mailbox / Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@yourdomain.com"
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all bg-gray-50 placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all bg-gray-50 placeholder:text-gray-400 pr-12"
                  />
                  <button type="button" onClick={() => setShowPwd(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <button type="submit" disabled={loading}
                className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-200">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Log in
              </button>
            </form>

            <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
              <a href="https://noehost.com/checkout/email-hosting" className="text-sm text-violet-600 hover:text-violet-700 font-medium transition-colors">
                Get Business Email
              </a>
              <a href="https://noehost.com/client/forgot-password" className="text-sm text-violet-600 hover:text-violet-700 font-medium transition-colors">
                Forgot password?
              </a>
            </div>
          </div>

          {/* App downloads hint */}
          <div className="text-center mt-6">
            <p className="text-xs text-gray-400">Configure your email client with IMAP/SMTP settings from your dashboard</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Plans Page ───────────────────────────────────────────────────────────────
function PlansPage({ onBack }: { onBack: () => void }) {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    apiFetch(`${API}/email-packages`, {}, "")
      .then(setPlans)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700 mb-6 mx-auto font-medium transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Business Email Plans</h1>
          <p className="text-gray-500 mt-2">Professional email hosting with your own domain</p>

          <div className="flex items-center justify-center gap-1 mt-6 bg-white border border-gray-200 rounded-xl p-1 w-fit mx-auto">
            {(["monthly", "yearly"] as const).map(c => (
              <button key={c} onClick={() => setBillingCycle(c)}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${billingCycle === c ? "bg-violet-600 text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
                {c} {c === "yearly" && <span className="text-xs opacity-80 ml-1">Save 20%</span>}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-violet-400" /></div>
        ) : plans.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No plans available yet. Contact support.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan, i) => {
              const price = billingCycle === "yearly" && plan.yearly_price ? plan.yearly_price : plan.price;
              return (
                <motion.div key={plan.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                  className={`relative bg-white rounded-2xl border p-6 shadow-sm hover:shadow-md transition-all ${plan.is_popular ? "border-violet-400 ring-2 ring-violet-200" : "border-gray-200"}`}>
                  {plan.is_popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                      <Star className="w-3 h-3" /> Most Popular
                    </div>
                  )}
                  <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center mb-4">
                    <Mail className="w-5 h-5 text-violet-600" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-3xl font-bold text-gray-900">PKR {Number(price).toLocaleString()}</span>
                    <span className="text-sm text-gray-400">/{billingCycle === "yearly" ? "yr" : "mo"}</span>
                  </div>
                  <div className="space-y-2.5 mb-6">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <HardDrive className="w-4 h-4 text-violet-400" />
                      {plan.max_storage_gb} GB Storage
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="w-4 h-4 text-violet-400" />
                      {plan.max_mailboxes >= 999 ? "Unlimited" : plan.max_mailboxes} Mailboxes
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Shield className="w-4 h-4 text-violet-400" />
                      Spam & Virus Protection
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Globe className="w-4 h-4 text-violet-400" />
                      Custom Domain Email
                    </div>
                  </div>
                  <a href={`https://noehost.com/checkout/email-hosting?plan=${plan.id}&cycle=${billingCycle}`}
                    className={`block w-full py-3 rounded-xl text-center font-semibold text-sm transition-all ${plan.is_popular ? "bg-violet-600 hover:bg-violet-700 text-white shadow shadow-violet-200" : "bg-gray-50 hover:bg-violet-50 text-violet-600 border border-violet-200"}`}>
                    <ShoppingCart className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                    Get Started
                  </a>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Features grid */}
        <div className="mt-16 grid md:grid-cols-3 gap-6">
          {[
            { icon: Shield, title: "Enterprise Security", desc: "SPF, DKIM, DMARC protection included. Spam filtering on every mailbox." },
            { icon: Zap, title: "Instant Setup", desc: "DNS records auto-configured. Your email is ready in minutes." },
            { icon: Globe, title: "Any Domain", desc: "Use any domain you own. We handle the technical setup for you." },
          ].map((f, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center mb-3">
                <f.icon className="w-5 h-5 text-violet-600" />
              </div>
              <h3 className="font-bold text-gray-800 mb-1">{f.title}</h3>
              <p className="text-sm text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Manage Single Order ──────────────────────────────────────────────────────
function ManagePage({ orderId, onBack }: { orderId: string; onBack: () => void }) {
  const [order, setOrder] = useState<any>(null);
  const [mailboxes, setMailboxes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mbLoading, setMbLoading] = useState(false);
  const [tab, setTab] = useState<"mailboxes" | "dns" | "settings">("mailboxes");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ local_part: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [webmailLoading, setWebmailLoading] = useState<string | null>(null);
  const [dnsOpen, setDnsOpen] = useState<string>("mx");
  const [toast, setToast] = useState<{ msg: string; type?: "ok" | "err" } | null>(null);

  function showToast(msg: string, type: "ok" | "err" = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  const loadOrder = useCallback(async () => {
    try {
      const data = await apiFetch(`${API}/my/email-orders/${orderId}`);
      setOrder(data);
    } catch (e: any) { showToast(e.message, "err"); }
  }, [orderId]);

  const loadMailboxes = useCallback(async () => {
    setMbLoading(true);
    try {
      const data = await apiFetch(`${API}/my/email-orders/${orderId}/mailboxes`);
      setMailboxes(data);
    } catch (e: any) { showToast(e.message, "err"); }
    finally { setMbLoading(false); }
  }, [orderId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadOrder(), loadMailboxes()]).finally(() => setLoading(false));
  }, [orderId]);

  async function handleCreate() {
    if (!createForm.local_part || !createForm.password) { showToast("Fill in all fields", "err"); return; }
    setCreating(true);
    try {
      await apiFetch(`${API}/my/email-orders/${orderId}/mailboxes`, { method: "POST", body: JSON.stringify(createForm) });
      showToast("Mailbox created successfully");
      setShowCreate(false);
      setCreateForm({ local_part: "", password: "" });
      await loadMailboxes();
    } catch (e: any) { showToast(e.message, "err"); }
    finally { setCreating(false); }
  }

  async function handleDelete(mbId: string) {
    setDeletingId(mbId);
    try {
      await apiFetch(`${API}/my/email-orders/${orderId}/mailboxes/${mbId}`, { method: "DELETE" });
      showToast("Mailbox deleted");
      setMailboxes(m => m.filter(x => x.id !== mbId));
    } catch (e: any) { showToast(e.message, "err"); }
    finally { setDeletingId(null); }
  }

  async function handleWebmail(emailAddress: string) {
    setWebmailLoading(emailAddress);
    try {
      const data = await apiFetch(`${API}/my/email-orders/${orderId}/webmail-login`, {
        method: "POST", body: JSON.stringify({ email_address: emailAddress }),
      });
      if (data.url) window.open(data.url, "_blank", "noopener");
      else showToast("Webmail URL not available — configure your cPanel/20i server.", "err");
    } catch (e: any) { showToast(e.message, "err"); }
    finally { setWebmailLoading(null); }
  }

  const dnsGroups = order ? [
    { key: "mx", label: "MX Records", icon: Mail, records: order.dns_records?.mx ?? [] },
    { key: "spf", label: "SPF Record", icon: Shield, records: order.dns_records?.spf ?? [] },
    { key: "dkim", label: "DKIM Record", icon: Shield, records: order.dns_records?.dkim ?? [] },
    { key: "dmarc", label: "DMARC Record", icon: Shield, records: order.dns_records?.dmarc ?? [] },
    { key: "autoconfig", label: "Mail Client (IMAP/SMTP)", icon: Server, records: order.dns_records?.autoconfig ?? [] },
  ] : [];

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
    </div>
  );

  if (!order) return (
    <div className="max-w-xl mx-auto text-center py-24">
      <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
      <p className="text-gray-500 font-medium">Order not found</p>
      <button onClick={onBack} className="mt-4 text-violet-600 text-sm font-medium hover:underline">← Back</button>
    </div>
  );

  const usedMb = Number(order.used_mb ?? 0);
  const quotaMb = Number(order.quota_mb ?? (order.max_storage_gb * 1024));
  const pct = quotaMb > 0 ? Math.min(100, (usedMb / quotaMb) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-medium flex items-center gap-2 ${toast.type === "err" ? "bg-red-50 border border-red-200 text-red-700" : "bg-white border border-green-200 text-green-700"}`}>
            {toast.type === "err" ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
              <Mail className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{order.domain_name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm text-gray-400">{order.package_name}</span>
                <StatusBadge status={order.status} />
              </div>
            </div>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow shadow-violet-200">
          <Plus className="w-4 h-4" /> New Mailbox
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Mailboxes", value: mailboxes.length, sub: `of ${order.max_mailboxes}` },
          { label: "Storage", value: `${order.max_storage_gb} GB`, sub: "total quota" },
          { label: "Used", value: usedMb < 1024 ? `${usedMb} MB` : `${(usedMb / 1024).toFixed(1)} GB`, sub: `${pct.toFixed(0)}% used` },
          { label: "Billing", value: order.billing_cycle, sub: "cycle" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm">
            <div className="text-lg font-bold text-gray-900 capitalize">{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
            <div className="text-xs text-gray-300">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Storage bar */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex justify-between text-xs text-gray-500 mb-2">
          <span>Storage Usage</span>
          <span className="font-medium text-gray-700">{pct.toFixed(1)}% used</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }}
            className={`h-full rounded-full ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-violet-500"}`} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([["mailboxes", "Mailboxes"], ["dns", "DNS Setup"], ["settings", "Settings"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {l}
          </button>
        ))}
      </div>

      {/* ── Mailboxes tab ── */}
      {tab === "mailboxes" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">Email Accounts</h2>
            <button onClick={loadMailboxes} className="text-gray-400 hover:text-gray-600 transition-colors">
              <RefreshCw className={`w-4 h-4 ${mbLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
          {mbLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>
          ) : mailboxes.length === 0 ? (
            <div className="py-20 text-center text-gray-400">
              <Mail className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium text-gray-500">No mailboxes yet</p>
              <p className="text-sm mt-1">Click "New Mailbox" to create your first email account</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {mailboxes.map(mb => (
                <motion.div key={mb.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-violet-50 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-violet-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 text-sm truncate">{mb.email_address}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {mb.quota_mb >= 1024 ? `${(mb.quota_mb / 1024).toFixed(0)} GB` : `${mb.quota_mb} MB`} quota • Active
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => handleWebmail(mb.email_address)} disabled={webmailLoading === mb.email_address}
                      className="flex items-center gap-1.5 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-2 rounded-lg transition-colors disabled:opacity-60">
                      {webmailLoading === mb.email_address
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <ExternalLink className="w-3.5 h-3.5" />}
                      Webmail
                    </button>
                    <button onClick={() => handleDelete(mb.id)} disabled={deletingId === mb.id}
                      className="p-2 text-gray-300 hover:text-red-400 transition-colors">
                      {deletingId === mb.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DNS tab ── */}
      {tab === "dns" && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
            <span><strong>Add these records</strong> at your domain registrar to activate email. DNS changes take 1–48 hours.</span>
          </div>
          {dnsGroups.map(g => (
            <div key={g.key} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <button onClick={() => setDnsOpen(dnsOpen === g.key ? "" : g.key)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <g.icon className="w-4 h-4 text-violet-400" />
                  <span className="font-semibold text-gray-800 text-sm">{g.label}</span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{g.records.length}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${dnsOpen === g.key ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {dnsOpen === g.key && (
                  <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="border-t border-gray-100 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>{["Type", "Host", "Value", "TTL"].map(h => (
                            <th key={h} className="px-4 py-2 text-left text-gray-500 font-semibold uppercase tracking-wide">{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {g.records.map((r: any, i: number) => (
                            <tr key={i} className="hover:bg-gray-50/50">
                              <td className="px-4 py-3"><span className="font-mono bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded text-xs">{r.type}</span></td>
                              <td className="px-4 py-3 font-mono text-gray-500">{r.host || r.priority}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1 max-w-xs">
                                  <span className="font-mono text-gray-700 truncate">{r.value}</span>
                                  <CopyBtn value={r.value} />
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-400">{r.ttl}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {/* ── Settings tab ── */}
      {tab === "settings" && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h3 className="font-bold text-gray-900">IMAP Settings</h3>
            <div className="space-y-3 text-sm">
              {[
                { label: "Server", value: "mail.noemail.noehost.com" },
                { label: "Port", value: "993 (SSL)" },
                { label: "Encryption", value: "SSL/TLS" },
                { label: "Username", value: "your@domain.com" },
              ].map(s => (
                <div key={s.label} className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-gray-500">{s.label}</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono font-medium text-gray-800">{s.value}</span>
                    {!s.value.includes("your@") && <CopyBtn value={s.value} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h3 className="font-bold text-gray-900">SMTP Settings</h3>
            <div className="space-y-3 text-sm">
              {[
                { label: "Server", value: "mail.noemail.noehost.com" },
                { label: "Port", value: "587 (STARTTLS)" },
                { label: "Encryption", value: "STARTTLS" },
                { label: "Username", value: "your@domain.com" },
              ].map(s => (
                <div key={s.label} className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-gray-500">{s.label}</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono font-medium text-gray-800">{s.value}</span>
                    {!s.value.includes("your@") && <CopyBtn value={s.value} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="md:col-span-2 bg-violet-50 border border-violet-100 rounded-2xl p-5 flex items-start gap-3">
            <Info className="w-5 h-5 text-violet-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-violet-800">
              <strong>Use these settings in any email client</strong> (Outlook, Thunderbird, Apple Mail, Gmail).
              Your username is your full email address and your password is the mailbox password you set.
            </div>
          </div>
        </div>
      )}

      {/* ── Create Mailbox Modal ── */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-violet-600" /> Create Mailbox
                </h2>
                <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Email Address</label>
                  <div className="flex border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-violet-400/30 focus-within:border-violet-400">
                    <input
                      className="flex-1 px-3 py-3 bg-transparent text-sm text-gray-900 outline-none"
                      placeholder="username"
                      value={createForm.local_part}
                      onChange={e => setCreateForm(f => ({ ...f, local_part: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "") }))}
                    />
                    <div className="px-3 py-3 bg-gray-50 text-sm text-gray-400 border-l border-gray-200 whitespace-nowrap">
                      @{order.domain_name}
                    </div>
                  </div>
                  {createForm.local_part && (
                    <p className="text-xs text-gray-400 mt-1.5 ml-1">→ <span className="text-violet-600 font-medium">{createForm.local_part}@{order.domain_name}</span></p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Password</label>
                  <div className="flex border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-violet-400/30 focus-within:border-violet-400">
                    <input
                      type={showPwd ? "text" : "password"}
                      className="flex-1 px-3 py-3 bg-transparent text-sm text-gray-900 outline-none"
                      placeholder="Strong password"
                      value={createForm.password}
                      onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                    />
                    <button type="button" onClick={() => setShowPwd(p => !p)}
                      className="px-3 text-gray-400 hover:text-gray-600 border-l border-gray-200">
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={handleCreate} disabled={creating}
                  className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create Mailbox
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ user, onManage, onLogout, onPlans }: { user: any; onManage: (id: string) => void; onLogout: () => void; onPlans: () => void }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`${API}/my/email-orders`)
      .then(setOrders)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} onLogout={onLogout} />
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">

        {/* Welcome */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Welcome, {(user.name || user.email).split(" ")[0]} 👋</h1>
            <p className="text-gray-500 text-sm mt-1">Manage your business email subscriptions</p>
          </div>
          <button onClick={onPlans}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow shadow-violet-200">
            <Plus className="w-4 h-4" /> New Email Plan
          </button>
        </div>

        {/* Orders */}
        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-violet-400" /></div>
        ) : orders.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border-2 border-dashed border-gray-200 text-center py-24 px-6">
            <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-violet-500" />
            </div>
            <h3 className="font-bold text-gray-800 mb-2 text-lg">No email hosting yet</h3>
            <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
              Get a professional business email with your own domain. Looks more credible than a free address.
            </p>
            <button onClick={onPlans}
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors shadow shadow-violet-200">
              <Globe className="w-4 h-4" /> Explore Plans
            </button>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {orders.map((order, i) => (
              <motion.div key={order.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer p-5 flex items-center gap-4"
                onClick={() => {
                  if (order.status === "pending_payment") window.location.href = "https://noehost.com/dashboard/billing";
                  else if (order.status === "pending_dns") window.location.href = `https://noehost.com/checkout/email-hosting/dns/${order.id}`;
                  else onManage(order.id);
                }}>

                <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-6 h-6 text-violet-500" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900">{order.domain_name}</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-400 flex-wrap">
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{order.package_name || "Email Plan"}</span>
                    <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" />{order.max_storage_gb} GB</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{order.max_mailboxes >= 999 ? "Unlimited" : order.max_mailboxes} mailboxes</span>
                    <span className="capitalize">{order.billing_cycle}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="font-bold text-gray-800 text-sm">PKR {Number(order.amount_paid).toLocaleString()}</div>
                    <div className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString()}</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-violet-500 transition-colors" />
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Info cards */}
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: Zap, title: "One-click Webmail", desc: "Access your inbox instantly from any browser" },
            { icon: Shield, title: "Spam Protection", desc: "Advanced filters block phishing & malware" },
            { icon: Server, title: "IMAP & SMTP", desc: "Works with Outlook, Gmail, Apple Mail & more" },
          ].map((c, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                <c.icon className="w-4 h-4 text-violet-500" />
              </div>
              <div>
                <div className="font-semibold text-gray-800 text-sm">{c.title}</div>
                <div className="text-xs text-gray-400 mt-0.5">{c.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
type Page = "login" | "dashboard" | "manage" | "plans";

export default function NoeMailApp() {
  const [page, setPage] = useState<Page>("login");
  const [user, setUser] = useState<any>(null);
  const [manageOrderId, setManageOrderId] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("noemail_token") || localStorage.getItem("token") || localStorage.getItem("noehost_token");
    if (!token) return;
    apiFetch(`${API}/auth/me`, {}, token)
      .then(u => { setUser(u); setPage("dashboard"); })
      .catch(() => {
        localStorage.removeItem("noemail_token");
      });
  }, []);

  function handleLogin(u: any, _token: string) {
    setUser(u);
    setPage("dashboard");
  }

  function handleLogout() {
    localStorage.removeItem("noemail_token");
    setUser(null);
    setPage("login");
  }

  function handleManage(id: string) {
    setManageOrderId(id);
    setPage("manage");
  }

  return (
    <div className="font-sans antialiased">
      <AnimatePresence mode="wait">
        {page === "login" && (
          <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <LoginPage onLogin={handleLogin} />
          </motion.div>
        )}

        {page === "plans" && (
          <motion.div key="plans" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <Navbar user={user} onLogout={handleLogout} onBack={() => setPage(user ? "dashboard" : "login")} />
            <PlansPage onBack={() => setPage(user ? "dashboard" : "login")} />
          </motion.div>
        )}

        {page === "dashboard" && user && (
          <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <Dashboard user={user} onManage={handleManage} onLogout={handleLogout} onPlans={() => setPage("plans")} />
          </motion.div>
        )}

        {page === "manage" && user && manageOrderId && (
          <motion.div key="manage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <Navbar user={user} onLogout={handleLogout} onBack={() => setPage("dashboard")} />
            <div className="min-h-screen bg-gray-50 py-8">
              <ManagePage orderId={manageOrderId} onBack={() => setPage("dashboard")} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
