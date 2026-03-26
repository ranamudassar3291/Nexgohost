import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield, ShieldAlert, ShieldCheck, Key, Globe, Eye, EyeOff,
  LogIn, UserPlus, Search, HelpCircle, MessageSquare,
  Ban, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Clock,
  Trash2, Wifi, Bot, Zap, Lock, Unlock, CreditCard, Ticket,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface SecurityConfig {
  provider: "turnstile" | "recaptcha";
  siteKey: string;
  secretKey: string;
  enabledPages: {
    login: boolean;
    register: boolean;
    domainSearch: boolean;
    forgotPassword: boolean;
    contactForm: boolean;
    checkout: boolean;
    supportTicket: boolean;
  };
}

interface SecurityStats {
  totalEvents: number;
  failedLogins: number;
  bruteForce: number;
  botsBlocked: number;
  scansBlocked: number;
  activeBlocks: number;
}

interface SecurityLog {
  id: string;
  event: string;
  ipAddress: string;
  userAgent: string | null;
  email: string | null;
  path: string | null;
  details: string | null;
  blocked: boolean;
  createdAt: string;
}

interface BlockedIp {
  id: string;
  ipAddress: string;
  reason: string;
  failedAttempts: number | null;
  blockedUntil: string;
  createdAt: string;
}

const PAGE_META = [
  { key: "login",         label: "Login Page",           icon: LogIn,         desc: "Require captcha before login" },
  { key: "register",      label: "Register Page",         icon: UserPlus,      desc: "Block bot registrations" },
  { key: "domainSearch",  label: "Domain Search",         icon: Search,        desc: "Prevent domain enumeration" },
  { key: "forgotPassword",label: "Forgot Password",       icon: HelpCircle,    desc: "Prevent email flood attacks" },
  { key: "contactForm",   label: "Contact / Support Form",icon: MessageSquare, desc: "Block spam submissions" },
  { key: "checkout",      label: "Checkout / Order Flow", icon: CreditCard,    desc: "Prevent automated purchases" },
  { key: "supportTicket", label: "Support Ticket Form",   icon: Ticket,        desc: "Block spam ticket submissions" },
];

const EVENT_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  login_failed:      { label: "Login Failed",      color: "text-orange-600", icon: XCircle },
  login_blocked:     { label: "Login Blocked",     color: "text-red-600",    icon: Ban },
  captcha_failed:    { label: "Captcha Failed",    color: "text-yellow-600", icon: AlertTriangle },
  ip_blocked:        { label: "IP Blocked",        color: "text-red-700",    icon: Ban },
  brute_force:       { label: "Brute Force",       color: "text-red-700",    icon: ShieldAlert },
  suspicious_scan:   { label: "Suspicious Scan",   color: "text-purple-600", icon: Bot },
  bot_blocked:       { label: "Bot Blocked",       color: "text-purple-700", icon: Bot },
};

