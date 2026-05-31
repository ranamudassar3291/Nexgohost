import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Plus, Loader2, HardDrive, ExternalLink, RefreshCw,
  Copy, Check, ChevronDown, Info, Globe, Server, Trash2,
  ArrowLeft, Shield, Zap, X, Eye, EyeOff, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const API = "/api";

function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token") || localStorage.getItem("noehost_token");
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts?.headers ?? {}),
    },
  }).then(async (r) => {
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Request failed");
    return d;
  });
}

interface Mailbox {
  id: string;
  email_address: string;
  quota_mb: number;
  status: string;
  created_at: string;
}

interface Order {
  id: string;
  domain_name: string;
  status: string;
  package_name: string;
  max_storage_gb: number;
  max_mailboxes: number;
  used_mb: number;
  quota_mb: number;
  billing_cycle: string;
  dns_records: {
    mx: any[];
    spf: any[];
    dkim: any[];
    dmarc: any[];
    autoconfig: any[];
  };
}

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      className="ml-1 p-1 text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function StorageGauge({ usedMb, quotaMb }: { usedMb: number; quotaMb: number }) {
  const pct = quotaMb > 0 ? Math.min(100, (usedMb / quotaMb) * 100) : 0;
  const color = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-indigo-500";
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Storage Used</span>
        <span className="font-medium text-foreground">
          {usedMb < 1024 ? `${usedMb} MB` : `${(usedMb / 1024).toFixed(1)} GB`}
          {" / "}
          {quotaMb < 1024 ? `${quotaMb} MB` : `${(quotaMb / 1024).toFixed(1)} GB`}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`} />
      </div>
      <div className="text-xs text-muted-foreground text-right">{pct.toFixed(1)}% used</div>
    </div>
  );
}

function DnsRecordRow({ record }: { record: any }) {
  return (
    <tr className="border-b border-border/40 hover:bg-muted/10 transition-colors">
      <td className="px-3 py-2.5">
        <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">{record.type}</span>
      </td>
      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{record.host || record.priority}</td>
      <td className="px-3 py-2.5 font-mono text-xs text-foreground break-all">
        <div className="flex items-center gap-1">
          <span className="truncate max-w-[280px]">{record.value}</span>
          <CopyBtn value={record.value} />
        </div>
      </td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">{record.ttl}</td>
    </tr>
  );
}

export default function NoEmailManage() {
  const { order_id } = useParams<{ order_id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [mbLoading, setMbLoading] = useState(false);
  const [tab, setTab] = useState<"mailboxes" | "dns" | "overview">("mailboxes");

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ local_part: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [webmailLoading, setWebmailLoading] = useState<string | null>(null);
  const [dnsOpen, setDnsOpen] = useState<string>("mx");

  const loadOrder = useCallback(async () => {
    try {
      const data = await apiFetch(`${API}/my/email-orders/${order_id}`);
      setOrder(data);
    } catch (e: any) {
      toast({ title: "Failed to load order", description: e.message, variant: "destructive" });
    }
  }, [order_id]);

  const loadMailboxes = useCallback(async () => {
    setMbLoading(true);
    try {
      const data = await apiFetch(`${API}/my/email-orders/${order_id}/mailboxes`);
      setMailboxes(data);
    } catch (e: any) {
      toast({ title: "Failed to load mailboxes", description: e.message, variant: "destructive" });
    } finally {
      setMbLoading(false);
    }
  }, [order_id]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadOrder(), loadMailboxes()]).finally(() => setLoading(false));
  }, [order_id]);

  async function handleCreateMailbox() {
    if (!createForm.local_part || !createForm.password) {
      toast({ title: "Fill in all fields", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await apiFetch(`${API}/my/email-orders/${order_id}/mailboxes`, {
        method: "POST",
        body: JSON.stringify(createForm),
      });
      toast({ title: "Mailbox created successfully" });
      setShowCreate(false);
      setCreateForm({ local_part: "", password: "" });
      await loadMailboxes();
    } catch (e: any) {
      toast({ title: "Error creating mailbox", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteMailbox(mbId: string) {
    setDeletingId(mbId);
    try {
      await apiFetch(`${API}/my/email-orders/${order_id}/mailboxes/${mbId}`, { method: "DELETE" });
      toast({ title: "Mailbox deleted" });
      setMailboxes(ms => ms.filter(m => m.id !== mbId));
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleWebmailLogin(emailAddress: string) {
    setWebmailLoading(emailAddress);
    try {
      const data = await apiFetch(`${API}/my/email-orders/${order_id}/webmail-login`, {
        method: "POST",
        body: JSON.stringify({ email_address: emailAddress }),
      });
      if (data.url) window.open(data.url, "_blank", "noopener");
    } catch (e: any) {
      toast({ title: "Webmail login failed", description: e.message, variant: "destructive" });
    } finally {
      setWebmailLoading(null);
    }
  }

  const STATUS_BADGE: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    pending_dns: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    suspended: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p className="font-medium">Order not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/client/email")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Email
        </Button>
      </div>
    );
  }

  const dnsGroups = [
    { key: "mx", label: "MX Records", icon: Mail, records: order.dns_records?.mx ?? [] },
    { key: "spf", label: "SPF Record", icon: Shield, records: order.dns_records?.spf ?? [] },
    { key: "dkim", label: "DKIM Record", icon: Shield, records: order.dns_records?.dkim ?? [] },
    { key: "dmarc", label: "DMARC Record", icon: Shield, records: order.dns_records?.dmarc ?? [] },
    { key: "autoconfig", label: "Mail Client Records", icon: Server, records: order.dns_records?.autoconfig ?? [] },
  ];

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate("/client/email")}
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <Mail className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{order.domain_name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm text-muted-foreground">{order.package_name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_BADGE[order.status] ?? "bg-muted text-muted-foreground border-border"}`}>
                  {order.status.replace("_", " ")}
                </span>
              </div>
            </div>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> New Mailbox
        </Button>
      </div>

      {/* Storage gauge */}
      <div className="bg-card border border-border rounded-xl p-5">
        <StorageGauge usedMb={Number(order.used_mb ?? 0)} quotaMb={Number(order.quota_mb ?? (order.max_storage_gb * 1024))} />
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border/50">
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">{mailboxes.length}</div>
            <div className="text-xs text-muted-foreground">Active Mailboxes</div>
          </div>
          <div className="text-center border-x border-border/50">
            <div className="text-lg font-bold text-foreground">{order.max_mailboxes}</div>
            <div className="text-xs text-muted-foreground">Max Allowed</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">{order.max_storage_gb} GB</div>
            <div className="text-xs text-muted-foreground">Total Storage</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-lg w-fit">
        {([["mailboxes", "Mailboxes"], ["dns", "DNS Setup"], ["overview", "Overview"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Mailboxes ── */}
      {tab === "mailboxes" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Email Accounts</h2>
            <button onClick={loadMailboxes} className="text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className={`w-4 h-4 ${mbLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
          {mbLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : mailboxes.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No mailboxes yet</p>
              <p className="text-sm mt-1">Click "+ New Mailbox" to create your first email account.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/20">
                <tr>
                  {["Email Address", "Storage Quota", "Status", "Actions"].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mailboxes.map(mb => (
                  <motion.tr key={mb.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
                          <Mail className="w-4 h-4 text-indigo-500" />
                        </div>
                        <span className="font-medium text-foreground">{mb.email_address}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {mb.quota_mb >= 1024 ? `${(mb.quota_mb / 1024).toFixed(0)} GB` : `${mb.quota_mb} MB`}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-medium">
                        Active
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => handleWebmailLogin(mb.email_address)}
                          disabled={webmailLoading === mb.email_address}
                          className="gap-1.5 h-8 text-xs bg-indigo-600 hover:bg-indigo-700">
                          {webmailLoading === mb.email_address
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Zap className="w-3.5 h-3.5" />}
                          Login to Webmail
                        </Button>
                        <button onClick={() => handleDeleteMailbox(mb.id)}
                          disabled={deletingId === mb.id}
                          className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors">
                          {deletingId === mb.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── DNS Setup ── */}
      {tab === "dns" && (
        <div className="space-y-4">
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex gap-3">
            <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Add these DNS records</span> at your domain registrar to complete your email infrastructure setup.
              Changes may take up to 24–48 hours to propagate.
            </div>
          </div>

          {dnsGroups.map(group => (
            <div key={group.key} className="bg-card border border-border rounded-xl overflow-hidden">
              <button onClick={() => setDnsOpen(dnsOpen === group.key ? "" : group.key)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/10 transition-colors">
                <div className="flex items-center gap-3">
                  <group.icon className="w-4 h-4 text-indigo-400" />
                  <span className="font-semibold text-foreground">{group.label}</span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{group.records.length} record{group.records.length !== 1 ? "s" : ""}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${dnsOpen === group.key ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {dnsOpen === group.key && (
                  <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                    className="overflow-hidden">
                    <div className="border-t border-border overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/20">
                          <tr>
                            {["Type", "Host / Priority", "Value", "TTL"].map(h => (
                              <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {group.records.map((r, i) => <DnsRecordRow key={i} record={r} />)}
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

      {/* ── Overview ── */}
      {tab === "overview" && (
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { label: "Domain", value: order.domain_name, icon: Globe },
            { label: "Package", value: order.package_name, icon: Mail },
            { label: "Billing Cycle", value: order.billing_cycle, icon: RefreshCw },
            { label: "Max Mailboxes", value: `${order.max_mailboxes}`, icon: Mail },
            { label: "Storage Quota", value: `${order.max_storage_gb} GB`, icon: HardDrive },
            { label: "Status", value: order.status.replace("_", " "), icon: Shield },
          ].map(item => (
            <div key={item.label} className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <item.icon className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">{item.label}</div>
                <div className="font-semibold text-foreground capitalize">{item.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create Mailbox Modal ── */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Plus className="w-5 h-5 text-indigo-500" /> Create New Mailbox
                </h2>
                <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email Address</label>
                  <div className="flex items-center border border-border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/30">
                    <input
                      className="flex-1 px-3 py-2.5 bg-transparent text-sm text-foreground outline-none"
                      placeholder="username"
                      value={createForm.local_part}
                      onChange={e => setCreateForm(f => ({ ...f, local_part: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "") }))}
                    />
                    <div className="px-3 py-2.5 bg-muted text-sm text-muted-foreground border-l border-border whitespace-nowrap">
                      @{order.domain_name}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Password</label>
                  <div className="flex items-center border border-border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/30">
                    <input
                      type={showPwd ? "text" : "password"}
                      className="flex-1 px-3 py-2.5 bg-transparent text-sm text-foreground outline-none"
                      placeholder="Strong password"
                      value={createForm.password}
                      onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                    />
                    <button type="button" onClick={() => setShowPwd(p => !p)}
                      className="px-3 py-2.5 text-muted-foreground hover:text-foreground transition-colors">
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {createForm.local_part && (
                  <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                    Full address: <span className="text-foreground font-medium">{createForm.local_part}@{order.domain_name}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowCreate(false)} className="flex-1">Cancel</Button>
                <Button onClick={handleCreateMailbox} disabled={creating} className="flex-1 bg-indigo-600 hover:bg-indigo-700 gap-2">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create Mailbox
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
