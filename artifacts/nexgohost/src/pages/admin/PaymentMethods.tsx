import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, Plus, ToggleLeft, ToggleRight, Trash2, Loader2, TestTube, CheckCircle, XCircle, ChevronDown, ChevronUp, Settings2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface PaymentMethod {
  id: string; name: string; type: string; description: string | null;
  isActive: boolean; isSandbox: boolean; createdAt: string;
  settings?: Record<string, string>;
}

const TYPES = [
  { value: "safepay",       label: "Safepay",         icon: "🔐" },
  { value: "jazzcash",      label: "JazzCash",        icon: "📱" },
  { value: "easypaisa",     label: "EasyPaisa",       icon: "💚" },
  { value: "bank_transfer", label: "Bank Transfer",   icon: "🏦" },
  { value: "paypal",        label: "PayPal",          icon: "🅿️" },
  { value: "stripe",        label: "Stripe",          icon: "💳" },
  { value: "crypto",        label: "Cryptocurrency",  icon: "₿" },
  { value: "manual",        label: "Manual / Other",  icon: "✍️" },
];

const TYPE_MAP = Object.fromEntries(TYPES.map(t => [t.value, t]));

const SETTINGS_FIELDS: Record<string, { key: string; label: string; placeholder: string; secret?: boolean; hint?: string }[]> = {
  safepay: [
    { key: "sandboxPublicKey", label: "Sandbox Client Key",  placeholder: "sec_xxxxxxxx or pub_xxxxxxxx", hint: "From Safepay Sandbox Dashboard → Developers → API Keys → Client/Merchant Key" },
    { key: "sandboxSecretKey", label: "Sandbox Secret Key",  placeholder: "Raw hex or sec_xxx key", secret: true, hint: "From Safepay Sandbox Dashboard → Developers → API Keys → Secret Key" },
    { key: "livePublicKey",    label: "Live Client Key",     placeholder: "sec_xxxxxxxx or pub_xxxxxxxx", hint: "From Safepay Live Dashboard → Developers → API Keys → Client/Merchant Key (sent as 'client' in the API body)" },
    { key: "liveSecretKey",    label: "Live Secret Key",     placeholder: "Raw hex or sec_xxx key", secret: true, hint: "From Safepay Live Dashboard → Developers → API Keys → Secret Key (sent as X-SFPY-SECRET-KEY header)" },
    { key: "webhookSecret",    label: "Webhook Shared Secret", placeholder: "Enter your webhook secret", secret: true, hint: "From Safepay Dashboard → Developers → Webhooks → Shared Secret" },
  ],
  jazzcash: [
    { key: "mobileNumber",  label: "JazzCash Mobile Number",  placeholder: "03XX-XXXXXXX" },
    { key: "accountTitle",  label: "Account Title",            placeholder: "Your Name" },
    { key: "merchantId",    label: "Merchant ID (optional)",   placeholder: "For API verification", secret: true },
  ],
  easypaisa: [
    { key: "mobileNumber",  label: "EasyPaisa Mobile Number", placeholder: "03XX-XXXXXXX" },
    { key: "accountTitle",  label: "Account Title",            placeholder: "Your Name" },
  ],
  bank_transfer: [
    { key: "bankName",       label: "Bank Name",       placeholder: "Meezan Bank / HBL / UBL" },
    { key: "accountTitle",   label: "Account Title",   placeholder: "Noehost (Pvt) Ltd" },
    { key: "accountNumber",  label: "Account Number",  placeholder: "0123456789" },
    { key: "iban",           label: "IBAN",            placeholder: "PK00XXXX0000000000000000" },
    { key: "swiftCode",      label: "SWIFT/BIC Code",  placeholder: "MEZNPKKA (optional)" },
  ],
  paypal: [
    { key: "paypalEmail",    label: "PayPal Email",     placeholder: "payments@yourdomain.com" },
    { key: "clientId",       label: "Client ID (optional)", placeholder: "For automated verification", secret: true },
    { key: "clientSecret",   label: "Client Secret",    placeholder: "Secret key", secret: true },
  ],
  stripe: [
    { key: "publishableKey", label: "Publishable Key", placeholder: "pk_live_..." },
    { key: "secretKey",      label: "Secret Key",      placeholder: "sk_live_...", secret: true },
    { key: "webhookSecret",  label: "Webhook Secret",  placeholder: "whsec_...", secret: true },
  ],
  crypto: [
    { key: "walletAddress",  label: "Wallet Address",  placeholder: "bc1qxxxxxxxxxxxxxxxxxx" },
    { key: "cryptoType",     label: "Cryptocurrency",  placeholder: "Bitcoin / USDT (TRC20) / ETH" },
  ],
  manual: [
    { key: "instructions",   label: "Payment Instructions", placeholder: "e.g. Send payment to WhatsApp: 03XXXXXXXXX" },
  ],
};

