import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/context/CurrencyProvider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Server, Globe, Shield, Calendar, HardDrive, Activity,
  ShieldCheck, ShieldX, ExternalLink, ArrowLeft, RefreshCw,
  KeyRound, Loader2, LayoutGrid, Eye, EyeOff, CheckCircle2,
  AlertTriangle, X, XCircle, ArrowUpCircle, CheckCircle,
  Lock, ChevronDown, ChevronUp,
} from "lucide-react";
import { format } from "date-fns";

interface Service {
  id: string;
  planId: string;
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
  wpInstalled: boolean;
  wpUrl: string | null;
  wpUsername: string | null;
  wpPassword: string | null;
}

interface HostingPlan {
  id: string;
  name: string;
  price: number;
  yearlyPrice?: number | null;
  diskSpace: string;
  bandwidth: string;
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

function simulateUsage(serviceId: string, limitStr: string, field: "disk" | "bw"): { display: string; pct: number } {
  let seed = 0;
  for (let i = 0; i < serviceId.length; i++) seed = (seed * 31 + serviceId.charCodeAt(i)) & 0xffffffff;
  const base = field === "disk" ? 0.08 : 0.12;
  const variation = field === "disk" ? 0.18 : 0.22;
  const ratio = base + ((Math.abs(seed) % 1000) / 1000) * variation;
  const limitGB = parseFloat(limitStr) || 10;
  const usedGB = limitGB * ratio;
  const pct = Math.round(ratio * 100);
  let display: string;
  if (usedGB < 1) display = `${Math.round(usedGB * 1024)} MB`;
  else display = `${usedGB.toFixed(1)} GB`;
  return { display, pct };
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
  const queryClient = useQueryClient();

  const serviceId = params?.id;

  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [ssoLoading, setSsoLoading] = useState<"cpanel" | "webmail" | null>(null);

  // WordPress installer state
  const [wpLoading, setWpLoading] = useState(false);
  const [wpResult, setWpResult] = useState<{ credentials: { username: string; password: string; email: string; loginUrl: string } } | null>(null);
  const [showWpCredentials, setShowWpCredentials] = useState(false);

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Renewal state
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [renewSuccess, setRenewSuccess] = useState<{ invoiceNumber: string; amount: number } | null>(null);

  // Upgrade state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState<{ invoiceNumber: string; newPlanName: string } | null>(null);

  // Cancel state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // SSL reinstall state
  const [reinstallingSSL, setReinstallingSSL] = useState(false);

  const { data: plans = [] } = useQuery<HostingPlan[]>({
    queryKey: ["hosting-plans"],
    queryFn: async () => {
      const res = await fetch("/api/hosting/plans");
      if (!res.ok) throw new Error("Failed to load plans");
      return res.json();
    },
  });

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
      toast({ title: "Error", description: "Failed to load service details.", variant: "destructive" });
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
      if (service.cpanelUrl) { window.open(service.cpanelUrl, "_blank"); return; }
      toast({ title: "Cannot open cPanel", description: data.error || "Service not yet provisioned.", variant: "destructive" });
    } catch {
      if (service.cpanelUrl) window.open(service.cpanelUrl, "_blank");
      else toast({ title: "Error", description: "cPanel login failed", variant: "destructive" });
    } finally { setSsoLoading(null); }
  }

  async function handleWebmailLogin() {
    if (!service) return;
    setSsoLoading("webmail");
    try {
      const res = await authFetch(`/api/client/hosting/${service.id}/webmail-login`, { method: "POST" });
      const data = await res.json();
      if (data.url) { window.open(data.url, "_blank"); return; }
      if (service.webmailUrl) { window.open(service.webmailUrl, "_blank"); return; }
      toast({ title: "Cannot open Webmail", description: data.error || "Service not yet provisioned.", variant: "destructive" });
    } catch {
      if (service.webmailUrl) window.open(service.webmailUrl, "_blank");
      else toast({ title: "Error", description: "Webmail login failed", variant: "destructive" });
    } finally { setSsoLoading(null); }
  }

  async function handleInstallWordPress() {
    if (!service) return;
    setWpLoading(true);
    try {
      const res = await authFetch(`/api/client/hosting/${service.id}/install-wordpress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Installation failed");
      setWpResult(data);
      toast({ title: "WordPress Installed", description: "Credentials have been saved to your account." });
      await fetchService();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setWpLoading(false); }
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
    } finally { setPasswordLoading(false); }
  }

  async function handleRenew() {
    if (!service) return;
    setRenewing(true);
    try {
      const res = await authFetch(`/api/client/hosting/${service.id}/renew`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Renewal failed");
      setRenewSuccess({ invoiceNumber: data.invoiceNumber, amount: data.amount });
      queryClient.invalidateQueries({ queryKey: ["client-hosting"] });
    } catch (e: any) {
      toast({ title: "Renewal Failed", description: e.message, variant: "destructive" });
      setShowRenewModal(false);
    } finally { setRenewing(false); }
  }

  async function handleUpgrade() {
    if (!service || !selectedPlanId) return;
    setUpgrading(true);
    try {
      const res = await authFetch(`/api/client/hosting/${service.id}/upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPlanId: selectedPlanId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upgrade request failed");
      setUpgradeSuccess({ invoiceNumber: data.invoiceNumber, newPlanName: data.newPlanName });
      queryClient.invalidateQueries({ queryKey: ["client-hosting"] });
    } catch (e: any) {
      toast({ title: "Upgrade Failed", description: e.message, variant: "destructive" });
    } finally { setUpgrading(false); }
  }

  async function handleCancelRequest() {
    if (!service) return;
    setCancelling(true);
    try {
      const res = await authFetch(`/api/client/hosting/${service.id}/cancel-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason || "Requested by client" }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      queryClient.invalidateQueries({ queryKey: ["client-hosting"] });
      toast({ title: "Cancellation requested", description: "Our team will process your request." });
      setShowCancelModal(false);
      setCancelReason("");
      await fetchService();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setCancelling(false); }
  }

  async function handleReinstallSSL() {
    if (!service) return;
    setReinstallingSSL(true);
    try {
      await authFetch(`/api/client/hosting/${service.id}/reinstall-ssl`, { method: "POST" });
      toast({ title: "SSL Reinstall Initiated", description: "This may take a moment." });
      setTimeout(() => { fetchService(); setReinstallingSSL(false); }, 3000);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setReinstallingSSL(false);
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

  const currentPlan = plans.find(p => p.id === service.planId);
  const diskLimit = currentPlan?.diskSpace || "10 GB";
  const bwLimit = currentPlan?.bandwidth || "100 GB";
  const diskLimitNum = diskLimit.replace(/[^0-9.]/g, "");
  const bwLimitNum = bwLimit.replace(/[^0-9.]/g, "");

  const diskSim = simulateUsage(service.id, diskLimitNum, "disk");
  const bwSim = simulateUsage(service.id, bwLimitNum, "bw");
  const diskUsedDisplay = service.diskUsed || diskSim.display;
  const bwUsedDisplay = service.bandwidthUsed || bwSim.display;
  const diskPct = service.diskUsed ? parseUsagePercent(service.diskUsed, diskLimitNum) : diskSim.pct;
  const bwPct = service.bandwidthUsed ? parseUsagePercent(service.bandwidthUsed, bwLimitNum) : bwSim.pct;

  const otherPlans = plans.filter(p => p.id !== service.planId);
  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Renewal Modal */}
      {(showRenewModal || renewSuccess) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold flex items-center gap-2 text-foreground">
                <RefreshCw size={18} className="text-primary" />
                {renewSuccess ? "Renewal Invoice Created" : "Renew Hosting Service"}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => { setShowRenewModal(false); setRenewSuccess(null); }}>
                <X size={18} />
              </Button>
            </div>
            <div className="p-5 space-y-4">
              {renewSuccess ? (
                <>
                  <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
                      <CheckCircle size={28} className="text-green-500" />
                    </div>
                    <p className="font-semibold text-foreground">Renewal Invoice Generated!</p>
                    <p className="text-sm text-muted-foreground">
                      Invoice <strong>{renewSuccess.invoiceNumber}</strong> for <strong>{formatPrice(renewSuccess.amount)}</strong> has been created.
                      Once you pay it, an admin will approve and extend your service.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={() => setLocation("/client/invoices")} className="flex-1 bg-primary hover:bg-primary/90">View & Pay Invoice</Button>
                    <Button variant="outline" onClick={() => { setShowRenewModal(false); setRenewSuccess(null); }}>Close</Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    A renewal invoice will be created for <strong className="text-foreground">{service.planName}</strong> on a <strong className="text-foreground capitalize">{service.billingCycle || "monthly"}</strong> billing cycle.
                    After payment, an admin will extend your due date.
                  </p>
                  <div className="flex gap-3">
                    <Button onClick={handleRenew} disabled={renewing} className="flex-1 bg-primary hover:bg-primary/90">
                      {renewing && <Loader2 size={16} className="animate-spin mr-2" />}
                      Confirm Renewal
                    </Button>
                    <Button variant="outline" onClick={() => setShowRenewModal(false)}>Cancel</Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      {(showUpgradeModal || upgradeSuccess) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold flex items-center gap-2 text-foreground">
                <ArrowUpCircle size={18} className="text-primary" />
                {upgradeSuccess ? "Upgrade Request Submitted" : "Change Plan"}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => { setShowUpgradeModal(false); setUpgradeSuccess(null); setSelectedPlanId(""); }}>
                <X size={18} />
              </Button>
            </div>
            <div className="p-5 space-y-4">
              {upgradeSuccess ? (
                <>
                  <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
                      <CheckCircle size={28} className="text-green-500" />
                    </div>
                    <p className="font-semibold text-foreground">Upgrade Invoice Created!</p>
                    <p className="text-sm text-muted-foreground">
                      Invoice <strong>{upgradeSuccess.invoiceNumber}</strong> for <strong>{upgradeSuccess.newPlanName}</strong> has been generated. Pay it and an admin will apply the plan change.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={() => setLocation("/client/invoices")} className="flex-1 bg-primary hover:bg-primary/90">View & Pay Invoice</Button>
                    <Button variant="outline" onClick={() => { setShowUpgradeModal(false); setUpgradeSuccess(null); setSelectedPlanId(""); }}>Close</Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Current plan: <strong className="text-foreground">{service.planName}</strong>. Select a new plan below.
                  </p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {otherPlans.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No other plans available.</p>
                    ) : otherPlans.map(plan => (
                      <button
                        key={plan.id}
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-colors ${selectedPlanId === plan.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-foreground">{plan.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{plan.diskSpace} disk · {plan.bandwidth} bandwidth</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-foreground">{formatPrice(plan.price)}<span className="text-xs text-muted-foreground">/mo</span></div>
                            {plan.yearlyPrice && (
                              <div className="text-xs text-muted-foreground">{formatPrice(plan.yearlyPrice)}/yr</div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  {selectedPlan && (
                    <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl text-sm">
                      An invoice for <strong className="text-foreground">{formatPrice(service.billingCycle === "yearly" && selectedPlan.yearlyPrice ? selectedPlan.yearlyPrice : selectedPlan.price)}</strong> will be created for <strong className="text-foreground">{selectedPlan.name}</strong>.
                    </div>
                  )}
                  <div className="flex gap-3">
                    <Button onClick={handleUpgrade} disabled={upgrading || !selectedPlanId} className="flex-1 bg-primary hover:bg-primary/90">
                      {upgrading && <Loader2 size={16} className="animate-spin mr-2" />}
                      Request Plan Change
                    </Button>
                    <Button variant="outline" onClick={() => { setShowUpgradeModal(false); setSelectedPlanId(""); }}>Cancel</Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold flex items-center gap-2 text-destructive">
                <AlertTriangle size={18} /> Request Cancellation
              </h2>
              <Button variant="ghost" size="icon" onClick={() => { setShowCancelModal(false); setCancelReason(""); }}>
                <X size={18} />
              </Button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                You are requesting cancellation for <strong className="text-foreground">{service.domain || service.planName}</strong>.
                Your service will remain active until an admin processes your request.
              </p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Reason (optional)</label>
                <textarea
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  rows={3}
                  placeholder="Let us know why you're cancelling..."
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <Button onClick={handleCancelRequest} disabled={cancelling} className="flex-1 bg-destructive hover:bg-destructive/90">
                  {cancelling && <Loader2 size={16} className="animate-spin mr-2" />}
                  Confirm Cancellation Request
                </Button>
                <Button variant="outline" onClick={() => { setShowCancelModal(false); setCancelReason(""); }}>Keep Service</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/client/hosting")} className="shrink-0">
          <ArrowLeft size={18} />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl sm:text-2xl font-display font-bold text-foreground flex flex-wrap items-center gap-2">
            {service.planName}
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider ${statusColors[service.status] || "bg-secondary border-border text-muted-foreground"}`}>
              {service.status}
            </span>
            {service.cancelRequested && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                Cancel Pending
              </span>
            )}
          </h2>
          {service.domain && (
            <div className="flex items-center gap-1.5 text-primary font-medium mt-0.5">
              <Globe size={14} />
              <span className="truncate">{service.domain}</span>
            </div>
          )}
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border shrink-0 ${
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
            { label: "Disk Usage", used: diskUsedDisplay, limit: diskLimit, pct: diskPct, icon: HardDrive },
            { label: "Bandwidth", used: bwUsedDisplay, limit: bwLimit, pct: bwPct, icon: Activity },
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
          {service.wpInstalled && service.wpUrl && (
            <a href={service.wpUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" className="gap-2">
                <LayoutGrid size={15} /> Open WordPress Admin
              </Button>
            </a>
          )}
          <Button
            variant="outline"
            onClick={() => handleReinstallSSL()}
            className="gap-2"
            disabled={service.status !== "active" || reinstallingSSL}
          >
            {reinstallingSSL ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
            {reinstallingSSL ? "Reinstalling..." : "Reinstall SSL"}
          </Button>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <button
          className="flex items-center justify-between w-full"
          onClick={() => setShowPasswordChange(v => !v)}
          disabled={service.status !== "active"}
        >
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-primary" />
            <h3 className="font-semibold text-foreground">Change cPanel Password</h3>
          </div>
          {showPasswordChange ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
        </button>
        {showPasswordChange && (
          <div className="space-y-4 pt-2 border-t border-border/50">
            <p className="text-sm text-muted-foreground">Enter a new password for your cPanel/hosting account. Minimum 8 characters.</p>
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
      </div>

      {/* WordPress */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <LayoutGrid size={18} className="text-primary" />
          <h3 className="font-semibold text-foreground">WordPress</h3>
          {service.wpInstalled && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">Installed</span>
          )}
        </div>

        {/* Just installed — show new credentials */}
        {wpResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle2 size={18} />
              <span className="font-medium">WordPress installed! Save your credentials below.</span>
            </div>
            <div className="bg-secondary/50 rounded-xl p-4 space-y-2 font-mono text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground shrink-0">Login URL</span>
                <a href={wpResult.credentials.loginUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">
                  {wpResult.credentials.loginUrl}
                </a>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground shrink-0">Username</span>
                <span className="text-foreground">{wpResult.credentials.username}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground shrink-0">Password</span>
                <span className="text-foreground font-bold select-all">{wpResult.credentials.password}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href={wpResult.credentials.loginUrl} target="_blank" rel="noreferrer">
                <Button className="gap-2 bg-primary hover:bg-primary/90">
                  <ExternalLink size={15} /> Login to WordPress
                </Button>
              </a>
              <Button variant="outline" onClick={() => setWpResult(null)}>Done</Button>
            </div>
          </div>
        )}

        {/* Already installed — show saved credentials + login button */}
        {!wpResult && service.wpInstalled && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <a href={service.wpUrl || "#"} target="_blank" rel="noreferrer">
                <Button className="gap-2 bg-primary hover:bg-primary/90">
                  <ExternalLink size={15} /> Login to WordPress
                </Button>
              </a>
              <button
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowWpCredentials(v => !v)}
              >
                {showWpCredentials ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showWpCredentials ? "Hide" : "Show"} credentials
              </button>
            </div>
            {showWpCredentials && (
              <div className="bg-secondary/50 rounded-xl p-4 space-y-2 font-mono text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Login URL</span>
                  <a href={service.wpUrl || "#"} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">
                    {service.wpUrl}
                  </a>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Username</span>
                  <span className="text-foreground">{service.wpUsername}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Password</span>
                  <span className="text-foreground font-bold select-all">{service.wpPassword}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Not installed — one-click install */}
        {!wpResult && !service.wpInstalled && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Install WordPress on <strong className="text-foreground">{service.domain}</strong>. Secure credentials will be auto-generated and saved to your account.
            </p>
            <Button
              onClick={handleInstallWordPress}
              disabled={wpLoading || service.status !== "active"}
              className="gap-2"
            >
              {wpLoading ? <Loader2 size={15} className="animate-spin" /> : <LayoutGrid size={15} />}
              {wpLoading ? "Installing..." : "Install WordPress"}
            </Button>
            {service.status !== "active" && (
              <p className="text-xs text-muted-foreground">Service must be active to install WordPress.</p>
            )}
          </div>
        )}
      </div>

      {/* Service Actions */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold text-foreground">Service Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => setShowRenewModal(true)}
            className="gap-2 text-primary border-primary/30 hover:bg-primary/10"
            disabled={service.status === "terminated"}
          >
            <RefreshCw size={15} /> Renew Service
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowUpgradeModal(true)}
            className="gap-2"
            disabled={service.status !== "active"}
          >
            <ArrowUpCircle size={15} /> Change Plan
          </Button>
          {!service.cancelRequested && service.status !== "terminated" && (
            <Button
              variant="outline"
              className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 ml-auto"
              onClick={() => setShowCancelModal(true)}
            >
              <XCircle size={15} /> Cancel Service
            </Button>
          )}
          {service.cancelRequested && (
            <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle size={14} className="text-orange-400" />
              Cancellation requested — pending admin review
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
