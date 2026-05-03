/**
 * WhatsApp Client Sync — Admin panel tab
 * Send Order Status alerts and Renewal Alerts directly to client WhatsApp numbers.
 * All sends are logged to whatsapp_client_notifications in PostgreSQL.
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle, Search, Send, Phone, Bell, ShoppingBag,
  CheckCircle, AlertCircle, Clock, Users, Zap, RefreshCw,
  ChevronDown, X, Loader2, Calendar, DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

async function apiFetch(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

interface Client {
  id: string; firstName: string; lastName: string; email: string; phone: string | null;
}
interface NotifLog {
  id: number; user_id: string; phone: string; event_type: string; message: string;
  status: string; error: string | null; sent_at: string; first_name: string; last_name: string; email: string;
}

const EVENT_COLORS: Record<string, string> = {
  order_status: "text-blue-500",
  renewal_alert: "text-amber-500",
  custom_message: "text-purple-500",
};
const EVENT_LABELS: Record<string, string> = {
  order_status: "Order Status",
  renewal_alert: "Renewal Alert",
  custom_message: "Custom Message",
};

export default function WhatsAppClientSync() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ─── state: shared ────────────────────────────────────────────────────────
  const [tab, setTab]         = useState<"order" | "renewal" | "bulk" | "custom" | "logs">("order");
  const [search, setSearch]   = useState("");
  const [selected, setSelected] = useState<Client | null>(null);
  const [dropOpen, setDropOpen] = useState(false);
  const [sending, setSending]  = useState(false);

  // ─── state: order status ──────────────────────────────────────────────────
  const [orderStatus, setOrderStatus]   = useState("active");
  const [orderDomain, setOrderDomain]   = useState("");
  const [orderPlan, setOrderPlan]       = useState("");
  const [orderId, setOrderId]           = useState("");
  const [orderCustomMsg, setOrderCustomMsg] = useState("");

  // ─── state: renewal alert ─────────────────────────────────────────────────
  const [renewalDate, setRenewalDate]   = useState("");
  const [renewalDomain, setRenewalDomain] = useState("");
  const [renewalAmount, setRenewalAmount] = useState("");
  const [renewalCurrency, setRenewalCurrency] = useState("PKR");
  const [renewalInvoiceId, setRenewalInvoiceId] = useState("");

  // ─── state: bulk ──────────────────────────────────────────────────────────
  const [bulkDays, setBulkDays] = useState("7");
  const [bulkResult, setBulkResult] = useState<{ sent: number; failed: number; skipped: number; total: number } | null>(null);

  // ─── state: custom ────────────────────────────────────────────────────────
  const [customMsg, setCustomMsg] = useState("");

  // ─── queries ──────────────────────────────────────────────────────────────
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["wa-clients"],
    queryFn:  () => apiFetch("/api/admin/whatsapp/clients"),
    staleTime: 60000,
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<NotifLog[]>({
    queryKey: ["wa-client-notifs"],
    queryFn:  () => apiFetch("/api/admin/whatsapp/client-notifications?limit=40"),
    refetchInterval: tab === "logs" ? 5000 : false,
    enabled: tab === "logs",
  });

  // ─── filter clients by search + must have phone ───────────────────────────
  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    return (
      (`${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
       c.email.toLowerCase().includes(q) ||
       (c.phone ?? "").includes(q))
    );
  });

  // ─── send handlers ────────────────────────────────────────────────────────
  const sendOrderStatus = async () => {
    if (!selected) { toast({ title: "Select a client first", variant: "destructive" }); return; }
    setSending(true);
    try {
      const data = await apiFetch("/api/admin/whatsapp/send-order-status", {
        method: "POST",
        body: JSON.stringify({
          clientId: selected.id, status: orderStatus,
          domain: orderDomain || undefined, planName: orderPlan || undefined,
          orderId: orderId || undefined, customMessage: orderCustomMsg || undefined,
        }),
      });
      toast({ title: data.success ? "Sent!" : "Not sent", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["wa-client-notifs"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSending(false); }
  };

  const sendRenewalAlert = async () => {
    if (!selected) { toast({ title: "Select a client first", variant: "destructive" }); return; }
    if (!renewalDate) { toast({ title: "Enter renewal date", variant: "destructive" }); return; }
    setSending(true);
    try {
      const data = await apiFetch("/api/admin/whatsapp/send-renewal-alert", {
        method: "POST",
        body: JSON.stringify({
          clientId: selected.id, renewalDate,
          domain: renewalDomain || undefined,
          amount: renewalAmount ? parseFloat(renewalAmount) : undefined,
          currency: renewalCurrency,
          invoiceId: renewalInvoiceId || undefined,
        }),
      });
      toast({ title: data.success ? "Sent!" : "Not sent", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["wa-client-notifs"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSending(false); }
  };

  const sendBulkRenewals = async () => {
    setSending(true);
    setBulkResult(null);
    try {
      const data = await apiFetch("/api/admin/whatsapp/bulk-renewal-alerts", {
        method: "POST",
        body: JSON.stringify({ daysAhead: parseInt(bulkDays) || 7 }),
      });
      setBulkResult({ sent: data.sent, failed: data.failed, skipped: data.skipped, total: data.total });
      toast({ title: `Bulk sent: ${data.sent} delivered, ${data.failed} failed` });
      queryClient.invalidateQueries({ queryKey: ["wa-client-notifs"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSending(false); }
  };

  const sendCustom = async () => {
    if (!selected) { toast({ title: "Select a client first", variant: "destructive" }); return; }
    if (!customMsg.trim()) { toast({ title: "Enter a message", variant: "destructive" }); return; }
    setSending(true);
    try {
      const data = await apiFetch("/api/admin/whatsapp/send-custom", {
        method: "POST",
        body: JSON.stringify({ clientId: selected.id, message: customMsg }),
      });
      toast({ title: data.success ? "Sent!" : "Not sent", description: data.message });
      setCustomMsg("");
      queryClient.invalidateQueries({ queryKey: ["wa-client-notifs"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSending(false); }
  };

  // ─── client picker ────────────────────────────────────────────────────────
  const ClientPicker = () => (
    <div className="relative">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Select Client</Label>
      <button
        onClick={() => setDropOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-sm hover:bg-muted/50 transition-colors"
      >
        <Users size={14} className="text-muted-foreground shrink-0" />
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>
          {selected ? `${selected.firstName} ${selected.lastName} — ${selected.phone ?? "No phone"}` : "Choose a client…"}
        </span>
        <ChevronDown size={14} className="ml-auto text-muted-foreground" />
      </button>
      <AnimatePresence>
        {dropOpen && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-xl overflow-hidden">
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients…"
                  className="pl-8 h-8 text-sm" autoFocus />
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto">
              {filtered.length === 0 && (
                <div className="p-3 text-center text-sm text-muted-foreground">No clients found</div>
              )}
              {filtered.slice(0, 25).map(c => (
                <button key={c.id} onClick={() => { setSelected(c); setDropOpen(false); setSearch(""); }}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/60 text-left transition-colors">
                  <div className="w-7 h-7 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center text-xs font-bold shrink-0">
                    {c.firstName?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{c.firstName} {c.lastName}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.phone ?? "No phone"} · {c.email}</p>
                  </div>
                  {!c.phone && <span className="ml-auto text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">No phone</span>}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const TABS = [
    { id: "order",   label: "Order Status",    icon: ShoppingBag },
    { id: "renewal", label: "Renewal Alert",   icon: Bell },
    { id: "bulk",    label: "Bulk Renewals",   icon: Zap },
    { id: "custom",  label: "Custom Message",  icon: MessageCircle },
    { id: "logs",    label: "Notification Log", icon: Clock },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-500/10 text-green-500 flex items-center justify-center">
          <MessageCircle size={20} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">WhatsApp Client Sync</h2>
          <p className="text-xs text-muted-foreground">Send Order Status and Renewal Alerts directly to client WhatsApp numbers</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-muted/40 rounded-lg border border-border">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              tab === t.id ? "bg-background text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon size={12} />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── ORDER STATUS ──────────────────────────────────────────────────── */}
      {tab === "order" && (
        <motion.div key="order" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <ClientPicker />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Order Status</Label>
              <select value={orderStatus} onChange={e => setOrderStatus(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                {["active", "pending", "in-progress", "completed", "suspended", "cancelled"].map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Domain (optional)</Label>
              <Input value={orderDomain} onChange={e => setOrderDomain(e.target.value)} placeholder="example.com" className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Plan Name (optional)</Label>
              <Input value={orderPlan} onChange={e => setOrderPlan(e.target.value)} placeholder="Starter Hosting" className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Order ID (optional)</Label>
              <Input value={orderId} onChange={e => setOrderId(e.target.value)} placeholder="ORD-12345" className="h-9 text-sm" />
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Custom Message (overrides default)</Label>
            <Textarea value={orderCustomMsg} onChange={e => setOrderCustomMsg(e.target.value)}
              placeholder="Leave blank to use the auto-generated message…" rows={3} className="text-sm resize-none" />
          </div>
          <Button onClick={sendOrderStatus} disabled={sending || !selected} className="w-full gap-2">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {sending ? "Sending…" : "Send Order Status to WhatsApp"}
          </Button>
          {selected && !selected.phone && (
            <p className="text-xs text-destructive flex items-center gap-1.5">
              <AlertCircle size={12} /> This client has no phone number on file — update their profile first.
            </p>
          )}
        </motion.div>
      )}

      {/* ── RENEWAL ALERT ────────────────────────────────────────────────── */}
      {tab === "renewal" && (
        <motion.div key="renewal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <ClientPicker />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Renewal Date *</Label>
              <Input type="date" value={renewalDate} onChange={e => setRenewalDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Domain / Service (optional)</Label>
              <Input value={renewalDomain} onChange={e => setRenewalDomain(e.target.value)} placeholder="example.com" className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Amount Due (optional)</Label>
              <Input type="number" value={renewalAmount} onChange={e => setRenewalAmount(e.target.value)} placeholder="1500" className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Currency</Label>
              <select value={renewalCurrency} onChange={e => setRenewalCurrency(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                {["PKR", "USD", "GBP", "AED", "SAR"].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Invoice ID (optional)</Label>
              <Input value={renewalInvoiceId} onChange={e => setRenewalInvoiceId(e.target.value)} placeholder="INV-2026-001" className="h-9 text-sm" />
            </div>
          </div>
          <Button onClick={sendRenewalAlert} disabled={sending || !selected || !renewalDate} className="w-full gap-2">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
            {sending ? "Sending…" : "Send Renewal Alert to WhatsApp"}
          </Button>
        </motion.div>
      )}

      {/* ── BULK RENEWALS ────────────────────────────────────────────────── */}
      {tab === "bulk" && (
        <motion.div key="bulk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-400">
            <p className="font-medium mb-1">Bulk Renewal Alerts</p>
            <p className="text-xs">Finds all unpaid invoices due within the selected window and sends a WhatsApp renewal reminder to each client automatically. Clients without a phone number are skipped.</p>
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Invoices Due Within</Label>
            <select value={bulkDays} onChange={e => setBulkDays(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              {[{ v: "3", l: "3 days" }, { v: "7", l: "7 days" }, { v: "14", l: "14 days" }, { v: "30", l: "30 days" }].map(o => (
                <option key={o.v} value={o.v}>{o.l}</option>
              ))}
            </select>
          </div>
          <Button onClick={sendBulkRenewals} disabled={sending} variant="default" className="w-full gap-2">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {sending ? "Sending Bulk Alerts…" : `Send Bulk Renewal Alerts (${bulkDays}-day window)`}
          </Button>
          {bulkResult && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-4 gap-2">
              {[
                { label: "Total Found", value: bulkResult.total, color: "text-foreground" },
                { label: "Sent",        value: bulkResult.sent,  color: "text-green-500" },
                { label: "Failed",      value: bulkResult.failed, color: "text-red-500" },
                { label: "Skipped",     value: bulkResult.skipped, color: "text-muted-foreground" },
              ].map(s => (
                <div key={s.label} className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </motion.div>
          )}
        </motion.div>
      )}

      {/* ── CUSTOM MESSAGE ────────────────────────────────────────────────── */}
      {tab === "custom" && (
        <motion.div key="custom" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <ClientPicker />
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Message</Label>
            <Textarea value={customMsg} onChange={e => setCustomMsg(e.target.value)}
              placeholder="Type your message to the client… Supports WhatsApp formatting (*bold*, _italic_)" rows={5} className="text-sm resize-none" />
            <p className="text-xs text-muted-foreground mt-1">{customMsg.length} characters</p>
          </div>
          <Button onClick={sendCustom} disabled={sending || !selected || !customMsg.trim()} className="w-full gap-2">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {sending ? "Sending…" : "Send Custom Message"}
          </Button>
        </motion.div>
      )}

      {/* ── NOTIFICATION LOG ─────────────────────────────────────────────── */}
      {tab === "logs" && (
        <motion.div key="logs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Last 40 client notifications sent via WhatsApp</p>
            <Button variant="ghost" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["wa-client-notifs"] })} className="h-7 gap-1 text-xs">
              <RefreshCw size={12} /> Refresh
            </Button>
          </div>
          {logsLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
              <MessageCircle size={24} className="opacity-30" />
              <p className="text-sm">No client notifications sent yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="rounded-xl border border-border bg-card p-3 flex gap-3">
                  <div className={`mt-0.5 ${log.status === "sent" ? "text-green-500" : "text-red-500"}`}>
                    {log.status === "sent" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-foreground">{log.first_name} {log.last_name}</span>
                      <span className={`text-[10px] font-medium ${EVENT_COLORS[log.event_type] ?? "text-muted-foreground"}`}>
                        {EVENT_LABELS[log.event_type] ?? log.event_type}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{log.phone}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground">{format(new Date(log.sent_at), "MMM d, HH:mm")}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{log.message}</p>
                    {log.error && <p className="text-[10px] text-red-500 mt-0.5">{log.error}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
