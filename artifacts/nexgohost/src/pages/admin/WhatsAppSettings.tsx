import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  MessageCircle, Smartphone, Wifi, WifiOff, RefreshCw,
  CheckCircle, AlertCircle, Send, Zap, Phone, Bell,
  Clock, ShoppingCart, Ticket, CreditCard, Terminal,
  UserSearch, Ban, RotateCcw, Trash2, BarChart3, Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

const BRAND = "#4F46E5";

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

interface WaStatus {
  status: "disconnected" | "connecting" | "qr_ready" | "connected" | "error";
  qrDataUrl: string | null;
  connectedAt: string | null;
  phone: string | null;
  error: string | null;
  adminPhone: string | null;
}

interface WaLog {
  id: string;
  eventType: string;
  message: string;
  status: string;
  errorMessage: string | null;
  sentAt: string;
}

const EVENT_ICONS: Record<string, JSX.Element> = {
  new_order: <ShoppingCart size={12} />,
  new_ticket: <Ticket size={12} />,
  payment_proof: <CreditCard size={12} />,
  refund_request: <RotateCcw size={12} />,
  invoice_paid: <CreditCard size={12} />,
  client_notification: <MessageCircle size={12} />,
  admin_command: <Terminal size={12} />,
  suspension_warning: <Ban size={12} />,
  test: <Zap size={12} />,
  other: <Bell size={12} />,
};

const EVENT_LABELS: Record<string, string> = {
  new_order: "New Order",
  new_ticket: "New Ticket",
  payment_proof: "Payment Proof",
  refund_request: "Refund Request",
  invoice_paid: "Invoice Paid",
  client_notification: "Client Notification",
  admin_command: "Admin Command",
  suspension_warning: "Suspension Warning",
  test: "Test",
  other: "Alert",
};

