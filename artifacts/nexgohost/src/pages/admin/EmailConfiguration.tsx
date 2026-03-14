import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import {
  Mail, Server, Send, CheckCircle, XCircle, Loader2, Eye, EyeOff,
  ArrowLeft, Wifi, WifiOff, RefreshCw, Clock, AlertCircle, List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

interface EmailSettings {
  mailer_type: string;
  smtp_host: string; smtp_port: string;
  smtp_user: string; smtp_pass: string;
  smtp_from: string; smtp_from_name: string;
  smtp_encryption: string;
  smtp_configured: boolean;
}

interface EmailLog {
  id: string; recipient: string; emailType: string;
  subject: string; status: string; errorMessage: string | null; sentAt: string;
}

const ENCRYPTION_OPTS = [
  { value: "none", label: "None", port: "25",  desc: "No encryption — not recommended" },
  { value: "ssl",  label: "SSL",  port: "465", desc: "Implicit SSL (port 465)" },
  { value: "tls",  label: "TLS",  port: "587", desc: "STARTTLS (port 587, recommended)" },
];

const MAILER_OPTS = [
  { value: "smtp",     label: "SMTP",     desc: "Send email via SMTP server" },
  { value: "php_mail", label: "PHP Mail", desc: "Use server's PHP mail() function" },
];

export default function EmailConfiguration() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const [form, setForm] = useState<EmailSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const [connecting, setConnecting] = useState(false);
  const [connectResult, setConnectResult] = useState<{ success: boolean; message: string } | null>(null);

  const [testTo, setTestTo] = useState("");
  const [sending, setSending] = useState(false);

  const { data: settingsData } = useQuery<EmailSettings>({
    queryKey: ["admin-settings-email"],
    queryFn: () => apiFetch("/api/admin/settings"),
    onSuccess: (d) => { if (!form) setForm(d); },
  });

  const { data: logsData, refetch: refetchLogs, isFetching: logsLoading } = useQuery<EmailLog[]>({
    queryKey: ["admin-email-logs"],
    queryFn: () => apiFetch("/api/admin/email-logs?limit=30"),
    refetchInterval: 30_000,
  });

  const cfg = form ?? settingsData ?? {
    mailer_type: "smtp", smtp_host: "", smtp_port: "587",
    smtp_user: "", smtp_pass: "", smtp_from: "", smtp_from_name: "",
    smtp_encryption: "tls", smtp_configured: false,
  };

  const set = (k: keyof EmailSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...(prev ?? cfg), [k]: e.target.value }));

  const handleEncryptionChange = (val: string) => {
    const opt = ENCRYPTION_OPTS.find(o => o.value === val);
    setForm(prev => {
      const p = prev ?? cfg;
      return { ...p, smtp_encryption: val, smtp_port: p.smtp_port === "25" || p.smtp_port === "465" || p.smtp_port === "587" ? opt?.port ?? p.smtp_port : p.smtp_port };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setConnectResult(null);
    try {
      await apiFetch("/api/admin/settings", { method: "PUT", body: JSON.stringify(cfg) });
      qc.invalidateQueries({ queryKey: ["admin-settings-email"] });
      toast({ title: "Settings saved", description: "Email configuration updated successfully." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setConnecting(true);
    setConnectResult(null);
    try {
      const result = await apiFetch("/api/admin/settings/smtp/verify", {
        method: "POST",
        body: JSON.stringify({
          smtp_host: cfg.smtp_host,
          smtp_port: cfg.smtp_port,
          smtp_user: cfg.smtp_user,
          smtp_pass: cfg.smtp_pass,
          smtp_encryption: cfg.smtp_encryption,
        }),
      });
      setConnectResult({ success: true, message: result.message });
    } catch (err: any) {
      setConnectResult({ success: false, message: err.message });
    } finally {
      setConnecting(false);
    }
  };

  const handleSendTest = async () => {
    if (!testTo.trim()) { toast({ title: "Enter a recipient email", variant: "destructive" }); return; }
    setSending(true);
    try {
      const result = await apiFetch("/api/admin/settings/smtp/test", {
        method: "POST",
        body: JSON.stringify({ to: testTo.trim() }),
      });
      toast({ title: result.success ? "Test email sent!" : "Send failed", description: result.message, variant: result.success ? "default" : "destructive" });
      if (result.success) refetchLogs();
    } catch (err: any) {
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => setLocation("/admin/settings")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={15} /> Settings
        </button>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium text-foreground">Email Configuration</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Email Configuration</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configure SMTP settings for all system emails — verification, invoices, hosting welcome, and more.</p>
        </div>
        {cfg.smtp_configured && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1.5 shrink-0">
            <CheckCircle size={12} /> SMTP Configured
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left column: Configuration form */}
        <div className="xl:col-span-2 space-y-5">

          {/* Mailer type */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-violet-500/10 rounded-lg"><Mail className="w-5 h-5 text-violet-400" /></div>
              <div>
                <h2 className="font-semibold text-foreground">Mailer Type</h2>
                <p className="text-xs text-muted-foreground">How emails are sent from this server</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MAILER_OPTS.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setForm(prev => ({ ...(prev ?? cfg), mailer_type: opt.value }))}
                  className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${cfg.mailer_type === opt.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 hover:bg-primary/5"}`}>
                  <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${cfg.mailer_type === opt.value ? "border-primary" : "border-muted-foreground"}`}>
                    {cfg.mailer_type === opt.value && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* SMTP Configuration */}
          {cfg.mailer_type === "smtp" && (
            <form onSubmit={handleSave} className="rounded-2xl border border-border bg-card p-6 space-y-5">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-blue-500/10 rounded-lg"><Server className="w-5 h-5 text-blue-400" /></div>
                <div>
                  <h2 className="font-semibold text-foreground">SMTP Configuration</h2>
                  <p className="text-xs text-muted-foreground">Server credentials for outgoing email</p>
                </div>
              </div>

              {/* Encryption */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">Encryption</label>
                <div className="grid grid-cols-3 gap-2">
                  {ENCRYPTION_OPTS.map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => handleEncryptionChange(opt.value)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all ${cfg.smtp_encryption === opt.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"}`}>
                      <span className="text-sm font-medium text-foreground">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">:{opt.port}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">SMTP Host</label>
                  <Input value={cfg.smtp_host} onChange={set("smtp_host")} placeholder="smtp.gmail.com" className="bg-background" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">SMTP Port</label>
                  <Input value={cfg.smtp_port} onChange={set("smtp_port")} placeholder="587" className="bg-background" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">SMTP Username</label>
                  <Input value={cfg.smtp_user} onChange={set("smtp_user")} placeholder="user@example.com" className="bg-background" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">SMTP Password</label>
                  <div className="relative">
                    <Input type={showPass ? "text" : "password"} value={cfg.smtp_pass} onChange={set("smtp_pass")}
                      placeholder={cfg.smtp_configured ? "•••••••• (saved)" : "App password or SMTP key"}
                      className="bg-background pr-9" />
                    <button type="button" onClick={() => setShowPass(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">From Email</label>
                  <Input value={cfg.smtp_from} onChange={set("smtp_from")} placeholder="noreply@example.com" className="bg-background" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">From Name</label>
                  <Input value={cfg.smtp_from_name} onChange={set("smtp_from_name")} placeholder="Nexgohost" className="bg-background" />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Button type="submit" disabled={saving} className="gap-2">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Save Configuration
                </Button>
              </div>
            </form>
          )}

          {/* PHP Mail — just a save button */}
          {cfg.mailer_type === "php_mail" && (
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-500/10 rounded-lg"><Server className="w-5 h-5 text-blue-400" /></div>
                <div>
                  <h2 className="font-semibold text-foreground">From Address</h2>
                  <p className="text-xs text-muted-foreground">Sender identity for PHP mail()</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">From Email</label>
                  <Input value={cfg.smtp_from} onChange={set("smtp_from")} placeholder="noreply@example.com" className="bg-background" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">From Name</label>
                  <Input value={cfg.smtp_from_name} onChange={set("smtp_from_name")} placeholder="Nexgohost" className="bg-background" />
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                Save Configuration
              </Button>
            </div>
          )}
        </div>

        {/* Right column: Test + Logs */}
        <div className="space-y-5">

          {/* Test SMTP Connection */}
          {cfg.mailer_type === "smtp" && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <Wifi size={17} className="text-cyan-400" />
                <h3 className="font-semibold text-foreground text-sm">Test Connection</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Verify the SMTP connection using your saved credentials without sending any email.</p>

              {connectResult && (
                <div className={`flex items-start gap-2.5 p-3 rounded-xl border mb-3 text-sm ${
                  connectResult.success
                    ? "bg-green-500/5 border-green-500/20 text-green-400"
                    : "bg-red-500/5 border-red-500/20 text-red-400"
                }`}>
                  {connectResult.success ? <CheckCircle size={15} className="shrink-0 mt-0.5" /> : <WifiOff size={15} className="shrink-0 mt-0.5" />}
                  <span className="text-xs">{connectResult.message}</span>
                </div>
              )}

              <Button onClick={handleTestConnection} disabled={connecting || !cfg.smtp_host} variant="outline" className="w-full gap-2">
                {connecting ? <Loader2 size={13} className="animate-spin" /> : <Wifi size={13} />}
                {connecting ? "Connecting…" : "Test SMTP Connection"}
              </Button>
            </div>
          )}

          {/* Send Test Email */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <Send size={17} className="text-violet-400" />
              <h3 className="font-semibold text-foreground text-sm">Send Test Email</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Send a test email to verify the full email delivery pipeline.</p>
            <div className="space-y-3">
              <Input
                value={testTo}
                onChange={e => setTestTo(e.target.value)}
                placeholder="recipient@example.com"
                type="email"
                className="bg-background"
              />
              <Button onClick={handleSendTest} disabled={sending || !testTo.trim()} className="w-full gap-2">
                {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                {sending ? "Sending…" : "Send Test Email"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">Subject: <span className="text-foreground/70 italic">Test Email from Billing System</span></p>
          </div>

          {/* Quick tips */}
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle size={15} className="text-amber-400 shrink-0" />
              <span className="text-sm font-medium text-amber-400">Common Settings</span>
            </div>
            <div className="space-y-2 text-xs text-amber-300/70">
              <p><span className="text-foreground/60">Gmail:</span> smtp.gmail.com · 587 · TLS · App Password</p>
              <p><span className="text-foreground/60">Outlook:</span> smtp.office365.com · 587 · TLS</p>
              <p><span className="text-foreground/60">Hostinger:</span> smtp.hostinger.com · 587 · TLS</p>
              <p><span className="text-foreground/60">SendGrid:</span> smtp.sendgrid.net · 587 · TLS · API Key</p>
            </div>
          </div>
        </div>
      </div>

      {/* Email Logs */}
      <div className="rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <List size={17} className="text-primary" />
            <h2 className="font-semibold text-foreground">Email Delivery Logs</h2>
          </div>
          <button onClick={() => refetchLogs()} disabled={logsLoading}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
            <RefreshCw size={12} className={logsLoading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {!logsData || logsData.length === 0 ? (
          <div className="py-16 text-center">
            <Mail size={32} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No emails sent yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Email delivery history will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recipient</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Subject</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {logsData.map(log => (
                  <tr key={log.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-3 font-mono text-xs text-foreground/80">{log.recipient}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell max-w-xs truncate">{log.subject}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/60 text-muted-foreground border border-border capitalize">
                        {log.emailType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {log.status === "success" ? (
                        <span className="flex items-center gap-1 text-xs text-green-400">
                          <CheckCircle size={11} /> Delivered
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-red-400" title={log.errorMessage || ""}>
                          <XCircle size={11} /> Failed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        <Clock size={11} className="text-muted-foreground/50" />
                        {format(new Date(log.sentAt), "MMM d, HH:mm")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