const EMPTY_FORM = { name: "", type: "jazzcash", description: "", isSandbox: false };

export default function PaymentMethods() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: methods = [], isLoading } = useQuery<PaymentMethod[]>({
    queryKey: ["admin-payment-methods"],
    queryFn: () => apiFetch("/api/admin/payment-methods"),
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editSettings, setEditSettings] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingConfig, setTestingConfig] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const toggleMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/payment-methods/${id}/toggle`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-payment-methods"] }),
    onError: () => toast({ title: "Error", description: "Failed to toggle", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/payment-methods/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-payment-methods"] }); toast({ title: "Payment method removed" }); },
    onError: () => toast({ title: "Error", description: "Failed to delete", variant: "destructive" }),
  });

  const currentFields = SETTINGS_FIELDS[form.type] ?? [];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.type) return;
    setAdding(true);
    try {
      await apiFetch("/api/admin/payment-methods", {
        method: "POST",
        body: JSON.stringify({ ...form, settings }),
      });
      qc.invalidateQueries({ queryKey: ["admin-payment-methods"] });
      toast({ title: "Payment gateway added", description: form.name });
      setForm(EMPTY_FORM);
      setSettings({});
      setShowForm(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleSaveSettings = async (method: PaymentMethod) => {
    setSavingSettings(true);
    try {
      await apiFetch(`/api/admin/payment-methods/${method.id}`, {
        method: "PUT",
        body: JSON.stringify({ settings: editSettings }),
      });
      qc.invalidateQueries({ queryKey: ["admin-payment-methods"] });
      toast({ title: "Settings saved", description: method.name });
      setEditId(null);
      setTestResult(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestConfig = async (method: PaymentMethod) => {
    setTestResult(null);

    const isSandbox = method.isSandbox;
    const publicKey = isSandbox ? (editSettings["sandboxPublicKey"] ?? "") : (editSettings["livePublicKey"] ?? "");
    const secretKey = isSandbox ? (editSettings["sandboxSecretKey"] ?? "") : (editSettings["liveSecretKey"] ?? "");

    // ── Require both keys to be present ────────────────────────────────────
    if (!publicKey || !secretKey) {
      setTestResult({ ok: false, message: "Please enter both Client Key and Secret Key before testing." });
      return;
    }

    // ── Live API call to Safepay ─────────────────────────────────────────────
    setTestingConfig(true);
    try {
      const params = new URLSearchParams({ publicKey, secretKey, isSandbox: String(isSandbox) });
      const res = await apiFetch(`/api/payments/safepay/test?${params}`);
      setTestResult({ ok: !!res?.ok, message: res?.message ?? res?.error ?? "Unknown result" });
    } catch (err: any) {
      setTestResult({ ok: false, message: err?.message ?? "Network error — could not reach server." });
    } finally {
      setTestingConfig(false);
    }
  };

  const startEdit = (method: PaymentMethod) => {
    setEditId(method.id);
    setEditSettings({ ...(method.settings ?? {}) });
    setExpandedId(method.id);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Payment Gateways</h1>
          <p className="text-muted-foreground text-sm">Configure payment methods shown to clients on invoices</p>
        </div>
        <Button onClick={() => { setShowForm(!showForm); setSettings({}); }} className="bg-primary hover:bg-primary/90 gap-2">
          <Plus size={18} /> Add Gateway
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="bg-card border border-primary/20 rounded-2xl p-6 space-y-5">
            <h2 className="font-semibold text-foreground flex items-center gap-2"><CreditCard size={18} className="text-primary" /> Add Payment Gateway</h2>
            <form onSubmit={handleAdd} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">Display Name *</label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. JazzCash Mobile" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">Gateway Type *</label>
                  <select
                    value={form.type}
                    onChange={e => { setForm(f => ({ ...f, type: e.target.value })); setSettings({}); }}
                    className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    {TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Description (shown to clients)</label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Pay via JazzCash mobile wallet" />
              </div>

              {currentFields.length > 0 && (
                <div className="bg-secondary/40 rounded-xl p-4 space-y-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Gateway Configuration</p>
                  <div className="grid grid-cols-1 gap-3">
                    {currentFields.map(f => (
                      <div key={f.key} className="space-y-1">
                        <label className="text-sm font-medium text-foreground/70">{f.label}</label>
                        <Input
                          type={f.secret ? "password" : "text"}
                          value={settings[f.key] ?? ""}
                          onChange={e => setSettings(s => ({ ...s, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          className="bg-background"
                        />
                        {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <input type="checkbox" id="sandbox-add" checked={form.isSandbox} onChange={e => setForm(f => ({ ...f, isSandbox: e.target.checked }))} className="w-4 h-4 accent-primary" />
                <label htmlFor="sandbox-add" className="text-sm text-muted-foreground">Test / Sandbox mode (mark as testing)</label>
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={adding} className="bg-primary hover:bg-primary/90">
                  {adding ? <Loader2 size={16} className="animate-spin mr-1" /> : null} Add Gateway
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="animate-spin text-primary" size={32} /></div>
      ) : methods.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 bg-card border border-border rounded-2xl text-center">
          <CreditCard size={32} className="text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No payment gateways yet. Add one to start accepting payments.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {methods.map(m => {
            const typeInfo = TYPE_MAP[m.type] ?? { icon: "💳", label: m.type };
            const isExpanded = expandedId === m.id;
            const isEditing = editId === m.id;
            const fields = SETTINGS_FIELDS[m.type] ?? [];
            const hasSettings = Object.values(m.settings ?? {}).some(v => v);

            return (
              <div key={m.id} className={`bg-card border rounded-2xl overflow-hidden transition-all ${m.isActive ? "border-border" : "border-border/40 opacity-60"}`}>
                <div className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-2xl flex-shrink-0">
                    {typeInfo.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground truncate">{m.name}</h3>
                      <span className="text-xs px-2 py-0.5 bg-secondary text-muted-foreground rounded-full border border-border">{typeInfo.label}</span>
                      {m.isSandbox && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 rounded-full">
                          <TestTube size={10} /> Sandbox
                        </span>
                      )}
                      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${m.isActive ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-muted text-muted-foreground border-border"}`}>
                        {m.isActive ? <CheckCircle size={10} /> : <XCircle size={10} />}
                        {m.isActive ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                      {m.description ?? typeInfo.label}
                      {hasSettings && <span className="ml-2 text-xs text-emerald-500">● Configured</span>}
                      {!hasSettings && fields.length > 0 && <span className="ml-2 text-xs text-yellow-500">● Setup required</span>}
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    {fields.length > 0 && (
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setExpandedId(isExpanded ? null : m.id); if (!isExpanded) startEdit(m); }}>
                        <Settings2 size={13} />
                        Configure
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => toggleMutation.mutate(m.id)} className="gap-1.5 text-xs">
                      {m.isActive ? <ToggleRight size={14} className="text-green-400" /> : <ToggleLeft size={14} />}
                      {m.isActive ? "Disable" : "Enable"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remove this payment gateway?")) deleteMutation.mutate(m.id); }} className="text-destructive hover:text-destructive">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && fields.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border overflow-hidden"
                    >
                      <div className="p-5 bg-secondary/20 space-y-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                          <Settings2 size={13} /> Gateway Configuration
                        </p>
                        <div className="grid grid-cols-1 gap-3">
                          {fields.map(f => (
                            <div key={f.key} className="space-y-1">
                              <label className="text-sm font-medium text-foreground/70">{f.label}</label>
                              {isEditing ? (
                                <>
                                  <Input
                                    type={f.secret ? "password" : "text"}
                                    value={editSettings[f.key] ?? ""}
                                    onChange={e => setEditSettings(s => ({ ...s, [f.key]: e.target.value }))}
                                    placeholder={f.placeholder}
                                    className="bg-background"
                                  />
                                  {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
                                </>
                              ) : (
                                <div className="text-sm text-foreground/80 bg-background border border-border rounded-lg px-3 py-2">
                                  {f.secret
                                    ? (m.settings?.[f.key] ? "••••••••" : <span className="text-muted-foreground italic">Not configured</span>)
                                    : (m.settings?.[f.key] || <span className="text-muted-foreground italic">Not configured</span>)
                                  }
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {/* Test result banner (Safepay only) */}
                        {m.type === "safepay" && isEditing && testResult && (
                          <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm border ${testResult.ok ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-destructive/10 border-destructive/30 text-destructive"}`}>
                            {testResult.ok ? <CheckCircle size={15} className="mt-0.5 shrink-0" /> : <XCircle size={15} className="mt-0.5 shrink-0" />}
                            <span>{testResult.message}</span>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-3 pt-1">
                          {isEditing ? (
                            <>
                              <Button onClick={() => handleSaveSettings(m)} disabled={savingSettings} className="bg-primary hover:bg-primary/90 gap-2">
                                {savingSettings ? <Loader2 size={14} className="animate-spin" /> : null} Save Settings
                              </Button>
                              {m.type === "safepay" && (
                                <Button
                                  variant="outline"
                                  onClick={() => handleTestConfig(m)}
                                  disabled={testingConfig}
                                  className="gap-2"
                                >
                                  {testingConfig ? <Loader2 size={14} className="animate-spin" /> : <TestTube size={14} />}
                                  Test Configuration
                                </Button>
                              )}
                              <Button variant="outline" onClick={() => { setEditId(null); setExpandedId(null); setTestResult(null); }}>Cancel</Button>
                            </>
                          ) : (
                            <Button variant="outline" onClick={() => startEdit(m)} className="gap-2">
                              <Pencil size={14} /> Edit Settings
                            </Button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