export default function WhatsAppSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectingSeconds, setConnectingSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: waStatus, isLoading } = useQuery<WaStatus>({
    queryKey: ["admin-wa-status"],
    queryFn: () => apiFetch("/api/admin/whatsapp/status"),
    refetchInterval: 3000,
  });

  const { data: logs = [] } = useQuery<WaLog[]>({
    queryKey: ["admin-wa-logs"],
    queryFn: () => apiFetch("/api/admin/whatsapp/logs?limit=20"),
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (waStatus?.adminPhone && !phone) setPhone(waStatus.adminPhone);
  }, [waStatus?.adminPhone]);

  // Track how long we've been in "connecting" state
  useEffect(() => {
    if (waStatus?.status === "connecting") {
      if (!timerRef.current) {
        setConnectingSeconds(0);
        timerRef.current = setInterval(() => setConnectingSeconds(s => s + 1), 1000);
      }
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setConnectingSeconds(0);
    }
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [waStatus?.status]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await apiFetch("/api/admin/whatsapp/connect", { method: "POST" });
      toast({ title: "Connecting…", description: "QR code will appear in a few seconds. Please wait." });
      queryClient.invalidateQueries({ queryKey: ["admin-wa-status"] });
    } catch (err: any) {
      toast({ title: "Connection Error", description: err.message, variant: "destructive" });
    } finally { setConnecting(false); }
  };

  const handleForceReset = async () => {
    try {
      await apiFetch("/api/admin/whatsapp/disconnect", { method: "POST" });
      toast({ title: "Reset done", description: "Click Connect WhatsApp to try again." });
      queryClient.invalidateQueries({ queryKey: ["admin-wa-status"] });
    } catch { /* ignore */ }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect WhatsApp? You'll need to scan a QR code again to reconnect.")) return;
    try {
      await apiFetch("/api/admin/whatsapp/disconnect", { method: "POST" });
      toast({ title: "Disconnected" });
      queryClient.invalidateQueries({ queryKey: ["admin-wa-status"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleSavePhone = async () => {
    if (!phone) { toast({ title: "Enter a phone number", variant: "destructive" }); return; }
    setPhoneSaving(true);
    try {
      await apiFetch("/api/admin/whatsapp/phone", { method: "PUT", body: JSON.stringify({ phone }) });
      toast({ title: "Phone number saved", description: `Alerts will be sent to +${phone.replace(/\D/g, "")}` });
      queryClient.invalidateQueries({ queryKey: ["admin-wa-status"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setPhoneSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const data = await apiFetch("/api/admin/whatsapp/test", { method: "POST" });
      toast({
        title: data.success ? "Test sent!" : "Failed",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-wa-logs"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setTesting(false); }
  };

  const status = waStatus?.status ?? "disconnected";
  const isConnected = status === "connected";
  const isQrReady = status === "qr_ready";
  const isConnecting = status === "connecting";

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2.5">
          <MessageCircle size={22} style={{ color: "#25D366" }} />
          WhatsApp Alerts
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          100% free — uses your personal WhatsApp account via QR code. No monthly fees, no third-party APIs.
        </p>
      </div>

      {/* Connection card */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">

        {/* Status bar */}
        <div className={`px-5 py-3 flex items-center gap-3 border-b border-border ${
          isConnected ? "bg-emerald-950/20" : isQrReady || isConnecting ? "bg-amber-950/20" : "bg-muted/30"
        }`}>
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            isConnected ? "bg-emerald-500 shadow-[0_0_6px_#22c55e]" :
            isQrReady || isConnecting ? "bg-amber-500 animate-pulse" :
            "bg-muted-foreground/40"
          }`} />
          <span className={`text-sm font-semibold ${
            isConnected ? "text-emerald-400" :
            isQrReady || isConnecting ? "text-amber-400" :
            "text-muted-foreground"
          }`}>
            {isConnected ? `Connected — +${waStatus?.phone}` :
             isQrReady ? "Scan QR Code with your WhatsApp" :
             isConnecting ? "Connecting…" :
             status === "error" ? `Error: ${waStatus?.error}` :
             "Not Connected"}
          </span>
          {isConnected && waStatus?.connectedAt && (
            <span className="text-xs text-muted-foreground ml-auto">
              Since {format(new Date(waStatus.connectedAt), "dd MMM, h:mm a")}
            </span>
          )}
        </div>

        <div className="p-5 space-y-5">

          {/* QR Code display */}
          {isQrReady && waStatus?.qrDataUrl && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3 py-4">
              <div className="p-3 bg-white rounded-2xl shadow-lg inline-block">
                <img src={waStatus.qrDataUrl} alt="WhatsApp QR Code" className="w-64 h-64 block" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground text-sm">Open WhatsApp → Linked Devices → Link a Device</p>
                <p className="text-xs text-muted-foreground mt-1">Scan this QR code with your phone. The QR expires in ~60 seconds.</p>
              </div>
            </motion.div>
          )}

          {/* Connecting state — with countdown and force reset */}
          {isConnecting && !isQrReady && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <RefreshCw size={16} className="text-amber-400 animate-spin flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-400">
                    Connecting to WhatsApp… {connectingSeconds > 0 && <span className="font-normal">({connectingSeconds}s)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">QR code will appear here automatically. Please wait a moment.</p>
                </div>
              </div>
              {connectingSeconds >= 15 && (
                <div className="flex items-start gap-2.5 pt-1">
                  <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-red-400 font-semibold">Taking too long — connection may have failed.</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Click Force Reset below and try connecting again.</p>
                  </div>
                  <Button onClick={handleForceReset} size="sm" variant="destructive" className="rounded-lg text-xs px-3 h-7 flex-shrink-0">
                    Force Reset
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Error state */}
          {status === "error" && (
            <div className="rounded-xl border border-red-500/20 bg-red-950/10 p-4 flex items-start gap-3">
              <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-400">Connection error</p>
                <p className="text-xs text-muted-foreground mt-0.5">{waStatus?.error || "Unknown error"}</p>
              </div>
              <Button onClick={handleForceReset} size="sm" variant="outline" className="rounded-lg text-xs px-3 h-7 flex-shrink-0 border-red-500/30 text-red-400">
                Reset &amp; Retry
              </Button>
            </div>
          )}

          {/* Instructions when disconnected */}
          {status === "disconnected" && (
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <p className="font-semibold text-foreground text-sm flex items-center gap-2">
                <Smartphone size={15} style={{ color: BRAND }} /> How to connect
              </p>
              <ol className="text-sm text-muted-foreground space-y-1.5 pl-4 list-decimal">
                <li>Enter your WhatsApp number below (with country code, e.g. 923001234567)</li>
                <li>Click <strong className="text-foreground">Connect WhatsApp</strong></li>
                <li>Open WhatsApp on your phone → Settings → Linked Devices → Link a Device</li>
                <li>Scan the QR code that appears here</li>
                <li>Done! You'll get alerts for new orders, tickets, and payment proofs.</li>
              </ol>
            </div>
          )}

          {/* Phone number input */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">
              <Phone size={12} className="inline mr-1" />
              Admin WhatsApp Number (with country code, no +)
            </Label>
            <div className="flex gap-2">
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g. 923001234567"
                className="rounded-xl font-mono flex-1"
              />
              <Button onClick={handleSavePhone} disabled={phoneSaving} variant="outline" className="rounded-xl px-4">
                {phoneSaving ? <RefreshCw size={14} className="animate-spin" /> : "Save"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Pakistan: start with 92 (e.g. 923xxxxxxxxx). No spaces or dashes.</p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            {!isConnected ? (
              <Button onClick={handleConnect} disabled={connecting || isConnecting || isQrReady}
                style={{ background: "#25D366" }} className="text-white rounded-xl">
                {connecting || isConnecting
                  ? <><RefreshCw size={14} className="animate-spin mr-2" /> Connecting…</>
                  : <><Wifi size={14} className="mr-2" /> Connect WhatsApp</>}
              </Button>
            ) : (
              <>
                <Button onClick={handleTest} disabled={testing} variant="outline" className="rounded-xl">
                  {testing ? <RefreshCw size={14} className="animate-spin mr-2" /> : <Send size={14} className="mr-2" />}
                  Send Test Message
                </Button>
                <Button onClick={handleDisconnect} variant="destructive" className="rounded-xl">
                  <WifiOff size={14} className="mr-2" /> Disconnect
                </Button>
              </>
            )}
            <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-wa-status"] })}
              variant="ghost" size="sm" className="rounded-xl text-muted-foreground">
              <RefreshCw size={13} className="mr-1.5" /> Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Notification triggers */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Bell size={15} style={{ color: BRAND }} /> Automated Alert Triggers
        </h3>
        <p className="text-xs text-muted-foreground mb-3">Admin alerts go to your WhatsApp. Client alerts go directly to the client's registered phone.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { icon: ShoppingCart, label: "New Order → Admin", desc: "Notifies you instantly with client name, service, and amount", color: "violet" },
            { icon: Package, label: "New Order → Client", desc: "Confirms the order to the client with order ID and service details", color: "violet" },
            { icon: Ticket, label: "New Support Ticket → Admin", desc: "Ticket subject, priority, and client name sent to you", color: "violet" },
            { icon: CreditCard, label: "Payment Proof → Admin", desc: "Invoice ID + transaction reference when client submits proof", color: "violet" },
            { icon: CreditCard, label: "Invoice Paid → Client", desc: "Payment confirmation sent to client's phone once invoice is marked paid", color: "emerald" },
            { icon: Ban, label: "Suspension Warning → Client", desc: "1-day warning to client when invoice is due today (suspended tomorrow)", color: "amber" },
            { icon: Ban, label: "Service Suspended → Client", desc: "Immediate alert to client's phone when service is actually suspended", color: "red" },
          ].map(({ icon: Icon, label, desc, color }) => (
            <div key={label} className={`flex items-start gap-2.5 p-3 rounded-xl border ${
              color === "emerald" ? "bg-emerald-950/10 border-emerald-500/15" :
              color === "amber" ? "bg-amber-950/10 border-amber-500/15" :
              color === "red" ? "bg-red-950/10 border-red-500/15" :
              "bg-violet-950/10 border-violet-500/15"
            }`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                color === "emerald" ? "bg-emerald-500/10" :
                color === "amber" ? "bg-amber-500/10" :
                color === "red" ? "bg-red-500/10" :
                "bg-violet-500/10"
              }`}>
                <Icon size={13} className={
                  color === "emerald" ? "text-emerald-500" :
                  color === "amber" ? "text-amber-500" :
                  color === "red" ? "text-red-500" :
                  "text-violet-400"
                } />
              </div>
              <div>
                <p className="font-semibold text-foreground text-xs flex items-center gap-1">
                  <CheckCircle size={10} className={
                    color === "emerald" ? "text-emerald-500" :
                    color === "amber" ? "text-amber-500" :
                    color === "red" ? "text-red-500" :
                    "text-violet-400"
                  } /> {label}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Remote Admin Commands */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
          <Terminal size={15} style={{ color: BRAND }} /> Remote Admin Commands
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Send these commands from your registered admin WhatsApp number to control Noehost remotely.
          The system replies instantly with the result.
        </p>
        <div className="space-y-2">
          {[
            { cmd: "!status", desc: "Get live system stats — active services, suspended services, unpaid invoices, client count", icon: BarChart3 },
            { cmd: "!suspend [domain/id]", desc: "Immediately suspend a hosting service (triggers 20i/cPanel API + updates DB)", icon: Ban },
            { cmd: "!unsuspend [domain/id]", desc: "Reactivate a suspended service and restore access", icon: RotateCcw },
            { cmd: "!terminate [domain/id]", desc: "Request service termination — sends a confirmation prompt (5-minute timeout)", icon: Trash2 },
            { cmd: "!terminate confirm [domain/id]", desc: "Confirm and execute permanent termination after the initial request", icon: Trash2 },
            { cmd: "!info [name/email]", desc: "Look up a client by name or email — shows services, unpaid invoices, and phone", icon: UserSearch },
            { cmd: "!help", desc: "List all available commands", icon: Terminal },
          ].map(({ cmd, desc, icon: Icon }) => (
            <div key={cmd} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted/50">
                <Icon size={13} style={{ color: BRAND }} />
              </div>
              <div className="flex-1 min-w-0">
                <code className="text-xs font-bold text-violet-400 bg-violet-950/30 px-1.5 py-0.5 rounded">{cmd}</code>
                <p className="text-[11px] text-muted-foreground mt-1">{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1.5">
          <AlertCircle size={11} className="text-amber-500 flex-shrink-0" />
          Commands are only accepted from your registered admin WhatsApp number. All other messages are silently ignored.
        </p>
      </div>

      {/* Live log */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
            <Clock size={14} style={{ color: BRAND }} /> Live Alert Log
          </h3>
          <span className="text-xs text-muted-foreground">{logs.length} recent alerts</span>
        </div>

        {logs.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-sm">
            <Bell size={28} className="mx-auto mb-2 opacity-20" />
            No alerts sent yet. Connect WhatsApp and send a test message to get started.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {logs.map(log => (
              <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  log.status === "sent" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                }`}>
                  {log.status === "sent" ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                      {EVENT_ICONS[log.eventType]} {EVENT_LABELS[log.eventType] ?? log.eventType}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${
                      log.status === "sent"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-red-500/10 text-red-500 border-red-500/20"
                    }`}>{log.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{log.message}</p>
                  {log.errorMessage && <p className="text-[11px] text-red-500 mt-0.5">{log.errorMessage}</p>}
                </div>
                <span className="text-[10px] text-muted-foreground flex-shrink-0 mt-0.5">
                  {format(new Date(log.sentAt), "dd MMM, HH:mm")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
