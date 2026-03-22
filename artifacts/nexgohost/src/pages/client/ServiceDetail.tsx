import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/context/CurrencyProvider";
import {
  Server, Globe, Shield, Calendar, HardDrive, Activity,
  ShieldCheck, ShieldX, ExternalLink, ArrowLeft,
  RefreshCw, KeyRound, Loader2, LayoutGrid, Eye, EyeOff,
  CheckCircle2, AlertTriangle, Info
} from "lucide-react";
import { format } from "date-fns";

interface Service {
  id: string;
  planName: string;
  domain: string | null;
  status: string;
  billingCycle: string | null;
  nextDueDate: string | null;
  sslStatus: string;
  username: string | null;
  serverIp: string | null;
  cpanelUrl: string | null;
  webmailUrl: string | null;
  diskUsed: string | null;
  bandwidthUsed: string | null;
  cancelRequested: boolean;
  serverId: string | null;
}

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-400 border-green-500/30",
  suspended: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  terminated: "bg-red-500/10 text-red-400 border-red-500/30",
  pending: "bg-blue-500/10 text-blue-400 border-blue-500/30",
};

function parseUsagePercent(used: string | null, limitStr: string): number {
  if (!used) return 0;
  const usedGB = parseFloat(used) * (used.toLowerCase().includes("mb") ? 0.001 : 1);
  const limitGB = parseFloat(limitStr);
  return isNaN(usedGB) || isNaN(limitGB) ? 0 : Math.min(100, Math.round((usedGB / limitGB) * 100));
}

function authFetch(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token");
  return fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
}