export default function SecuritySettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showSecret, setShowSecret] = useState(false);
  const [localConfig, setLocalConfig] = useState<SecurityConfig | null>(null);

  const { data: config, isLoading: configLoading } = useQuery<SecurityConfig>({
    queryKey: ["security-config"],
    queryFn: () => apiFetch("/api/admin/security/settings"),
  });

  useEffect(() => {
    if (config && !localConfig) setLocalConfig(config);
  }, [config]);

  const { data: stats } = useQuery<SecurityStats>({
    queryKey: ["security-stats"],
    queryFn: () => apiFetch("/api/admin/security/stats"),
    refetchInterval: 30_000,
  });

  const { data: logs = [] } = useQuery<SecurityLog[]>({
    queryKey: ["security-logs"],
    queryFn: () => apiFetch("/api/admin/security/logs?limit=100"),
    refetchInterval: 30_000,
  });

  const { data: blockedIps = [] } = useQuery<BlockedIp[]>({
    queryKey: ["blocked-ips"],
    queryFn: () => apiFetch("/api/admin/security/blocked-ips"),
    refetchInterval: 30_000,
  });

  const cfg: SecurityConfig = localConfig ?? config ?? {
    provider: "turnstile",
    siteKey: "",
    secretKey: "",
    enabledPages: { login: false, register: false, domainSearch: false, forgotPassword: false, contactForm: false, checkout: false, supportTicket: false },
  };

  const saveMutation = useMutation({
    mutationFn: () => apiFetch("/api/admin/security/settings", { method: "PUT", body: JSON.stringify(cfg) }),
    onSuccess: () => {
      toast({ title: "Settings saved", description: "Security configuration updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["security-config"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const unblockMutation = useMutation({
    mutationFn: (ip: string) => apiFetch(`/api/admin/security/blocked-ips/${encodeURIComponent(ip)}`, { method: "DELETE" }),
    onSuccess: (_, ip) => {
      toast({ title: "IP Unblocked", description: `${ip} has been removed from the blocklist` });
      queryClient.invalidateQueries({ queryKey: ["blocked-ips"] });
      queryClient.invalidateQueries({ queryKey: ["security-stats"] });
    },
  });

  const clearLogsMutation = useMutation({
    mutationFn: () => apiFetch("/api/admin/security/logs", { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Logs cleared", description: "Security logs older than 7 days removed" });
      queryClient.invalidateQueries({ queryKey: ["security-logs"] });
    },
  });

  function updatePage(key: string, value: boolean) {
    setLocalConfig(prev => prev ? {
      ...prev,
      enabledPages: { ...prev.enabledPages, [key]: value },
    } : null);
  }

  function updateField(field: keyof SecurityConfig, value: string) {
    setLocalConfig(prev => prev ? { ...prev, [field]: value } : null);
  }

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
            <Shield size={28} className="text-primary" />
            Security Settings
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Captcha protection, IP rate limiting, DDoS defense, and bot blocking for Noehost.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2 text-sm">
          <ShieldCheck size={16} />
          <span className="font-medium">Firewall Active</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Events (30d)", value: stats?.totalEvents ?? 0, icon: Shield,      color: "text-blue-600",   bg: "bg-blue-50" },
          { label: "Failed Logins",      value: stats?.failedLogins ?? 0, icon: XCircle,    color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Brute Force",        value: stats?.bruteForce ?? 0,   icon: ShieldAlert, color: "text-red-600",    bg: "bg-red-50" },
          { label: "Bots Blocked",       value: stats?.botsBlocked ?? 0,  icon: Bot,         color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Scans Blocked",      value: stats?.scansBlocked ?? 0, icon: Zap,         color: "text-yellow-600", bg: "bg-yellow-50" },
          { label: "Active Blocks",      value: stats?.activeBlocks ?? 0, icon: Ban,         color: "text-red-700",    bg: "bg-red-50" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="border-border/60">
              <CardContent className="p-3 text-center">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-1.5", s.bg)}>
                  <Icon size={16} className={s.color} />
                </div>
                <div className={cn("text-xl font-bold", s.color)}>{s.value.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground leading-tight">{s.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="captcha">
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="captcha" className="gap-1.5"><Key size={14} /> Captcha</TabsTrigger>
          <TabsTrigger value="blocked" className="gap-1.5"><Ban size={14} /> Blocked IPs {blockedIps.length > 0 && <Badge className="ml-1 bg-red-100 text-red-700 text-xs">{blockedIps.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5"><Shield size={14} /> Security Logs</TabsTrigger>
        </TabsList>

        {/* ── Captcha Tab ── */}
        <TabsContent value="captcha" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Provider + Keys */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Key size={16} className="text-primary" /> Provider Configuration</CardTitle>
                <CardDescription className="text-xs">
                  Supports Cloudflare Turnstile (recommended — free, no puzzles) and Google reCAPTCHA v2 (I am not a robot checkbox).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Provider selector */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Captcha Provider</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "turnstile", label: "Cloudflare Turnstile", sub: "Free & Privacy-friendly" },
                      { value: "recaptcha", label: "Google reCAPTCHA v2", sub: "Checkbox style" },
                    ].map(p => (
                      <button
                        key={p.value}
                        onClick={() => updateField("provider", p.value)}
                        className={cn(
                          "p-3 rounded-lg border-2 text-left transition-colors text-sm",
                          cfg.provider === p.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50",
                        )}
                      >
                        <div className="font-medium text-xs">{p.label}</div>
                        <div className="text-xs text-muted-foreground">{p.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Site Key */}
                <div className="space-y-1.5">
                  <Label htmlFor="siteKey" className="text-sm font-medium">Site Key (Public)</Label>
                  <Input
                    id="siteKey"
                    placeholder={cfg.provider === "turnstile" ? "0x4AAAAAAA..." : "6LeXXXXX..."}
                    value={cfg.siteKey}
                    onChange={e => updateField("siteKey", e.target.value)}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    {cfg.provider === "turnstile"
                      ? "Get from Cloudflare Dashboard → Turnstile → Add site"
                      : "Get from Google reCAPTCHA Admin Console"}
                  </p>
                </div>

                {/* Secret Key */}
                <div className="space-y-1.5">
                  <Label htmlFor="secretKey" className="text-sm font-medium">Secret Key (Private)</Label>
                  <div className="relative">
                    <Input
                      id="secretKey"
                      type={showSecret ? "text" : "password"}
                      placeholder="Server-side secret key..."
                      value={cfg.secretKey}
                      onChange={e => updateField("secretKey", e.target.value)}
                      className="font-mono text-xs pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowSecret(v => !v)}
                    >
                      {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Stored securely. Never exposed to frontend.</p>
                </div>

                {/* Test keys hint */}
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold text-blue-800">Dev / Testing Keys (Cloudflare Turnstile)</p>
                  <p className="text-xs text-blue-700 font-mono">Site Key: 1x00000000000000000000AA</p>
                  <p className="text-xs text-blue-700 font-mono">Secret Key: 1x0000000000000000000000000000000AA</p>
                  <p className="text-xs text-blue-600">These always pass — use only for testing, not production.</p>
                </div>
              </CardContent>
            </Card>

            {/* Page toggles */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Globe size={16} className="text-primary" /> Enable Per Page</CardTitle>
                <CardDescription className="text-xs">
                  Toggle captcha on or off for each form independently. Changes take effect immediately after saving.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {PAGE_META.map(page => {
                  const Icon = page.icon;
                  const enabled = cfg.enabledPages[page.key as keyof typeof cfg.enabledPages] ?? false;
                  return (
                    <div
                      key={page.key}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border-2 transition-colors",
                        enabled ? "border-primary/30 bg-primary/5" : "border-border/50",
                      )}
                    >
                      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", enabled ? "bg-primary/10" : "bg-muted/40")}>
                        <Icon size={16} className={enabled ? "text-primary" : "text-muted-foreground"} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{page.label}</div>
                        <div className="text-xs text-muted-foreground">{page.desc}</div>
                      </div>
                      <Switch
                        checked={enabled}
                        onCheckedChange={val => updatePage(page.key, val)}
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Firewall info */}
          <Card className="border-border/60 bg-muted/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><ShieldAlert size={16} className="text-orange-500" /> Built-in Firewall Rules (Always Active)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="font-medium flex items-center gap-1.5"><Lock size={13} className="text-red-500" /> IP Rate Limiting</div>
                  <div className="text-xs text-muted-foreground">More than 20 failed login attempts per IP in 60 seconds triggers an automatic 30-minute block. Block is persisted in the database.</div>
                </div>
                <div className="space-y-1">
                  <div className="font-medium flex items-center gap-1.5"><Bot size={13} className="text-purple-500" /> Bad Bot Blocker</div>
                  <div className="text-xs text-muted-foreground">Known scanner User-Agents (sqlmap, nikto, masscan, scrapy, curl, hydra, dirbuster…) are automatically blocked with 403 Forbidden.</div>
                </div>
                <div className="space-y-1">
                  <div className="font-medium flex items-center gap-1.5"><Shield size={13} className="text-blue-500" /> Automation Safeguard</div>
                  <div className="text-xs text-muted-foreground">Billing cron verifies invoice ID integrity before any suspension or termination action. No external request can trigger account actions.</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2 px-8">
              <ShieldCheck size={16} />
              {saveMutation.isPending ? "Saving…" : "Save Security Settings"}
            </Button>
          </div>
        </TabsContent>

        {/* ── Blocked IPs Tab ── */}
        <TabsContent value="blocked" className="mt-6">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2"><Ban size={16} className="text-red-500" /> Currently Blocked IPs</CardTitle>
                  <CardDescription className="text-xs mt-1">IPs auto-blocked by brute-force detection. Click Unblock to restore access.</CardDescription>
                </div>
                <Badge className={cn("text-sm px-3 py-1", blockedIps.length > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700")}>
                  {blockedIps.length} active block{blockedIps.length !== 1 ? "s" : ""}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {blockedIps.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ShieldCheck size={32} className="mx-auto mb-2 text-green-500 opacity-60" />
                  <p className="text-sm font-medium">No IPs currently blocked</p>
                  <p className="text-xs mt-1">All systems clear</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 border-b border-border/60">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">IP Address</th>
                        <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Reason</th>
                        <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Attempts</th>
                        <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Blocked Until</th>
                        <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {blockedIps.map(ip => (
                        <tr key={ip.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3 font-mono text-sm font-medium text-red-700">{ip.ipAddress}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">{ip.reason}</td>
                          <td className="px-4 py-3">
                            <Badge className="bg-red-50 text-red-700 border-red-200 text-xs">{ip.failedAttempts ?? 0} attempts</Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(ip.blockedUntil), { addSuffix: true })}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 gap-1 text-green-600 border-green-200 hover:bg-green-50"
                              onClick={() => unblockMutation.mutate(ip.ipAddress)}
                              disabled={unblockMutation.isPending}
                            >
                              <Unlock size={11} /> Unblock
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Security Logs Tab ── */}
        <TabsContent value="logs" className="mt-6">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2"><Shield size={16} className="text-primary" /> Security Event Log</CardTitle>
                  <CardDescription className="text-xs mt-1">All failed logins, blocked IPs, captcha failures, and bot detections. Last 7 days.</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="text-xs gap-1.5 text-muted-foreground" onClick={() => clearLogsMutation.mutate()}>
                  <Trash2 size={12} /> Clear old logs
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ShieldCheck size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">No security events yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 border-b border-border/60">
                      <tr>
                        <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Event</th>
                        <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">IP</th>
                        <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Email</th>
                        <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Path</th>
                        <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Details</th>
                        <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {logs.map(log => {
                        const meta = EVENT_LABELS[log.event] ?? { label: log.event, color: "text-foreground", icon: Shield };
                        const Icon = meta.icon;
                        return (
                          <tr key={log.id} className="hover:bg-muted/20">
                            <td className="px-3 py-2.5">
                              <span className={cn("flex items-center gap-1 font-medium", meta.color)}>
                                <Icon size={11} /> {meta.label}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 font-mono font-medium">{log.ipAddress}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{log.email ?? "—"}</td>
                            <td className="px-3 py-2.5 font-mono text-muted-foreground">{log.path ?? "—"}</td>
                            <td className="px-3 py-2.5 text-muted-foreground max-w-xs truncate">{log.details ?? "—"}</td>
                            <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