export default function ServiceDetail() {
  const [, params] = useRoute("/client/hosting/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();

  const serviceId = params?.id;

  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [ssoLoading, setSsoLoading] = useState<"cpanel" | "webmail" | null>(null);

  // WordPress installer state
  const [showWpInstaller, setShowWpInstaller] = useState(false);
  const [wpForm, setWpForm] = useState({ siteName: "", adminUser: "admin", adminPassword: "", adminEmail: "" });
  const [wpLoading, setWpLoading] = useState(false);
  const [wpResult, setWpResult] = useState<{ credentials: { username: string; password: string; email: string; loginUrl: string } } | null>(null);

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    if (!serviceId) return;
    fetchService();
  }, [serviceId]);

  async function fetchService() {
    try {
      setLoading(true);
      const res = await authFetch(`/api/client/hosting/${serviceId}`);
      if (res.status === 404) { setLocation("/client/hosting"); return; }
      if (!res.ok) throw new Error("Failed to load service");
      const data = await res.json();
      setService(data);
    } catch {
      toast({ title: "Error", description: "Failed to load service details. Please try again.", variant: "destructive" });
      setLocation("/client/hosting");
    } finally {
      setLoading(false);
    }
  }

  async function handleCpanelLogin() {
    if (!service) return;
    setSsoLoading("cpanel");
    try {
      const res = await authFetch(`/api/client/hosting/${service.id}/cpanel-login`, { method: "POST" });
      const data = await res.json();
      if (data.url) { window.open(data.url, "_blank"); return; }
      if (!res.ok) {
        if (service.cpanelUrl) { window.open(service.cpanelUrl, "_blank"); return; }
        toast({ title: "Cannot open cPanel", description: data.error || "Service not yet provisioned. Contact support.", variant: "destructive" });
        return;
      }
      if (service.cpanelUrl) { window.open(service.cpanelUrl, "_blank"); return; }
      toast({ title: "Info", description: "No cPanel URL configured for this service" });
    } catch {
      if (service.cpanelUrl) window.open(service.cpanelUrl, "_blank");
      else toast({ title: "Error", description: "cPanel login failed", variant: "destructive" });
    } finally {
      setSsoLoading(null);
    }
  }

  async function handleWebmailLogin() {
    if (!service) return;
    setSsoLoading("webmail");
    try {
      const res = await authFetch(`/api/client/hosting/${service.id}/webmail-login`, { method: "POST" });
      const data = await res.json();
      if (data.url) { window.open(data.url, "_blank"); return; }
      if (!res.ok) {
        if (service.webmailUrl) { window.open(service.webmailUrl, "_blank"); return; }
        toast({ title: "Cannot open Webmail", description: data.error || "Service not yet provisioned. Contact support.", variant: "destructive" });
        return;
      }
      if (service.webmailUrl) { window.open(service.webmailUrl, "_blank"); return; }
      toast({ title: "Info", description: "No Webmail URL configured for this service" });
    } catch {
      if (service.webmailUrl) window.open(service.webmailUrl, "_blank");
      else toast({ title: "Error", description: "Webmail login failed", variant: "destructive" });
    } finally {
      setSsoLoading(null);
    }
  }

  async function handleInstallWordPress() {
    if (!service) return;
    setWpLoading(true);
    try {
      const res = await authFetch(`/api/client/hosting/${service.id}/install-wordpress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wpForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Installation failed");
      setWpResult(data);
      toast({ title: "WordPress Ready", description: "Your WordPress credentials have been generated." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setWpLoading(false);
    }
  }

  async function handleChangePassword() {
    if (!service) return;
    if (newPassword.length < 8) {
      toast({ title: "Error", description: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    setPasswordLoading(true);
    try {
      const res = await authFetch(`/api/client/hosting/${service.id}/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Password change failed");
      toast({ title: "Password Updated", description: "Your cPanel password has been changed successfully." });
      setNewPassword("");
      setShowPasswordChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setPasswordLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!service) return null;

  const diskPct = parseUsagePercent(service.diskUsed, "10");
  const bwPct = parseUsagePercent(service.bandwidthUsed, "100");

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/client/hosting")}>
          <ArrowLeft size={18} />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-3">
            {service.planName}
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider ${statusColors[service.status] || "bg-secondary border-border text-muted-foreground"}`}>
              {service.status}
            </span>
          </h2>
          {service.domain && (
            <div className="flex items-center gap-1.5 text-primary font-medium mt-0.5">
              <Globe size={14} />
              <span>{service.domain}</span>
            </div>
          )}
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border ${
          service.sslStatus === "active" || service.sslStatus === "installed"
            ? "bg-green-500/10 text-green-400 border-green-500/20"
            : "bg-muted text-muted-foreground border-border"
        }`}>
          {service.sslStatus === "active" || service.sslStatus === "installed"
            ? <ShieldCheck size={14} /> : <ShieldX size={14} />}
          SSL {service.sslStatus === "active" || service.sslStatus === "installed" ? "Active" : "Not Installed"}
        </div>
      </div>

      {/* Service Info Grid */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border/50">
          <h3 className="font-semibold text-foreground">Service Overview</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y divide-border/50">
          {[
            { label: "Server IP", value: service.serverIp || "Pending", icon: Server },
            { label: "Username", value: service.username || "—", icon: Shield },
            { label: "Billing Cycle", value: service.billingCycle ? service.billingCycle.charAt(0).toUpperCase() + service.billingCycle.slice(1) : "Monthly", icon: Calendar },
            { label: "Next Due Date", value: service.nextDueDate ? format(new Date(service.nextDueDate), "MMM d, yyyy") : "—", icon: Calendar },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="p-4 text-center">
              <Icon size={14} className="text-muted-foreground mx-auto mb-1" />
              <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
              <div className="text-sm font-medium text-foreground truncate">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Usage */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-semibold text-foreground mb-4">Resource Usage</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            { label: "Disk Usage", used: service.diskUsed || "0 MB", limit: "10 GB", pct: diskPct, icon: HardDrive },
            { label: "Bandwidth", used: service.bandwidthUsed || "0 MB", limit: "100 GB", pct: bwPct, icon: Activity },
          ].map(({ label, used, limit, pct, icon: Icon }) => (
            <div key={label}>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Icon size={14} /> {label}
                </div>
                <span className="text-sm font-medium text-foreground">{used} / {limit}</span>
              </div>
              <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pct > 80 ? "bg-red-400" : pct > 60 ? "bg-yellow-400" : "bg-primary"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground mt-1">{pct}% used</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Access */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-semibold text-foreground mb-4">Quick Access</h3>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleCpanelLogin}
            className="gap-2 bg-primary hover:bg-primary/90"
            disabled={service.status !== "active" || ssoLoading !== null}
          >
            {ssoLoading === "cpanel" ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={15} />}
            {ssoLoading === "cpanel" ? "Logging in..." : "Open Control Panel"}
          </Button>
          <Button
            variant="outline"
            onClick={handleWebmailLogin}
            className="gap-2"
            disabled={service.status !== "active" || ssoLoading !== null}
          >
            {ssoLoading === "webmail" ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={15} />}
            {ssoLoading === "webmail" ? "Logging in..." : "Login to Webmail"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowPasswordChange(!showPasswordChange)}
            className="gap-2"
            disabled={service.status !== "active"}
          >
            <KeyRound size={15} /> Change cPanel Password
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowWpInstaller(!showWpInstaller)}
            className="gap-2"
            disabled={service.status !== "active"}
          >
            <LayoutGrid size={15} /> Install WordPress
          </Button>
        </div>
      </div>

      {/* Change Password Panel */}
      {showPasswordChange && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-primary" />
            <h3 className="font-semibold text-foreground">Change cPanel Password</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Enter a new password for your cPanel/hosting account. Minimum 8 characters.
          </p>
          <div className="relative max-w-sm">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="New password (min. 8 characters)"
              value={newPassword}
              onChange={e => setNewPassword((e.target as HTMLInputElement).value)}
              className="pr-10"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword(v => !v)}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleChangePassword} disabled={passwordLoading || newPassword.length < 8} className="gap-2">
              {passwordLoading && <Loader2 size={15} className="animate-spin" />}
              Update Password
            </Button>
            <Button variant="outline" onClick={() => { setShowPasswordChange(false); setNewPassword(""); }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* WordPress Installer Panel */}
      {showWpInstaller && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <LayoutGrid size={18} className="text-primary" />
            <h3 className="font-semibold text-foreground">WordPress Auto-Installer</h3>
          </div>

          {wpResult ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle2 size={18} />
                <span className="font-medium">WordPress credentials generated!</span>
              </div>
              <div className="bg-secondary/50 rounded-xl p-4 space-y-2 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Login URL</span>
                  <a href={wpResult.credentials.loginUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    {wpResult.credentials.loginUrl}
                  </a>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Username</span>
                  <span className="text-foreground">{wpResult.credentials.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Password</span>
                  <span className="text-foreground font-bold">{wpResult.credentials.password}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="text-foreground">{wpResult.credentials.email}</span>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-sm text-yellow-400">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>Save these credentials — they won't be shown again. Complete the installation via your control panel's Softaculous/Installatron.</span>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setWpResult(null); setShowWpInstaller(false); }}>Close</Button>
                <Button variant="outline" onClick={() => setWpResult(null)}>Install Again</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-sm text-blue-400">
                <Info size={15} className="mt-0.5 shrink-0" />
                <span>This generates WordPress admin credentials for your domain <strong>{service.domain}</strong>. You'll need to complete the actual installation via Softaculous in your control panel.</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">Site Name</label>
                  <Input placeholder="My Website" value={wpForm.siteName}
                    onChange={e => setWpForm(f => ({ ...f, siteName: (e.target as HTMLInputElement).value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">Admin Username</label>
                  <Input placeholder="admin" value={wpForm.adminUser}
                    onChange={e => setWpForm(f => ({ ...f, adminUser: (e.target as HTMLInputElement).value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">Admin Password <span className="text-muted-foreground text-xs">(leave blank to auto-generate)</span></label>
                  <Input type="password" placeholder="Auto-generated if blank" value={wpForm.adminPassword}
                    onChange={e => setWpForm(f => ({ ...f, adminPassword: (e.target as HTMLInputElement).value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">Admin Email</label>
                  <Input type="email" placeholder={`admin@${service.domain || "yourdomain.com"}`} value={wpForm.adminEmail}
                    onChange={e => setWpForm(f => ({ ...f, adminEmail: (e.target as HTMLInputElement).value }))} />
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={handleInstallWordPress} disabled={wpLoading} className="gap-2">
                  {wpLoading && <Loader2 size={15} className="animate-spin" />}
                  Generate WordPress Credentials
                </Button>
                <Button variant="outline" onClick={() => setShowWpInstaller(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Danger Zone */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <h3 className="font-semibold text-foreground">Service Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setLocation("/client/orders/new")} className="gap-2">
            <RefreshCw size={15} /> Request Renewal
          </Button>
          <Button variant="outline" onClick={() => setLocation("/client/orders/new")} className="gap-2">
            Upgrade Plan
          </Button>
        </div>
      </div>
    </div>
  );
}
